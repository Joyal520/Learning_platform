// assets/js/ui.js
import { Auth } from './auth.js?v=11';
import { supabase } from './supabase.js?v=11';
import { AvatarLibrary } from './avatars.js?v=11';

export const UI = {
    defaultThumbnailIcons: {
        stories: '/assets/images/story.png',
        writing: '/assets/images/writing.png',
        literature: '/assets/images/literature.png',
        lessons: '/assets/images/learning.png',
        learning: '/assets/images/learning.png',
        media: '/assets/images/media.png',
        fun: '/assets/images/fun.png'
    },
    _audioR2PublicBaseUrlPromise: null,

    contentTypeOptions: [
        { value: 'short_stories', label: 'Short Story', navLabel: 'Short Stories', group: 'Stories' },
        { value: 'long_stories', label: 'Long Story', navLabel: 'Long Stories', group: 'Stories' },
        { value: 'essays', label: 'Essay', navLabel: 'Essays', group: 'Writing' },
        { value: 'articles', label: 'Article', navLabel: 'Articles', group: 'Writing' },
        { value: 'speech', label: 'Speech', navLabel: 'Speech', group: 'Writing' },
        { value: 'poems', label: 'Poem', navLabel: 'Poems', group: 'Literature' },
        { value: 'classroom_play', label: 'Classroom Play', navLabel: 'Classroom Plays', group: 'Literature' },
        { value: 'conversations', label: 'Conversation', navLabel: 'Conversations', group: 'Literature' },
        { value: 'lessons', label: 'Lessons', navLabel: 'Lessons', group: 'Lessons' },
        { value: 'flashcards', label: 'Flashcards', navLabel: 'Flashcards', group: 'Learning Tools' },
        { value: 'quiz', label: 'Quiz', navLabel: 'Quizzes', group: 'Learning Tools' },
        { value: 'presentations', label: 'Presentation', navLabel: 'Presentations', group: 'Learning Tools' },
        { value: 'puzzle', label: 'Puzzle', navLabel: 'Puzzles', group: 'Fun' },
        { value: 'game', label: 'Game', navLabel: 'Games', group: 'Fun' },
        { value: 'images', label: 'Image', navLabel: 'Images', group: 'Media' },
        { value: 'songs', label: 'Audio', navLabel: 'Audio', group: 'Media' }
    ],

    themeOptions: [
        'Motivational',
        'Inspirational',
        'Educational',
        'Emotional',
        'Fantasy',
        'Mystery',
        'Technology',
        'Social Awareness',
        'Other'
    ],

    lessonThemeOptions: ['Science', 'Maths', 'ICT', 'English'],

    audienceLevels: ['Beginner', 'Intermediate', 'Advanced'],

    init() {
        this.setupMobileMenu();

        // Hidden Debug Tool for PWA: long press the logo
        const logo = document.getElementById('nav-home');
        if (logo) {
            let pressTimer;
            logo.addEventListener('touchstart', () => {
                pressTimer = setTimeout(() => {
                    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
                    alert(`PWA State on Mobile:\n- pwaInstallReady: ${window.pwaInstallReady}\n- deferredPrompt: ${!!window.deferredPrompt}\n- isStandalone: ${isStandalone}\n- UA: ${navigator.userAgent.substring(0, 50)}...`);
                }, 2000);
            });
            logo.addEventListener('touchend', () => clearTimeout(pressTimer));
        }
    },

    setupMobileMenu() {
        const toggle = document.getElementById('menu-toggle');
        const nav = document.querySelector('.main-nav');
        const navLinks = document.getElementById('nav-links');
        const navAuth = document.getElementById('nav-auth');

        console.log('[Mobile Nav] hamburger found:', !!toggle);
        console.log('[Mobile Nav] mobile menu found:', !!nav && !!navLinks && !!navAuth);

        if (!toggle || !nav || !navLinks || !navAuth || toggle.dataset.mobileMenuBound === 'true') {
            return;
        }

        let lastTouchToggleAt = 0;
        const setMenuState = (isOpen) => {
            nav.classList.toggle('mobile-open', isOpen);
            toggle.setAttribute('aria-expanded', String(isOpen));
            console.log(`[Mobile Nav] menu ${isOpen ? 'opened' : 'closed'}`);
        };

        const handleToggle = (source) => {
            if (window.innerWidth <= 768) {
                setMenuState(false);
                return;
            }
            const isOpen = !nav.classList.contains('mobile-open');
            console.log(`[Mobile Nav] hamburger clicked (${source})`);
            setMenuState(isOpen);
        };

        toggle.addEventListener('touchend', (event) => {
            event.preventDefault();
            lastTouchToggleAt = Date.now();
            handleToggle('touch');
        }, { passive: false });

        toggle.addEventListener('click', (event) => {
            if (Date.now() - lastTouchToggleAt < 500) {
                return;
            }

            event.preventDefault();
            handleToggle('click');
        });

        window.addEventListener('resize', () => {
            if (nav.classList.contains('mobile-open')) {
                setMenuState(false);
            }
        });

        toggle.dataset.mobileMenuBound = 'true';
    },

    // Hero Animations: Cycling Subtitle + Confetti Dots
    // =============================================
    initHeroAnimations() {
        if (this._cyclingSubtitleInterval) {
            clearInterval(this._cyclingSubtitleInterval);
            this._cyclingSubtitleInterval = null;
        }
        this._initCyclingSubtitle();
        this._initHeroEffects();
    },

    // =============================================
    // NEW Hero Effects: Parallax + CSS Particles
    // =============================================
    _initHeroEffects() {
        const hero = document.querySelector('.hero');
        if (!hero) return;

        // Check prefers-reduced-motion
        const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (isReducedMotion) return;

        this._initHeroParticles(hero);
        this._initHeroParallax(hero);
        this._initHeroFullscreen(hero);
        this._initHeroCardTilt(hero);
    },




    _initHeroParticles(hero) {
        const container = hero.querySelector('.particles');
        if (!container) return;

        container.innerHTML = '';
        // Skip particles entirely on mobile for performance
        if (window.innerWidth < 768) return;
        const count = 20; // Reduced for smooth performance

        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';

            const size = Math.random() * 4 + 2; // 2px to 6px
            const left = Math.random() * 100;
            const duration = Math.random() * 10 + 12; // 12s to 22s — slower, smoother
            const delay = Math.random() * -duration;

            Object.assign(p.style, {
                width: `${size}px`,
                height: `${size}px`,
                left: `${left}%`,
                bottom: '-20px',
                animationDuration: `${duration}s`,
                animationDelay: `${delay}s`,
                opacity: '0' // Handled by animation
            });

            container.appendChild(p);
        }
    },



    _initHeroFullscreen(hero) {
        const btn = hero.querySelector('.hero-fullscreen-btn');
        if (!btn || btn.dataset.fullscreenBound === 'true') return;

        btn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch((err) => {
                    console.error(`Error attempting to enable full-screen mode: ${err.message}`);
                });
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                }
            }
        });

        // Update icon based on state
        if (!this._heroFullscreenChangeHandler) {
            this._heroFullscreenChangeHandler = () => {
                const activeBtn = document.querySelector('.hero-fullscreen-btn');
                if (!activeBtn) return;

                const isFull = !!document.fullscreenElement;
                activeBtn.innerHTML = isFull ?
                    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>` :
                    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`;
            };
            document.addEventListener('fullscreenchange', this._heroFullscreenChangeHandler);
        }

        btn.dataset.fullscreenBound = 'true';
    },



    _initHeroParallax(hero) {
        return; // Parallax effect removed as requested

        let isVisible = false;
        let ticking = false;

        const observer = new IntersectionObserver((entries) => {
            isVisible = entries[0].isIntersecting;
        }, { threshold: 0.1 });

        observer.observe(hero);

        const updateParallax = () => {
            if (!isVisible) {
                ticking = false;
                return;
            }

            const y = window.scrollY * 0.08;
            const clampedY = Math.max(-15, Math.min(15, y)); // Slightly tighter clamp

            // Using translate3d for better GPU utilization
            bg.style.transform = `scale(1.08) translate3d(0, ${clampedY}px, 0)`;
            ticking = false;
        };

        const onScroll = () => {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });

        // Optimization: Disable parallax if "Reduced Motion" is enabled
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            window.removeEventListener('scroll', onScroll);
        }

        // Clean up on navigation
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            const observer = new MutationObserver(() => {
                window.removeEventListener('scroll', onScroll);
                observer.disconnect();
            });
            observer.observe(mainContent, { childList: true });
        }
    },

    _initHeroCardTilt(hero) {
        // Parallax tilt removed — glass card is stable, hover animation via CSS only
        return;
    },



    // --- Cycling Subtitle ---
    // Phrases and timing are adjustable here
    _initCyclingSubtitle() {
        const el = document.getElementById('cycling-subtitle');
        if (!el) return;

        // Check prefers-reduced-motion
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const phrases = [
            'Where Stories Live',
            'Where Ideas Grow',
            'Where Voices Matter',
            'Where Creativity Wins'
        ];
        const VISIBLE_DURATION = 2000;   // ms each phrase is shown
        const TRANSITION_MS = 400;        // ms for fade transition
        let index = 0;

        this._cyclingSubtitleInterval = setInterval(() => {
            // Fade out
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px)';

            setTimeout(() => {
                if (!document.body.contains(el)) return;
                index = (index + 1) % phrases.length;
                el.textContent = phrases[index];
                // Fade in
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, TRANSITION_MS);
        }, VISIBLE_DURATION + TRANSITION_MS);
    },

    // --- Colorful Confetti Dots Canvas ---
    // Inspired by the Antigravity success page confetti effect
    _initConfettiCanvas() {
        // Disabled in favor of lightweight CSS particles
        return;
    },


    showLoader() { document.getElementById('loader')?.classList.remove('hidden'); },
    hideLoader() { document.getElementById('loader')?.classList.add('hidden'); },

    normalizeCategoryValue(category = '', contentType = '') {
        const raw = String(category || contentType || '').trim().toLowerCase();
        const aliasMap = {
            short_story: 'short_stories',
            long_story: 'long_stories',
            comic: 'short_stories',
            comics: 'short_stories',
            essay: 'essays',
            article: 'articles',
            poem: 'poems',
            classroom_plays: 'classroom_play',
            conversation: 'conversations',
            lesson: 'lessons',
            presentation: 'presentations',
            puzzles: 'puzzle',
            games: 'game',
            image: 'images',
            audio: 'songs',
            audios: 'songs',
            song: 'songs',
            songs: 'songs'
        };

        return aliasMap[raw] || raw || 'songs';
    },

    getContentTypeOption(category, contentType = '') {
        const normalized = this.normalizeCategoryValue(category, contentType);
        return this.contentTypeOptions.find((option) => option.value === normalized) || null;
    },

    getContentTypeLabel(category, contentType = '') {
        const option = this.getContentTypeOption(category, contentType);
        if (option) return option.label;

        const raw = String(category || contentType || '').trim();
        return raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : 'Audio';
    },

    getCategoryNavLabel(category, contentType = '') {
        return this.getContentTypeOption(category, contentType)?.navLabel || this.getContentTypeLabel(category, contentType);
    },

    getCategoryColor(category, contentType = '') {
        const normalized = this.normalizeCategoryValue(category, contentType);
        const colorMap = {
            short_stories: '#6366f1',
            long_stories: '#8b5cf6',
            essays: '#14b8a6',
            articles: '#f59e0b',
            speech: '#38bdf8',
            poems: '#a855f7',
            classroom_play: '#fb7185',
            conversations: '#06b6d4',
            flashcards: '#f59e0b',
            lessons: '#0ea5e9',
            quiz: '#8b5cf6',
            presentations: '#7c3aed',
            puzzle: '#f97316',
            game: '#10b981',
            images: '#22c55e',
            songs: '#64748b'
        };

        return colorMap[normalized] || '#64748b';
    },

    getCategoryEmoji(category, contentType = '') {
        const normalized = this.normalizeCategoryValue(category, contentType);
        const map = {
            short_stories: '📖',
            long_stories: '📖',
            essays: '📝',
            articles: '📰',
            speech: '🎤',
            poems: '📜',
            classroom_play: '🎭',
            conversations: '💬',
            flashcards: '🧠',
            lessons: '📘',
            quiz: '📊',
            presentations: '🖥️',
            puzzle: '🧩',
            game: '🎮',
            images: '🖼️',
            songs: '🎵'
        };

        return map[normalized] || '📄';
    },

    getCategoryFallbackKey(category, contentType = '') {
        const normalized = this.normalizeCategoryValue(category, contentType);
        const fallbackCategoryMap = {
            short_stories: 'stories',
            long_stories: 'stories',
            essays: 'writing',
            articles: 'writing',
            speech: 'writing',
            poems: 'literature',
            classroom_play: 'literature',
            conversations: 'literature',
            flashcards: 'learning',
            lessons: 'lessons',
            quiz: 'learning',
            presentations: 'learning',
            puzzle: 'fun',
            game: 'fun',
            songs: 'media',
            images: 'media'
        };

        return fallbackCategoryMap[normalized] || String(category || '').toLowerCase();
    },

    getThumbnailFallbackPath(category, contentType = '') {
        const categoryKey = this.getCategoryFallbackKey(category, contentType);
        return this.defaultThumbnailIcons[categoryKey] || '/assets/images/default.png';
    },

    getThumbnailFallbackUrl(sub) {
        return this.resolveMediaUrl(this.getThumbnailFallbackPath(sub?.category, sub?.content_type));
    },

    getContentModeOptions(category, contentType = '') {
        const normalized = this.normalizeCategoryValue(category, contentType);
        const writingTypes = new Set([
            'short_stories',
            'long_stories',
            'essays',
            'articles',
            'speech',
            'poems',
            'classroom_play',
            'conversations'
        ]);
        const toolTypes = new Set([
            'flashcards',
            'lessons',
            'quiz',
            'presentations',
            'puzzle',
            'game'
        ]);

        if (normalized === 'images') {
            return { file: true, text: false, code: false, useImageUploader: true };
        }
        if (normalized === 'songs') {
            return { file: true, text: false, code: false, useImageUploader: false };
        }
        if (toolTypes.has(normalized)) {
            return { file: true, text: false, code: true, useImageUploader: false };
        }
        if (writingTypes.has(normalized)) {
            return { file: true, text: true, code: true, useImageUploader: false };
        }

        return { file: true, text: true, code: true, useImageUploader: false };
    },

    getExploreCategoryMeta() {
        const lessonsChildren = this.lessonThemeOptions.map((theme) => ({
            label: theme,
            category: 'lessons',
            theme
        }));
        const learningToolChildren = this.contentTypeOptions
            .filter((option) => option.group === 'Learning Tools')
            .map((option) => ({
                label: option.navLabel,
                category: option.value
            }));

        return [
            { type: 'all', label: 'All Works', category: 'all', icon: 'grid' },
            { type: 'group', label: 'Stories', group: 'Stories', icon: 'book', badgeClass: 'stories' },
            { type: 'group', label: 'Writing', group: 'Writing', icon: 'pen', badgeClass: 'writing' },
            { type: 'group', label: 'Literature', group: 'Literature', icon: 'library', badgeClass: 'literature' },
            { type: 'group', label: 'Lessons', group: 'Lessons', icon: 'book', badgeClass: 'lessons', children: lessonsChildren },
            { type: 'group', label: 'Learning Tools', group: 'Learning Tools', icon: 'lightbulb', badgeClass: 'learning', children: learningToolChildren },
            { type: 'group', label: 'Fun', group: 'Fun', icon: 'sparkles', badgeClass: 'fun' },
            { type: 'group', label: 'Media', group: 'Media', icon: 'play', badgeClass: 'media' }
        ];
    },

    renderExploreCategoryIcon(iconName) {
        const icons = {
            grid: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
                </svg>
            `,
            book: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h4.5a3.5 3.5 0 0 1 3 1.7A3.5 3.5 0 0 1 17.5 3H20a1 1 0 0 1 1 1v13.5a1 1 0 0 1-1 1h-2.5a3.5 3.5 0 0 0-3 1.7 3.5 3.5 0 0 0-3-1.7H7A2.5 2.5 0 0 1 4.5 16V5.5Z"></path>
                    <path d="M12 4.5v14"></path>
                    <path d="M8 8h2.5"></path>
                    <path d="M15.5 8H18"></path>
                </svg>
            `,
            pen: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m4 20 3.2-.8L18.4 8a2.2 2.2 0 0 0-3.1-3.1L4.1 16.1 4 20Z"></path>
                    <path d="m13.5 6.5 4 4"></path>
                    <path d="M4 20 9.5 18.5"></path>
                </svg>
            `,
            library: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 20h16"></path>
                    <path d="M6 18V7.2a1.2 1.2 0 0 1 1.2-1.2H9v12"></path>
                    <path d="M10 18V5.2A1.2 1.2 0 0 1 11.2 4H14v14"></path>
                    <path d="M15 18V8.2A1.2 1.2 0 0 1 16.2 7H18v11"></path>
                </svg>
            `,
            lightbulb: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 18h6"></path>
                    <path d="M10 22h4"></path>
                    <path d="M12 2v2"></path>
                    <path d="M5.6 5.6 7 7"></path>
                    <path d="M18.4 5.6 17 7"></path>
                    <path d="M4 12h2"></path>
                    <path d="M18 12h2"></path>
                    <path d="M9 18v-1.5c0-.9-.4-1.8-1.1-2.4A5.5 5.5 0 1 1 16.1 14c-.7.6-1.1 1.5-1.1 2.4V18"></path>
                </svg>
            `,
            sparkles: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z"></path>
                    <path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"></path>
                    <path d="m19 13 .9 2.6L22.5 17l-2.6.9L19 20.5l-.9-2.6L15.5 17l2.6-.9L19 13Z"></path>
                </svg>
            `,
            play: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="3" width="18" height="18" rx="6"></rect>
                    <path d="m10 8 6 4-6 4V8Z"></path>
                </svg>
            `,
            chevron: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="m9 6 6 6-6 6"></path>
                </svg>
            `
        };

        return icons[iconName] || icons.grid;
    },

    renderExploreCategoryFilters() {
        return this.getExploreCategoryMeta().map((item) => {
            if (item.type === 'all') {
                return `
                    <button class="clay-btn category-card category-clay-item category-card-all active" data-category="all">
                        <span class="category-card-icon category-icon-grid">${this.renderExploreCategoryIcon(item.icon)}</span>
                        <span class="category-card-name">${item.label.toUpperCase()}</span>
                        <span class="category-card-arrow">${this.renderExploreCategoryIcon('chevron')}</span>
                    </button>
                `;
            }

            const options = item.children || this.contentTypeOptions
                .filter((option) => option.group === item.group)
                .map((option) => ({
                    label: option.navLabel,
                    category: option.value
                }));
            const groupId = item.group.toLowerCase().replace(/\s+/g, '-');

            return `
                <div class="category-filter-group" data-group="${groupId}">
                    <button class="clay-btn category-card category-parent-toggle" type="button" data-group="${groupId}" data-group-filter="${item.group}" aria-expanded="false">
                        <span class="category-card-icon category-icon-${item.icon}">${this.renderExploreCategoryIcon(item.icon)}</span>
                        <span class="category-card-name">${item.label.toUpperCase()}</span>
                        <span class="category-count category-count-${item.badgeClass}">${options.length}</span>
                    </button>
                    <div class="category-children" data-group-children="${groupId}">
                        ${options.map((option) => `
                            <button class="clay-btn category-clay-item category-child-item" data-category="${option.category}"${option.theme ? ` data-theme="${option.theme}"` : ''}>
                                <span class="category-child-label">${option.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    renderContentTypeOptions() {
        return this.contentTypeOptions.map((option) =>
            `<option value="${option.value}">${option.label}</option>`
        ).join('');
    },

    getThemeOptionsForCategory(category = '', contentType = '') {
        const normalized = this.normalizeCategoryValue(category, contentType);
        return normalized === 'lessons' ? this.lessonThemeOptions : this.themeOptions;
    },

    renderThemeOptions(category = '', selectedThemes = []) {
        const selectedThemeSet = new Set(selectedThemes);
        return this.getThemeOptionsForCategory(category).map((theme) =>
            `<div class="theme-option"><label><input type="checkbox" name="themes" value="${theme}"${selectedThemeSet.has(theme) ? ' checked' : ''}> ${theme}</label></div>`
        ).join('');
    },

    renderAudienceOptions() {
        return this.audienceLevels.map((level) => `<option value="${level}">${level}</option>`).join('');
    },

    wrapCodeForPreview(code) {
        if (!code) return '';
        const trimmed = code.trim();
        const isFullHtml = trimmed.toLowerCase().startsWith('<!doctype') ||
            (trimmed.toLowerCase().includes('<html') && trimmed.toLowerCase().includes('</html>'));

        if (isFullHtml) return code;

        // Otherwise, wrap in a React/Babel-friendly template
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0",
        "react-dom": "https://esm.sh/react-dom@18.2.0",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client"
      }
    }
    </script>
    <style>
        body { margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; color: #333; }
        #root { min-height: 100vh; }
        .preview-loading { position: fixed; top: 10px; right: 10px; background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #6b7280; }
    </style>
</head>
<body>
    <div id="root"></div>
    <div id="loading" class="preview-loading">Initializing preview...</div>
    
    <script type="text/babel" data-type="module">
        // Global error capture for the user's script
        window.onerror = function(message, source, lineno, colno, error) {
            const rootEl = document.getElementById('root');
            if (rootEl) {
                rootEl.innerHTML = \`<div style="color:#e11d48; padding:20px; border:1px solid #fda4af; background:#fff1f2; border-radius:8px; font-family:sans-serif;">
                    <h3 style="margin-top:0">🚀 Preview Error</h3>
                    <p>The code could not be rendered:</p>
                    <pre style="background:#000; color:#fff; padding:15px; border-radius:4px; overflow:auto; white-space:pre-wrap;">\${(error || message).toString()}</pre>
                </div>\`;
            }
            document.getElementById('loading').style.display = 'none';
        };

        try {
            // Scroll tracking for fullscreen button
            window.addEventListener('scroll', function(e) {
                const target = e.target;
                const scrollElem = target === document ? document.documentElement : target;
                const isTop = scrollElem.scrollTop <= 50;
                const isBottom = Math.abs(scrollElem.scrollHeight - scrollElem.scrollTop - scrollElem.clientHeight) <= 50;
                if (isTop || isBottom) {
                    window.parent.postMessage({ type: 'SHOW_CLOSE_BTN' }, '*');
                } else {
                    window.parent.postMessage({ type: 'HIDE_CLOSE_BTN' }, '*');
                }
            }, true);
            // Mouse tracking fallback for desktop
            window.addEventListener('mousemove', function(e) {
                if (e.clientY <= 60) window.parent.postMessage({ type: 'SHOW_CLOSE_BTN' }, '*');
            });
            // Show initially just in case it doesn't scroll
            setTimeout(() => window.parent.postMessage({ type: 'SHOW_CLOSE_BTN' }, '*'), 500);

            // --- User Code Start ---
            ${code}
            // --- User Code End ---

            // Expose commonly named components to window so the auto-renderer can find them
            if (typeof App !== 'undefined') window._App = App;
            if (typeof Main !== 'undefined') window._App = Main;
        } catch (e) {
            window.onerror(e.message, null, null, null, e);
        }
    </script>

    <script type="text/babel" data-type="module">
        (async () => {
            const rootEl = document.getElementById('root');
            if (!rootEl) return;

            // Wait for user script to run
            setTimeout(async () => {
                document.getElementById('loading').style.display = 'none';
                
                // If nothing rendered yet, try to auto-render App/Main
                if (rootEl.innerHTML === '' && window._App) {
                    try {
                        const { default: r } = await import('react');
                        const { createRoot: cr } = await import('react-dom/client');
                        cr(rootEl).render(r.createElement(window._App));
                    } catch (e) {
                        console.warn('Auto-render failed:', e);
                    }
                }
            }, 300);
        })();
    </script>
</body>
</html>`;
    },

    renderContentPreview(sub) {
        // High-performance display image priority
        const displayUrl = sub.image_url || sub.public_url || sub.thumbnail_url || sub.thumbnail_path;

        if (sub.file_type === 'text/html' && sub.content_text) {
            const wrappedCode = this.wrapCodeForPreview(sub.content_text);
            return `<div class="code-preview-container" id="previewContainer">
                        <div class="preview-header">
                            <div class="preview-dots"><span></span><span></span><span></span></div>
                            <div class="preview-label">CONTENT PREVIEW</div>
                            <button class="preview-fullscreen-btn btn-snake" id="previewFullscreenBtn" title="Toggle Fullscreen Mode">
                                <span></span><span></span><span></span><span></span>
                                ⛶ Fullscreen
                            </button>
                        </div>
                        <button class="fullscreen-close-btn" id="floatingCloseBtn" title="Exit Fullscreen">✕ Cancel</button>
                        <iframe class="code-preview-frame" sandbox="allow-scripts" srcdoc="${wrappedCode.replace(/"/g, '&quot;')}"></iframe>
                    </div>`;
        }
        if (sub.content_text) return `<div class="text-presentation">${sub.content_text}</div>`;

        if (sub.file_type?.startsWith('image/') && displayUrl) {
            return `<div class="image-presentation-container">
                        <img src="${displayUrl}" 
                             class="preview-img" 
                             alt="${sub.title}" 
                             decoding="async" 
                             fetchpriority="high">
                    </div>`;
        }

        if (sub.file_type?.startsWith('audio/')) return `<div class="audio-player-host" id="audioPlayerMount"></div>`;
        return `<div class="file-placeholder">📄 This content is a ${sub.file_type || 'file'} and can be downloaded below.</div>`;
    },

    renderStars(rating) {
        return [1, 2, 3, 4, 5].map(i => `
            <span class="star ${i <= Math.round(rating) ? 'active' : ''}" data-value="${i}">★</span>
        `).join('');
    },

    resolveMediaUrl(pathOrUrl) {
        if (!pathOrUrl) return null;
        if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http')) return pathOrUrl;
        if (pathOrUrl.startsWith('/assets/') || pathOrUrl.startsWith('assets/')) {
            return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
        }

        const { data } = supabase.storage.from('approved_public').getPublicUrl(pathOrUrl);
        return data.publicUrl;
    },

    appendCacheBust(url, submission) {
        if (!url || !url.includes('supabase.co')) return url;
        return `${url}${url.includes('?') ? '&' : '?'}t=${new Date(submission.updated_at || submission.created_at).getTime()}`;
    },

    getSubmissionImageUrls(sub) {
        const normalized = this.normalizeCategoryValue(sub?.category, sub?.content_type);
        const thumbnailValue = String(
            sub?.thumbnail
            || sub?.thumbnail_url
            || sub?.thumbnail_path
            || ''
        ).trim();
        const customThumbnailUrl = thumbnailValue !== '' ? this.resolveMediaUrl(thumbnailValue) : null;
        const uploadedImageUrl = this.resolveMediaUrl(sub?.image_url || sub?.public_url || sub?.file_url || sub?.file_path);
        const defaultThumbnailUrl = this.getThumbnailFallbackUrl(sub);
        const category = this.getCategoryFallbackKey(sub?.category, sub?.content_type);

        const imageSrc = thumbnailValue !== ''
            ? customThumbnailUrl
            : this.defaultThumbnailIcons[category] || '/assets/images/default.png';

        console.log('Thumbnail used:', imageSrc);

        const previewUrl = imageSrc || defaultThumbnailUrl;

        const fullUrl = uploadedImageUrl || customThumbnailUrl || defaultThumbnailUrl;

        return {
            previewUrl: this.appendCacheBust(previewUrl, sub),
            fullUrl: this.appendCacheBust(fullUrl || previewUrl, sub)
        };
    },

    async getAudioR2PublicBaseUrl() {
        if (!this._audioR2PublicBaseUrlPromise) {
            this._audioR2PublicBaseUrlPromise = fetch('/api/r2-public-config')
                .then(async (response) => {
                    const payload = await response.json().catch(() => ({}));
                    if (!response.ok || !payload.publicBaseUrl) {
                        throw new Error(payload.error || 'R2 public URL not available.');
                    }
                    return String(payload.publicBaseUrl).replace(/\/+$/, '');
                });
        }

        return this._audioR2PublicBaseUrlPromise;
    },

    async resolveAudioSourceUrl(submission) {
        if (submission?.file_url) {
            return submission.file_url;
        }

        if (submission?.storage_provider === 'r2' && submission?.file_path && !/^https?:\/\//i.test(submission.file_path)) {
            try {
                const publicBaseUrl = await this.getAudioR2PublicBaseUrl();
                return `${publicBaseUrl}/${String(submission.file_path).replace(/^\/+/, '')}`;
            } catch (error) {
                console.warn('[UI] Falling back from R2 audio source lookup:', error);
            }
        }

        if (submission?.file_path && !/^https?:\/\//i.test(submission.file_path)) {
            return this.resolveMediaUrl(submission.file_path);
        }

        return submission?.public_url || submission?.file_path || null;
    },

    renderAudioVisualizerMarkup() {
        const barHeights = [16, 30, 56, 74, 48, 22, 12, 18, 36, 58, 26, 12, 18, 34, 54, 42, 24, 68, 38, 22, 30, 48, 34];
        return barHeights.map((height, index) => `
            <span class="audio-feed-wave-bar" style="--bar-height:${height}px; --bar-index:${index};"></span>
        `).join('');
    },

    looksLikeAudioAsset(value = '') {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return false;
        if (raw.startsWith('audio/')) return true;
        return /\.(mp3|wav|ogg|webm|m4a|aac)(?:$|[?#])/i.test(raw);
    },

    isAudioSubmission(sub = {}) {
        const normalizedCategory = this.normalizeCategoryValue(sub.category, sub.content_type);
        const normalizedContentType = this.normalizeCategoryValue(sub.content_type, sub.category);

        return normalizedCategory === 'songs'
            || normalizedContentType === 'songs'
            || this.looksLikeAudioAsset(sub.file_type)
            || this.looksLikeAudioAsset(sub.mime_type)
            || this.looksLikeAudioAsset(sub.file_path)
            || this.looksLikeAudioAsset(sub.file_url)
            || this.looksLikeAudioAsset(sub.public_url);
    },

    renderCard(sub, badgeObj = null) {
        const stats = sub.submission_stats?.[0] || { avg_rating: 0, like_count: 0, view_count: 0 };
        const normalizedCategory = this.normalizeCategoryValue(sub.category, sub.content_type);
        const color = this.getCategoryColor(sub.category, sub.content_type);
        const categoryLabel = this.getContentTypeLabel(sub.category, sub.content_type);
        const title = sub.title || 'Untitled';

        const { previewUrl, fullUrl } = this.getSubmissionImageUrls(sub);
        const thumbnailUrl = previewUrl;
        const fallbackThumbnailUrl = this.getThumbnailFallbackUrl(sub);

        const thumbnailHtml = thumbnailUrl
            ? `<div class="card-thumbnail-container">
                 <img src="${thumbnailUrl}" 
                      class="card-thumbnail-img" 
                      loading="lazy" 
                      decoding="async" 
                      alt="${title}"
                      onerror="if(this.dataset.fallbackApplied==='true'){this.style.opacity='0'; this.parentElement.querySelector('.card-thumb-gradient').style.display='flex'; return;} this.dataset.fallbackApplied='true'; this.src='${fallbackThumbnailUrl}';">
                 <div class="card-thumbnail card-thumb-gradient" style="display:none; background:linear-gradient(135deg, ${color}22, ${color}44); position:absolute; top:0; left:0;">
                    <span class="thumb-emoji">${this.getCategoryEmoji(sub.category, sub.content_type)}</span>
                 </div>
               </div>`
            : `<div class="card-thumbnail-container">
                <div class="card-thumbnail card-thumb-gradient" style="background:linear-gradient(135deg, ${color}22, ${color}44)">
                    <span class="thumb-emoji">${this.getCategoryEmoji(sub.category, sub.content_type)}</span>
                </div>
               </div>`;

        const badgeHtml = badgeObj ? `
            <div class="corner-badge ${badgeObj.className}">
                ${badgeObj.text}
            </div>
        ` : '';

        if (this.isAudioSubmission(sub)) {
            const authorName = sub.profiles?.display_name || 'Anonymous';
            const initials = authorName.charAt(0).toUpperCase();
            const shareUrl = this.createWhatsAppShareUrl(title, sub.id);
            const audioArtworkUrl = previewUrl || fullUrl || fallbackThumbnailUrl;
            const activeRating = Math.round(Number(stats.avg_rating) || 0);
            const ratingControls = Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                return `
                    <button class="audio-feed-rate-star ${value <= activeRating ? 'is-active' : ''}"
                            type="button"
                            data-audio-action="rate"
                            data-rating="${value}"
                            aria-label="Rate ${value} star${value === 1 ? '' : 's'}">★</button>
                `;
            }).join('');

            return `
                <article class="content-card clay-card audio-feed-card animate-fade-in" data-id="${sub.id}">
                    <div class="audio-feed-shell">
                        <div class="audio-feed-creator-row">
                            <div class="audio-feed-avatar">
                                ${sub.profiles?.avatar_url
                                    ? `<img src="${sub.profiles.avatar_url}" alt="${authorName}" class="audio-feed-avatar-img">`
                                    : `<span class="audio-feed-avatar-fallback">${initials}</span>`}
                            </div>
                            <div class="audio-feed-creator-copy">
                                <h3 class="audio-feed-creator-name">${authorName}</h3>
                            </div>
                        </div>

                        <div class="audio-feed-media">
                            <img src="${audioArtworkUrl}"
                                 class="audio-feed-cover"
                                 loading="lazy"
                                 decoding="async"
                                 alt="${title}"
                                 onerror="if(this.dataset.fallbackApplied==='true'){return;} this.dataset.fallbackApplied='true'; this.src='${fallbackThumbnailUrl}';">
                            <div class="audio-feed-media-overlay"></div>
                            <div class="audio-feed-media-sheen"></div>
                            <span class="audio-feed-badge">${categoryLabel}</span>

                            <div class="audio-feed-wave" aria-hidden="true">
                                ${this.renderAudioVisualizerMarkup()}
                            </div>

                            <button class="audio-feed-play" type="button" data-audio-action="toggle" aria-label="Play audio">
                                <span class="audio-feed-play-icon audio-feed-play-icon-play">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M8 6.5v11l9-5.5z"></path>
                                    </svg>
                                </span>
                                <span class="audio-feed-play-icon audio-feed-play-icon-pause">
                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                        <path d="M8 6h3.5v12H8z"></path>
                                        <path d="M12.5 6H16v12h-3.5z"></path>
                                    </svg>
                                </span>
                            </button>

                            <button class="audio-feed-loop" type="button" data-audio-action="loop" aria-label="Enable loop">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M17 1l4 4-4 4"></path>
                                    <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                                    <path d="M7 23l-4-4 4-4"></path>
                                    <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                                </svg>
                            </button>

                            <div class="audio-feed-progress" data-audio-action="seek" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                                <div class="audio-feed-progress-fill"></div>
                            </div>

                            <audio class="audio-feed-native" preload="none"></audio>
                        </div>

                        <div class="audio-feed-footer">
                            <div class="audio-feed-meta">
                                <h3 class="card-title audio-feed-card-title">${title}</h3>
                                <div class="audio-feed-stats">
                                    <span class="audio-feed-stat audio-feed-stat-rating">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="m12 2.5 2.9 5.87 6.48.94-4.69 4.57 1.11 6.47L12 17.32 6.2 20.35l1.11-6.47L2.62 9.31l6.48-.94Z"></path>
                                        </svg>
                                        <span class="audio-feed-rating-value">${Number(stats.avg_rating).toFixed(1)}</span>
                                    </span>
                                    <button class="audio-feed-stat audio-feed-like-btn" type="button" data-audio-action="like" aria-label="Like audio">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="m12 21-1.45-1.32C5.4 15.02 2 11.93 2 8.13 2 5.04 4.42 2.5 7.5 2.5c1.74 0 3.41.81 4.5 2.09A5.94 5.94 0 0 1 16.5 2.5C19.58 2.5 22 5.04 22 8.13c0 3.8-3.4 6.89-8.55 11.55Z"></path>
                                        </svg>
                                        <span class="audio-feed-like-count">${stats.like_count || 0}</span>
                                    </button>
                                    <span class="audio-feed-stat">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12Z"></path>
                                            <circle cx="12" cy="12" r="3.2"></circle>
                                        </svg>
                                        ${stats.view_count || 0}
                                    </span>
                                </div>

                                <div class="audio-feed-rating-row">
                                    <span class="audio-feed-rating-label">Rate</span>
                                    <div class="audio-feed-rating-stars" aria-label="Rate this audio">
                                        ${ratingControls}
                                    </div>
                                </div>
                            </div>

                            <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" class="audio-feed-share" title="Share on WhatsApp" aria-label="Share on WhatsApp">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.08.54 4.11 1.56 5.9L0 24l6.37-1.67a11.86 11.86 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.9-11.9a11.82 11.82 0 0 0-3.45-8.4Zm-8.46 18.3h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.22-3.78.99 1.01-3.69-.24-.38a9.82 9.82 0 0 1-1.52-5.24c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.11 1.03 6.98 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.46-4.44 9.9-9.89 9.9Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.29-.76.96-.94 1.16-.17.2-.35.22-.64.07-.3-.14-1.26-.46-2.39-1.47-.89-.79-1.49-1.76-1.66-2.06-.18-.29-.02-.45.13-.6.13-.14.3-.35.45-.53.15-.17.2-.29.3-.49.1-.2.05-.37-.03-.53-.07-.14-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.58c-.19 0-.5.07-.76.37-.27.29-1.03 1-1.03 2.44 0 1.44 1.05 2.83 1.2 3.03.15.2 2.07 3.16 5.02 4.43.7.31 1.25.49 1.68.63.72.23 1.38.2 1.89.12.58-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.56-.34Z"></path>
                                </svg>
                            </a>
                        </div>
                    </div>
                </article>
            `;
        }

        // NEW: Image-First Feed Card for 'images' category
        if (normalizedCategory === 'images' || sub.content_type === 'image') {
            return `
                <div class="content-card clay-card image-feed-card animate-fade-in" data-id="${sub.id}">
                    ${badgeHtml}
                    <div class="card-thumbnail-container feed-image-container">
                        <img src="${previewUrl || fullUrl}" 
                             class="feed-img" 
                             loading="lazy" 
                             decoding="async" 
                             alt="${title}"
                             onerror="if(this.dataset.fallbackApplied==='true'){this.src='${fallbackThumbnailUrl}'; return;} this.dataset.fallbackApplied='true'; this.src='${fullUrl || fallbackThumbnailUrl}';">
                        <div class="image-overlay-category">
                            <span class="badge badge-category" style="--cat-color:${color}">${this.getCategoryEmoji(sub.category, sub.content_type)} ${categoryLabel}</span>
                        </div>
                    </div>
                    <div class="card-body feed-body">
                        <h3 class="card-title">${title}</h3>
                        ${sub.description ? `<p class="feed-description">${sub.description}</p>` : ''}
                        
                        <div class="feed-author-row">
                             <div class="author-info">
                                <div class="mini-avatar" style="background: linear-gradient(135deg, ${color}, var(--secondary))">
                                    ${sub.profiles?.avatar_url 
                                        ? `<img src="${sub.profiles.avatar_url}" alt="${sub.profiles.display_name}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` 
                                        : (sub.profiles?.display_name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <span class="author-name">By ${sub.profiles?.display_name || 'Anonymous'}</span>
                             </div>
                             <div class="card-stats feed-stats">
                                <span><span style="color:#fbbf24">★</span> ${Number(stats.avg_rating).toFixed(1)}</span>
                                <span><span style="color:#ef4444">❤️</span> ${stats.like_count}</span>
                             </div>
                        </div>

                        <div class="feed-actions">
                            <a href="${this.createWhatsAppShareUrl(sub.title, sub.id)}" target="_blank" rel="noopener noreferrer" class="btn clay-btn btn-sm btn-snake btn-round btn-icon" style="background:#25D366; border-color:#25D366; color:white;" title="Share on WhatsApp">
                                <span></span><span></span><span></span><span></span>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                            </a>
                            <a href="#detail/${sub.id}" class="btn btn-primary btn-sm btn-snake btn-round btn-wide btn-preview" data-link="detail/${sub.id}">
                                <span></span><span></span><span></span><span></span> 💡 View Post
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        // Standard Document Card
        return `
            <div class="content-card clay-card animate-fade-in" data-id="${sub.id}">
                ${badgeHtml}
                ${thumbnailHtml}
                <div class="card-body">
                    <span class="badge badge-category" style="--cat-color:${color}">${categoryLabel}</span>
                    <h3 class="card-title">${title}</h3>
                    <p class="card-author">By ${sub.profiles?.display_name || 'Anonymous'}</p>
                    <div class="card-footer">
                        <div class="card-stats">
                            <span><span style="color:#fbbf24">★</span> ${Number(stats.avg_rating).toFixed(1)}</span>
                            <span><span style="color:#ef4444">❤️</span> ${stats.like_count}</span>
                            <span>👁️ ${stats.view_count || 0}</span>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <a href="${this.createWhatsAppShareUrl(sub.title, sub.id)}" target="_blank" rel="noopener noreferrer" class="btn clay-btn btn-sm btn-snake btn-round btn-icon" style="background:#25D366; border-color:#25D366; color:white;" title="Share on WhatsApp">
                                <span></span><span></span><span></span><span></span>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="position: relative; z-index: 5;">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                                </svg>
                            </a>
                            <a href="#detail/${sub.id}" class="btn clay-btn btn-sm btn-snake btn-round btn-icon btn-preview" data-link="detail/${sub.id}" title="View Details">
                                <span></span><span></span><span></span><span></span>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="position: relative; z-index: 5;">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderMasonryCard(sub) {
        const stats = sub.submission_stats?.[0] || { avg_rating: 0, like_count: 0, view_count: 0 };
        const { previewUrl, fullUrl } = this.getSubmissionImageUrls(sub);
        const thumbUrl = previewUrl || fullUrl;
        const fallbackThumbnailUrl = this.getThumbnailFallbackUrl(sub);
        const avatarUrl = sub.profiles?.avatar_url;
        const authorName = sub.profiles?.display_name || 'Anonymous';
        const initials = (sub.profiles?.display_name || 'U').charAt(0).toUpperCase();
        const imageUrl = fullUrl || thumbUrl || fallbackThumbnailUrl;
        const shareUrl = this.createWhatsAppShareUrl(sub.title, sub.id);

        return `
            <div class="masonry-item animate-fade-in" data-id="${sub.id}" data-full-url="${fullUrl || ''}" data-preview-url="${thumbUrl || ''}">
                <div class="masonry-card">
                    <div class="masonry-card-header">
                        <div class="masonry-author-stub" onclick="window.location.hash='#detail/${sub.id}'">
                            <div class="masonry-avatar-mini">
                                ${avatarUrl ? `<img src="${avatarUrl}" alt="${authorName}">` : initials}
                            </div>
                            <div class="masonry-header-copy">
                                <h3 class="masonry-feed-title">${sub.title}</h3>
                                <p class="masonry-author-name">by ${authorName}</p>
                            </div>
                        </div>
                    </div>
                    <div class="masonry-image-wrapper">
                        <img src="${imageUrl}" class="masonry-img" loading="lazy" decoding="async" alt="${sub.title}" onerror="this.src='${fallbackThumbnailUrl}'">
                        <div class="masonry-overlay"></div>
                    </div>
                    <div class="masonry-actions-row">
                        <div class="action-mini btn-like interaction-btn ${stats.user_has_liked ? 'liked' : ''}" data-id="${sub.id}" title="Like">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            <span class="action-label">Like</span>
                            <span class="like-count">${stats.like_count || 0}</span>
                        </div>
                        <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" class="action-mini btn-share" title="Share on WhatsApp" aria-label="Share on WhatsApp">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.08.54 4.11 1.56 5.9L0 24l6.37-1.67a11.86 11.86 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.9-11.9a11.82 11.82 0 0 0-3.45-8.4Zm-8.46 18.3h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.22-3.78.99 1.01-3.69-.24-.38a9.82 9.82 0 0 1-1.52-5.24c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.11 1.03 6.98 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.46-4.44 9.9-9.89 9.9Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.29-.76.96-.94 1.16-.17.2-.35.22-.64.07-.3-.14-1.26-.46-2.39-1.47-.89-.79-1.49-1.76-1.66-2.06-.18-.29-.02-.45.13-.6.13-.14.3-.35.45-.53.15-.17.2-.29.3-.49.1-.2.05-.37-.03-.53-.07-.14-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.58c-.19 0-.5.07-.76.37-.27.29-1.03 1-1.03 2.44 0 1.44 1.05 2.83 1.2 3.03.15.2 2.07 3.16 5.02 4.43.7.31 1.25.49 1.68.63.72.23 1.38.2 1.89.12.58-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.56-.34Z"></path></svg>
                            <span class="action-label">Share</span>
                        </a>
                        <div class="action-mini btn-save interaction-btn ${stats.user_has_bookmarked ? 'bookmarked' : ''}" data-id="${sub.id}" title="Bookmark">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                            <span class="action-label">Bookmark</span>
                        </div>
                        <a href="${imageUrl}" class="action-mini btn-download" target="_blank" rel="noopener noreferrer" download data-filename="${this.buildDownloadFileName(sub.title, imageUrl)}" title="Download image">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
                            <span class="action-label">Download</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
    },

    buildDownloadFileName(title = 'image', sourceUrl = '', fallbackExt = 'jpg') {
        const safeTitle = String(title || 'image')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'image';

        let ext = fallbackExt;
        try {
            const pathname = new URL(sourceUrl, window.location.href).pathname;
            const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
            if (match?.[1]) {
                ext = match[1].toLowerCase();
            }
        } catch (_) {
            const match = String(sourceUrl || '').match(/\.([a-zA-Z0-9]+)(?:\?|#|$)/);
            if (match?.[1]) {
                ext = match[1].toLowerCase();
            }
        }

        return `${safeTitle}.${ext}`;
    },

    buildDownloadProxyUrl(url, filename = 'download') {
        const params = new URLSearchParams({
            url,
            filename
        });
        return `/api/download-file?${params.toString()}`;
    },

    downloadFile(url, filename = 'download') {
        if (!url) return;

        const link = document.createElement('a');
        link.href = this.buildDownloadProxyUrl(url, filename);
        link.download = filename;
        link.target = '_self';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    showImageLightbox(imageUrl, title) {
        console.log(`[UI] opening lightbox with source: ${imageUrl}`);
        // Remove existing if any
        document.querySelector('.lightbox-overlay')?.remove();

        const downloadName = this.buildDownloadFileName(title, imageUrl);

        const overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay animate-fade-in';
        overlay.innerHTML = `
            <div class="lightbox-content">
                <div class="lightbox-shell">
                    <div class="lightbox-toolbar" role="toolbar" aria-label="Image viewer controls">
                        <div class="lightbox-toolbar-group">
                            <button class="lightbox-control" type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"></path></svg>
                            </button>
                            <button class="lightbox-control" type="button" data-action="zoom-reset" aria-label="Reset zoom" title="Reset zoom">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.708"></path><path d="M3 3v6h6"></path></svg>
                            </button>
                            <button class="lightbox-control" type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>
                            </button>
                            <button class="lightbox-control lightbox-control-download" type="button" data-action="download" aria-label="Download image" title="Download image">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
                            </button>
                            <button class="lightbox-control lightbox-close" type="button" aria-label="Close viewer" title="Close viewer">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12"></path><path d="M18 6 6 18"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div class="lightbox-stage">
                        <div class="lightbox-img-container">
                            <img src="${imageUrl}" class="lightbox-img" alt="${title}" loading="eager" decoding="sync" fetchpriority="high">
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('body-no-scroll');

        const image = overlay.querySelector('.lightbox-img');
        const imageContainer = overlay.querySelector('.lightbox-img-container');
        const zoomOutBtn = overlay.querySelector('[data-action="zoom-out"]');
        const zoomResetBtn = overlay.querySelector('[data-action="zoom-reset"]');
        const zoomInBtn = overlay.querySelector('[data-action="zoom-in"]');
        const downloadBtn = overlay.querySelector('[data-action="download"]');

        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isPointerDown = false;
        let startX = 0;
        let startY = 0;
        let pointerId = null;

        const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

        const getPanLimits = () => {
            const rect = imageContainer.getBoundingClientRect();
            const overflowX = Math.max(0, ((rect.width * scale) - rect.width) / 2);
            const overflowY = Math.max(0, ((rect.height * scale) - rect.height) / 2);
            return { x: overflowX, y: overflowY };
        };

        const applyTransform = () => {
            const limits = getPanLimits();
            if (scale <= 1) {
                translateX = 0;
                translateY = 0;
            } else {
                translateX = clamp(translateX, -limits.x, limits.x);
                translateY = clamp(translateY, -limits.y, limits.y);
            }

            image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
            imageContainer.classList.toggle('is-zoomed', scale > 1);
            zoomOutBtn.disabled = scale <= 1;
            zoomResetBtn.disabled = scale === 1 && translateX === 0 && translateY === 0;
            zoomInBtn.disabled = scale >= 4;
        };

        const setScale = (nextScale) => {
            scale = clamp(Number(nextScale.toFixed(2)), 1, 4);
            applyTransform();
        };

        const handlePointerMove = (event) => {
            if (!isPointerDown || scale <= 1 || event.pointerId !== pointerId) return;
            translateX += event.clientX - startX;
            translateY += event.clientY - startY;
            startX = event.clientX;
            startY = event.clientY;
            applyTransform();
        };

        const endPointerPan = () => {
            isPointerDown = false;
            pointerId = null;
            imageContainer.classList.remove('is-panning');
        };

        const handleKeydown = (event) => {
            if (event.key === 'Escape') {
                close();
            }
        };

        const close = () => {
            endPointerPan();
            window.removeEventListener('keydown', handleKeydown);
            overlay.classList.remove('animate-fade-in');
            overlay.classList.add('animate-fade-out');
            setTimeout(() => {
                overlay.remove();
                document.body.classList.remove('body-no-scroll');
            }, 300);
        };

        zoomOutBtn.onclick = () => setScale(scale - 0.25);
        zoomResetBtn.onclick = () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            applyTransform();
        };
        zoomInBtn.onclick = () => setScale(scale + 0.25);
        downloadBtn.onclick = async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await this.downloadFile(imageUrl, downloadName);
        };

        imageContainer.addEventListener('wheel', (event) => {
            event.preventDefault();
            const delta = event.deltaY < 0 ? 0.2 : -0.2;
            setScale(scale + delta);
        }, { passive: false });

        imageContainer.addEventListener('pointerdown', (event) => {
            if (scale <= 1 || event.button > 0) return;
            isPointerDown = true;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            imageContainer.classList.add('is-panning');
            imageContainer.setPointerCapture?.(event.pointerId);
        });

        imageContainer.addEventListener('pointermove', handlePointerMove);
        imageContainer.addEventListener('pointerup', endPointerPan);
        imageContainer.addEventListener('pointercancel', endPointerPan);
        imageContainer.addEventListener('pointerleave', endPointerPan);

        overlay.querySelector('.lightbox-close').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
        window.addEventListener('keydown', handleKeydown);

        image.addEventListener('load', () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            applyTransform();
        }, { once: true });

        if (image.complete) {
            applyTransform();
        }
    },

    createWhatsAppShareUrl(title, workId) {
        // Build the public absolute URL
        const baseUrl = window.location.origin + window.location.pathname;
        const workUrl = `${baseUrl}?fullscreen=true#detail/${workId}`;
        const text = `Check out "${title}" on EDTECHRA!\n\n${workUrl}`;
        return `https://wa.me/?text=${encodeURIComponent(text)}`;
    },

    categoryEmoji(cat) {
        const map = {
            short_stories: '📖', long_stories: '📚', comics: '🦸', essays: '✍️',
            articles: '📰', classroom_play: '🎭', speech: '🎤', conversations: '💬',
            poems: '🌸', images: '🖼️', songs: '🎵', presentations: '📊',
            flashcards: '🎴'
        };
        return map[cat] || '📄';
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // --- Compression Workflow UI ---
    initCompressionUI() {
        if (document.getElementById('compression-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'compression-overlay';
        overlay.className = 'compression-overlay';
        overlay.innerHTML = `
            <div class="compression-modal">
                <div id="compression-prompt-state">
                    <span class="compression-icon">⚖️</span>
                    <h3 class="compression-title">Optimize Image?</h3>
                    <p class="compression-text">Your image is large. Would you like to compress it to save space and load faster? (Recommended)</p>
                    <div class="compression-actions">
                        <button class="btn btn-outline" id="compression-deny-btn">No, keep original</button>
                        <button class="btn btn-primary" id="compression-allow-btn">Yes, compress it</button>
                    </div>
                </div>

                <div id="compression-progress-state" style="display: none;">
                    <span class="compression-icon">⚡</span>
                    <h3 class="compression-title">Compressing...</h3>
                    <div class="compression-progress-container" style="display: block;">
                        <div class="compression-progress-bar">
                            <div class="compression-progress-fill" id="compression-bar-fill"></div>
                        </div>
                        <div class="compression-progress-text" id="compression-bar-text">Preparing...</div>
                    </div>
                </div>

                <div id="compression-success-state" style="display: none;">
                    <span class="compression-icon">✅</span>
                    <h3 class="compression-title">Compressed!</h3>
                    <div class="compression-success-data" style="display: block;">
                        <div class="success-stat">
                            <span>Before:</span>
                            <span id="comp-size-before">0 KB</span>
                        </div>
                        <div class="success-stat">
                            <span>After:</span>
                            <span id="comp-size-after">0 KB</span>
                        </div>
                        <div class="success-stat">
                            <span>Saved:</span>
                            <span id="comp-savings">0%</span>
                        </div>
                    </div>
                    <button class="btn btn-primary w-100" id="compression-finish-btn">Great, let's go!</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    },

    async showCompressionModal(originalSizeKB) {
        this.initCompressionUI();
        const overlay = document.getElementById('compression-overlay');
        const promptState = document.getElementById('compression-prompt-state');
        const progressState = document.getElementById('compression-progress-state');
        const successState = document.getElementById('compression-success-state');

        promptState.style.display = 'block';
        progressState.style.display = 'none';
        successState.style.display = 'none';
        overlay.classList.add('active');

        return new Promise((resolve) => {
            const allowBtn = document.getElementById('compression-allow-btn');
            const denyBtn = document.getElementById('compression-deny-btn');

            const handleChoice = (allowed) => {
                if (allowed) {
                    promptState.style.display = 'none';
                    progressState.style.display = 'block';
                } else {
                    overlay.classList.remove('active');
                }
                resolve(allowed);
            };

            allowBtn.onclick = () => handleChoice(true);
            denyBtn.onclick = () => handleChoice(false);
        });
    },

    updateCompressionProgress(percent, statusText) {
        const fill = document.getElementById('compression-bar-fill');
        const text = document.getElementById('compression-bar-text');
        if (fill) fill.style.width = `${percent}%`;
        if (text) text.textContent = statusText || `${Math.round(percent)}% compressed...`;
    },

    showCompressionSuccess(beforeKB, afterKB) {
        const progressState = document.getElementById('compression-progress-state');
        const successState = document.getElementById('compression-success-state');
        const beforeEl = document.getElementById('comp-size-before');
        const afterEl = document.getElementById('comp-size-after');
        const savingsEl = document.getElementById('comp-savings');
        const finishBtn = document.getElementById('compression-finish-btn');
        const overlay = document.getElementById('compression-overlay');

        const savings = Math.max(0, Math.round(((beforeKB - afterKB) / beforeKB) * 100));

        beforeEl.textContent = `${beforeKB.toFixed(1)} KB`;
        afterEl.textContent = `${afterKB.toFixed(1)} KB`;
        savingsEl.textContent = `${savings}% smaller`;

        progressState.style.display = 'none';
        successState.style.display = 'block';

        return new Promise((resolve) => {
            finishBtn.onclick = () => {
                overlay.classList.remove('active');
                resolve();
            };
        });
    },

    pages: {
        home: (currentUser) => `
            <section class="hero">
                <div class="hero-bg"></div>
                <div class="particles"></div>

                <div class="hero-content">
                    <div class="glass-card-hero">
                        <h1 class="hero-title">EdTechra Creative Lab</h1>
                        <p class="hero-subtitle">Showcase your creativity in the digital world. Inspire. Evolve.</p>

                        <!-- Cycling Subtitle — phrases and timing adjustable below -->
                        <div class="cycling-subtitle-container" aria-live="polite">
                            <span class="cycling-subtitle" id="cycling-subtitle">Where Stories Live</span>
                        </div>

                        <p class="hero-welcome">${currentUser?.display_name ? `Welcome back, ${currentUser.display_name}!` : 'Welcome back!'}</p>

                        <div class="hero-actions">
                            <a href="#explore" class="hero-btn hero-btn-primary" data-link="explore">
                                Explore Work
                            </a>
                            <a href="#upload" class="hero-btn hero-btn-secondary" data-link="upload">
                                Upload Yours
                            </a>
                            <button id="installBtn" style="display:none;" class="hero-btn hero-btn-primary">
                                Install App
                            </button>
                        </div>
                        <div id="pwa-ios-tip" style="display: none; margin-top: 12px; padding: 8px 18px; background: rgba(255,255,255,0.12); border-radius: 12px; backdrop-filter: blur(6px); font-size: 0.78rem; color: rgba(255,255,255,0.85); text-align: center; line-height: 1.5;">
                            📲 To install: tap <strong style="color: white;">Share</strong> <span style="font-size: 1rem;">⎋</span> then <strong style="color: white;">Add to Home Screen</strong>
                        </div>
                    </div>
                </div>

                <button class="hero-fullscreen-btn" title="Toggle Fullscreen">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                    </svg>
                </button>
            </section>

        `,



        profile: (user) => `
            <div class="profile-container animate-fade-in">
                <div class="glass-card profile-card">
                    <div class="profile-header">
                        <div class="profile-avatar-large" id="profile-avatar-display" style="cursor: pointer; position: relative;">
                            ${user.avatar_url
                ? `<img src="${user.avatar_url}" alt="Avatar" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
                : `<span style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 2.5rem; font-weight: 700; color: white;">${(user.display_name || 'U').charAt(0).toUpperCase()}</span>`
            }
                            <div class="avatar-edit-overlay">
                                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            </div>
                        </div>
                        <div class="profile-titles">
                            <h2>Profile Settings</h2>
                            <p class="text-muted">Update your public presence on EDTECHRA.</p>
                        </div>
                    </div>

                    <form id="profile-form">
                        <div class="form-group" id="thumbnail-input-group">
                            <label>Display Name</label>
                            <input type="text" name="display_name" class="form-control" value="${user.display_name || user.email?.split('@')[0] || ''}" placeholder="How should we call you?">
                        </div>
                        <div class="form-group">
                            <label>Email (Read-only)</label>
                            <input type="email" class="form-control" value="${user.email || ''}" readonly style="opacity: 0.6">
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <input type="text" class="form-control" value="${user.role || 'student'}" readonly style="opacity: 0.6">
                        </div>
                        
                        <div class="profile-form-actions">
                            <button type="submit" class="btn btn-primary btn-lg btn-snake">
                                <span></span><span></span><span></span><span></span>
                                Save Changes
                            </button>
                            <button type="button" class="btn btn-outline btn-lg btn-snake" id="logout-btn-profile">
                                <span></span><span></span><span></span><span></span>
                                Logout
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `,

        detail: (sub, currentUser, userRole) => {
            const stats = sub.submission_stats?.[0] || { avg_rating: 0, like_count: 0, view_count: 0 };
            const isOwner = currentUser?.id === sub.author_id;
            const isAdmin = userRole === 'admin';

            return `
                <div class="detail-container animate-fade-in">
                    <div class="detail-header">
                        <a href="#explore" class="back-link" data-link="explore">← Back to Explore</a>
                        <h1 class="detail-title">${sub.title}</h1>
                        <p class="detail-author">
                            By ${sub.profiles?.display_name || 'Anonymous'} • ${new Date(sub.created_at).toLocaleDateString()}
                            <span class="detail-views"> • 👁 <span id="view-count">${stats.view_count || 0}</span> views</span>
                        </p>
                    </div>

                    <div class="detail-card glass-card">
                        <div class="detail-content">
                            ${UI.renderContentPreview(sub)}
                        </div>
                        
                        <div class="detail-description">
                            <p>${sub.description || 'No description provided.'}</p>
                        </div>

                        <div class="detail-actions">
                            <div class="interaction-group">
                                <button class="interaction-btn" id="like-btn" title="Like this work">
                                    <svg class="heart-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                    <span id="like-count">${stats.like_count}</span>
                                </button>

                                <button class="interaction-btn bookmark-btn" id="bookmark-btn" title="Save this work">
                                    <svg class="bookmark-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                                    </svg>
                                    <span>Save</span>
                                </button>

                                <div class="rating-group">
                                    <div class="rating-stars" id="rating-stars">
                                        ${UI.renderStars(stats.avg_rating)}
                                    </div>
                                    <span class="text-xs text-muted" id="avg-rating">(${Number(stats.avg_rating).toFixed(1)})</span>
                                </div>
                            </div>

                            <div class="main-actions">
                                ${sub.file_path ? `<button class="btn btn-outline btn-snake" id="download-btn"><span></span><span></span><span></span><span></span>Download File</button>` : ''}
                                ${isOwner || isAdmin ? `<button class="btn btn-edit btn-snake" id="edit-btn"><span></span><span></span><span></span><span></span>Edit Submission</button>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        },

        upload: () => `
            <div class="page-header">
                <h1>Submit Your Work</h1>
                <p class="text-muted">Share your creativity with the EDTECHRA community.</p>
            </div>
            <div class="form-container">
                <form id="upload-form" class="card glass-card shadow-md p-40">
                    <div class="form-grid">
                        <div class="form-group">
                            <label>Title*</label>
                            <input type="text" name="title" class="form-control" required placeholder="Enter a catchy title">
                        </div>
                        <div class="form-group">
                            <label>Content Type*</label>
                            <select name="category" class="form-control" required>
                                <option value="" disabled selected>Select content type</option>
                                ${UI.renderContentTypeOptions()}
                            </select>
                        </div>
                    </div>

                    <!-- Theme Multi-Select (max 3) -->
                    <div class="form-group">
                        <label>Theme* <span class="text-muted text-sm">(select up to 3)</span></label>
                        <div class="theme-selected-tags" id="theme-tags"></div>
                        <div class="theme-dropdown" id="theme-dropdown">
                            ${UI.renderThemeOptions()}
                        </div>
                        <p class="theme-validation-msg hidden" id="theme-msg">Maximum 3 themes allowed.</p>
                    </div>

                    <!-- Audience Level -->
                    <div class="form-group">
                        <label>Audience Level*</label>
                        <select name="audience_level" class="form-control" required>
                            <option value="" disabled selected>Select audience</option>
                            ${UI.renderAudienceOptions()}
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" class="form-control" rows="3" placeholder="Tell us more about your work..."></textarea>
                    </div>

                    <div id="non-image-fields">
                        <!-- Thumbnail Upload -->
                        <div class="form-group">
                            <label>Thumbnail (optional)</label>
                            <div class="thumbnail-upload-area">
                                <div id="thumbnail-preview" class="thumbnail-preview">
                                    <span class="thumbnail-placeholder">📷 Click or drag to add a cover image</span>
                                </div>
                                <input type="file" name="thumbnail" id="thumbnail-input" accept="image/*" class="thumbnail-file-input">
                            </div>
                        </div>

                        <!-- Content Mode -->
                        <div class="form-group">
                            <label>Content Mode*</label>
                            <div class="radio-group mode-tabs">
                                <label class="mode-tab"><input type="radio" name="content_mode" value="file" checked> 📁 Upload File</label>
                                <label class="mode-tab"><input type="radio" name="content_mode" value="text"> ✏️ Text Only</label>
                                <label class="mode-tab"><input type="radio" name="content_mode" value="code"> 💻 Paste Code</label>
                                <!-- Image option removed since Image is now the primary Category choice -->
                            </div>
                        </div>

                        <div id="file-input-group" class="form-group">
                            <label>File Upload* (PDF, TXT, MP3, ZIP - Max 50MB)</label>
                            <input type="file" name="file" class="form-control" id="file-input" required>
                        </div>

                        <div id="text-input-group" class="form-group hidden">
                            <label>Write your content here*</label>
                            <textarea name="content_text" class="form-control" rows="10" placeholder="Paste or write your story, poem, or article here..."></textarea>
                        </div>

                        <div id="code-input-group" class="form-group hidden">
                            <label>Paste HTML/CSS/JS Code*</label>
                            <p class="text-muted text-sm">Paste your full web page code below (HTML, CSS, JS). A live preview will appear.</p>
                            <textarea id="code-textarea" name="code_content" class="form-control code-editor" rows="12" placeholder="<!DOCTYPE html>\n<html>...</html>"></textarea>
                            <div class="code-preview-container">
                                <p class="preview-label">Live Preview</p>
                                <iframe id="code-preview-frame" class="code-preview-frame" sandbox="allow-scripts"></iframe>
                            </div>
                        </div>
                    </div>

                    <!-- Independent Image Flow Container -->
                    <div id="image-input-group" class="form-group hidden">
                        <label>Image Upload* (JPG, PNG, WEBP - Max 50MB)</label>
                        <p class="text-muted text-sm mb-10">Images over 100 KB are automatically compressed for speed and storage.</p>
                        <div class="image-drop-zone" id="image-drop-zone">
                            <div class="drop-zone-content">
                                <span class="drop-zone-icon">📸</span>
                                <p class="drop-zone-text">Drag & drop an image here<br><span class="text-muted text-sm">or click to browse</span></p>
                            </div>
                            <div class="image-upload-preview" id="image-upload-preview" style="display: none;">
                                <img id="image-preview-img" alt="Preview" class="image-preview-img">
                                <button type="button" class="image-remove-btn" id="image-remove-btn" title="Remove image">✕</button>
                                <div class="image-preview-info" id="image-preview-info"></div>
                            </div>
                            <input type="file" id="image-file-input" accept="image/jpeg,image/jpg,image/png,image/webp" class="hidden-file-input">
                        </div>
                        <div class="image-compression-status" id="image-compression-status" style="display: none;"></div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary btn-lg btn-snake">
                            <span></span><span></span><span></span><span></span>
                            Submit for Review
                        </button>
                    </div>
                </form>
            </div>
        `,

        myUploads: () => `
            <div class="page-header">
                <h1>My Submissions</h1>
                <p class="text-muted">Track the status of your uploaded works.</p>
            </div>
            <div id="my-uploads-list" class="submissions-list">
                <div class="loader-inline"><div class="spinner"></div></div>
            </div>
        `,

        explore: () => `
            <div class="explore-container light-theme-explore animate-fade-in">
                <!-- Sidebar: Search & Filters -->
                <aside class="explore-sidebar">
                    <div class="clay-card explore-sidebar-card" data-mobile-slot="search">
                        <h4 class="mb-15">Search</h4>
                        <div class="clay-inset search-box-clay">
                            <span class="search-box-icon">&#128270;</span>
                            <input type="text" id="search-input" placeholder="Search by title or author...">
                        </div>
                    </div>

                    <div class="clay-card explore-sidebar-card" data-mobile-slot="categories">
                        <h4 class="mb-15">Categories</h4>
                        <div class="explore-chip-bar">
                            <button type="button" class="explore-chip-scroll explore-chip-scroll-left" data-chip-scroll="left" aria-label="Scroll categories left">
                                <span aria-hidden="true">‹</span>
                            </button>
                            <div class="explore-chip-viewport" id="explore-chip-viewport">
                                <div class="category-sidebar-list" id="category-filters">
                                    ${UI.renderExploreCategoryFilters()}
                                </div>
                            </div>
                            <button type="button" class="explore-chip-scroll explore-chip-scroll-right" data-chip-scroll="right" aria-label="Scroll categories right">
                                <span aria-hidden="true">›</span>
                            </button>
                            <div class="explore-chip-dropdown-layer" id="explore-chip-dropdown-layer" aria-hidden="true"></div>
                        </div>
                    </div>
                </aside>

                <!-- Main Content Area -->
                <main class="explore-main">
                    <!-- Explore Hero -->
                    <section class="explore-hero">
                        <div class="explore-hero-glow explore-hero-glow-left"></div>
                        <div class="explore-hero-glow explore-hero-glow-right"></div>
                        <div class="explore-hero-stars" aria-hidden="true"></div>
                        <div class="explore-hero-content">
                            <div class="explore-hero-heading">
                                <span class="explore-hero-kicker">EDTECHRA Spotlight</span>
                                <h1 class="explore-hero-title">Creative Works</h1>
                            </div>
                            <div class="explore-hero-copy">
                                <p class="explore-hero-subtitle">Discover and learn from diverse and inspiring creations, from digital art and writing to fun and educational projects.</p>
                                <div class="explore-hero-actions">
                                    <button type="button" class="btn explore-hero-cta" id="explore-hero-cta">Get Inspired by Student Creators</button>
                                </div>
                            </div>
                        </div>
                        <div class="explore-hero-visual" aria-hidden="true">
                            <div class="explore-hero-visual-glow explore-hero-visual-glow-primary"></div>
                            <div class="explore-hero-visual-glow explore-hero-visual-glow-secondary"></div>
                            <img src="assets/images/clay-hero.png" alt="Creative works illustration" class="explore-hero-image" loading="lazy">
                        </div>
                    </section>
                    <div class="explore-flow-shell">
                        <div class="explore-desktop-discovery" aria-hidden="false"></div>
                        <div class="explore-mobile-discovery" aria-hidden="false"></div>

                        <div class="explore-sections-container">
                            <section class="explore-row-section explore-creators-section">
                                <div class="explore-section-heading">
                                    <h2 class="explore-row-title">Trending Creators</h2>
                                    <p class="explore-row-copy">Meet standout learners and makers inspiring the community right now.</p>
                                </div>
                                <div class="trending-creators-row" id="trending-creators-row">
                                    <div class="creator-skeleton"></div>
                                    <div class="creator-skeleton"></div>
                                    <div class="creator-skeleton"></div>
                                </div>
                            </section>

                            <section class="explore-row-section explore-creations-section" id="trending-creations">
                                <div class="explore-section-heading">
                                    <h2 class="explore-row-title">Trending Creations</h2>
                                    <p class="explore-row-copy">A refreshed view of the most loved student work, with all existing Explore functionality preserved.</p>
                                </div>
                                <div class="explore-row-grid" id="grid-trending"></div>
                            </section>

                            <section class="explore-row-section">
                                <div class="explore-section-heading">
                                    <h2 class="explore-row-title">Newly Submitted</h2>
                                    <p class="explore-row-copy">Fresh ideas and new uploads from across the learning community.</p>
                                </div>
                                <div class="explore-row-grid" id="grid-new"></div>
                            </section>

                            <section class="explore-row-section">
                                <div class="explore-section-heading">
                                    <h2 class="explore-row-title">Top Rated Creations</h2>
                                    <p class="explore-row-copy">Highly rated creative work that learners keep coming back to.</p>
                                </div>
                                <div class="explore-row-grid" id="grid-top"></div>
                            </section>
                        </div>

                        <div class="explore-load-more-container">
                            <button id="explore-load-more" style="display: none;">
                                <span class="load-more-spinner"></span>
                                <span class="load-more-text">Load More</span>
                            </button>
                        </div>

                        <div id="explore-loader" class="loader-inline hidden"><div class="spinner"></div></div>
                    </div>
                </main>
            </div>
        `,


        login: () => `
            <div class="auth-card animate-fade-in">
                <h2>Welcome Back</h2>
                <p class="text-muted">Sign in to continue your creative journey.</p>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" class="form-control" required placeholder="name@example.com">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" class="form-control" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg w-100 btn-snake"><span></span><span></span><span></span><span></span>Login</button>
                    
                    <div class="auth-divider"><span>OR</span></div>
                    
                    <button type="button" class="btn btn-outline w-100 google-btn btn-snake" id="google-login">
                        <span></span><span></span><span></span><span></span>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                        Continue with Google
                    </button>

                    ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `
                    <button type="button" class="btn btn-secondary w-100 btn-snake mt-10" id="dev-auto-login" style="margin-top: 10px; border: 2px dashed #6366f1;">
                        <span></span><span></span><span></span><span></span>
                        🛠️ DEV: Auto-Login Test User
                    </button>
                    ` : ''}

                    <p class="auth-footer">Don't have an account? <a href="#" data-link="onboarding">Sign Up</a></p>
                </form>
            </div>
        `,

        signup: () => `
            <div class="auth-card animate-fade-in">
                <h2>Create Account</h2>
                <p class="text-muted">Join the EDTECHRA community today.</p>
                <form id="signup-form">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" name="display_name" class="form-control" required placeholder="John Doe">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" class="form-control" required placeholder="name@example.com">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" class="form-control" required placeholder="Min. 6 characters">
                    </div>
                    
                    <input type="hidden" name="role" value="${localStorage.getItem('edtechra_role') || 'student'}">

                    <button type="submit" class="btn btn-primary btn-lg w-100 btn-snake"><span></span><span></span><span></span><span></span>Create Account</button>
                    
                    ${localStorage.getItem('edtechra_role') === 'admin' ? '' : `
                    <div class="auth-divider"><span>OR</span></div>
                    
                    <button type="button" class="btn btn-outline w-100 google-btn btn-snake" id="google-signup">
                        <span></span><span></span><span></span><span></span>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                        Sign up with Google
                    </button>
                    `}


                    ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? `
                    <button type="button" class="btn btn-secondary w-100 btn-snake mt-10" id="dev-auto-signup" style="margin-top: 10px; border: 2px dashed #6366f1;">
                        <span></span><span></span><span></span><span></span>
                        🛠️ DEV: Auto-Signup Test User
                    </button>
                    ` : ''}

                    <p class="auth-footer">Already have an account? <a href="#" data-link="login">Login</a></p>
                </form>
            </div>
        `,

        onboarding: () => `
            <div class="auth-card onboarding-card animate-fade-in">
                <!-- Step 1: Name -->
                <div id="onboarding-step-1" class="onboarding-step active">
                    <div class="onboarding-header">
                        <h2>How can we call you?</h2>
                        <p class="text-muted">Let's start with your name.</p>
                    </div>
                    <input type="text" id="onboarding-name" class="name-input-large" placeholder="Your Name" autofocus>
                    <button id="next-to-roles" class="btn btn-primary btn-lg w-100 btn-snake">
                        <span></span><span></span><span></span><span></span>
                        Continue
                    </button>
                </div>

                <!-- Step 2: Roles -->
                <div id="onboarding-step-2" class="onboarding-step">
                    <div class="onboarding-header">
                        <h2>Choose Your Path</h2>
                        <p class="text-muted">What's your primary goal on EDTECHRA?</p>
                    </div>
                    <div class="role-grid">
                        <div class="role-option-large btn-snake" data-role="student">
                            <span></span><span></span><span></span><span></span>
                            <span class="role-emoji">🎓</span>
                            <h3>Student</h3>
                            <p>Explore, learn, and share your creative work.</p>
                        </div>
                        <div class="role-option-large btn-snake" data-role="teacher">
                            <span></span><span></span><span></span><span></span>
                            <span class="role-emoji">👩‍🏫</span>
                            <h3>Teacher</h3>
                            <p>Review student work and manage submissions.</p>
                        </div>
                        <div class="role-option-large btn-snake" data-role="admin">
                            <span></span><span></span><span></span><span></span>
                            <span class="role-emoji">🛡️</span>
                            <h3>Admin</h3>
                            <p>Full system access and user management.</p>
                        </div>
                    </div>
                </div>
                <p class="text-center mt-20">Already have a role? <a href="#login">Sign In</a></p>
            </div>
        `,

        dashboard: (role) => `
            <div class="dashboard-container premium-admin-view">
                <div class="page-header-admin">
                    <div class="ph-content">
                        <h1>${role === 'admin' ? 'Platform Control Center' : 'Teacher Dashboard'}</h1>
                        <p class="text-muted">High-level overview and management of EdTechra's ecosystem.</p>
                    </div>
                </div>

                ${role === 'admin' ? `
                <div class="grid-4 stat-section mb-40">
                    <div class="glass-card stat-card admin-stat">
                        <div class="stat-icon-small">👥</div>
                        <div class="stat-data">
                            <p class="text-muted text-xs uppercase letter-spacing">Total Creators</p>
                            <div class="stat-val-small" id="stat-users">0</div>
                        </div>
                    </div>
                    <div class="glass-card stat-card admin-stat">
                        <div class="stat-icon-small">⏳</div>
                        <div class="stat-data">
                            <p class="text-muted text-xs uppercase letter-spacing">Pending Review</p>
                            <div class="stat-val-small" id="stat-pending">0</div>
                        </div>
                    </div>
                    <div class="glass-card stat-card admin-stat">
                        <div class="stat-icon-small">✅</div>
                        <div class="stat-data">
                            <p class="text-muted text-xs uppercase letter-spacing">Live Works</p>
                            <div class="stat-val-small" id="stat-approved">0</div>
                        </div>
                    </div>
                    <div class="glass-card stat-card storage-card admin-stat">
                        <div class="stat-icon-small">💾</div>
                        <div class="stat-data">
                            <p class="text-muted text-xs uppercase letter-spacing">Cloudflare R2</p>
                            <div class="storage-stats">
                                <span class="stat-val-small" id="stat-storage">0 MB</span>
                                <span class="text-muted text-xs" id="stat-storage-count">0 files</span>
                            </div>
                            <div class="text-muted text-xs" id="stat-storage-bucket">Bucket: --</div>
                            <div class="text-muted text-xs" id="stat-storage-breakdown">images 0 | audio 0 | projects 0 | thumbs 0</div>
                            <div class="storage-bar-container">
                                <div class="storage-bar" id="storage-bar" style="width: 0%"></div>
                            </div>
                            <button class="btn btn-outline btn-sm" id="run-r2-diagnostics-btn" type="button" style="margin-top: 12px;">Run R2 Diagnostics</button>
                        </div>
                    </div>
                </div>
                <div class="glass-card admin-stat mb-30" id="r2-diagnostics-panel" style="display:none;">
                    <div class="stat-data">
                        <p class="text-muted text-xs uppercase letter-spacing">Admin Diagnostics</p>
                        <div class="text-muted text-xs" id="r2-diagnostics-status">Ready to run authenticated R2 diagnostics.</div>
                        <pre id="r2-diagnostics-output" style="margin-top: 12px; white-space: pre-wrap; word-break: break-word; font-size: 0.82rem; line-height: 1.55;"></pre>
                    </div>
                </div>
                ` : ''}

                <div class="dashboard-tabs mb-30">
                    <button class="tab-btn active" data-tab="pending">Moderation Queue</button>
                    <button class="tab-btn" data-tab="approved">Live Content</button>
                    ${role === 'admin' ? '<button class="tab-btn" data-tab="users">User Management</button>' : ''}
                </div>

                <div id="tab-content" class="tab-content animate-fade-in">
                    <!-- Tab content injected here -->
                </div>
            </div>
        `,

        studentDashboard: (profile) => `
            <div class="student-dashboard animate-fade-in">
                <!-- Welcome Section -->
                <div class="sd-welcome glass-card animate-slide-up stagger-1">
                    <div class="sd-welcome-panel">
                        <div class="sd-welcome-avatar">
                            ${profile?.avatar_url ? `<img src="${profile.avatar_url}" class="profile-avatar-img">` : (profile?.display_name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <div class="sd-welcome-info">
                            <h1 class="sd-welcome-title">Welcome back, ${profile?.display_name || 'Creator'} 👋</h1>
                            <p class="sd-welcome-subtitle">Showcase your creativity and explore what other students created.</p>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats -->
                <div class="sd-stats-grid animate-slide-up stagger-2">
                    <div class="sd-stat-card glass-card">
                        <div class="sd-stat-icon">📝</div>
                        <div class="sd-stat-value sd-counter" id="sd-stat-works" data-target="0">0</div>
                        <div class="sd-stat-label">Works Published</div>
                    </div>
                    <div class="sd-stat-card glass-card">
                        <div class="sd-stat-icon">❤️</div>
                        <div class="sd-stat-value sd-counter" id="sd-stat-likes" data-target="0">0</div>
                        <div class="sd-stat-label">Total Likes</div>
                    </div>
                    <div class="sd-stat-card glass-card">
                        <div class="sd-stat-icon">👁️</div>
                        <div class="sd-stat-value sd-counter" id="sd-stat-views" data-target="0">0</div>
                        <div class="sd-stat-label">Total Views</div>
                    </div>
                    <div class="sd-stat-card glass-card">
                        <div class="sd-stat-icon">⭐</div>
                        <div class="sd-stat-value sd-counter" id="sd-stat-rating" data-target="0">0.0</div>
                        <div class="sd-stat-label">Avg Rating</div>
                    </div>
                    <div class="sd-stat-card glass-card">
                        <div class="sd-stat-icon">🏆</div>
                        <div class="sd-stat-value sd-counter" id="sd-stat-rank" data-target="0">#—</div>
                        <div class="sd-stat-label">Creator Rank</div>
                    </div>
                </div>

                <!-- Upload Button - Clean White -->
                <div class="animate-slide-up stagger-3 sd-upload-wrapper">
                    <a href="#upload" class="sd-upload-btn" data-link="upload">Upload your work</a>
                </div>

                <!-- My Recent Creations -->
                <div class="sd-section animate-slide-up stagger-4">
                    <div class="sd-section-header">
                        <h2 class="sd-section-title">🎨 My Recent Creations</h2>
                        <a href="#my-uploads" class="sd-view-all" data-link="my-uploads">View All Creations →</a>
                    </div>
                    <div class="grid sd-recent-grid" id="sd-recent-grid">
                        <div class="sd-loading-placeholder glass-card"><div class="spinner"></div></div>
                    </div>
                </div>

                <!-- Two-column layout: Challenge + Notifications -->
                <div class="sd-two-col animate-slide-up stagger-5">
                    <!-- Weekly Challenge -->
                    <div class="sd-challenge-card glass-card">
                        <div class="sd-challenge-badge">🔥 Weekly Creative Challenge</div>
                        <h3 class="sd-challenge-title">Theme: Mystery Story</h3>
                        <p class="sd-challenge-deadline">⏰ 4 Days Remaining</p>
                        <p class="sd-challenge-desc">Write a short mystery story that keeps readers guessing until the very last line.</p>
                        <a href="#upload" class="btn btn-primary sd-challenge-btn" data-link="upload">Submit Entry →</a>
                    </div>

                    <!-- Notifications Panel -->
                    <div class="sd-notifications glass-card">
                        <h3 class="sd-notif-title">🔔 Activity Feed</h3>
                        <div class="sd-notif-list" id="sd-activity-feed">
                            <div class="sd-loading-placeholder"><div class="spinner"></div></div>
                        </div>
                    </div>
                </div>

                <!-- Two-column layout: Leaderboard + Saved -->
                <div class="sd-two-col animate-slide-up stagger-5">
                    <!-- Premium Leaderboard Section -->
                    <div class="sd-leaderboard glass-card">
                        <div class="sd-lb-header">
                            <h3 class="sd-lb-title">🏆 Top Creators</h3>
                            <div class="sd-lb-meta">
                                <span class="sd-lb-badge">Shared Rankings</span>
                                <span class="sd-user-rank-lite" id="sd-user-rank-badge">#--</span>
                            </div>
                        </div>
                        
                        <!-- Podium for Top 3 -->
                        <div class="sd-lb-podium" id="sd-lb-podium">
                            <div class="sd-loading-placeholder"><div class="spinner"></div></div>
                        </div>
                        
                        <!-- Runners up list 4-10 -->
                        <div class="sd-lb-runners" id="sd-lb-runners"></div>
                        
                        <div class="sd-lb-footer">
                            <button class="sd-view-all-btn" id="sd-expand-leaderboard">View Full Rankings →</button>
                            <p class="sd-lb-tip">Keep creating to climb the ranks! 🚀</p>
                        </div>
                    </div>

                    <!-- Saved Creations - Premium Vertical Scroll Panel -->
                    <div class="sd-saved glass-card">
                        <div class="sd-saved-header">
                            <h3 class="sd-saved-title">📌 Saved Creations</h3>
                        </div>
                        <div class="sd-saved-panel" id="sd-saved-panel">
                            <div class="sd-saved-list" id="sd-saved-list">
                                <div class="sd-loading-placeholder"><div class="spinner"></div></div>
                            </div>
                        </div>
                        <a href="#explore" class="btn btn-outline sd-saved-explore" data-link="explore">Find More Inspiration →</a>
                    </div>
                </div>

                <!-- Profile Settings Shortcut -->
                <div class="sd-profile-shortcut glass-card">
                    <div class="sd-ps-header">
                        <div class="sd-ps-avatar">
                            ${profile?.avatar_url ? `<img src="${profile.avatar_url}" class="sd-ps-avatar-img">` : (profile?.display_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div class="sd-ps-info">
                            <h3>${profile?.display_name || 'Your Profile'}</h3>
                            <p class="text-muted">${profile?.role || 'student'} • Manage your account</p>
                        </div>
                    </div>
                    <div class="sd-ps-actions">
                        <a href="#profile" class="btn btn-primary btn-sm" data-link="profile">Edit Profile</a>
                        <a href="#explore" class="btn btn-outline btn-sm" data-link="explore">View Public Portfolio</a>
                        <a href="#profile" class="btn btn-outline btn-sm" data-link="profile">Account Settings</a>
                    </div>
                </div>
            </div>
        `,

        submissionRow: (sub, role) => `
            <div class="submission-item glass-card mb-16">
                <div class="sub-info">
                    <h3>${sub.title}</h3>
                    <div class="sub-meta">
                        <span>${sub.profiles?.display_name || 'Anonymous'}</span>
                        <span>${sub.category.replace('_', ' ')}</span>
                        <span>${new Date(sub.created_at).toLocaleDateString()}</span>
                        <span class="badge badge-status status-${sub.status}">${sub.status}</span>
                    </div>
                </div>
                <div class="sub-actions">
                    <button class="btn btn-primary btn-sm action-preview" data-id="${sub.id}">View</button>
                    <button class="btn btn-outline btn-sm action-edit" data-id="${sub.id}">Edit</button>
                    <button class="btn btn-danger btn-sm action-delete" data-id="${sub.id}">Delete</button>
                    ${sub.status === 'pending' ? `
                        <button class="btn btn-success btn-sm action-approve" data-id="${sub.id}">Approve</button>
                        <button class="btn btn-warning btn-sm action-reject" data-id="${sub.id}">Reject</button>
                    ` : ''}
                </div>
            </div>
        `,

        renderSavedCard: (sub) => {
            const stats = sub.submission_stats?.[0] || { avg_rating: 0, like_count: 0, view_count: 0 };
            const thumbUrl = UI.getSubmissionImageUrls(sub).previewUrl || UI.getThumbnailFallbackUrl(sub);
            const fallbackThumbUrl = UI.getThumbnailFallbackUrl(sub);
            const category = UI.getContentTypeLabel(sub.category, sub.content_type);

            return `
                <div class="sd-saved-card animate-fade-in" onclick="window.location.hash='#detail/${sub.id}'">
                    <div class="sd-sc-thumb">
                        <img src="${thumbUrl}" alt="${sub.title}" loading="lazy" onerror="this.src='${fallbackThumbUrl}'">
                        <span class="sd-sc-badge">${category}</span>
                    </div>
                    <div class="sd-sc-info">
                        <h4 class="sd-sc-title" title="${sub.title}">${sub.title}</h4>
                        <p class="sd-sc-author">by ${sub.profiles?.display_name || 'Anonymous'}</p>
                    </div>
                    <div class="sd-sc-metadata">
                        <div class="sd-sc-stat">
                            <span>❤️</span>
                            <span>${stats.like_count || 0}</span>
                        </div>
                        <div class="sd-sc-stat">
                            <span>👁️</span>
                            <span>${stats.view_count || 0}</span>
                        </div>
                        <div class="sd-sc-stat">
                            <span>⭐</span>
                            <span>${Number(stats.avg_rating || 0).toFixed(1)}</span>
                        </div>
                    </div>
                    <div class="sd-sc-action">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M9 18l6-6-6-6"/>
                        </svg>
                    </div>
                </div>
            `;
        }
    },

    setupOnboarding() {
        const nextBtn = document.getElementById('next-to-roles');
        const nameInput = document.getElementById('onboarding-name');

        nextBtn?.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) return UI.showToast('Please enter your name', 'error');

            localStorage.setItem('edtechra_display_name', name);

            document.getElementById('onboarding-step-1').classList.remove('active');
            document.getElementById('onboarding-step-2').classList.add('active');
        });

        document.querySelectorAll('.role-option-large').forEach(card => {
            card.addEventListener('click', () => {
                const role = card.dataset.role;
                localStorage.setItem('edtechra_role', role);
                UI.showToast(`Selected: ${role.charAt(0).toUpperCase() + role.slice(1)}`, 'success');
                window.location.hash = 'signup';
            });
        });
    },

    setupProfileEdit(user) {
        const form = document.getElementById('profile-form');
        const logoutBtn = document.getElementById('logout-btn-profile');
        const avatarDisplay = document.getElementById('profile-avatar-display');

        avatarDisplay?.addEventListener('click', () => {
            UI.showAvatarEditorModal(user);
        });

        logoutBtn?.addEventListener('click', async () => {
            UI.showLoader();
            await Auth.signOut();
            UI.hideLoader();
            window.location.hash = '#home';
            window.location.reload();
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const newName = formData.get('display_name');
            const data = {
                display_name: newName
            };

            UI.showLoader();
            const { error } = await Auth.updateProfile(user.id, data);
            UI.hideLoader();

            if (error) {
                UI.showToast(error.message, 'error');
            } else {
                UI.showToast('Profile updated!', 'success');
                // Update App state in-place without a full reload
                // This avoids the blank page caused by auth state race conditions
                if (window.App) {
                    if (window.App.profile) window.App.profile.display_name = newName;
                    window.App.renderNav();
                }
                // Also update the name input to reflect the saved value
                const nameInput = form.querySelector('[name="display_name"]');
                if (nameInput) nameInput.value = newName;
            }
        });
    },

    /**
     * Shows the Avatar Editor Modal for Profile Pictures
     */
    showAvatarEditorModal(user) {
        // Remove existing if any
        document.querySelector('.avatar-modal-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'avatar-modal-overlay animate-fade-in';

        let customUploadFile = null;
        let selectedAvatarUrl = null;
        let croppieInstance = null; // Store croppie instance globally within the modal

        const destroyCroppie = () => {
            if (croppieInstance) {
                croppieInstance.destroy();
                croppieInstance = null;
            }
        };

        const renderPickerGrid = (categoryId) => {
            const cat = AvatarLibrary.categories.find(c => c.id === categoryId);
            if (!cat) return '';
            return cat.avatars.map(url => `
                <div class="avatar-grid-item" data-url="${url}">
                    <img src="${url}" loading="lazy" alt="Avatar option">
                </div>
            `).join('');
        };

        const categoriesHtml = AvatarLibrary.categories.map(c =>
            `<button class="avatar-cat-btn ${c.id === 'boys' ? 'active' : ''}" data-id="${c.id}">${c.name}</button>`
        ).join('');

        overlay.innerHTML = `
            <div class="avatar-modal glass-card">
                <div class="avatar-modal-header">
                    <h3>Edit Profile Picture</h3>
                    <button class="close-modal-btn">&times;</button>
                </div>
                
                <div class="avatar-modal-body">
                    <div class="avatar-preview-section">
                        <div class="preview-circle" id="avatar-live-preview">
                            ${user.avatar_url
                ? `<img src="${user.avatar_url}" alt="Preview">`
                : `<span>${(user.display_name || 'U').charAt(0).toUpperCase()}</span>`
            }
                        </div>
                        <div class="preview-actions">
                            <label class="btn btn-outline" style="cursor: pointer; margin-bottom: 0;">
                                📁 Upload Custom
                                <input type="file" id="custom-avatar-upload" accept="image/jpeg, image/png, image/webp" hidden>
                            </label>
                            ${user.avatar_url ? `<button class="btn btn-danger-text" id="remove-avatar-btn">Remove Photo</button>` : ''}
                        </div>
                        <p class="text-muted text-xs mx-auto text-center" style="margin-top:0.5rem">Uploads must be < 50KB.</p>
                    </div>

                    <div class="avatar-selection-section">
                        <h4>Or Choose an Avatar</h4>
                        <div class="avatar-categories">
                            ${categoriesHtml}
                        </div>
                        <div class="avatar-picker-grid" id="avatar-picker-grid">
                            ${renderPickerGrid('boys')}
                        </div>
                    </div>
                </div>

                <div class="avatar-modal-footer">
                    <button class="btn btn-cancel" id="cancel-avatar-btn">Cancel</button>
                    <button class="btn btn-primary" id="save-avatar-btn">Save Changes</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // -- Event Listeners --

        const close = () => {
            destroyCroppie();
            overlay.classList.remove('animate-fade-in');
            overlay.classList.add('animate-fade-out');
            setTimeout(() => overlay.remove(), 250);
        };

        overlay.querySelector('.close-modal-btn').onclick = close;
        overlay.querySelector('#cancel-avatar-btn').onclick = close;
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // Category Switcher
        overlay.querySelectorAll('.avatar-cat-btn').forEach(btn => {
            btn.onclick = () => {
                overlay.querySelector('.avatar-cat-btn.active')?.classList.remove('active');
                btn.classList.add('active');
                const catId = btn.dataset.id;
                document.getElementById('avatar-picker-grid').innerHTML = renderPickerGrid(catId);
                bindGridClicks();
            };
        });

        const livePreview = document.getElementById('avatar-live-preview');

        // Grid Click (Select Built-in)
        const bindGridClicks = () => {
            overlay.querySelectorAll('.avatar-grid-item').forEach(item => {
                item.onclick = () => {
                    destroyCroppie();
                    overlay.querySelector('.avatar-grid-item.selected')?.classList.remove('selected');
                    item.classList.add('selected');
                    selectedAvatarUrl = item.dataset.url;
                    customUploadFile = null; // Clear custom upload if any
                    livePreview.innerHTML = `<img src="${selectedAvatarUrl}" alt="Preview">`;
                    // Remove Croppie overrides if they lingered
                    livePreview.classList.remove('croppie-active');
                };
            });
        };
        bindGridClicks();

        // Custom Upload
        document.getElementById('custom-avatar-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Optional front-end pre-flight check
            if (file.size > 10 * 1024 * 1024) {
                return UI.showToast('File is too large (max 10MB before compression)', 'error');
            }

            customUploadFile = file;
            selectedAvatarUrl = null;
            destroyCroppie();
            overlay.querySelector('.avatar-grid-item.selected')?.classList.remove('selected');

            const reader = new FileReader();
            reader.onload = (event) => {
                // Clear the preview content and setup Croppie container
                livePreview.innerHTML = '';
                // Soften structural constraints via CSS class so Croppie can set up its boundary freely.
                livePreview.classList.add('croppie-active');

                // Check if Croppie is available
                if (typeof Croppie === 'undefined') {
                    UI.showToast('Croppie library not loaded', 'error');
                    return;
                }

                croppieInstance = new Croppie(livePreview, {
                    viewport: { width: 150, height: 150, type: 'circle' },
                    boundary: { width: 220, height: 220 },
                    showZoomer: true,
                    enableOrientation: true
                });

                croppieInstance.bind({
                    url: event.target.result
                });
            };
            reader.readAsDataURL(file);
        });

        // Remove Avatar
        document.getElementById('remove-avatar-btn')?.addEventListener('click', () => {
            destroyCroppie();
            selectedAvatarUrl = 'REMOVE';
            customUploadFile = null;
            livePreview.classList.remove('croppie-active');
            livePreview.innerHTML = `<span>${(user.display_name || 'U').charAt(0).toUpperCase()}</span>`;
            overlay.querySelector('.avatar-grid-item.selected')?.classList.remove('selected');
        });

        // Save Changes
        document.getElementById('save-avatar-btn').addEventListener('click', async () => {
            if (!customUploadFile && !selectedAvatarUrl) {
                return close(); // Nothing changed
            }

            const saveBtn = document.getElementById('save-avatar-btn');
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            try {
                let finalUrl = null;

                if (selectedAvatarUrl === 'REMOVE') {
                    finalUrl = null; // Removed
                }
                else if (selectedAvatarUrl) {
                    finalUrl = selectedAvatarUrl; // Built-in DiceBear logic
                }
                else if (customUploadFile) {
                    let rawFileOrBlob = customUploadFile;

                    if (croppieInstance) {
                        // Extract perfectly squared crop directly from Croppie
                        rawFileOrBlob = await croppieInstance.result({
                            type: 'blob',
                            size: { width: 256, height: 256 },
                            format: 'jpeg',
                            circle: false // we want the square bounding box for storage
                        });
                        rawFileOrBlob.name = 'cropped.jpg'; // mock file props
                    }

                    // Import ImageUtils dynamically or assume it is available
                    const { ImageUtils } = await import('./image-utils.js');

                    // Compress and Upload via ImageUtils & Supabase
                    const compressedBlob = await ImageUtils.encodeProfileAvatar(rawFileOrBlob);
                    const path = `avatars/${user.id}-${Date.now()}.webp`;

                    const { error: uploadErr } = await supabase.storage.from('approved_public').upload(path, compressedBlob, {
                        contentType: 'image/webp', upsert: true
                    });

                    if (uploadErr) throw uploadErr;

                    const { data } = supabase.storage.from('approved_public').getPublicUrl(path);
                    finalUrl = data.publicUrl;
                }

                // Append to DB
                // Import Auth dynamically or assume it is available
                const { Auth } = await import('./auth.js');
                const { error: dbErr } = await Auth.updateProfile(user.id, { avatar_url: finalUrl });
                if (dbErr) throw dbErr;

                UI.showToast('Profile picture updated!', 'success');

                // Update local state and aggressively reload visual elements
                if (window.App && window.App.profile) {
                    window.App.profile.avatar_url = finalUrl;
                    window.App.renderNav(); // Force header refresh
                    const mainDisplay = document.getElementById('profile-avatar-display');
                    if (mainDisplay) {
                        mainDisplay.innerHTML = finalUrl
                            ? `<img src="${finalUrl}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; object-position: center; border-radius: 50%;">
                               <div class="avatar-edit-overlay">
                                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                               </div>`
                            : `<span style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 2.5rem; font-weight: 700; color: white;">${(user.display_name || 'U').charAt(0).toUpperCase()}</span>
                               <div class="avatar-edit-overlay">
                                  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                               </div>`;
                    }
                }

                close();
            } catch (err) {
                console.error(err);
                UI.showToast('Failed to save profile picture.', 'error');
                saveBtn.textContent = 'Save Changes';
                saveBtn.disabled = false;
            }
        });
    },

    setupAuthForms(type) {
        const form = document.querySelector(`#${type}-form`);
        if (!form) return;

        // Auto-fill display name from onboarding if present
        if (type === 'signup') {
            const nameInput = form.querySelector('[name="display_name"]');
            if (nameInput) nameInput.value = localStorage.getItem('edtechra_display_name') || '';
        }

        // Google Auth Listener
        const googleBtn = document.getElementById(type === 'login' ? 'google-login' : 'google-signup');
        googleBtn?.addEventListener('click', async () => {
            UI.showLoader();
            const { error } = await Auth.signInWithGoogle();
            if (error) UI.showToast(error.message, 'error');
            UI.hideLoader();
        });

        // DEV Auto Auth Listener (Localhost Only)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            const devBtn = document.getElementById(type === 'login' ? 'dev-auto-login' : 'dev-auto-signup');
            devBtn?.addEventListener('click', async () => {
                UI.showLoader();
                const testEmail = 'dev.test.user@edtechra.local';
                const testPass = 'DevTest123!';
                const tempRole = localStorage.getItem('edtechra_role') || 'admin';
                
                let result;
                if (type === 'login') {
                    result = await Auth.signIn(testEmail, testPass);
                    if (result.error && (result.error.message.includes('Invalid login credentials') || result.error.message.includes('not found') || result.error.status === 400 || (result.error.message || '').includes('rate limit') === false)) {
                        UI.showToast('Test user missing, attempting signup...', 'info');
                        result = await Auth.signUp(testEmail, testPass, 'Dev Auto Tester', tempRole);
                    }
                } else {
                    result = await Auth.signUp(testEmail, testPass, 'Dev Auto Tester', tempRole);
                    if (result.error && (result.error.message.includes('already registered') || result.error.status === 400 || (result.error.message || '').includes('rate limit') === false)) {
                        UI.showToast('Test user exists, attempting login...', 'info');
                        result = await Auth.signIn(testEmail, testPass);
                    }
                }
                
                if (result.error) {
                    UI.showToast('Auth error: ' + result.error.message, 'error');
                } else {
                    UI.showToast('DEV: Test account authenticated.', 'success');
                    localStorage.removeItem('edtechra_role');
                    localStorage.removeItem('edtechra_display_name');
                    window.location.hash = 'home';
                    setTimeout(() => window.location.reload(), 500);
                }
                UI.hideLoader();
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const email = formData.get('email');
            const password = formData.get('password');
            const displayName = formData.get('display_name');
            const role = formData.get('role') || localStorage.getItem('edtechra_role') || 'student';

            UI.showLoader();
            let result;
            if (type === 'login') {
                result = await Auth.signIn(email, password);
            } else {
                result = await Auth.signUp(email, password, displayName, role);
            }

            if (result.error) {
                UI.showToast(result.error.message, 'error');
            } else {
                UI.showToast(type === 'login' ? 'Welcome back!' : 'Account created successfully!', 'success');
                if (type === 'signup') {
                    localStorage.removeItem('edtechra_role');
                    localStorage.removeItem('edtechra_display_name');
                    window.location.hash = 'login';
                }
            }
            UI.hideLoader();
        });
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
