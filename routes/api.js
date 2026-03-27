const express = require('express');
const db = require('../db');
const router = express.Router();

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'غير مصرح' });
    next();
}

// Reorder links (drag and drop)
router.post('/links/reorder', requireAuth, (req, res) => {
    const { order } = req.body; // array of link IDs in new order
    const userId = req.session.user.id;

    if (!Array.isArray(order)) {
        return res.status(400).json({ error: 'بيانات غير صالحة' });
    }

    const updateStmt = db.prepare('UPDATE links SET sort_order = ? WHERE id = ? AND merchant_id = ?');
    const transaction = db.transaction((items) => {
        items.forEach((id, index) => {
            updateStmt.run(index, id, userId);
        });
    });

    try {
        transaction(order);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// Update link inline
router.post('/links/update/:id', requireAuth, (req, res) => {
    const { title, url, icon, color } = req.body;
    const userId = req.session.user.id;

    db.prepare('UPDATE links SET title = ?, url = ?, icon = ?, color = ? WHERE id = ? AND merchant_id = ?')
        .run(title, url, icon, color, req.params.id, userId);

    res.json({ success: true });
});

module.exports = router;
