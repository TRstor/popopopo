const express = require('express');
const db = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'غير مصرح' });
    next();
}

router.post('/links/reorder', requireAuth, (req, res) => {
    const { order } = req.body;
    const userId = req.session.user.id;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    const updateStmt = db.prepare('UPDATE links SET sort_order = ? WHERE id = ? AND merchant_id = ?');
    const transaction = db.transaction((items) => {
        items.forEach((id, index) => { updateStmt.run(index, id, userId); });
    });
    try { transaction(order); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: 'حدث خطأ' }); }
});

router.post('/links/update/:id', requireAuth, (req, res) => {
    const { title, url, icon, color, size, description, badge, show_icon, show_text, border_style, gradient, countdown_date, section_id } = req.body;
    const userId = req.session.user.id;
    const allowedSizes = ['full','half','third'];
    const linkSize = allowedSizes.includes(size) ? size : 'full';
    const si = (show_icon === 0 || show_icon === '0') ? 0 : 1;
    const st = (show_text === 0 || show_text === '0') ? 0 : 1;
    db.prepare('UPDATE links SET title=?, url=?, icon=?, color=?, size=?, description=?, badge=?, show_icon=?, show_text=?, border_style=?, gradient=?, countdown_date=?, section_id=? WHERE id=? AND merchant_id=?')
      .run(title, url, icon, color, linkSize, description||'', badge||'', si, st, border_style||'none', gradient||'', countdown_date||'', parseInt(section_id)||0, req.params.id, userId);
    res.json({ success: true });
});

// Track link click
router.post('/links/click/:id', (req, res) => {
    try {
        db.prepare('UPDATE links SET click_count = click_count + 1 WHERE id = ?').run(req.params.id);
    } catch(e) {}
    res.json({ success: true });
});

// Apply design preset (theme + settings + demo links)
router.post('/preset/apply', requireAuth, (req, res) => {
    const { preset } = req.body;
    const userId = req.session.user.id;
    if (![1,2,3,4].includes(Number(preset))) return res.status(400).json({ error: 'تصميم غير صالح' });

    const presets = {
        1: {
            theme_style: 'dark', button_shape: 'rounded', card_style: 'default',
            font_family: 'Tajawal', font_size: 'medium', theme_color: '#8B5CF6',
            links: [
                { title: 'واتساب', url: 'https://wa.me/', icon: 'fab fa-whatsapp', color: '#25D366', size: 'full', gradient: '' },
                { title: 'انستقرام', url: 'https://instagram.com/', icon: 'fab fa-instagram', color: '#E1306C', size: 'half', gradient: '' },
                { title: 'تويتر', url: 'https://x.com/', icon: 'fab fa-x-twitter', color: '#1DA1F2', size: 'half', gradient: '' },
                { title: 'المتجر', url: 'https://', icon: 'fas fa-store', color: '#8B5CF6', size: 'full', gradient: 'linear-gradient(135deg,#8B5CF6,#6D28D9)' },
                { title: 'تيك توك', url: 'https://tiktok.com/', icon: 'fab fa-tiktok', color: '#111', size: 'full', gradient: '' },
            ]
        },
        2: {
            theme_style: 'light', button_shape: 'pill', card_style: 'glass',
            font_family: 'Cairo', font_size: 'medium', theme_color: '#3b82f6',
            links: [
                { title: 'الموقع الرسمي', url: 'https://', icon: 'fas fa-globe', color: '#3b82f6', size: 'full', gradient: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
                { title: 'واتساب', url: 'https://wa.me/', icon: 'fab fa-whatsapp', color: '#10b981', size: 'full', gradient: '' },
                { title: 'انستقرام', url: 'https://instagram.com/', icon: 'fab fa-instagram', color: '#ec4899', size: 'full', gradient: '' },
                { title: 'موقعنا', url: 'https://', icon: 'fas fa-map-marker-alt', color: '#f59e0b', size: 'full', gradient: '' },
                { title: 'اتصل بنا', url: 'tel:', icon: 'fas fa-phone', color: '#3b82f6', size: 'full', gradient: '' },
            ]
        },
        3: {
            theme_style: 'ocean', button_shape: 'square', card_style: 'shadow',
            font_family: 'Almarai', font_size: 'large', theme_color: '#06b6d4',
            links: [
                { title: 'تسوق الآن', url: 'https://', icon: 'fas fa-shopping-cart', color: '#06b6d4', size: 'full', gradient: 'linear-gradient(135deg,#06b6d4,#0284c7)' },
                { title: 'واتساب', url: 'https://wa.me/', icon: 'fab fa-whatsapp', color: '#0ea5e9', size: 'half', gradient: '' },
                { title: 'تيليجرام', url: 'https://t.me/', icon: 'fab fa-telegram-plane', color: '#22d3ee', size: 'half', gradient: '' },
                { title: 'يوتيوب', url: 'https://youtube.com/', icon: 'fab fa-youtube', color: '#0284c7', size: 'full', gradient: '' },
                { title: 'البريد', url: 'mailto:', icon: 'fas fa-envelope', color: '#67e8f9', size: 'full', gradient: '' },
            ]
        },
        4: {
            theme_style: 'sunset', button_shape: 'circle', card_style: 'bordered',
            font_family: 'Changa', font_size: 'large', theme_color: '#f59e0b',
            links: [
                { title: 'سناب شات', url: 'https://snapchat.com/', icon: 'fab fa-snapchat-ghost', color: '#f59e0b', size: 'third', gradient: '' },
                { title: 'انستقرام', url: 'https://instagram.com/', icon: 'fab fa-instagram', color: '#ef4444', size: 'third', gradient: '' },
                { title: 'تيك توك', url: 'https://tiktok.com/', icon: 'fab fa-tiktok', color: '#f97316', size: 'third', gradient: '' },
                { title: 'تسوق الآن', url: 'https://', icon: 'fas fa-store', color: '#fbbf24', size: 'full', gradient: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
                { title: 'واتساب', url: 'https://wa.me/', icon: 'fab fa-whatsapp', color: '#f59e0b', size: 'full', gradient: '' },
            ]
        }
    };

    const p = presets[Number(preset)];
    if (!p) return res.status(400).json({ error: 'تصميم غير صالح' });

    const applyTransaction = db.transaction(() => {
        // Update merchant settings
        db.prepare('UPDATE merchants SET theme_style=?, button_shape=?, card_style=?, font_family=?, font_size=?, theme_color=? WHERE id=?')
          .run(p.theme_style, p.button_shape, p.card_style, p.font_family, p.font_size, p.theme_color, userId);

        // Delete existing links
        db.prepare('DELETE FROM links WHERE merchant_id=?').run(userId);

        // Insert preset links
        const insertLink = db.prepare('INSERT INTO links (merchant_id,title,url,icon,color,size,description,badge,show_icon,show_text,border_style,gradient,countdown_date,section_id,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        p.links.forEach((link, i) => {
            insertLink.run(userId, link.title, link.url, link.icon, link.color, link.size, '', '', 1, 1, 'none', link.gradient, '', 0, i);
        });
    });

    try {
        applyTransaction();
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

module.exports = router;
