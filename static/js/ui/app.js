// ===================== Сборка интерфейса и глобальные обработчики =====================
function renderFullApp() {
  const appContainer = document.getElementById('appContainer');
  
  // Генерация вкладок врачей
  let doctorsHtml = '';
  if (isAdminUser) {
    doctorsHtml = doctorsList.map(doc => `
      <div class="doctor-tab-wrapper ${currentDoctor === doc.id ? 'active' : ''}">
        <button class="doctor-tab" data-doctor="${doc.id}">
          <span class="doctor-name">${escapeHtml(doc.name)}</span>
        </button>
        <button class="doctor-edit-btn" data-id="${doc.id}" title="Редактировать">✏️</button>
        <button class="doctor-delete-btn" data-id="${doc.id}" title="Удалить" ${doctorsList.length === 1 ? 'disabled' : ''}>🗑️</button>
      </div>
    `).join('');
    doctorsHtml += `<button class="doctor-add-btn" id="addDoctorBtn" title="Добавить врача">➕</button>`;
  } else {
    doctorsHtml = doctorsList.map(doc => `
      <button class="doctor-tab ${currentDoctor === doc.id ? 'active' : ''}" data-doctor="${doc.id}">
        ${escapeHtml(doc.name)}
      </button>
    `).join('');
  }

  // Информация о настройках текущего врача (интервал, часы работы, техперерыв)
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
  document.getElementById('historyBtn')?.addEventListener('click', () => showHistoryModal());

  // Переключение врачей
  document.querySelectorAll('.doctor-tab').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const doctorId = btn.dataset.doctor;
      if (doctorId === currentDoctor) return;
      currentDoctor = doctorId;
      selectedSlots.clear();
      highlightedBookingKey = null;
      editingCommentKey = null;
      await loadBookingsForDoctor(currentDoctor);
      document.querySelectorAll('.doctor-tab-wrapper, .doctor-tab').forEach(t => {
        if (t.classList) t.classList.remove('active');
        else if (t.parentElement) t.parentElement.classList.remove('active');
      });
      if (btn.parentElement && btn.parentElement.classList) btn.parentElement.classList.add('active');
      else btn.classList.add('active');
      updateInfoPanel();
      renderMainContent();
      renderBookingsList();
      // Обновить отображение настроек врача (интервал, часы, техперерыв)
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

  // Управление врачами (админ)
  if (isAdminUser) {
    // Редактирование врача (открываем модальное окно)
    document.querySelectorAll('.doctor-edit-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        showEditDoctorModal(id);
      });
    });
    // Удаление врача
    document.querySelectorAll('.doctor-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (doctorsList.length <= 1) {
          showToast('Нельзя удалить единственного врача');
          return;
        }
        if (confirm(`Удалить врача "${doctorsList.find(d => d.id === id)?.name}"? Все его бронирования и комментарии будут удалены.`)) {
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
    // Добавление врача
    const addBtn = document.getElementById('addDoctorBtn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const name = prompt('Введите имя нового врача:', 'Новый врач');
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