const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const router = express.Router();

// Auth middleware
function requireAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

router.use(requireAuth);

// Multer config for profile images
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!allowed.includes(ext)) {
            return cb(new Error('نوع الملف غير مدعوم'));
        }
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 2 * 1024 * 1024 } });

// Dashboard main page
router.get('/', (req, res) => {
    const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(req.session.user.id);
    const links = db.prepare('SELECT * FROM links WHERE merchant_id = ? ORDER BY sort_order ASC').all(req.session.user.id);
    const profileUrl = `${req.protocol}://${req.get('host')}/${merchant.username}`;

    res.render('dashboard', { merchant, links, profileUrl });
});

// Update profile settings
router.post('/settings', upload.single('profile_image'), (req, res) => {
    const { store_name, store_desc, theme_color } = req.body;
    const userId = req.session.user.id;

    let query = 'UPDATE merchants SET store_name = ?, store_desc = ?, theme_color = ?';
    let params = [store_name, store_desc || '', theme_color || '#8B5CF6'];

    if (req.file) {
        query += ', profile_image = ?';
        params.push(`/uploads/${req.file.filename}`);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    db.prepare(query).run(...params);
    req.session.user.store_name = store_name;

    res.redirect('/dashboard');
});

// Add new link
router.post('/links/add', (req, res) => {
    const { title, url, icon, color } = req.body;
    const userId = req.session.user.id;

    // Get max sort_order
    const max = db.prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM links WHERE merchant_id = ?').get(userId);

    db.prepare(
        'INSERT INTO links (merchant_id, title, url, icon, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, title, url, icon || 'fas fa-link', color || '#8B5CF6', max.max_order + 1);

    res.redirect('/dashboard');
});

// Delete link
router.post('/links/delete/:id', (req, res) => {
    db.prepare('DELETE FROM links WHERE id = ? AND merchant_id = ?').run(req.params.id, req.session.user.id);
    res.redirect('/dashboard');
});

// Toggle link active
router.post('/links/toggle/:id', (req, res) => {
    db.prepare('UPDATE links SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ? AND merchant_id = ?')
        .run(req.params.id, req.session.user.id);
    res.redirect('/dashboard');
});

module.exports = router;
