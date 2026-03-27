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

// Preview modal (mobile)
function openPreviewModal() {
    const modal = document.getElementById('preview-modal');
    const iframe = document.getElementById('preview-modal-iframe');
    iframe.src = iframe.src; // refresh
    modal.classList.add('show');
}

// Show settings section
function showSettings() {
    document.getElementById('links-section').classList.add('hidden');
    document.getElementById('settings-section').classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.target.closest('.nav-item').classList.add('active');
}

// Copy profile URL
function copyUrl() {
    const url = document.getElementById('profile-url').textContent;
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.querySelector('.btn-copy');
        btn.innerHTML = '<i class="fas fa-check"></i>';
        setTimeout(() => btn.innerHTML = '<i class="fas fa-copy"></i>', 2000);
    });
}

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
    document.getElementById('edit-selected-icon').value = link.icon;
    document.getElementById('edit-color').value = link.color;

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
        size: sizeRadio ? sizeRadio.value : 'full'
    };

    const res = await fetch(`/api/links/update/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res.ok) {
        location.reload();
    }
});

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('show');
        }
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

        // Save new order
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

    // Refresh preview
    const iframe = document.getElementById('preview-iframe');
    if (iframe) iframe.src = iframe.src;
}

// ========== Touch Drag Support (Mobile) ==========
let touchDragItem = null;
let touchStartY = 0;
let placeholder = null;

if (linksList) {
    linksList.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;

        touchDragItem = handle.closest('.link-card');
        touchStartY = e.touches[0].clientY;
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
