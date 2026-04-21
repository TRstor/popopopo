const admin = require('firebase-admin');

// Initialize Firebase Admin
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
} else {
    try {
        serviceAccount = require('./serviceAccountKey.json');
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    } catch (e) {
        admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'linkin1-app' });
    }
}

const db = admin.firestore();

// ===== Counter helpers for auto-increment IDs =====
async function getNextId(collectionName) {
    const counterRef = db.collection('counters').doc(collectionName);
    return await db.runTransaction(async (t) => {
        const doc = await t.get(counterRef);
        let nextId = 1;
        if (doc.exists) nextId = doc.data().current + 1;
        t.set(counterRef, { current: nextId });
        return nextId;
    });
}

// ===== XSS Sanitization helpers =====
function stripHtml(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
}

function sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    // Allow only safe protocols
    if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
    // Block javascript:, data:, vbscript:, etc.
    if (/^[a-z]+:/i.test(trimmed)) return '';
    // Relative URLs or protocol-less
    return trimmed;
}

function sanitizeColor(val) {
    if (!val || typeof val !== 'string') return '';
    // Allow only valid CSS colors: hex, rgb(), hsl(), named colors
    if (/^#[0-9a-fA-F]{3,8}$/.test(val)) return val;
    if (/^(rgb|hsl)a?\([0-9,.\s%]+\)$/.test(val)) return val;
    if (/^[a-zA-Z]{3,20}$/.test(val)) return val;
    return '';
}

function sanitizeGradient(val) {
    if (!val || typeof val !== 'string') return '';
    // Allow only gradients like linear-gradient(...)
    if (/^(linear|radial)-gradient\([^){}]*\)$/.test(val)) return val;
    return '';
}

function sanitizeCssValue(val) {
    if (!val || typeof val !== 'string') return '';
    // Remove anything that could be CSS injection
    return val.replace(/[;{}()\\<>"']/g, '');
}

async function logSanitization(merchantId, field, originalValue, sanitizedValue) {
    if (originalValue === sanitizedValue) return;
    try {
        const now = new Date().toISOString();
        await db.collection('sanitization_log').add({
            merchant_id: merchantId || 0,
            field,
            original_value: String(originalValue).substring(0, 500),
            sanitized_value: String(sanitizedValue).substring(0, 500),
            created_at: now
        });
    } catch (e) {
        console.error('Sanitization log error:', e.message);
    }
}

function sanitizeTextFields(data, merchantId) {
    const textFields = ['store_name', 'store_desc', 'store_name_en', 'store_desc_en', 'title', 'subject', 'message', 'description', 'badge', 'category', 'salla_label'];
    const urlFields = ['url', 'salla_url'];
    const colorFields = ['color', 'theme_color'];
    const gradientFields = ['gradient'];

    const cleaned = { ...data };
    for (const field of textFields) {
        if (cleaned[field] !== undefined && typeof cleaned[field] === 'string') {
            const original = cleaned[field];
            cleaned[field] = stripHtml(original);
            if (original !== cleaned[field]) {
                logSanitization(merchantId, field, original, cleaned[field]);
            }
        }
    }
    for (const field of urlFields) {
        if (cleaned[field] !== undefined && typeof cleaned[field] === 'string') {
            const original = cleaned[field];
            cleaned[field] = sanitizeUrl(original);
            if (original !== cleaned[field]) {
                logSanitization(merchantId, field, original, cleaned[field]);
            }
        }
    }
    for (const field of colorFields) {
        if (cleaned[field] !== undefined && typeof cleaned[field] === 'string') {
            const original = cleaned[field];
            cleaned[field] = sanitizeColor(original);
            if (original !== cleaned[field]) {
                logSanitization(merchantId, field, original, cleaned[field]);
            }
        }
    }
    for (const field of gradientFields) {
        if (cleaned[field] !== undefined && typeof cleaned[field] === 'string') {
            const original = cleaned[field];
            cleaned[field] = sanitizeGradient(original);
            if (original !== cleaned[field]) {
                logSanitization(merchantId, field, original, cleaned[field]);
            }
        }
    }
    return cleaned;
}

// ===== Merchant helpers =====
async function createMerchant(data) {
    const id = await getNextId('merchants');
    const clean = sanitizeTextFields(data, id);
    const now = new Date().toISOString();
    const merchantData = {
        id, username: clean.username, email: clean.email, password: clean.password,
        store_name: clean.store_name, store_desc: clean.store_desc || '',
        profile_image: clean.profile_image || '', cover_image: clean.cover_image || '',
        bg_image: clean.bg_image || '', theme_color: clean.theme_color || '#8B5CF6',
        theme_style: clean.theme_style || 'dark', button_shape: clean.button_shape || 'rounded',
        font_family: clean.font_family || 'Tajawal', font_size: clean.font_size || 'medium',
        card_style: clean.card_style || 'default', is_verified: clean.is_verified || 0,
        is_banned: clean.is_banned || 0, is_admin: clean.is_admin || 0, created_at: now
    };
    await db.collection('merchants').doc(String(id)).set(merchantData);
    return { lastInsertRowid: id, ...merchantData };
}

async function getMerchantById(id) {
    const doc = await db.collection('merchants').doc(String(id)).get();
    return doc.exists ? doc.data() : null;
}

async function getMerchantByEmail(email) {
    const snap = await db.collection('merchants').where('email', '==', email).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
}

async function getMerchantByUsername(username) {
    const snap = await db.collection('merchants').where('username', '==', username).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
}

async function getMerchantByUsernameNotBanned(username) {
    const snap = await db.collection('merchants')
        .where('username', '==', username).where('is_banned', '==', 0).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
}

async function getMerchantByEmailOrUsername(email, username) {
    let snap = await db.collection('merchants').where('username', '==', username).limit(1).get();
    if (!snap.empty) return snap.docs[0].data();
    snap = await db.collection('merchants').where('email', '==', email).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
}

async function updateMerchant(id, data) {
    const clean = sanitizeTextFields(data, id);
    await db.collection('merchants').doc(String(id)).update(clean);
}

async function deleteMerchant(id) {
    await db.collection('merchants').doc(String(id)).delete();
}

async function getAllMerchants() {
    const snap = await db.collection('merchants').orderBy('created_at', 'desc').get();
    return snap.docs.map(d => d.data());
}

async function searchMerchants(search) {
    const all = await getAllMerchants();
    const s = search.toLowerCase();
    return all.filter(m =>
        (m.store_name && m.store_name.toLowerCase().includes(s)) ||
        (m.username && m.username.toLowerCase().includes(s)) ||
        (m.email && m.email.toLowerCase().includes(s))
    );
}

async function getDirectoryMerchants(search, limit = 50) {
    const snap = await db.collection('merchants')
        .where('is_banned', '==', 0).where('is_admin', '==', 0).get();
    let merchants = snap.docs.map(d => d.data());
    if (search) {
        const s = search.toLowerCase();
        merchants = merchants.filter(m =>
            (m.store_name && m.store_name.toLowerCase().includes(s)) ||
            (m.username && m.username.toLowerCase().includes(s))
        );
    }
    merchants.sort((a, b) => {
        if (b.is_verified !== a.is_verified) return b.is_verified - a.is_verified;
        return (b.created_at || '').localeCompare(a.created_at || '');
    });
    if (!search) merchants = merchants.slice(0, limit);
    return merchants;
}

async function countMerchants(filter = {}) {
    let query = db.collection('merchants');
    if (filter.is_banned !== undefined) query = query.where('is_banned', '==', filter.is_banned);
    if (filter.is_admin !== undefined) query = query.where('is_admin', '==', filter.is_admin);
    const snap = await query.count().get();
    return snap.data().count;
}

async function getFeaturedMerchants(limit = 6) {
    const snap = await db.collection('merchants').where('is_banned', '==', 0).get();
    let merchants = snap.docs.map(d => d.data()).filter(m => m.profile_image && m.profile_image !== '');
    merchants.sort((a, b) => (b.is_verified || 0) - (a.is_verified || 0));
    return merchants.slice(0, limit);
}

async function getFirstAdmin() {
    const snap = await db.collection('merchants').where('is_admin', '==', 1).limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
}

async function getFirstMerchant() {
    const snap = await db.collection('merchants').orderBy('id', 'asc').limit(1).get();
    return snap.empty ? null : snap.docs[0].data();
}

// ===== Links helpers =====
async function createLink(data) {
    const id = await getNextId('links');
    const clean = sanitizeTextFields(data, data.merchant_id);
    const now = new Date().toISOString();
    const linkData = {
        id, merchant_id: clean.merchant_id, title: clean.title, url: sanitizeUrl(clean.url),
        icon: clean.icon || 'fas fa-link', color: sanitizeColor(clean.color) || '#8B5CF6',
        size: clean.size || 'full', description: clean.description || '',
        badge: clean.badge || '', show_icon: clean.show_icon !== undefined ? clean.show_icon : 1,
        show_text: clean.show_text !== undefined ? clean.show_text : 1,
        border_style: clean.border_style || 'none', gradient: sanitizeGradient(clean.gradient) || '',
        countdown_date: clean.countdown_date || '', section_id: clean.section_id || 0,
        sort_order: clean.sort_order || 0, is_active: clean.is_active !== undefined ? clean.is_active : 1,
        click_count: clean.click_count || 0, created_at: now
    };
    await db.collection('links').doc(String(id)).set(linkData);
    return { id, ...linkData };
}

async function getLinkById(id) {
    const doc = await db.collection('links').doc(String(id)).get();
    return doc.exists ? doc.data() : null;
}

async function getLinkByIdAndMerchant(id, merchantId) {
    const doc = await db.collection('links').doc(String(id)).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return data.merchant_id === merchantId ? data : null;
}

async function getLinksByMerchant(merchantId) {
    const snap = await db.collection('links')
        .where('merchant_id', '==', merchantId).get();
    return snap.docs.map(d => d.data()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

async function updateLink(id, data) {
    const clean = sanitizeTextFields(data, 0);
    await db.collection('links').doc(String(id)).update(clean);
}

async function deleteLink(id) {
    await db.collection('links').doc(String(id)).delete();
}

async function deleteLinkByIdAndMerchant(id, merchantId) {
    const link = await getLinkByIdAndMerchant(id, merchantId);
    if (link) await deleteLink(id);
}

async function deleteLinksByMerchant(merchantId) {
    const snap = await db.collection('links').where('merchant_id', '==', merchantId).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    if (!snap.empty) await batch.commit();
}

async function toggleLinkActive(id, merchantId) {
    const link = await getLinkByIdAndMerchant(id, merchantId);
    if (link) await updateLink(id, { is_active: link.is_active === 1 ? 0 : 1 });
}

async function incrementLinkClick(id) {
    const doc = await db.collection('links').doc(String(id)).get();
    if (doc.exists) {
        await db.collection('links').doc(String(id)).update({
            click_count: admin.firestore.FieldValue.increment(1)
        });
    }
}

async function getMaxLinkSortOrder(merchantId) {
    const snap = await db.collection('links')
        .where('merchant_id', '==', merchantId).get();
    if (snap.empty) return 0;
    return Math.max(...snap.docs.map(d => d.data().sort_order || 0));
}

async function countLinks() {
    const snap = await db.collection('links').count().get();
    return snap.data().count;
}

async function sumClicksByMerchant(merchantId) {
    const snap = await db.collection('links').where('merchant_id', '==', merchantId).get();
    let total = 0;
    snap.docs.forEach(d => { total += (d.data().click_count || 0); });
    return total;
}

// ===== Link Sections helpers =====
async function createSection(data) {
    const id = await getNextId('link_sections');
    const clean = sanitizeTextFields(data, data.merchant_id);
    const sectionData = { id, merchant_id: clean.merchant_id, title: clean.title, sort_order: clean.sort_order || 0 };
    await db.collection('link_sections').doc(String(id)).set(sectionData);
    return { id, ...sectionData };
}

async function getSectionsByMerchant(merchantId) {
    const snap = await db.collection('link_sections')
        .where('merchant_id', '==', merchantId).get();
    return snap.docs.map(d => d.data()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

async function getMaxSectionSortOrder(merchantId) {
    const snap = await db.collection('link_sections')
        .where('merchant_id', '==', merchantId).get();
    if (snap.empty) return 0;
    return Math.max(...snap.docs.map(d => d.data().sort_order || 0));
}

async function deleteSectionByIdAndMerchant(id, merchantId) {
    const doc = await db.collection('link_sections').doc(String(id)).get();
    if (doc.exists && doc.data().merchant_id === merchantId) {
        const links = await db.collection('links')
            .where('section_id', '==', Number(id)).where('merchant_id', '==', merchantId).get();
        const batch = db.batch();
        links.docs.forEach(d => batch.update(d.ref, { section_id: 0 }));
        batch.delete(doc.ref);
        await batch.commit();
    }
}

async function deleteSectionsByMerchant(merchantId) {
    const snap = await db.collection('link_sections').where('merchant_id', '==', merchantId).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    if (!snap.empty) await batch.commit();
}

// ===== Page Views helpers =====
async function createPageView(data) {
    const id = await getNextId('page_views');
    const now = new Date().toISOString();
    await db.collection('page_views').doc(String(id)).set({
        id, merchant_id: data.merchant_id, ip_address: data.ip_address || '',
        user_agent: data.user_agent || '', created_at: now
    });
}

async function countPageViews(merchantId) {
    const snap = await db.collection('page_views').where('merchant_id', '==', merchantId).count().get();
    return snap.data().count;
}

async function countAllPageViews() {
    const snap = await db.collection('page_views').count().get();
    return snap.data().count;
}

async function countPageViewsToday(merchantId) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const snap = await db.collection('page_views')
        .where('merchant_id', '==', merchantId).get();
    return snap.docs.filter(d => (d.data().created_at || '') >= todayStr).length;
}

async function countPageViewsWeek(merchantId) {
    const week = new Date(); week.setDate(week.getDate() - 7);
    const weekStr = week.toISOString();
    const snap = await db.collection('page_views')
        .where('merchant_id', '==', merchantId).get();
    return snap.docs.filter(d => (d.data().created_at || '') >= weekStr).length;
}

async function countPageViewsMonth(merchantId) {
    const month = new Date(); month.setDate(month.getDate() - 30);
    const monthStr = month.toISOString();
    const snap = await db.collection('page_views')
        .where('merchant_id', '==', merchantId).get();
    return snap.docs.filter(d => (d.data().created_at || '') >= monthStr).length;
}

async function deletePageViewsByMerchant(merchantId) {
    const snap = await db.collection('page_views').where('merchant_id', '==', merchantId).get();
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 500) {
        const batch = db.batch();
        docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
}

// ===== Tickets helpers =====
async function createTicket(data) {
    const id = await getNextId('tickets');
    const clean = sanitizeTextFields(data, data.merchant_id);
    const now = new Date().toISOString();
    const ticketData = {
        id, merchant_id: clean.merchant_id, subject: clean.subject, message: clean.message,
        status: 'open', admin_reply: '', created_at: now, updated_at: now
    };
    await db.collection('tickets').doc(String(id)).set(ticketData);
    return { id, ...ticketData };
}

async function getTicketsByMerchant(merchantId, limit = 5) {
    const snap = await db.collection('tickets')
        .where('merchant_id', '==', merchantId).get();
    const sorted = snap.docs.map(d => d.data()).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return sorted.slice(0, limit);
}

async function getAllTicketsWithMerchant() {
    const ticketsSnap = await db.collection('tickets').orderBy('created_at', 'desc').get();
    const tickets = ticketsSnap.docs.map(d => d.data());
    for (const ticket of tickets) {
        const merchant = await getMerchantById(ticket.merchant_id);
        if (merchant) { ticket.store_name = merchant.store_name; ticket.username = merchant.username; }
    }
    tickets.sort((a, b) => {
        if (a.status === 'open' && b.status !== 'open') return -1;
        if (a.status !== 'open' && b.status === 'open') return 1;
        return (b.created_at || '').localeCompare(a.created_at || '');
    });
    return tickets;
}

async function replyToTicket(id, reply) {
    const now = new Date().toISOString();
    await db.collection('tickets').doc(String(id)).update({ admin_reply: reply, status: 'replied', updated_at: now });
}

async function closeTicket(id) {
    const now = new Date().toISOString();
    await db.collection('tickets').doc(String(id)).update({ status: 'closed', updated_at: now });
}

async function countOpenTickets() {
    const snap = await db.collection('tickets').where('status', '==', 'open').count().get();
    return snap.data().count;
}

async function deleteTicketsByMerchant(merchantId) {
    const snap = await db.collection('tickets').where('merchant_id', '==', merchantId).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    if (!snap.empty) await batch.commit();
}

// ===== Notifications helpers =====
async function createNotification(data) {
    const id = await getNextId('notifications');
    const clean = sanitizeTextFields(data, 0);
    const now = new Date().toISOString();
    const notifData = { id, title: clean.title, message: clean.message, created_at: now };
    await db.collection('notifications').doc(String(id)).set(notifData);
    return { id, ...notifData };
}

async function getNotifications(limit = 0) {
    let query = db.collection('notifications').orderBy('created_at', 'desc');
    if (limit > 0) query = query.limit(limit);
    const snap = await query.get();
    return snap.docs.map(d => d.data());
}

async function deleteNotification(id) {
    await db.collection('notifications').doc(String(id)).delete();
}

// ===== Products helpers =====
async function createProduct(data) {
    const id = await getNextId('products');
    const clean = sanitizeTextFields(data, data.merchant_id);
    const now = new Date().toISOString();
    const productData = {
        id, merchant_id: clean.merchant_id, title: clean.title,
        description: clean.description || '', price: clean.price || 0,
        old_price: clean.old_price || 0, image: clean.image || '',
        salla_url: sanitizeUrl(clean.salla_url) || '', salla_store_id: clean.salla_store_id || '',
        salla_product_id: clean.salla_product_id || '', salla_label: clean.salla_label || '',
        category: clean.category || '', sort_order: clean.sort_order || 0,
        is_active: clean.is_active !== undefined ? clean.is_active : 1, created_at: now
    };
    await db.collection('products').doc(String(id)).set(productData);
    return { id, ...productData };
}

async function getProductsByMerchant(merchantId) {
    const snap = await db.collection('products')
        .where('merchant_id', '==', merchantId).get();
    return snap.docs.map(d => d.data()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

async function getActiveProductsByMerchant(merchantId) {
    const snap = await db.collection('products')
        .where('merchant_id', '==', merchantId).where('is_active', '==', 1).get();
    return snap.docs.map(d => d.data()).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

async function updateProduct(id, data) {
    const clean = sanitizeTextFields(data, 0);
    await db.collection('products').doc(String(id)).update(clean);
}

async function deleteProductByIdAndMerchant(id, merchantId) {
    const doc = await db.collection('products').doc(String(id)).get();
    if (doc.exists && doc.data().merchant_id === merchantId) await doc.ref.delete();
}

async function toggleProductActive(id, merchantId) {
    const doc = await db.collection('products').doc(String(id)).get();
    if (doc.exists && doc.data().merchant_id === merchantId) {
        await doc.ref.update({ is_active: doc.data().is_active === 1 ? 0 : 1 });
    }
}

async function getMaxProductSortOrder(merchantId) {
    const snap = await db.collection('products')
        .where('merchant_id', '==', merchantId).get();
    if (snap.empty) return 0;
    return Math.max(...snap.docs.map(d => d.data().sort_order || 0));
}

async function deleteProductsByMerchant(merchantId) {
    const snap = await db.collection('products').where('merchant_id', '==', merchantId).get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    if (!snap.empty) await batch.commit();
}

async function getProductByIdAndMerchant(id, merchantId) {
    const doc = await db.collection('products').doc(String(id)).get();
    if (!doc.exists) return null;
    const data = doc.data();
    return data.merchant_id === merchantId ? data : null;
}

// ===== Files (images stored in Firestore) =====
async function saveFile(buffer, originalName, folder) {
    const sharp = require('sharp');
    const { v4: uuidv4 } = require('uuid');
    const fileId = uuidv4();

    // Compress & resize image to WebP (keeps size well under Firestore 1MB doc limit)
    const maxDimensions = {
        profiles: { width: 400, height: 400 },
        covers: { width: 1200, height: 400 },
        backgrounds: { width: 1200, height: 800 },
        products: { width: 600, height: 600 }
    };
    const dim = maxDimensions[folder] || { width: 800, height: 800 };

    const compressed = await sharp(buffer)
        .resize(dim.width, dim.height, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

    const base64 = compressed.toString('base64');

    await db.collection('files').doc(fileId).set({
        data: base64,
        contentType: 'image/webp',
        folder,
        originalName,
        size: compressed.length,
        createdAt: new Date().toISOString()
    });

    return `/uploads/${fileId}`;
}

// Save a raw file (video/image) without compression. Keeps content-type as-is.
// Caller must ensure file size is within Firestore document limits (~900KB safe).
async function saveRawFile(buffer, originalName, folder, contentType) {
    const { v4: uuidv4 } = require('uuid');
    const fileId = uuidv4();
    const base64 = buffer.toString('base64');
    await db.collection('files').doc(fileId).set({
        data: base64,
        contentType: contentType || 'application/octet-stream',
        folder,
        originalName,
        size: buffer.length,
        createdAt: new Date().toISOString()
    });
    return `/uploads/${fileId}`;
}

async function getFile(fileId) {
    const doc = await db.collection('files').doc(fileId).get();
    return doc.exists ? doc.data() : null;
}

async function deleteFile(fileId) {
    if (fileId && fileId.startsWith('/uploads/')) {
        const id = fileId.replace('/uploads/', '');
        await db.collection('files').doc(id).delete();
    }
}

// ===== Login Rate Limiting (stored in Firestore) =====
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_BAN_MINUTES = 3;

async function getLoginAttempts(email) {
    const docId = email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    const doc = await db.collection('login_attempts').doc(docId).get();
    if (!doc.exists) return null;
    return doc.data();
}

async function recordFailedLogin(email) {
    const docId = email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    const ref = db.collection('login_attempts').doc(docId);
    const doc = await ref.get();
    const now = new Date().toISOString();

    if (doc.exists) {
        const data = doc.data();
        // If ban expired, reset
        if (data.banned_until && new Date(data.banned_until) <= new Date()) {
            await ref.set({ email: email.toLowerCase(), attempts: 1, last_attempt: now, banned_until: '' });
            return { attempts: 1, banned: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
        }
        const newAttempts = (data.attempts || 0) + 1;
        const updateData = { attempts: newAttempts, last_attempt: now };
        if (newAttempts >= LOGIN_MAX_ATTEMPTS) {
            const banUntil = new Date(Date.now() + LOGIN_BAN_MINUTES * 60 * 1000).toISOString();
            updateData.banned_until = banUntil;
            updateData.attempts = 0;
            await ref.update(updateData);
            return { attempts: newAttempts, banned: true, remaining: 0, banned_until: banUntil };
        }
        await ref.update(updateData);
        return { attempts: newAttempts, banned: false, remaining: LOGIN_MAX_ATTEMPTS - newAttempts };
    } else {
        await ref.set({ email: email.toLowerCase(), attempts: 1, last_attempt: now, banned_until: '' });
        return { attempts: 1, banned: false, remaining: LOGIN_MAX_ATTEMPTS - 1 };
    }
}

async function checkLoginBan(email) {
    const data = await getLoginAttempts(email);
    if (!data) return { banned: false, attempts: 0, remaining: LOGIN_MAX_ATTEMPTS };
    if (data.banned_until && new Date(data.banned_until) > new Date()) {
        const remainMs = new Date(data.banned_until) - new Date();
        const remainMin = Math.ceil(remainMs / 60000);
        return { banned: true, remaining: 0, minutes_left: remainMin };
    }
    // If ban expired, treat as fresh
    if (data.banned_until && new Date(data.banned_until) <= new Date()) {
        return { banned: false, attempts: 0, remaining: LOGIN_MAX_ATTEMPTS };
    }
    return { banned: false, attempts: data.attempts || 0, remaining: LOGIN_MAX_ATTEMPTS - (data.attempts || 0) };
}

async function clearLoginAttempts(email) {
    const docId = email.toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
    const ref = db.collection('login_attempts').doc(docId);
    const doc = await ref.get();
    if (doc.exists) await ref.delete();
}

module.exports = {
    db, admin,
    createMerchant, getMerchantById, getMerchantByEmail, getMerchantByUsername,
    getMerchantByUsernameNotBanned, getMerchantByEmailOrUsername,
    updateMerchant, deleteMerchant, getAllMerchants, searchMerchants,
    getDirectoryMerchants, countMerchants, getFeaturedMerchants, getFirstAdmin, getFirstMerchant,
    createLink, getLinkById, getLinkByIdAndMerchant, getLinksByMerchant,
    updateLink, deleteLink, deleteLinkByIdAndMerchant, deleteLinksByMerchant,
    toggleLinkActive, incrementLinkClick, getMaxLinkSortOrder, countLinks, sumClicksByMerchant,
    createSection, getSectionsByMerchant, getMaxSectionSortOrder,
    deleteSectionByIdAndMerchant, deleteSectionsByMerchant,
    createPageView, countPageViews, countAllPageViews,
    countPageViewsToday, countPageViewsWeek, countPageViewsMonth, deletePageViewsByMerchant,
    createTicket, getTicketsByMerchant, getAllTicketsWithMerchant,
    replyToTicket, closeTicket, countOpenTickets, deleteTicketsByMerchant,
    createNotification, getNotifications, deleteNotification,
    createProduct, getProductsByMerchant, getActiveProductsByMerchant,
    updateProduct, deleteProductByIdAndMerchant, toggleProductActive,
    getMaxProductSortOrder, deleteProductsByMerchant, getProductByIdAndMerchant,
    saveFile, saveRawFile, getFile, deleteFile,
    checkLoginBan, recordFailedLogin, clearLoginAttempts,
};
