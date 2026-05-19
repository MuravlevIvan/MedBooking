// ===================== Список бронирований =====================
let isRenderingBookings = false;

async function renderBookingsList() {
  if (isRenderingBookings) {
    console.log('renderBookingsList уже выполняется, пропускаем');
    return;
  }
  
  const container = document.getElementById('bookingsListContainer');
  const titleSpan = document.getElementById('bookingsTitle');
  if (!container) return;
  
  if (!currentUser) {
    titleSpan.innerHTML = 'Бронирования';
    container.innerHTML = '<div class="empty-bookings">🔒 Авторизуйтесь</div>';
    bookingElementsCache.clear();
    return;
  }
  
  isRenderingBookings = true;
  
  try {
    const rawBookings = await apiFetch(`/api/bookings?doctor=${currentDoctor}`);
    let bookings = rawBookings;
    
    if (isAdminUser && bookingFilterTerm.trim()) {
      const search = bookingFilterTerm.trim().toLowerCase();
      bookings = bookings.filter(b => {
        const fullName = getDisplayName(b.login).toLowerCase();
        return b.login.toLowerCase().includes(search) || fullName.includes(search);
      });
    }
    
    titleSpan.innerHTML = isAdminUser ? 'Все бронирования' : 'Мои бронирования';
    
    container.innerHTML = '';
    bookingElementsCache.clear();
    
    if (bookings.length === 0) {
      container.innerHTML = '<div class="empty-bookings">✨ Нет броней</div>';
      isRenderingBookings = false;
      return;
    }
    
    bookings.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    
    for (const slot of bookings) {
      let commentData = { text: '' };
      try {
        commentData = await loadComment(slot.key);
      } catch(e) {}
      
      const item = createBookingItem(slot, commentData.text || '');
      container.appendChild(item);
      bookingElementsCache.set(slot.key, item);
      
      if (commentData.lastEditedBy) {
        const editInfo = item.querySelector('.edit-info');
        if (editInfo) {
          editInfo.textContent = `✏️ ${commentData.lastEditedBy}, ${commentData.lastEditedAt}`;
        }
      }
    }
  } catch (e) {
    console.error(e);
    container.innerHTML = '<div class="empty-bookings">❌ Ошибка загрузки</div>';
    bookingElementsCache.clear();
  } finally {
    isRenderingBookings = false;
  }
  
  updateHighlightedBooking();
}

function updateInfoPanel() {
  const infoDiv = document.getElementById('selectedSlotInfo'),
        bookBtn = document.getElementById('bookBtn');
  if (!infoDiv) return;
  if (!currentUser) infoDiv.innerHTML = '🔒 Нажмите «Авторизоваться»';
  else if (!isAdminUser && !allUsers.includes(currentUser)) infoDiv.innerHTML = '⏳ Учётная запись ожидает подтверждения';
  else {
    const count = selectedSlots.size;
    if (isAdminUser) {
      const targetName = adminBookingTarget ? getDisplayName(adminBookingTarget) : 'себя';
      infoDiv.innerHTML = count
        ? `📌 Выбрано слотов: ${count} (для ${targetName})`
        : `⚡ Кликайте на свободные слоты (для ${targetName})`;
      if (bookBtn) bookBtn.innerHTML = `✅ Забронировать для ${targetName}`;
    } else {
      infoDiv.innerHTML = count
        ? `📌 Выбрано слотов: ${count}`
        : '⚡ Кликайте на свободные слоты';
      if (bookBtn) bookBtn.innerHTML = `✅ Забронировать`;
    }
  }
  if (bookBtn) bookBtn.disabled = (!currentUser || (!isAdminUser && !allUsers.includes(currentUser)));
}

function createBookingItem(slot, commentText = null) {
  const doctor = doctorsList.find(d => d.id === currentDoctor);
  const slotInterval = doctor?.slotInterval || 60;
  const isDaily = (slot.time === '00:00') && (doctor?.bookingType === 'daily');
  
  const dateObj = new Date(slot.date);
  const dayName = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  
  let timeDisplay;
  if (isDaily) {
    timeDisplay = '🏡 Весь день';
  } else {
    const [hour, minute] = slot.time.split(':').map(Number);
    const nextTime = new Date(dateObj);
    nextTime.setHours(hour, minute, 0, 0);
    nextTime.setMinutes(nextTime.getMinutes() + slotInterval);
    const timeEndStr = `${String(nextTime.getHours()).padStart(2,'0')}:${String(nextTime.getMinutes()).padStart(2,'0')}`;
    timeDisplay = `${slot.time} – ${timeEndStr}`;
  }
  
  const key = slot.key, owner = slot.login;
  const slotTime = new Date(slot.date);
  const [hour, minute] = slot.time.split(':').map(Number);
  slotTime.setHours(hour, minute, 0, 0);
  const isPastSlot = slotTime < new Date();
  const canEdit = isAdminUser || (owner === currentUser && !isPastSlot);

  const item = document.createElement('div');
  item.className = `booking-item ${isAdminUser ? 'admin-view' : ''}`;
  item.setAttribute('data-key', key);
  item.id = `booking-${key}`;

  const hasComment = commentText && commentText.trim();
  const displayText = hasComment ? escapeHtml(commentText) : '✏️ Кликните, чтобы добавить комментарий';

  item.innerHTML = `
    <div class="booking-header">
      <div><span class="booking-time">${dayName}, ${timeDisplay}</span></div>
      ${isAdminUser ? `<div class="booking-user" data-login="${owner}" style="cursor:pointer;" title="Нажмите для просмотра истории пользователя">👤 ${getDisplayName(owner)} (${owner})</div>` : ''}
    </div>
    <div class="booking-comment ${!hasComment ? 'empty' : ''}" data-key="${key}" data-owner="${owner}" data-can-edit="${canEdit}">
      ${displayText}
    </div>
    <div class="booking-footer">
      <button class="cancel-booking-btn" data-date="${slot.date}" data-time="${slot.time}">❌ Отменить бронь</button>
      <span class="edit-info"></span>
    </div>`;

  const cancelBtn = item.querySelector('.cancel-booking-btn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Отменить бронь?')) cancelBooking(slot.date, slot.time);
    });
  }

  const commentDiv = item.querySelector('.booking-comment');
  if (commentDiv) {
    commentDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      if (commentDiv.dataset.canEdit === 'true') {
        editingCommentKey = key;
        highlightedBookingKey = key;
        updateHighlightedBooking();
        renderMainContent();
        const curText = commentDiv.textContent.trim() === '✏️ Кликните, чтобы добавить комментарий' ? '' : commentDiv.textContent.trim();
        enterEditMode(key, curText);
      } else {
        showToast('Вы не можете редактировать этот комментарий');
      }
    });
  }

  if (isAdminUser) {
    const userDiv = item.querySelector('.booking-user');
    if (userDiv) {
      userDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        const login = userDiv.getAttribute('data-login');
        if (login) showHistoryModal(login, '');
      });
    }
  }

  if (isAdminUser || owner === currentUser) {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button, .booking-comment, .comment-edit-area, textarea, .booking-user')) return;
      highlightBookingSlot(key);
    });
  }

  return item;
}

function highlightBookingSlot(key) {
  highlightedBookingKey = key;
  selectedSlots.clear();
  updateHighlightedBooking();
  renderMainContent();
  updateInfoPanel();
}

function updateHighlightedBooking() {
  const container = document.getElementById('bookingsListContainer');
  if (!container) return;
  container.querySelectorAll('.booking-item.highlighted').forEach(el => el.classList.remove('highlighted'));
  if (highlightedBookingKey) {
    const targetElement = container.querySelector(`.booking-item[data-key="${cssEscape(highlightedBookingKey)}"]`);
    if (targetElement) {
      targetElement.classList.add('highlighted');
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      highlightedBookingKey = null;
    }
  }
}