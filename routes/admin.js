const express = require('express');
const db = require('../db');
const bcrypt = require('bcryptjs');
const os = require('os');
const router = express.Router();

function requireAdmin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    const merchant = db.prepare('SELECT is_admin FROM merchants WHERE id = ?').get(req.session.user.id);
    if (!merchant || !merchant.is_admin) return res.status(403).render('404');
    next();
}
router.use(requireAdmin);

// Admin dashboard
router.get('/', (req, res) => {
    const stats = {
        totalMerchants: db.prepare('SELECT COUNT(*) as c FROM merchants').get().c,
        totalLinks: db.prepare('SELECT COUNT(*) as c FROM links').get().c,
        totalViews: db.prepare('SELECT COUNT(*) as c FROM page_views').get().c,
        openTickets: db.prepare("SELECT COUNT(*) as c FROM tickets WHERE status = 'open'").get().c
    };
    res.render('admin/index', { stats });
});

// All merchants
router.get('/merchants', (req, res) => {
    const search = req.query.q || '';
    let merchants;
    if (search) {
        merchants = db.prepare("SELECT * FROM merchants WHERE store_name LIKE ? OR username LIKE ? OR email LIKE ? ORDER BY created_at DESC")
            .all(`%${search}%`, `%${search}%`, `%${search}%`);
    } else {
        merchants = db.prepare('SELECT * FROM merchants ORDER BY created_at DESC').all();
    }
    res.render('admin/merchants', { merchants, search });
});

// Ban/unban
router.post('/merchants/:id/ban', (req, res) => {
    db.prepare('UPDATE merchants SET is_banned = 1 WHERE id = ?').run(req.params.id);
    res.redirect('/admin/merchants');
});
router.post('/merchants/:id/unban', (req, res) => {
    db.prepare('UPDATE merchants SET is_banned = 0 WHERE id = ?').run(req.params.id);
    res.redirect('/admin/merchants');
});

// Verify/unverify
router.post('/merchants/:id/verify', (req, res) => {
    db.prepare('UPDATE merchants SET is_verified = 1 WHERE id = ?').run(req.params.id);
    res.redirect('/admin/merchants');
});
router.post('/merchants/:id/unverify', (req, res) => {
    db.prepare('UPDATE merchants SET is_verified = 0 WHERE id = ?').run(req.params.id);
    res.redirect('/admin/merchants');
});

// Delete merchant (cannot delete admin)
router.post('/merchants/:id/delete', (req, res) => {
    const merchant = db.prepare('SELECT is_admin FROM merchants WHERE id = ?').get(req.params.id);
    if (merchant && merchant.is_admin) return res.redirect('/admin/merchants');
    const mid = req.params.id;
    db.prepare('DELETE FROM links WHERE merchant_id = ?').run(mid);
    db.prepare('DELETE FROM products WHERE merchant_id = ?').run(mid);
    db.prepare('DELETE FROM link_sections WHERE merchant_id = ?').run(mid);
    db.prepare('DELETE FROM page_views WHERE merchant_id = ?').run(mid);
    db.prepare('DELETE FROM tickets WHERE merchant_id = ?').run(mid);
    db.prepare('DELETE FROM merchants WHERE id = ?').run(mid);
    res.redirect('/admin/merchants');
});

// Edit merchant
router.post('/merchants/:id/edit', (req, res) => {
    const { store_name, email, username, password } = req.body;
    const mid = req.params.id;
    const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(mid);
    if (!merchant) return res.redirect('/admin/merchants');

    let query = 'UPDATE merchants SET store_name=?, email=?, username=?';
    let params = [store_name || merchant.store_name, email || merchant.email, (username || merchant.username).toLowerCase()];

    if (password && password.trim()) {
        query += ', password=?';
        params.push(bcrypt.hashSync(password, 10));
    }
    query += ' WHERE id=?';
    params.push(mid);
    try {
        db.prepare(query).run(...params);
    } catch(e) {}
    res.redirect('/admin/merchants');
});

// View merchant details (links, products, stats)
router.get('/merchants/:id/view', (req, res) => {
    const mid = req.params.id;
    const merchant = db.prepare('SELECT * FROM merchants WHERE id = ?').get(mid);
    if (!merchant) return res.redirect('/admin/merchants');

    const links = db.prepare('SELECT * FROM links WHERE merchant_id = ? ORDER BY sort_order ASC').all(mid);
    const products = db.prepare('SELECT * FROM products WHERE merchant_id = ? ORDER BY sort_order ASC').all(mid);
    const totalViews = db.prepare('SELECT COUNT(*) as c FROM page_views WHERE merchant_id = ?').get(mid).c;
    const totalClicks = db.prepare('SELECT COALESCE(SUM(click_count),0) as c FROM links WHERE merchant_id = ?').get(mid).c;
    const viewsToday = db.prepare("SELECT COUNT(*) as c FROM page_views WHERE merchant_id = ? AND date(created_at) = date('now')").get(mid).c;
    const viewsWeek = db.prepare("SELECT COUNT(*) as c FROM page_views WHERE merchant_id = ? AND created_at >= datetime('now','-7 days')").get(mid).c;
    const viewsMonth = db.prepare("SELECT COUNT(*) as c FROM page_views WHERE merchant_id = ? AND created_at >= datetime('now','-30 days')").get(mid).c;

    res.render('admin/merchant-view', {
        merchant, links, products,
        stats: { totalViews, totalClicks, viewsToday, viewsWeek, viewsMonth }
    });
});

// Tickets
router.get('/tickets', (req, res) => {
    const tickets = db.prepare(`
        SELECT t.*, m.store_name, m.username 
        FROM tickets t JOIN merchants m ON t.merchant_id = m.id 
        ORDER BY CASE WHEN t.status = 'open' THEN 0 ELSE 1 END, t.created_at DESC
    `).all();
    res.render('admin/tickets', { tickets });
});

router.post('/tickets/:id/reply', (req, res) => {
    const { reply } = req.body;
    if (reply) {
        db.prepare("UPDATE tickets SET admin_reply = ?, status = 'replied', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
            .run(reply, req.params.id);
    }
    res.redirect('/admin/tickets');
});

router.post('/tickets/:id/close', (req, res) => {
    db.prepare("UPDATE tickets SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    res.redirect('/admin/tickets');
});

// Notifications
router.get('/notifications', (req, res) => {
    const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all();
    res.render('admin/notifications', { notifications });
});

router.post('/notifications/send', (req, res) => {
    const { title, message } = req.body;
    if (title && message) {
        db.prepare('INSERT INTO notifications (title, message) VALUES (?, ?)').run(title, message);
    }
    res.redirect('/admin/notifications');
});

router.post('/notifications/:id/delete', (req, res) => {
    db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
    res.redirect('/admin/notifications');
});

// Service status
router.get('/status', (req, res) => {
    const uptimeSec = process.uptime();
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const mem = process.memoryUsage();
    const status = {
        uptime: h + ' ساعة ' + m + ' دقيقة',
        memory: Math.round(mem.rss / 1024 / 1024) + ' MB',
        nodeVersion: process.version,
        platform: os.platform() + ' ' + os.arch()
    };
    res.render('admin/status', { status });
});

module.exports = router;
