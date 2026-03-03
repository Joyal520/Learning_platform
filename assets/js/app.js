import { Auth } from './auth.js';
import { UI } from './ui.js';
import { UploadPage } from '../../pages/upload.js';
import { MyUploadsPage } from '../../pages/my-uploads.js';
import { ExplorePage } from '../../pages/explore.js';
import { DetailPage } from '../../pages/detail.js';
import { DashboardPage } from '../../pages/dashboard.js';
import { API } from './api.js';

const App = {
    user: null,
    profile: null,
    currentPage: 'home',

    async init() {
        UI.showLoader();

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
            this.user = session?.user || null;

            if (this.user) {
                const { data } = await Auth.getProfile(this.user.id);
                this.profile = data;

                // OAuth Role Sync Logic: 
                // If profile is fresh but we have a pending role from onboarding
                const pendingRole = localStorage.getItem('edtechra_role');
                if (this.profile && pendingRole && this.profile.role === 'student' && pendingRole !== 'student') {
                    await Auth.updateProfileRole(this.user.id, pendingRole);
                    this.profile.role = pendingRole;
                    localStorage.removeItem('edtechra_role');
                    UI.showToast(`Account set up as ${pendingRole}!`, 'success');
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
            this.route();
        });

        // Handle navigation clicks
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                const page = link.getAttribute('data-link');
                this.navigate(page);
            }
        });

        // Initialize UI
        UI.init();
        UI.hideLoader();
    },

    navigate(page) {
        window.location.hash = page;
        // route() will be called by hashchange listener if added, 
        // or manually here if not. Let's add hashchange listener for better DX.
    },

    async route() {
        const rawHash = window.location.hash.substring(1) || 'home';

        // If the hash contains error info, it's not a valid page route
        if (rawHash.includes('error_description') || rawHash.includes('access_token')) {
            return this.navigate('home');
        }

        // Handle cases like #/home or #explore
        const cleanHash = rawHash.startsWith('/') ? rawHash.substring(1) : rawHash;
        const [page, id] = cleanHash.split('/');
        this.currentPage = page || 'home';

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
                main.innerHTML = UI.pages.home();
                this.renderTrending();
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
            case 'dashboard':
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

    async renderTrending() {
        const grid = document.getElementById('trending-grid');
        if (!grid) return;

        const { data, error } = await API.getSubmissions(null, 'rating', 3);

        if (error || !data || data.length === 0) {
            grid.innerHTML = `<p class="text-muted">No trending items yet.</p>`;
            return;
        }

        grid.innerHTML = data.map(sub => UI.renderCard(sub)).join('');
    },

    renderNav() {
        const nav = document.querySelector('.main-nav');
        const navAuth = document.getElementById('nav-auth');
        const navLinks = document.getElementById('nav-links');

        if (this.user) {
            nav.classList.add('user-logged-in');
            navAuth.innerHTML = `
                <div class="user-menu">
                    <span class="user-name">${this.profile?.display_name || this.user.email}</span>
                    <button class="btn btn-outline btn-sm" id="logout-btn">Logout</button>
                </div>
            `;
            document.getElementById('logout-btn')?.addEventListener('click', () => {
                nav.classList.remove('mobile-open');
                Auth.signOut();
            });

            navLinks.innerHTML = `
                <a href="#" class="nav-link" data-link="home">Home</a>
                <a href="#" class="nav-link" data-link="explore">Explore</a>
                <a href="#" class="nav-link" data-link="upload">Upload</a>
                <a href="#" class="nav-link" data-link="my-uploads">My Uploads</a>
            `;

            if (this.profile?.role === 'admin') {
                navLinks.innerHTML += `<a href="#" class="nav-link" data-link="dashboard">Dashboard</a>`;
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

export default App;
