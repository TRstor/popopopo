const express = require('express');
const session = require('express-session');
const FirestoreStore = require('firestore-store')(session);
const path = require('path');
const fs = require('fs');
const dbModule = require('./db');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Auth middleware helper
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api', apiRoutes);
app.use('/admin', adminRoutes);

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

        const [links, sections, products, viewCount] = await Promise.all([
            dbModule.getLinksByMerchant(merchant.id),
            dbModule.getSectionsByMerchant(merchant.id),
            dbModule.getActiveProductsByMerchant(merchant.id),
            dbModule.countPageViews(merchant.id)
        ]);

        res.render('profile', { merchant, links, sections, products, viewCount });
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
