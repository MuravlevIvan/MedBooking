// ===================== Календарь (сетка дней и слотов) =====================

function renderMainContent() {
  const weekContainer = document.getElementById('weekContainer');
  if (!weekContainer) return;
  const today = normalizeDate(new Date());
  let base = normalizeDate(currentFocusDate);
  if (base < today) base = new Date(today);

  const doctor = doctorsList.find(d => d.id === currentDoctor);
  const bookingType = doctor?.bookingType || 'time_slots';
  
  if (bookingType === 'daily') {
    // ----- РЕЖИМ "ЦЕЛЫЙ ДЕНЬ" – СЕТКА 4 КОЛОНКИ × 7 СТРОК (28 ДНЕЙ) -----
    const daysCount = 28;          // сколько дней показать
    const columns = 4;             // фиксированное количество колонок
    const rows = daysCount / columns; // 7 строк
    
    // Формируем массив дней
    const days = [];
    for (let i = 0; i < daysCount; i++) {
      let day = new Date(base);
      day.setDate(base.getDate() + i);
      days.push(normalizeDate(day));
    }
    
    // Применяем стили сетки
    weekContainer.style.display = 'grid';
    weekContainer.style.gridTemplateColumns = `repeat(${columns}, 0fr)`;
    weekContainer.style.gap = '1rem';
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
      
      const key = `${ymd}|00:00`;
      const owner = allBookings[key] || null;
      const slotDateTime = new Date(day);
      slotDateTime.setHours(0, 0, 0, 0);
      const isPast = slotDateTime < new Date();
      const isFree = !owner && !isPast;
      const isBookedByMe = owner && currentUser && owner === currentUser;
      const isSelected = selectedSlots.has(key);
      
      const slotBtn = document.createElement('div');
      slotBtn.className = 'slot-btn daily-slot';
      slotBtn.textContent = '🏡 Весь день';
      
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
        slotBtn.addEventListener('click', (() => toggleSlotSelection(ymd, '00:00', day)));
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
      column.appendChild(slotsDiv);
      weekContainer.appendChild(column);
    });
    
    // Отображаем диапазон дат
    const startStr = base.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    const endDate = new Date(base);
    endDate.setDate(base.getDate() + daysCount - 1);
    const endStr = endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    document.getElementById('currentDateSpan').textContent = `${startStr} – ${endStr}`;
    return; // завершаем, чтобы не выполнять обычную логику
  }
  
  // ----- ОБЫЧНЫЙ РЕЖИМ (почасовые слоты) -----
  // Сброс стилей контейнера
  weekContainer.style.display = 'flex';
  weekContainer.style.gridTemplateColumns = '';
  weekContainer.style.gap = '';
  
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
  
  const slotInterval = doctor?.slotInterval || 60;
  const startHour = doctor?.startHour ?? 9;
  const endHour = doctor?.endHour ?? 21;
  const breakStart = doctor?.breakStart || '';
  const breakEnd = doctor?.breakEnd || '';
  
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
  const endStr = endDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  document.getElementById('currentDateSpan').textContent = `${startStr} – ${endStr}`;
}

// createBookingItem, highlightBookingSlot, updateHighlightedBooking – без изменений
// (они уже были в предыдущих версиях, оставляем как есть)