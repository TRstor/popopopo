// ========== TR Store - Links Page Script ==========

document.addEventListener('DOMContentLoaded', () => {
    // Configuration - Update these links with actual URLs
    const links = {
        store: '#',          // رابط المتجر الإلكتروني
        whatsapp: '#',       // رابط واتس آب
        tiktok: '#',         // رابط تيكتوك
        telegram: '#',       // رابط تليجرام
        snapchat: '#',       // رابط سناب شات
        instagram: '#',      // رابط انستقرام
        facebook: '#',       // رابط فيسبوك
        twitter: '#',        // رابط تويتر
    };

    // Apply links from config
    const linkMap = {
        '.main-store-btn': links.store,
        '.whatsapp-btn': links.whatsapp,
        '.tiktok-btn': links.tiktok,
        '.telegram-btn': links.telegram,
        '.snapchat-btn': links.snapchat,
        '.instagram-btn': links.instagram,
        '.social-icon.facebook': links.facebook,
        '.social-icon.twitter': links.twitter,
        '.social-icon.instagram': links.instagram,
        '.social-icon.tiktok': links.tiktok,
    };

    for (const [selector, url] of Object.entries(linkMap)) {
        const el = document.querySelector(selector);
        if (el && url !== '#') {
            el.href = url;
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
        }
    }

    // Add click ripple effect
    document.querySelectorAll('.link-btn').forEach(btn => {
        btn.addEventListener('click', function (e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;

            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255,255,255,0.2);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
                pointer-events: none;
            `;

            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // Add ripple keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.link-btn').forEach(btn => {
        observer.observe(btn);
    });
});
