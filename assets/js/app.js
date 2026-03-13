import { Auth } from './auth.js';
import { UI } from './ui.js';
import { UploadPage } from '../../pages/upload.js';
import { MyUploadsPage } from '../../pages/my-uploads.js';
import { ExplorePage } from '../../pages/explore.js';
import { DetailPage } from '../../pages/detail.js';
import { DashboardPage } from '../../pages/dashboard.js';
import { StudentDashboardPage } from '../../pages/student-dashboard.js';
import { API } from './api.js';

const App = {
    user: null,
    profile: null,
    currentPage: 'home',
    isFirstLoad: true,

    async init() {
        UI.showLoader();

        // ─── Phase 3: Reliable PWA Install Logic ───
        let deferredPrompt = null;

        // Step 2 & 6: Capture event and log
        window.addEventListener("beforeinstallprompt", (e) => {
            console.log("[PWA] beforeinstallprompt fired");
            e.preventDefault();
            deferredPrompt = e;
            console.log("[PWA] deferredPrompt stored");

            const btn = document.getElementById("installBtn");
            if (btn) {
                btn.style.display = "block";
                console.log("[PWA] install button displayed");
            }
        });

        // Step 3 & 6: Click handler with logging
        // Using delegation to ensure dynamic hero content is handled
        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('#installBtn');
            if (btn) {
                console.log("[PWA] install button clicked");
                if (!deferredPrompt) return;
                
                console.log("[PWA] install prompt opened");
                deferredPrompt.prompt();
                const result = await deferredPrompt.userChoice;
                console.log("[PWA] user choice:", result.outcome);
                deferredPrompt = null;
                btn.style.display = "none";
            }
        });

        // Step 4 & 6: Handle successful install
        window.addEventListener("appinstalled", () => {
            console.log("[PWA] appinstalled fired");
            console.log("[PWA] App installed");
            const btn = document.getElementById("installBtn");
            if (btn) btn.style.display = "none";
        });

        // Step 5: Detect already installed
        if (window.matchMedia("(display-mode: standalone)").matches) {
            console.log("[PWA] running in standalone mode");
            const btn = document.getElementById("installBtn");
            if (btn) btn.style.display = "none";
        }

        // SW Registration & Manifest Tracking
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js?v=9').then(reg => {
                    console.log('[PWA] service worker registered');
                });
            });
        }
        fetch('/manifest.json?v=3').then(res => {
            if (res.ok) console.log('[PWA] manifest loaded');
        });

        // 🚨 FAILSAFE TIMER: If mobile data hangs, drop the loader after 3 seconds
        this._failsafeTimer = setTimeout(() => {
            if (this.isFirstLoad) {
                console.warn("Failsafe triggered: Hiding loader. Auth or network may have timed out.");
                UI.hideLoader();
                this.isFirstLoad = false;
                if (!document.getElementById('main-content').innerHTML.trim()) {
                    this.route();
                }
            }
        }, 3000);

        // Handle auth errors in URL (Search params or Fragments)
        const params = new URLSearchParams(window.location.search);
        const fragmentParams = new URLSearchParams(window.location.hash.substring(1));
        const errorMsg = params.get('error_description') || fragmentParams.get('error_description');

        if (errorMsg) {
            UI.showToast(errorMsg.replace(/\+/g, ' '), 'error');
            // Clean up URL to prevent repeated toasts
            window.history.replaceState(null, '', window.location.pathname);
        }

        // Listen for auth changes
        Auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event);
            if (this._failsafeTimer) {
                clearTimeout(this._failsafeTimer);
                this._failsafeTimer = null;
            }

            if (event === 'TOKEN_REFRESHED') return;

            const newUserId = session?.user?.id || null;
            if (!this.isFirstLoad && this._lastUserId === newUserId && event !== 'USER_UPDATED') {
                return; // Prevent unnecessary rerenders
            }
            this._lastUserId = newUserId;

            try {
                this.user = session?.user || null;

                if (this.user) {
                    const { data } = await Auth.getProfile(this.user.id);
                    this.profile = data;

                    // OAuth Sync Logic: Sync role and name from onboarding
                    const pendingRole = localStorage.getItem('edtechra_role');
                    const pendingName = localStorage.getItem('edtechra_display_name');

                    let profileUpdated = false;

                    if (this.profile && pendingRole && this.profile.role === 'student' && pendingRole !== 'student') {
                        await Auth.updateProfileRole(this.user.id, pendingRole);
                        this.profile.role = pendingRole;
                        localStorage.removeItem('edtechra_role');
                        profileUpdated = true;
                    }

                    if (this.profile && pendingName && (!this.profile.display_name || this.profile.display_name === this.user.email)) {
                        await Auth.updateProfile(this.user.id, { display_name: pendingName });
                        this.profile.display_name = pendingName;
                        localStorage.removeItem('edtechra_display_name');
                        profileUpdated = true;
                    }

                    if (profileUpdated) {
                        UI.showToast(`Account setup complete! Welcome, ${this.profile.display_name}!`, 'success');
                    }

                    // Auto-promote 'joel' accounts to admin
                    if (this.profile && this.profile.role !== 'admin') {
                        const email = this.user.email?.toLowerCase() || '';
                        const name = this.profile.display_name?.toLowerCase() || '';
                        if (email.includes('joel') || name === 'joel') {
                            await Auth.updateProfileRole(this.user.id, 'admin');
                            this.profile.role = 'admin';
                            UI.showToast('Admin access granted!', 'success');
                        }
                    }
                } else {
                    this.profile = null;
                }

                this.renderNav();
                await this.route();
            } catch (err) {
                console.error("Auth/Routing Error during init:", err);
            } finally {
                if (this.isFirstLoad) {
                    UI.hideLoader();
                    this.isFirstLoad = false;
                }
            }
        });

        // Handle navigation clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                const page = link.getAttribute('data-link');
                this.navigate(page);
            }

            // Navigation delegation continues below...
        });

        // Initialize UI
        UI.init();
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

        // If the hash contains error info, it's not a valid page route
        if (rawHash.includes('error_description') || rawHash.includes('access_token')) {
            return this.navigate('home');
        }

        // Handle cases like #/home or #explore
        const cleanHash = rawHash.startsWith('/') ? rawHash.substring(1) : rawHash;

        // Strip out any trailing query parameters appended by sharing apps (like WhatsApp)
        const hashWithoutQuery = cleanHash.split('?')[0];
        const [page, id] = hashWithoutQuery.split('/');

        this.currentPage = page || 'home';

        // Toggle light theme class on body for specific pages
        document.body.classList.toggle('explore-view', this.currentPage === 'explore');
        document.body.classList.toggle('light-dashboard', this.currentPage === 'student-dashboard' || this.currentPage === 'admin-dashboard');

        // Force onboarding for first-time unauth visitors
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
            case 'upload':
                if (!this.user) return this.navigate('login');
                main.innerHTML = UI.pages.upload();
                UploadPage.init();
                break;
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
                DashboardPage.init();
                break;
            case 'detail':
                if (id) DetailPage.init(id);
                else this.navigate('explore');
                break;
            case 'edit':
                if (!this.user) return this.navigate('login');
                if (id) {
                    main.innerHTML = UI.pages.upload();
                    UploadPage.initEdit(id);
                } else {
                    this.navigate('my-uploads');
                }
                break;
            default:
                main.innerHTML = `<h1>404 Page Not Found</h1>`;
        }

        this.updateNavActive();
    },


    renderNav() {
        const nav = document.querySelector('.main-nav');
        const navAuth = document.getElementById('nav-auth');
        const navLinks = document.getElementById('nav-links');

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
                navLinks.innerHTML += `<a href="#" class="nav-link" data-link="admin-dashboard">Admin Panel</a>`;
            }
        } else {
            nav.classList.remove('user-logged-in');
            navAuth.innerHTML = `
                <a href="#" class="btn btn-outline" data-link="login">Login</a>
                <a href="#" class="btn btn-primary" data-link="signup">Sign Up</a>
            `;
            navLinks.innerHTML = `<a href="#" class="nav-link" data-link="home">Home</a>`;
        }

        // Close mobile menu when a nav link is clicked
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
    },

    updateNavActive() {
        document.querySelectorAll('.nav-link').forEach(link => {
            const linkPage = link.getAttribute('data-link');
            link.classList.toggle('active', linkPage === this.currentPage);
        });
    }
};

// Global route listener
window.addEventListener('hashchange', () => App.route());
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App; // Expose globally for cross-module access (e.g. profile save)
export default App;
