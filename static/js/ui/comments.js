// ===================== Редактирование комментариев (основная страница) =====================
let _mainEditingData = null;
let _isClosing = false;

async function enterEditMode(key, commentText) {
    if (_isClosing) {
        showToast('Пожалуйста, подождите...');
        return;
    }

    if (_mainEditingData && _mainEditingData.key !== key) {
        _isClosing = true;
        const { textarea, originalText, cancelEdit, saveAndClose } = _mainEditingData;
        const newText = textarea.value;
        if (newText.trim() !== originalText.trim()) {
            const answer = confirm('Есть несохранённые изменения в другом комментарии. Сохранить?');
            if (answer) {
                await saveAndClose();
            } else {
                cancelEdit();
            }
        } else {
            cancelEdit();
        }
        _mainEditingData = null;
        _isClosing = false;
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (_mainEditingData && _mainEditingData.key === key) return;

    const bookingItem = document.getElementById(`booking-${key}`);
    if (!bookingItem) return;
    const commentDiv = bookingItem.querySelector('.booking-comment');
    if (!commentDiv) return;

    const canEditAttr = commentDiv.getAttribute('data-can-edit');
    if (canEditAttr === 'false') {
        showToast('Редактирование комментария доступно только для будущих слотов');
        return;
    }

    const originalHtml = commentDiv.innerHTML;
    const currentText = commentText || '';

    const editArea = document.createElement('div');
    editArea.className = 'comment-edit-area';
    editArea.innerHTML = `
        <textarea class="comment-textarea" id="comment-text-${key}">${escapeHtml(currentText)}</textarea>
        <div class="comment-buttons">
            <button class="comment-save-btn" data-key="${key}">💾 Сохранить</button>
            <button class="comment-cancel-btn">❌ Отмена</button>
        </div>
    `;
    commentDiv.innerHTML = '';
    commentDiv.appendChild(editArea);
    const textarea = document.getElementById(`comment-text-${key}`);
    const saveBtn = editArea.querySelector('.comment-save-btn');
    const cancelBtn = editArea.querySelector('.comment-cancel-btn');

    const cancelEdit = () => {
        if (window._mainOutsideHandler) {
            document.removeEventListener('click', window._mainOutsideHandler);
            delete window._mainOutsideHandler;
        }
        commentDiv.innerHTML = originalHtml;
        commentDiv.setAttribute('data-can-edit', canEditAttr);
        commentDiv.removeEventListener('click', commentClickHandler);
        commentDiv.addEventListener('click', commentClickHandler);
        _mainEditingData = null;
        editingCommentKey = null;
        removeOutsideClickHandler();
    };

    const saveAndClose = async () => {
        const newText = textarea.value;
        if (newText.trim() === currentText.trim()) {
            cancelEdit();
            return;
        }

        const [date, hour] = key.split('|');
        if (!date || hour === undefined) {
            showToast('Ошибка: некорректный ключ слота');
            cancelEdit();
            return;
        }

        try {
            const result = await updateComment(date, hour, newText);
            showToast(result.message || 'Комментарий сохранён');

            const commentData = await loadComment(key);
            const displayText = commentData.text || '';
            const editInfo = commentData.lastEditedBy ? `✏️ ${commentData.lastEditedBy}, ${commentData.lastEditedAt}` : '';
            const owner = allBookings[key];
            const slotTime = new Date(date); slotTime.setHours(parseInt(hour), 0, 0, 0);
            const isPastSlot = slotTime < new Date();
            const canEditAfter = isAdminUser || (owner === currentUser && !isPastSlot);

            const parent = commentDiv.parentNode;
            parent.innerHTML = `
                <div class="booking-comment ${!displayText ? 'empty' : ''}" data-key="${key}" data-owner="${owner}" data-can-edit="${canEditAfter}">
                    ${displayText ? escapeHtml(displayText) : '✏️ Кликните, чтобы добавить комментарий'}
                </div>
                <span class="edit-info">${editInfo}</span>
            `;
            const newCommentDiv = parent.querySelector('.booking-comment');
            if (newCommentDiv && newCommentDiv.getAttribute('data-can-edit') === 'true') {
                newCommentDiv.addEventListener('click', commentClickHandler);
            }
            const newEditInfoSpan = parent.querySelector('.edit-info');
            if (newEditInfoSpan && editInfo) newEditInfoSpan.textContent = editInfo;

            if (window._mainOutsideHandler) {
                document.removeEventListener('click', window._mainOutsideHandler);
                delete window._mainOutsideHandler;
            }
        } catch (err) {
            showToast(err.message || 'Ошибка сохранения');
            return;
        }
        _mainEditingData = null;
        editingCommentKey = null;
        removeOutsideClickHandler();
    };

    const outsideClickHandler = (event) => {
        if (editArea && editArea.contains(event.target)) return;
        if (event.target.closest('.comment-save-btn') || event.target.closest('.comment-cancel-btn')) return;
        const newText = textarea.value;
        if (newText.trim() === currentText.trim()) {
            cancelEdit();
        } else {
            if (confirm('Комментарий не сохранён. Сохранить?')) {
                saveAndClose();
            } else {
                cancelEdit();
            }
        }
    };

    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveAndClose();
    });
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelEdit();
    });

    if (window._mainOutsideHandler) {
        document.removeEventListener('click', window._mainOutsideHandler);
    }
    window._mainOutsideHandler = outsideClickHandler;
    document.addEventListener('click', window._mainOutsideHandler);

    _mainEditingData = { key, cancelEdit, saveAndClose, textarea, originalText: currentText };
    editingCommentKey = key;
    highlightedBookingKey = key;
    updateHighlightedBooking();
    renderMainContent();

    textarea.focus();
}

function commentClickHandler(e) {
    e.stopPropagation();
    const commentDiv = e.currentTarget;
    const key = commentDiv.getAttribute('data-key');
    const canEdit = commentDiv.getAttribute('data-can-edit') === 'true';
    if (!canEdit) {
        showToast('Вы не можете редактировать этот комментарий');
        return;
    }
    let currentText = commentDiv.textContent.trim();
    if (currentText === '✏️ Кликните, чтобы добавить комментарий') currentText = '';
    enterEditMode(key, currentText);
}

function removeOutsideClickHandler() {
    if (window._mainOutsideHandler) {
        document.removeEventListener('click', window._mainOutsideHandler);
        delete window._mainOutsideHandler;
    }
    if (typeof outsideClickHandler !== 'undefined' && outsideClickHandler) {
        document.removeEventListener('click', outsideClickHandler);
        outsideClickHandler = null;
    }
}

window.exitEditMode = function(key) {
    if (_mainEditingData && _mainEditingData.key === key) {
        _mainEditingData.cancelEdit();
    }
};
window.saveComment = async function(key, text) {
    const [date, hour] = key.split('|');
    try {
        const data = await updateComment(date, hour, text);
        showToast(data.message || 'Комментарий сохранён');
        if (typeof renderBookingsList === 'function') {
            await renderBookingsList();
        }
        return data;
    } catch (e) {
        showToast(e.message || 'Ошибка сохранения');
        throw e;
    }
};
window.forceCloseEditing = function() {
    if (_mainEditingData) {
        _mainEditingData.cancelEdit();
        _mainEditingData = null;
    }
    removeOutsideClickHandler();
    editingCommentKey = null;
};
window.enterEditMode = enterEditMode;
window.commentClickHandler = commentClickHandler;