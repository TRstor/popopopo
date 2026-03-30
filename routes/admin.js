const express = require('express');
const db = require('../db');
const bcrypt = require('bcryptjs');
const os = require('os');
const router = express.Router();

async function requireAdmin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    try {
        const merchant = await db.getMerchantById(req.session.user.id);
        if (!merchant || !merchant.is_admin) return res.status(403).render('404');
        next();
    } catch (err) {
        return res.status(403).render('404');
    }
}
router.use(requireAdmin);

// Admin dashboard
router.get('/', async (req, res) => {
    try {
        const [totalMerchants, totalLinks, totalViews, openTickets] = await Promise.all([
            db.countMerchants(),
            db.countLinks(),
            db.countAllPageViews(),
            db.countOpenTickets()
        ]);
        const stats = { totalMerchants, totalLinks, totalViews, openTickets };
        res.render('admin/index', { stats });
    } catch (err) {
        console.error(err);
        res.render('admin/index', { stats: { totalMerchants: 0, totalLinks: 0, totalViews: 0, openTickets: 0 } });
    }
});

// All merchants
router.get('/merchants', async (req, res) => {
    try {
        const search = req.query.q || '';
        let merchants;
        if (search) {
            merchants = await db.searchMerchants(search);
        } else {
            merchants = await db.getAllMerchants();
        }
        res.render('admin/merchants', { merchants, search });
    } catch (err) {
        console.error(err);
        res.render('admin/merchants', { merchants: [], search: '' });
    }
});

// Ban/unban
router.post('/merchants/:id/ban', async (req, res) => {
    await db.updateMerchant(req.params.id, { is_banned: 1 });
    res.redirect('/admin/merchants');
});
router.post('/merchants/:id/unban', async (req, res) => {
    await db.updateMerchant(req.params.id, { is_banned: 0 });
    res.redirect('/admin/merchants');
});

// Verify/unverify
router.post('/merchants/:id/verify', async (req, res) => {
    await db.updateMerchant(req.params.id, { is_verified: 1 });
    res.redirect('/admin/merchants');
});
router.post('/merchants/:id/unverify', async (req, res) => {
    await db.updateMerchant(req.params.id, { is_verified: 0 });
    res.redirect('/admin/merchants');
});

// Delete merchant (cannot delete admin)
router.post('/merchants/:id/delete', async (req, res) => {
    try {
        const merchant = await db.getMerchantById(req.params.id);
        if (merchant && merchant.is_admin) return res.redirect('/admin/merchants');
        const mid = req.params.id;
        await Promise.all([
            db.deleteLinksByMerchant(mid),
            db.deleteProductsByMerchant(mid),
            db.deleteSectionsByMerchant(mid),
            db.deletePageViewsByMerchant(mid),
            db.deleteTicketsByMerchant(mid)
        ]);
        await db.deleteMerchant(mid);
    } catch (err) {
        console.error(err);
    }
    res.redirect('/admin/merchants');
});

// Edit merchant
router.post('/merchants/:id/edit', async (req, res) => {
    try {
        const { store_name, email, username, password } = req.body;
        const mid = req.params.id;
        const merchant = await db.getMerchantById(mid);
        if (!merchant) return res.redirect('/admin/merchants');

        const updateData = {
            store_name: store_name || merchant.store_name,
            email: email || merchant.email,
            username: (username || merchant.username).toLowerCase()
        };

        if (password && password.trim()) {
            updateData.password = bcrypt.hashSync(password, 10);
        }

        await db.updateMerchant(mid, updateData);
    } catch (err) {
        console.error(err);
    }
    res.redirect('/admin/merchants');
});

// View merchant details (links, products, stats)
router.get('/merchants/:id/view', async (req, res) => {
    try {
        const mid = req.params.id;
        const merchant = await db.getMerchantById(mid);
        if (!merchant) return res.redirect('/admin/merchants');

        const [links, products, totalViews, totalClicks, viewsToday, viewsWeek, viewsMonth] = await Promise.all([
            db.getLinksByMerchant(mid),
            db.getProductsByMerchant(mid),
            db.countPageViews(mid),
            db.sumClicksByMerchant(mid),
            db.countPageViewsToday(mid),
            db.countPageViewsWeek(mid),
            db.countPageViewsMonth(mid)
        ]);

        res.render('admin/merchant-view', {
            merchant, links, products,
            stats: { totalViews, totalClicks, viewsToday, viewsWeek, viewsMonth }
        });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/merchants');
    }
});

// Tickets
router.get('/tickets', async (req, res) => {
    try {
        const tickets = await db.getAllTicketsWithMerchant();
        res.render('admin/tickets', { tickets });
    } catch (err) {
        console.error(err);
        res.render('admin/tickets', { tickets: [] });
    }
});

router.post('/tickets/:id/reply', async (req, res) => {
    const { reply } = req.body;
    if (reply) {
        await db.replyToTicket(req.params.id, reply);
    }
    res.redirect('/admin/tickets');
});

router.post('/tickets/:id/close', async (req, res) => {
    await db.closeTicket(req.params.id);
    res.redirect('/admin/tickets');
});

// Notifications
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await db.getNotifications();
        res.render('admin/notifications', { notifications });
    } catch (err) {
        console.error(err);
        res.render('admin/notifications', { notifications: [] });
    }
});

router.post('/notifications/send', async (req, res) => {
    const { title, message } = req.body;
    if (title && message) {
        await db.createNotification({ title, message });
    }
    res.redirect('/admin/notifications');
});

router.post('/notifications/:id/delete', async (req, res) => {
    await db.deleteNotification(req.params.id);
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
