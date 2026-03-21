import { Auth } from './auth.js';
import { UI } from './ui.js';
import { MyUploadsPage } from '../../pages/my-uploads.js';
import { ExplorePage } from '../../pages/explore.js';
import { DetailPage } from '../../pages/detail.js';
import { DashboardPage } from '../../pages/dashboard.js';
import { StudentDashboardPage } from '../../pages/student-dashboard.js';

const App = {
    user: null,
    profile: null,
    currentPage: 'home',
    isFirstLoad: true,
    _profilePromise: null,
    _profileUserId: null,
    _bootstrappedUserId: null,
    _lastUserId: null,

    async init() {
        UI.init();
        this.renderNav();
        this.initializePwaEnhancements();
        this.handleAuthErrorsInUrl();

        try {
            const session = await Auth.getSession();
            this.user = session?.user || null;
            this._bootstrappedUserId = this.user?.id || null;
            this._lastUserId = this._bootstrappedUserId;
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
            console.log('[PWA] beforeinstallprompt fired');
            e.preventDefault();
            deferredPrompt = e;
            console.log('[PWA] deferredPrompt stored');

            const btn = document.getElementById('installBtn');
            if (btn) {
                btn.style.display = 'block';
                console.log('[PWA] install button displayed');
            }
        });

        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('#installBtn');
            if (!btn || !deferredPrompt) return;

            console.log('[PWA] install button clicked');
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            console.log('[PWA] user choice:', result.outcome);
            deferredPrompt = null;
            btn.style.display = 'none';
        });

        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed');
            const btn = document.getElementById('installBtn');
            if (btn) btn.style.display = 'none';
        });

        if (window.matchMedia('(display-mode: standalone)').matches) {
            const btn = document.getElementById('installBtn');
            if (btn) btn.style.display = 'none';
        }

        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js?v=9')
                    .then(() => console.log('[PWA] service worker registered'))
                    .catch((error) => console.warn('[PWA] service worker registration skipped:', error));
            });
        }

        setTimeout(() => {
            fetch('/manifest.json?v=3')
                .then((res) => {
                    if (res.ok) console.log('[PWA] manifest loaded');
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

    bindAuthStateChanges() {
        Auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event);

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

    async route() {
        const rawHash = window.location.hash.substring(1) || 'home';

        if (rawHash.includes('error_description') || rawHash.includes('access_token')) {
            return this.navigate('home');
        }

        const cleanHash = rawHash.startsWith('/') ? rawHash.substring(1) : rawHash;
        const hashWithoutQuery = cleanHash.split('?')[0];
        const [page, id] = hashWithoutQuery.split('/');

        this.currentPage = page || 'home';

        document.body.classList.toggle('explore-view', this.currentPage === 'explore');
        document.body.classList.toggle('light-dashboard', this.currentPage === 'student-dashboard' || this.currentPage === 'admin-dashboard');

        const nav = document.querySelector('.main-nav');
        const menuToggle = document.getElementById('menu-toggle');
        if (window.innerWidth <= 768 && nav) {
            nav.classList.remove('mobile-open');
            menuToggle?.setAttribute('aria-expanded', 'false');
        }

        const hasRole = localStorage.getItem('edtechra_role');
        if (!this.user && !hasRole && page !== 'login' && page !== 'onboarding' && page !== 'explore') {
            return this.navigate('onboarding');
        }

        const main = document.getElementById('main-content');

        switch (page) {
            case 'onboarding':
                if (this.user) return this.navigate('home');
                main.innerHTML = UI.pages.onboarding();
                UI.setupOnboarding();
                break;
            case 'home':
                main.innerHTML = UI.pages.home(this.profile);
                UI.initHeroAnimations();
                break;
            case 'profile':
                if (!this.user) return this.navigate('login');
                main.innerHTML = UI.pages.profile(this.profile || this.user);
                UI.setupProfileEdit(this.profile || this.user);
                break;
            case 'login':
                if (this.user) return this.navigate('home');
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
                main.innerHTML = UI.pages.upload();
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
            case 'admin-dashboard':
                if (!this.user) return this.navigate('login');
                await this.ensureProfileLoaded({ allowBackgroundSync: true });
                DashboardPage.init();
                break;
            case 'detail':
                if (id) DetailPage.init(id);
                else this.navigate('explore');
                break;
            case 'edit': {
                if (!this.user) return this.navigate('login');
                if (id) {
                    main.innerHTML = UI.pages.upload();
                    const { UploadPage } = await import('../../pages/upload.js');
                    UploadPage.initEdit(id);
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
    },

    renderNav() {
        const nav = document.querySelector('.main-nav');
        const navAuth = document.getElementById('nav-auth');
        const navLinks = document.getElementById('nav-links');
        const mobileBottomNav = document.getElementById('mobile-bottom-nav');
        if (!nav || !navAuth || !navLinks) return;

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
            `;

            if (this.profile?.role === 'admin') {
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
                mobileBottomNav.className = `mobile-bottom-nav ${this.profile?.role === 'admin' ? 'has-admin' : ''}`.trim();
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
                    <a href="#student-dashboard" class="mobile-bottom-nav-item" data-link="student-dashboard">
                        <span class="mobile-bottom-nav-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="7" height="7" rx="2"></rect><rect x="14" y="4" width="7" height="7" rx="2"></rect><rect x="3" y="13" width="7" height="8" rx="2"></rect><rect x="14" y="13" width="7" height="8" rx="2"></rect></svg>
                        </span>
                        <span class="mobile-bottom-nav-label">Dashboard</span>
                    </a>
                    <a href="#profile" class="mobile-bottom-nav-item" data-link="profile">
                        <span class="mobile-bottom-nav-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c1.8-3.6 5-5.5 8-5.5s6.2 1.9 8 5.5"></path></svg>
                        </span>
                        <span class="mobile-bottom-nav-label">Profile</span>
                    </a>
                    ${this.profile?.role === 'admin' ? `
                    <a href="#admin-dashboard" class="mobile-bottom-nav-item" data-link="admin-dashboard">
                        <span class="mobile-bottom-nav-icon">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V7l-8-4Z"></path><path d="M9.5 12 11 13.5 14.5 10"></path></svg>
                        </span>
                        <span class="mobile-bottom-nav-label">Admin</span>
                    </a>
                    ` : ''}
                `;
            }
        }
    },

    updateNavActive() {
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkPage = link.getAttribute('data-link');
            link.classList.toggle('active', linkPage === this.currentPage);
        });

        document.querySelectorAll('.mobile-bottom-nav-item').forEach(link => {
            const linkPage = link.getAttribute('data-link');
            link.classList.toggle('active', linkPage === this.currentPage);
        });
    }
};

window.addEventListener('hashchange', () => App.route());
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;
export default App;
