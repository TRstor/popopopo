// ========== Dashboard JS ==========

// Sidebar toggle (mobile)
function toggleSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebar-overlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('show');
    document.body.style.overflow = '';
}

// Section navigation
function showSection(sectionId, el) {
    event.preventDefault();
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');
    closeSidebar();
}

// Preview modal (mobile)
function openPreviewModal() {
    const modal = document.getElementById('preview-modal');
    const iframe = document.getElementById('preview-modal-iframe');
    iframe.src = iframe.src;
    modal.classList.add('show');
}

// Copy profile URL
function copyUrl() {
    const url = document.getElementById('profile-url').textContent;
    navigator.clipboard.writeText(url).then(() => {
        showToast('تم نسخ الرابط');
        const btn = document.querySelector('.btn-copy');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
}

// Toast notifications
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Show toast on page load if msg param
(function() {
    const params = new URLSearchParams(window.location.search);
    const msg = params.get('msg');
    const msgs = {
        saved: 'تم حفظ التغييرات',
        added: 'تم إضافة الرابط',
        deleted: 'تم حذف الرابط',
        duplicated: 'تم تكرار الرابط',
        section_added: 'تم إضافة القسم',
        ticket_sent: 'تم إرسال التذكرة'
    };
    if (msg && msgs[msg]) {
        setTimeout(() => showToast(msgs[msg]), 300);
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
    }
})();

// Modal functions
function openAddModal() {
    document.getElementById('add-modal').classList.add('show');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

function openEditModal(link) {
    document.getElementById('edit-id').value = link.id;
    document.getElementById('edit-title').value = link.title;
    document.getElementById('edit-url').value = link.url;
    document.getElementById('edit-description').value = link.description || '';
    document.getElementById('edit-selected-icon').value = link.icon;
    document.getElementById('edit-color').value = link.color || '#8B5CF6';

    // Set gradient
    const gradientSelect = document.getElementById('edit-gradient');
    if (gradientSelect) gradientSelect.value = link.gradient || '';

    // Set badge
    const badgeSelect = document.getElementById('edit-badge');
    if (badgeSelect) badgeSelect.value = link.badge || '';

    // Set border style
    const borderSelect = document.getElementById('edit-border-style');
    if (borderSelect) borderSelect.value = link.border_style || 'none';

    // Set show_icon & show_text
    const showIconSelect = document.getElementById('edit-show-icon');
    if (showIconSelect) showIconSelect.value = link.show_icon !== undefined ? String(link.show_icon) : '1';
    const showTextSelect = document.getElementById('edit-show-text');
    if (showTextSelect) showTextSelect.value = link.show_text !== undefined ? String(link.show_text) : '1';

    // Set countdown
    const countdownInput = document.getElementById('edit-countdown');
    if (countdownInput) countdownInput.value = link.countdown_date || '';

    // Set section
    const sectionSelect = document.getElementById('edit-section-id');
    if (sectionSelect) sectionSelect.value = String(link.section_id || 0);

    // Highlight selected icon
    document.querySelectorAll('#edit-icon-picker .icon-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.icon === link.icon);
    });

    // Set size radio
    const sizeVal = link.size || 'full';
    document.querySelectorAll('#edit-size-picker input[name="edit-size"]').forEach(radio => {
        radio.checked = (radio.value === sizeVal);
    });

    document.getElementById('edit-modal').classList.add('show');
}

// Icon picker
document.querySelectorAll('.icon-grid').forEach(grid => {
    grid.addEventListener('click', (e) => {
        const option = e.target.closest('.icon-option');
        if (!option) return;
        const picker = option.closest('.icon-picker');
        picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');
        const hiddenInput = picker.querySelector('input[type="hidden"]');
        hiddenInput.value = option.dataset.icon;
    });
});

// Preset colors
document.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
        const color = dot.dataset.color;
        const input = dot.closest('.color-row').querySelector('input[type="color"]');
        if (input) input.value = color;
    });
});

// Edit form submit
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const sizeRadio = document.querySelector('#edit-size-picker input[name="edit-size"]:checked');
    const data = {
        title: document.getElementById('edit-title').value,
        url: document.getElementById('edit-url').value,
        icon: document.getElementById('edit-selected-icon').value,
        color: document.getElementById('edit-color').value,
        size: sizeRadio ? sizeRadio.value : 'full',
        description: document.getElementById('edit-description').value || '',
        gradient: document.getElementById('edit-gradient').value || '',
        badge: document.getElementById('edit-badge').value || '',
        border_style: document.getElementById('edit-border-style').value || 'none',
        show_icon: parseInt(document.getElementById('edit-show-icon').value),
        show_text: parseInt(document.getElementById('edit-show-text').value),
        countdown_date: document.getElementById('edit-countdown').value || '',
        section_id: parseInt(document.getElementById('edit-section-id').value) || 0
    };
    const res = await fetch('/api/links/update/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (res.ok) {
        showToast('تم حفظ التعديلات');
        setTimeout(() => location.reload(), 500);
    }
});

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('show');
    });
});

// ========== Drag & Drop Reordering ==========
const linksList = document.getElementById('links-list');
let draggedItem = null;

if (linksList) {
    linksList.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.link-card');
        if (!card) return;
        draggedItem = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    linksList.addEventListener('dragend', (e) => {
        const card = e.target.closest('.link-card');
        if (card) card.classList.remove('dragging');
        document.querySelectorAll('.link-card').forEach(c => c.classList.remove('drag-over'));
        draggedItem = null;
        saveOrder();
    });
    linksList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const card = e.target.closest('.link-card');
        if (!card || card === draggedItem) return;
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        document.querySelectorAll('.link-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
        if (e.clientY < midY) {
            linksList.insertBefore(draggedItem, card);
        } else {
            linksList.insertBefore(draggedItem, card.nextSibling);
        }
    });
}

async function saveOrder() {
    const cards = document.querySelectorAll('.link-card');
    const order = Array.from(cards).map(c => parseInt(c.dataset.id));
    await fetch('/api/links/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
    });
    const iframe = document.getElementById('preview-iframe');
    if (iframe) iframe.src = iframe.src;
}

// ========== Touch Drag Support (Mobile) ==========
let touchDragItem = null;
if (linksList) {
    linksList.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        touchDragItem = handle.closest('.link-card');
        touchDragItem.classList.add('dragging');
    }, { passive: true });
    linksList.addEventListener('touchmove', (e) => {
        if (!touchDragItem) return;
        e.preventDefault();
        const touch = e.touches[0];
        const cards = Array.from(document.querySelectorAll('.link-card:not(.dragging)'));
        for (const card of cards) {
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (touch.clientY < midY) {
                linksList.insertBefore(touchDragItem, card);
                break;
            } else if (card === cards[cards.length - 1]) {
                linksList.insertBefore(touchDragItem, card.nextSibling);
            }
        }
    }, { passive: false });
    linksList.addEventListener('touchend', () => {
        if (!touchDragItem) return;
        touchDragItem.classList.remove('dragging');
        touchDragItem = null;
        saveOrder();
    });
}
