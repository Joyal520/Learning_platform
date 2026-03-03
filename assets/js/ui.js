// assets/js/ui.js
import { Auth } from './auth.js';
import { supabase } from './supabase.js';

export const UI = {
    init() {
        // Menu toggle mobile
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.querySelector('.main-nav').classList.toggle('mobile-open');
        });
    },

    showLoader() { document.getElementById('loader')?.classList.remove('hidden'); },
    hideLoader() { document.getElementById('loader')?.classList.add('hidden'); },

    renderContentPreview(sub) {
        if (sub.file_type === 'text/html' && sub.content_text) {
            return `<div class="code-preview-container" id="previewContainer">
                        <div class="preview-header">
                            <p class="preview-label">Web Preview</p>
                            <button class="preview-fullscreen-btn" id="previewFullscreenBtn" title="Toggle Fullscreen Mode">⛶ Fullscreen</button>
                        </div>
                        <iframe class="code-preview-frame" sandbox="allow-scripts" srcdoc="${sub.content_text.replace(/"/g, '&quot;')}"></iframe>
                    </div>`;
        }
        if (sub.content_text) return `<div class="text-presentation">${sub.content_text}</div>`;
        if (sub.file_type?.startsWith('image/')) return `<img src="${sub.public_url}" class="preview-img" alt="${sub.title}">`;
        if (sub.file_type?.startsWith('audio/')) return `<audio controls class="preview-audio"><source src="${sub.public_url}" type="${sub.file_type}"></audio>`;
        return `<div class="file-placeholder">📄 This content is a ${sub.file_type || 'file'} and can be downloaded below.</div>`;
    },

    renderStars(rating) {
        return [1, 2, 3, 4, 5].map(i => `
            <span class="star ${i <= Math.round(rating) ? 'active' : ''}" data-value="${i}">★</span>
        `).join('');
    },

    renderCard(sub) {
        const stats = sub.submission_stats?.[0] || { avg_rating: 0, like_count: 0 };
        const categoryColors = {
            short_stories: '#6366f1', long_stories: '#8b5cf6', comics: '#ec4899',
            essays: '#14b8a6', articles: '#f59e0b', weird_facts: '#ef4444',
            conversations: '#06b6d4', poems: '#a855f7', images: '#22c55e', songs: '#f97316'
        };
        const color = categoryColors[sub.category] || '#6366f1';
        let thumbnailUrl = sub.thumbnail_url || null;
        if (!thumbnailUrl && sub.thumbnail_path) {
            if (sub.thumbnail_path.startsWith('data:')) {
                thumbnailUrl = sub.thumbnail_path;
            } else {
                const { data } = supabase.storage
                    .from('approved_public')
                    .getPublicUrl(sub.thumbnail_path);
                thumbnailUrl = data?.publicUrl || null;
            }
        }
        const thumbnail = thumbnailUrl
            ? `<div class="card-thumbnail" style="background-image:url('${thumbnailUrl}')"></div>`
            : `<div class="card-thumbnail card-thumb-gradient" style="background:linear-gradient(135deg, ${color}22, ${color}44)">
                <span class="thumb-emoji">${this.categoryEmoji(sub.category)}</span>
               </div>`;
        return `
            <div class="content-card glass-card" data-id="${sub.id}">
                ${thumbnail}
                <div class="card-body">
                    <span class="badge badge-category" style="--cat-color:${color}">${sub.category.replace('_', ' ')}</span>
                    <h3 class="card-title">${sub.title}</h3>
                    <p class="card-author">By ${sub.profiles?.display_name || 'Anonymous'}</p>
                    <div class="card-footer">
                        <div class="card-stats">
                            <span>★ ${Number(stats.avg_rating).toFixed(1)}</span>
                            <span>❤ ${stats.like_count}</span>
                        </div>
                        <a href="#detail/${sub.id}" class="btn btn-primary btn-sm" data-link="detail/${sub.id}">View</a>
                    </div>
                </div>
            </div>
        `;
    },

    categoryEmoji(cat) {
        const map = {
            short_stories: '📖', long_stories: '📚', comics: '🦸', essays: '✍️',
            articles: '📰', weird_facts: '🤯', conversations: '💬', poems: '🌸',
            images: '🖼️', songs: '🎵'
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

    pages: {
        home: (currentUser) => `
            <section class="hero homepage-hero">
                <div class="hero-bg-decorators">
                    <div class="decorator dec-1"></div>
                    <div class="decorator dec-2"></div>
                    <div class="decorator dec-3"></div>
                </div>
                <h1>${currentUser?.display_name ? `Welcome back, ${currentUser.display_name}!` : 'EdTechra Creative Lab'}</h1>
                <p>${currentUser?.display_name ? 'Your creative journey continues here.' : 'A premium space for student creators to share their talent.'}</p>
                <div class="hero-actions">
                    <a href="#explore" class="btn btn-primary btn-lg" data-link="explore">Explore Work</a>
                    <button class="btn btn-outline btn-lg" data-link="upload">Upload Yours</button>
                </div>
            </section>
            <section class="trending">
                <h2>Trending Submissions</h2>
                <div class="grid" id="trending-grid">
                    <!-- Trending items injected here -->
                    <p class="text-muted">Loading trending items...</p>
                </div>
            </section>
        `,

        profile: (user) => `
            <div class="profile-container animate-fade-in">
                <div class="glass-card profile-card">
                    <div class="profile-header">
                        <div class="profile-avatar-large">
                            ${(user.display_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <h2>Profile Settings</h2>
                        <p class="text-muted">Update your public presence on EDTECHRA.</p>
                    </div>

                    <form id="profile-form">
                        <div class="form-group">
                            <label>Display Name</label>
                            <input type="text" name="display_name" class="form-control" value="${user.display_name || ''}" placeholder="How should we call you?">
                        </div>
                        <div class="form-group">
                            <label>Email (Read-only)</label>
                            <input type="email" class="form-control" value="${user.email || ''}" readonly style="opacity: 0.6">
                        </div>
                        <div class="form-group">
                            <label>Role</label>
                            <input type="text" class="form-control" value="${user.role || 'student'}" readonly style="opacity: 0.6">
                        </div>
                        
                        <div style="margin-top: 32px">
                            <button type="submit" class="btn btn-primary btn-lg w-100">Save Changes</button>
                            <button type="button" class="btn btn-outline btn-lg w-100 mt-10" id="logout-btn-profile">Logout</button>
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
                        <p class="detail-author">By ${sub.profiles?.display_name || 'Anonymous'} • ${new Date(sub.created_at).toLocaleDateString()}</p>
                    </div>

                    <div class="detail-card glass-card">
                        <div class="detail-content">
                            ${this.renderContentPreview(sub)}
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

                                <div class="rating-group">
                                    <div class="rating-stars" id="rating-stars">
                                        ${this.renderStars(stats.avg_rating)}
                                    </div>
                                    <span class="text-xs text-muted">(${Number(stats.avg_rating).toFixed(1)})</span>
                                </div>
                            </div>

                            <div class="main-actions">
                                ${sub.file_path ? `<button class="btn btn-outline" id="download-btn">Download File</button>` : ''}
                                ${isOwner || isAdmin ? `<button class="btn btn-edit" id="edit-btn">Edit Submission</button>` : ''}
                            </div>
                        </div>
                    </div>

                    <button class="fullscreen-fab" id="fullscreenFab" title="Toggle Fullscreen Site">⛶</button>
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
                            <label>Category*</label>
                            <select name="category" class="form-control" required>
                                <option value="" disabled selected>Select a category</option>
                                <option value="short_stories">Short Stories</option>
                                <option value="long_stories">Long Stories</option>
                                <option value="comics">Comics</option>
                                <option value="essays">Essays</option>
                                <option value="articles">Articles</option>
                                <option value="weird_facts">Weird Facts</option>
                                <option value="conversations">Conversations</option>
                                <option value="poems">Poems</option>
                                <option value="images">Images</option>
                                <option value="songs">Songs</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="description" class="form-control" rows="3" placeholder="Tell us more about your work..."></textarea>
                    </div>

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
                        </div>
                    </div>

                    <div id="file-input-group" class="form-group">
                        <label>File Upload* (PDF, TXT, PNG, JPG, MP3, ZIP - Max 50MB)</label>
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

                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary btn-lg">Submit for Review</button>
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
            <div class="page-header">
                <h1>Explore Creative Works</h1>
                <p class="text-muted">Discover the best content from student creators.</p>
            </div>
            <div class="explore-filters card glass-card p-20 mb-30">
                <div class="search-box">
                    <input type="text" id="search-input" class="form-control" placeholder="Search by title or author...">
                </div>
                <div class="category-filters" id="category-filters">
                    <button class="filter-chip active" data-category="all">All</button>
                    <button class="filter-chip" data-category="short_stories">Short Stories</button>
                    <button class="filter-chip" data-category="long_stories">Long Stories</button>
                    <button class="filter-chip" data-category="comics">Comics</button>
                    <button class="filter-chip" data-category="essays">Essays</button>
                    <button class="filter-chip" data-category="articles">Articles</button>
                    <button class="filter-chip" data-category="weird_facts">Weird Facts</button>
                    <button class="filter-chip" data-category="conversations">Conversations</button>
                    <button class="filter-chip" data-category="poems">Poems</button>
                    <button class="filter-chip" data-category="images">Images</button>
                    <button class="filter-chip" data-category="songs">Songs</button>
                </div>
            </div>
            <div class="grid" id="explore-grid">
                <!-- Explored items injected here -->
            </div>
            <div id="explore-loader" class="loader-inline hidden"><div class="spinner"></div></div>
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
                    <button type="submit" class="btn btn-primary btn-lg w-100">Login</button>
                    
                    <div class="auth-divider"><span>OR</span></div>
                    
                    <button type="button" class="btn btn-outline w-100 google-btn" id="google-login">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                        Continue with Google
                    </button>

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

                    <button type="submit" class="btn btn-primary btn-lg w-100">Create Account</button>
                    
                    <div class="auth-divider"><span>OR</span></div>
                    
                    <button type="button" class="btn btn-outline w-100 google-btn" id="google-signup">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                        Sign up with Google
                    </button>

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
                        <p class="text-muted">Like Snapchat, let's start with your name.</p>
                    </div>
                    <input type="text" id="onboarding-name" class="name-input-large" placeholder="Your Name" autofocus>
                    <button id="next-to-roles" class="btn btn-primary btn-lg w-100">Continue</button>
                </div>

                <!-- Step 2: Roles -->
                <div id="onboarding-step-2" class="onboarding-step">
                    <div class="onboarding-header">
                        <h2>Choose Your Path</h2>
                        <p class="text-muted">What's your primary goal on EDTECHRA?</p>
                    </div>
                    <div class="role-grid">
                        <div class="role-option-large" data-role="student">
                            <span class="role-emoji">🎓</span>
                            <h3>Student</h3>
                            <p>Explore, learn, and share your creative work.</p>
                        </div>
                        <div class="role-option-large" data-role="teacher">
                            <span class="role-emoji">👩‍🏫</span>
                            <h3>Teacher</h3>
                            <p>Review student work and manage submissions.</p>
                        </div>
                        <div class="role-option-large" data-role="admin">
                            <span class="role-emoji">🛡️</span>
                            <h3>Admin</h3>
                            <p>Full system access and user management.</p>
                        </div>
                    </div>
                </div>
                <p class="text-center mt-20">Already have a role? <a href="#login">Sign In</a></p>
            </div>
        `
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

        logoutBtn?.addEventListener('click', async () => {
            UI.showLoader();
            await Auth.signOut();
            UI.hideLoader();
            window.location.hash = 'login';
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = {
                display_name: formData.get('display_name')
            };

            UI.showLoader();
            const { error } = await Auth.updateProfile(user.id, data);
            UI.hideLoader();

            if (error) {
                UI.showToast(error.message, 'error');
            } else {
                UI.showToast('Profile updated!', 'success');
                // Refresh App state
                window.location.reload();
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
