import os
import traceback
from datetime import datetime
from functools import wraps
from dotenv import load_dotenv

from flask import Flask, request, jsonify, session, send_from_directory, g
from flask_socketio import SocketIO, emit
from flask_seasurf import SeaSurf
import bcrypt
import sqlite3

# ---------------------- Константы ----------------------
app = Flask(__name__, static_folder='static')

load_dotenv()
app.secret_key = os.environ.get('SECRET_KEY')


if not app.secret_key:
    raise RuntimeError("SECRET_KEY не задан! Укажите переменную окружения SECRET_KEY.")

# Кука CSRF должна быть доступна из JavaScript
app.config['CSRF_USE_SESSIONS'] = False        # не хранить токен только в сессии
app.config['CSRF_COOKIE_NAME'] = 'csrf_token'  # имя куки
app.config['CSRF_COOKIE_HTTPONLY'] = False     # разрешить JavaScript читать куку
app.config['CSRF_COOKIE_SAMESITE'] = 'Lax'     # для работы через IP
# CSRF-защита
csrf = SeaSurf(app)

DATABASE = 'booking.db'
ADMIN_LOGIN = os.environ.get('ADMIN_LOGIN').strip()
ADMIN_DEFAULT_PASSWORD = os.environ.get('ADMIN_PASSWORD')

if not ADMIN_LOGIN:
    raise RuntimeError("ADMIN_LOGIN не задан или пуст!")

def _ensure_tables():
    """Создать таблицы, если их ещё нет (выполняется при старте)."""
    db = sqlite3.connect(DATABASE)
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
    db.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            slot_key TEXT PRIMARY KEY,
            login TEXT NOT NULL,
            FOREIGN KEY (login) REFERENCES users(login)
        )
    ''')
    db.execute('''
        CREATE TABLE IF NOT EXISTS comments (
            slot_key TEXT PRIMARY KEY,
            text TEXT DEFAULT '',
            last_edited_by TEXT,
            last_edited_at TEXT,
            FOREIGN KEY (slot_key) REFERENCES bookings(slot_key)
        )
    ''')
    # Создаём администратора, если его ещё нет
    if not db.execute('SELECT 1 FROM users WHERE login = ?', (ADMIN_LOGIN,)).fetchone():
        import bcrypt
        hashed = bcrypt.hashpw(ADMIN_DEFAULT_PASSWORD.encode(), bcrypt.gensalt()).decode()
        db.execute(
            'INSERT INTO users (login, password_hash, first_name) VALUES (?, ?, ?)',
            (ADMIN_LOGIN, hashed, 'Администратор')
        )
    db.commit()
    db.close()

# Вызов при загрузке модуля
with app.app_context():
    _ensure_tables()

# ---------------------- Инициализация Socket.IO ----------------------
socketio = SocketIO(app, async_mode='threading')  # для простоты; при использовании eventlet заменить

# ---------------------- Работа с БД ----------------------
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

# ---------------------- Обработчики ошибок ----------------------
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Маршрут не найден", "requested_url": request.url}), 404

@app.errorhandler(403)
def csrf_failure(e):
    return jsonify({'error': 'CSRF token missing or incorrect'}), 403

@app.errorhandler(Exception)
def handle_exception(e):
    traceback.print_exc()
    response = jsonify({"error": "Внутренняя ошибка сервера. Попробуйте позже."})
    response.status_code = 500
    return response

# ---------------------- Вспомогательные функции ----------------------
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
    if len(password) < 8:   # минимальная длина 8
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
                   # новый CSRF-токен после логина
            return jsonify({'login': ADMIN_LOGIN, 'is_admin': True})
        else:
            return jsonify({'error': 'Неверный пароль администратора'}), 401

    row = db.execute('SELECT password_hash FROM users WHERE login = ?', (login,)).fetchone()
    if row:
        if bcrypt.checkpw(password.encode(), row['password_hash'].encode()):
            session['user'] = login
                  # новый CSRF-токен
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
    db = get_db()
    now = datetime.now()
    result = []
    if is_admin():
        rows = db.execute('SELECT * FROM bookings').fetchall()
    else:
        rows = db.execute('SELECT * FROM bookings WHERE login = ?', (session['user'],)).fetchall()

    for r in rows:
        date_str, hour = r['slot_key'].split('|')
        slot_dt = datetime.strptime(f"{date_str} {hour}:00", '%Y-%m-%d %H:%M')
        if slot_dt >= now or is_admin():
            result.append({'date': date_str, 'hour': int(hour), 'login': r['login'], 'key': r['slot_key']})
    return jsonify(result)

@app.route('/api/bookings/all', methods=['GET'])
def get_all_bookings():
    db = get_db()
    rows = db.execute('SELECT * FROM bookings').fetchall()
    result = []
    for r in rows:
        date_str, hour = r['slot_key'].split('|')
        result.append({'date': date_str, 'hour': int(hour), 'login': r['login'], 'key': r['slot_key']})
    return jsonify(result)

@app.route('/api/bookings', methods=['POST'])
@login_required
def create_bookings():
    try:
        data = request.get_json()
        slots = data.get('slots', [])
        if not slots:
            return jsonify({'error': 'Слоты не указаны'}), 400

        target = session.get('user')
        if not target:
            return jsonify({'error': 'Пользователь не авторизован'}), 401

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
                date_str, hour = slot_key.split('|')
                slot_dt = datetime.strptime(f"{date_str} {hour}:00", '%Y-%m-%d %H:%M')
            except (ValueError, TypeError):
                continue
            if slot_dt < now:
                continue
            if not db.execute('SELECT 1 FROM bookings WHERE slot_key = ?', (slot_key,)).fetchone():
                db.execute('INSERT INTO bookings (slot_key, login) VALUES (?, ?)', (slot_key, target))
                created += 1
        db.commit()

        socketio.emit('booking_updated', {})
        return jsonify({'message': f'Забронировано {created} слотов', 'created': created})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/bookings/<date>/<int:hour>', methods=['DELETE'])
@login_required
def cancel_booking(date, hour):
    key = f"{date}|{hour}"
    db = get_db()
    booking = db.execute('SELECT * FROM bookings WHERE slot_key = ?', (key,)).fetchone()
    if not booking:
        return jsonify({'error': 'Бронь не найдена'}), 404
    if not is_admin() and booking['login'] != session['user']:
        return jsonify({'error': 'Нет прав на отмену'}), 403

    db.execute('DELETE FROM comments WHERE slot_key = ?', (key,))
    db.execute('DELETE FROM bookings WHERE slot_key = ?', (key,))
    db.commit()

    socketio.emit('booking_updated', {})
    return jsonify({'message': 'Бронь отменена'})

# ---------------------- API: Комментарии ----------------------
@app.route('/api/comments/<date>/<int:hour>', methods=['GET'])
def get_comment(date, hour):
    key = f"{date}|{hour}"
    db = get_db()
    row = db.execute('SELECT * FROM comments WHERE slot_key = ?', (key,)).fetchone()
    if row:
        return jsonify({'text': row['text'], 'lastEditedBy': row['last_edited_by'], 'lastEditedAt': row['last_edited_at']})
    return jsonify({'text': '', 'lastEditedBy': None, 'lastEditedAt': None})

@app.route('/api/comments/<date>/<int:hour>', methods=['PUT'])
@login_required
def update_comment(date, hour):
    key = f"{date}|{hour}"
    db = get_db()
    booking = db.execute('SELECT * FROM bookings WHERE slot_key = ?', (key,)).fetchone()
    if not booking:
        return jsonify({'error': 'Слот не забронирован'}), 404
    if not is_admin() and booking['login'] != session['user']:
        return jsonify({'error': 'Нет прав на редактирование'}), 403

    data = request.get_json()
    text = data.get('text', '')
    now_str = datetime.now().strftime('%d.%m.%Y %H:%M')
    db.execute('INSERT OR REPLACE INTO comments (slot_key, text, last_edited_by, last_edited_at) VALUES (?,?,?,?)',
               (key, text, session['user'], now_str))
    db.commit()

    socketio.emit('comment_updated', {'slot_key': key})
    return jsonify({'message': 'Комментарий сохранён'})

# ---------------------- Главная страница ----------------------
@app.route('/')
def index():
    # Принудительно создаём CSRF-токен
    return send_from_directory('static', 'index.html')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000, debug=False, allow_unsafe_werkzeug=True)