const express = require('express');
const compression = require('compression');
const session = require('express-session');
const FirestoreStore = require('firestore-store')(session);
const crypto = require('crypto');
const path = require('path');
const dbModule = require('./db');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Gzip compression
app.use(compression());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d',
    etag: true
}));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// Session with Firestore store
app.use(session({
    store: new FirestoreStore({
        database: dbModule.db,
        collection: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || 'tr-store-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Inactivity timeout (15 minutes)
app.use((req, res, next) => {
    if (req.session && req.session.user) {
        const now = Date.now();
        const lastActivity = req.session.lastActivity || now;
        const fifteenMinutes = 15 * 60 * 1000;
        if (now - lastActivity > fifteenMinutes) {
            return req.session.destroy(() => {
                res.redirect('/login');
            });
        }
        req.session.lastActivity = now;
    }
    next();
});

// Auth middleware helper
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;

    // Generate CSRF token if not exists
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    res.locals.csrfToken = req.session.csrfToken;
    next();
});

// CSRF validation for all POST/PUT/DELETE requests
app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    // Skip CSRF check for multipart/form-data (multer hasn't parsed body yet)
    // CSRF will be verified inside route handlers after multer processes the body
    if (req.is('multipart/form-data')) return next();

    const token = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
    if (!token || token !== req.session.csrfToken) {
        return res.status(403).send('CSRF token invalid - طلب غير مصرح');
    }
    next();
});

// Favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

// Serve images from Firestore
app.get('/uploads/:fileId', async (req, res) => {
    try {
        const file = await dbModule.getFile(req.params.fileId);
        if (!file) return res.status(404).end();
        res.set('Content-Type', file.contentType);
        res.set('Cache-Control', 'public, max-age=31536000');
        res.send(Buffer.from(file.data, 'base64'));
    } catch (err) {
        res.status(500).end();
    }
});

// Merchant directory
app.get('/directory', async (req, res) => {
    try {
        const search = req.query.q || '';
        const merchants = await dbModule.getDirectoryMerchants(search);
        const totalMerchants = await dbModule.countMerchants({ is_banned: 0, is_admin: 0 });
        res.render('directory', { merchants, search, totalMerchants });
    } catch (err) {
        console.error(err);
        res.status(500).render('404');
    }
});

// Public profile page - must be last
app.get('/:username', async (req, res) => {
    try {
        const username = req.params.username.toLowerCase();
        const merchant = await dbModule.getMerchantByUsernameNotBanned(username);

        if (!merchant) {
            return res.status(404).render('404');
        }

        // Track page view
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const ua = req.headers['user-agent'] || '';
        try {
            await dbModule.createPageView({ merchant_id: merchant.id, ip_address: ip, user_agent: ua });
        } catch(e) {}

        const [links, products, viewCount] = await Promise.all([
            dbModule.getLinksByMerchant(merchant.id),
            dbModule.getActiveProductsByMerchant(merchant.id),
            dbModule.countPageViews(merchant.id)
        ]);

        res.render('profile', { merchant, links, products, viewCount });
    } catch (err) {
        console.error(err);
        res.status(500).render('404');
    }
});

// 404
app.use((req, res) => {
    res.status(404).render('404');
});

// Initialize admin and start server
async function startServer() {
    try {
        // Create default admin from environment variables
        const adminExists = await dbModule.getFirstAdmin();
        if (!adminExists && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
            const bcrypt = require('bcryptjs');
            const adminEmail = process.env.ADMIN_EMAIL;
            const adminPassword = process.env.ADMIN_PASSWORD;
            const adminUsername = process.env.ADMIN_USERNAME || 'admin';
            const adminStore = process.env.ADMIN_STORE_NAME || 'المدير';

            const existing = await dbModule.getMerchantByEmail(adminEmail);
            if (!existing) {
                const hashedPassword = bcrypt.hashSync(adminPassword, 10);
                await dbModule.createMerchant({
                    username: adminUsername.toLowerCase(),
                    email: adminEmail,
                    password: hashedPassword,
                    store_name: adminStore,
                    is_admin: 1
                });
                console.log('Admin account created: ' + adminEmail);
            } else {
                await dbModule.updateMerchant(existing.id, { is_admin: 1 });
                console.log('Admin privileges granted to: ' + adminEmail);
            }
        } else if (!adminExists) {
            const firstMerchant = await dbModule.getFirstMerchant();
            if (firstMerchant) {
                await dbModule.updateMerchant(firstMerchant.id, { is_admin: 1 });
            }
        }
    } catch (err) {
        console.error('Error initializing admin:', err);
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
