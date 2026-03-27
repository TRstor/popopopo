const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

// Home page
router.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('home');
});

// Login page
router.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('login', { error: null });
});

// Login handler
router.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render('login', { error: 'يرجى ملء جميع الحقول' });
    }

    const merchant = db.prepare('SELECT * FROM merchants WHERE email = ?').get(email);

    if (!merchant || !bcrypt.compareSync(password, merchant.password)) {
        return res.render('login', { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    req.session.user = {
        id: merchant.id,
        username: merchant.username,
        email: merchant.email,
        store_name: merchant.store_name
    };

    res.redirect('/dashboard');
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('register', { error: null });
});

// Register handler
router.post('/register', (req, res) => {
    const { username, email, password, store_name } = req.body;

    if (!username || !email || !password || !store_name) {
        return res.render('register', { error: 'يرجى ملء جميع الحقول' });
    }

    // Validate username (alphanumeric, dashes, underscores only)
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        return res.render('register', { error: 'اسم المستخدم يجب أن يكون بالإنجليزية (3-30 حرف) بدون مسافات' });
    }

    // Check reserved usernames
    const reserved = ['login', 'register', 'dashboard', 'api', 'admin', 'logout', 'uploads', 'public'];
    if (reserved.includes(username.toLowerCase())) {
        return res.render('register', { error: 'اسم المستخدم محجوز، اختر اسماً آخر' });
    }

    // Check if username or email exists
    const existing = db.prepare('SELECT id FROM merchants WHERE username = ? OR email = ?').get(username.toLowerCase(), email);
    if (existing) {
        return res.render('register', { error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    try {
        const result = db.prepare(
            'INSERT INTO merchants (username, email, password, store_name) VALUES (?, ?, ?, ?)'
        ).run(username.toLowerCase(), email, hashedPassword, store_name);

        req.session.user = {
            id: result.lastInsertRowid,
            username: username.toLowerCase(),
            email,
            store_name
        };

        res.redirect('/dashboard');
    } catch (err) {
        res.render('register', { error: 'حدث خطأ، يرجى المحاولة مرة أخرى' });
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

module.exports = router;
