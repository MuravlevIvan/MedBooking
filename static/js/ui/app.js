// ===================== Сборка интерфейса и глобальные обработчики =====================

function renderFullApp() {
  const appContainer = document.getElementById('appContainer');
  appContainer.innerHTML = `
    <div class="main-card">
      <div class="app-header">
        <div><h1>📅 Консультация нутрициолога</h1></div>
        <div style="display:flex; justify-content: center; gap:0.8rem; flex-wrap:wrap;">
          <div class="user-info ${!currentUser ? 'guest' : (isAdminUser ? 'admin' : (allUsers.includes(currentUser) ? '' : 'pending'))}" id="profileBtn">
            👤 ${currentUser ? escapeHtml(getDisplayName(currentUser)) : 'Гость'} ${isAdminUser ? ' 👑' : ''}
          </div>
          ${isAdminUser ? `<button class="admin-users-btn" id="usersManageBtn">👥 Управление пользователями</button>` : ''}
          ${currentUser ? `<button class="history-btn" id="historyBtn">📜 История</button>` : ''}
          ${currentUser ? `<button class="logout-btn" id="logoutBtn">🚪 Выйти</button>` : `<button class="auth-action-btn" id="authBtn">🔐 Авторизоваться</button>`}
        </div>
      </div>
      <div class="dashboard">
        <div class="calendar-section">
          <div class="control-bar">
            <div class="date-nav">
              <button id="prevDay">←</button>
              <span id="currentDateSpan"></span>
              <button id="nextDay">→</button>
            </div>
            <div class="legend">
              <div class="legend-item"><div class="legend-color free"></div> Свободно</div>
              <div class="legend-item"><div class="legend-color my"></div> Моё</div>
              <div class="legend-item"><div class="legend-color booked"></div> Занято</div>
              <div class="legend-item"><div class="legend-color selected"></div> Выбрано</div>
            </div>
          </div>
          ${isAdminUser ? `
            <div class="admin-user-selector">
              <span class="admin-user-label">🎯 Бронирование для:</span>
              <span class="admin-user-badge" id="selectedUserBadge">${escapeHtml(getDisplayName(adminBookingTarget))}</span>
              <button id="selectUserBtn" class="admin-user-select-btn">👤 Выбрать пользователя</button>
            </div>
          ` : ''}
          <div id="weekContainer" class="week-grid"></div>
          <div class="info-panel">
            <div id="selectedSlotInfo"></div>
            <div>
              <button id="clearSelBtn" class="book-btn clear-btn">🗑️ Очистить</button>
              <button id="bookBtn" class="book-btn">✅ Забронировать</button>
            </div>
          </div>
        </div>
        <div id="bookingsSidebar" class="bookings-sidebar">
          <div class="sidebar-inner">
            <div class="bookings-section">
              <h3><span id="bookingsTitle">Бронирования</span></h3>
              ${isAdminUser ? `
                <div class="filter-section">
                  <input type="text" id="bookingFilterInput" class="filter-input" placeholder="🔍 Фильтр по фамилии или логину..." value="${escapeHtml(bookingFilterTerm)}">
                  <button id="applyFilterBtn" class="filter-btn">🔍</button>
                  <button id="resetFilterBtn" class="filter-btn" style="background:#6c757d;">✖️</button>
                </div>
              ` : ''}
              <div id="bookingsListContainer" class="booking-list">Загрузка...</div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('prevDay')?.addEventListener('click', () => {
    let newDate = new Date(currentFocusDate);
    newDate.setDate(currentFocusDate.getDate() - 1);
    if (normalizeDate(newDate) < normalizeDate(new Date())) {
      showToast('Нельзя вернуться в прошлое');
      return;
    }
    currentFocusDate = newDate;
    highlightedBookingKey = null;
    updateHighlightedBooking();
    renderMainContent();
  });

  document.getElementById('nextDay')?.addEventListener('click', () => {
    currentFocusDate.setDate(currentFocusDate.getDate() + 1);
    highlightedBookingKey = null;
    updateHighlightedBooking();
    renderMainContent();
  });

  document.getElementById('bookBtn')?.addEventListener('click', bookSelectedSlots);
  document.getElementById('clearSelBtn')?.addEventListener('click', () => {
    selectedSlots.clear();
    highlightedBookingKey = null;
    updateHighlightedBooking();
    renderMainContent();
    updateInfoPanel();
    showToast('Выбор очищен');
  });

  if (currentUser) {
    document.getElementById('logoutBtn')?.addEventListener('click', logoutUser);
    document.getElementById('profileBtn')?.addEventListener('click', () => {
      if (!isAdminUser && currentUser) showEditUserModal(currentUser);
    });
  } else {
    document.getElementById('authBtn')?.addEventListener('click', showAuthModal);
  }

  if (isAdminUser) {
    document.getElementById('usersManageBtn')?.addEventListener('click', showUsersManagementModal);
    document.getElementById('selectUserBtn')?.addEventListener('click', showUserSelectModal);

    document.getElementById('applyFilterBtn')?.addEventListener('click', () => {
      bookingFilterTerm = document.getElementById('bookingFilterInput')?.value || '';
      highlightedBookingKey = null;
      if (outsideClickHandler) { removeOutsideClickHandler(); editingCommentKey = null; }
      renderBookingsList();
      renderMainContent();
    });
    document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
      bookingFilterTerm = '';
      const inp = document.getElementById('bookingFilterInput');
      if (inp) inp.value = '';
      highlightedBookingKey = null;
      if (outsideClickHandler) { removeOutsideClickHandler(); editingCommentKey = null; }
      renderBookingsList();
      renderMainContent();
    });
    document.getElementById('bookingFilterInput')?.addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        bookingFilterTerm = e.target.value;
        highlightedBookingKey = null;
        if (outsideClickHandler) { removeOutsideClickHandler(); editingCommentKey = null; }
        renderBookingsList();
        renderMainContent();
      }
    });
  }

  document.getElementById('historyBtn')?.addEventListener('click', showHistoryModal);

  document.addEventListener('click', function(e) {
    if (e.target.closest('button, a, input, textarea, .modal-overlay, .toast-msg')) return;
    if (e.target.closest('.slot-btn') || e.target.closest('.booking-item')) return;
    if (highlightedBookingKey) {
      highlightedBookingKey = null;
      updateHighlightedBooking();
      renderMainContent();
      updateInfoPanel();
    }
  });

  renderMainContent();
  renderBookingsList();
  updateInfoPanel();
}