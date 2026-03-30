const express = require('express');
const db = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'غير مصرح' });
    next();
}

router.post('/links/reorder', requireAuth, async (req, res) => {
    const { order } = req.body;
    const userId = req.session.user.id;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    try {
        for (let i = 0; i < order.length; i++) {
            const link = await db.getLinkByIdAndMerchant(order[i], userId);
            if (link) await db.updateLink(order[i], { sort_order: i });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

router.post('/products/reorder', requireAuth, async (req, res) => {
    const { order } = req.body;
    const userId = req.session.user.id;
    if (!Array.isArray(order)) return res.status(400).json({ error: 'بيانات غير صالحة' });
    try {
        for (let i = 0; i < order.length; i++) {
            const product = await db.getProductByIdAndMerchant(order[i], userId);
            if (product) await db.updateProduct(order[i], { sort_order: i });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

router.post('/links/update/:id', requireAuth, async (req, res) => {
    try {
        const { title, url, icon, color, size, description, badge, show_icon, show_text, border_style, gradient, countdown_date, section_id } = req.body;
        const userId = req.session.user.id;
        const allowedSizes = ['full','half','third'];
        const linkSize = allowedSizes.includes(size) ? size : 'full';
        const si = (show_icon === 0 || show_icon === '0') ? 0 : 1;
        const st = (show_text === 0 || show_text === '0') ? 0 : 1;

        const existing = await db.getLinkByIdAndMerchant(req.params.id, userId);
        if (!existing) return res.status(404).json({ error: 'الرابط غير موجود' });

        await db.updateLink(req.params.id, {
            title, url, icon, color, size: linkSize, description: description || '',
            badge: badge || '', show_icon: si, show_text: st, border_style: border_style || 'none',
            gradient: gradient || '', countdown_date: countdown_date || '', section_id: parseInt(section_id) || 0
        });
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

// Track link click
router.post('/links/click/:id', async (req, res) => {
    try {
        await db.incrementLinkClick(req.params.id);
    } catch(e) {}
    res.json({ success: true });
});

// Apply design preset (theme + settings + demo links)
router.post('/preset/apply', requireAuth, async (req, res) => {
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
            theme_style: 'midnight', button_shape: 'pill', card_style: 'glass',
            font_family: 'Changa', font_size: 'medium', theme_color: '#22d3ee',
            links: [
                { title: 'انستقرام', url: 'https://instagram.com/', icon: 'fab fa-instagram', color: '#ec4899', size: 'full', gradient: 'linear-gradient(135deg,#ec4899,#8B5CF6)' },
                { title: 'تيك توك', url: 'https://tiktok.com/', icon: 'fab fa-tiktok', color: '#22d3ee', size: 'half', gradient: '' },
                { title: 'سناب شات', url: 'https://snapchat.com/', icon: 'fab fa-snapchat-ghost', color: '#a3e635', size: 'half', gradient: '' },
                { title: 'واتساب', url: 'https://wa.me/', icon: 'fab fa-whatsapp', color: '#10b981', size: 'full', gradient: 'linear-gradient(135deg,#10b981,#22d3ee)' },
                { title: 'المتجر', url: 'https://', icon: 'fas fa-store', color: '#8B5CF6', size: 'full', gradient: '' },
            ]
        }
    };

    const p = presets[Number(preset)];
    if (!p) return res.status(400).json({ error: 'تصميم غير صالح' });

    try {
        // Update merchant settings
        await db.updateMerchant(userId, {
            theme_style: p.theme_style, button_shape: p.button_shape, card_style: p.card_style,
            font_family: p.font_family, font_size: p.font_size, theme_color: p.theme_color
        });

        // Delete existing links
        await db.deleteLinksByMerchant(userId);

        // Insert preset links
        for (let i = 0; i < p.links.length; i++) {
            const link = p.links[i];
            await db.createLink({
                merchant_id: userId, title: link.title, url: link.url, icon: link.icon,
                color: link.color, size: link.size, description: '', badge: '',
                show_icon: 1, show_text: 1, border_style: 'none', gradient: link.gradient,
                countdown_date: '', section_id: 0, sort_order: i
            });
        }

        // Update session
        req.session.user.theme_style = p.theme_style;
        req.session.user.theme_color = p.theme_color;
        req.session.user.button_shape = p.button_shape;
        req.session.user.font_family = p.font_family;
        req.session.user.font_size = p.font_size;
        req.session.user.card_style = p.card_style;
        res.json({ success: true });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ' });
    }
});

module.exports = router;
