// ===================== Календарь (сетка дней и слотов) =====================

function renderMainContent() {
  const weekContainer = document.getElementById('weekContainer');
  if (!weekContainer) return;
  const today = normalizeDate(new Date());
  let base = normalizeDate(currentFocusDate);
  if (base < today) base = new Date(today);

  let daysCount = 4;
  if (window.innerWidth <= 1280 && window.innerWidth > 1024) daysCount = 4;
  else if (window.innerWidth <= 1024 && window.innerWidth > 710) daysCount = 4;
  else if (window.innerWidth <= 710 && window.innerWidth > 480) daysCount = 3;
  else if (window.innerWidth <= 480) daysCount = 2;

  const days = [];
  for (let i = 0; i < daysCount; i++) {
    let day = new Date(base);
    day.setDate(base.getDate() + i);
    days.push(normalizeDate(day));
  }
  weekContainer.innerHTML = '';
  
  const doctor = doctorsList.find(d => d.id === currentDoctor);
  const slotInterval = doctor?.slotInterval || 60;
  const startHour = doctor?.startHour ?? 9;
  const endHour = doctor?.endHour ?? 21;
  const breakStart = doctor?.breakStart || '';
  const breakEnd = doctor?.breakEnd || '';
  
  // Функция проверки, попадает ли время в перерыв
  function isInBreak(timeMinutes) {
    if (!breakStart || !breakEnd) return false;
    const [breakStartHour, breakStartMin] = breakStart.split(':').map(Number);
    const [breakEndHour, breakEndMin] = breakEnd.split(':').map(Number);
    const breakStartTotal = breakStartHour * 60 + breakStartMin;
    const breakEndTotal = breakEndHour * 60 + breakEndMin;
    return timeMinutes >= breakStartTotal && timeMinutes < breakEndTotal;
  }
  
  days.forEach(day => {
    const ymd = formatYMD(day);
    const weekDay = day.toLocaleDateString('ru-RU', { weekday: 'short' });
    const dateNum = day.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' });
    const isToday = (formatYMD(new Date()) === ymd);
    const column = document.createElement('div');
    column.className = 'day-column';
    column.innerHTML = `<div class="day-header">${weekDay}, ${dateNum}${isToday ? ' 🔹' : ''}</div>`;
    const slotsDiv = document.createElement('div');
    slotsDiv.className = 'slots-container';
    
    let currentTime = startHour * 60;
    const endTime = endHour * 60;
    while (currentTime < endTime) {
      // Пропускаем слоты, попадающие в перерыв
      if (isInBreak(currentTime)) {
        currentTime += slotInterval;
        continue;
      }
      
      const hourStart = Math.floor(currentTime / 60);
      const minuteStart = currentTime % 60;
      const timeStr = `${String(hourStart).padStart(2,'0')}:${String(minuteStart).padStart(2,'0')}`;
      const nextTime = currentTime + slotInterval;
      const hourEnd = Math.floor(nextTime / 60);
      const minuteEnd = nextTime % 60;
      const timeEndStr = `${String(hourEnd).padStart(2,'0')}:${String(minuteEnd).padStart(2,'0')}`;
      
      const key = `${ymd}|${timeStr}`;
      const owner = allBookings[key] || null;
      const slotDateTime = new Date(day);
      slotDateTime.setHours(hourStart, minuteStart, 0, 0);
      const isPast = slotDateTime < new Date();
      const isFree = !owner && !isPast;
      const isBookedByMe = owner && currentUser && owner === currentUser;
      const isSelected = selectedSlots.has(key);
      
      const slotBtn = document.createElement('div');
      slotBtn.className = 'slot-btn';
      slotBtn.textContent = `${timeStr} – ${timeEndStr}`;
      
      if (isPast) { slotBtn.classList.add('booked'); slotBtn.style.cursor = 'default'; }
      else if (isSelected) slotBtn.classList.add('selected');
      else if (isBookedByMe) slotBtn.classList.add('booked-by-me');
      else if (owner) slotBtn.classList.add('booked');
      else if (!currentUser) slotBtn.classList.add('free-guest');
      else if (isAdminUser || allUsers.includes(currentUser)) slotBtn.classList.add('free');
      else slotBtn.classList.add('free-guest');
      
      if (highlightedBookingKey === key && !isPast) slotBtn.classList.add('highlighted-slot');

      if (!isPast && isFree && (isAdminUser || (currentUser && allUsers.includes(currentUser)))) {
        slotBtn.style.cursor = 'pointer';
        slotBtn.addEventListener('click', (() => toggleSlotSelection(ymd, timeStr, day)));
      } else if (!isPast && isFree && !currentUser) {
        slotBtn.style.cursor = 'pointer';
        slotBtn.addEventListener('click', () => showAuthModal());
      } else if (!isPast && isFree && currentUser && !allUsers.includes(currentUser) && !isAdminUser) {
        slotBtn.style.cursor = 'pointer';
        slotBtn.addEventListener('click', () => showToast('Учётная запись ожидает подтверждения'));
      } else if (!isPast && owner && (isAdminUser || isBookedByMe)) {
        slotBtn.style.cursor = 'pointer';
        slotBtn.addEventListener('click', () => highlightBookingSlot(key));
      }
      
      slotsDiv.appendChild(slotBtn);
      currentTime += slotInterval;
    }
    column.appendChild(slotsDiv);
    weekContainer.appendChild(column);
  });

  const startStr = base.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const endDate = new Date(base);
  endDate.setDate(base.getDate() + daysCount - 1);
  document.getElementById('currentDateSpan').textContent = `${startStr} – ${endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
}

function createBookingItem(slot, commentText = null) {
  const doctor = doctorsList.find(d => d.id === currentDoctor);
  const slotInterval = doctor?.slotInterval || 60;
  
  const dateObj = new Date(slot.date);
  const dayName = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const [hour, minute] = slot.time.split(':').map(Number);
  const nextTime = new Date(dateObj);
  nextTime.setHours(hour, minute, 0, 0);
  nextTime.setMinutes(nextTime.getMinutes() + slotInterval);
  const timeEndStr = `${String(nextTime.getHours()).padStart(2,'0')}:${String(nextTime.getMinutes()).padStart(2,'0')}`;
  const timeStr = `${slot.time} – ${timeEndStr}`;
  const key = slot.key, owner = slot.login;
  
  const slotTime = new Date(slot.date);
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
      <div><span class="booking-time">${dayName}, ${timeStr}</span></div>
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
        if (login) showHistoryModal(login);
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