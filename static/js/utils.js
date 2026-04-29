// ===================== Утилиты приложения =====================

/**
 * Экранирует символ '|' в строке, чтобы его можно было безопасно использовать
 * в CSS-селекторах (например, для data-key="2025-01-01|10").
 * @param {string} str – исходный ключ слота
 * @returns {string} экранированная строка для querySelector
 */
function cssEscape(str) {
  return str.replace(/\|/g, '\\|');
}

/**
 * Выводит всплывающее уведомление (toast).
 * @param {string} msg – текст сообщения
 * @param {number} [dur=2000] – время отображения в миллисекундах (0 – не исчезает)
 */
function showToast(msg, dur = 2000) {
  let old = document.querySelector('.toast-msg');
  if (old) old.remove();

  let toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerText = msg;
  toast.addEventListener('click', () => toast.remove());
  document.body.appendChild(toast);

  if (dur > 0) {
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, dur);
  }
}

/**
 * Экранирует HTML-символы, предотвращая XSS при вставке данных пользователя.
 * @param {string} str – небезопасная строка
 * @returns {string} безопасная строка
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  }[m]));
}

/**
 * Преобразует объект Date в строку "YYYY-MM-DD".
 * @param {Date} date
 * @returns {string}
 */
function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Обнуляет время (часы, минуты, секунды) у даты, оставляя только год, месяц, день.
 * @param {Date} date
 * @returns {Date}
 */
function normalizeDate(date) {
  let d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Возвращает отображаемое имя пользователя (ФИО или логин).
 * @param {string} login – логин пользователя
 * @returns {string} имя для показа в интерфейсе
 */
function getDisplayName(login) {
  if (login === 'admin') return 'Администратор';
  const p = userProfiles[login];
  if (p) {
    const parts = [p.lastName, p.firstName, p.middleName].filter(Boolean);
    return parts.length ? parts.join(' ') : (p.firstName || login);
  }
  return login;
}