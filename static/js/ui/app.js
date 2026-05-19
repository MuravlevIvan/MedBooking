// ===================== Сборка интерфейса и глобальные обработчики =====================

// Глобальная переменная для заголовка (доступна везде)
window.currentTitle = "📅 Консультация нутрициолога";

async function loadTitle() {
    try {
        const data = await apiFetch('/api/settings/title');
        window.currentTitle = data.title;
        const titleEl = document.getElementById('mainTitle');
        if (titleEl) titleEl.textContent = window.currentTitle;
    } catch(e) {
        console.warn('Не удалось загрузить заголовок', e);
    }
}

async function refreshTitleFromServer() {
    await loadTitle();
}

function renderFullApp() {
  const appContainer = document.getElementById('appContainer');
  
  // Генерация вкладок дорожек
  let doctorsHtml = '';
  if (isAdminUser) {
    doctorsHtml = doctorsList.map(doc => `
      <div class="doctor-tab-wrapper ${currentDoctor === doc.id ? 'active' : ''}">
        <button class="doctor-tab" data-doctor="${doc.id}">
          <span class="doctor-name">${escapeHtml(doc.name)}</span>
        </button>
        <button class="doctor-edit-btn" data-id="${doc.id}" title="Редактировать">✏️</button>
        <button class="doctor-delete-btn" data-id="${doc.id}" title="Удалить" 
          ${doctorsList.length === 1 || doc.id === 'doctor1' ? 'disabled' : ''}>
          🗑️
        </button>
      </div>
    `).join('');
    doctorsHtml += `<button class="doctor-add-btn" id="addDoctorBtn" title="Добавить дорожку">➕</button>`;
  } else {
    doctorsHtml = doctorsList.map(doc => `
      <button class="doctor-tab ${currentDoctor === doc.id ? 'active' : ''}" data-doctor="${doc.id}">
        ${escapeHtml(doc.name)}
      </button>
    `).join('');
  }

  // Информация о настройках текущей дорожки
  const currentDoctorSettings = doctorsList.find(d => d.id === currentDoctor);
  let settingsInfo = '';
  if (isAdminUser && currentDoctorSettings) {
    const breakStart = currentDoctorSettings.breakStart || '';
    const breakEnd = currentDoctorSettings.breakEnd || '';
    const breakInfo = (breakStart && breakEnd) ? ` | 🚫 техперерыв: ${breakStart}–${breakEnd}` : '';
    settingsInfo = `
      <div class="doctor-settings-info" id="doctorSettingsInfo">
        ⏱ ${currentDoctorSettings.slotInterval} мин | 🕘 ${currentDoctorSettings.startHour}:00 – ${currentDoctorSettings.endHour}:00${breakInfo}
      </div>
    `;
  }

  appContainer.innerHTML = `
    <div class="main-card">
      <div class="app-header">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <h1 id="mainTitle">${escapeHtml(window.currentTitle)}</h1>
          ${isAdminUser ? `<button id="editTitleBtn" class="edit-title-btn" title="Редактировать заголовок">✏️</button>` : ''}
        </div>
        <div style="display:flex; justify-content: center; gap:0.8rem; flex-wrap:wrap;">
          <div class="user-info ${!currentUser ? 'guest' : (isAdminUser ? 'admin' : (allUsers.includes(currentUser) ? '' : 'pending'))}" id="profileBtn">
            👤 ${currentUser ? escapeHtml(getDisplayName(currentUser)) : 'Гость'} ${isAdminUser ? ' 👑' : ''}
          </div>
          ${isAdminUser ? `<button class="admin-users-btn" id="usersManageBtn">👥 Управление пользователями</button>` : ''}
          ${currentUser ? `<button class="history-btn" id="historyBtn">📜 История</button>` : ''}
          ${currentUser ? `<button class="logout-btn" id="logoutBtn">🚪 Выйти</button>` : `<button class="auth-action-btn" id="authBtn">🔐 Авторизоваться</button>`}
        </div>
      </div>
      <div class="doctor-tabs">
        ${doctorsHtml}
      </div>
      ${settingsInfo}
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

  // Обработчики навигации
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
  const historyBtn = document.getElementById('historyBtn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => showHistoryModal('', ''));
  }

  // Переключение дорожек
  document.querySelectorAll('.doctor-tab').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const doctorId = btn.dataset.doctor;
      if (doctorId === currentDoctor) return;
      currentDoctor = doctorId;
      selectedSlots.clear();
      highlightedBookingKey = null;
      editingCommentKey = null;
      await loadBookingsForDoctor(currentDoctor);
      
      document.querySelectorAll('.doctor-tab, .doctor-tab-wrapper').forEach(el => {
        el.classList.remove('active');
      });
      const wrapper = btn.closest('.doctor-tab-wrapper');
      if (wrapper) {
        wrapper.classList.add('active');
      } else {
        btn.classList.add('active');
      }
      
      updateInfoPanel();
      renderMainContent();
      renderBookingsList();
      const newSettings = doctorsList.find(d => d.id === currentDoctor);
      const settingsDiv = document.getElementById('doctorSettingsInfo');
      if (settingsDiv && newSettings) {
        const breakStart = newSettings.breakStart || '';
        const breakEnd = newSettings.breakEnd || '';
        const breakInfo = (breakStart && breakEnd) ? ` | 🚫 техперерыв: ${breakStart}–${breakEnd}` : '';
        settingsDiv.innerHTML = `⏱ ${newSettings.slotInterval} мин | 🕘 ${newSettings.startHour}:00 – ${newSettings.endHour}:00${breakInfo}`;
      }
    });
  });

  // Управление дорожками (админ)
  if (isAdminUser) {
    document.querySelectorAll('.doctor-edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        showEditDoctorModal(id);
      });
    });
    // Обработчик удаления дорожки с защитой doctor1
    document.querySelectorAll('.doctor-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (id === 'doctor1') {
          showToast('Нельзя удалить основную дорожку (Дорожка 1)');
          return;
        }
        if (doctorsList.length <= 1) {
          showToast('Нельзя удалить единственного дорожку');
          return;
        }
        if (confirm(`Удалить Дорожку "${doctorsList.find(d => d.id === id)?.name}"? Все его бронирования и комментарии будут удалены.`)) {
          try {
            await deleteDoctor(id);
            await loadDoctors();
            if (!doctorsList.some(d => d.id === currentDoctor)) {
              currentDoctor = doctorsList[0]?.id || 'doctor1';
            }
            renderFullApp();
            await loadBookingsForDoctor(currentDoctor);
          } catch (err) {
            showToast(err.message);
          }
        }
      });
    });
    const addBtn = document.getElementById('addDoctorBtn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const name = prompt('Введите имя новой дорожки:', 'Новая дорожка');
        if (name && name.trim()) {
          try {
            await createDoctor(name.trim(), 60, 9, 21, '', '');
            await loadDoctors();
            currentDoctor = doctorsList[doctorsList.length - 1]?.id || currentDoctor;
            renderFullApp();
            await loadBookingsForDoctor(currentDoctor);
          } catch (err) {
            showToast(err.message);
          }
        }
      });
    }
  }

  // Кнопка редактирования заголовка
  const editTitleBtn = document.getElementById('editTitleBtn');
  if (editTitleBtn) {
    editTitleBtn.addEventListener('click', () => showEditTitleModal());
  }

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

window.renderFullApp = renderFullApp;
window.loadTitle = loadTitle;
window.refreshTitleFromServer = refreshTitleFromServer;