const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');
const db = require('./db');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
['data', 'uploads'].forEach(dir => {
    const p = path.join(__dirname, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session
app.use(session({
    store: new SQLiteStore({ db: 'sessions.sqlite', dir: './data' }),
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
app.get('/directory', (req, res) => {
    const search = req.query.q || '';
    let merchants;
    if (search) {
        merchants = db.prepare("SELECT id, username, store_name, store_desc, profile_image, is_verified, theme_style FROM merchants WHERE is_banned = 0 AND (store_name LIKE ? OR username LIKE ?) ORDER BY is_verified DESC, created_at DESC").all(`%${search}%`, `%${search}%`);
    } else {
        merchants = db.prepare("SELECT id, username, store_name, store_desc, profile_image, is_verified, theme_style FROM merchants WHERE is_banned = 0 ORDER BY is_verified DESC, created_at DESC LIMIT 50").all();
    }
    const totalMerchants = db.prepare("SELECT COUNT(*) as count FROM merchants WHERE is_banned = 0").get().count;
    res.render('directory', { merchants, search, totalMerchants });
});

// Public profile page - must be last
app.get('/:username', (req, res) => {
    const username = req.params.username;
    const merchant = db.prepare('SELECT * FROM merchants WHERE username = ? AND is_banned = 0').get(username);

    if (!merchant) {
        return res.status(404).render('404');
    }

    // Track page view
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || '';
    try {
        db.prepare('INSERT INTO page_views (merchant_id, ip_address, user_agent) VALUES (?, ?, ?)').run(merchant.id, ip, ua);
    } catch(e) {}

    const links = db.prepare('SELECT * FROM links WHERE merchant_id = ? ORDER BY sort_order ASC').all(merchant.id);
    const sections = db.prepare('SELECT * FROM link_sections WHERE merchant_id = ? ORDER BY sort_order ASC').all(merchant.id);
    const viewCount = db.prepare('SELECT COUNT(*) as count FROM page_views WHERE merchant_id = ?').get(merchant.id).count;

    res.render('profile', { merchant, links, sections, viewCount });
});

// 404
app.use((req, res) => {
    res.status(404).render('404');
});

// Initialize DB
db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        store_name TEXT NOT NULL,
        store_desc TEXT DEFAULT '',
        profile_image TEXT DEFAULT '',
        cover_image TEXT DEFAULT '',
        bg_image TEXT DEFAULT '',
        theme_color TEXT DEFAULT '#8B5CF6',
        theme_style TEXT DEFAULT 'dark',
        button_shape TEXT DEFAULT 'rounded',
        font_family TEXT DEFAULT 'Tajawal',
        font_size TEXT DEFAULT 'medium',
        card_style TEXT DEFAULT 'default',
        is_verified INTEGER DEFAULT 0,
        is_banned INTEGER DEFAULT 0,
        is_admin INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT DEFAULT 'fas fa-link',
        color TEXT DEFAULT '#8B5CF6',
        size TEXT DEFAULT 'full',
        description TEXT DEFAULT '',
        badge TEXT DEFAULT '',
        show_icon INTEGER DEFAULT 1,
        show_text INTEGER DEFAULT 1,
        border_style TEXT DEFAULT 'none',
        gradient TEXT DEFAULT '',
        countdown_date TEXT DEFAULT '',
        section_id INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS link_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS page_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        ip_address TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merchant_id INTEGER NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        admin_reply TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Migrations - add new columns safely
const migrations = [
    { table: 'links', col: 'size', sql: "ALTER TABLE links ADD COLUMN size TEXT DEFAULT 'full'" },
    { table: 'merchants', col: 'theme_style', sql: "ALTER TABLE merchants ADD COLUMN theme_style TEXT DEFAULT 'dark'" },
    { table: 'merchants', col: 'cover_image', sql: "ALTER TABLE merchants ADD COLUMN cover_image TEXT DEFAULT ''" },
    { table: 'merchants', col: 'bg_image', sql: "ALTER TABLE merchants ADD COLUMN bg_image TEXT DEFAULT ''" },
    { table: 'merchants', col: 'button_shape', sql: "ALTER TABLE merchants ADD COLUMN button_shape TEXT DEFAULT 'rounded'" },
    { table: 'merchants', col: 'font_family', sql: "ALTER TABLE merchants ADD COLUMN font_family TEXT DEFAULT 'Tajawal'" },
    { table: 'merchants', col: 'font_size', sql: "ALTER TABLE merchants ADD COLUMN font_size TEXT DEFAULT 'medium'" },
    { table: 'merchants', col: 'card_style', sql: "ALTER TABLE merchants ADD COLUMN card_style TEXT DEFAULT 'default'" },
    { table: 'merchants', col: 'is_verified', sql: "ALTER TABLE merchants ADD COLUMN is_verified INTEGER DEFAULT 0" },
    { table: 'merchants', col: 'is_banned', sql: "ALTER TABLE merchants ADD COLUMN is_banned INTEGER DEFAULT 0" },
    { table: 'merchants', col: 'is_admin', sql: "ALTER TABLE merchants ADD COLUMN is_admin INTEGER DEFAULT 0" },
    { table: 'links', col: 'description', sql: "ALTER TABLE links ADD COLUMN description TEXT DEFAULT ''" },
    { table: 'links', col: 'badge', sql: "ALTER TABLE links ADD COLUMN badge TEXT DEFAULT ''" },
    { table: 'links', col: 'show_icon', sql: "ALTER TABLE links ADD COLUMN show_icon INTEGER DEFAULT 1" },
    { table: 'links', col: 'show_text', sql: "ALTER TABLE links ADD COLUMN show_text INTEGER DEFAULT 1" },
    { table: 'links', col: 'border_style', sql: "ALTER TABLE links ADD COLUMN border_style TEXT DEFAULT 'none'" },
    { table: 'links', col: 'gradient', sql: "ALTER TABLE links ADD COLUMN gradient TEXT DEFAULT ''" },
    { table: 'links', col: 'countdown_date', sql: "ALTER TABLE links ADD COLUMN countdown_date TEXT DEFAULT ''" },
    { table: 'links', col: 'section_id', sql: "ALTER TABLE links ADD COLUMN section_id INTEGER DEFAULT 0" },
];

migrations.forEach(m => {
    try { db.prepare(`SELECT ${m.col} FROM ${m.table} LIMIT 1`).get(); }
    catch(e) { try { db.exec(m.sql); } catch(e2) {} }
});

// Create default admin if none exists
const adminExists = db.prepare("SELECT id FROM merchants WHERE is_admin = 1 LIMIT 1").get();
if (!adminExists) {
    const firstMerchant = db.prepare("SELECT id FROM merchants ORDER BY id ASC LIMIT 1").get();
    if (firstMerchant) {
        db.prepare("UPDATE merchants SET is_admin = 1 WHERE id = ?").run(firstMerchant.id);
    }
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
