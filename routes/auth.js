const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

// Home page
router.get('/', async (req, res) => {
    if (req.session.user) {
        return res.redirect(req.session.user.is_admin ? '/admin' : '/dashboard');
    }
    try {
        const totalMerchants = await db.countMerchants({ is_banned: 0 });
        const featuredMerchants = await db.getFeaturedMerchants(6);
        res.render('home', { totalMerchants, featuredMerchants });
    } catch (err) {
        console.error(err);
        res.render('home', { totalMerchants: 0, featuredMerchants: [] });
    }
});

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect(req.session.user.is_admin ? '/admin' : '/dashboard');
    res.render('login', { error: null });
});

// Login handler
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render('login', { error: 'يرجى ملء جميع الحقول' });
    }

    try {
        // Check if email is temporarily banned
        const banStatus = await db.checkLoginBan(email);
        if (banStatus.banned) {
            return res.render('login', { error: `تم حظر تسجيل الدخول مؤقتاً. حاول بعد ${banStatus.minutes_left} دقيقة` });
        }

        const merchant = await db.getMerchantByEmail(email);

        if (!merchant || !bcrypt.compareSync(password, merchant.password)) {
            // Record failed attempt
            const result = await db.recordFailedLogin(email);
            if (result.banned) {
                return res.render('login', { error: 'تم تجاوز عدد المحاولات المسموحة. حاول بعد 3 دقائق' });
            }
            if (result.remaining <= 2) {
                return res.render('login', { error: `البريد الإلكتروني أو كلمة المرور غير صحيحة. باقي ${result.remaining} محاولة` });
            }
            return res.render('login', { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
        }

        // Successful login - clear attempts
        await db.clearLoginAttempts(email);

        req.session.user = {
            id: merchant.id,
            username: merchant.username,
            email: merchant.email,
            store_name: merchant.store_name,
            is_admin: merchant.is_admin || 0
        };

        res.redirect(merchant.is_admin ? '/admin' : '/dashboard');
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'حدث خطأ، يرجى المحاولة مرة أخرى' });
    }
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect(req.session.user.is_admin ? '/admin' : '/dashboard');
    res.render('register', { error: null });
});

// Register handler
router.post('/register', async (req, res) => {
    const { username, email, password, store_name } = req.body;

    if (!username || !email || !password || !store_name) {
        return res.render('register', { error: 'يرجى ملء جميع الحقول' });
    }

    // Validate username (alphanumeric, dashes, underscores only)
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        return res.render('register', { error: 'اسم المستخدم يجب أن يكون بالإنجليزية (3-30 حرف) بدون مسافات' });
    }

    // Check reserved usernames
    const reserved = ['login', 'register', 'dashboard', 'api', 'admin', 'logout', 'uploads', 'public', 'directory', 'css', 'js'];
    if (reserved.includes(username.toLowerCase())) {
        return res.render('register', { error: 'اسم المستخدم محجوز، اختر اسماً آخر' });
    }

    try {
        // Check if username or email exists
        const existing = await db.getMerchantByEmailOrUsername(email, username.toLowerCase());
        if (existing) {
            return res.render('register', { error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        const result = await db.createMerchant({
            username: username.toLowerCase(),
            email,
            password: hashedPassword,
            store_name
        });

        req.session.user = {
            id: result.lastInsertRowid,
            username: username.toLowerCase(),
            email,
            store_name
        };

        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.render('register', { error: 'حدث خطأ، يرجى المحاولة مرة أخرى' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
