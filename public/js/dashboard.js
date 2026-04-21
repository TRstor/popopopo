// ========== Dashboard JS ==========

// Preset data for previews
const presetPreviews = {
    1: {
        name: 'كلاسيكي',
        theme: 'dark', bg: '#0a0a0a', text: '#fff',
        shape: 'rounded', font: 'Tajawal',
        links: [
            { title: 'واتساب', icon: 'fab fa-whatsapp', color: '#25D366', size: 'full' },
            { title: 'انستقرام', icon: 'fab fa-instagram', color: '#E1306C', size: 'half' },
            { title: 'تويتر', icon: 'fab fa-x-twitter', color: '#1DA1F2', size: 'half' },
            { title: 'المتجر', icon: 'fas fa-store', color: '#8B5CF6', size: 'full', gradient: 'linear-gradient(135deg,#8B5CF6,#6D28D9)' },
            { title: 'تيك توك', icon: 'fab fa-tiktok', color: '#111', size: 'full' },
        ]
    },
    2: {
        name: 'عصري',
        theme: 'light', bg: '#f5f5f7', text: '#1a1a2e',
        shape: 'pill', font: 'Cairo',
        links: [
            { title: 'الموقع الرسمي', icon: 'fas fa-globe', color: '#3b82f6', size: 'full', gradient: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
            { title: 'واتساب', icon: 'fab fa-whatsapp', color: '#10b981', size: 'full' },
            { title: 'انستقرام', icon: 'fab fa-instagram', color: '#ec4899', size: 'full' },
            { title: 'موقعنا', icon: 'fas fa-map-marker-alt', color: '#f59e0b', size: 'full' },
            { title: 'اتصل بنا', icon: 'fas fa-phone', color: '#3b82f6', size: 'full' },
        ]
    },
    3: {
        name: 'أنيق',
        theme: 'ocean', bg: 'linear-gradient(135deg,#0c4a6e,#164e63)', text: '#e0f2fe',
        shape: 'square', font: 'Almarai',
        links: [
            { title: 'تسوق الآن', icon: 'fas fa-shopping-cart', color: '#06b6d4', size: 'full', gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)' },
            { title: 'واتساب', icon: 'fab fa-whatsapp', color: '#0ea5e9', size: 'half' },
            { title: 'تيليجرام', icon: 'fab fa-telegram-plane', color: '#22d3ee', size: 'half' },
            { title: 'يوتيوب', icon: 'fab fa-youtube', color: '#0284c7', size: 'full' },
            { title: 'البريد', icon: 'fas fa-envelope', color: '#67e8f9', size: 'full' },
        ]
    },
    4: {
        name: 'نيون',
        theme: 'midnight', bg: '#0f172a', text: '#e2e8f0',
        shape: 'pill', font: 'Changa',
        links: [
            { title: 'انستقرام', icon: 'fab fa-instagram', color: '#ec4899', size: 'full', gradient: 'linear-gradient(135deg,#ec4899,#8B5CF6)' },
            { title: 'تيك توك', icon: 'fab fa-tiktok', color: '#22d3ee', size: 'half' },
            { title: 'سناب شات', icon: 'fab fa-snapchat-ghost', color: '#a3e635', size: 'half' },
            { title: 'واتساب', icon: 'fab fa-whatsapp', color: '#10b981', size: 'full', gradient: 'linear-gradient(135deg,#10b981,#22d3ee)' },
            { title: 'المتجر', icon: 'fas fa-store', color: '#8B5CF6', size: 'full' },
        ]
    }
};

// Apply preset: calls API to set theme + create links, then reloads
async function applyPreset(presetNum, el) {
    if (!confirm('سيتم تطبيق التصميم وإضافة أزرار جاهزة. الروابط الحالية ستُستبدل. متأكد؟')) return;

    document.querySelectorAll('.design-preset').forEach(p => p.classList.remove('active'));
    if (el) el.classList.add('active');

    showToast('جاري تطبيق التصميم...');
    try {
        const res = await fetch('/api/preset/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.csrfToken },
            body: JSON.stringify({ preset: presetNum })
        });
        if (res.ok) {
            showToast('تم تطبيق التصميم بنجاح!');
            setTimeout(() => location.reload(), 600);
        } else {
            showToast('حدث خطأ في تطبيق التصميم');
        }
    } catch(e) {
        showToast('حدث خطأ في الاتصال');
    }
}

// Preview preset in modal
function previewPreset(presetNum) {
    const p = presetPreviews[presetNum];
    if (!p) return;

    const shapeRadius = { rounded: '12px', pill: '50px', square: '4px', circle: '50%' };
    const radius = shapeRadius[p.shape] || '12px';

    let linksHtml = '';
    let i = 0;
    while (i < p.links.length) {
        const link = p.links[i];
        if (link.size === 'half' && p.links[i+1] && p.links[i+1].size === 'half') {
            linksHtml += '<div style="display:flex;gap:8px">';
            [p.links[i], p.links[i+1]].forEach(l => {
                const bg = l.gradient || l.color;
                linksHtml += `<div style="flex:1;padding:12px;border-radius:${radius};background:${bg};color:#fff;text-align:center;font-family:${p.font},sans-serif;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px"><i class="${l.icon}"></i> ${l.title}</div>`;
            });
            linksHtml += '</div>';
            i += 2;
        } else if (link.size === 'third' && p.links[i+1] && p.links[i+1].size === 'third' && p.links[i+2] && p.links[i+2].size === 'third') {
            linksHtml += '<div style="display:flex;gap:8px">';
            [p.links[i], p.links[i+1], p.links[i+2]].forEach(l => {
                const bg = l.gradient || l.color;
                linksHtml += `<div style="flex:1;padding:12px 6px;border-radius:${radius};background:${bg};color:#fff;text-align:center;font-size:20px;display:flex;align-items:center;justify-content:center"><i class="${l.icon}"></i></div>`;
            });
            linksHtml += '</div>';
            i += 3;
        } else {
            const bg = link.gradient || link.color;
            linksHtml += `<div style="padding:14px;border-radius:${radius};background:${bg};color:#fff;text-align:center;font-family:${p.font},sans-serif;font-size:14px;display:flex;align-items:center;justify-content:center;gap:8px"><i class="${link.icon}"></i> ${link.title}</div>`;
            i++;
        }
    }

    const body = document.getElementById('preset-preview-body');
    body.innerHTML = `
        <div class="preset-phone" style="background:${p.bg};color:${p.text};font-family:${p.font},sans-serif">
            <div style="text-align:center;padding:24px 16px 16px">
                <div style="width:60px;height:60px;border-radius:50%;background:${p.links[0].color};margin:0 auto 10px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff"><i class="fas fa-store"></i></div>
                <h3 style="font-size:18px;margin-bottom:4px">اسم المتجر</h3>
                <p style="font-size:12px;opacity:0.6">وصف المتجر</p>
            </div>
            <div style="padding:0 16px 24px;display:flex;flex-direction:column;gap:8px">
                ${linksHtml}
            </div>
        </div>
    `;

    // Set apply button
    const applyBtn = document.getElementById('preset-apply-btn');
    applyBtn.onclick = () => {
        closeModal('preset-preview-modal');
        applyPreset(presetNum, document.querySelector('.design-preset[data-preset="'+presetNum+'"]'));
    };

    document.getElementById('preset-preview-modal').classList.add('show');
}

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
        ticket_sent: 'تم إرسال التذكرة',
        product_added: 'تم إضافة المنتج',
        product_saved: 'تم حفظ المنتج',
        product_deleted: 'تم حذف المنتج',
        product_toggled: 'تم تحديث حالة المنتج',
        file_too_large: 'حجم الملف كبير جداً — الحد الأقصى 700 كيلوبايت',
        unsupported_type: 'نوع الملف غير مدعوم',
        upload_error: 'فشل رفع الملف — حاول مرة أخرى',
        error: 'حدث خطأ — حاول مرة أخرى'
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
        countdown_date: document.getElementById('edit-countdown').value || ''
    };
    const res = await fetch('/api/links/update/' + id, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.csrfToken },
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
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.csrfToken },
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

// ========== Products ==========

// Open modal helper
function openModal(id) {
    document.getElementById(id).classList.add('show');
}

// Edit product modal
function openEditProductModal(product) {
    document.getElementById('ep-title').value = product.title;
    document.getElementById('ep-description').value = product.description || '';
    document.getElementById('ep-price').value = product.price || 0;
    document.getElementById('ep-old-price').value = product.old_price || '';
    document.getElementById('ep-salla-url').value = product.salla_url || '';
    document.getElementById('ep-category').value = product.category || '';
    // Rebuild widget code from stored fields
    let widgetCode = '';
    if (product.salla_store_id && product.salla_product_id) {
        widgetCode = `<salla-mini-checkout-widget\n  store-id="${product.salla_store_id}"\n  products="[${product.salla_product_id}]"\n  language="ar"\n  label="${product.salla_label || 'اشتري الآن'}"\n></salla-mini-checkout-widget>`;
    }
    document.getElementById('ep-salla-widget').value = widgetCode;
    document.getElementById('edit-product-form').action = '/dashboard/products/edit/' + product.id;
    document.getElementById('edit-product-modal').classList.add('show');
}

// Product drag & drop reordering
const productsList = document.getElementById('products-list');
let draggedProduct = null;

if (productsList) {
    productsList.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.product-card');
        if (!card) return;
        draggedProduct = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });
    productsList.addEventListener('dragend', (e) => {
        const card = e.target.closest('.product-card');
        if (card) card.classList.remove('dragging');
        document.querySelectorAll('.product-card').forEach(c => c.classList.remove('drag-over'));
        draggedProduct = null;
        saveProductOrder();
    });
    productsList.addEventListener('dragover', (e) => {
        e.preventDefault();
        const card = e.target.closest('.product-card');
        if (!card || card === draggedProduct) return;
        const rect = card.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        document.querySelectorAll('.product-card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
        if (e.clientY < midY) {
            productsList.insertBefore(draggedProduct, card);
        } else {
            productsList.insertBefore(draggedProduct, card.nextSibling);
        }
    });

    // Touch support
    let touchDragProduct = null;
    productsList.addEventListener('touchstart', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        touchDragProduct = handle.closest('.product-card');
        if (touchDragProduct) touchDragProduct.classList.add('dragging');
    }, { passive: true });
    productsList.addEventListener('touchmove', (e) => {
        if (!touchDragProduct) return;
        e.preventDefault();
        const touch = e.touches[0];
        const cards = Array.from(document.querySelectorAll('.product-card:not(.dragging)'));
        for (const card of cards) {
            const rect = card.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (touch.clientY < midY) {
                productsList.insertBefore(touchDragProduct, card);
                break;
            } else if (card === cards[cards.length - 1]) {
                productsList.insertBefore(touchDragProduct, card.nextSibling);
            }
        }
    }, { passive: false });
    productsList.addEventListener('touchend', () => {
        if (!touchDragProduct) return;
        touchDragProduct.classList.remove('dragging');
        touchDragProduct = null;
        saveProductOrder();
    });
}

async function saveProductOrder() {
    const cards = document.querySelectorAll('.product-card');
    const order = Array.from(cards).map(c => parseInt(c.dataset.id));
    await fetch('/api/products/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.csrfToken },
        body: JSON.stringify({ order })
    });
    const iframe = document.getElementById('preview-iframe');
    if (iframe) iframe.src = iframe.src;
}
