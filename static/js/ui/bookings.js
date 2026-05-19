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