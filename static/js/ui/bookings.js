// ===================== Список бронирований =====================

/**
 * Загружает и отображает список бронирований (все или мои).
 * Использует кэш элементов для точечных обновлений.
 */
async function renderBookingsList() {
  const container = document.getElementById('bookingsListContainer');
  const titleSpan = document.getElementById('bookingsTitle');
  if (!container) return;
  if (!currentUser) {
    titleSpan.innerHTML = 'Бронирования';
    container.innerHTML = '<div class="empty-bookings">🔒 Авторизуйтесь</div>';
    bookingElementsCache.clear();
    return;
  }
  try {
    const rawBookings = await apiFetch('/api/bookings', { method: 'GET' });
    let bookings = rawBookings;
    if (isAdminUser && bookingFilterTerm.trim()) {
      const search = bookingFilterTerm.trim().toLowerCase();
      bookings = bookings.filter(b => {
        const fullName = getDisplayName(b.login).toLowerCase();
        return b.login.toLowerCase().includes(search) || fullName.includes(search);
      });
    }
    titleSpan.innerHTML = isAdminUser ? 'Все бронирования' : 'Мои бронирования';
    if (bookings.length === 0) {
      container.innerHTML = '<div class="empty-bookings">✨ Нет броней</div>';
      bookingElementsCache.clear();
      return;
    }

    bookings.sort((a,b) => a.date.localeCompare(b.date) || a.hour - b.hour);

    if (bookingElementsCache.size === 0 || container.children.length === 0) {
      // Полное построение (первый запуск или после перезагрузки)
      container.innerHTML = '';
      bookingElementsCache.clear();
      for (const slot of bookings) {
        let commentData = { text: '' };
        try { commentData = await loadComment(slot.key); } catch(e) {}
        const item = createBookingItem(slot, commentData.text || '');
        container.appendChild(item);
        bookingElementsCache.set(slot.key, item);
        if (commentData.lastEditedBy) {
          const editInfo = item.querySelector('.edit-info');
          if (editInfo) editInfo.textContent = `✏️ ${commentData.lastEditedBy}, ${commentData.lastEditedAt}`;
        }
      }
    } else {
      // Точечное обновление: скрываем/показываем и сортируем
      const visibleKeys = new Set(bookings.map(b => b.key));
      for (const [key, item] of bookingElementsCache) {
        if (!visibleKeys.has(key)) {
          item.remove();
          bookingElementsCache.delete(key);
        }
      }
      const sortedKeys = bookings.map(b => b.key);
      for (let i = 0; i < sortedKeys.length; i++) {
        const key = sortedKeys[i];
        let item = bookingElementsCache.get(key);
        if (!item) {
          const slot = bookings.find(b => b.key === key);
          if (slot) {
            let commentData = { text: '' };
            try { commentData = await loadComment(slot.key); } catch(e) {}
            item = createBookingItem(slot, commentData.text || '');
            container.insertBefore(item, container.children[i] || null);
            bookingElementsCache.set(key, item);
          }
          continue;
        }
        item.style.display = '';
        const currentIndex = Array.from(container.children).indexOf(item);
        if (currentIndex !== i) {
          container.insertBefore(item, container.children[i] || null);
        }
      }
    }
  } catch (e) {
    container.innerHTML = '<div class="empty-bookings">❌ Ошибка загрузки</div>';
    bookingElementsCache.clear();
  }
  updateHighlightedBooking();
}

/**
 * Обновляет информационную панель под календарём (счётчик выбранных слотов, текст кнопки).
 */
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