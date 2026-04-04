const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}
router.use(requireAuth);

const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedExts.includes(ext)) return cb(new Error('نوع الملف غير مدعوم'));
        cb(null, true);
    }
});

router.get('/', async (req, res) => {
    try {
        const userId = req.session.user.id;
        // Admin should use /admin panel, not merchant dashboard
        const merchantCheck = await db.getMerchantById(userId);
        if (merchantCheck && merchantCheck.is_admin) return res.redirect('/admin');
        const [merchant, links, sections, viewCount, notifications, myTickets, products] = await Promise.all([
            db.getMerchantById(userId),
            db.getLinksByMerchant(userId),
            db.getSectionsByMerchant(userId),
            db.countPageViews(userId),
            db.getNotifications(5),
            db.getTicketsByMerchant(userId, 5),
            db.getProductsByMerchant(userId)
        ]);
        const profileUrl = `${req.protocol}://${req.get('host')}/${merchant.username}`;
        const filter = req.query.filter || 'all';
        res.render('dashboard', { merchant, links, sections, profileUrl, viewCount, notifications, myTickets, filter, products });
    } catch (err) {
        console.error(err);
        res.redirect('/login');
    }
});

router.post('/settings', upload.fields([
    { name: 'profile_image', maxCount: 1 },
    { name: 'cover_image', maxCount: 1 },
    { name: 'bg_image', maxCount: 1 }
]), async (req, res) => {
    try {
        // CSRF check after multer parses multipart body
        const csrfToken = req.body._csrf || req.headers['x-csrf-token'];
        if (!csrfToken || csrfToken !== req.session.csrfToken) {
            return res.status(403).send('CSRF token invalid - طلب غير مصرح');
        }
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

        const updateData = {
            store_name, store_desc: store_desc || '',
            theme_color: theme_color || '#8B5CF6',
            theme_style: style, button_shape: shape, font_family: font, font_size: size, card_style: card
        };

        if (req.files) {
            if (req.files.profile_image) {
                const f = req.files.profile_image[0];
                updateData.profile_image = await db.saveFile(f.buffer, f.originalname, 'profiles');
            }
            if (req.files.cover_image) {
                const f = req.files.cover_image[0];
                updateData.cover_image = await db.saveFile(f.buffer, f.originalname, 'covers');
            }
            if (req.files.bg_image) {
                const f = req.files.bg_image[0];
                updateData.bg_image = await db.saveFile(f.buffer, f.originalname, 'backgrounds');
            }
        }

        await db.updateMerchant(userId, updateData);
        req.session.user.store_name = store_name;
        req.session.user.theme_style = style;
        req.session.user.theme_color = theme_color || '#8B5CF6';
        req.session.user.button_shape = shape;
        req.session.user.font_family = font;
        req.session.user.font_size = size;
        req.session.user.card_style = card;
        res.redirect('/dashboard?msg=saved');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard?msg=error');
    }
});

router.post('/links/add', async (req, res) => {
    try {
        const { title, url, icon, color, size, description, badge, show_icon, show_text, border_style, gradient, countdown_date, section_id } = req.body;
        const userId = req.session.user.id;
        const allowedSizes = ['full','half','third'];
        const linkSize = allowedSizes.includes(size) ? size : 'full';
        const maxOrder = await db.getMaxLinkSortOrder(userId);
        await db.createLink({
            merchant_id: userId, title, url, icon: icon || 'fas fa-link', color: color || '#8B5CF6',
            size: linkSize, description: description || '', badge: badge || '',
            show_icon: show_icon === '0' ? 0 : 1, show_text: show_text === '0' ? 0 : 1,
            border_style: border_style || 'none', gradient: gradient || '', countdown_date: countdown_date || '',
            section_id: parseInt(section_id) || 0, sort_order: maxOrder + 1
        });
        res.redirect('/dashboard?msg=added');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard?msg=error');
    }
});

router.post('/links/duplicate/:id', async (req, res) => {
    try {
        const link = await db.getLinkByIdAndMerchant(req.params.id, req.session.user.id);
        if (link) {
            const maxOrder = await db.getMaxLinkSortOrder(req.session.user.id);
            await db.createLink({
                merchant_id: link.merchant_id, title: link.title + ' (نسخة)', url: link.url,
                icon: link.icon, color: link.color, size: link.size, description: link.description,
                badge: link.badge, show_icon: link.show_icon, show_text: link.show_text,
                border_style: link.border_style, gradient: link.gradient, countdown_date: link.countdown_date,
                section_id: link.section_id, sort_order: maxOrder + 1
            });
        }
        res.redirect('/dashboard?msg=duplicated');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard?msg=error');
    }
});

router.post('/links/delete/:id', async (req, res) => {
    await db.deleteLinkByIdAndMerchant(req.params.id, req.session.user.id);
    res.redirect('/dashboard?msg=deleted');
});

router.post('/links/toggle/:id', async (req, res) => {
    await db.toggleLinkActive(req.params.id, req.session.user.id);
    res.redirect('/dashboard');
});

router.post('/sections/add', async (req, res) => {
    try {
        const { title } = req.body;
        const userId = req.session.user.id;
        const maxOrder = await db.getMaxSectionSortOrder(userId);
        await db.createSection({ merchant_id: userId, title, sort_order: maxOrder + 1 });
        res.redirect('/dashboard?msg=section_added');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard?msg=error');
    }
});

router.post('/sections/delete/:id', async (req, res) => {
    await db.deleteSectionByIdAndMerchant(req.params.id, req.session.user.id);
    res.redirect('/dashboard');
});

router.post('/tickets/submit', async (req, res) => {
    const { subject, message } = req.body;
    if (subject && message) {
        await db.createTicket({ merchant_id: req.session.user.id, subject, message });
    }
    res.redirect('/dashboard?msg=ticket_sent');
});

// ===== Salla Widget Code Parser =====
function parseSallaWidget(code) {
    const result = { store_id: '', product_id: '', label: '' };
    if (!code) return result;
    const storeMatch = code.match(/store-id\s*=\s*"([^"]+)"/);
    if (storeMatch) result.store_id = storeMatch[1];
    const productsMatch = code.match(/products\s*=\s*"\[([^\]]+)\]"/);
    if (productsMatch) result.product_id = productsMatch[1].trim();
    const labelMatch = code.match(/label\s*=\s*"([^"]+)"/);
    if (labelMatch) result.label = labelMatch[1].trim();
    return result;
}

// ===== Products CRUD =====
router.post('/products/add', upload.fields([{ name: 'product_image', maxCount: 1 }]), async (req, res) => {
    try {
        // CSRF check after multer parses multipart body
        const csrfToken = req.body._csrf || req.headers['x-csrf-token'];
        if (!csrfToken || csrfToken !== req.session.csrfToken) {
            return res.status(403).send('CSRF token invalid - طلب غير مصرح');
        }
        const { title, description, price, old_price, salla_url, salla_widget_code, category } = req.body;
        const userId = req.session.user.id;
        const maxOrder = await db.getMaxProductSortOrder(userId);
        let image = '';
        if (req.files && req.files.product_image) {
            const f = req.files.product_image[0];
            image = await db.saveFile(f.buffer, f.originalname, 'products');
        }
        const salla = parseSallaWidget(salla_widget_code);
        await db.createProduct({
            merchant_id: userId, title, description: description || '',
            price: parseFloat(price) || 0, old_price: parseFloat(old_price) || 0,
            image, salla_url: salla_url || '', salla_store_id: salla.store_id,
            salla_product_id: salla.product_id, salla_label: salla.label,
            category: category || '', sort_order: maxOrder + 1
        });
        res.redirect('/dashboard?msg=product_added');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard?msg=error');
    }
});

router.post('/products/edit/:id', upload.fields([{ name: 'product_image', maxCount: 1 }]), async (req, res) => {
    try {
        // CSRF check after multer parses multipart body
        const csrfToken = req.body._csrf || req.headers['x-csrf-token'];
        if (!csrfToken || csrfToken !== req.session.csrfToken) {
            return res.status(403).send('CSRF token invalid - طلب غير مصرح');
        }
        const { title, description, price, old_price, salla_url, salla_widget_code, category } = req.body;
        const userId = req.session.user.id;

        const updateData = {
            title, description: description || '', price: parseFloat(price) || 0,
            old_price: parseFloat(old_price) || 0, salla_url: salla_url || '', category: category || ''
        };

        if (salla_widget_code && salla_widget_code.trim()) {
            const salla = parseSallaWidget(salla_widget_code);
            updateData.salla_store_id = salla.store_id;
            updateData.salla_product_id = salla.product_id;
            updateData.salla_label = salla.label;
        }
        if (req.files && req.files.product_image) {
            const f = req.files.product_image[0];
            updateData.image = await db.saveFile(f.buffer, f.originalname, 'products');
        }

        // Verify ownership before update
        const existing = await db.getProductByIdAndMerchant(req.params.id, userId);
        if (existing) {
            await db.updateProduct(req.params.id, updateData);
        }
        res.redirect('/dashboard?msg=product_saved');
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard?msg=error');
    }
});

router.post('/products/delete/:id', async (req, res) => {
    await db.deleteProductByIdAndMerchant(req.params.id, req.session.user.id);
    res.redirect('/dashboard?msg=product_deleted');
});

router.post('/products/toggle/:id', async (req, res) => {
    await db.toggleProductActive(req.params.id, req.session.user.id);
    res.redirect('/dashboard?msg=product_toggled');
});

// #99 Preview Mode
router.get('/preview', async (req, res) => {
    try {
        const userId = req.session.user.id;
        const merchant = await db.getMerchantById(userId);
        const [links, sections, products, viewCount] = await Promise.all([
            db.getLinksByMerchant(userId),
            db.getSectionsByMerchant(userId),
            db.getActiveProductsByMerchant(userId),
            db.countPageViews(userId)
        ]);
        res.render('profile', { merchant, links, sections, products, viewCount, isPreview: true });
    } catch (err) {
        console.error(err);
        res.redirect('/dashboard');
    }
});

module.exports = router;
