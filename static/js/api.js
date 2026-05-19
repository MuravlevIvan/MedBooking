// ===================== API‑клиент =====================

async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...options.headers };

  if (method !== 'GET') {
    const csrfCookie = document.cookie.split('; ').find(row => row.startsWith('csrf_token='));
    if (csrfCookie) {
      headers['X-CSRFToken'] = csrfCookie.split('=')[1];
    }
  }

  try {
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      currentUser = null;
      isAdminUser = false;
      renderFullApp();
      throw new Error('Unauthorized');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ошибка сервера');
    return data;
  } catch (error) {
    if (error.message !== 'Unauthorized') showToast(error.message);
    throw error;
  }
}

// Загрузка списка врачей
async function loadDoctors() {
  try {
    const data = await apiFetch('/api/doctors');
    doctorsList = data;
    if (!doctorsList.length) doctorsList = [{id:'doctor1',name:'Врач 1',slotInterval:60,startHour:9,endHour:21,breakStart:'',breakEnd:''}];
  } catch(e) {
    doctorsList = [{id:'doctor1',name:'Врач 1',slotInterval:60,startHour:9,endHour:21,breakStart:'',breakEnd:''}];
  }
  return doctorsList;
}

// Загрузка бронирований для конкретного врача
async function loadBookingsForDoctor(doctor) {
  const bookingsData = await apiFetch(`/api/bookings/all?doctor=${doctor}`);
  allBookings = {};
  bookingsData.forEach(b => { allBookings[b.key] = b.login; });
  bookingElementsCache.clear();
  renderMainContent();
  renderBookingsList();
  updateInfoPanel();
}

// Функции управления врачами
async function createDoctor(name, slotInterval, startHour, endHour, breakStart, breakEnd) {
  return apiFetch('/api/doctors', {
    method: 'POST',
    body: JSON.stringify({ name, slotInterval, startHour, endHour, breakStart, breakEnd })
  });
}

async function updateDoctorFull(id, updates) {
  return apiFetch(`/api/doctors/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

async function deleteDoctor(id) {
  return apiFetch(`/api/doctors/${id}`, { method: 'DELETE' });
}

async function loadInitialData() {
  highlightedBookingKey = null;
  await loadDoctors();
  const me = await apiFetch('/api/me').catch(() => ({ login: null, is_admin: false }));
  currentUser = me.login;
  isAdminUser = me.is_admin;
  if (isAdminUser && !adminBookingTarget) adminBookingTarget = currentUser;

  if (!doctorsList.some(d => d.id === currentDoctor)) {
    currentDoctor = doctorsList[0]?.id || 'doctor1';
  }

  await loadBookingsForDoctor(currentDoctor);

  if (isAdminUser) {
    const usersData = await apiFetch('/api/users', { method: 'GET' });
    allUsers = usersData.map(u => u.login);
    userProfiles = {};
    userBookingCounts = {};
    usersData.forEach(u => {
      userProfiles[u.login] = {
        login: u.login, firstName: u.firstName, lastName: u.lastName,
        middleName: u.middleName, phone: u.phone, email: u.email
      };
      userBookingCounts[u.login] = u.bookingCount;
    });
    userProfiles['admin'] = { login: 'admin', firstName: 'Администратор', lastName: '', middleName: '', phone: '', email: '' };
    userBookingCounts['admin'] = 0;
    const pendingData = await apiFetch('/api/pending', { method: 'GET' });
    pendingUsers = pendingData;
  } else if (currentUser) {
    allUsers = [currentUser];
    try {
      const profileData = await apiFetch('/api/profile', { method: 'GET' });
      userProfiles[currentUser] = profileData;
    } catch(e) {
      userProfiles[currentUser] = { login: currentUser, firstName: currentUser, lastName: '', middleName: '', phone: '', email: '' };
    }
    userBookingCounts[currentUser] = 0;
  }
  renderFullApp();
}

async function loginUser(login, password) {
  try {
    const data = await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ login, password }) });
    if (data.login) {
      currentUser = data.login; isAdminUser = data.is_admin;
      if (isAdminUser && !adminBookingTarget) adminBookingTarget = currentUser;
      selectedSlots.clear(); highlightedBookingKey = null;
      await loadInitialData();
      let modal = document.getElementById('authModal');
      if (modal) modal.remove();
      return { success: true };
    }
  } catch(e) { return { success: false, error: e.message }; }
  return { success: false, error: 'Неизвестная ошибка' };
}

async function registerUser() {
  const login = document.getElementById('regLogin')?.value.trim().toLowerCase();
  const password = document.getElementById('regPassword')?.value;
  const firstName = document.getElementById('regFirstName')?.value.trim();
  const lastName = document.getElementById('regLastName')?.value.trim();
  const middleName = document.getElementById('regMiddleName')?.value.trim();
  const phone = document.getElementById('regPhone')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim();
  if (!login || !password || password.length < 8) {
    showToast('Пароль должен быть минимум 8 символов');
    return;
  }
  try {
    await apiFetch('/api/register', { method: 'POST', body: JSON.stringify({ login, password, firstName, lastName, middleName, phone, email }) });
    showToast('Заявка отправлена администратору');
    document.getElementById('registerModal')?.remove();
  } catch(e) {
    if (e.message) showToast(e.message);
  }
}

async function logoutUser() {
  await apiFetch('/api/logout', { method: 'POST' }).catch(() => {});
  currentUser = null; isAdminUser = false; adminBookingTarget = null;
  selectedSlots.clear(); editingCommentKey = null; bookingFilterTerm = '';
  highlightedBookingKey = null;
  renderFullApp();
}

function isSlotFree(dateStr, timeStr, dateObj, doctorId) {
  const key = `${dateStr}|${timeStr}`;
  if (allBookings[key]) return false;
  const [hour, minute] = timeStr.split(':').map(Number);
  let slotDateTime = new Date(dateObj); slotDateTime.setHours(hour, minute, 0, 0);
  return slotDateTime >= new Date();
}

function toggleSlotSelection(dateStr, timeStr, dateObj) {
  if (!currentUser) { showToast('Сначала авторизуйтесь'); return false; }
  if (!isAdminUser && !allUsers.includes(currentUser)) { showToast('Учётная запись ожидает подтверждения'); return false; }
  const key = `${dateStr}|${timeStr}`;
  if (selectedSlots.has(key)) {
    selectedSlots.delete(key);
    renderMainContent();
    updateInfoPanel();
    return true;
  }
  if (!isSlotFree(dateStr, timeStr, dateObj, currentDoctor)) {
    showToast('Слот занят или в прошлом');
    return false;
  }
  highlightedBookingKey = null;
  updateHighlightedBooking();
  selectedSlots.add(key);
  renderMainContent();
  updateInfoPanel();
  return true;
}

async function bookSelectedSlots() {
  if (!currentUser) { showToast('Авторизуйтесь'); return; }
  if (selectedSlots.size === 0) { showToast('Ничего не выбрано'); return; }

  const slots = Array.from(selectedSlots);
  const body = { slots, doctor: currentDoctor };
  if (isAdminUser && adminBookingTarget && adminBookingTarget !== currentUser) {
    body.targetUser = adminBookingTarget;
  }

  selectedSlots.clear();
  highlightedBookingKey = null;
  renderMainContent();
  updateInfoPanel();

  try {
    const bookingsData = await apiFetch(`/api/bookings/all?doctor=${currentDoctor}`);
    allBookings = {};
    bookingsData.forEach(b => { allBookings[b.key] = b.login; });
    const hasConflict = slots.some(slotKey => !!allBookings[slotKey]);
    if (hasConflict) {
      showToast('Слоты уже заняты другим пользователем');
      renderMainContent();
      updateInfoPanel();
      updateHighlightedBooking();
      return;
    }
  } catch (e) { console.warn(e); }

  try {
    const data = await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(body) });
    showToast(data.message);
    await loadBookingsForDoctor(currentDoctor);
    if (data.created === 0) showToast('Слоты уже заняты другим пользователем');
    updateInfoPanel();
    updateHighlightedBooking();
  } catch (e) {
    showToast('Не удалось забронировать. Возможно, слот уже занят.');
    try {
      const bookingsData = await apiFetch(`/api/bookings/all?doctor=${currentDoctor}`);
      allBookings = {};
      bookingsData.forEach(b => { allBookings[b.key] = b.login; });
    } catch (ignored) {}
    renderMainContent();
    updateInfoPanel();
    updateHighlightedBooking();
  }
}

async function cancelBooking(dateStr, timeStr) {
  try {
    await apiFetch(`/api/bookings/${dateStr}/${timeStr}?doctor=${currentDoctor}`, { method: 'DELETE' });
    showToast('Бронь отменена');
    selectedSlots.delete(`${dateStr}|${timeStr}`);
    const key = `${dateStr}|${timeStr}`;
    if (highlightedBookingKey === key) highlightedBookingKey = null;
    await loadBookingsForDoctor(currentDoctor);
  } catch (e) {}
}

async function loadComment(key) {
  const [date, time] = key.split('|');
  try { return await apiFetch(`/api/comments/${date}/${time}?doctor=${currentDoctor}`); }
  catch(e) { return { text: '', lastEditedBy: null, lastEditedAt: null }; }
}

async function updateComment(date, time, text) {
  return apiFetch(`/api/comments/${date}/${time}?doctor=${currentDoctor}`, {
    method: 'PUT',
    body: JSON.stringify({ text })
  });
}

async function fetchUsersList() {
  if (!isAdminUser) return;
  const usersData = await apiFetch('/api/users', { method: 'GET' });
  allUsers = usersData.map(u => u.login);
  userProfiles = {};
  userBookingCounts = {};
  usersData.forEach(u => {
    userProfiles[u.login] = {
      login: u.login, firstName: u.firstName, lastName: u.lastName,
      middleName: u.middleName, phone: u.phone, email: u.email
    };
    userBookingCounts[u.login] = u.bookingCount;
  });
  return usersData;
}

async function fetchPendingList() {
  if (!isAdminUser) return;
  pendingUsers = await apiFetch('/api/pending', { method: 'GET' });
  return pendingUsers;
}

async function fetchBookingHistory(page = 1, search = '') {
  const params = new URLSearchParams({ page, limit: 30, doctor: currentDoctor });
  if (search) params.append('search', search);
  return apiFetch(`/api/bookings/history?${params.toString()}`, { method: 'GET' });
}