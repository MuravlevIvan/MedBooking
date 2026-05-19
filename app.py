import os
import traceback
from datetime import datetime, timedelta
from functools import wraps
from dotenv import load_dotenv
import uuid

from flask import Flask, request, jsonify, session, send_from_directory, g
from flask_socketio import SocketIO, emit
from flask_seasurf import SeaSurf
import bcrypt
import sqlite3
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')

load_dotenv()
app.secret_key = os.environ.get('SECRET_KEY')
if not app.secret_key:
    raise RuntimeError("SECRET_KEY не задан!")

app.config['CSRF_USE_SESSIONS'] = False
app.config['CSRF_COOKIE_NAME'] = 'csrf_token'
app.config['CSRF_COOKIE_HTTPONLY'] = False
app.config['CSRF_COOKIE_SAMESITE'] = 'Lax'
csrf = SeaSurf(app)

DATABASE = 'booking.db'
ADMIN_LOGIN = os.environ.get('ADMIN_LOGIN', 'admin').strip()
ADMIN_DEFAULT_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

def _ensure_tables():
    db = sqlite3.connect(DATABASE)
    db.execute('PRAGMA foreign_keys = ON')
    
    # Таблица users
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            login TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            first_name TEXT DEFAULT '',
            last_name TEXT DEFAULT '',
            middle_name TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT ''
        )
    ''')
    
    # Таблица pending_users
    db.execute('''
        CREATE TABLE IF NOT EXISTS pending_users (
            login TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            first_name TEXT DEFAULT '',
            last_name TEXT DEFAULT '',
            middle_name TEXT DEFAULT '',
            phone TEXT DEFAULT '',
            email TEXT DEFAULT ''
        )
    ''')
    
    # Таблица bookings
    db.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            slot_key TEXT,
            login TEXT NOT NULL,
            doctor TEXT DEFAULT 'doctor1',
            PRIMARY KEY (slot_key, doctor),
            FOREIGN KEY (login) REFERENCES users(login)
        )
    ''')
    
    # Миграция старых slot_key
    cursor = db.cursor()
    cursor.execute("SELECT slot_key, doctor FROM bookings")
    rows = cursor.fetchall()
    for row in rows:
        old_key = row[0]
        if '|' in old_key and ':' not in old_key.split('|')[1]:
            date_part, hour_part = old_key.split('|')
            new_key = f"{date_part}|{int(hour_part):02d}:00"
            if new_key != old_key:
                db.execute("UPDATE bookings SET slot_key = ? WHERE slot_key = ? AND doctor = ?", (new_key, old_key, row[1]))
                db.execute("UPDATE comments SET slot_key = ? WHERE slot_key = ? AND doctor = ?", (new_key, old_key, row[1]))
    
    # Таблица comments
    db.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            slot_key TEXT,
            doctor TEXT DEFAULT 'doctor1',
            text TEXT DEFAULT '',
            last_edited_by TEXT,
            last_edited_at TEXT,
            admin_comment TEXT DEFAULT '',
            success_meeting BOOLEAN DEFAULT 0,
            admin_edited_by TEXT,
            admin_edited_at TEXT,
            PRIMARY KEY (slot_key, doctor),
            FOREIGN KEY (slot_key, doctor) REFERENCES bookings(slot_key, doctor)
        )
    ''')
    
    # Таблица врачей (расширенная)
    db.execute('''
        CREATE TABLE IF NOT EXISTS doctors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            display_order INTEGER DEFAULT 0,
            slot_interval INTEGER DEFAULT 60,
            start_hour INTEGER DEFAULT 9,
            end_hour INTEGER DEFAULT 21,
            break_start TEXT DEFAULT '',
            break_end TEXT DEFAULT ''
        )
    ''')
    # Добавляем новые колонки, если их нет
    cursor.execute("PRAGMA table_info(doctors)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'slot_interval' not in columns:
        db.execute("ALTER TABLE doctors ADD COLUMN slot_interval INTEGER DEFAULT 60")
    if 'start_hour' not in columns:
        db.execute("ALTER TABLE doctors ADD COLUMN start_hour INTEGER DEFAULT 9")
    if 'end_hour' not in columns:
        db.execute("ALTER TABLE doctors ADD COLUMN end_hour INTEGER DEFAULT 21")
    if 'break_start' not in columns:
        db.execute("ALTER TABLE doctors ADD COLUMN break_start TEXT DEFAULT ''")
    if 'break_end' not in columns:
        db.execute("ALTER TABLE doctors ADD COLUMN break_end TEXT DEFAULT ''")
    
    doctors = [('doctor1', 'Врач 1', 1, 60, 9, 21, '', '')]
    for doc in doctors:
        db.execute('''INSERT OR IGNORE INTO doctors 
                      (id, name, display_order, slot_interval, start_hour, end_hour, break_start, break_end) 
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', doc)
    
    # Таблица глобальных настроек
    db.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    ''')
    
    # Устанавливаем заголовок по умолчанию, если отсутствует
    default_title = "📅 Консультация нутрициолога"
    row = db.execute("SELECT value FROM settings WHERE key = 'title'").fetchone()
    if not row:
        db.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ('title', default_title))
    
    # Создаём администратора
    hashed = bcrypt.hashpw(ADMIN_DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()
    db.execute('INSERT OR IGNORE INTO users (login, password_hash, first_name) VALUES (?, ?, ?)',
               (ADMIN_LOGIN, hashed, 'Администратор'))
    db.commit()
    db.close()
    logger.info("Таблицы созданы/обновлены. Администратор '%s' существует.", ADMIN_LOGIN)

with app.app_context():
    _ensure_tables()

socketio = SocketIO(app, async_mode='threading')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute('PRAGMA journal_mode=WAL')
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def is_admin():
    return session.get('user') == ADMIN_LOGIN

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Требуется авторизация'}), 401
        return f(*args, **kwargs)
    return decorated

def get_display_name(login):
    if login == ADMIN_LOGIN:
        return 'Администратор'
    db = get_db()
    row = db.execute('SELECT first_name, last_name, middle_name FROM users WHERE login = ?', (login,)).fetchone()
    if row:
        parts = [row['last_name'], row['first_name'], row['middle_name']]
        return ' '.join(filter(None, parts)) or login
    return login

# ---------------------- API: Аутентификация ----------------------
@app.route('/api/register', methods=['POST'])
@csrf.exempt
def register():
    data = request.get_json()
    login = data.get('login', '').strip().lower()
    password = data.get('password', '')
    if not login or login == ADMIN_LOGIN or not (login.isalnum() or '_' in login):
        return jsonify({'error': 'Логин может содержать только латиницу, цифры и _'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Пароль должен быть минимум 8 символов'}), 400
    db = get_db()
    if db.execute('SELECT 1 FROM users WHERE login = ?', (login,)).fetchone():
        return jsonify({'error': 'Пользователь уже существует'}), 409
    if db.execute('SELECT 1 FROM pending_users WHERE login = ?', (login,)).fetchone():
        return jsonify({'error': 'Заявка уже отправлена'}), 409
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db.execute('INSERT INTO pending_users (login, password_hash, first_name, last_name, middle_name, phone, email) VALUES (?,?,?,?,?,?,?)',
               (login, hashed, data.get('firstName', ''), data.get('lastName', ''), data.get('middleName', ''), data.get('phone', ''), data.get('email', '')))
    db.commit()
    return jsonify({'message': 'Заявка отправлена администратору'})

@app.route('/api/login', methods=['POST'])
@csrf.exempt
def login():
    data = request.get_json()
    login = data.get('login', '').strip().lower()
    password = data.get('password', '')
    db = get_db()
    if login == ADMIN_LOGIN:
        row = db.execute('SELECT password_hash FROM users WHERE login = ?', (ADMIN_LOGIN,)).fetchone()
        if row and bcrypt.checkpw(password.encode(), row['password_hash'].encode()):
            session['user'] = ADMIN_LOGIN
            return jsonify({'login': ADMIN_LOGIN, 'is_admin': True})
        else:
            return jsonify({'error': 'Неверный пароль администратора'}), 401
    row = db.execute('SELECT password_hash FROM users WHERE login = ?', (login,)).fetchone()
    if row:
        if bcrypt.checkpw(password.encode(), row['password_hash'].encode()):
            session['user'] = login
            return jsonify({'login': login, 'is_admin': False})
        else:
            return jsonify({'error': 'Неверный пароль'}), 401
    if db.execute('SELECT 1 FROM pending_users WHERE login = ?', (login,)).fetchone():
        return jsonify({'error': 'Заявка ожидает подтверждения'}), 403
    return jsonify({'error': 'Пользователь не найден'}), 404

@app.route('/api/logout', methods=['POST'])
@csrf.exempt
def logout():
    session.pop('user', None)
    return jsonify({'message': 'Вы вышли'})

@app.route('/api/me')
def me():
    if 'user' in session:
        return jsonify({'login': session['user'], 'is_admin': is_admin()})
    return jsonify({'login': None, 'is_admin': False})

@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    login = session['user']
    db = get_db()
    row = db.execute('SELECT * FROM users WHERE login = ?', (login,)).fetchone()
    if row:
        return jsonify({
            'login': row['login'],
            'firstName': row['first_name'],
            'lastName': row['last_name'],
            'middleName': row['middle_name'],
            'phone': row['phone'],
            'email': row['email']
        })
    db.execute('INSERT OR IGNORE INTO users (login, password_hash) VALUES (?, ?)', (login, ''))
    db.commit()
    return jsonify({'login': login, 'firstName': '', 'lastName': '', 'middleName': '', 'phone': '', 'email': ''})

# ---------------------- API: Пользователи (админ) ----------------------
@app.route('/api/users', methods=['GET'])
@login_required
def get_users():
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    db = get_db()
    users = db.execute('SELECT login, first_name, last_name, middle_name, phone, email FROM users').fetchall()
    bookings = db.execute('SELECT login, COUNT(*) as cnt FROM bookings GROUP BY login').fetchall()
    counts = {row['login']: row['cnt'] for row in bookings}
    result = []
    for u in users:
        result.append({
            'login': u['login'],
            'firstName': u['first_name'],
            'lastName': u['last_name'],
            'middleName': u['middle_name'],
            'phone': u['phone'],
            'email': u['email'],
            'bookingCount': counts.get(u['login'], 0)
        })
    return jsonify(result)

@app.route('/api/pending', methods=['GET'])
@login_required
def get_pending():
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    db = get_db()
    rows = db.execute('SELECT * FROM pending_users').fetchall()
    pending = []
    for r in rows:
        pending.append({
            'login': r['login'],
            'firstName': r['first_name'],
            'lastName': r['last_name'],
            'middleName': r['middle_name'],
            'phone': r['phone'],
            'email': r['email'],
            'password': r['password_hash']
        })
    return jsonify(pending)

@app.route('/api/users/approve/<login>', methods=['POST'])
@login_required
def approve_user(login):
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    db = get_db()
    row = db.execute('SELECT * FROM pending_users WHERE login = ?', (login,)).fetchone()
    if not row:
        return jsonify({'error': 'Пользователь не найден в ожидающих'}), 404
    db.execute('INSERT INTO users (login, password_hash, first_name, last_name, middle_name, phone, email) VALUES (?,?,?,?,?,?,?)',
               (row['login'], row['password_hash'], row['first_name'], row['last_name'], row['middle_name'], row['phone'], row['email']))
    db.execute('DELETE FROM pending_users WHERE login = ?', (login,))
    db.commit()
    socketio.emit('user_updated', {})
    return jsonify({'message': f'Пользователь {login} подтверждён'})

@app.route('/api/users/reject/<login>', methods=['POST'])
@login_required
def reject_user(login):
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    db = get_db()
    db.execute('DELETE FROM pending_users WHERE login = ?', (login,))
    db.commit()
    socketio.emit('user_updated', {})
    return jsonify({'message': f'Заявка {login} отклонена'})

@app.route('/api/users/create', methods=['POST'])
@login_required
def create_user():
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    data = request.get_json()
    login = data['login'].strip().lower()
    password = data['password']
    if not login or login == ADMIN_LOGIN or not login.isalnum():
        return jsonify({'error': 'Логин содержит недопустимые символы'}), 400
    if len(password) < 3:
        return jsonify({'error': 'Пароль должен быть не менее 3 символов'}), 400
    db = get_db()
    if db.execute('SELECT 1 FROM users WHERE login = ?', (login,)).fetchone():
        return jsonify({'error': 'Пользователь уже существует'}), 409
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    db.execute('INSERT INTO users (login, password_hash, first_name, last_name, middle_name, phone, email) VALUES (?,?,?,?,?,?,?)',
               (login, hashed, data.get('firstName', ''), data.get('lastName', ''), data.get('middleName', ''), data.get('phone', ''), data.get('email', '')))
    db.commit()
    socketio.emit('user_updated', {})
    return jsonify({'message': f'Пользователь {login} создан'})

@app.route('/api/users/update/<login>', methods=['POST'])
@login_required
def update_user(login):
    if not is_admin() and session.get('user') != login:
        return jsonify({'error': 'Доступ запрещён'}), 403
    data = request.get_json()
    db = get_db()
    db.execute('UPDATE users SET first_name=?, last_name=?, middle_name=?, phone=?, email=? WHERE login=?',
               (data.get('firstName', ''), data.get('lastName', ''), data.get('middleName', ''), data.get('phone', ''), data.get('email', ''), login))
    new_password = data.get('password')
    if new_password and len(new_password) >= 3:
        hashed = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        db.execute('UPDATE users SET password_hash=? WHERE login=?', (hashed, login))
    db.commit()
    row = db.execute('SELECT * FROM users WHERE login = ?', (login,)).fetchone()
    profile = {
        'login': row['login'],
        'firstName': row['first_name'],
        'lastName': row['last_name'],
        'middleName': row['middle_name'],
        'phone': row['phone'],
        'email': row['email']
    }
    socketio.emit('user_updated', {})
    return jsonify({'message': 'Профиль обновлён', 'profile': profile})

@app.route('/api/users/delete/<login>', methods=['DELETE'])
@login_required
def delete_user(login):
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    db = get_db()
    if login == ADMIN_LOGIN:
        return jsonify({'error': 'Нельзя удалить администратора'}), 400
    db.execute('DELETE FROM comments WHERE slot_key IN (SELECT slot_key FROM bookings WHERE login=?)', (login,))
    db.execute('DELETE FROM bookings WHERE login=?', (login,))
    db.execute('DELETE FROM users WHERE login=?', (login,))
    db.commit()
    socketio.emit('user_updated', {})
    return jsonify({'message': f'Пользователь {login} удалён'})

# ---------------------- API: Бронирования ----------------------
@app.route('/api/bookings', methods=['GET'])
@login_required
def get_bookings():
    doctor = request.args.get('doctor', 'doctor1')
    db = get_db()
    now = datetime.now()
    result = []
    if is_admin():
        rows = db.execute('SELECT * FROM bookings WHERE doctor = ?', (doctor,)).fetchall()
    else:
        rows = db.execute('SELECT * FROM bookings WHERE login = ? AND doctor = ?', (session['user'], doctor)).fetchall()
    for r in rows:
        date_str, time_str = r['slot_key'].split('|')
        slot_dt = datetime.strptime(f"{date_str} {time_str}", '%Y-%m-%d %H:%M')
        if slot_dt >= now:
            result.append({'date': date_str, 'time': time_str, 'login': r['login'], 'key': r['slot_key']})
    return jsonify(result)

@app.route('/api/bookings/all', methods=['GET'])
def get_all_bookings():
    doctor = request.args.get('doctor', 'doctor1')
    db = get_db()
    rows = db.execute('SELECT * FROM bookings WHERE doctor = ?', (doctor,)).fetchall()
    result = []
    for r in rows:
        date_str, time_str = r['slot_key'].split('|')
        result.append({'date': date_str, 'time': time_str, 'login': r['login'], 'key': r['slot_key']})
    return jsonify(result)

@app.route('/api/bookings', methods=['POST'])
@login_required
def create_bookings():
    try:
        data = request.get_json()
        slots = data.get('slots', [])
        doctor = data.get('doctor', 'doctor1')
        if not slots:
            return jsonify({'error': 'Слоты не указаны'}), 400
        target = session.get('user')
        if is_admin() and 'targetUser' in data:
            target = data['targetUser']
            db = get_db()
            if not db.execute('SELECT 1 FROM users WHERE login = ?', (target,)).fetchone():
                return jsonify({'error': 'Целевой пользователь не существует'}), 404
        db = get_db()
        now = datetime.now()
        created = 0
        for slot_key in slots:
            try:
                date_str, time_str = slot_key.split('|')
                slot_dt = datetime.strptime(f"{date_str} {time_str}", '%Y-%m-%d %H:%M')
            except (ValueError, TypeError):
                continue
            if slot_dt < now:
                continue
            existing = db.execute('SELECT 1 FROM bookings WHERE slot_key = ? AND doctor = ?', (slot_key, doctor)).fetchone()
            if not existing:
                db.execute('INSERT INTO bookings (slot_key, login, doctor) VALUES (?, ?, ?)', (slot_key, target, doctor))
                created += 1
        db.commit()
        socketio.emit('booking_updated', {'doctor': doctor})
        return jsonify({'message': f'Забронировано {created} слотов', 'created': created})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/bookings/<date>/<path:time>', methods=['DELETE'])
@login_required
def cancel_booking(date, time):
    doctor = request.args.get('doctor', 'doctor1')
    key = f"{date}|{time}"
    db = get_db()
    booking = db.execute('SELECT * FROM bookings WHERE slot_key = ? AND doctor = ?', (key, doctor)).fetchone()
    if not booking:
        return jsonify({'error': 'Бронь не найдена'}), 404
    if not is_admin() and booking['login'] != session['user']:
        return jsonify({'error': 'Нет прав на отмену'}), 403
    db.execute('DELETE FROM comments WHERE slot_key = ? AND doctor = ?', (key, doctor))
    db.execute('DELETE FROM bookings WHERE slot_key = ? AND doctor = ?', (key, doctor))
    db.commit()
    socketio.emit('booking_updated', {'doctor': doctor})
    return jsonify({'message': 'Бронь отменена'})

# ---------------------- API: Административные данные встречи ----------------------
@app.route('/api/admin/meeting/<date>/<path:time>', methods=['GET'])
@login_required
def get_admin_meeting_data(date, time):
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    doctor = request.args.get('doctor', 'doctor1')
    key = f"{date}|{time}"
    db = get_db()
    row = db.execute('SELECT admin_comment, success_meeting FROM comments WHERE slot_key = ? AND doctor = ?', (key, doctor)).fetchone()
    if row:
        return jsonify({
            'adminComment': row['admin_comment'] or '',
            'successMeeting': bool(row['success_meeting'])
        })
    return jsonify({'adminComment': '', 'successMeeting': False})

@app.route('/api/admin/meeting/<date>/<path:time>', methods=['PUT'])
@login_required
def update_admin_meeting_data(date, time):
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    doctor = request.args.get('doctor', 'doctor1')
    key = f"{date}|{time}"
    data = request.get_json()
    admin_comment = data.get('adminComment', '')
    success_meeting = 1 if data.get('successMeeting') else 0

    db = get_db()
    booking = db.execute('SELECT 1 FROM bookings WHERE slot_key = ? AND doctor = ?', (key, doctor)).fetchone()
    if not booking:
        return jsonify({'error': 'Слот не забронирован'}), 404

    now_str = datetime.now().strftime('%d.%m.%Y %H:%M')
    db.execute('''
        INSERT INTO comments (slot_key, doctor, admin_comment, success_meeting, admin_edited_by, admin_edited_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(slot_key, doctor) DO UPDATE SET
            admin_comment = excluded.admin_comment,
            success_meeting = excluded.success_meeting,
            admin_edited_by = excluded.admin_edited_by,
            admin_edited_at = excluded.admin_edited_at
    ''', (key, doctor, admin_comment, success_meeting, session['user'], now_str))
    db.commit()
    socketio.emit('admin_meeting_updated', {'slot_key': key, 'doctor': doctor})
    return jsonify({'message': 'Данные встречи обновлены'})

# ---------------------- API: История бронирований ----------------------
@app.route('/api/bookings/history')
@login_required
def get_booking_history():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 30, type=int)
    search = request.args.get('search', '').strip()
    doctor = request.args.get('doctor', '').strip()
    if page < 1:
        page = 1
    offset = (page - 1) * limit
    db = get_db()

    if is_admin():
        query = '''
            SELECT b.slot_key, b.login, b.doctor,
                   c.text as comment_text, c.last_edited_by, c.last_edited_at,
                   c.admin_comment, c.success_meeting,
                   u.first_name, u.last_name, u.middle_name
            FROM bookings b
            LEFT JOIN comments c ON b.slot_key = c.slot_key AND b.doctor = c.doctor
            LEFT JOIN users u ON b.login = u.login
            WHERE 1=1
        '''
        params = []
        if doctor:
            query += ' AND b.doctor = ?'
            params.append(doctor)
        if search:
            search_like = f'%{search}%'
            query += ' AND (b.login LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.middle_name LIKE ?)'
            params.extend([search_like, search_like, search_like, search_like])

        count_sql = 'SELECT COUNT(*) as cnt FROM bookings b LEFT JOIN users u ON b.login = u.login WHERE 1=1'
        count_params = []
        if doctor:
            count_sql += ' AND b.doctor = ?'
            count_params.append(doctor)
        if search:
            count_sql += ' AND (b.login LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.middle_name LIKE ?)'
            count_params.extend([search_like, search_like, search_like, search_like])

        total = db.execute(count_sql, count_params).fetchone()['cnt']
        query += ' ORDER BY substr(b.slot_key, 1, 10) DESC, substr(b.slot_key, 12) DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        rows = db.execute(query, params).fetchall()
    else:
        user = session['user']
        query = '''
            SELECT b.slot_key, b.login, b.doctor,
                   c.text as comment_text, c.last_edited_by, c.last_edited_at
            FROM bookings b
            LEFT JOIN comments c ON b.slot_key = c.slot_key AND b.doctor = c.doctor
            WHERE b.login = ?
        '''
        params = [user]
        if doctor:
            query += ' AND b.doctor = ?'
            params.append(doctor)
        query += ' ORDER BY substr(b.slot_key, 1, 10) DESC, substr(b.slot_key, 12) DESC LIMIT ? OFFSET ?'
        params.extend([limit, offset])
        rows = db.execute(query, params).fetchall()

        count_sql = 'SELECT COUNT(*) as cnt FROM bookings WHERE login = ?'
        count_params = [user]
        if doctor:
            count_sql += ' AND doctor = ?'
            count_params.append(doctor)
        total = db.execute(count_sql, count_params).fetchone()['cnt']

    bookings = []
    now = datetime.now()
    for row in rows:
        key = row['slot_key']
        date_str, time_str = key.split('|')
        slot_dt = datetime.strptime(f"{date_str} {time_str}", '%Y-%m-%d %H:%M')
        is_past = slot_dt < now
        comment_text = row['comment_text'] or ''
        if is_admin():
            name_parts = [row['last_name'], row['first_name'], row['middle_name']]
            display_name = ' '.join(filter(None, name_parts)) or row['login']
        else:
            display_name = None
        bookings.append({
            'key': key,
            'date': date_str,
            'time': time_str,
            'login': row['login'],
            'doctor': row['doctor'],
            'comment': comment_text,
            'lastEditedBy': row['last_edited_by'],
            'lastEditedAt': row['last_edited_at'],
            'displayName': display_name,
            'isPast': is_past,
            'adminComment': row['admin_comment'] if is_admin() else None,
            'successMeeting': bool(row['success_meeting']) if is_admin() else None
        })
    pages = (total + limit - 1) // limit
    return jsonify({'bookings': bookings, 'total': total, 'page': page, 'pages': pages, 'limit': limit})

# ---------------------- API: Комментарии ----------------------
@app.route('/api/comments/<date>/<path:time>', methods=['GET'])
def get_comment(date, time):
    doctor = request.args.get('doctor', 'doctor1')
    key = f"{date}|{time}"
    db = get_db()
    row = db.execute('SELECT * FROM comments WHERE slot_key = ? AND doctor = ?', (key, doctor)).fetchone()
    if row:
        return jsonify({'text': row['text'], 'lastEditedBy': row['last_edited_by'], 'lastEditedAt': row['last_edited_at']})
    return jsonify({'text': '', 'lastEditedBy': None, 'lastEditedAt': None})

@app.route('/api/comments/<date>/<path:time>', methods=['PUT'])
@login_required
def update_comment(date, time):
    doctor = request.args.get('doctor', 'doctor1')
    key = f"{date}|{time}"
    db = get_db()
    booking = db.execute('SELECT * FROM bookings WHERE slot_key = ? AND doctor = ?', (key, doctor)).fetchone()
    if not booking:
        return jsonify({'error': 'Слот не забронирован'}), 404
    if not is_admin() and booking['login'] != session['user']:
        return jsonify({'error': 'Нет прав на редактирование'}), 403
    if not is_admin():
        slot_dt = datetime.strptime(f"{date} {time}", '%Y-%m-%d %H:%M')
        if slot_dt < datetime.now():
            return jsonify({'error': 'Нельзя редактировать комментарий к прошедшему слоту'}), 403
    data = request.get_json()
    text = data.get('text', '')
    now_str = datetime.now().strftime('%d.%m.%Y %H:%M')
    db.execute('''INSERT OR REPLACE INTO comments (slot_key, doctor, text, last_edited_by, last_edited_at)
                  VALUES (?, ?, ?, ?, ?)''',
               (key, doctor, text, session['user'], now_str))
    db.commit()
    socketio.emit('comment_updated', {'slot_key': key, 'doctor': doctor})
    return jsonify({'message': 'Комментарий сохранён'})

# ---------------------- API: Врачи (CRUD с настройками) ----------------------
@app.route('/api/doctors', methods=['GET'])
def get_doctors():
    db = get_db()
    rows = db.execute('SELECT id, name, slot_interval, start_hour, end_hour, break_start, break_end FROM doctors ORDER BY display_order').fetchall()
    return jsonify([{
        'id': row['id'], 
        'name': row['name'],
        'slotInterval': row['slot_interval'],
        'startHour': row['start_hour'],
        'endHour': row['end_hour'],
        'breakStart': row['break_start'] or '',
        'breakEnd': row['break_end'] or ''
    } for row in rows])

@app.route('/api/doctors', methods=['POST'])
@login_required
def create_doctor():
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    data = request.get_json()
    name = data.get('name', '').strip()
    slot_interval = data.get('slotInterval', 60)
    start_hour = data.get('startHour', 9)
    end_hour = data.get('endHour', 21)
    break_start = data.get('breakStart', '')
    break_end = data.get('breakEnd', '')
    
    if not name:
        return jsonify({'error': 'Название врача не может быть пустым'}), 400
    if slot_interval not in [10, 15, 30, 60]:
        slot_interval = 60
    if start_hour < 0 or start_hour > 23:
        start_hour = 9
    if end_hour < start_hour or end_hour > 24:
        end_hour = start_hour + 1
    if break_start and break_end:
        try:
            datetime.strptime(break_start, '%H:%M')
            datetime.strptime(break_end, '%H:%M')
        except:
            break_start = break_end = ''
    else:
        break_start = break_end = ''

    db = get_db()
    max_order = db.execute('SELECT COALESCE(MAX(display_order), 0) FROM doctors').fetchone()[0]
    new_order = max_order + 1
    new_id = f"doctor_{uuid.uuid4().hex[:12]}"
    db.execute('''INSERT INTO doctors (id, name, display_order, slot_interval, start_hour, end_hour, break_start, break_end) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
               (new_id, name, new_order, slot_interval, start_hour, end_hour, break_start, break_end))
    db.commit()
    socketio.emit('doctors_updated', {})
    return jsonify({
        'id': new_id, 
        'name': name, 
        'slotInterval': slot_interval,
        'startHour': start_hour,
        'endHour': end_hour,
        'breakStart': break_start,
        'breakEnd': break_end,
        'display_order': new_order
    })

@app.route('/api/doctors/<doctor_id>', methods=['PUT'])
@login_required
def update_doctor(doctor_id):
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    data = request.get_json()
    updates = {}
    
    if 'name' in data:
        new_name = data.get('name', '').strip()
        if new_name:
            updates['name'] = new_name
    if 'slotInterval' in data:
        interval = data['slotInterval']
        if interval in [10, 15, 30, 60]:
            updates['slot_interval'] = interval
    if 'startHour' in data:
        sh = data['startHour']
        if 0 <= sh <= 23:
            updates['start_hour'] = sh
    if 'endHour' in data:
        eh = data['endHour']
        if 0 <= eh <= 24:
            updates['end_hour'] = eh
    if 'breakStart' in data:
        bs = data['breakStart'] or ''
        if bs:
            try:
                datetime.strptime(bs, '%H:%M')
            except:
                bs = ''
        updates['break_start'] = bs
    if 'breakEnd' in data:
        be = data['breakEnd'] or ''
        if be:
            try:
                datetime.strptime(be, '%H:%M')
            except:
                be = ''
        updates['break_end'] = be
    
    if not updates:
        return jsonify({'error': 'Нет данных для обновления'}), 400
    
    db = get_db()
    for key, value in updates.items():
        db.execute(f'UPDATE doctors SET {key} = ? WHERE id = ?', (value, doctor_id))
    db.commit()
    socketio.emit('doctors_updated', {})
    return jsonify({'message': 'Врач обновлён'})

@app.route('/api/doctors/<doctor_id>', methods=['DELETE'])
@login_required
def delete_doctor(doctor_id):
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    
    # ЗАПРЕЩАЕМ УДАЛЕНИЕ ВРАЧА doctor1
    if doctor_id == 'doctor1':
        return jsonify({'error': 'Нельзя удалить основного врача (Врач 1)'}), 400

    db = get_db()
    count = db.execute('SELECT COUNT(*) FROM doctors').fetchone()[0]
    if count <= 1:
        return jsonify({'error': 'Нельзя удалить единственного врача'}), 400

    db.execute('DELETE FROM comments WHERE doctor = ?', (doctor_id,))
    db.execute('DELETE FROM bookings WHERE doctor = ?', (doctor_id,))
    db.execute('DELETE FROM doctors WHERE id = ?', (doctor_id,))
    db.commit()
    socketio.emit('doctors_updated', {})
    return jsonify({'message': 'Врач удалён'})

# ---------------------- API: Заголовок страницы ----------------------
@app.route('/api/settings/title', methods=['GET'])
def get_title():
    db = get_db()
    row = db.execute("SELECT value FROM settings WHERE key = 'title'").fetchone()
    title = row['value'] if row else "📅 Консультация нутрициолога"
    return jsonify({'title': title})

@app.route('/api/settings/title', methods=['POST'])
@login_required
def update_title():
    if not is_admin():
        return jsonify({'error': 'Доступ запрещён'}), 403
    data = request.get_json()
    new_title = data.get('title', '').strip()
    if not new_title:
        return jsonify({'error': 'Заголовок не может быть пустым'}), 400
    db = get_db()
    db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ('title', new_title))
    db.commit()
    socketio.emit('title_updated', {'title': new_title})
    return jsonify({'message': 'Заголовок обновлён', 'title': new_title})

# ---------------------- Главная страница ----------------------
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)