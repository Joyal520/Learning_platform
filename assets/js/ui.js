// assets/js/ui.js
import { Auth } from './auth.js';
import { supabase } from './supabase.js';

export const UI = {
    init() {
        // Menu toggle mobile
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.querySelector('.nav-links').classList.toggle('mobile-open');
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
        // Check if thumbnail_path contains a base64 data URL or a storage path
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
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    detail(sub, currentUser, userRole) {
        const stats = sub.submission_stats?.[0] || { avg_rating: 0, like_count: 0, download_count: 0 };
        const contentPreview = this.renderContentPreview(sub);
        const canEdit = (currentUser && currentUser.id === sub.author_id) || userRole === 'admin';
        return `
            <section class="detail-page">
                <div class="detail-header">
                    <a href="#explore" class="btn btn-outline btn-sm" data-link="explore">← Back to Explore</a>
                </div>
                <div class="detail-card glass-card">
                    <div class="detail-content">
                        <span class="badge badge-category">${sub.category?.replace('_', ' ') || ''}</span>
                        <h1 class="detail-title">${sub.title}</h1>
                        <p class="detail-author">By ${sub.profiles?.display_name || 'Anonymous'} · ${new Date(sub.created_at).toLocaleDateString()}</p>
                        ${sub.description ? `<p class="detail-description">${sub.description}</p>` : ''}
                        <div class="detail-preview">
                            ${contentPreview}
                        </div>
                    </div>
                    <div class="detail-actions">
                        <button id="like-btn" class="btn btn-outline btn-sm">❤ Like <span>${stats.like_count}</span></button>
                        <div id="rating-stars" class="rating-stars">
                            ${this.renderStars(stats.avg_rating)}
                        </div>
                        ${sub.file_path ? `<button id="download-btn" class="btn btn-primary btn-sm">📥 Download</button>` : ''}
                        ${canEdit ? `<button id="edit-btn" class="btn btn-edit btn-sm">✏️ Edit</button>` : ''}
                    </div>
                </div>
            </section>

            <!-- Floating Fullscreen Button — same as Edectra Tech Quiz -->
            <button class="fullscreen-fab" id="fullscreenFab" title="Toggle Fullscreen">⛶</button>
        `;
    },

    pages: {
        home: () => `
            <section class="hero">
                <h1>Explore, learn, and enjoy our students’ work.</h1>
                <p>A premium space for student creators to share their talent.</p>
                <div class="hero-actions">
                    <a href="#explore" class="btn btn-primary btn-lg" data-link="explore">Explore Work</a>
                    <a href="#upload" class="btn btn-outline btn-lg" data-link="upload">Upload Yours</a>
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
                <h1>Explore Student Talent</h1>
                <p class="text-muted">Browse through approved works from our student community.</p>
            </div>
            <div class="explore-filters card">
                <div class="filter-group">
                    <label>Category</label>
                    <select id="filter-category" class="form-control">
                        <option value="all">All Categories</option>
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
                <div class="filter-group">
                    <label>Sort By</label>
                    <select id="filter-sort" class="form-control">
                        <option value="created_at">Newest First</option>
                        <option value="rating">Top Rated</option>
                        <option value="likes">Most Liked</option>
                        <option value="downloads">Most Downloaded</option>
                    </select>
                </div>
                <div class="filter-group search">
                    <label>Search</label>
                    <input type="text" id="search-input" class="form-control" placeholder="Search by title or author...">
                </div>
            </div>
            <div id="explore-grid" class="grid-3 explore-grid">
                <div class="loader-inline"><div class="spinner"></div></div>
            </div>
        `,

        detail: (sub) => `
            <div class="detail-container">
                <div class="detail-header">
                    <a href="#explore" class="back-link">&larr; Back to Explore</a>
                    <h1>${sub.title}</h1>
                    <div class="sub-meta">
                        <span class="badge badge-category">${sub.category.replace('_', ' ')}</span>
                        <span>By ${sub.profiles?.display_name || 'Anonymous'}</span>
                        <span>• ${new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                
                <div class="detail-content card p-40 shadow-sm">
                    ${UI.renderContentPreview(sub)}
                    <p class="sub-description mt-20">${sub.description || ''}</p>
                </div>

                <div class="detail-actions">
                    <div class="interaction-group">
                        <button class="btn btn-outline" id="like-btn" data-id="${sub.id}">
                            <span class="icon">❤</span> <span id="like-count">${sub.submission_stats?.[0]?.like_count || 0}</span>
                        </button>
                        <div class="rating-stars" id="rating-stars" data-id="${sub.id}">
                            ${UI.renderStars(sub.submission_stats?.[0]?.avg_rating || 0)}
                        </div>
                    </div>
                    ${sub.file_path ? `
                        <button class="btn btn-primary" id="download-btn" data-id="${sub.id}">
                            Download File
                        </button>
                    ` : ''}
                </div>
            </div>
        `,

        dashboard: (role) => `
            <div class="page-header">
                <h1>${role === 'admin' ? 'Admin' : 'Teacher'} Dashboard</h1>
                <p class="text-muted">Manage ${role === 'admin' ? 'users and ' : ''}content moderation.</p>
            </div>
            
            ${role === 'admin' ? `
                <div class="stats-grid grid-4 mb-40">
                    <div class="card p-24"><h3>Total Users</h3><p id="stat-users" class="stat-val">-</p></div>
                    <div class="card p-24"><h3>Pending</h3><p id="stat-pending" class="stat-val">-</p></div>
                    <div class="card p-24"><h3>Approved</h3><p id="stat-approved" class="stat-val">-</p></div>
                    <div class="card p-24 storage-card">
                        <h3>System Storage</h3>
                        <div class="storage-stats">
                            <p id="stat-storage" class="stat-val">-</p>
                            <span class="text-muted">/ 1 GB</span>
                        </div>
                        <div class="storage-bar-container">
                            <div id="storage-bar" class="storage-bar" style="width: 0%"></div>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="tabs">
                <button class="tab-btn active" data-tab="pending">Pending Review</button>
                <button class="tab-btn" data-tab="all">All Submissions</button>
                ${role === 'admin' ? `<button class="tab-btn" data-tab="users">User Management</button>` : ''}
            </div>

            <div id="dashboard-content" class="mt-20">
                <div class="loader-inline"><div class="spinner"></div></div>
            </div>
        `,

        submissionRow: (sub, role) => `
            <div class="submission-item dashboard-row" data-id="${sub.id}">
                <div class="sub-info">
                    <h3>${sub.title}</h3>
                    <div class="sub-meta">
                        <span>By ${sub.profiles?.display_name || 'Anonymous'}</span>
                        <span>• ${sub.category}</span>
                        <span>• ${new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="sub-actions">
                    <button class="btn btn-outline btn-sm action-preview" data-id="${sub.id}">Preview</button>
                    ${role === 'admin' ? `
                        <button class="btn btn-success btn-sm action-approve" data-id="${sub.id}">Approve</button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm action-reject" data-id="${sub.id}">Reject</button>
                </div>
            </div>
        `,

        userRow: (u) => `
            <div class="submission-item dashboard-row">
                <div class="sub-info">
                    <h3>${u.display_name || 'Anonymous'}</h3>
                    <div class="sub-meta">
                        <span>Role: ${u.role}</span>
                        <span>• Joined: ${new Date(u.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="sub-actions">
                    <select class="form-control sm role-select" data-id="${u.id}">
                        <option value="student" ${u.role === 'student' ? 'selected' : ''}>Student</option>
                        <option value="teacher" ${u.role === 'teacher' ? 'selected' : ''}>Teacher</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
            </div>
        `,

        login: () => `
            <div class="auth-card animate-fade-in">
                <h2>Welcome Back</h2>
                <p class="text-muted">Sign in to EDTECHRA Hub</p>
                <form id="login-form">
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" class="form-control" required placeholder="name@school.edu">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" class="form-control" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Login</button>
                    
                    <div class="divider"><span>OR</span></div>
                    
                    <button type="button" id="google-login" class="btn btn-outline btn-block">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                        Continue with Google
                    </button>

                    <p class="auth-footer">Don't have an account? <a href="#" data-link="signup">Sign Up</a></p>
                </form>
            </div>
        `,

        signup: () => `
            <div class="auth-card animate-fade-in">
                <h2>Join Student Hub</h2>
                <p class="text-muted">Create your profile to start sharing</p>
                <form id="signup-form">
                    <div class="form-group">
                        <label>Display Name</label>
                        <input type="text" name="display_name" class="form-control" required placeholder="CreativeCat">
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" class="form-control" required placeholder="name@school.edu">
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" name="password" class="form-control" required minlength="6" placeholder="••••••••">
                    </div>
                    <input type="hidden" name="role" value="${localStorage.getItem('edtechra_role') || 'student'}">
                    <button type="submit" class="btn btn-primary btn-full">Create Account</button>
                    
                    <div class="divider"><span>OR</span></div>
                    
                    <button type="button" id="google-signup" class="btn btn-outline btn-block">
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                        Sign up with Google
                    </button>

                    <p class="auth-footer">Already have an account? <a href="#" data-link="login">Login</a></p>
                </form>
            </div>
        `,

        onboarding: () => `
            <div class="auth-card onboarding-card animate-fade-in">
                <div class="onboarding-header">
                    <h2>Welcome to EDTECHRA</h2>
                    <p class="text-muted">First, tell us who you are so we can tailor your experience.</p>
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
                <p class="text-center mt-20">Already have a role? <a href="#login">Sign In</a></p>
            </div>
        `
    },

    setupOnboarding() {
        document.querySelectorAll('.role-option-large').forEach(card => {
            card.addEventListener('click', () => {
                const role = card.dataset.role;
                localStorage.setItem('edtechra_role', role);
                UI.showToast(`Selected: ${role.charAt(0).toUpperCase() + role.slice(1)}`, 'success');
                window.location.hash = 'signup';
            });
        });
    },

    setupAuthForms(type) {
        const form = document.querySelector(`#${type}-form`);
        if (!form) return;

        // Google Auth Listener
        const googleBtn = document.getElementById(type === 'login' ? 'google-login' : 'google-signup');
        googleBtn?.addEventListener('click', async () => {
            UI.showLoader();
            // Ensure any role selected is ready for sync after redirect
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
                    localStorage.removeItem('edtechra_role'); // Clean up
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
