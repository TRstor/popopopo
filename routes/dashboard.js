const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}
router.use(requireAuth);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        if (!allowed.includes(ext)) return cb(new Error('نوع الملف غير مدعوم'));
        cb(null, `${uuidv4()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/', (req, res) => {
    const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(req.session.user.id);
    const links = db.prepare('SELECT * FROM links WHERE merchant_id = ? ORDER BY sort_order ASC').all(req.session.user.id);
    const sections = db.prepare('SELECT * FROM link_sections WHERE merchant_id = ? ORDER BY sort_order ASC').all(req.session.user.id);
    const profileUrl = `${req.protocol}://${req.get('host')}/${merchant.username}`;
    const viewCount = db.prepare('SELECT COUNT(*) as count FROM page_views WHERE merchant_id = ?').get(req.session.user.id).count;
    const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5').all();
    const myTickets = db.prepare('SELECT * FROM tickets WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 5').all(req.session.user.id);
    const filter = req.query.filter || 'all';
    res.render('dashboard', { merchant, links, sections, profileUrl, viewCount, notifications, myTickets, filter });
});

router.post('/settings', upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
    { name: 'bg_image', maxCount: 1 }
]), (req, res) => {
    const { store_name, store_desc, theme_color, theme_style, button_shape, font_family, font_size, card_style } = req.body;
    const userId = req.session.user.id;
    const allowedThemes = ['dark','light','blue','pink','emerald','sunset','ocean','rose','midnight','coffee','forest','lavender','cherry','arctic'];
    const allowedShapes = ['rounded','square','pill','circle'];
    const allowedFonts = ['Tajawal','Cairo','Almarai','Changa','Readex Pro','Noto Kufi Arabic'];
    const allowedSizes = ['small','medium','large'];
    const allowedCards = ['default','glass','flat','bordered','shadow'];
    const style = allowedThemes.includes(theme_style) ? theme_style : 'dark';
    const shape = allowedShapes.includes(button_shape) ? button_shape : 'rounded';
    const font = allowedFonts.includes(font_family) ? font_family : 'Tajawal';
    const size = allowedSizes.includes(font_size) ? font_size : 'medium';
    const card = allowedCards.includes(card_style) ? card_style : 'default';
    let query = 'UPDATE merchants SET store_name=?, store_desc=?, theme_color=?, theme_style=?, button_shape=?, font_family=?, font_size=?, card_style=?';
    let params = [store_name, store_desc||'', theme_color||'#8B5CF6', style, shape, font, size, card];
    if (req.files) {
        if (req.files.profile_image) { query += ', profile_image=?'; params.push('/uploads/' + req.files.profile_image[0].filename); }
        if (req.files.cover_image) { query += ', cover_image=?'; params.push('/uploads/' + req.files.cover_image[0].filename); }
        if (req.files.bg_image) { query += ', bg_image=?'; params.push('/uploads/' + req.files.bg_image[0].filename); }
    }
    query += ' WHERE id=?';
    params.push(userId);
    db.prepare(query).run(...params);
    req.session.user.store_name = store_name;
    req.session.user.theme_style = style;
    req.session.user.theme_color = theme_color || '#8B5CF6';
    req.session.user.button_shape = shape;
    req.session.user.font_family = font;
    req.session.user.font_size = size;
    req.session.user.card_style = card;
    res.redirect('/dashboard?msg=saved');
});

router.post('/links/add', (req, res) => {
    const { title, url, icon, color, size, description, badge, show_icon, show_text, border_style, gradient, countdown_date, section_id } = req.body;
    const userId = req.session.user.id;
    const allowedSizes = ['full','half','third'];
    const linkSize = allowedSizes.includes(size) ? size : 'full';
    const max = db.prepare('SELECT COALESCE(MAX(sort_order),0) as max_order FROM links WHERE merchant_id=?').get(userId);
    db.prepare('INSERT INTO links (merchant_id,title,url,icon,color,size,description,badge,show_icon,show_text,border_style,gradient,countdown_date,section_id,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(userId, title, url, icon||'fas fa-link', color||'#8B5CF6', linkSize, description||'', badge||'', show_icon==='0'?0:1, show_text==='0'?0:1, border_style||'none', gradient||'', countdown_date||'', parseInt(section_id)||0, max.max_order+1);
    res.redirect('/dashboard?msg=added');
});

router.post('/links/duplicate/:id', (req, res) => {
    const link = db.prepare('SELECT * FROM links WHERE id=? AND merchant_id=?').get(req.params.id, req.session.user.id);
    if (link) {
        const max = db.prepare('SELECT COALESCE(MAX(sort_order),0) as max_order FROM links WHERE merchant_id=?').get(req.session.user.id);
        db.prepare('INSERT INTO links (merchant_id,title,url,icon,color,size,description,badge,show_icon,show_text,border_style,gradient,countdown_date,section_id,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
          .run(link.merchant_id, link.title+' (نسخة)', link.url, link.icon, link.color, link.size, link.description, link.badge, link.show_icon, link.show_text, link.border_style, link.gradient, link.countdown_date, link.section_id, max.max_order+1);
    }
    res.redirect('/dashboard?msg=duplicated');
});

router.post('/links/delete/:id', (req, res) => {
    db.prepare('DELETE FROM links WHERE id=? AND merchant_id=?').run(req.params.id, req.session.user.id);
    res.redirect('/dashboard?msg=deleted');
});

router.post('/links/toggle/:id', (req, res) => {
    db.prepare('UPDATE links SET is_active = CASE WHEN is_active=1 THEN 0 ELSE 1 END WHERE id=? AND merchant_id=?').run(req.params.id, req.session.user.id);
    res.redirect('/dashboard');
});

router.post('/sections/add', (req, res) => {
    const { title } = req.body;
    const userId = req.session.user.id;
    const max = db.prepare('SELECT COALESCE(MAX(sort_order),0) as max_order FROM link_sections WHERE merchant_id=?').get(userId);
    db.prepare('INSERT INTO link_sections (merchant_id,title,sort_order) VALUES (?,?,?)').run(userId, title, max.max_order+1);
    res.redirect('/dashboard?msg=section_added');
});

router.post('/sections/delete/:id', (req, res) => {
    db.prepare('UPDATE links SET section_id=0 WHERE section_id=? AND merchant_id=?').run(req.params.id, req.session.user.id);
    db.prepare('DELETE FROM link_sections WHERE id=? AND merchant_id=?').run(req.params.id, req.session.user.id);
    res.redirect('/dashboard');
});

router.post('/tickets/submit', (req, res) => {
    const { subject, message } = req.body;
    if (subject && message) {
        db.prepare('INSERT INTO tickets (merchant_id,subject,message) VALUES (?,?,?)').run(req.session.user.id, subject, message);
    }
    res.redirect('/dashboard?msg=ticket_sent');
});

module.exports = router;
