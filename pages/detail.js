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
            main.innerHTML = UI.detail(sub, currentUser, userRole);
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

        likeBtn?.addEventListener('click', async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return UI.showToast('Please login to like', 'error');
            const { error } = await supabase.from('likes').insert({
                submission_id: sub.id, user_id: user.id
            });
            if (error) {
                if (error.code === '23505') {
                    await supabase.from('likes').delete().match({ submission_id: sub.id, user_id: user.id });
                    UI.showToast('Unliked');
                } else {
                    UI.showToast(error.message, 'error');
                }
            } else {
                UI.showToast('Liked!', 'success');
            }
        });

        starContainer?.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', async () => {
                const rating = star.dataset.value;
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return UI.showToast('Please login to rate', 'error');
                const { error } = await supabase.from('ratings').upsert({
                    submission_id: sub.id, user_id: user.id, rating: parseInt(rating)
                });
                if (error) UI.showToast(error.message, 'error');
                else UI.showToast('Rated!', 'success');
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
