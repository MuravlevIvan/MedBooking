// ===================== Список бронирований =====================

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
  const dateObj = new Date(slot.date);
  const dayName = dateObj.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const timeStr = `${String(slot.hour).padStart(2,'0')}:00 - ${String(slot.hour+1).padStart(2,'0')}:00`;
  const key = slot.key, owner = slot.login;
  
  const slotTime = new Date(slot.date); slotTime.setHours(slot.hour, 0, 0, 0);
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
      ${isAdminUser ? `<div class="booking-user">👤 ${getDisplayName(owner)} (${owner})</div>` : ''}
    </div>
    <div class="booking-comment ${!hasComment ? 'empty' : ''}" data-key="${key}" data-owner="${owner}" data-can-edit="${canEdit}">
      ${displayText}
    </div>
    <div class="booking-footer">
      <button class="cancel-booking-btn" data-date="${slot.date}" data-hour="${slot.hour}">❌ Отменить бронь</button>
      <span class="edit-info"></span>
    </div>`;

  item.querySelector('.cancel-booking-btn')?.addEventListener('click', () => {
    if (confirm('Отменить бронь?')) cancelBooking(slot.date, slot.hour);
  });

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
      } else showToast('Вы не можете редактировать этот комментарий');
    });
  }

  if (isAdminUser || owner === currentUser) {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button, .booking-comment, .comment-edit-area, textarea')) return;
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