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
          <div class="subtitle">Войдите в систему для бронирования</div>
          <div class="auth-field"><label>👤 Логин</label><input type="text" id="regLogin" placeholder="Латинские буквы, цифры, _"></div>
          <div class="auth-field"><label>🔑 Пароль</label><input type="password" id="regPassword" placeholder="Минимум 8 символов"></div>
          <div class="auth-field"><label>📛 Фамилия</label><input type="text" id="regLastName"></div>
          <div class="auth-field"><label>👤 Имя</label><input type="text" id="regFirstName"></div>
          <div class="auth-field"><label>👨‍👩‍👧 Отчество</label><input type="text" id="regMiddleName"></div>
          <div class="auth-field"><label>📞 Телефон</label><input type="tel" id="regPhone"></div>
          <div class="auth-field"><label>📧 Email</label><input type="email" id="regEmail" placeholder="example@mail.ru"></div>
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

// ---------- Редактирование врача (админ) ----------
function showEditDoctorModal(doctorId) {
  const doctor = doctorsList.find(d => d.id === doctorId);
  if (!doctor) return;
  
  const breakStart = doctor.breakStart || '';
  const breakEnd = doctor.breakEnd || '';
  
  const html = `
    <div class="modal-overlay" id="editDoctorModal">
      <div class="edit-user-container" style="max-width: 500px;">
        <div class="edit-user-header"><button class="edit-close-icon" id="closeDoctorModalIcon">✕</button><h3>✏️ Редактирование врача</h3></div>
        <div class="edit-user-body">
          <div class="edit-field"><label>🏥 Имя врача</label><input type="text" id="doctorName" value="${escapeHtml(doctor.name)}"></div>
          <div class="edit-field"><label>⏱ Интервал слотов (мин)</label>
            <select id="doctorSlotInterval">
              <option value="10" ${doctor.slotInterval === 10 ? 'selected' : ''}>10 минут</option>
              <option value="15" ${doctor.slotInterval === 15 ? 'selected' : ''}>15 минут</option>
              <option value="30" ${doctor.slotInterval === 30 ? 'selected' : ''}>30 минут</option>
              <option value="60" ${doctor.slotInterval === 60 ? 'selected' : ''}>60 минут</option>
            </select>
          </div>
          <div class="edit-field"><label>🕘 Начало рабочего дня (час)</label>
            <select id="doctorStartHour">
              ${[...Array(24).keys()].map(h => `<option value="${h}" ${doctor.startHour === h ? 'selected' : ''}>${h}:00</option>`).join('')}
            </select>
          </div>
          <div class="edit-field"><label>🕔 Конец рабочего дня (час)</label>
            <select id="doctorEndHour">
              ${[...Array(25).keys()].slice(1).map(h => `<option value="${h}" ${doctor.endHour === h ? 'selected' : ''}>${h}:00</option>`).join('')}
            </select>
          </div>
          <div class="edit-field"><label>🚫 Технический перерыв (начало)</label>
            <input type="time" id="doctorBreakStart" value="${escapeHtml(breakStart)}" step="60" placeholder="например 13:00">
          </div>
          <div class="edit-field"><label>🚫 Технический перерыв (конец)</label>
            <input type="time" id="doctorBreakEnd" value="${escapeHtml(breakEnd)}" step="60" placeholder="например 14:00">
          </div>
          <div class="edit-actions">
            <button id="saveDoctorBtn" class="save-edit-btn">💾 Сохранить</button>
            <button id="cancelDoctorBtn" class="cancel-edit-btn">Отмена</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  const modal = document.getElementById('editDoctorModal');
  document.getElementById('closeDoctorModalIcon')?.addEventListener('click', () => modal.remove());
  document.getElementById('cancelDoctorBtn')?.addEventListener('click', () => modal.remove());
  document.getElementById('saveDoctorBtn')?.addEventListener('click', async () => {
    const newName = document.getElementById('doctorName').value.trim();
    const newInterval = parseInt(document.getElementById('doctorSlotInterval').value);
    const newStart = parseInt(document.getElementById('doctorStartHour').value);
    const newEnd = parseInt(document.getElementById('doctorEndHour').value);
    const breakStart = document.getElementById('doctorBreakStart').value;
    const breakEnd = document.getElementById('doctorBreakEnd').value;
    
    if (!newName) { showToast('Имя врача не может быть пустым'); return; }
    if (newEnd <= newStart) { showToast('Конец рабочего дня должен быть больше начала'); return; }
    if (breakStart && breakEnd && breakStart >= breakEnd) {
      showToast('Время начала технического перерыва должно быть меньше времени окончания');
      return;
    }
    try {
      await updateDoctorFull(doctorId, {
        name: newName,
        slotInterval: newInterval,
        startHour: newStart,
        endHour: newEnd,
        breakStart: breakStart,
        breakEnd: breakEnd
      });
      await loadDoctors();
      if (currentDoctor === doctorId) {
        currentDoctor = doctorId;
        await loadBookingsForDoctor(currentDoctor);
      }
      renderFullApp();
      modal.remove();
      showToast('Настройки врача сохранены');
    } catch(err) {
      showToast(err.message);
    }
  });
}

// ========== ИСТОРИЯ БРОНИРОВАНИЙ ==========

let _currentEditingData = null;
let _currentAdminEditingData = null;
let _historyOutsideHandler = null;

async function fetchAdminMeetingData(date, time) {
    if (!isAdminUser) return null;
    try {
        return await apiFetch(`/api/admin/meeting/${date}/${time}?doctor=${currentDoctor}`);
    } catch(e) {
        console.warn(e);
        return { adminComment: '', successMeeting: false };
    }
}

async function updateAdminMeetingData(date, time, adminComment, successMeeting) {
    if (!isAdminUser) return;
    const body = {};
    if (adminComment !== null) body.adminComment = adminComment;
    if (successMeeting !== null) body.successMeeting = successMeeting;
    try {
        await apiFetch(`/api/admin/meeting/${date}/${time}?doctor=${currentDoctor}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        showToast('Данные встречи сохранены');
    } catch(e) {
        showToast('Ошибка сохранения: ' + e.message);
        throw e;
    }
}

async function showHistoryModal(initialSearch = '', initialDoctor = '') {
  if (!currentUser) {
    showToast('Авторизуйтесь для просмотра истории');
    showAuthModal();
    return;
  }
  currentHistoryPage = 1;
  currentHistorySearch = initialSearch;
  currentHistoryDoctor = initialDoctor;

  const html = `
    <div class="modal-overlay" id="historyModal">
      <div class="history-modal">
        <div class="history-header">
          <h2>📜 История бронирований</h2>
          <button class="history-close" id="historyCloseBtn">✕</button>
        </div>
        <div class="history-body" id="historyBody">
          <div style="text-align:center;">Загрузка...</div>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  
  document.getElementById('historyCloseBtn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    let unsavedUser = false;
    let unsavedAdmin = false;
    if (_currentEditingData) {
      const { textarea, currentText } = _currentEditingData;
      if (textarea.value.trim() !== currentText.trim()) unsavedUser = true;
    }
    if (_currentAdminEditingData) {
      const { textarea, currentText } = _currentAdminEditingData;
      if (textarea.value.trim() !== currentText.trim()) unsavedAdmin = true;
    }
    
    if (unsavedUser || unsavedAdmin) {
      const answer = confirm('Есть несохранённые изменения. Сохранить перед закрытием?');
      if (answer) {
        if (_currentEditingData) await closeCurrentEditing(true);
        if (_currentAdminEditingData) await closeCurrentAdminEditing(true);
        document.getElementById('historyModal')?.remove();
      } else {
        if (_currentEditingData) await closeCurrentEditing(false);
        if (_currentAdminEditingData) await closeCurrentAdminEditing(false);
        document.getElementById('historyModal')?.remove();
      }
    } else {
      document.getElementById('historyModal')?.remove();
    }
  });
  
  await loadAndRenderHistory();
}

async function loadAndRenderHistory() {
  const body = document.getElementById('historyBody');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;">Загрузка...</div>';
  try {
    const data = await fetchBookingHistory(currentHistoryPage, currentHistorySearch, currentHistoryDoctor);
    renderHistoryContent(data);
  } catch (err) {
    body.innerHTML = `<div style="color:red;text-align:center;">Ошибка загрузки: ${err.message}</div>`;
  }
}

function renderHistoryContent(data) {
  const body = document.getElementById('historyBody');
  if (!body) return;
  const { bookings, page, pages } = data;
  const doctor = doctorsList.find(d => d.id === currentDoctor);
  const slotInterval = doctor?.slotInterval || 60;

  let doctorOptions = '<option value="">📋 Все дорожки</option>';
  if (isAdminUser) {
    doctorsList.forEach(doc => {
      doctorOptions += `<option value="${doc.id}" ${currentHistoryDoctor === doc.id ? 'selected' : ''}>${escapeHtml(doc.name)}</option>`;
    });
  } else {
    const userDoctors = new Set();
    bookings.forEach(b => { if (b.login === currentUser) userDoctors.add(b.doctor); });
    doctorsList.forEach(doc => {
      if (userDoctors.has(doc.id)) {
        doctorOptions += `<option value="${doc.id}" ${currentHistoryDoctor === doc.id ? 'selected' : ''}>${escapeHtml(doc.name)}</option>`;
      }
    });
    if (doctorOptions === '<option value="">📋 Все дорожки</option>') {
      doctorsList.forEach(doc => {
        doctorOptions += `<option value="${doc.id}" ${currentHistoryDoctor === doc.id ? 'selected' : ''}>${escapeHtml(doc.name)}</option>`;
      });
    }
  }

  const searchHtml = `
    <div class="history-search">
      <div class="history-filters" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem;">
        <select id="historyDoctorSelect" class="history-doctor-select" style="padding: 0.4rem; border-radius: 2rem; border: 2px solid #e2e8f0;">
          ${doctorOptions}
        </select>
        <input type="text" id="historySearchInput" placeholder="Поиск по логину или ФИО..." value="${escapeHtml(currentHistorySearch)}">
        <button id="historySearchBtn">🔍 Найти</button>
        <button id="historyResetBtn">✖️ Сброс</button>
      </div>
    </div>
  `;

  const tableHeader = `
    <table class="history-table">
      <thead>
        <tr><th>Дата и время</th>${isAdminUser ? '<th>Пользователь</th>' : ''}
          <th>Врач</th>
          ${isAdminUser ? '<th>Успешно</th>' : ''}
          <th>Комментарий пользователя</th>${isAdminUser ? '<th>Комментарий администратора</th>' : ''}
        </tr>
      </thead>
      <tbody id="historyTableBody"></tbody>
    </table>
  `;

  body.innerHTML = `
    ${searchHtml}
    ${tableHeader}
    <div class="history-pagination" id="historyPagination"></div>
  `;

  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  for (const booking of bookings) {
    const dateObj = new Date(booking.date);
    const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const [hour, minute] = booking.time.split(':').map(Number);
    const endTime = new Date(dateObj);
    endTime.setHours(hour, minute, 0, 0);
    endTime.setMinutes(endTime.getMinutes() + slotInterval);
    const timeEndStr = `${String(endTime.getHours()).padStart(2,'0')}:${String(endTime.getMinutes()).padStart(2,'0')}`;
    const timeStr = `${booking.time} – ${timeEndStr}`;
    const commentText = booking.comment || '';
    const canEditComment = isAdminUser || (!booking.isPast && booking.login === currentUser);
    const editInfo = booking.lastEditedBy ? `✏️ ${escapeHtml(booking.lastEditedBy)}, ${escapeHtml(booking.lastEditedAt)}` : '';
    const doctorName = doctorsList.find(d => d.id === booking.doctor)?.name || booking.doctor;

    const row = tbody.insertRow();
    let cell = row.insertCell(); cell.setAttribute('data-label', 'Дата'); cell.textContent = `${dateStr}, ${timeStr}`;
    if (isAdminUser) { cell = row.insertCell(); cell.setAttribute('data-label', 'Пользователь'); cell.textContent = booking.displayName || booking.login; }
    cell = row.insertCell(); cell.setAttribute('data-label', 'Врач'); cell.textContent = doctorName;
    if (isAdminUser) {
      cell = row.insertCell(); cell.setAttribute('data-label', 'Успешно'); cell.style.textAlign = 'center';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'success-checkbox'; cb.dataset.key = booking.key; cb.checked = !!booking.successMeeting;
      cell.appendChild(cb);
    }
    cell = row.insertCell(); cell.setAttribute('data-label', 'Комментарий пользователя'); cell.className = 'user-comment-cell'; cell.dataset.key = booking.key;
    const commentDiv = document.createElement('div'); commentDiv.className = `history-comment ${canEditComment ? 'editable' : 'disabled'}`;
    commentDiv.dataset.key = booking.key; commentDiv.dataset.canEdit = canEditComment; commentDiv.dataset.login = booking.login; commentDiv.dataset.isPast = booking.isPast;
    commentDiv.innerHTML = commentText ? escapeHtml(commentText) : '<em>Нет комментария</em>';
    cell.appendChild(commentDiv);
    const editInfoSpan = document.createElement('div'); editInfoSpan.className = 'edit-info-history'; editInfoSpan.textContent = editInfo;
    cell.appendChild(editInfoSpan);
    if (isAdminUser) {
      cell = row.insertCell(); cell.setAttribute('data-label', 'Комментарий администратора');
      const adminDiv = document.createElement('div'); adminDiv.className = 'history-comment admin-comment editable'; adminDiv.dataset.key = booking.key; adminDiv.dataset.type = 'admin';
      adminDiv.innerHTML = booking.adminComment ? escapeHtml(booking.adminComment) : '<em>Нет комментария</em>';
      cell.appendChild(adminDiv);
    }
  }

  const doctorSelect = document.getElementById('historyDoctorSelect');
  const searchInput = document.getElementById('historySearchInput');
  const searchBtn = document.getElementById('historySearchBtn');
  const resetBtn = document.getElementById('historyResetBtn');

  const applyFilters = () => {
    currentHistoryDoctor = doctorSelect?.value || '';
    currentHistorySearch = searchInput?.value.trim() || '';
    currentHistoryPage = 1;
    loadAndRenderHistory();
  };

  if (doctorSelect) doctorSelect.addEventListener('change', applyFilters);
  if (searchBtn) searchBtn.addEventListener('click', applyFilters);
  if (resetBtn) resetBtn.addEventListener('click', () => { if (doctorSelect) doctorSelect.value = ''; if (searchInput) searchInput.value = ''; currentHistoryDoctor = ''; currentHistorySearch = ''; currentHistoryPage = 1; loadAndRenderHistory(); });
  if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') applyFilters(); });

  const paginationDiv = document.getElementById('historyPagination');
  if (paginationDiv) {
    if (pages > 1) {
      let paginationHtml = '';
      paginationHtml += `<button ${page === 1 ? 'disabled' : ''} data-page="${page-1}">← Назад</button>`;
      for (let i = 1; i <= pages; i++) {
        if (i === 1 || i === pages || (i >= page-2 && i <= page+2)) paginationHtml += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        else if (i === page-3 || i === page+3) paginationHtml += `<span>...</span>`;
      }
      paginationHtml += `<button ${page === pages ? 'disabled' : ''} data-page="${page+1}">Вперёд →</button>`;
      paginationDiv.innerHTML = paginationHtml;
      paginationDiv.querySelectorAll('button[data-page]').forEach(btn => btn.addEventListener('click', async e => { const np = parseInt(e.currentTarget.dataset.page); if (!isNaN(np) && np !== page) { currentHistoryPage = np; await loadAndRenderHistory(); } }));
    } else paginationDiv.innerHTML = '';
  }

  attachHistoryCommentHandlers();
  if (isAdminUser) {
    document.querySelectorAll('#historyTableBody .admin-comment').forEach(div => { div.removeEventListener('click', adminCommentClickHandler); div.addEventListener('click', adminCommentClickHandler); });
    document.querySelectorAll('#historyTableBody .success-checkbox').forEach(cb => { cb.removeEventListener('change', successCheckboxChangeHandler); cb.addEventListener('change', successCheckboxChangeHandler); });
  }
}

function attachHistoryCommentHandlers() {
  const commentDivs = document.querySelectorAll('#historyTableBody .history-comment.editable:not(.admin-comment)');
  commentDivs.forEach(div => { div.removeEventListener('click', historyCommentClickHandler); div.addEventListener('click', historyCommentClickHandler); });
}

async function closeCurrentEditing(saveChanges) {
  if (!_currentEditingData) return;
  const { cancelEdit, saveAndClose, textarea, currentText } = _currentEditingData;
  const newText = textarea.value;
  if (saveChanges) { if (newText.trim() !== currentText.trim()) await saveAndClose(); else cancelEdit(); }
  else cancelEdit();
  _currentEditingData = null;
  if (_historyOutsideHandler) { document.removeEventListener('click', _historyOutsideHandler); _historyOutsideHandler = null; }
}

async function closeCurrentAdminEditing(saveChanges) {
  if (!_currentAdminEditingData) return;
  const { cancelEdit, saveAndClose, textarea, currentText } = _currentAdminEditingData;
  const newText = textarea.value;
  if (saveChanges) { if (newText.trim() !== currentText.trim()) await saveAndClose(); else cancelEdit(); }
  else cancelEdit();
  _currentAdminEditingData = null;
  if (_historyOutsideHandler) { document.removeEventListener('click', _historyOutsideHandler); _historyOutsideHandler = null; }
}

async function historyCommentClickHandler(e) {
  e.stopPropagation();
  const div = e.currentTarget;
  if (div.querySelector('.comment-edit-area-history')) return;

  if (_currentAdminEditingData) {
    const { textarea, currentText } = _currentAdminEditingData;
    const newText = textarea.value;
    if (newText.trim() !== currentText.trim()) await (confirm('Сохранить изменения в комментарии администратора?') ? closeCurrentAdminEditing(true) : closeCurrentAdminEditing(false));
    else await closeCurrentAdminEditing(false);
  }
  if (_currentEditingData && _currentEditingData.div !== div) {
    const { textarea, currentText } = _currentEditingData;
    const newText = textarea.value;
    if (newText.trim() !== currentText.trim()) await (confirm('Сохранить изменения в другом комментарии?') ? closeCurrentEditing(true) : closeCurrentEditing(false));
    else await closeCurrentEditing(false);
  }

  const key = div.getAttribute('data-key');
  if (!key) { showToast('Ошибка: ключ комментария не найден'); return; }
  const canEdit = div.getAttribute('data-can-edit') === 'true';
  if (!canEdit) { showToast('Вы не можете редактировать этот комментарий'); return; }

  let currentText = div.innerText.trim();
  if (currentText === 'Нет комментария') currentText = '';
  const originalHtml = div.innerHTML;
  const ownerLogin = div.getAttribute('data-login');
  const isPast = div.getAttribute('data-is-past') === 'true';

  const editArea = document.createElement('div'); editArea.className = 'comment-edit-area-history';
  editArea.innerHTML = `<textarea class="comment-textarea-history">${escapeHtml(currentText)}</textarea><div class="comment-buttons-history"><button class="comment-save-btn-history">💾 Сохранить</button><button class="comment-cancel-btn-history">❌ Отмена</button></div>`;
  div.innerHTML = ''; div.appendChild(editArea);
  const textarea = editArea.querySelector('textarea'); const saveBtn = editArea.querySelector('.comment-save-btn-history'); const cancelBtn = editArea.querySelector('.comment-cancel-btn-history');

  const cancelEdit = () => { div.innerHTML = originalHtml; div.classList.add('editable'); div.removeEventListener('click', historyCommentClickHandler); div.addEventListener('click', historyCommentClickHandler); _currentEditingData = null; if (_historyOutsideHandler) { document.removeEventListener('click', _historyOutsideHandler); _historyOutsideHandler = null; } };
  const saveCommentHandler = async () => {
    const newText = textarea.value;
    if (newText.trim() === currentText.trim()) { cancelEdit(); return; }
    const [date, time] = key.split('|');
    if (!date || !time) { showToast('Ошибка: некорректный ключ слота'); cancelEdit(); return; }
    try {
      const result = await updateComment(date, time, newText); showToast(result.message || 'Комментарий сохранён');
      const commentData = await loadComment(key);
      const displayText = commentData.text || '';
      const editInfoText = commentData.lastEditedBy ? `✏️ ${escapeHtml(commentData.lastEditedBy)}, ${escapeHtml(commentData.lastEditedAt)}` : '';
      const canEditAfter = isAdminUser || (!isPast && ownerLogin === currentUser);
      const commentCell = div.closest('.user-comment-cell');
      if (commentCell) {
        commentCell.innerHTML = `<div class="history-comment ${canEditAfter ? 'editable' : 'disabled'}" data-key="${key}" data-can-edit="${canEditAfter}" data-login="${ownerLogin}" data-is-past="${isPast}">${displayText ? escapeHtml(displayText) : '<em>Нет комментария</em>'}</div><div class="edit-info-history">${editInfoText}</div>`;
        const newCommentDiv = commentCell.querySelector('.history-comment');
        if (newCommentDiv && newCommentDiv.classList.contains('editable')) newCommentDiv.addEventListener('click', historyCommentClickHandler);
      } else { div.innerHTML = displayText ? escapeHtml(displayText) : '<em>Нет комментария</em>'; div.classList.add(canEditAfter ? 'editable' : 'disabled'); if (canEditAfter) div.addEventListener('click', historyCommentClickHandler); const editInfoSpan = div.parentElement?.querySelector('.edit-info-history'); if (editInfoSpan) editInfoSpan.textContent = editInfoText; }
    } catch (err) { showToast(err.message || 'Ошибка сохранения'); }
    cancelEdit();
  };
  const outsideClickHandler = (event) => {
    if (editArea && editArea.contains(event.target)) return;
    if (event.target.closest('.comment-save-btn-history') || event.target.closest('.comment-cancel-btn-history')) return;
    if (event.target.closest('.history-comment.editable')) return;
    const newText = textarea.value;
    if (newText.trim() !== currentText.trim()) { if (confirm('Сохранить изменения?')) saveCommentHandler(); else cancelEdit(); }
    else cancelEdit();
  };
  saveBtn.addEventListener('click', (e) => { e.stopPropagation(); saveCommentHandler(); });
  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); cancelEdit(); });
  if (_historyOutsideHandler) document.removeEventListener('click', _historyOutsideHandler);
  _historyOutsideHandler = outsideClickHandler;
  document.addEventListener('click', _historyOutsideHandler);
  _currentEditingData = { div, cancelEdit, saveAndClose: saveCommentHandler, textarea, currentText };
  textarea.focus();
}

async function adminCommentClickHandler(e) {
  e.stopPropagation();
  const div = e.currentTarget;
  if (div.querySelector('.comment-edit-area-history')) return;

  if (_currentEditingData) {
    const { textarea, currentText } = _currentEditingData;
    const newText = textarea.value;
    if (newText.trim() !== currentText.trim()) await (confirm('Сохранить изменения в комментарии пользователя?') ? closeCurrentEditing(true) : closeCurrentEditing(false));
    else await closeCurrentEditing(false);
  }
  if (_currentAdminEditingData && _currentAdminEditingData.div !== div) {
    const { textarea, currentText } = _currentAdminEditingData;
    const newText = textarea.value;
    if (newText.trim() !== currentText.trim()) await (confirm('Сохранить изменения в другом комментарии администратора?') ? closeCurrentAdminEditing(true) : closeCurrentAdminEditing(false));
    else await closeCurrentAdminEditing(false);
  }

  const key = div.getAttribute('data-key');
  if (!key) return;
  const [date, time] = key.split('|');
  let currentText = div.innerText.trim();
  if (currentText === 'Нет комментария') currentText = '';
  const originalHtml = div.innerHTML;

  const editArea = document.createElement('div'); editArea.className = 'comment-edit-area-history';
  editArea.innerHTML = `<textarea class="comment-textarea-history">${escapeHtml(currentText)}</textarea><div class="comment-buttons-history"><button class="comment-save-btn-history">💾 Сохранить</button><button class="comment-cancel-btn-history">❌ Отмена</button></div>`;
  div.innerHTML = ''; div.appendChild(editArea);
  const textarea = editArea.querySelector('textarea'); const saveBtn = editArea.querySelector('.comment-save-btn-history'); const cancelBtn = editArea.querySelector('.comment-cancel-btn-history');

  const closeEditMode = (restoreOriginal = true) => { if (restoreOriginal) div.innerHTML = originalHtml; div.classList.add('editable', 'admin-comment'); div.removeEventListener('click', adminCommentClickHandler); div.addEventListener('click', adminCommentClickHandler); _currentAdminEditingData = null; if (_historyOutsideHandler) { document.removeEventListener('click', _historyOutsideHandler); _historyOutsideHandler = null; } };
  const cancelEdit = () => closeEditMode(true);
  const saveHandler = async () => {
    const newText = textarea.value;
    if (newText.trim() === currentText.trim()) { cancelEdit(); return; }
    try {
      await updateAdminMeetingData(date, time, newText, null);
      div.innerHTML = newText ? escapeHtml(newText) : '<em>Нет комментария</em>';
      closeEditMode(false);
      showToast('Админ-комментарий сохранён');
    } catch(err) { showToast('Ошибка сохранения'); cancelEdit(); }
  };
  const outsideClickHandler = (event) => {
    if (editArea && editArea.contains(event.target)) return;
    if (event.target.closest('.comment-save-btn-history') || event.target.closest('.comment-cancel-btn-history')) return;
    if (event.target.closest('.history-comment.editable')) return;
    const newText = textarea.value;
    if (newText.trim() !== currentText.trim()) { if (confirm('Сохранить изменения?')) saveHandler(); else cancelEdit(); }
    else cancelEdit();
  };
  saveBtn.addEventListener('click', (e) => { e.stopPropagation(); saveHandler(); });
  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); cancelEdit(); });
  if (_historyOutsideHandler) document.removeEventListener('click', _historyOutsideHandler);
  _historyOutsideHandler = outsideClickHandler;
  document.addEventListener('click', _historyOutsideHandler);
  _currentAdminEditingData = { div, cancelEdit, saveAndClose: saveHandler, textarea, currentText };
  textarea.focus();
}

async function successCheckboxChangeHandler(e) {
  const cb = e.currentTarget;
  const key = cb.getAttribute('data-key');
  if (!key) return;
  const [date, time] = key.split('|');
  const successMeeting = cb.checked;
  try { await updateAdminMeetingData(date, time, null, successMeeting); } catch(err) { showToast('Ошибка обновления статуса'); cb.checked = !cb.checked; }
}

// Глобальная привязка функций, которые могут вызываться извне
window.showAuthModal = showAuthModal;
window.showHistoryModal = showHistoryModal;
window.showRegisterModal = showRegisterModal;
window.showEditUserModal = showEditUserModal;
window.showEditDoctorModal = showEditDoctorModal;
window.showUsersManagementModal = showUsersManagementModal;