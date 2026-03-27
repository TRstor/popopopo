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

module.exports = router;
