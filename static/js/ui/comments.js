// ===================== Редактирование комментариев =====================

/**
 * Включает режим редактирования для комментария.
 * @param {string} key – ключ слота "YYYY-MM-DD|HH"
 * @param {string} commentText – текущий текст комментария (может быть пустым)
 */
function enterEditMode(key, commentText) {
  if (editingCommentKey && editingCommentKey !== key) {
    const oldKey = editingCommentKey;
    editingCommentKey = null;
    removeOutsideClickHandler();
    exitEditModeImmediate(oldKey);
  }

  originalCommentText = commentText;

  const bookingItem = document.getElementById(`booking-${key}`);
  if (!bookingItem) return;
  const commentArea = bookingItem.querySelector('.booking-comment');
  if (!commentArea) return;

  commentArea.outerHTML = `
    <div class="comment-edit-area">
      <textarea class="comment-textarea" id="comment-text-${key}">${escapeHtml(commentText)}</textarea>
      <div class="comment-buttons">
        <button class="comment-save-btn" data-key="${key}">💾 Сохранить</button>
        <button class="comment-cancel-btn">❌ Отмена</button>
      </div>
    </div>`;

  const textarea = document.getElementById(`comment-text-${key}`);
  if (textarea) textarea.focus();

  bookingItem.querySelector('.comment-save-btn')?.addEventListener('click', async () => {
    const txt = document.getElementById(`comment-text-${key}`);
    if (txt) await saveComment(key, txt.value);
  });
  bookingItem.querySelector('.comment-cancel-btn')?.addEventListener('click', () => {
    exitEditMode(key);
  });

  removeOutsideClickHandler();
  outsideClickHandler = (e) => {
    const editArea = document.querySelector(`#booking-${cssEscape(key)} .comment-edit-area`);
    if (!editArea || editArea.contains(e.target)) return;
    const txt = document.getElementById(`comment-text-${key}`);
    if (txt) {
      const val = txt.value.trim();
      if (val === originalCommentText.trim()) exitEditMode(key);
      else if (confirm('Комментарий не сохранён. Сохранить?')) saveComment(key, txt.value);
      else exitEditMode(key);
    }
  };
  document.addEventListener('click', outsideClickHandler);
}

/**
 * Удаляет глобальный обработчик клика вне области редактирования.
 */
function removeOutsideClickHandler() {
  if (outsideClickHandler) {
    document.removeEventListener('click', outsideClickHandler);
    outsideClickHandler = null;
  }
}

/**
 * Мгновенно закрывает редактирование без загрузки комментария (используется при принудительном выходе).
 * @param {string} key – ключ слота
 */
function exitEditModeImmediate(key) {
  const bookingItem = document.getElementById(`booking-${key}`);
  if (!bookingItem) return;
  const editArea = bookingItem.querySelector('.comment-edit-area');
  if (editArea) {
    editArea.outerHTML = `<div class="booking-comment empty" data-key="${key}" data-owner="${allBookings[key]}" data-can-edit="${isAdminUser || allBookings[key] === currentUser}">✏️ Кликните, чтобы добавить комментарий</div>`;
    const newDiv = bookingItem.querySelector('.booking-comment');
    if (newDiv) newDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      if (newDiv.dataset.canEdit === 'true') {
        editingCommentKey = key; highlightedBookingKey = key;
        updateHighlightedBooking(); renderMainContent();
        loadComment(key).then(cd => enterEditMode(key, cd.text || ''));
      } else showToast('Вы не можете редактировать этот комментарий');
    });
  }
}

/**
 * Закрывает режим редактирования (с загрузкой актуального текста с сервера).
 * @param {string} key – ключ слота
 */
function exitEditMode(key) {
  removeOutsideClickHandler();
  loadComment(key).then(commentData => {
    const bookingItem = document.getElementById(`booking-${key}`);
    if (!bookingItem) return;
    const editArea = bookingItem.querySelector('.comment-edit-area');
    if (!editArea) return;
    const text = commentData.text || '';
    const canEdit = isAdminUser || allBookings[key] === currentUser;
    editArea.outerHTML = `<div class="booking-comment ${!text ? 'empty' : ''}" data-key="${key}" data-owner="${allBookings[key]}" data-can-edit="${canEdit}">${text ? escapeHtml(text) : '✏️ Кликните, чтобы добавить комментарий'}</div>`;
    const newDiv = bookingItem.querySelector('.booking-comment');
    if (newDiv) newDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      if (newDiv.dataset.canEdit === 'true') {
        editingCommentKey = key; highlightedBookingKey = key;
        updateHighlightedBooking(); renderMainContent();
        enterEditMode(key, text);
      } else showToast('Вы не можете редактировать этот комментарий');
    });
  });
  editingCommentKey = null;
}

/**
 * Сохраняет комментарий на сервере и обновляет DOM.
 * @param {string} key – ключ слота
 * @param {string} text – новый текст комментария
 */
async function saveComment(key, text) {
  const [date, hour] = key.split('|');
  try {
    const data = await apiFetch(`/api/comments/${date}/${hour}`, { method: 'PUT', body: JSON.stringify({ text }) });
    showToast(data.message || 'Комментарий сохранён');
    removeOutsideClickHandler();
    editingCommentKey = null;

    const item = bookingElementsCache.get(key) || document.getElementById(`booking-${key}`);
    if (item) {
      const editArea = item.querySelector('.comment-edit-area');
      if (editArea) {
        const canEdit = isAdminUser || allBookings[key] === currentUser;
        const hasComment = text && text.trim();
        editArea.outerHTML = `<div class="booking-comment ${!hasComment ? 'empty' : ''}" data-key="${key}" data-owner="${allBookings[key]}" data-can-edit="${canEdit}">${hasComment ? escapeHtml(text) : '✏️ Кликните, чтобы добавить комментарий'}</div>`;
        const newDiv = item.querySelector('.booking-comment');
        if (newDiv) newDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          if (newDiv.dataset.canEdit === 'true') {
            editingCommentKey = key; highlightedBookingKey = key;
            updateHighlightedBooking(); renderMainContent();
            enterEditMode(key, text || '');
          } else showToast('Вы не можете редактировать этот комментарий');
        });
      }
      const editInfo = item.querySelector('.edit-info');
      if (editInfo) {
        const updated = await loadComment(key);
        editInfo.textContent = updated.lastEditedBy ? `✏️ ${updated.lastEditedBy}, ${updated.lastEditedAt}` : '';
      }
    }
  } catch (e) {}
}