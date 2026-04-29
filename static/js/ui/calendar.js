// ===================== Календарь (сетка дней и слотов) =====================

/**
 * Генерирует сетку дней с слотами внутри #weekContainer.
 * Количество дней зависит от ширины экрана.
 */
function renderMainContent() {
  const weekContainer = document.getElementById('weekContainer');
  if (!weekContainer) return;
  const today = normalizeDate(new Date());
  let base = normalizeDate(currentFocusDate);
  if (base < today) base = new Date(today);

  // Определяем количество дней в зависимости от ширины экрана
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
    for (let hour = 9; hour < 21; hour++) {
      const key = `${ymd}|${hour}`;
      const owner = allBookings[key] || null;
      const slotTime = new Date(day); slotTime.setHours(hour, 0, 0, 0);
      const isPast = slotTime < new Date();
      const isFree = !owner && !isPast;
      const isBookedByMe = owner && currentUser && owner === currentUser;
      const isSelected = selectedSlots.has(key);
      const slotBtn = document.createElement('div');
      slotBtn.className = 'slot-btn';
      slotBtn.textContent = `${String(hour).padStart(2,'0')}:00 – ${String(hour+1).padStart(2,'0')}:00`;
      if (isPast) { slotBtn.classList.add('booked'); slotBtn.style.cursor = 'default'; }
      else if (isSelected) slotBtn.classList.add('selected');
      else if (isBookedByMe) slotBtn.classList.add('booked-by-me');
      else if (owner) slotBtn.classList.add('booked');
      else if (!currentUser) slotBtn.classList.add('free-guest');
      else if (isAdminUser || allUsers.includes(currentUser)) slotBtn.classList.add('free');
      else slotBtn.classList.add('free-guest');
      if (highlightedBookingKey === key && !isPast) slotBtn.classList.add('highlighted-slot');

      // Обработчики кликов по слотам
      if (!isPast && isFree && (isAdminUser || (currentUser && allUsers.includes(currentUser)))) {
        slotBtn.style.cursor = 'pointer';
        slotBtn.addEventListener('click', (() => toggleSlotSelection(ymd, hour, day)));
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
    }
    column.appendChild(slotsDiv);
    weekContainer.appendChild(column);
  });

  const startStr = base.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  const endDate = new Date(base);
  endDate.setDate(base.getDate() + daysCount - 1);
  document.getElementById('currentDateSpan').textContent = `${startStr} – ${endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
}

/**
 * Создаёт DOM‑элемент для одной записи бронирования (в боковой панели).
 * @param {object} slot – { date, hour, login, key }
 * @param {string|null} commentText – текст комментария (если уже загружен)
 * @returns {HTMLElement}
 */
function createBookingItem(slot, commentText = null) {
  const dateObj = new Date(slot.date);
  const dayName = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = `${String(slot.hour).padStart(2,'0')}:00 - ${String(slot.hour+1).padStart(2,'0')}:00`;
  const key = slot.key, owner = slot.login;
  const canEdit = isAdminUser || owner === currentUser;

  const item = document.createElement('div');
  item.className = `booking-item ${isAdminUser ? 'admin-view' : ''}`;
  item.setAttribute('data-key', key);
  item.id = `booking-${key}`;

  const hasComment = commentText && commentText.trim();
  const displayText = hasComment ? escapeHtml(commentText) : '✏️ Кликните, чтобы добавить комментарий';

  item.innerHTML = `
    <div class="booking-header">
      <div><span class="booking-time">${dayName}, ${timeStr}</span></div>
      ${isAdminUser ? `<div class="booking-user">👤 ${getDisplayName(owner)} (${owner})</div>` : ''}
    </div>
    <div class="booking-comment ${!hasComment ? 'empty' : ''}" data-key="${key}" data-owner="${owner}" data-can-edit="${canEdit}">
      ${displayText}
    </div>
    <div class="booking-footer">
      <button class="cancel-booking-btn" data-date="${slot.date}" data-hour="${slot.hour}">❌ Отменить бронь</button>
      <span class="edit-info"></span>
    </div>`;

  // Обработчик кнопки отмены
  item.querySelector('.cancel-booking-btn')?.addEventListener('click', () => {
    if (confirm('Отменить бронь?')) cancelBooking(slot.date, slot.hour);
  });

  // Обработчик клика по комментарию
  const commentDiv = item.querySelector('.booking-comment');
  if (commentDiv) {
    commentDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      if (commentDiv.dataset.canEdit === 'true') {
        editingCommentKey = key;
        highlightedBookingKey = key;
        updateHighlightedBooking();
        renderMainContent();
        const curText = commentDiv.textContent.trim() === '✏️ Кликните, чтобы добавить комментарий'
          ? ''
          : commentDiv.textContent.trim();
        enterEditMode(key, curText);
      } else showToast('Вы не можете редактировать этот комментарий');
    });
  }

  // Обработчик клика по всей записи (выделение слота) для владельца/админа
  if (canEdit) {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button, .booking-comment, .comment-edit-area, textarea')) return;
      highlightBookingSlot(key);
    });
  }

  return item;
}

/**
 * Выделяет занятый слот и подсвечивает соответствующую запись в боковой панели.
 * @param {string} key – ключ слота "YYYY-MM-DD|HH"
 */
function highlightBookingSlot(key) {
  highlightedBookingKey = key;
  selectedSlots.clear();
  updateHighlightedBooking();
  renderMainContent();
  updateInfoPanel();
}

/**
 * Обновляет подсветку записей в боковой панели (добавляет/убирает класс highlighted).
 */
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