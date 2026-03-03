// pages/detail.js
import { supabase } from '../assets/js/supabase.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';

export const DetailPage = {
    async init(id) {
        const main = document.getElementById('main-content');
        console.log('[DETAIL] init called with id:', id);
        UI.showLoader();

        try {
            const { data: sub, error } = await supabase
                .from('submissions')
                .select(`
                    *,
                    profiles!author_id (display_name)
                `)
                .eq('id', id)
                .maybeSingle();

            console.log('[DETAIL] Query result:', { sub, error });

            if (error || !sub) {
                console.error('[DETAIL] Failed:', error?.message || 'No data');
                UI.showToast('Submission not found', 'error');
                UI.hideLoader();
                return;
            }

            if (sub.file_path) {
                const { data } = supabase.storage
                    .from(sub.status === 'approved' ? 'approved_public' : 'submissions_private')
                    .getPublicUrl(sub.file_path);
                sub.public_url = data.publicUrl;
            }

            const currentUser = App.user;
            const userRole = App.profile?.role;
            main.innerHTML = UI.pages.detail(sub, currentUser, userRole);
            this.setupInteractions(sub);
            this.setupEditButton(sub);
            this.setupFullscreenFab();
            this.setupPreviewFullscreen();
            UI.hideLoader();
            console.log('[DETAIL] ✅ Loaded');
        } catch (err) {
            console.error('[DETAIL] ❌ Error:', err);
            main.innerHTML = `<div style="padding:2rem;text-align:center"><h2>Error loading</h2><p>${err.message}</p></div>`;
            UI.hideLoader();
        }
    },

    setupPreviewFullscreen() {
        const btn = document.getElementById('previewFullscreenBtn');
        const container = document.getElementById('previewContainer');
        if (!btn || !container) return;

        const toggleFullscreen = () => {
            const isFullscreen = container.classList.toggle('fullscreen-active');
            document.body.classList.toggle('body-no-scroll', isFullscreen);

            // Update button UI
            btn.innerHTML = isFullscreen
                ? '<span>✕ Close</span>'
                : '<span>⛶ Fullscreen</span>';

            if (isFullscreen) {
                UI.showToast('Immersive mode active (ESC to exit)');
                // Focus the button so ESC works even if the user clicks inside the container
                btn.focus();
            }
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFullscreen();
        });

        // ESC key to exit
        const escHandler = (e) => {
            if (e.key === 'Escape' && container.classList.contains('fullscreen-active')) {
                toggleFullscreen();
            }
        };

        // Use window listener for broader coverage
        window.addEventListener('keydown', escHandler);
    },

    setupInteractions(sub) {
        const likeBtn = document.getElementById('like-btn');
        const starContainer = document.getElementById('rating-stars');
        const downloadBtn = document.getElementById('download-btn');
        const likeCountSpan = document.getElementById('like-count');

        // Check if already liked and update UI
        this.checkIfLiked(sub.id, likeBtn);

        likeBtn?.addEventListener('click', async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return UI.showToast('Please login to like', 'error');

            UI.showLoader();
            const { error } = await supabase.from('likes').insert({
                submission_id: sub.id, user_id: user.id
            });

            if (error) {
                if (error.code === '23505') { // Unique constraint violation (already liked)
                    await supabase.from('likes').delete().match({ submission_id: sub.id, user_id: user.id });
                    likeBtn.classList.remove('liked');
                    UI.showToast('Unliked');
                } else {
                    UI.showToast(error.message, 'error');
                }
            } else {
                likeBtn.classList.add('liked');
                UI.showToast('Liked!', 'success');
            }

            // Refresh counts
            this.refreshStats(sub.id);
            UI.hideLoader();
        });

        starContainer?.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', async () => {
                const rating = star.dataset.value;
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return UI.showToast('Please login to rate', 'error');

                UI.showLoader();
                const { error } = await supabase.from('ratings').upsert({
                    submission_id: sub.id, user_id: user.id, rating: parseInt(rating)
                });

                if (error) {
                    UI.showToast(error.message, 'error');
                } else {
                    UI.showToast('Rated!', 'success');
                    // Update star display and re-attach listeners
                    starContainer.innerHTML = UI.renderStars(rating);
                    this.attachStarListeners(starContainer, sub);
                    // Refresh stats from DB
                    this.refreshStats(sub.id);
                }
                UI.hideLoader();
            });
        });

        downloadBtn?.addEventListener('click', async () => {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('downloads').insert({
                submission_id: sub.id, user_id: user?.id || null
            });
            window.open(sub.public_url, '_blank');
        });
    },

    async checkIfLiked(subId, btn) {
        if (!btn) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase.from('likes').select('id').match({
            submission_id: subId, user_id: user.id
        }).maybeSingle();

        if (data) btn.classList.add('liked');
    },

    // Re-attach star click listeners after re-rendering stars
    attachStarListeners(container, sub) {
        container?.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', async () => {
                const rating = star.dataset.value;
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return UI.showToast('Please login to rate', 'error');

                UI.showLoader();
                const { error } = await supabase.from('ratings').upsert({
                    submission_id: sub.id, user_id: user.id, rating: parseInt(rating)
                });

                if (error) {
                    UI.showToast(error.message, 'error');
                } else {
                    UI.showToast('Rated!', 'success');
                    container.innerHTML = UI.renderStars(rating);
                    this.attachStarListeners(container, sub);
                    this.refreshStats(sub.id);
                }
                UI.hideLoader();
            });
        });
    },

    async refreshStats(subId) {
        try {
            const { data } = await supabase.from('submission_stats').select('*').eq('id', subId).maybeSingle();
            if (data) {
                // Update like count
                const likeCountSpan = document.getElementById('like-count');
                if (likeCountSpan) likeCountSpan.textContent = data.like_count || 0;

                // Update average rating display
                const avgRatingSpan = document.getElementById('avg-rating');
                if (avgRatingSpan) avgRatingSpan.textContent = `(${(data.avg_rating || 0).toFixed(1)})`;

                // Update star visual
                const starContainer = document.getElementById('rating-stars');
                if (starContainer && data.avg_rating) {
                    starContainer.innerHTML = UI.renderStars(Math.round(data.avg_rating));
                }
            }
        } catch (err) {
            console.error('[DETAIL] refreshStats error:', err);
        }
    },

    setupEditButton(sub) {
        const editBtn = document.getElementById('edit-btn');
        editBtn?.addEventListener('click', () => {
            window.location.hash = `edit/${sub.id}`;
        });
    },

    // ==========================================
    // FULLSCREEN FAB — Same system as Edectra Tech Live Quiz
    // Uses document.documentElement.requestFullscreen()
    // ==========================================
    setupFullscreenFab() {
        const fab = document.getElementById('fullscreenFab');
        if (!fab) return;

        fab.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => { });
                fab.textContent = '\u2715';
            } else {
                document.exitFullscreen().catch(() => { });
                fab.textContent = '\u26F6';
            }
        });

        document.addEventListener('fullscreenchange', () => {
            fab.textContent = document.fullscreenElement ? '\u2715' : '\u26F6';
        });
    }
};
