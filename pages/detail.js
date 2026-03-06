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
            // Step 1: Fetch submission data
            const { data: sub, error } = await supabase
                .from('submissions')
                .select(`
                    *,
                    profiles!author_id (display_name)
                `)
                .eq('id', id)
                .maybeSingle();

            if (error || !sub) {
                console.error('[DETAIL] Failed:', error?.message || 'No data');
                UI.showToast('Submission not found', 'error');
                UI.hideLoader();
                return;
            }

            // Step 2: Handle file path/URL
            if (sub.file_path) {
                const { data } = supabase.storage
                    .from(sub.status === 'approved' ? 'approved_public' : 'submissions_private')
                    .getPublicUrl(sub.file_path);
                sub.public_url = data.publicUrl;
            }

            // Step 3: Initial Render (Show content immediately)
            const currentUser = App.user;
            const userRole = App.profile?.role;
            main.innerHTML = UI.pages.detail(sub, currentUser, userRole);
            this._currentSub = sub;

            // Step 4: Parallelize secondary data (Stats + Like Status)
            console.log('[DETAIL] Fetching secondary stats in parallel...');
            const statsPromise = this.refreshStats(sub.id);
            const likeStatusPromise = this.checkIfLiked(sub.id);

            // Setup static UI elements
            this.setupInteractions(sub);
            this.setupEditButton(sub);
            this.setupFullscreenFab();
            this.setupPreviewFullscreen();

            // Wait for non-critical data
            await Promise.all([statsPromise, likeStatusPromise]);

            UI.hideLoader();
            console.log('[DETAIL] ✅ Fully Loaded');

            // Clean up fullscreen state on navigation
            window.addEventListener('hashchange', () => {
                document.body.classList.remove('body-no-scroll');
                document.querySelectorAll('.fullscreen-active').forEach(el => {
                    el.classList.remove('fullscreen-active');
                });
            }, { once: true });

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
            const user = App.user;
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
                const user = App.user;
                if (!user) return UI.showToast('Please login to rate', 'error');

                UI.showLoader();
                const { error } = await supabase.from('ratings').upsert({
                    submission_id: sub.id, user_id: user.id, rating: parseInt(rating)
                }, { onConflict: 'submission_id,user_id' });

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
            const user = App.user;
            await supabase.from('downloads').insert({
                submission_id: sub.id, user_id: user?.id || null
            });
            window.open(sub.public_url, '_blank');
        });
    },

    async checkIfLiked(subId) {
        const likeBtn = document.getElementById('like-btn');
        if (!likeBtn) return;

        const user = App.user;
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
                const user = App.user;
                if (!user) return UI.showToast('Please login to rate', 'error');

                UI.showLoader();
                const { error } = await supabase.from('ratings').upsert({
                    submission_id: sub.id, user_id: user.id, rating: parseInt(rating)
                }, { onConflict: 'submission_id,user_id' });

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
            let likeCount = 0;
            let avgRating = 0;

            // Count likes directly
            const { count: lCount, error: likeErr } = await supabase
                .from('likes')
                .select('id', { count: 'exact', head: true })
                .eq('submission_id', subId);

            if (!likeErr && lCount !== null) {
                likeCount = lCount;
            }

            // Calculate average rating directly
            const { data: ratings, error: rateErr } = await supabase
                .from('ratings')
                .select('rating')
                .eq('submission_id', subId);

            if (!rateErr && ratings && ratings.length > 0) {
                const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
                avgRating = sum / ratings.length;
            }

            // Update like count in UI
            const likeCountSpan = document.getElementById('like-count');
            if (likeCountSpan) likeCountSpan.textContent = likeCount;

            // Update average rating display
            const avgRatingSpan = document.getElementById('avg-rating');
            if (avgRatingSpan) avgRatingSpan.textContent = `(${avgRating.toFixed(1)})`;

            // Update star visual AND re-attach listeners
            const starContainer = document.getElementById('rating-stars');
            if (starContainer && avgRating > 0) {
                starContainer.innerHTML = UI.renderStars(Math.round(avgRating));
                // Re-attach click listeners so ratings keep working
                if (this._currentSub) {
                    this.attachStarListeners(starContainer, this._currentSub);
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
