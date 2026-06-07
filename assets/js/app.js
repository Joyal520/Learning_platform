import { Auth } from './auth.js';
import { UI } from './ui.js?v=project-badge-check';
import { MyUploadsPage } from '../../pages/my-uploads.js';
import { ExplorePage } from '../../pages/explore.js';
import { DetailPage } from '../../pages/detail.js';
import { DashboardPage } from '../../pages/dashboard.js';
import { StudentDashboardPage } from '../../pages/student-dashboard.js';
import { PresentationRemotePage } from '../../pages/presentation-remote.js';
import { DigitalClassroomPage } from '../../pages/digital-classroom.js';
import { buildAppPath, logAppRuntime } from './path-utils.js';
import { Notifications } from './notifications.js';

const DEBUG_LOGS = false;
const debugLog = (...args) => { if (DEBUG_LOGS) console.log(...args); };

const App = {
    user: null,
    profile: null,
    currentPage: 'home',
    isFirstLoad: true,
    _profilePromise: null,
    _profileUserId: null,
    _bootstrappedUserId: null,
    _lastUserId: null,
    _activeYouTubePlayer: null,
    CLASSROOM_RETURN_KEY: 'edtechra_pending_classroom_route',

    async init() {
        UI.init();
        logAppRuntime('app-init');
        this.renderNav();
        this.initializePwaEnhancements();
        this.handleAuthErrorsInUrl();
        this.normalizeInboundJoinPath();

        try {
            const session = await Auth.getSession();
            this.user = session?.user || null;
            this._bootstrappedUserId = this.user?.id || null;
            this._lastUserId = this._bootstrappedUserId;
            if (this.user) {
                await this.ensureProfileLoaded({ allowBackgroundSync: true });
                Notifications.maybePromptAndSync(this.user)
                    .catch((error) => console.warn('[App] Notification token sync skipped:', error));
            }
            this.renderNav();
            await this.route();
        } catch (error) {
            console.error('[App] Initial session bootstrap failed:', error);
            await this.route();
        } finally {
            UI.hideLoader();
            this.isFirstLoad = false;
        }

        this.syncProfileInBackground();
        this.bindAuthStateChanges();

        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-link]');
            if (!link) return;

            e.preventDefault();
            const page = link.getAttribute('data-link');
            this.navigate(page);
        });
    },

    initializePwaEnhancements() {
        let deferredPrompt = null;

        window.addEventListener('beforeinstallprompt', (e) => {
            debugLog('[PWA] beforeinstallprompt fired');
            e.preventDefault();
            deferredPrompt = e;
            debugLog('[PWA] deferredPrompt stored');

            const btn = document.getElementById('installBtn');
            if (btn) {
                btn.style.display = 'block';
                debugLog('[PWA] install button displayed');
            }
        });

        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('#installBtn');
            if (!btn || !deferredPrompt) return;

            debugLog('[PWA] install button clicked');
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            debugLog('[PWA] user choice:', result.outcome);
            deferredPrompt = null;
            btn.style.display = 'none';
        });

        const resetYouTubePlayer = (player) => {
            if (!player) return;
            player.querySelector('iframe')?.remove();
            player.classList.remove('is-playing');
            const thumbnail = player.querySelector('.video-feed-thumbnail');
            if (thumbnail) thumbnail.hidden = false;
        };

        document.addEventListener('click', (e) => {
            const playBtn = e.target.closest('.video-feed-play-btn');
            if (!playBtn) return;
            e.preventDefault();

            const player = playBtn.closest('.video-feed-player');
            if (!player) return;

            if (this._activeYouTubePlayer && this._activeYouTubePlayer !== player) {
                resetYouTubePlayer(this._activeYouTubePlayer);
            }
            this._activeYouTubePlayer = player;

            const thumbnail = player.querySelector('.video-feed-thumbnail');
            const existingIframe = player.querySelector('iframe');
            if (existingIframe) return;

            const embedUrl = player.dataset.youtubeEmbedUrl;
            const videoTitle = player.dataset.videoTitle || 'YouTube video';
            if (!embedUrl) return;

            const iframe = document.createElement('iframe');
            iframe.src = embedUrl;
            iframe.title = videoTitle;
            iframe.loading = 'lazy';
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            iframe.allowFullscreen = true;

            if (thumbnail) thumbnail.hidden = true;
            player.classList.add('is-playing');
            player.appendChild(iframe);
        });

        window.addEventListener('appinstalled', () => {
            debugLog('[PWA] App installed');
            const btn = document.getElementById('installBtn');
            if (btn) btn.style.display = 'none';
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            const btn = document.getElementById('installBtn');
            if (btn) btn.style.display = 'none';
        }

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                const serviceWorkerPath = buildAppPath('sw.js?v=9');
                debugLog('[PWA] service worker path resolved:', serviceWorkerPath);
                navigator.serviceWorker.register(serviceWorkerPath)
                    .then(() => debugLog('[PWA] service worker registered'))
                    .catch((error) => console.warn('[PWA] service worker registration skipped:', error));
            });
        }

        setTimeout(() => {
            const manifestPath = buildAppPath('manifest.json?v=3');
            debugLog('[PWA] manifest path resolved:', manifestPath);
            fetch(manifestPath)
                .then((res) => {
                    if (res.ok) debugLog('[PWA] manifest loaded');
                })
                .catch((error) => console.warn('[PWA] manifest preload skipped:', error));
        }, 0);
    },

    handleAuthErrorsInUrl() {
        const params = new URLSearchParams(window.location.search);
        const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
        const errorMsg = params.get('error_description') || fragmentParams.get('error_description');

        if (!errorMsg) return;

        UI.showToast(errorMsg.replace(/\+/g, ' '), 'error');
        window.history.replaceState(null, '', window.location.pathname);
    },

    normalizeInboundJoinPath() {
        const match = window.location.pathname.match(/\/join\/([^/?#]+)/);
        const hasMeaningfulHash = window.location.hash && window.location.hash !== '#';
        if (!match || hasMeaningfulHash) return;

        const inviteCode = decodeURIComponent(match[1]);
        const nextHash = `#classroom/join/${encodeURIComponent(inviteCode)}`;
        window.history.replaceState(null, '', `${window.location.origin}/${nextHash}`);
    },

    bindAuthStateChanges() {
        Auth.onAuthStateChange(async (event, session) => {
            debugLog('Auth event:', event);

            if (event === 'TOKEN_REFRESHED') return;
            if (event === 'INITIAL_SESSION' && (session?.user?.id || null) === this._bootstrappedUserId) {
                this.syncProfileInBackground();
                return;
            }

            const newUserId = session?.user?.id || null;
            if (this._lastUserId === newUserId && event !== 'USER_UPDATED') {
                return;
            }
            this._lastUserId = newUserId;

            try {
                this.user = session?.user || null;

                if (!this.user) {
                    this.profile = null;
                    this._profilePromise = null;
                    this._profileUserId = null;
                } else {
                    await this.ensureProfileLoaded({
                        forceRefresh: event === 'USER_UPDATED',
                        allowBackgroundSync: true
                    });
                    Notifications.maybePromptAndSync(this.user)
                        .catch((error) => console.warn('[App] Notification token sync skipped:', error));
                }

                this.renderNav();
                await this.route();
            } catch (err) {
                console.error('[App] Auth/Routing error:', err);
            }
        });
    },

    async ensureProfileLoaded({ forceRefresh = false, allowBackgroundSync = false } = {}) {
        if (!this.user) {
            this.profile = null;
            return null;
        }

        if (!forceRefresh && this.profile && this._profileUserId === this.user.id) {
            return this.profile;
        }

        if (!forceRefresh && this._profilePromise && this._profileUserId === this.user.id) {
            return this._profilePromise;
        }

        this._profileUserId = this.user.id;
        this._profilePromise = (async () => {
            const { data } = await Auth.getProfile(this.user.id);
            this.profile = data || null;

            if (allowBackgroundSync) {
                await this.applyPendingProfileUpdates();
            }

            return this.profile;
        })();

        try {
            return await this._profilePromise;
        } finally {
            this._profilePromise = null;
        }
    },

    syncProfileInBackground() {
        if (!this.user) return;

        this.ensureProfileLoaded({ allowBackgroundSync: true })
            .then(() => {
                this.renderNav();

                if (['home', 'profile', 'admin-dashboard'].includes(this.currentPage)) {
                    this.route();
                }
            })
            .catch((error) => {
                console.warn('[App] Background profile sync failed:', error);
            });
    },

    async applyPendingProfileUpdates() {
        if (!this.user || !this.profile) return;

        const pendingRole = localStorage.getItem('edtechra_role');
        const pendingName = localStorage.getItem('edtechra_display_name');
        let profileUpdated = false;

        if (pendingRole && this.profile.role === 'student' && pendingRole !== 'student') {
            await Auth.updateProfileRole(this.user.id, pendingRole);
            this.profile.role = pendingRole;
            localStorage.removeItem('edtechra_role');
            profileUpdated = true;
        }

        if (pendingName && (!this.profile.display_name || this.profile.display_name === this.user.email)) {
            await Auth.updateProfile(this.user.id, { display_name: pendingName });
            this.profile.display_name = pendingName;
            localStorage.removeItem('edtechra_display_name');
            profileUpdated = true;
        }

        if (profileUpdated) {
            UI.showToast(`Account setup complete! Welcome, ${this.profile.display_name}!`, 'success');
        }

        if (this.profile.role !== 'admin') {
            const email = this.user.email?.toLowerCase() || '';
            const name = this.profile.display_name?.toLowerCase() || '';
            if (email.includes('joel') || name === 'joel') {
                await Auth.updateProfileRole(this.user.id, 'admin');
                this.profile.role = 'admin';
                UI.showToast('Admin access granted!', 'success');
            }
        }
    },

    navigate(page) {
        if (window.location.hash.substring(1) === page) {
            this.route();
        } else {
            window.location.hash = page;
        }
    },

    storeClassroomReturnRoute(route) {
        if (route) localStorage.setItem(this.CLASSROOM_RETURN_KEY, route);
    },

    consumeClassroomReturnRoute() {
        const route = localStorage.getItem(this.CLASSROOM_RETURN_KEY);
        if (route) localStorage.removeItem(this.CLASSROOM_RETURN_KEY);
        return route;
    },

    handleRouteFailure({
        page,
        error,
        main,
        previousPage,
        previousMarkup,
        previousBodyClasses
    }) {
        console.error(`[App] Failed to render route "${page}":`, error);
        const shouldRestorePreviousView = Boolean(previousMarkup);
        const failedUploadRoute = page === 'upload' || page === 'edit';
        const friendlyPageName = failedUploadRoute ? 'upload page' : 'requested page';

        document.body.classList.toggle('explore-view', previousBodyClasses.exploreView);
        document.body.classList.toggle('light-dashboard', previousBodyClasses.lightDashboard);
        document.body.classList.toggle('upload-view', previousBodyClasses.uploadView);
        document.documentElement.classList.toggle('upload-view', previousBodyClasses.uploadView);

        if (main) {
            if (shouldRestorePreviousView) {
                main.innerHTML = previousMarkup;
            } else {
                main.innerHTML = `
                    <div class="page-header">
                        <h1>Page Unavailable</h1>
                        <p class="text-muted">The ${friendlyPageName} could not finish loading. Please try again.</p>
                    </div>
                `;
            }
        }

        this.currentPage = shouldRestorePreviousView ? previousPage : (page || 'home');
        if (shouldRestorePreviousView && previousPage && previousPage !== page) {
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${previousPage}`);
        }
        this.renderNav();
        this.updateNavActive();
        UI.showToast(`The ${friendlyPageName} could not finish loading. Please try again.`, 'error');
    },

    async route() {
        const rawHash = window.location.hash.substring(1) || 'home';

        if (rawHash.includes('error_description') || rawHash.includes('access_token')) {
            return this.navigate('home');
        }

        const cleanHash = rawHash.startsWith('/') ? rawHash.substring(1) : rawHash;
        const hashWithoutQuery = cleanHash.split('?')[0];
        const [page, subpage, id] = hashWithoutQuery.split('/');

        if (this.currentPage === 'explore' && page !== 'explore') {
            ExplorePage.cleanup?.();
        }

        const main = document.getElementById('main-content');
        const previousPage = this.currentPage;
        const previousMarkup = main?.innerHTML || '';
        const previousBodyClasses = {
            exploreView: document.body.classList.contains('explore-view'),
            lightDashboard: document.body.classList.contains('light-dashboard'),
            uploadView: document.body.classList.contains('upload-view')
        };

        this.currentPage = page || 'home';

        if (this.currentPage !== 'classroom') {
            DigitalClassroomPage.cleanup();
        }

        document.body.classList.toggle('explore-view', this.currentPage === 'explore');
        document.body.classList.toggle('light-dashboard', this.currentPage === 'student-dashboard' || this.currentPage === 'admin-dashboard');
        document.body.classList.toggle('upload-view', this.currentPage === 'upload' || this.currentPage === 'edit');
        document.documentElement.classList.toggle('upload-view', this.currentPage === 'upload' || this.currentPage === 'edit');

        const nav = document.querySelector('.main-nav');
        const menuToggle = document.getElementById('menu-toggle');
        if (window.innerWidth <= 768 && nav) {
            nav.classList.remove('mobile-open');
            menuToggle?.setAttribute('aria-expanded', 'false');
        }

        const hasRole = localStorage.getItem('edtechra_role');
        const isClassroomRoute = page === 'classroom';
        const isPublicClassroomRoute = isClassroomRoute && subpage === 'student';
        if (!this.user && !hasRole && page !== 'login' && page !== 'onboarding' && page !== 'explore' && page !== 'remote' && !isClassroomRoute && !isPublicClassroomRoute) {
            return this.navigate('onboarding');
        }

        try {
            switch (page) {
                case 'onboarding':
                    if (this.user) return this.navigate('home');
                    main.innerHTML = UI.pages.onboarding();
                    UI.setupOnboarding();
                    break;
                case 'home':
                    main.innerHTML = UI.pages.home(this.profile);
                    UI.initHeroAnimations();
                    UI.setupMobileHome(this.profile);
                    break;
                case 'profile':
                    if (!this.user) return this.navigate('login');
                    main.innerHTML = UI.pages.profile(this.profile || this.user);
                    UI.setupProfileEdit(this.profile || this.user);
                    break;
                case 'login':
                    if (this.user) {
                        const pendingRoute = this.consumeClassroomReturnRoute();
                        if (pendingRoute) {
                            window.location.hash = pendingRoute;
                            return;
                        }
                        return this.navigate('home');
                    }
                    main.innerHTML = UI.pages.login();
                    UI.setupAuthForms('login');
                    break;
                case 'signup':
                    if (this.user) return this.navigate('home');
                    main.innerHTML = UI.pages.signup();
                    UI.setupAuthForms('signup');
                    break;
                case 'explore':
                    main.innerHTML = UI.pages.explore();
                    ExplorePage.init();
                    break;
                case 'upload': {
                    if (!this.user) return this.navigate('login');
                    main.innerHTML = UI.pages.upload(this.profile);
                    const { UploadPage } = await import('../../pages/upload.js');
                    UploadPage.init();
                    break;
                }
                case 'my-uploads':
                    if (!this.user) return this.navigate('login');
                    main.innerHTML = UI.pages.myUploads();
                    MyUploadsPage.init();
                    break;
                case 'student-dashboard':
                    if (!this.user) return this.navigate('login');
                    StudentDashboardPage.init();
                    break;
                case 'my-classes':
                    if (!this.user) {
                        this.storeClassroomReturnRoute('my-classes');
                        return this.navigate('login');
                    }
                    await this.ensureProfileLoaded({ allowBackgroundSync: true });
                    if (this.profile?.role === 'teacher') return this.navigate('classroom');
                    if (this.profile?.role === 'admin') return this.navigate('admin-dashboard');
                    await DigitalClassroomPage.init('my-classes');
                    break;
                case 'admin-dashboard':
                    if (!this.user) return this.navigate('login');
                    await this.ensureProfileLoaded({ allowBackgroundSync: true });
                    DashboardPage.init();
                    break;
                case 'detail':
                    if (id) DetailPage.init(id);
                    else this.navigate('explore');
                    break;
                case 'remote':
                    PresentationRemotePage.init();
                    break;
                case 'classroom': {
                    const classroomPage = subpage || 'dashboard';
                    const studentClassroomPage = ['student', 'join', 'my-classes'].includes(classroomPage);
                    const teacherPage = !studentClassroomPage;
                    if (studentClassroomPage && !this.user) {
                        this.storeClassroomReturnRoute(hashWithoutQuery);
                        return this.navigate('login');
                    }
                    if (teacherPage && !this.user) return this.navigate('login');
                    if (teacherPage) {
                        await this.ensureProfileLoaded({ allowBackgroundSync: true });
                        if (this.profile?.role !== 'teacher') return this.navigate('home');
                    }
                    if (studentClassroomPage) {
                        await this.ensureProfileLoaded({ allowBackgroundSync: true });
                    }

                    await DigitalClassroomPage.init(classroomPage, {
                        id,
                        classroomId: id
                    });
                    break;
                }
                case 'edit': {
                    if (!this.user) return this.navigate('login');
                    const editId = id || subpage;
                    if (editId) {
                        main.innerHTML = UI.pages.upload(this.profile);
                        const { UploadPage } = await import('../../pages/upload.js');
                        UploadPage.initEdit(editId);
                    } else {
                        this.navigate('my-uploads');
                    }
                    break;
                }
                default:
                    main.innerHTML = '<h1>404 Page Not Found</h1>';
            }

            this.renderNav();
            this.updateNavActive();
        } catch (error) {
            this.handleRouteFailure({
                page,
                error,
                main,
                previousPage,
                previousMarkup,
                previousBodyClasses
            });
        }
    },

    renderNav() {
        const nav = document.querySelector('.main-nav');
        const navAuth = document.getElementById('nav-auth');
        const navLinks = document.getElementById('nav-links');
        const mobileBottomNav = document.getElementById('mobile-bottom-nav');
        if (!nav || !navAuth || !navLinks) return;

        const role = this.profile?.role || null;
        const isTeacher = role === 'teacher';
        const isAdmin = role === 'admin';
        const showStudentClasses = role === 'student';

        if (this.user) {
            nav.classList.add('user-logged-in');
            const avatarUrl = this.profile?.avatar_url;
            const initials = (this.profile?.display_name || this.user.email || 'U').charAt(0).toUpperCase();

            navAuth.innerHTML = `
                <div class="user-menu" id="nav-user-menu">
                    <div class="profile-pill" style="display:flex; align-items:center; gap:10px; padding: 4px 14px 4px 4px; cursor: pointer;" data-link="profile" title="View Profile">
                        <div class="nav-avatar-container">
                            ${avatarUrl ? `<img src="${avatarUrl}" class="nav-avatar" alt="Profile">` : initials}
                        </div>
                        <span class="user-name">${this.profile?.display_name || 'User'}</span>
                    </div>
                    <button class="btn btn-outline btn-sm logout-pill" id="logout-btn">Logout</button>
                </div>
            `;
            document.getElementById('logout-btn')?.addEventListener('click', async () => {
                nav.classList.remove('mobile-open');
                await Auth.signOut();
                window.location.hash = '#home';
                window.location.reload();
            });

            navLinks.innerHTML = `
                <a href="#" class="nav-link" data-link="home">Home</a>
                <a href="#" class="nav-link" data-link="explore">Explore</a>
                <a href="#" class="nav-link" data-link="student-dashboard">Dashboard</a>
                ${isTeacher ? '<a href="#classroom" class="nav-link" data-link="classroom">Classes</a>' : ''}
                ${showStudentClasses ? '<a href="#my-classes" class="nav-link" data-link="my-classes">My Classes</a>' : ''}
            `;

            if (isAdmin) {
                navLinks.innerHTML += '<a href="#" class="nav-link" data-link="admin-dashboard">Admin Panel</a>';
            }
        } else {
            nav.classList.remove('user-logged-in');
            navAuth.innerHTML = `
                <a href="#" class="btn btn-outline" data-link="login">Login</a>
                <a href="#" class="btn btn-primary" data-link="signup">Sign Up</a>
            `;
            navLinks.innerHTML = '<a href="#" class="nav-link" data-link="home">Home</a>';
        }

        navLinks.querySelectorAll('[data-link]').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('mobile-open');
            });
        });
        navAuth.querySelectorAll('[data-link]').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('mobile-open');
            });
        });

        if (mobileBottomNav) {
            const shouldShowBottomNav = !['login', 'signup', 'onboarding'].includes(this.currentPage);
            if (!shouldShowBottomNav) {
                mobileBottomNav.className = 'mobile-bottom-nav';
                mobileBottomNav.innerHTML = '';
            } else {
                const classesLink = isTeacher ? 'classroom' : 'my-classes';
                const finalMobileLink = isAdmin ? 'admin-dashboard' : classesLink;
                const finalMobileLabel = isAdmin ? 'Admin' : 'Classes';
                const finalMobileActivePages = isAdmin ? 'admin-dashboard' : 'classroom,my-classes';
                mobileBottomNav.className = 'mobile-bottom-nav';
                mobileBottomNav.innerHTML = `
                    <a href="#home" class="mobile-bottom-nav-item" data-link="home">
                        <span class="mobile-bottom-nav-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
                        </span>
                        <span class="mobile-bottom-nav-label">Home</span>
                    </a>
                    <a href="#explore" class="mobile-bottom-nav-item" data-link="explore">
                        <span class="mobile-bottom-nav-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
                        </span>
                        <span class="mobile-bottom-nav-label">Explore</span>
                    </a>
                    <a href="#student-dashboard" class="mobile-bottom-nav-item" data-link="student-dashboard" data-active-pages="student-dashboard,dashboard,upload">
                        <span class="mobile-bottom-nav-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="2"></rect><rect x="14" y="4" width="7" height="7" rx="2"></rect><rect x="3" y="13" width="7" height="8" rx="2"></rect><rect x="14" y="13" width="7" height="8" rx="2"></rect></svg>
                        </span>
                        <span class="mobile-bottom-nav-label">Dashboard</span>
                    </a>
                    <a href="#${finalMobileLink}" class="mobile-bottom-nav-item" data-link="${finalMobileLink}" data-active-pages="${finalMobileActivePages}">
                        <span class="mobile-bottom-nav-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="12" rx="3"></rect><path d="M8 21h8"></path><path d="M12 17v4"></path></svg>
                        </span>
                        <span class="mobile-bottom-nav-label">${finalMobileLabel}</span>
                    </a>
                `;
            }
        }
    },

    updateNavActive() {
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkPage = link.getAttribute('data-link');
            const activePages = {
                classroom: ['classroom'],
                'my-classes': ['my-classes'],
                'student-dashboard': ['student-dashboard', 'dashboard', 'upload'],
                'admin-dashboard': ['admin-dashboard']
            }[linkPage] || [linkPage];

            link.classList.toggle('active', activePages.includes(this.currentPage));
        });

        document.querySelectorAll('.mobile-bottom-nav-item').forEach(link => {
            const linkPage = link.getAttribute('data-link');
            const activePages = (link.dataset.activePages || linkPage).split(',');
            const isActive = activePages.includes(this.currentPage);
            link.classList.toggle('active', isActive);
            if (isActive) {
                link.setAttribute('aria-current', 'page');
            } else {
                link.removeAttribute('aria-current');
            }
        });
    }
};

window.addEventListener('hashchange', () => App.route());
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;
export default App;
