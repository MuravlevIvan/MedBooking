// ===================== Глобальное состояние приложения =====================
let currentUser = null;
let isAdminUser = false;
let allUsers = [];
let pendingUsers = [];
let allBookings = {};                 // для текущего врача
let bookingComments = {};
let userProfiles = {};
let userBookingCounts = {};
let selectedSlots = new Set();
let highlightedBookingKey = null;
let currentFocusDate = new Date();
let editingCommentKey = null;
let outsideClickHandler = null;
let originalCommentText = '';
let adminBookingTarget = null;
let bookingFilterTerm = '';
let userSelectSearchTerm = '';
let bookingElementsCache = new Map();

// Врачи и их настройки
let currentDoctor = 'doctor1';
let doctorsList = []; // каждый объект: {id, name, slotInterval, startHour, endHour, breakStart, breakEnd}