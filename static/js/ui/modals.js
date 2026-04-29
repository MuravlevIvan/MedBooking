// ===================== Модальные окна =====================

// ---------- Авторизация ----------
function showAuthModal() {
  const html = `
    <div class="modal-overlay" id="authModal">
      <div class="auth-modal">
        <div class="auth-modal-header">
          <h2>🔐 Авторизация</h2>
          <button class="auth-modal-close" id="closeAuthModal">✕</button>
        </div>
        <div class="auth-modal-body">
          <div class="subtitle">Войдите в систему для бронирования</div>
          <div class="auth-field"><label>👤 Логин</label><input type="text" id="authLogin" placeholder="Введите логин" autocomplete="off"></div>
          <div class="auth-field"><label>🔑 Пароль</label><input type="password" id="authPassword" placeholder="Введите пароль"></div>
          <div id="authError" class="auth-error"></div>
          <button class="auth-login-btn" id="authLoginBtn">Войти</button>
          <div class="auth-link"><button id="showRegisterBtn">📝 Нет аккаунта? Зарегистрироваться</button></div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const overlay = document.getElementById('authModal');
  const loginInput = document.getElementById('authLogin'), passInput = document.getElementById('authPassword'), errorDiv = document.getElementById('authError');
  const doLogin = async () => { errorDiv.textContent = ''; const res = await loginUser(loginInput.value.trim().toLowerCase(), passInput.value); if (!res.success) errorDiv.textContent = res.error || 'Неверный логин или пароль'; };
  document.getElementById('authLoginBtn').addEventListener('click', doLogin);
  document.getElementById('showRegisterBtn').addEventListener('click', () => { overlay.remove(); showRegisterModal(); });
  document.getElementById('closeAuthModal').addEventListener('click', () => overlay.remove());
  loginInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
  passInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') doLogin(); });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ---------- Регистрация ----------
function showRegisterModal() {
  const html = `
    <div class="modal-overlay" id="registerModal">
      <div class="auth-modal">
        <div class="auth-modal-header">
          <h2>📝 Регистрация</h2>
          <button class="auth-modal-close" id="closeRegisterModal">✕</button>
        </div>
        <div class="auth-modal-body">
          <div class="auth-field"><label>Логин *</label><input type="text" id="regLogin" placeholder="Латинские буквы, цифры, _"></div>
          <div class="auth-field"><label>Пароль *</label><input type="password" id="regPassword" placeholder="Минимум 8 символов"></div>
          <div class="auth-field"><label>Фамилия</label><input type="text" id="regLastName"></div>
          <div class="auth-field"><label>Имя</label><input type="text" id="regFirstName"></div>
          <div class="auth-field"><label>Отчество</label><input type="text" id="regMiddleName"></div>
          <div class="auth-field"><label>Телефон</label><input type="tel" id="regPhone"></div>
          <div class="auth-field"><label>Email</label><input type="email" id="regEmail" placeholder="example@mail.ru"></div>
          <div id="regError" class="auth-error"></div>
          <div class="modal-buttons">
            <button id="registerSubmitBtn" class="auth-login-btn">Отправить заявку</button>
            <button id="closeRegisterBtn" class="auth-login-btn" style="background:#e2e8f0;color:#334155;">Отмена</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const overlay = document.getElementById('registerModal');
  document.getElementById('registerSubmitBtn').addEventListener('click', registerUser);
  document.getElementById('closeRegisterBtn').addEventListener('click', () => overlay.remove());
  document.getElementById('closeRegisterModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// ---------- Выбор пользователя (админ) ----------
function showUserSelectModal() {
  const html = `
    <div class="modal-overlay" id="userSelectModal">
      <div class="user-select-container">
        <div class="user-select-header">
          <button class="close-select-icon" id="closeSelectIcon">✕</button>
          <h2>👤 Выбор пользователя</h2>
          <p>Выберите пользователя</p>
        </div>
                <div class="user-select-body">
          <div class="user-select-search"><input type="text" id="userSelectSearchInput" class="user-select-search-input" placeholder="🔍 Поиск по логину или фамилии..."><button id="userSelectSearchBtn" class="user-select-search-btn">Найти</button></div>
          <div class="user-select-list" id="userSelectList"></div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  function renderList() {
    const input = document.getElementById('userSelectSearchInput')?.value.trim().toLowerCase() || '';
    let filtered = allUsers.filter(u => u !== 'admin');
    if (input) filtered = filtered.filter(u => { const full = getDisplayName(u).toLowerCase(); return u.includes(input) || full.includes(input); });
    const list = document.getElementById('userSelectList'); if (!list) return;
    if (filtered.length === 0) { list.innerHTML = '<div style="text-align:center;padding:1rem;color:#64748b;">Пользователи не найдены</div>'; return; }
    list.innerHTML = filtered.map(u => `<div class="user-select-card" data-login="${u}"><div class="user-select-info"><div class="user-select-name">${escapeHtml(getDisplayName(u))}</div><div class="user-select-login">@${escapeHtml(u)}</div></div><span>➡️</span></div>`).join('');
    list.querySelectorAll('.user-select-card').forEach(card => card.addEventListener('click', () => {
      adminBookingTarget = card.dataset.login;
      showToast(`Выбран: ${getDisplayName(adminBookingTarget)}`);
      document.getElementById('userSelectModal')?.remove();
      const badge = document.getElementById('selectedUserBadge'); if (badge) badge.textContent = getDisplayName(adminBookingTarget);
      updateInfoPanel(); selectedSlots.clear(); highlightedBookingKey = null; updateHighlightedBooking(); renderMainContent();
    }));
  }
  document.getElementById('closeSelectIcon')?.addEventListener('click', () => document.getElementById('userSelectModal')?.remove());
  document.getElementById('userSelectSearchBtn')?.addEventListener('click', renderList);
  document.getElementById('userSelectSearchInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') renderList(); });
  renderList();
}

// ---------- Управление пользователями ----------
function showUsersManagementModal() {
  const html = `
    <div class="modal-overlay" id="usersModal">
      <div class="users-container">
        <div class="users-header"><button class="close-modal-icon" id="closeUsersModalIcon">✕</button><h2>👥 Управление пользователями</h2><p>Создание, редактирование и подтверждение учётных записей</p></div>
        <div class="users-body" id="usersModalBody"></div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('closeUsersModalIcon')?.addEventListener('click', () => document.getElementById('usersModal')?.remove());
  renderUsersManagementContent();
}

async function renderUsersManagementContent() {
  const body = document.getElementById('usersModalBody'); if (!body) return;
  try {
    const usersData = await apiFetch('/api/users', { method: 'GET' });
    const pendingData = await apiFetch('/api/pending', { method: 'GET' });
    allUsers = usersData.map(u => u.login); userProfiles = {}; userBookingCounts = {};
    usersData.forEach(u => {
      userProfiles[u.login] = { login: u.login, firstName: u.firstName, lastName: u.lastName, middleName: u.middleName, phone: u.phone, email: u.email };
      userBookingCounts[u.login] = u.bookingCount;
    });
    pendingUsers = pendingData;
    const avatarColors = ['#3b82f6', '#8b5cf6', '#ec4898', '#f59e0b', '#10b981', '#ef4444'];
    const getAvatarColor = (str) => avatarColors[(str.charCodeAt(0)||0) % avatarColors.length];
    let filteredUsers = allUsers.filter(u => u !== 'admin');
    const searchInput = document.getElementById('userSearchInput')?.value.trim().toLowerCase() || '';
    if (searchInput) filteredUsers = filteredUsers.filter(u => { const full = getDisplayName(u).toLowerCase(); return u.includes(searchInput) || full.includes(searchInput); });
    const hasPending = pendingUsers.length > 0;
    const scrollableClass = hasPending ? 'with-pending' : 'without-pending';
    const approvedHtml = filteredUsers.map(u => {
      const profile = userProfiles[u] || {}, count = userBookingCounts[u] || 0, fullName = getDisplayName(u), initial = (profile.firstName?.[0] || u[0]).toUpperCase();
      return `<div class="user-card-compact"><div class="user-avatar-small" style="background:${getAvatarColor(u)};">${escapeHtml(initial)}</div><div class="user-details-compact"><div class="user-name-compact">${escapeHtml(fullName)}</div><div class="user-login-compact">@${escapeHtml(u)}</div>${profile.email?`<div class="user-email-compact">📧 ${escapeHtml(profile.email)}</div>`:''}</div><div class="user-stats-compact">📊 ${count}</div><div class="user-actions-compact"><button class="action-icon-small edit" data-login="${u}" title="Редактировать">✏️</button><button class="action-icon-small delete" data-login="${u}" title="Удалить">🗑️</button></div></div>`;
    }).join('');
    const pendingHtml = pendingUsers.map(u => {
      const fullName = [u.lastName, u.firstName, u.middleName].filter(Boolean).join(' ') || u.firstName || u.login, initial = (u.firstName?.[0] || u.login[0]).toUpperCase();
      return `<div class="pending-card"><div class="pending-avatar">${escapeHtml(initial)}</div><div class="pending-details"><div class="pending-name" title="${escapeHtml(fullName)}">${escapeHtml(fullName.length>20?fullName.substring(0,18)+'…':fullName)}</div><div class="pending-login">@${escapeHtml(u.login)}</div></div><div class="pending-actions"><button class="action-icon-pending approve" data-login="${u.login}" title="Подтвердить">✅</button><button class="action-icon-pending reject" data-login="${u.login}" title="Отклонить">❌</button></div></div>`;
    }).join('');
    body.innerHTML = `
      <div class="users-body">
        <div class="search-section"><input type="text" id="userSearchInput" class="search-input" placeholder="🔍 Поиск по логину или фамилии..." value="${escapeHtml(searchInput)}"><button id="searchUsersBtn" class="search-btn">Найти</button></div>
        <div class="users-content">
          <div class="section-title">✅ Активные пользователи (${filteredUsers.length})</div>
          <div class="users-scrollable ${scrollableClass}"><div class="users-grid">${approvedHtml || '<div style="color:#64748b;text-align:center;padding:0.5rem;">Нет активных пользователей</div>'}</div></div>
          ${hasPending ? `<div class="pending-section"><div class="section-title" style="margin-bottom:0.3rem;">⏳ Ожидают подтверждения (${pendingUsers.length})</div><div class="pending-scrollable"><div class="pending-grid">${pendingHtml}</div></div></div>` : ''}
        </div>
        <div class="add-user-fixed">
          <div class="add-user-title">➕ Создать нового пользователя</div>
          <div class="add-user-fields"><input type="text" id="newUserLogin" placeholder="Логин"><input type="password" id="newUserPassword" placeholder="Пароль"><input type="text" id="newUserFirstName" placeholder="Имя"><input type="text" id="newUserLastName" placeholder="Фамилия"><input type="email" id="newUserEmail" placeholder="Email"></div>
          <button id="createUserBtn" class="create-user-btn">➕ Создать пользователя</button>
        </div>
      </div>`;
    // обработчики
    document.getElementById('searchUsersBtn')?.addEventListener('click', renderUsersManagementContent);
    document.getElementById('userSearchInput')?.addEventListener('keypress', e => { if (e.key === 'Enter') renderUsersManagementContent(); });
    document.querySelectorAll('.action-icon-small.edit').forEach(btn => btn.addEventListener('click', () => showEditUserModal(btn.dataset.login)));
    document.querySelectorAll('.action-icon-small.delete').forEach(btn => btn.addEventListener('click', async () => {
      if (confirm(`Удалить пользователя "${btn.dataset.login}"?`)) try { await apiFetch(`/api/users/delete/${btn.dataset.login}`, { method: 'DELETE' }); showToast('Пользователь удалён'); renderUsersManagementContent(); } catch(e) {}
    }));
    document.querySelectorAll('.action-icon-pending.approve').forEach(btn => btn.addEventListener('click', async () => { try { await apiFetch(`/api/users/approve/${btn.dataset.login}`, { method: 'POST' }); showToast('Подтверждён'); renderUsersManagementContent(); loadInitialData(); } catch(e) {} }));
    document.querySelectorAll('.action-icon-pending.reject').forEach(btn => btn.addEventListener('click', async () => { if (confirm(`Отклонить заявку "${btn.dataset.login}"?`)) try { await apiFetch(`/api/users/reject/${btn.dataset.login}`, { method: 'POST' }); showToast('Отклонена'); renderUsersManagementContent(); } catch(e) {} }));
    document.getElementById('createUserBtn')?.addEventListener('click', async () => {
      const login = document.getElementById('newUserLogin')?.value.trim().toLowerCase(), password = document.getElementById('newUserPassword')?.value, firstName = document.getElementById('newUserFirstName')?.value.trim(), lastName = document.getElementById('newUserLastName')?.value.trim(), email = document.getElementById('newUserEmail')?.value.trim();
      if (!login || !password || password.length < 3) { showToast('Введите логин и пароль (мин 3 символа)'); return; }
      try { await apiFetch('/api/users/create', { method: 'POST', body: JSON.stringify({ login, password, firstName, lastName, middleName: '', phone: '', email }) }); showToast(`Пользователь "${login}" создан`); renderUsersManagementContent(); loadInitialData(); } catch(e) {}
    });
  } catch(e) { body.innerHTML = '<div class="users-body"><p style="color:red;">Ошибка загрузки данных</p></div>'; }
}

// ---------- Редактирование профиля пользователя ----------
function showEditUserModal(login) {
  const profile = userProfiles[login] || {};
  const html = `
    <div class="modal-overlay" id="editUserModal">
      <div class="edit-user-container">
        <div class="edit-user-header"><button class="edit-close-icon" id="closeEditIcon">✕</button><h3>✏️ Редактирование: ${escapeHtml(login)}</h3></div>
        <div class="edit-user-body">
          <div class="edit-field"><label>📛 Фамилия</label><input type="text" id="editLastName" value="${escapeHtml(profile.lastName||'')}"></div>
          <div class="edit-field"><label>👤 Имя</label><input type="text" id="editFirstName" value="${escapeHtml(profile.firstName||'')}"></div>
          <div class="edit-field"><label>👨‍👩‍👧 Отчество</label><input type="text" id="editMiddleName" value="${escapeHtml(profile.middleName||'')}"></div>
          <div class="edit-field"><label>📞 Телефон</label><input type="tel" id="editPhone" value="${escapeHtml(profile.phone||'')}"></div>
          <div class="edit-field"><label>📧 Email</label><input type="email" id="editEmail" value="${escapeHtml(profile.email||'')}"></div>
          <div class="edit-field"><label>🔑 Новый пароль</label><input type="password" id="editPassword" placeholder="Оставьте пустым, чтобы не менять"><div class="password-hint">Минимум 3 символа</div></div>
          <div class="edit-actions"><button id="saveEditBtn" class="save-edit-btn">💾 Сохранить</button><button id="cancelEditBtn" class="cancel-edit-btn">Отмена</button></div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('closeEditIcon')?.addEventListener('click', () => document.getElementById('editUserModal')?.remove());
  document.getElementById('cancelEditBtn')?.addEventListener('click', () => document.getElementById('editUserModal')?.remove());
  document.getElementById('saveEditBtn')?.addEventListener('click', async () => {
    const password = document.getElementById('editPassword').value;
    const body = {
      firstName: document.getElementById('editFirstName').value.trim(), lastName: document.getElementById('editLastName').value.trim(),
      middleName: document.getElementById('editMiddleName').value.trim(), phone: document.getElementById('editPhone').value.trim(),
      email: document.getElementById('editEmail').value.trim()
    };
    if (password && password.length >= 3) body.password = password;
    try {
      const data = await apiFetch(`/api/users/update/${login}`, { method: 'POST', body: JSON.stringify(body) });
      showToast(data.message || 'Профиль обновлён');
      if (data.profile) userProfiles[login] = data.profile;
      if (login === currentUser) { const pb = document.getElementById('profileBtn'); if (pb) pb.innerHTML = `👤 ${escapeHtml(getDisplayName(login))} ${isAdminUser ? ' 👑' : ''}`; }
      document.getElementById('editUserModal')?.remove();
      if (document.getElementById('usersModal')) await renderUsersManagementContent();
    } catch(e) {}
  });
}