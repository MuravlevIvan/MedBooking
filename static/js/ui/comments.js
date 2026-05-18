// ===================== Редактирование комментариев (основная страница) =====================

let _mainEditingData = null;       // текущее активное редактирование
let _isClosing = false;            // флаг, чтобы избежать рекурсивных вызовов

/**
 * Включает режим редактирования для комментария.
 * @param {string} key – ключ слота "YYYY-MM-DD|HH"
 * @param {string} commentText – текущий текст комментария (может быть пустым)
 */
async function enterEditMode(key, commentText) {
    // Если сейчас закрываем другое редактирование – ждём
    if (_isClosing) {
        showToast('Пожалуйста, подождите...');
        return;
    }

    // Если уже редактируется другой комментарий – завершаем его с подтверждением
    if (_mainEditingData && _mainEditingData.key !== key) {
        _isClosing = true;
        const { textarea, originalText, cancelEdit, saveAndClose, div: oldCommentDiv } = _mainEditingData;
        const newText = textarea.value;
        let shouldClose = false;
        if (newText.trim() !== originalText.trim()) {
            const answer = confirm('Есть несохранённые изменения в другом комментарии. Сохранить?');
            if (answer) {
                await saveAndClose();   // дожидаемся завершения сохранения и закрытия
            } else {
                cancelEdit();           // синхронно
            }
        } else {
            cancelEdit();
        }
        // Убеждаемся, что старый DOM-элемент действительно закрыт
        _mainEditingData = null;
        _isClosing = false;
        // Даём браузеру время на перерисовку
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Если этот же комментарий уже редактируется – ничего не делаем
    if (_mainEditingData && _mainEditingData.key === key) return;

    // Находим элементы
    const bookingItem = document.getElementById(`booking-${key}`);
    if (!bookingItem) return;
    const commentDiv = bookingItem.querySelector('.booking-comment');
    if (!commentDiv) return;

    const canEditAttr = commentDiv.getAttribute('data-can-edit');
    if (canEditAttr === 'false') {
        showToast('Редактирование комментария доступно только для будущих слотов');
        return;
    }

    // Сохраняем исходное состояние
    const originalHtml = commentDiv.innerHTML;
    const currentText = commentText || '';

    // Создаём область редактирования
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

    // Функция отмены (восстанавливает исходный вид)
    const cancelEdit = () => {
        if (window._mainOutsideHandler) {
            document.removeEventListener('click', window._mainOutsideHandler);
            delete window._mainOutsideHandler;
        }
        commentDiv.innerHTML = originalHtml;
        commentDiv.setAttribute('data-can-edit', canEditAttr);
        // Перепривязываем обработчик клика
        commentDiv.removeEventListener('click', commentClickHandler);
        commentDiv.addEventListener('click', commentClickHandler);
        _mainEditingData = null;
        editingCommentKey = null;
        removeOutsideClickHandler(); // старый обработчик (для совместимости)
    };

    // Функция сохранения и закрытия
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
            const result = await apiFetch(`/api/comments/${date}/${hour}`, {
                method: 'PUT',
                body: JSON.stringify({ text: newText })
            });
            showToast(result.message || 'Комментарий сохранён');

            // Загружаем актуальные данные комментария
            const commentData = await loadComment(key);
            const displayText = commentData.text || '';
            const editInfo = commentData.lastEditedBy ? `✏️ ${commentData.lastEditedBy}, ${commentData.lastEditedAt}` : '';
            const owner = allBookings[key];
            const slotTime = new Date(date); slotTime.setHours(parseInt(hour), 0, 0, 0);
            const isPastSlot = slotTime < new Date();
            const canEditAfter = isAdminUser || (owner === currentUser && !isPastSlot);

            // Обновляем DOM – заменяем область редактирования на новый комментарий
            const newCommentHtml = `
                <div class="booking-comment ${!displayText ? 'empty' : ''}" data-key="${key}" data-owner="${owner}" data-can-edit="${canEditAfter}">
                    ${displayText ? escapeHtml(displayText) : '✏️ Кликните, чтобы добавить комментарий'}
                </div>
                <span class="edit-info">${editInfo}</span>
            `;
            // Находим родителя (это контейнер, в котором лежат коммент и edit-info)
            const parent = commentDiv.parentNode;
            parent.innerHTML = newCommentHtml;
            // Перепривязываем обработчик клика к новому комментарию
            const newCommentDiv = parent.querySelector('.booking-comment');
            if (newCommentDiv && newCommentDiv.getAttribute('data-can-edit') === 'true') {
                newCommentDiv.addEventListener('click', commentClickHandler);
            }
            // Обновляем edit-info, если нужно
            const newEditInfoSpan = parent.querySelector('.edit-info');
            if (newEditInfoSpan && editInfo) newEditInfoSpan.textContent = editInfo;

            // Удаляем глобальный обработчик клика вне
            if (window._mainOutsideHandler) {
                document.removeEventListener('click', window._mainOutsideHandler);
                delete window._mainOutsideHandler;
            }
        } catch (err) {
            showToast(err.message || 'Ошибка сохранения');
            // При ошибке не закрываем редактирование
            return;
        }
        _mainEditingData = null;
        editingCommentKey = null;
        removeOutsideClickHandler();
    };

    // Обработчик клика вне области редактирования
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

    // Привязываем обработчики кнопок
    saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveAndClose();
    });
    cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelEdit();
    });

    // Устанавливаем глобальный обработчик клика вне
    if (window._mainOutsideHandler) {
        document.removeEventListener('click', window._mainOutsideHandler);
    }
    window._mainOutsideHandler = outsideClickHandler;
    document.addEventListener('click', window._mainOutsideHandler);

    // Сохраняем данные текущего редактирования
    _mainEditingData = {
        key,
        cancelEdit,
        saveAndClose,
        textarea,
        originalText: currentText,
        div: commentDiv   // сохраняем ссылку на DOM-элемент
    };
    editingCommentKey = key;
    highlightedBookingKey = key;
    updateHighlightedBooking();
    renderMainContent();

    textarea.focus();
}

// Обработчик клика по комментарию
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

// Утилита для удаления глобального обработчика (для совместимости)
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

// Переопределяем старые функции для совместимости
const originalExitEditMode = window.exitEditMode || function() {};
const originalSaveComment = window.saveComment || function() {};

window.exitEditMode = function(key) {
    if (_mainEditingData && _mainEditingData.key === key) {
        _mainEditingData.cancelEdit();
    } else {
        originalExitEditMode(key);
    }
};

window.saveComment = async function(key, text) {
    const [date, hour] = key.split('|');
    try {
        const data = await apiFetch(`/api/comments/${date}/${hour}`, { method: 'PUT', body: JSON.stringify({ text }) });
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

// Экспортируем нужные функции глобально
window.enterEditMode = enterEditMode;
window.commentClickHandler = commentClickHandler;