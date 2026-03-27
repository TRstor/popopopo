const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');
const fs = require('fs');
const db = require('./db');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const apiRoutes = require('./routes/api');

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
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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

// Public profile page - must be last
app.get('/:username', (req, res) => {
    const username = req.params.username;
    const merchant = db.prepare('SELECT * FROM merchants WHERE username = ?').get(username);

    if (!merchant) {
        return res.status(404).render('404');
    }

    const links = db.prepare('SELECT * FROM links WHERE merchant_id = ? ORDER BY sort_order ASC').all(merchant.id);

    res.render('profile', { merchant, links });
});

// 404
app.use((req, res) => {
    res.status(404).render('404');
});

// Initialize DB and start
db.exec(`
    CREATE TABLE IF NOT EXISTS merchants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        store_name TEXT NOT NULL,
        store_desc TEXT DEFAULT '',
        profile_image TEXT DEFAULT '',
        theme_color TEXT DEFAULT '#8B5CF6',
        theme_style TEXT DEFAULT 'dark',
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
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE
    );
`);

// Migration: add size column if not exists
try {
    db.prepare("SELECT size FROM links LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE links ADD COLUMN size TEXT DEFAULT 'full'");
}

// Migration: add theme_style column if not exists
try {
    db.prepare("SELECT theme_style FROM merchants LIMIT 1").get();
} catch (e) {
    db.exec("ALTER TABLE merchants ADD COLUMN theme_style TEXT DEFAULT 'dark'");
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
