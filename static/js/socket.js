// ===================== WebSocket‑соединение =====================
const socket = io();

socket.on('connect', () => {
    console.log('WebSocket подключён');
});

// Обновление бронирований (реакция на создание / отмену)
socket.on('booking_updated', async () => {
    // Загружаем актуальные данные о бронированиях
    const bookingsData = await apiFetch('/api/bookings/all', { method: 'GET' });
    allBookings = {};
    bookingsData.forEach(b => { allBookings[b.key] = b.login; });

    // Перерисовываем календарь (слот станет серым, если занят)
    renderMainContent();

    // Обновляем список броней и панель, но НЕ трогаем selectedSlots
    if (currentUser) {
        renderBookingsList();
        updateInfoPanel();
        updateHighlightedBooking();
    }
});

// Обновление списка пользователей (когда админ подтверждает/создаёт/удаляет)
socket.on('user_updated', async () => {
    if (!isAdminUser) return;
    const usersData = await apiFetch('/api/users', { method: 'GET' });
    allUsers = usersData.map(u => u.login);
    userProfiles = {};
    userBookingCounts = {};
    usersData.forEach(u => {
        userProfiles[u.login] = {
            login: u.login,
            firstName: u.firstName,
            lastName: u.lastName,
            middleName: u.middleName,
            phone: u.phone,
            email: u.email
        };
        userBookingCounts[u.login] = u.bookingCount;
    });
    if (document.getElementById('usersModal')) {
        renderUsersManagementContent();
    }
});

// Обновление текста комментария при изменении другим пользователем
socket.on('comment_updated', (data) => {
    if (!currentUser) return;
    const key = data.slot_key;
    const item = bookingElementsCache.get(key) || document.getElementById(`booking-${key}`);
    if (item) {
        loadComment(key).then(commentData => {
            const commentDiv = item.querySelector('.booking-comment');
            if (commentDiv) {
                const hasComment = commentData.text && commentData.text.trim();
                commentDiv.innerHTML = hasComment
                    ? escapeHtml(commentData.text)
                    : '✏️ Кликните, чтобы добавить комментарий';
                commentDiv.className = `booking-comment ${!hasComment ? 'empty' : ''}`;
            }
            const editInfo = item.querySelector('.edit-info');
            if (editInfo) {
                editInfo.textContent = commentData.lastEditedBy
                    ? `✏️ ${commentData.lastEditedBy}, ${commentData.lastEditedAt}`
                    : '';
            }
        });
    }
});