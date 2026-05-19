// ===================== WebSocket‑соединение =====================
const socket = io();

socket.on('connect', () => {
    console.log('WebSocket подключён');
});

socket.on('booking_updated', async (data) => {
    if (data && data.doctor && data.doctor !== currentDoctor) return;
    const bookingsData = await apiFetch(`/api/bookings/all?doctor=${currentDoctor}`);
    allBookings = {};
    bookingsData.forEach(b => { allBookings[b.key] = b.login; });
    renderMainContent();
    if (currentUser) {
        await renderBookingsList();
        updateInfoPanel();
        updateHighlightedBooking();
    }
});

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

socket.on('comment_updated', (data) => {
    if (!currentUser) return;
    if (data && data.doctor && data.doctor !== currentDoctor) return;
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

socket.on('doctors_updated', async () => {
    await loadDoctors();
    if (!doctorsList.some(d => d.id === currentDoctor)) {
        currentDoctor = doctorsList[0]?.id || 'doctor1';
    }
    renderFullApp();
    await loadBookingsForDoctor(currentDoctor);
});