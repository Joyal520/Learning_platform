// assets/js/ui.js
import { Auth } from './auth.js';
import { supabase } from './supabase.js';
import { AvatarLibrary } from './avatars.js';
import { API } from './api.js';
import { BadgeEngine } from './badges.js';
import { buildAppPath, buildAppUrl } from './path-utils.js';

export const UI = {
    defaultThumbnailIcons: {
        stories: 'assets/images/story.png',
        writing: 'assets/images/writing.png',
        literature: 'assets/images/literature.png',
        lessons: 'assets/images/learning.png',
        learning: 'assets/images/learning.png',
        media: 'assets/images/media.png',
        fun: 'assets/images/fun.png'
    },
    _audioR2PublicBaseUrlPromise: null,
    _livePreviewConfigs: new Map(),
    _livePreviewDismissTimer: null,
    _cardSubmissionRegistry: new Map(),
    _inlinePreviewDocuments: new Map(),
    _inlinePreviewCounter: 0,
    _immersiveViewerOverlay: null,
    _immersiveViewerHistoryOpen: false,
    _immersiveViewerRestoreScrollY: 0,
    _immersiveViewerPopstateHandler: null,
    _immersiveViewerPreviouslyFocused: null,
    _submissionCelebrationTimeout: null,
    _submissionCelebrationCleanup: null,
    _submissionCelebrationPageHideHandler: null,
    _submissionCelebrationPreviousBodyOverflow: '',
    _submissionCelebrationPreviousHtmlOverflow: '',
    _badgeCelebrationQueue: Promise.resolve(),

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
        this.setupLivePreviewInteractions();

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
        return this.defaultThumbnailIcons[categoryKey] || 'assets/images/default.png';
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

    getSubmissionMediaKind(sub = {}) {
        if (!sub || typeof sub !== 'object') return '';

        const contentType = String(sub.content_type || '').trim().toLowerCase();
        const fileType = String(sub.file_type || sub.mime_type || '').trim().toLowerCase();
        const normalizedCategory = this.normalizeCategoryValue(sub.category, sub.content_type);

        const hasImageSignal = contentType === 'image' || fileType.startsWith('image/');
        const hasAudioSignal = contentType === 'audio' || fileType.startsWith('audio/');

        if (hasImageSignal) return 'image';
        if (hasAudioSignal) return 'audio';
        if (normalizedCategory === 'images') return 'image';
        if (normalizedCategory === 'songs') return 'audio';
        return '';
    },

    isImageSubmission(sub = {}) {
        return this.getSubmissionMediaKind(sub) === 'image';
    },

    isAudioSubmission(sub = {}) {
        return this.getSubmissionMediaKind(sub) === 'audio';
    },

    isStrictImageSubmission(sub = {}) {
        if (!sub || typeof sub !== 'object') return false;

        const contentType = String(sub.content_type || '').trim().toLowerCase();
        const fileType = String(sub.file_type || sub.mime_type || '').trim().toLowerCase();
        const sourceRef = String(sub.file_url || sub.public_url || sub.file_path || '').trim().toLowerCase();
        const hasAudioSignal = contentType === 'audio'
            || contentType === 'song'
            || contentType === 'songs'
            || fileType.startsWith('audio/');
        const hasImageSignal = contentType === 'image'
            || fileType.startsWith('image/')
            || /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:\?|#|$)/i.test(sourceRef);

        if (hasAudioSignal) return false;
        return hasImageSignal;
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

    getProjectFileLabel(sub = {}) {
        const fileReference = String(sub.file_url || sub.public_url || sub.file_path || '').toLowerCase();
        const fileType = String(sub.file_type || sub.mime_type || '').toLowerCase();

        if (fileReference.endsWith('.zip') || fileType.includes('zip')) return 'Website project (ZIP)';
        if (fileReference.endsWith('.html') || fileReference.endsWith('.htm') || fileType === 'text/html') return 'HTML website project';
        if (fileReference.endsWith('.pdf') || fileType === 'application/pdf') return 'PDF document';
        if (fileReference.endsWith('.ppt') || fileType.includes('powerpoint')) return 'PowerPoint presentation';
        if (fileReference.endsWith('.pptx') || fileType.includes('presentationml')) return 'PowerPoint presentation';
        if (fileReference.endsWith('.doc') || fileType === 'application/msword') return 'Word document';
        if (fileReference.endsWith('.docx') || fileType.includes('wordprocessingml')) return 'Word document';
        return sub.file_type || 'file';
    },

    getSubmissionFileUrl(sub = {}) {
        const resolvedUrl = this.resolveMediaUrl(sub.public_url || sub.file_url || sub.file_path || '') || null;
        console.log('[UI] Resolved file preview URL:', {
            submissionId: sub?.id || null,
            raw: sub.public_url || sub.file_url || sub.file_path || null,
            resolvedUrl
        });
        return resolvedUrl;
    },

    getSubmissionFileExtension(sub = {}) {
        const reference = String(sub.file_url || sub.public_url || sub.file_path || '').toLowerCase();
        const match = reference.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
        return match?.[1] || '';
    },

    getLivePreviewSource(sub = {}) {
        const rawSource = String(sub.public_url || sub.file_url || sub.file_path || '').trim();
        if (!rawSource) return null;

        const resolved = this.resolveMediaUrl(rawSource);
        if (!resolved) return null;

        try {
            return new URL(resolved, window.location.href).toString();
        } catch (_) {
            return null;
        }
    },

    isLivePreviewSupported(sub = {}) {
        return !!this.getLivePreviewDescriptor(sub);
    },

    getInlineHtmlCandidateEntries(sub = {}) {
        if (!sub || typeof sub !== 'object') return [];

        const candidateFields = [
            'html',
            'html_content',
            'content_html',
            'content',
            'body',
            'body_html',
            'source_code',
            'code',
            'pasted_code',
            'project_code',
            'raw_content',
            'content_text',
            'submission_text',
            'text_content',
            'markup',
            'rendered_html'
        ];

        return candidateFields.map((field) => ({
            field,
            value: typeof sub?.[field] === 'string' ? sub[field] : ''
        }));
    },

    looksLikeHtmlMarkup(value = '') {
        const source = String(value || '').trim();
        if (!source) return false;

        return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<div[\s>]|<section[\s>]|<main[\s>]|<article[\s>]|<style[\s>]|<script[\s>]|<[a-z][\w:-]*(\s|>)/i.test(source);
    },

    resolveInlineHtmlSource(sub = {}) {
        const contentMode = String(sub?.content_mode || sub?.contentMode || '').trim().toLowerCase();
        const contentType = String(sub?.content_type || '').trim().toLowerCase();
        const fileType = String(sub?.file_type || sub?.mime_type || '').trim().toLowerCase();
        const extension = this.getSubmissionFileExtension(sub);
        const shouldPreferInlineHtml = contentMode === 'code'
            || contentMode === 'paste'
            || contentMode === 'inline'
            || fileType === 'text/html'
            || fileType === 'application/xhtml+xml'
            || extension === 'html'
            || extension === 'htm'
            || contentType === 'project';

        for (const candidate of this.getInlineHtmlCandidateEntries(sub)) {
            const html = String(candidate.value || '').trim();
            if (!html) continue;

            if (this.looksLikeHtmlMarkup(html) || shouldPreferInlineHtml) {
                return {
                    html,
                    field: candidate.field
                };
            }
        }

        return {
            html: '',
            field: ''
        };
    },

    sanitizeSubmissionStorageSegment(value = '') {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80);
    },

    deriveR2PublicBaseUrl(sub = {}) {
        const fileUrl = String(sub?.file_url || '').trim();
        const filePath = String(sub?.file_path || '').trim().replace(/^\/+/, '');

        if (!fileUrl || !filePath || !/^https?:\/\//i.test(fileUrl)) {
            return '';
        }

        try {
            const parsedUrl = new URL(fileUrl, window.location.href);
            const decodedPathname = decodeURIComponent(parsedUrl.pathname || '');
            const normalizedFilePath = `/${filePath}`;

            if (decodedPathname.endsWith(normalizedFilePath)) {
                const basePathname = decodedPathname
                    .slice(0, decodedPathname.length - normalizedFilePath.length)
                    .replace(/\/+$/, '');
                return `${parsedUrl.origin}${basePathname}`;
            }

            const withoutQuery = fileUrl.replace(/[?#].*$/, '');
            if (withoutQuery.endsWith(filePath)) {
                return withoutQuery.slice(0, withoutQuery.length - filePath.length).replace(/\/+$/, '');
            }
        } catch (_) {
            // Fall back to empty string when the stored file URL cannot be parsed safely.
        }

        return '';
    },

    buildSubmissionObjectPublicUrl(sub = {}, objectKey = '') {
        const normalizedObjectKey = String(objectKey || '').trim().replace(/^\/+/, '');
        if (!normalizedObjectKey) return '';
        if (/^https?:\/\//i.test(normalizedObjectKey)) return normalizedObjectKey;

        const publicBaseUrl = this.deriveR2PublicBaseUrl(sub);
        if (!publicBaseUrl) return '';

        return `${publicBaseUrl}/${normalizedObjectKey}`;
    },

    getSubmissionZipWebsiteState(sub = {}) {
        const fileType = String(sub?.file_type || sub?.mime_type || '').trim().toLowerCase();
        if (!fileType.includes('zip') || !sub?.id || !sub?.author_id) {
            return {};
        }

        const safeAuthorId = this.sanitizeSubmissionStorageSegment(sub.author_id);
        const safeSubmissionId = this.sanitizeSubmissionStorageSegment(sub.id);
        if (!safeAuthorId || !safeSubmissionId) {
            return {};
        }

        const extracted_root_path = `web-projects/${safeAuthorId}/${safeSubmissionId}`;
        const index_path = 'index.html';
        const entry_file_path = `${extracted_root_path}/${index_path}`;
        const preview_url = this.buildSubmissionObjectPublicUrl(sub, entry_file_path) || '';

        return {
            zip_storage_path: sub.file_path || '',
            extracted_root_path,
            entry_file_path,
            preview_url,
            index_path
        };
    },

    resolveRenderableWebsiteTarget(sub = {}) {
        const contentType = String(sub.file_type || sub.mime_type || '').trim().toLowerCase();
        const contentMode = String(sub.content_mode || '').trim().toLowerCase();
        const extension = this.getSubmissionFileExtension(sub);
        const inlineHtmlSource = this.resolveInlineHtmlSource(sub);
        const zipWebsiteState = this.getSubmissionZipWebsiteState(sub);
        const resolvedHtml = inlineHtmlSource.html;
        const hasInlineHtml = resolvedHtml !== '';
        const explicitCandidates = [
            zipWebsiteState.preview_url,
            sub.preview_url,
            sub.project_url,
            sub.html_url,
            sub.website_url,
            sub.public_url,
            sub.file_url,
            sub.file_path
        ].map((value) => String(value || '').trim()).filter(Boolean);
        const candidateIndexPath = String(
            zipWebsiteState.index_path
            || zipWebsiteState.indexPath
            ||
            sub.index_path
            || sub.indexPath
            || sub.website_index_path
            || sub.websiteIndexPath
            || sub.project_index_path
            || sub.projectIndexPath
            || ''
        ).trim();
        const acceptedGenericExtensions = new Set(['', 'html', 'htm']);
        const blockedExtensions = new Set(['pdf', 'ppt', 'pptx', 'doc', 'docx', 'mp3', 'wav', 'ogg', 'png', 'jpg', 'jpeg', 'gif', 'webp']);
        const isDocumentLike = this.isPdfSubmission(sub) || this.isPowerPointSubmission(sub);

        if (hasInlineHtml) {
            return {
                mode: 'srcdoc',
                url: null,
                sourceField: inlineHtmlSource.field || 'content_text',
                basePath: '',
                indexPath: '',
                fallbackReason: '',
                inlineHtml: resolvedHtml
            };
        }

        if (isDocumentLike) {
            const fallbackReason = 'Submission is handled by a dedicated document viewer.';
            return {
                mode: '',
                url: null,
                sourceField: '',
                basePath: '',
                indexPath: '',
                fallbackReason,
                inlineHtml: ''
            };
        }

        for (const candidate of explicitCandidates) {
            const resolvedCandidate = this.resolveMediaUrl(candidate) || candidate;
            if (!resolvedCandidate) continue;

            try {
                const url = new URL(resolvedCandidate, window.location.href);
                const candidateExtension = (url.pathname.match(/\.([a-z0-9]+)(?:$|\?|#)/i)?.[1] || '').toLowerCase();
                const isProbablyWebsite = acceptedGenericExtensions.has(candidateExtension)
                    || contentType === 'text/html'
                    || contentType === 'application/xhtml+xml'
                    || candidate === sub.preview_url
                    || candidate === sub.project_url
                    || candidate === sub.html_url
                    || candidateIndexPath !== '';

                if (!isProbablyWebsite || blockedExtensions.has(candidateExtension)) {
                    continue;
                }

                let finalUrl = url.toString();
                let indexPath = url.pathname || '';
                let basePath = url.pathname.replace(/[^/]*$/, '');

                if (candidateIndexPath) {
                    finalUrl = new URL(candidateIndexPath.replace(/^\/+/, ''), `${url.origin}${basePath}`).toString();
                    const finalParsed = new URL(finalUrl, window.location.href);
                    indexPath = candidateIndexPath;
                    basePath = finalParsed.pathname.replace(/[^/]*$/, '');
                }

                return {
                    mode: 'url',
                    url: finalUrl,
                    sourceField: candidate,
                    basePath,
                    indexPath,
                    fallbackReason: '',
                    inlineHtml: ''
                };
            } catch (_) {
                // Keep trying legacy/current candidates.
            }
        }

        const fallbackReason = explicitCandidates.length
            ? 'No valid preview URL or index.html target could be resolved from submission fields.'
            : 'No legacy or current website preview fields were present on the submission.';
        return {
            mode: '',
            url: null,
            sourceField: '',
            basePath: '',
            indexPath: '',
            fallbackReason,
            inlineHtml: ''
        };
    },

    resolveHtmlPreviewEntry(sub = {}) {
        const contentType = String(sub.file_type || sub.mime_type || '').trim().toLowerCase();
        const extension = this.getSubmissionFileExtension(sub);
        const resolvedTarget = this.resolveRenderableWebsiteTarget(sub);
        const hasInlineHtml = resolvedTarget.mode === 'srcdoc';
        const isHtmlLikeFile = hasInlineHtml
            || contentType === 'text/html'
            || contentType === 'application/xhtml+xml'
            || extension === 'html'
            || extension === 'htm'
            || !!resolvedTarget.url;
        const isZipWebsite = contentType.includes('zip') || extension === 'zip' || !!resolvedTarget.indexPath;
        let previewUrl = null;
        let indexPath = '';
        let basePath = '';
        let iframeSrc = '';
        let fallbackReason = resolvedTarget.fallbackReason || '';
        let mode = '';

        if (hasInlineHtml) {
            mode = 'srcdoc';
            fallbackReason = '';
        } else if (resolvedTarget.mode === 'url' && resolvedTarget.url) {
            previewUrl = resolvedTarget.url;
            iframeSrc = resolvedTarget.url;
            indexPath = resolvedTarget.indexPath || '';
            basePath = resolvedTarget.basePath || '';
            mode = 'url';
            fallbackReason = '';
        }

        return {
            contentType,
            previewUrl,
            indexPath,
            basePath,
            iframeSrc,
            fallbackReason,
            mode,
            hasInlineHtml,
            inlineHtml: resolvedTarget.inlineHtml || '',
            isHtmlLikeFile,
            isZipWebsite
        };
    },

    isInteractiveWebCard(sub = {}) {
        if (!sub || typeof sub !== 'object') return false;
        if (this.isAudioSubmission(sub) || this.isImageSubmission(sub)) return false;
        if (this.isPdfSubmission(sub) || this.isPowerPointSubmission(sub)) return false;

        const preview = this.resolveHtmlPreviewEntry(sub);
        return preview.mode === 'srcdoc' || (preview.mode === 'url' && !!preview.iframeSrc);
    },

    isExploreImmersiveCard(sub = {}) {
        if (!sub || typeof sub !== 'object') return false;
        const normalizedCategory = this.normalizeCategoryValue(sub.category, sub.content_type);
        if (this.isAudioSubmission(sub) || this.isImageSubmission(sub)) return false;
        if (normalizedCategory === 'presentations') return false;

        const fileType = String(sub.file_type || sub.mime_type || '').toLowerCase();
        if (this.isPowerPointSubmission(sub)) return false;

        return true;
    },

    getLivePreviewDescriptor(sub = {}) {
        if (!sub || typeof sub !== 'object') return null;

        const preview = this.resolveHtmlPreviewEntry(sub);

        if (preview.mode === 'srcdoc') {
            return {
                mode: 'srcdoc',
                srcdoc: this.wrapCodeForPreview(preview.inlineHtml || this.resolveInlineHtmlSource(sub).html),
                title: sub.title || 'Live Preview',
                sourceUrl: preview.previewUrl || preview.iframeSrc || '',
                fallbackMessage: 'This web preview could not be rendered inline right now.'
            };
        }

        if (preview.mode !== 'url' || !preview.iframeSrc) {
            return null;
        }

        return {
            mode: 'url',
            src: preview.iframeSrc,
            title: sub.title || 'Live Preview',
            sourceUrl: preview.previewUrl || preview.iframeSrc,
            fallbackMessage: 'This website could not be loaded inside the live preview viewer.'
        };
    },

    ensureSubmissionStats(sub = {}) {
        if (!Array.isArray(sub.submission_stats) || sub.submission_stats.length === 0) {
            sub.submission_stats = [{ avg_rating: 0, like_count: 0, view_count: 0 }];
        }

        const stats = sub.submission_stats[0];
        stats.avg_rating = this.getAverageRatingValue(stats);
        stats.like_count = Math.max(0, Number(stats.like_count) || 0);
        stats.view_count = Math.max(0, Number(stats.view_count) || 0);
        return stats;
    },

    registerSubmissionCardState(sub = {}) {
        if (!sub?.id) return;
        this._cardSubmissionRegistry.set(String(sub.id), sub);
    },

    getSubmissionPrimaryTimestamp(sub = {}) {
        return sub.created_at || sub.updated_at || null;
    },

    formatRelativeTime(timestamp) {
        if (!timestamp) return 'Just now';

        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            return 'Just now';
        }

        const diffMs = Date.now() - date.getTime();
        const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

        if (diffSeconds < 60) return 'Just now';

        const intervals = [
            { limit: 60, unit: 'minute', seconds: 60 },
            { limit: 24, unit: 'hour', seconds: 3600 },
            { limit: 7, unit: 'day', seconds: 86400 },
            { limit: 4.35, unit: 'week', seconds: 604800 },
            { limit: 12, unit: 'month', seconds: 2629800 }
        ];

        for (const interval of intervals) {
            const value = diffSeconds / interval.seconds;
            if (value < interval.limit) {
                const rounded = Math.max(1, Math.floor(value));
                return `${rounded} ${interval.unit}${rounded === 1 ? '' : 's'} ago`;
            }
        }

        const years = Math.max(1, Math.floor(diffSeconds / 31557600));
        return `${years} year${years === 1 ? '' : 's'} ago`;
    },

    getFeedDownloadConfig(sub = {}) {
        const title = sub.title || 'download';
        const { previewUrl, fullUrl } = this.getSubmissionImageUrls(sub);
        const extension = this.getSubmissionFileExtension(sub);
        const rawUrl = sub.file_url || sub.image_url || fullUrl || previewUrl || null;

        if (!rawUrl) return null;

        return {
            url: rawUrl,
            filename: this.buildDownloadFileName(title, rawUrl, extension || undefined)
        };
    },

    renderFeedHeader(sub = {}, { categoryLabel = '', color = '#64748b' } = {}) {
        const authorName = sub.profiles?.display_name || 'Anonymous';
        const avatarUrl = sub.profiles?.avatar_url || '';
        const initials = authorName.charAt(0).toUpperCase();
        const timestamp = this.formatRelativeTime(this.getSubmissionPrimaryTimestamp(sub));

        return `
            <div class="feed-card-header">
                <div class="feed-card-author">
                    <div class="feed-card-avatar" style="--feed-avatar-accent:${color}">
                        ${avatarUrl
                            ? `<img src="${avatarUrl}" alt="${authorName}" class="feed-card-avatar-img">`
                            : `<span class="feed-card-avatar-fallback">${initials}</span>`}
                    </div>
                    <div class="feed-card-author-copy">
                        <div class="feed-card-author-line">
                            <span class="feed-card-author-name">${authorName}</span>
                        </div>
                        <div class="feed-card-meta-line">
                            <span class="feed-card-time">${timestamp}</span>
                            <span class="feed-card-meta-dot">•</span>
                            <span class="feed-card-type">${categoryLabel}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    formatExploreCardTitle(title = '') {
        const rawTitle = String(title || '').replace(/\s+/g, ' ').trim();
        if (!rawTitle) return 'Untitled';

        const lowerCased = rawTitle.toLocaleLowerCase();
        let shouldUppercaseNext = true;

        return Array.from(lowerCased).map((char) => {
            if (shouldUppercaseNext && /\p{L}/u.test(char)) {
                shouldUppercaseNext = false;
                return char.toLocaleUpperCase();
            }

            if (/[.!?]/.test(char)) {
                shouldUppercaseNext = true;
            }

            return char;
        }).join('');
    },

    renderFeedActionBar(sub = {}, stats = {}, options = {}) {
        const shareUrl = this.createWhatsAppShareUrl(sub.title || 'Shared work', sub.id);
        const downloadConfig = options.includeDownload === false ? null : this.getFeedDownloadConfig(sub);
        const detailLabel = options.detailLabel || 'Open';
        const previewAction = options.previewAction || '';
        const likeCount = Math.max(0, Number(stats.like_count) || 0);
        const viewCount = Math.max(0, Number(stats.view_count) || 0);
        const isLiked = !!sub._feedIsLiked;
        const isBookmarked = !!sub._feedIsBookmarked;

        return `
            <div class="feed-action-bar">
                <div class="feed-action-group">
                    <button type="button"
                            class="feed-action-pill interaction-btn btn-like ${isLiked ? 'liked' : ''}"
                            data-id="${sub.id}"
                            aria-label="Like post"
                            aria-pressed="${isLiked ? 'true' : 'false'}">
                        <span class="feed-action-icon">❤</span>
                        <span class="feed-action-label">Like</span>
                        <span class="like-count">${likeCount}</span>
                    </button>
                    <a href="${shareUrl}"
                       target="_blank"
                       rel="noopener noreferrer"
                       class="feed-action-pill btn-share"
                       aria-label="Share on WhatsApp">
                        <span class="feed-action-icon">WA</span>
                        <span class="feed-action-label">Share</span>
                    </a>
                    <button type="button"
                            class="feed-action-pill interaction-btn btn-save ${isBookmarked ? 'bookmarked' : ''}"
                            data-id="${sub.id}"
                            aria-label="Bookmark post"
                            aria-pressed="${isBookmarked ? 'true' : 'false'}">
                        <span class="feed-action-icon">🔖</span>
                        <span class="feed-action-label">Save</span>
                    </button>
                    ${downloadConfig ? `
                        <a href="${downloadConfig.url}"
                           class="feed-action-pill btn-download"
                           data-download-url="${downloadConfig.url}"
                           data-filename="${downloadConfig.filename}"
                           aria-label="Download">
                            <span class="feed-action-icon">↓</span>
                            <span class="feed-action-label">Download</span>
                        </a>
                    ` : ''}
                </div>
                <div class="feed-action-secondary">
                    <span class="feed-action-stat">
                        <span class="feed-action-stat-icon">★</span>
                        <span>${this.formatAverageRating(stats)}</span>
                    </span>
                    <span class="feed-action-stat">
                        <span class="feed-action-stat-icon">👁</span>
                        <span>${viewCount}</span>
                    </span>
                    ${previewAction}
                    <a href="#detail/${sub.id}" class="feed-action-link" data-link="detail/${sub.id}">${detailLabel}</a>
                </div>
            </div>
        `;
    },

    getRegisteredSubmissionCardState(submissionId) {
        if (!submissionId) return null;
        return this._cardSubmissionRegistry.get(String(submissionId)) || null;
    },

    async hydrateInteractiveWebCardState(submissions = []) {
        const list = Array.isArray(submissions) ? submissions.filter(Boolean) : [];
        list.forEach((submission) => this.registerSubmissionCardState(submission));

        const interactiveItems = list.filter((submission) => this.isExploreImmersiveCard(submission));
        if (!interactiveItems.length) return;

        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id || null;
        if (!userId) return;

        const interactionMap = await API.getUserSubmissionInteractions(interactiveItems.map((item) => item.id), userId);
        interactiveItems.forEach((submission) => {
            const interaction = interactionMap[submission.id] || {};
            submission._interactiveWebLiked = !!interaction.liked;
            submission._interactiveWebBookmarked = !!interaction.bookmarked;
            submission._interactiveWebUserRating = Number(interaction.userRating) || null;
        });
    },

    async ensureSubmissionCardDetail(submissionId) {
        const submission = this.getRegisteredSubmissionCardState(submissionId);
        if (!submission) return null;

        if (submission._fullSubmissionLoaded) {
            return submission;
        }

        if (!submission._fullSubmissionPromise) {
            submission._fullSubmissionPromise = API.getSubmissionById(submissionId)
                .then(({ data, error }) => {
                    if (error || !data) {
                        throw error || new Error('Submission not found.');
                    }

                    Object.assign(submission, data);
                    submission._fullSubmissionLoaded = true;
                    return submission;
                })
                .finally(() => {
                    submission._fullSubmissionPromise = null;
                });
        }

        return submission._fullSubmissionPromise;
    },

    registerLivePreview(sub = {}, options = {}) {
        const descriptor = this.getLivePreviewDescriptor(sub);
        if (!descriptor || !sub?.id) return '';

        const label = options.label || '';
        const extraClassName = options.className || '';
        this._livePreviewConfigs.set(String(sub.id), descriptor);
        return `
            <button type="button"
                    class="btn clay-btn btn-sm btn-snake btn-round ${label ? 'btn-wide' : 'btn-icon'} btn-live-preview ${extraClassName}"
                    data-live-preview-open="true"
                    data-submission-id="${sub.id}"
                    title="Open live preview"
                    aria-label="Open live preview">
                <span></span><span></span><span></span><span></span>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" style="position: relative; z-index: 5;">
                    <path d="M4 8V5a1 1 0 0 1 1-1h3"></path>
                    <path d="M16 4h3a1 1 0 0 1 1 1v3"></path>
                    <path d="M20 16v3a1 1 0 0 1-1 1h-3"></path>
                    <path d="M8 20H5a1 1 0 0 1-1-1v-3"></path>
                    <path d="M9 9h6v6H9z"></path>
                </svg>
                ${label ? `<span class="btn-live-preview-label" style="position: relative; z-index: 5;">${label}</span>` : ''}
            </button>
        `;
    },

    isPdfSubmission(sub = {}) {
        const fileType = String(sub.file_type || sub.mime_type || '').toLowerCase();
        const extension = this.getSubmissionFileExtension(sub);
        return fileType === 'application/pdf' || extension === 'pdf';
    },

    isPowerPointSubmission(sub = {}) {
        const fileType = String(sub.file_type || sub.mime_type || '').toLowerCase();
        const extension = this.getSubmissionFileExtension(sub);
        return fileType.includes('presentationml') || fileType.includes('powerpoint') || extension === 'pptx' || extension === 'ppt';
    },

    canEmbedOfficePresentation(fileUrl = '') {
        if (!fileUrl || !/^https:\/\//i.test(fileUrl)) return false;

        try {
            const url = new URL(fileUrl, window.location.href);
            const hostname = String(url.hostname || '').toLowerCase();
            const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
            const isPrivateHost = /^10\./.test(hostname)
                || /^192\.168\./.test(hostname)
                || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
            const hasSignedParams = url.searchParams.has('token')
                || url.searchParams.has('x-amz-signature')
                || url.searchParams.has('x-amz-credential')
                || url.searchParams.has('x-amz-security-token');
            const hasPrivateStoragePath = url.pathname.includes('/object/sign/') || url.pathname.includes('/storage/v1/object/sign/');

            return !isLocalHost && !isPrivateHost && !hasSignedParams && !hasPrivateStoragePath;
        } catch (_) {
            return false;
        }
    },

    getOfficePresentationViewerUrl(fileUrl = '') {
        if (!this.canEmbedOfficePresentation(fileUrl)) return null;
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
    },

    renderPreviewToolbar({ label, actions = [] } = {}) {
        return `<div class="preview-header document-preview-toolbar">
                    <div class="preview-dots"><span></span><span></span><span></span></div>
                    <div class="preview-label">${label || 'DOCUMENT PREVIEW'}</div>
                    <div class="preview-action-group">
                        ${actions.filter(Boolean).join('')}
                    </div>
                </div>`;
    },

    renderPreviewActionLink({ href, label, title, download = null, target = '_blank' } = {}) {
        if (!href || !label) return '';

        const downloadAttr = download ? ` download="${download}"` : '';
        const targetAttr = target ? ` target="${target}"` : '';
        const relAttr = target === '_blank' ? ' rel="noopener noreferrer"' : '';

        return `<a href="${href}" class="preview-action-link" title="${title || label}" aria-label="${label}"${targetAttr}${relAttr}${downloadAttr}>${label}</a>`;
    },

    renderPreviewActionButton({ id, label, title, hidden = false, disabled = false, className = '' } = {}) {
        if (!id || !label) return '';

        return `<button type="button" id="${id}" class="preview-action-button ${className} ${hidden ? 'hidden' : ''}" title="${title || label}" aria-label="${label}" ${disabled ? 'disabled' : ''}>${label}</button>`;
    },

    renderPdfPreview(sub = {}) {
        const fileUrl = this.getSubmissionFileUrl(sub);
        if (!fileUrl) {
            return `<div class="file-placeholder">📄 This PDF is unavailable for inline viewing right now. Please use the download button below.</div>`;
        }

        const downloadName = this.buildDownloadFileName(sub.title || 'document', fileUrl, 'pdf');
        const presentAction = this.renderPreviewActionButton({
            id: 'pdfPresentBtn',
            label: 'Present',
            hidden: true
        });
        const openAction = this.renderPreviewActionLink({
            href: fileUrl,
            label: 'Open in new tab'
        });
        const downloadAction = this.renderPreviewActionLink({
            href: this.buildDownloadProxyUrl(fileUrl, downloadName),
            label: 'Download',
            download: downloadName,
            target: '_self'
        });

        return `<div class="document-preview-shell pdf-workspace-shell" id="pdfViewerRoot" data-pdf-url="${fileUrl}" data-download-url="${this.buildDownloadProxyUrl(fileUrl, downloadName)}" data-file-name="${downloadName}">
                    ${this.renderPreviewToolbar({
                        label: 'PDF WORKSPACE',
                        actions: [
                            `<div class="preview-action-group pdf-toolbar-controls">
                                ${this.renderPreviewActionButton({ id: 'pdfPrevBtn', label: 'Previous', disabled: true })}
                                <span class="pdf-page-indicator" id="pdfPageIndicator" aria-live="polite">Page 1 / --</span>
                                ${this.renderPreviewActionButton({ id: 'pdfNextBtn', label: 'Next', disabled: true })}
                                ${this.renderPreviewActionButton({ id: 'pdfZoomOutBtn', label: '−', title: 'Zoom out', disabled: true, className: 'pdf-zoom-button' })}
                                ${this.renderPreviewActionButton({ id: 'pdfZoomInBtn', label: '+', title: 'Zoom in', disabled: true, className: 'pdf-zoom-button' })}
                                ${this.renderPreviewActionButton({ id: 'pdfFitBtn', label: 'Fit', title: 'Fit page', disabled: true, className: 'pdf-fit-button' })}
                            </div>`,
                            `<div class="preview-action-group pdf-toolbar-actions">
                                ${presentAction}
                                ${openAction}
                                ${downloadAction}
                            </div>`
                        ]
                    })}
                    <div class="pdf-stage" id="pdfStage" tabindex="0" aria-label="PDF viewer">
                        <div class="pdf-loading" id="pdfLoading">Loading PDF…</div>
                        <div class="document-preview-fallback hidden" id="pdfFallback">
                            <p>Inline PDF viewing is unavailable in this browser, but you can still open or download the file.</p>
                            <div class="document-preview-fallback-actions">
                                ${openAction}
                                ${downloadAction}
                            </div>
                        </div>
                        <canvas class="document-preview-frame pdf-preview-canvas hidden" id="pdfCanvas" aria-label="PDF page preview"></canvas>
                        <div class="pdf-laser-pointer hidden" id="pdfLaserPointer" aria-hidden="true"></div>
                    </div>
                    <div class="pdf-present-overlay-control hidden" id="pdfPresentOverlayControls">
                        ${this.renderPreviewActionButton({ id: 'pdfOverlayPrevBtn', label: 'Previous', className: 'pdf-overlay-button' })}
                        <span class="pdf-page-indicator pdf-overlay-indicator" id="pdfOverlayPageIndicator" aria-live="polite">Page 1 / --</span>
                        ${this.renderPreviewActionButton({ id: 'pdfOverlayNextBtn', label: 'Next', className: 'pdf-overlay-button' })}
                        ${this.renderPreviewActionButton({ id: 'pdfRemoteToggleBtn', label: 'Remote Control', className: 'pdf-overlay-button' })}
                        ${this.renderPreviewActionButton({ id: 'pdfExitPresentBtn', label: 'Exit Present Mode', className: 'pdf-overlay-button pdf-exit-button' })}
                    </div>
                    <aside class="pdf-remote-panel hidden" id="pdfRemotePanel" aria-live="polite">
                        <div class="pdf-remote-panel-header">
                            <div>
                                <p class="pdf-remote-eyebrow">Remote Control</p>
                                <h3>Phone pairing</h3>
                            </div>
                            <button type="button" class="pdf-remote-close" id="pdfRemoteCloseBtn" aria-label="Close remote control panel">×</button>
                        </div>
                        <div class="pdf-remote-panel-body">
                            <button type="button" class="btn btn-primary pdf-remote-enable-btn" id="pdfRemoteEnableBtn">Enable remote</button>
                            <div class="pdf-remote-status-grid">
                                <div class="pdf-remote-status-item">
                                    <span class="pdf-remote-status-label">Session</span>
                                    <strong id="pdfRemoteSessionState">Inactive</strong>
                                </div>
                                <div class="pdf-remote-status-item">
                                    <span class="pdf-remote-status-label">Phone</span>
                                    <strong id="pdfRemoteConnectionState">Disconnected</strong>
                                </div>
                            </div>
                            <div class="pdf-remote-code-card">
                                <span class="pdf-remote-status-label">Manual pairing code</span>
                                <div class="pdf-remote-pairing-code" id="pdfRemotePairingCode">------</div>
                                <p class="pdf-remote-code-help">Backup code. QR pairing is recommended first.</p>
                            </div>
                            <div class="pdf-remote-qr-card" id="pdfRemoteQrCard">
                                <div class="pdf-remote-qr" id="pdfRemoteQrCode" aria-label="QR code for mobile remote pairing"></div>
                                <a href="#remote" class="pdf-remote-link" id="pdfRemotePairingLink">Open remote on this device</a>
                            </div>
                            <p class="pdf-remote-footnote">Only one active phone remote is allowed at a time. The presenter computer remains the source of truth.</p>
                        </div>
                    </aside>
                </div>`;
    },

    renderPresentationPreview(sub = {}) {
        const fileUrl = this.getSubmissionFileUrl(sub);
        const extension = this.getSubmissionFileExtension(sub) || 'pptx';
        const downloadName = this.buildDownloadFileName(sub.title || 'presentation', fileUrl || '', extension);
        const downloadLabel = extension === 'ppt' ? 'Download PPT' : 'Download PPTX';

        if (!fileUrl) {
            return `<div class="file-placeholder">📽️ This presentation is unavailable for inline viewing right now. Please use the download button below.</div>`;
        }

        const openAction = this.renderPreviewActionLink({
            href: fileUrl,
            label: 'Open Presentation'
        });
        const downloadAction = this.renderPreviewActionLink({
            href: this.buildDownloadProxyUrl(fileUrl, downloadName),
            label: downloadLabel,
            download: downloadName,
            target: '_self'
        });
        const officeViewerUrl = this.getOfficePresentationViewerUrl(fileUrl);

        if (!officeViewerUrl) {
            return `<div class="presentation-preview-shell presentation-fallback-shell">
                        ${this.renderPreviewToolbar({
                            label: 'PRESENTATION MODE',
                            actions: [openAction, downloadAction]
                        })}
                        <div class="presentation-fallback-panel">
                            <p class="presentation-fallback-title">Interactive preview is unavailable for this file, but presentation mode can be opened externally.</p>
                            <p class="presentation-fallback-note">Use the options below to open the presentation in a new tab or download the original file.</p>
                            <div class="presentation-fallback-actions">
                                ${openAction}
                                ${downloadAction}
                            </div>
                        </div>
                    </div>`;
        }

        const presentAction = this.renderPreviewActionLink({
            href: officeViewerUrl,
            label: 'Present Fullscreen'
        });

        return `<div class="presentation-preview-shell">
                    ${this.renderPreviewToolbar({
                        label: 'PRESENTATION MODE',
                        actions: [openAction, presentAction, downloadAction]
                    })}
                    <div class="presentation-frame-shell">
                        <iframe
                            class="presentation-preview-frame"
                            src="${officeViewerUrl}"
                            title="PowerPoint presentation preview"
                            loading="lazy"
                            allowfullscreen
                        ></iframe>
                    </div>
                </div>`;
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

    getTrustedInlineHtmlSandbox() {
        // Keep inline previews script-capable but isolated from the parent app.
        return 'allow-scripts';
    },

    registerInlinePreviewDocument(srcdoc = '') {
        const token = `inline-preview-${++this._inlinePreviewCounter}`;
        this._inlinePreviewDocuments.set(token, String(srcdoc || ''));
        return token;
    },

    renderInlinePreviewIframe({
        className = '',
        title = 'Content preview',
        sandbox = '',
        srcdoc = ''
    } = {}) {
        const token = this.registerInlinePreviewDocument(srcdoc);
        return `<iframe class="${className}" sandbox="${sandbox}" title="${title}" data-inline-preview-token="${token}"></iframe>`;
    },

    hydrateInlinePreviewFrames(root = document) {
        if (!root?.querySelectorAll) return;

        root.querySelectorAll('iframe[data-inline-preview-token]').forEach((frame) => {
            const token = frame.dataset.inlinePreviewToken;
            if (!token || frame.dataset.inlinePreviewHydrated === 'true') return;

            const srcdoc = this._inlinePreviewDocuments.get(token);
            if (typeof srcdoc !== 'string') return;

            frame.srcdoc = srcdoc;
            frame.dataset.inlinePreviewHydrated = 'true';
            this._inlinePreviewDocuments.delete(token);
        });
    },

    renderContentPreview(sub) {
        // High-performance display image priority
        const displayUrl = sub.image_url || sub.public_url || sub.thumbnail_url || sub.thumbnail_path;
        const inlineHtmlSource = this.resolveInlineHtmlSource(sub);
        const livePreview = this.getLivePreviewDescriptor(sub);

        if (inlineHtmlSource.html) {
            const wrappedCode = this.wrapCodeForPreview(inlineHtmlSource.html);
            return `<div class="code-preview-container" id="previewContainer">
                        <div class="preview-header">
                            <div class="preview-dots"><span></span><span></span><span></span></div>
                            <div class="preview-label">CONTENT PREVIEW</div>
                            <button class="preview-fullscreen-btn btn-snake" id="previewFullscreenBtn" title="Toggle Fullscreen Mode">
                                <span></span><span></span><span></span><span></span>
                                ⛶ Fullscreen
                            </button>
                        </div>
                        <button class="fullscreen-close-btn" id="floatingCloseBtn" title="Exit Fullscreen" aria-label="Exit Fullscreen">&times;</button>
                        ${this.renderInlinePreviewIframe({
                            className: 'code-preview-frame',
                            sandbox: this.getTrustedInlineHtmlSandbox(),
                            title: sub.title || 'Content preview',
                            srcdoc: wrappedCode
                        })}
                    </div>`;
        }
        if (livePreview?.mode === 'url' && livePreview.src) {
            return `<div class="code-preview-container" id="previewContainer">
                        <div class="preview-header">
                            <div class="preview-dots"><span></span><span></span><span></span></div>
                            <div class="preview-label">LIVE WEBSITE PREVIEW</div>
                            <button class="preview-fullscreen-btn btn-snake" id="previewFullscreenBtn" title="Toggle Fullscreen Mode">
                                <span></span><span></span><span></span><span></span>
                                â›¶ Fullscreen
                            </button>
                        </div>
                        <button class="fullscreen-close-btn" id="floatingCloseBtn" title="Exit Fullscreen" aria-label="Exit Fullscreen">&times;</button>
                        <iframe
                            class="code-preview-frame"
                            src="${livePreview.src}"
                            sandbox="allow-scripts allow-same-origin"
                            loading="lazy"
                            referrerpolicy="no-referrer"
                            title="${livePreview.title || sub.title || 'Live website preview'}"
                        ></iframe>
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
        if (this.isPdfSubmission(sub)) return this.renderPdfPreview(sub);
        if (this.isPowerPointSubmission(sub)) return this.renderPresentationPreview(sub);
        return `<div class="file-placeholder">📄 This content is a ${this.getProjectFileLabel(sub)} and can be downloaded below.</div>`;
    },

    renderStars(rating) {
        return [1, 2, 3, 4, 5].map(i => `
            <span class="star ${i <= Math.round(rating) ? 'active' : ''}" data-value="${i}">★</span>
        `).join('');
    },

    getAverageRatingValue(statsOrRating = 0) {
        const rawValue = typeof statsOrRating === 'object' && statsOrRating !== null
            ? statsOrRating.avg_rating
            : statsOrRating;
        const rating = Number(rawValue);
        return Number.isFinite(rating) ? rating : 0;
    },

    formatAverageRating(statsOrRating = 0) {
        return this.getAverageRatingValue(statsOrRating).toFixed(1);
    },

    renderStars(rating) {
        const averageRating = this.getAverageRatingValue(rating);
        return [1, 2, 3, 4, 5].map(i => `
            <span class="star ${i <= Math.round(averageRating) ? 'active' : ''}" data-value="${i}">&#9733;</span>
        `).join('');
    },

    resolveMediaUrl(pathOrUrl) {
        if (!pathOrUrl) return null;
        if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http')) return pathOrUrl;
        if (
            pathOrUrl.startsWith('/assets/')
            || pathOrUrl.startsWith('assets/')
            || pathOrUrl.startsWith('/public/')
            || pathOrUrl.startsWith('public/')
            || pathOrUrl.startsWith('/icons/')
            || pathOrUrl.startsWith('icons/')
            || pathOrUrl.startsWith('/manifest.json')
            || pathOrUrl.startsWith('manifest.json')
        ) {
            const resolvedAssetUrl = buildAppPath(pathOrUrl);
            console.log('[UI] Resolved asset URL:', { raw: pathOrUrl, resolvedAssetUrl });
            return resolvedAssetUrl;
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
            : this.defaultThumbnailIcons[category] || 'assets/images/default.png';

        const previewUrl = imageSrc || defaultThumbnailUrl;

        const fullUrl = uploadedImageUrl || customThumbnailUrl || defaultThumbnailUrl;

        return {
            previewUrl: this.appendCacheBust(previewUrl, sub),
            fullUrl: this.appendCacheBust(fullUrl || previewUrl, sub)
        };
    },

    async getAudioR2PublicBaseUrl() {
        if (!this._audioR2PublicBaseUrlPromise) {
            this._audioR2PublicBaseUrlPromise = fetch(buildAppPath('api/r2-public-config'))
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

    renderInteractiveWebCard(sub, {
        badgeHtml = '',
        thumbnailHtml = '',
        hasPreviewMedia = false,
        categoryLabel = '',
        color = '#64748b',
        title = 'Untitled'
    } = {}) {
        const stats = this.ensureSubmissionStats(sub);
        const activeRating = Number(sub._interactiveWebUserRating || Math.round(stats.avg_rating) || 0);
        const likeLabel = stats.like_count > 0 ? `${stats.like_count}` : 'Like';
        const authorName = sub.profiles?.display_name || 'Anonymous';
        const displayTitle = this.formatExploreCardTitle(title);
        const previewAction = this.registerLivePreview(sub, {
            label: 'Open Preview',
            className: 'interactive-web-preview-button'
        });
        const ratingControls = Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            return `
                <button class="interactive-web-rate-star ${value <= activeRating ? 'is-active' : ''}"
                        type="button"
                        data-web-card-action="rate"
                        data-rating="${value}"
                        data-submission-id="${sub.id}"
                        aria-label="Rate ${value} star${value === 1 ? '' : 's'}">★</button>
            `;
        }).join('');

        return `
            <article class="content-card clay-card interactive-web-card animate-fade-in ${hasPreviewMedia ? 'content-card-has-preview-media' : ''}" data-id="${sub.id}" data-interactive-web-card="true">
                ${badgeHtml}
                ${thumbnailHtml}
                <div class="card-body interactive-web-card-body">
                    <span class="badge badge-category" style="--cat-color:${color}">${categoryLabel}</span>
                    <div class="interactive-web-card-copy">
                        <h3 class="card-title interactive-web-card-title explore-standard-card-title">${displayTitle}</h3>
                        <p class="card-author interactive-web-card-author">By ${authorName}</p>
                    </div>
                    <div class="interactive-web-card-stats card-stats">
                        <span class="interactive-web-stat">
                            <span style="color:#fbbf24">★</span>
                            <span class="interactive-web-rating-value">${this.formatAverageRating(stats)}</span>
                        </span>
                        <span class="interactive-web-stat">
                            <span style="color:#ef4444">❤</span>
                            <span class="interactive-web-like-count">${stats.like_count}</span>
                        </span>
                        <span class="interactive-web-stat">
                            <span>👁</span>
                            <span class="interactive-web-view-count">${stats.view_count || 0}</span>
                        </span>
                    </div>
                    <div class="interactive-web-card-rating-row">
                        <span class="interactive-web-rating-label">Rate</span>
                        <div class="interactive-web-rating-stars" aria-label="Rate this web project">
                            ${ratingControls}
                        </div>
                    </div>
                    <div class="interactive-web-card-actions">
                        <button type="button"
                                class="interactive-web-pill interactive-web-like ${sub._interactiveWebLiked ? 'is-active' : ''}"
                                data-web-card-action="like"
                                data-submission-id="${sub.id}"
                                aria-label="Like web project"
                                aria-pressed="${sub._interactiveWebLiked ? 'true' : 'false'}">
                            <span class="interactive-web-pill-icon">❤</span>
                            <span class="interactive-web-pill-label">${likeLabel}</span>
                        </button>
                        <button type="button"
                                class="interactive-web-pill interactive-web-bookmark ${sub._interactiveWebBookmarked ? 'is-active' : ''}"
                                data-web-card-action="bookmark"
                                data-submission-id="${sub.id}"
                                aria-label="Save web project"
                                aria-pressed="${sub._interactiveWebBookmarked ? 'true' : 'false'}">
                            <span class="interactive-web-pill-icon">🔖</span>
                            <span class="interactive-web-pill-label">${sub._interactiveWebBookmarked ? 'Saved' : 'Save'}</span>
                        </button>
                    </div>
                    <div class="interactive-web-card-footer">
                        <div class="interactive-web-preview-slot">
                            ${previewAction}
                        </div>
                        <a href="#detail/${sub.id}" class="interactive-web-detail-link" data-link="detail/${sub.id}" aria-label="Open details">
                            Details
                        </a>
                    </div>
                </div>
            </article>
        `;
    },

    renderExploreImmersiveCard(sub, {
        badgeObj = null,
        thumbnailHtml = '',
        hasPreviewMedia = false,
        categoryLabel = '',
        color = '#64748b',
        title = 'Untitled'
    } = {}) {
        const stats = this.ensureSubmissionStats(sub);
        const activeRating = Number(sub._interactiveWebUserRating || Math.round(stats.avg_rating) || 0);
        const authorName = sub.profiles?.display_name || 'Anonymous';
        const shareUrl = this.createWhatsAppShareUrl(title, sub.id);
        const displayTitle = this.formatExploreCardTitle(title);
        const ratingControls = Array.from({ length: 5 }, (_, index) => {
            const value = index + 1;
            return `
                <button class="interactive-web-rate-star ${value <= activeRating ? 'is-active' : ''}"
                        type="button"
                        data-web-card-action="rate"
                        data-rating="${value}"
                        data-submission-id="${sub.id}"
                        aria-label="Rate ${value} star${value === 1 ? '' : 's'}">&#9733;</button>
            `;
        }).join('');

        return `
            <article class="content-card clay-card immersive-explore-card animate-fade-in ${hasPreviewMedia ? 'content-card-has-preview-media' : ''}" data-id="${sub.id}" data-explore-immersive-card="true">
                <div class="immersive-card-media"
                     data-immersive-view-open="true"
                     data-submission-id="${sub.id}"
                     role="button"
                     tabindex="0"
                     aria-label="Open ${title}">
                    ${thumbnailHtml}
                    ${badgeObj ? `<span class="immersive-card-status-badge ${badgeObj.className || ''}">${badgeObj.text}</span>` : ''}
                </div>
                <div class="immersive-card-body">
                    <span class="badge badge-category immersive-card-category" style="--cat-color:${color}">${categoryLabel}</span>
                    <h3 class="card-title immersive-card-title explore-standard-card-title">${displayTitle}</h3>
                    <p class="card-author immersive-card-author">By ${authorName}</p>
                    <div class="immersive-card-stats">
                        <span class="immersive-card-stat">
                            <span class="immersive-card-stat-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" focusable="false"><path d="m12 2.5 2.9 5.87 6.48.94-4.69 4.57 1.11 6.47L12 17.32 6.2 20.35l1.11-6.47L2.62 9.31l6.48-.94Z"></path></svg>
                            </span>
                            <span class="interactive-web-rating-value">${this.formatAverageRating(stats)}</span>
                        </span>
                        <button type="button"
                                class="immersive-card-stat immersive-card-stat-button immersive-card-like-btn interactive-web-like ${sub._interactiveWebLiked ? 'is-active' : ''}"
                                data-web-card-action="like"
                                data-submission-id="${sub.id}"
                                aria-label="Like content"
                                aria-pressed="${sub._interactiveWebLiked ? 'true' : 'false'}">
                            <span class="immersive-card-stat-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" focusable="false"><path d="m12 21-1.45-1.32C5.4 15.02 2 11.93 2 8.13 2 5.04 4.42 2.5 7.5 2.5c1.74 0 3.41.81 4.5 2.09A5.94 5.94 0 0 1 16.5 2.5C19.58 2.5 22 5.04 22 8.13c0 3.8-3.4 6.89-8.55 11.55Z"></path></svg>
                            </span>
                            <span class="interactive-web-like-count">${stats.like_count}</span>
                        </button>
                        <span class="immersive-card-stat">
                            <span class="immersive-card-stat-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" focusable="false"><path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12Z"></path><circle cx="12" cy="12" r="3.2"></circle></svg>
                            </span>
                            <span class="interactive-web-view-count">${stats.view_count || 0}</span>
                        </span>
                        <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" class="immersive-card-stat immersive-card-stat-whatsapp" title="Share on WhatsApp" aria-label="Share on WhatsApp">
                            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.08.54 4.11 1.56 5.9L0 24l6.37-1.67a11.86 11.86 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.9-11.9a11.82 11.82 0 0 0-3.45-8.4Zm-8.46 18.3h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.22-3.78.99 1.01-3.69-.24-.38a9.82 9.82 0 0 1-1.52-5.24c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.11 1.03 6.98 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.46-4.44 9.9-9.89 9.9Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.29-.76.96-.94 1.16-.17.2-.35.22-.64.07-.3-.14-1.26-.46-2.39-1.47-.89-.79-1.49-1.76-1.66-2.06-.18-.29-.02-.45.13-.6.13-.14.3-.35.45-.53.15-.17.2-.29.3-.49.1-.2.05-.37-.03-.53-.07-.14-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.58c-.19 0-.5.07-.76.37-.27.29-1.03 1-1.03 2.44 0 1.44 1.05 2.83 1.2 3.03.15.2 2.07 3.16 5.02 4.43.7.31 1.25.49 1.68.63.72.23 1.38.2 1.89.12.58-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.56-.34Z"></path></svg>
                        </a>
                        <button type="button"
                                class="immersive-card-stat immersive-card-stat-button immersive-card-bookmark-btn interactive-web-bookmark ${sub._interactiveWebBookmarked ? 'is-active' : ''}"
                                data-web-card-action="bookmark"
                                data-submission-id="${sub.id}"
                                aria-label="Save content"
                                aria-pressed="${sub._interactiveWebBookmarked ? 'true' : 'false'}">
                            <span class="immersive-card-stat-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" focusable="false"><path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.6L6 21V4.75Z"></path></svg>
                            </span>
                        </button>
                    </div>
                    <div class="immersive-card-rating-stars-row">
                        <div class="interactive-web-rating-stars immersive-card-rating-stars" aria-label="Rate this content">
                            ${ratingControls}
                        </div>
                    </div>
                </div>
            </article>
        `;
    },

    renderCard(sub, badgeObj = null) {
        this.registerSubmissionCardState(sub);
        const stats = this.ensureSubmissionStats(sub);
        const avgRating = this.getAverageRatingValue(stats);
        const normalizedCategory = this.normalizeCategoryValue(sub.category, sub.content_type);
        const color = this.getCategoryColor(sub.category, sub.content_type);
        const categoryLabel = this.getContentTypeLabel(sub.category, sub.content_type);
        const title = sub.title || 'Untitled';

        const { previewUrl, fullUrl } = this.getSubmissionImageUrls(sub);
        const thumbnailUrl = previewUrl;
        const fallbackThumbnailUrl = this.getThumbnailFallbackUrl(sub);

        const thumbnailHtml = thumbnailUrl
            ? `<div class="card-thumbnail-container card-thumbnail-container-preview">
                 <img src="${thumbnailUrl}" 
                      class="card-thumbnail-img card-thumbnail-img-preview" 
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

        if (this.isExploreImmersiveCard(sub)) {
            return this.renderExploreImmersiveCard(sub, {
                badgeObj,
                thumbnailHtml,
                hasPreviewMedia: !!thumbnailUrl,
                categoryLabel,
                color,
                title
            });
        }

        if (this.isAudioSubmission(sub)) {
            const authorName = sub.profiles?.display_name || 'Anonymous';
            const initials = authorName.charAt(0).toUpperCase();
            const shareUrl = this.createWhatsAppShareUrl(title, sub.id);
            const audioArtworkUrl = previewUrl || fullUrl || fallbackThumbnailUrl;
            const activeRating = Math.round(avgRating);
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
                                        <span class="audio-feed-rating-value">${this.formatAverageRating(stats)}</span>
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
                                        <span class="audio-feed-view-count">${stats.view_count || 0}</span>
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

        // Legacy image card renderer is bypassed in favor of the Explore masonry card.
        if (this.isImageSubmission(sub)) {
            return this.renderMasonryCard(sub);
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
                                <span><span style="color:#fbbf24">★</span> ${this.formatAverageRating(stats)}</span>
                                <span><span style="color:#ef4444">❤️</span> ${stats.like_count}</span>
                             </div>
                        </div>

                        <div class="feed-actions">
                            <a href="${this.createWhatsAppShareUrl(sub.title, sub.id)}" target="_blank" rel="noopener noreferrer" class="btn clay-btn btn-sm btn-snake btn-round btn-icon" style="background:#25D366; border-color:#25D366; color:white;" title="Share on WhatsApp">
                                <span></span><span></span><span></span><span></span>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                            </a>
                            <a href="#detail/${sub.id}" class="btn btn-primary btn-sm btn-snake btn-round btn-wide btn-preview" data-link="detail/${sub.id}">
                                <span></span><span></span><span></span><span></span> Open
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }

        // Standard Document Card
        const shareUrl = this.createWhatsAppShareUrl(sub.title, sub.id);
        return `
            <div class="content-card clay-card animate-fade-in ${thumbnailUrl ? 'content-card-has-preview-media' : ''}" data-id="${sub.id}">
                ${badgeHtml}
                ${thumbnailHtml}
                <div class="card-body">
                    <span class="badge badge-category" style="--cat-color:${color}">${categoryLabel}</span>
                    <h3 class="card-title">${title}</h3>
                    <p class="card-author">By ${sub.profiles?.display_name || 'Anonymous'}</p>
                    <div class="card-stats-row">
                        <span class="card-stat-item"><span class="card-stat-icon" style="color:#fbbf24">★</span> ${this.formatAverageRating(stats)}</span>
                        <span class="card-stat-item"><span class="card-stat-icon" style="color:#ef4444">♥</span> ${stats.like_count}</span>
                        <span class="card-stat-item"><span class="card-stat-icon">👁</span> ${stats.view_count || 0}</span>
                        <a href="${shareUrl}" target="_blank" rel="noopener noreferrer" class="card-stat-item card-stat-whatsapp" title="Share on WhatsApp" aria-label="Share on WhatsApp">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                            </svg>
                        </a>
                    </div>
                    <div class="card-action-row">
                        <button type="button"
                                class="card-action-pill card-action-pill-like interactive-web-like ${sub._feedIsLiked ? 'is-active' : ''}"
                                data-web-card-action="like"
                                data-submission-id="${sub.id}"
                                aria-label="Like"
                                aria-pressed="${sub._feedIsLiked ? 'true' : 'false'}">
                            <span class="card-action-pill-icon">♥</span>
                            <span class="card-action-pill-label">Like</span>
                        </button>
                        <button type="button"
                                class="card-action-pill card-action-pill-save interactive-web-bookmark ${sub._feedIsBookmarked ? 'is-active' : ''}"
                                data-web-card-action="bookmark"
                                data-submission-id="${sub.id}"
                                aria-label="Save"
                                aria-pressed="${sub._feedIsBookmarked ? 'true' : 'false'}">
                            <span class="card-action-pill-icon">🔖</span>
                            <span class="card-action-pill-label">Save</span>
                        </button>
                        <a href="#detail/${sub.id}" class="card-action-pill card-action-pill-view" data-link="detail/${sub.id}" aria-label="View Details">
                            <span class="card-action-pill-icon">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </span>
                            <span class="card-action-pill-label">View</span>
                        </a>
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
        const isLiked = !!(sub._feedIsLiked ?? stats.user_has_liked);

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
                    <div class="masonry-image-wrapper"
                         data-image-full-view="true"
                         aria-label="Open image in full view">
                        <img src="${imageUrl}" class="masonry-img" data-image-full-view="true" loading="lazy" decoding="async" alt="${sub.title}" onerror="this.src='${fallbackThumbnailUrl}'">
                        <div class="masonry-overlay"></div>
                    </div>
                    <div class="masonry-actions-row masonry-actions-row-compact" aria-label="Image actions">
                        <button type="button"
                                class="action-mini action-mini-icon-only btn-like interaction-btn ${isLiked ? 'liked' : ''}"
                                data-id="${sub.id}"
                                title="Like"
                                aria-label="Like image"
                                aria-pressed="${isLiked ? 'true' : 'false'}">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                        </button>
                        <a href="${shareUrl}"
                           target="_blank"
                           rel="noopener noreferrer"
                           class="action-mini action-mini-icon-only btn-share"
                           title="Share on WhatsApp"
                           aria-label="Share on WhatsApp">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.08.54 4.11 1.56 5.9L0 24l6.37-1.67a11.86 11.86 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.9-11.9a11.82 11.82 0 0 0-3.45-8.4Zm-8.46 18.3h-.01a9.87 9.87 0 0 1-5.04-1.38l-.36-.22-3.78.99 1.01-3.69-.24-.38a9.82 9.82 0 0 1-1.52-5.24c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.11 1.03 6.98 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.46-4.44 9.9-9.89 9.9Zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.29-.76.96-.94 1.16-.17.2-.35.22-.64.07-.3-.14-1.26-.46-2.39-1.47-.89-.79-1.49-1.76-1.66-2.06-.18-.29-.02-.45.13-.6.13-.14.3-.35.45-.53.15-.17.2-.29.3-.49.1-.2.05-.37-.03-.53-.07-.14-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.58c-.19 0-.5.07-.76.37-.27.29-1.03 1-1.03 2.44 0 1.44 1.05 2.83 1.2 3.03.15.2 2.07 3.16 5.02 4.43.7.31 1.25.49 1.68.63.72.23 1.38.2 1.89.12.58-.08 1.76-.72 2.01-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.56-.34Z"></path></svg>
                        </a>
                        <a href="${imageUrl}"
                           class="action-mini action-mini-icon-only btn-download"
                           target="_blank"
                           rel="noopener noreferrer"
                           download
                           data-filename="${this.buildDownloadFileName(sub.title, imageUrl)}"
                           title="Download image"
                           aria-label="Download image">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>
                        </a>
                    </div>
                </div>
            </div>
        `;
    },

    setupMasonryCardInteractions(gridEl, { getUserId = null } = {}) {
        if (!gridEl || gridEl.dataset.masonryInteractionsBound === 'true') return;

        const resolveUserId = typeof getUserId === 'function'
            ? getUserId
            : () => null;

        gridEl.addEventListener('click', async (event) => {
            const btn = event.target.closest('.interaction-btn');
            const downloadBtn = event.target.closest('.btn-download');
            const shareBtn = event.target.closest('.btn-share');

            if (downloadBtn) {
                event.preventDefault();
                event.stopPropagation();
                await this.downloadFile(downloadBtn.href, downloadBtn.dataset.filename || 'image');
                return;
            }

            if (shareBtn) {
                event.stopPropagation();
                return;
            }

            if (btn) {
                event.stopPropagation();
                const userId = resolveUserId();
                if (!userId) {
                    this.showToast('Please login to interact', 'error');
                    return;
                }

                const subId = btn.dataset.id;
                if (!subId) return;

                if (btn.classList.contains('btn-like')) {
                    const { action, error } = await API.toggleLike(subId, userId);
                    if (error) {
                        this.showToast(error.message || 'Could not update like.', 'error');
                        return;
                    }

                    const isLiked = action === 'liked';
                    gridEl.querySelectorAll(`.btn-like[data-id="${subId}"]`).forEach((element) => {
                        element.classList.toggle('liked', isLiked);
                        element.setAttribute('aria-pressed', String(isLiked));
                        const countSpan = element.querySelector('.like-count');
                        if (countSpan) {
                            const currentCount = parseInt(countSpan.textContent || '0', 10) || 0;
                            countSpan.textContent = String(Math.max(0, currentCount + (isLiked ? 1 : -1)));
                        }
                    });
                    this.showToast(isLiked ? 'Liked!' : 'Unliked');
                    if (isLiked) {
                        this.triggerBadgeEvaluation({
                            userId,
                            reason: 'like-success'
                        });
                    }
                    return;
                }

                return;
            }

            const imgWrapper = event.target.closest('[data-image-full-view="true"]');
            const card = event.target.closest('.masonry-item');
            if (imgWrapper && card) {
                const fullUrl = card.dataset.fullUrl || card.dataset.previewUrl;
                const title = imgWrapper.querySelector('.masonry-img')?.alt || 'Image';
                if (fullUrl) {
                    this.showImageLightbox(fullUrl, title);
                }
            }
        });

        gridEl.dataset.masonryInteractionsBound = 'true';
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
        return buildAppPath(`api/download-file?${params.toString()}`);
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
                    <div class="lightbox-stage" tabindex="0" aria-label="Scrollable image viewer">
                        <div class="lightbox-img-container">
                            <img src="${imageUrl}" class="lightbox-img" alt="${title}" loading="eager" decoding="sync" fetchpriority="high">
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('body-no-scroll');
        document.documentElement.classList.add('body-no-scroll');
        document.body.style.overflow = 'hidden';

        const image = overlay.querySelector('.lightbox-img');
        const imageContainer = overlay.querySelector('.lightbox-img-container');
        const lightboxStage = overlay.querySelector('.lightbox-stage');
        const zoomOutBtn = overlay.querySelector('[data-action="zoom-out"]');
        const zoomResetBtn = overlay.querySelector('[data-action="zoom-reset"]');
        const zoomInBtn = overlay.querySelector('[data-action="zoom-in"]');
        const downloadBtn = overlay.querySelector('[data-action="download"]');

        if (lightboxStage) {
            lightboxStage.scrollTop = 0;
            lightboxStage.scrollLeft = 0;
        }
        lightboxStage?.focus?.({ preventScroll: true });

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
                document.documentElement.classList.remove('body-no-scroll');
                document.body.style.overflow = '';
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
            if (!event.ctrlKey && !event.metaKey) return;
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
            if (lightboxStage) {
                lightboxStage.scrollTop = 0;
                lightboxStage.scrollLeft = 0;
            }
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

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    },

    renderBadgePanel(panelState = null) {
        const resolvedState = panelState || BadgeEngine.getFallbackPanelState();
        const dedupedCards = [];
        const seenKeys = new Set();

        [...(resolvedState.allBadges || [])].forEach((badge) => {
            if (!badge?.key || seenKeys.has(badge.key)) {
                if ((window?.location?.hostname === 'localhost' || window?.location?.hostname === '127.0.0.1') && badge?.key) {
                    console.warn('[UI] Duplicate badge card filtered before render:', badge.key);
                }
                return;
            }
            seenKeys.add(badge.key);
            dedupedCards.push(badge);
        });

        const unlockedCount = Number(resolvedState.totalUnlocked || 0);
        const totalCount = dedupedCards.length || 16;
        const currentBadge = resolvedState.currentBadge || null;

        return `
            <div class="sd-badges-panel-inner">
                <div class="sd-badges-header">
                    <div>
                        <h3 class="sd-badges-title">My Badges</h3>
                        <p class="sd-badges-subtitle">Tap any unlocked badge to equip it.</p>
                    </div>
                    <span class="sd-badges-count">${unlockedCount}/${totalCount} unlocked</span>
                </div>
                <div class="sd-badges-current-bar ${currentBadge ? 'has-badge' : 'is-empty'}">
                    <span class="sd-badges-current-kicker">Current</span>
                    <span class="sd-badges-current-value">
                        ${currentBadge
            ? `<span class="sd-badges-current-icon" aria-hidden="true">${this.escapeHtml(currentBadge.icon)}</span><span class="sd-badges-current-name">${this.escapeHtml(currentBadge.name)}</span>`
            : '<span class="sd-badges-current-name">No badge equipped</span>'}
                    </span>
                    ${currentBadge ? '<button type="button" class="sd-badge-clear" data-badge-clear="true" aria-label="Clear equipped badge">Clear</button>' : ''}
                </div>
                <div class="sd-badge-grid">
                    ${dedupedCards.map((card) => this.renderBadgeCard(card)).join('')}
                </div>
            </div>
        `;
    },

    renderBadgeCard(badge) {
        const badgeName = this.escapeHtml(badge.name);
        const badgeDescription = this.escapeHtml(badge.description);
        const icon = this.escapeHtml(badge.icon);
        const classes = [
            'sd-badge-card',
            badge.unlocked ? 'is-unlocked' : 'is-locked',
            badge.equipped ? 'is-equipped' : '',
            badge.key === 'edtechra_legend' ? 'is-legendary' : ''
        ].filter(Boolean).join(' ');

        if (badge.unlocked) {
            return `
                <button
                    type="button"
                    class="${classes}"
                    data-badge-equip="${this.escapeHtml(badge.key)}"
                    title="${badgeDescription}"
                    aria-pressed="${badge.equipped ? 'true' : 'false'}"
                >
                    <span class="sd-badge-icon" aria-hidden="true">${icon}</span>
                    <span class="sd-badge-name">${badgeName}</span>
                    <span class="sd-badge-status">${badge.equipped ? 'Equipped' : 'Equip'}</span>
                </button>
            `;
        }

        return `
            <div class="${classes}" title="${badgeDescription}" aria-label="Locked badge: ${badgeName}">
                <span class="sd-badge-icon" aria-hidden="true">${icon}</span>
                <span class="sd-badge-name">${badgeName}</span>
                <span class="sd-badge-status">Locked</span>
            </div>
        `;
    },

    async triggerBadgeEvaluation({ userId, reason = 'dashboard-load', creatorRankings = null, awaitPopups = false } = {}) {
        if (!userId) {
            return {
                panelState: BadgeEngine.getFallbackPanelState(),
                newlyUnlockedBadges: []
            };
        }

        try {
            const result = await BadgeEngine.evaluateAndSyncBadges({ userId, creatorRankings, reason });
            if (result?.newlyUnlockedBadges?.length) {
                const presentation = this.presentUnlockedBadges(result.newlyUnlockedBadges);
                if (awaitPopups) {
                    await presentation;
                }
            }
            return result;
        } catch (error) {
            console.warn('[Badge] Evaluation failed:', error);
            return {
                panelState: BadgeEngine.getFallbackPanelState(),
                newlyUnlockedBadges: []
            };
        }
    },

    _ensureBadgeCelebrationStyles() {
        if (document.getElementById('badge-unlock-celebration-styles')) return;

        const style = document.createElement('style');
        style.id = 'badge-unlock-celebration-styles';
        style.textContent = `
            .badge-unlock-overlay {
                position: fixed;
                inset: 0;
                z-index: 2600;
                display: grid;
                place-items: center;
                padding: 20px;
                pointer-events: none;
            }

            .badge-unlock-card {
                position: relative;
                width: min(100%, 340px);
                padding: 26px 22px 22px;
                border-radius: 28px;
                overflow: hidden;
                text-align: center;
                color: #102418;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 250, 255, 0.96));
                border: 1px solid rgba(120, 119, 255, 0.16);
                box-shadow: 0 34px 90px rgba(15, 23, 42, 0.2);
                animation: badge-unlock-pop 2200ms ease forwards;
            }

            .badge-unlock-glow {
                position: absolute;
                inset: auto 50% -46%;
                width: 220px;
                height: 220px;
                transform: translateX(-50%);
                border-radius: 999px;
                background: radial-gradient(circle, rgba(99, 102, 241, 0.28), rgba(255, 255, 255, 0));
                filter: blur(6px);
            }

            .badge-unlock-icon-wrap {
                position: relative;
                width: 92px;
                height: 92px;
                margin: 0 auto 16px;
                border-radius: 999px;
                display: grid;
                place-items: center;
                background: linear-gradient(135deg, #eef4ff 0%, #fff8e7 100%);
                box-shadow: 0 18px 44px rgba(99, 102, 241, 0.18);
            }

            .badge-unlock-icon-wrap::before {
                content: '';
                position: absolute;
                inset: -8px;
                border-radius: inherit;
                border: 1px solid rgba(99, 102, 241, 0.18);
                animation: badge-unlock-ring 1200ms ease-out forwards;
            }

            .badge-unlock-icon {
                position: relative;
                font-size: 2.6rem;
                line-height: 1;
                filter: drop-shadow(0 10px 20px rgba(15, 23, 42, 0.14));
            }

            .badge-unlock-kicker {
                margin: 0 0 8px;
                font-size: 0.78rem;
                letter-spacing: 0.16em;
                text-transform: uppercase;
                color: #5b6b93;
                font-weight: 800;
            }

            .badge-unlock-name {
                margin: 0;
                font-size: 1.45rem;
                line-height: 1.1;
                font-weight: 800;
                letter-spacing: -0.03em;
            }

            .badge-unlock-copy {
                margin: 10px 0 0;
                color: #526277;
                font-size: 0.94rem;
                line-height: 1.5;
            }

            .badge-unlock-burst {
                position: absolute;
                inset: 0;
                pointer-events: none;
            }

            .badge-unlock-burst-piece {
                position: absolute;
                top: 22%;
                left: 50%;
                width: 10px;
                height: 18px;
                border-radius: 999px;
                opacity: 0;
                animation: badge-unlock-burst 1200ms ease-out forwards;
            }

            @keyframes badge-unlock-pop {
                0% {
                    opacity: 0;
                    transform: translateY(18px) scale(0.88);
                }
                12% {
                    opacity: 1;
                    transform: translateY(0) scale(1.02);
                }
                72% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
                100% {
                    opacity: 0;
                    transform: translateY(-10px) scale(0.98);
                }
            }

            @keyframes badge-unlock-ring {
                0% {
                    opacity: 0.95;
                    transform: scale(0.8);
                }
                100% {
                    opacity: 0;
                    transform: scale(1.24);
                }
            }

            @keyframes badge-unlock-burst {
                0% {
                    opacity: 0;
                    transform: translate3d(-50%, -50%, 0) rotate(var(--burst-rotate)) scale(0.7);
                }
                18% {
                    opacity: 1;
                }
                100% {
                    opacity: 0;
                    transform: translate3d(calc(-50% + var(--burst-x)), calc(-50% + var(--burst-y)), 0) rotate(var(--burst-rotate)) scale(1);
                }
            }

            @media (max-width: 640px) {
                .badge-unlock-card {
                    width: min(100%, 300px);
                    padding: 24px 18px 20px;
                    border-radius: 24px;
                }

                .badge-unlock-icon-wrap {
                    width: 82px;
                    height: 82px;
                }

                .badge-unlock-icon {
                    font-size: 2.25rem;
                }
            }
        `;

        document.head.appendChild(style);
    },

    showBadgeUnlockCelebration(badge, duration = 2200) {
        if (!badge || !document.body) {
            return Promise.resolve();
        }

        this._ensureBadgeCelebrationStyles();

        const burstPalette = ['#7c5cff', '#f59e0b', '#22c55e', '#38bdf8', '#fb7185', '#f97316'];
        const burstMarkup = Array.from({ length: 12 }, (_, index) => {
            const angle = (Math.PI * 2 * index) / 12;
            const distance = 64 + ((index % 3) * 12);
            const translateX = `${Math.round(Math.cos(angle) * distance)}px`;
            const translateY = `${Math.round(Math.sin(angle) * distance)}px`;
            const rotation = `${Math.round((angle * 180) / Math.PI)}deg`;
            const color = burstPalette[index % burstPalette.length];
            const delay = `${(index % 4) * 40}ms`;
            return `
                <span
                    class="badge-unlock-burst-piece"
                    style="background:${color}; animation-delay:${delay}; --burst-x:${translateX}; --burst-y:${translateY}; --burst-rotate:${rotation};"
                ></span>
            `;
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'badge-unlock-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
            <div class="badge-unlock-card">
                <div class="badge-unlock-glow" aria-hidden="true"></div>
                <div class="badge-unlock-burst" aria-hidden="true">${burstMarkup}</div>
                <div class="badge-unlock-icon-wrap">
                    <span class="badge-unlock-icon" aria-hidden="true">${this.escapeHtml(badge.icon)}</span>
                </div>
                <p class="badge-unlock-kicker">Badge Unlocked!</p>
                <h2 class="badge-unlock-name">${this.escapeHtml(badge.name)}</h2>
                <p class="badge-unlock-copy">${this.escapeHtml(badge.description)}</p>
            </div>
        `;

        document.body.appendChild(overlay);

        return new Promise((resolve) => {
            window.setTimeout(() => {
                overlay.remove();
                resolve();
            }, duration);
        });
    },

    presentUnlockedBadges(badges = [], duration = 2200) {
        if (!Array.isArray(badges) || badges.length === 0) {
            return Promise.resolve();
        }

        const queueJob = async () => {
            for (const badge of badges) {
                // eslint-disable-next-line no-await-in-loop
                await this.showBadgeUnlockCelebration(badge, duration);
            }
        };

        this._badgeCelebrationQueue = this._badgeCelebrationQueue
            .catch(() => undefined)
            .then(queueJob);

        return this._badgeCelebrationQueue;
    },

    _ensureSubmissionCelebrationStyles() {
        if (document.getElementById('submission-success-celebration-styles')) return;

        const style = document.createElement('style');
        style.id = 'submission-success-celebration-styles';
        style.textContent = `
            .submission-success-overlay {
                position: fixed;
                inset: 0;
                z-index: 2500;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background:
                    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.94), transparent 26%),
                    radial-gradient(circle at 82% 12%, rgba(167, 243, 208, 0.52), transparent 24%),
                    radial-gradient(circle at 50% 82%, rgba(191, 219, 254, 0.34), transparent 34%),
                    linear-gradient(180deg, rgba(246, 255, 250, 0.96), rgba(237, 252, 244, 0.94));
                backdrop-filter: blur(16px) saturate(1.08);
                -webkit-backdrop-filter: blur(16px) saturate(1.08);
                overflow: hidden;
            }

            .submission-success-overlay::before,
            .submission-success-overlay::after {
                content: '';
                position: absolute;
                inset: auto;
                border-radius: 999px;
                pointer-events: none;
                filter: blur(14px);
                opacity: 0.8;
            }

            .submission-success-overlay::before {
                width: min(34vw, 260px);
                height: min(34vw, 260px);
                top: 10%;
                left: 12%;
                background: radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0));
            }

            .submission-success-overlay::after {
                width: min(38vw, 300px);
                height: min(38vw, 300px);
                right: 10%;
                bottom: 8%;
                background: radial-gradient(circle, rgba(187, 247, 208, 0.55), rgba(187, 247, 208, 0));
            }

            .submission-success-card {
                position: relative;
                width: min(100%, 540px);
                padding: 42px 34px 36px;
                border-radius: 32px;
                background:
                    radial-gradient(circle at top center, rgba(255, 255, 255, 0.88), transparent 34%),
                    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(242, 253, 246, 0.96));
                box-shadow:
                    0 34px 90px rgba(22, 101, 52, 0.12),
                    0 18px 40px rgba(255, 255, 255, 0.5) inset,
                    0 -14px 28px rgba(187, 247, 208, 0.14) inset;
                border: 1px solid rgba(167, 243, 208, 0.54);
                text-align: center;
                color: #102418;
                overflow: hidden;
                animation: submission-success-card-in 520ms cubic-bezier(0.22, 1, 0.36, 1);
            }

            .submission-success-card::before {
                content: '';
                position: absolute;
                inset: 0;
                background:
                    radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.72), transparent 34%),
                    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0));
                pointer-events: none;
            }

            .submission-success-card::after {
                content: '';
                position: absolute;
                inset: auto 14% -18% 14%;
                height: 36%;
                border-radius: 999px;
                background: radial-gradient(circle, rgba(187, 247, 208, 0.26), rgba(187, 247, 208, 0));
                filter: blur(18px);
                pointer-events: none;
            }

            .submission-success-icon {
                width: 74px;
                height: 74px;
                margin: 0 auto 20px;
                border-radius: 999px;
                display: grid;
                place-items: center;
                color: #ffffff;
                background:
                    radial-gradient(circle at 30% 24%, rgba(255, 255, 255, 0.3), transparent 36%),
                    linear-gradient(135deg, #34d399 0%, #22c55e 42%, #16a34a 100%);
                box-shadow:
                    0 20px 42px rgba(34, 197, 94, 0.26),
                    0 10px 18px rgba(255, 255, 255, 0.24) inset,
                    0 -10px 16px rgba(20, 83, 45, 0.18) inset;
                position: relative;
                animation: submission-success-icon-pop 700ms cubic-bezier(0.2, 0.9, 0.22, 1.3);
            }

            .submission-success-icon::before {
                content: '';
                position: absolute;
                inset: -10px;
                border-radius: inherit;
                border: 1px solid rgba(134, 239, 172, 0.34);
                box-shadow: 0 0 0 10px rgba(187, 247, 208, 0.12);
                opacity: 0.92;
            }

            .submission-success-icon::after {
                content: '';
                position: absolute;
                inset: 8px;
                border-radius: inherit;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0));
                pointer-events: none;
            }

            .submission-success-title {
                margin: 0 0 12px;
                font-size: clamp(1.6rem, 1.2rem + 1vw, 2.1rem);
                line-height: 1.12;
                font-weight: 800;
                letter-spacing: -0.03em;
            }

            .submission-success-message {
                margin: 0 0 10px;
                font-size: clamp(1rem, 0.96rem + 0.28vw, 1.12rem);
                line-height: 1.6;
                color: #1f4330;
            }

            .submission-success-confetti-layer {
                position: absolute;
                inset: 0;
                pointer-events: none;
                z-index: 10;
                overflow: hidden;
            }

            .submission-success-confetti-piece {
                position: absolute;
                top: 40%;
                left: 50%;
                opacity: 0;
                animation: sd-success-confetti-explosion var(--confetti-duration, 2800ms) cubic-bezier(0.12, 0.8, 0.2, 1) forwards;
                transform-origin: center;
                will-change: transform, opacity;
                box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
            }

            @keyframes submission-success-card-in {
                0% {
                    opacity: 0;
                    transform: translate3d(0, 24px, 0) scale(0.92);
                }
                60% {
                    opacity: 1;
                    transform: translate3d(0, -6px, 0) scale(1.02);
                }
                100% {
                    opacity: 1;
                    transform: translate3d(0, 0, 0) scale(1);
                }
            }

            @keyframes submission-success-icon-pop {
                0% {
                    opacity: 0;
                    transform: scale(0.72);
                }
                58% {
                    opacity: 1;
                    transform: scale(1.08);
                }
                100% {
                    opacity: 1;
                    transform: scale(1);
                }
            }

            @keyframes sd-success-confetti-explosion {
                0% {
                    opacity: 0;
                    transform: translate3d(0, 0, 0) rotate(var(--confetti-start-rotate, 0deg)) scale(0.2);
                }
                14% {
                    opacity: 1;
                    transform: translate3d(var(--confetti-burst-x, 0px), var(--confetti-burst-y, -100px), 0) rotate(var(--confetti-mid-rotate, 40deg)) scale(1);
                    animation-timing-function: cubic-bezier(0.35, 0, 0.85, 1);
                }
                100% {
                    opacity: 0;
                    transform: translate3d(var(--confetti-land-x, 0px), var(--confetti-land-y, 300px), 0) rotate(var(--confetti-rotate, 240deg)) scale(0.85);
                }
            }

            @media (prefers-reduced-motion: reduce) {
                .submission-success-card,
                .submission-success-icon,
                .submission-success-confetti-piece {
                    animation: none !important;
                }
            }

            @media (max-width: 640px) {
                .submission-success-overlay {
                    padding: 18px;
                }

                .submission-success-card {
                    padding: 34px 22px 30px;
                    border-radius: 26px;
                }

                .submission-success-card::after {
                    bottom: -12%;
                    height: 28%;
                    filter: blur(14px);
                }
            }
        `;
        document.head.appendChild(style);
    },

    clearSubmissionSuccessCelebration() {
        if (this._submissionCelebrationTimeout) {
            clearTimeout(this._submissionCelebrationTimeout);
            this._submissionCelebrationTimeout = null;
        }

        if (typeof this._submissionCelebrationCleanup === 'function') {
            this._submissionCelebrationCleanup();
            this._submissionCelebrationCleanup = null;
        }

        if (this._submissionCelebrationPageHideHandler) {
            window.removeEventListener('pagehide', this._submissionCelebrationPageHideHandler);
            this._submissionCelebrationPageHideHandler = null;
        }
    },

    showSubmissionSuccessCelebration(duration = 3000) {
        this.clearSubmissionSuccessCelebration();
        this._ensureSubmissionCelebrationStyles();

        if (!document.body) {
            return new Promise((resolve) => {
                this._submissionCelebrationTimeout = window.setTimeout(() => {
                    this._submissionCelebrationTimeout = null;
                    resolve();
                }, duration);
            });
        }

        const confettiPalette = ['#a78bfa', '#f472b6', '#38bdf8', '#fbbf24', '#34d399', '#818cf8', '#f87171', '#fb923c'];
        const confettiShapes = ['capsule', 'square', 'diamond'];
        const confettiMarkup = Array.from({ length: 48 }, (_, index) => {
            const isLeft = index % 2 === 0;
            const spread = 20 + Math.random() * 200;
            const height = 40 + Math.random() * 160;
            
            const burstX = (isLeft ? -1 : 1) * spread;
            const burstY = -height;
            
            const landX = burstX + (isLeft ? -1 : 1) * (20 + Math.random() * 80);
            const landY = 240 + Math.random() * 260;
            
            const rotate = (isLeft ? 360 : -360) + ((Math.random() - 0.5) * 400);
            const midRotate = Math.round(rotate * 0.4);
            
            const pw = 6 + Math.random() * 7;
            const ph = 10 + Math.random() * 8;
            const color = confettiPalette[index % confettiPalette.length];
            const shape = confettiShapes[index % confettiShapes.length];
            const radius = shape === 'capsule' ? '999px' : shape === 'square' ? '4px' : '2px';
            const startRotate = shape === 'diamond' ? '45deg' : '0deg';
            const durationMs = 2300 + (Math.random() * 600);
            const delay = Math.random() * 140;
            
            return `
                <span
                    class="submission-success-confetti-piece is-${shape}"
                    style="width:${pw}px; height:${ph}px; border-radius:${radius}; background:${color}; animation-delay:${delay}ms; --confetti-duration:${durationMs}ms; --confetti-burst-x:${burstX}px; --confetti-burst-y:${burstY}px; --confetti-land-x:${landX}px; --confetti-land-y:${landY}px; --confetti-mid-rotate:${midRotate}deg; --confetti-rotate:${rotate}deg; --confetti-start-rotate:${startRotate};"
                ></span>
            `;
        }).join('');

        const overlay = document.createElement('div');
        overlay.className = 'submission-success-overlay';
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.innerHTML = `
            <div class="submission-success-confetti-layer" aria-hidden="true">${confettiMarkup}</div>
            <div class="submission-success-card">
                <div class="submission-success-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 6 9 17l-5-5"></path>
                    </svg>
                </div>
                <h2 class="submission-success-title">Work Uploaded Successfully!</h2>
                <p class="submission-success-message">Great job! Your creation has been added to the admin panel for review.</p>
                <p class="submission-success-subtext">You will see it published once it is approved.</p>
            </div>
        `;

        this._submissionCelebrationPreviousBodyOverflow = document.body.style.overflow;
        this._submissionCelebrationPreviousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.appendChild(overlay);

        const cleanup = () => {
            overlay.remove();
            document.body.style.overflow = this._submissionCelebrationPreviousBodyOverflow;
            document.documentElement.style.overflow = this._submissionCelebrationPreviousHtmlOverflow;
            this._submissionCelebrationPreviousBodyOverflow = '';
            this._submissionCelebrationPreviousHtmlOverflow = '';
        };

        this._submissionCelebrationCleanup = cleanup;
        this._submissionCelebrationPageHideHandler = () => this.clearSubmissionSuccessCelebration();
        window.addEventListener('pagehide', this._submissionCelebrationPageHideHandler, { once: true });

        return new Promise((resolve) => {
            this._submissionCelebrationTimeout = window.setTimeout(() => {
                this._submissionCelebrationTimeout = null;
                this.clearSubmissionSuccessCelebration();
                resolve();
            }, duration);
        });
    },

    updateInteractiveWebCardLikeState(submissionId, isLiked, likeCount) {
        document.querySelectorAll(`.immersive-explore-card[data-id="${submissionId}"], .interactive-web-card[data-id="${submissionId}"]`).forEach((card) => {
            const button = card.querySelector('[data-web-card-action="like"]');
            const countEl = card.querySelector('.interactive-web-like-count');
            const labelEl = card.querySelector('.interactive-web-like .interactive-web-pill-label');
            button?.classList.toggle('is-active', !!isLiked);
            button?.setAttribute('aria-pressed', String(!!isLiked));
            if (countEl) countEl.textContent = String(Math.max(0, Number(likeCount) || 0));
            if (labelEl) labelEl.textContent = isLiked ? 'Liked' : 'Like';
        });
    },

    updateInteractiveWebCardBookmarkState(submissionId, isSaved) {
        document.querySelectorAll(`.immersive-explore-card[data-id="${submissionId}"], .interactive-web-card[data-id="${submissionId}"]`).forEach((card) => {
            const button = card.querySelector('[data-web-card-action="bookmark"]');
            const labelEl = card.querySelector('.interactive-web-bookmark .interactive-web-pill-label');
            button?.classList.toggle('is-active', !!isSaved);
            button?.setAttribute('aria-pressed', String(!!isSaved));
            if (labelEl) labelEl.textContent = isSaved ? 'Saved' : 'Save';
        });
    },

    updateInteractiveWebCardRatingState(submissionId, avgRating, activeRating = null) {
        const resolvedAverage = this.getAverageRatingValue(avgRating);
        const selectedRating = Number(activeRating || Math.round(resolvedAverage) || 0);

        document.querySelectorAll(`.immersive-explore-card[data-id="${submissionId}"], .interactive-web-card[data-id="${submissionId}"]`).forEach((card) => {
            const valueEl = card.querySelector('.interactive-web-rating-value');
            const stars = card.querySelectorAll('[data-web-card-action="rate"]');
            if (valueEl) valueEl.textContent = this.formatAverageRating(resolvedAverage);

            stars.forEach((star) => {
                const value = Number(star.dataset.rating || 0);
                star.classList.toggle('is-active', value <= selectedRating);
            });
        });
    },

    updateInteractiveWebCardViewState(submissionId, viewCount) {
        const nextCount = String(Math.max(0, Number(viewCount) || 0));
        document.querySelectorAll(`.immersive-explore-card[data-id="${submissionId}"], .interactive-web-card[data-id="${submissionId}"]`).forEach((card) => {
            const viewCountEl = card.querySelector('.interactive-web-view-count');
            if (viewCountEl) viewCountEl.textContent = nextCount;
        });
    },

    setupLivePreviewInteractions() {
        if (!document.body || document.body.dataset.livePreviewBound === 'true') return;

        document.body.dataset.livePreviewBound = 'true';

        document.addEventListener('click', (event) => {
            const immersiveOpenButton = event.target.closest('[data-immersive-view-open="true"]');
            if (immersiveOpenButton) {
                event.preventDefault();
                event.stopPropagation();
                this.openImmersiveExploreViewer(immersiveOpenButton.dataset.submissionId);
                return;
            }

            const openButton = event.target.closest('[data-live-preview-open="true"]');
            if (openButton) {
                event.preventDefault();
                event.stopPropagation();
                this.openLivePreview(openButton.dataset.submissionId);
                return;
            }

            const immersiveCloseButton = event.target.closest('[data-immersive-view-close="true"]');
            const immersiveBackdrop = event.target.classList?.contains('immersive-viewer-overlay');
            if (immersiveCloseButton || immersiveBackdrop) {
                event.preventDefault();
                event.stopPropagation();
                this.closeImmersiveExploreViewer();
                return;
            }

            const closeButton = event.target.closest('[data-live-preview-close="true"]');
            const isBackdrop = event.target.classList?.contains('live-preview-overlay');
            if (!closeButton && !isBackdrop) return;

            event.preventDefault();
            event.stopPropagation();
            this.closeLivePreview();
        });

        document.addEventListener('click', (event) => {
            const card = event.target.closest('.interactive-web-card, .immersive-explore-card');
            if (!card) return;

            const explicitDetailLink = event.target.closest('.interactive-web-detail-link');
            const interactiveControl = event.target.closest(
                '[data-live-preview-open="true"], [data-immersive-view-open="true"], [data-web-card-action], .interactive-web-detail-link, a[href], button'
            );

            if (explicitDetailLink) {
                return;
            }

            if (!interactiveControl) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);

        document.addEventListener('click', async (event) => {
            const actionButton = event.target.closest('[data-web-card-action]');
            if (!actionButton) return;

            event.preventDefault();
            event.stopPropagation();

            const submissionId = actionButton.dataset.submissionId;
            const submission = this.getRegisteredSubmissionCardState(submissionId);
            if (!submission || !this.isExploreImmersiveCard(submission)) {
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id || null;
            if (!userId) {
                this.showToast('Please login to interact', 'error');
                return;
            }

            const stats = this.ensureSubmissionStats(submission);
            const action = actionButton.dataset.webCardAction;

            if (action === 'like') {
                const { action: likeAction, error } = await API.toggleLike(submission.id, userId);
                if (error) {
                    this.showToast(error.message || 'Could not update like.', 'error');
                    return;
                }

                const isLiked = likeAction === 'liked';
                submission._interactiveWebLiked = isLiked;
                stats.like_count = Math.max(0, Number(stats.like_count || 0) + (isLiked ? 1 : -1));
                this.updateInteractiveWebCardLikeState(submission.id, isLiked, stats.like_count);
                this.showToast(isLiked ? 'Liked!' : 'Unliked');
                if (isLiked) {
                    this.triggerBadgeEvaluation({
                        userId,
                        reason: 'like-success'
                    });
                }
                return;
            }

            if (action === 'bookmark') {
                const { action: bookmarkAction, error } = await API.toggleBookmark(submission.id, userId);
                if (error) {
                    this.showToast(error.message || 'Could not update save.', 'error');
                    return;
                }

                const isSaved = bookmarkAction === 'saved';
                submission._interactiveWebBookmarked = isSaved;
                this.updateInteractiveWebCardBookmarkState(submission.id, isSaved);
                this.showToast(isSaved ? 'Saved to collection!' : 'Removed from collection');
                return;
            }

            if (action === 'rate') {
                const rating = Number(actionButton.dataset.rating || 0);
                const { data, error } = await API.rateSubmission(submission.id, userId, rating);
                if (error || !data) {
                    this.showToast(error?.message || 'Could not save rating.', 'error');
                    return;
                }

                stats.avg_rating = data.avgRating;
                submission._interactiveWebUserRating = data.userRating;
                this.updateInteractiveWebCardRatingState(submission.id, data.avgRating, data.userRating);
                this.showToast('Rated!', 'success');
                this.triggerBadgeEvaluation({
                    userId,
                    reason: 'rating-success'
                });
            }
        });

        document.addEventListener('keydown', (event) => {
            const immersiveTrigger = event.target.closest?.('[data-immersive-view-open="true"]');
            if (immersiveTrigger && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                this.openImmersiveExploreViewer(immersiveTrigger.dataset.submissionId);
                return;
            }

            if (event.key === 'Escape' && document.body.classList.contains('immersive-viewer-open')) {
                event.preventDefault();
                this.closeImmersiveExploreViewer();
                return;
            }

            if (event.key === 'Escape' && document.body.classList.contains('live-preview-open')) {
                event.preventDefault();
                this.closeLivePreview();
            }
        });
    },

    renderImmersiveViewerContent(sub = {}) {
        const htmlPreview = this.resolveHtmlPreviewEntry(sub);

        if (htmlPreview.mode === 'srcdoc') {
            return this.renderInlinePreviewIframe({
                className: 'immersive-viewer-frame',
                sandbox: `${this.getTrustedInlineHtmlSandbox()} allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads`,
                title: sub.title || 'Immersive viewer',
                srcdoc: this.wrapCodeForPreview(htmlPreview.inlineHtml || this.resolveInlineHtmlSource(sub).html)
            });
        }

        if (htmlPreview.mode === 'url' && htmlPreview.iframeSrc) {
            return `<iframe class="immersive-viewer-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads" referrerpolicy="no-referrer" src="${htmlPreview.iframeSrc}" title="${sub.title || 'Immersive viewer'}"></iframe>`;
        }

        if (sub.content_text && String(sub.file_type || '').toLowerCase() !== 'text/html') {
            return `<article class="immersive-viewer-text">${String(sub.content_text || '')}</article>`;
        }

        if (this.isPdfSubmission(sub)) {
            const fileUrl = this.getSubmissionFileUrl(sub);
            if (fileUrl) {
                return `<iframe class="immersive-viewer-frame immersive-viewer-pdf-frame" src="${fileUrl}" title="${sub.title || 'Document viewer'}"></iframe>`;
            }
        }

        const fileUrl = this.getSubmissionFileUrl(sub);
        const projectLabel = this.getProjectFileLabel(sub);
        const extension = this.getSubmissionFileExtension(sub) || 'file';
        const downloadName = this.buildDownloadFileName(sub.title || 'download', fileUrl || '', extension);
        const openAction = fileUrl
            ? `<a href="${fileUrl}" target="_blank" rel="noopener noreferrer" class="preview-action-link">Open file</a>`
            : '';
        const downloadAction = fileUrl
            ? `<a href="${this.buildDownloadProxyUrl(fileUrl, downloadName)}" target="_self" class="preview-action-link" download="${downloadName}">Download</a>`
            : '';

        const fallbackMessage = htmlPreview.fallbackReason
            ? `This content could not be rendered because ${htmlPreview.fallbackReason.toLowerCase()}`
            : `This content is a ${projectLabel}.`;

        return `
            <div class="immersive-viewer-fallback">
                <div class="file-placeholder">${fallbackMessage}</div>
                <div class="immersive-viewer-fallback-actions">
                    ${openAction}
                    ${downloadAction}
                </div>
            </div>
        `;
    },

    lockBodyScrollForOverlay() {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        this._immersiveViewerRestoreScrollY = scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.classList.add('body-no-scroll');
    },

    unlockBodyScrollForOverlay() {
        const scrollY = this._immersiveViewerRestoreScrollY || 0;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        if (!document.body.classList.contains('live-preview-open') && !document.querySelector('.fullscreen-active')) {
            document.body.classList.remove('body-no-scroll');
        }
        window.scrollTo({ top: scrollY, behavior: 'auto' });
    },

    ensureImmersiveViewerPopstateHandler() {
        if (this._immersiveViewerPopstateHandler) return;

        this._immersiveViewerPopstateHandler = () => {
            if (!this._immersiveViewerOverlay) return;
            this.closeImmersiveExploreViewer({ fromPopstate: true });
        };

        window.addEventListener('popstate', this._immersiveViewerPopstateHandler);
    },

    async openImmersiveExploreViewer(submissionId) {
        let submission = this.getRegisteredSubmissionCardState(submissionId);
        if (!submission || !this.isExploreImmersiveCard(submission)) {
            this.showToast('This viewer is not available for the selected content.', 'error');
            return;
        }

        try {
            submission = await this.ensureSubmissionCardDetail(submissionId) || submission;
        } catch (error) {
            console.warn('[Explore] Could not hydrate submission detail for immersive viewer:', error);
            this.showToast('Could not open this content right now.', 'error');
            return;
        }

        if (this._immersiveViewerOverlay) {
            this.closeImmersiveExploreViewer({ skipHistoryBack: true, preserveFocus: true });
        }

        this.ensureImmersiveViewerPopstateHandler();

        const overlay = document.createElement('div');
        overlay.className = 'immersive-viewer-overlay';
        overlay.innerHTML = `
            <div class="immersive-viewer-shell" role="dialog" aria-modal="true" aria-label="${submission.title || 'Immersive viewer'}">
                <div class="immersive-viewer-topbar">
                    <button type="button" class="immersive-viewer-close" data-immersive-view-close="true" aria-label="Close immersive viewer">Close</button>
                    <div class="immersive-viewer-meta">
                        <h2 class="immersive-viewer-title">${submission.title || 'Untitled'}</h2>
                        <p class="immersive-viewer-subtitle">${submission.profiles?.display_name || 'Anonymous'} · ${this.getContentTypeLabel(submission.category, submission.content_type)}</p>
                    </div>
                </div>
                <div class="immersive-viewer-content">
                    ${this.renderImmersiveViewerContent(submission)}
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.lockBodyScrollForOverlay();
        document.body.classList.add('immersive-viewer-open');
        this.hydrateInlinePreviewFrames(overlay);

        this._immersiveViewerOverlay = overlay;
        this._immersiveViewerPreviouslyFocused = document.activeElement;

        history.pushState({
            ...(history.state || {}),
            immersiveExploreViewer: true,
            immersiveSubmissionId: String(submissionId)
        }, '', window.location.href);
        this._immersiveViewerHistoryOpen = true;

        overlay.querySelector('[data-immersive-view-close="true"]')?.focus({ preventScroll: true });

        const stats = this.ensureSubmissionStats(submission);
        API.recordSubmissionView(submission.id, null).then(({ error }) => {
            if (error) return;
            stats.view_count = Math.max(0, Number(stats.view_count || 0) + 1);
            this.updateInteractiveWebCardViewState(submission.id, stats.view_count);
        }).catch(() => {});
    },

    closeImmersiveExploreViewer({ fromPopstate = false, skipHistoryBack = false, preserveFocus = false } = {}) {
        if (!this._immersiveViewerOverlay) return;

        this._immersiveViewerOverlay.remove();
        this._immersiveViewerOverlay = null;
        document.body.classList.remove('immersive-viewer-open');
        this.unlockBodyScrollForOverlay();

        const shouldPopHistory = this._immersiveViewerHistoryOpen && !fromPopstate && !skipHistoryBack;
        this._immersiveViewerHistoryOpen = false;

        if (shouldPopHistory) {
            history.back();
        }

        if (!preserveFocus && this._immersiveViewerPreviouslyFocused?.focus) {
            try {
                this._immersiveViewerPreviouslyFocused.focus({ preventScroll: true });
            } catch (_) {
                // Ignore focus restoration failures.
            }
        }

        this._immersiveViewerPreviouslyFocused = null;
    },

    openLivePreview(submissionId) {
        const descriptor = this._livePreviewConfigs.get(String(submissionId || ''));
        if (!descriptor) {
            this.showToast('Live preview is unavailable for this submission.', 'error');
            return;
        }

        this.closeLivePreview({ preserveFocus: true });

        const overlay = document.createElement('div');
        overlay.className = 'live-preview-overlay';

        const shell = document.createElement('div');
        shell.className = 'live-preview-shell';
        shell.setAttribute('role', 'dialog');
        shell.setAttribute('aria-modal', 'true');
        shell.setAttribute('aria-label', `${descriptor.title || 'Live preview'} viewer`);

        const toolbar = document.createElement('div');
        toolbar.className = 'live-preview-toolbar';
        toolbar.innerHTML = `
            <div class="live-preview-title-group">
                <span class="live-preview-kicker">LIVE PREVIEW</span>
                <span class="live-preview-title">${descriptor.title || 'Live preview'}</span>
            </div>
            <div class="live-preview-toolbar-actions">
                ${descriptor.sourceUrl
                    ? `<a href="${descriptor.sourceUrl}" target="_blank" rel="noopener noreferrer" class="preview-action-link live-preview-open-tab">Open in new tab</a>`
                    : ''}
                <button type="button" class="live-preview-close" data-live-preview-close="true" aria-label="Close live preview">Close</button>
            </div>
        `;

        const stage = document.createElement('div');
        stage.className = 'live-preview-stage';

        const loading = document.createElement('div');
        loading.className = 'live-preview-loading';
        loading.textContent = 'Launching live preview...';

        const fallback = document.createElement('div');
        fallback.className = 'live-preview-fallback hidden';
        fallback.innerHTML = `
            <p>${descriptor.fallbackMessage || 'This content could not be loaded inside the viewer.'}</p>
            ${descriptor.sourceUrl
                ? `<a href="${descriptor.sourceUrl}" target="_blank" rel="noopener noreferrer" class="preview-action-link">Open in new tab</a>`
                : ''}
        `;

        const frame = document.createElement('iframe');
        frame.className = 'live-preview-frame hidden';
        frame.setAttribute('title', descriptor.title || 'Live preview');
        frame.setAttribute('allow', 'fullscreen');
        frame.setAttribute('allowfullscreen', '');
        frame.setAttribute('referrerpolicy', 'no-referrer');
        const sandboxValue = descriptor.mode === 'srcdoc'
            ? `${this.getTrustedInlineHtmlSandbox()} allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads`
            : 'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads';
        frame.setAttribute('sandbox', sandboxValue);

        let didFinish = false;
        const finishLoading = () => {
            if (didFinish) return;
            didFinish = true;
            loading.classList.add('hidden');
            fallback.classList.add('hidden');
            frame.classList.remove('hidden');
        };

        const showFallback = () => {
            if (didFinish) return;
            loading.classList.add('hidden');
            frame.classList.add('hidden');
            fallback.classList.remove('hidden');
        };

        frame.addEventListener('load', () => {
            window.clearTimeout(this._livePreviewDismissTimer);
            finishLoading();
        }, { once: true });

        frame.addEventListener('error', () => {
            window.clearTimeout(this._livePreviewDismissTimer);
            showFallback();
        }, { once: true });

        this._livePreviewDismissTimer = window.setTimeout(() => {
            showFallback();
        }, descriptor.mode === 'srcdoc' ? 8000 : 12000);

        if (descriptor.mode === 'srcdoc') {
            frame.srcdoc = descriptor.srcdoc || '';
        } else {
            frame.src = descriptor.src || descriptor.sourceUrl || '';
        }

        stage.appendChild(loading);
        stage.appendChild(fallback);
        stage.appendChild(frame);
        shell.appendChild(toolbar);
        shell.appendChild(stage);
        overlay.appendChild(shell);
        document.body.appendChild(overlay);
        document.body.classList.add('body-no-scroll', 'live-preview-open');

        this._livePreviewOverlay = overlay;
        this._livePreviewPreviouslyFocused = document.activeElement;

        shell.querySelector('[data-live-preview-close="true"]')?.focus({ preventScroll: true });

        const submission = this.getRegisteredSubmissionCardState(submissionId);
        if (submission && this.isInteractiveWebCard(submission)) {
            const stats = this.ensureSubmissionStats(submission);
            API.recordSubmissionView(submission.id, null).then(({ error }) => {
                if (error) return;
                stats.view_count = Math.max(0, Number(stats.view_count || 0) + 1);
                this.updateInteractiveWebCardViewState(submission.id, stats.view_count);
            }).catch(() => {});
        }
    },

    closeLivePreview({ preserveFocus = false } = {}) {
        window.clearTimeout(this._livePreviewDismissTimer);
        this._livePreviewDismissTimer = null;

        if (this._livePreviewOverlay) {
            this._livePreviewOverlay.remove();
            this._livePreviewOverlay = null;
        }

        document.body.classList.remove('live-preview-open');
        if (!document.querySelector('.fullscreen-active')) {
            document.body.classList.remove('body-no-scroll');
        }

        if (!preserveFocus && this._livePreviewPreviouslyFocused?.focus) {
            try {
                this._livePreviewPreviouslyFocused.focus({ preventScroll: true });
            } catch (_) {
                // Ignore focus restore failures.
            }
        }

        this._livePreviewPreviouslyFocused = null;
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
            const avgRating = UI.getAverageRatingValue(stats);
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
                                        ${UI.renderStars(avgRating)}
                                    </div>
                                    <span class="text-xs text-muted" id="avg-rating">(${UI.formatAverageRating(avgRating)})</span>
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
                            <label>File Upload* (PDF, PPTX, DOC, DOCX, HTML, ZIP, MP3, or WAV - Max 50MB)</label>
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
                                <iframe id="code-preview-frame" class="code-preview-frame" sandbox="${UI.getTrustedInlineHtmlSandbox()}"></iframe>
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
                            <input type="file" name="image_file" id="image-file-input" accept="image/jpeg,image/jpg,image/png,image/webp" class="hidden-file-input">
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
                                <h1 class="explore-hero-title" aria-label="Creative Works">
                                    <span class="explore-hero-title-line explore-hero-title-line-warm" data-text="Creative">
                                        <span class="explore-hero-title-face">Creative</span>
                                    </span>
                                    <span class="explore-hero-title-line explore-hero-title-line-cool" data-text="Works">
                                        <span class="explore-hero-title-face">Works</span>
                                    </span>
                                </h1>
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

                            <section class="explore-row-section explore-card-feed-section explore-creations-section" id="trending-creations">
                                <div class="explore-section-heading">
                                    <h2 class="explore-row-title">Trending Creations</h2>
                                    <p class="explore-row-copy">A refreshed view of the most loved student work, with all existing Explore functionality preserved.</p>
                                </div>
                                <div class="explore-row-grid" id="grid-trending"></div>
                            </section>

                            <section class="explore-row-section explore-card-feed-section" id="explore-feed-section">
                                <div class="explore-section-heading">
                                    <h2 class="explore-row-title">Newly Submitted</h2>
                                    <p class="explore-row-copy">Fresh ideas and new uploads from across the learning community.</p>
                                </div>
                                <div class="explore-row-grid" id="grid-new"></div>
                            </section>

                            <section class="explore-row-section explore-card-feed-section">
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
                        <div class="sd-badges-section" id="sd-badges-section"></div>
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

        renderSavedCard: (sub = {}) => {
            const stats = sub.submission_stats?.[0] || { avg_rating: 0, like_count: 0, view_count: 0 };
            const previewUrl = UI.getSubmissionImageUrls?.(sub)?.previewUrl;
            const fallbackThumbUrl = UI.getThumbnailFallbackUrl?.(sub) || '';
            const thumbUrl = previewUrl || fallbackThumbUrl;
            const category = UI.getContentTypeLabel?.(sub.category, sub.content_type) || 'Creation';
            const title = sub.title || 'Untitled creation';
            const authorName = sub.profiles?.display_name || 'Anonymous';
            const detailHash = sub.id ? `#detail/${sub.id}` : '#student-dashboard';
            const formattedRating = typeof UI.formatAverageRating === 'function'
                ? UI.formatAverageRating(stats)
                : '0.0';

            return `
                <div class="sd-saved-card animate-fade-in" onclick="window.location.hash='${detailHash}'">
                    <div class="sd-sc-thumb">
                        <img src="${thumbUrl}" alt="${title}" loading="lazy" onerror="this.src='${fallbackThumbUrl}'">
                        <span class="sd-sc-badge">${category}</span>
                    </div>
                    <div class="sd-sc-info">
                        <h4 class="sd-sc-title" title="${title}">${title}</h4>
                        <p class="sd-sc-author">by ${authorName}</p>
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
                            <span>${formattedRating}</span>
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
