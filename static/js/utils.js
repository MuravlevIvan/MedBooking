// ===================== Утилиты приложения =====================

function cssEscape(str) {
  return str.replace(/\|/g, '\\|');
}

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

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  }[m]));
}

function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeDate(date) {
  let d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getDisplayName(login) {
  if (login === 'admin') return 'Администратор';
  const p = userProfiles[login];
  if (p) {
    const parts = [p.lastName, p.firstName, p.middleName].filter(Boolean);
    return parts.length ? parts.join(' ') : (p.firstName || login);
  }
  return login;
}