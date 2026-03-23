// pages/detail.js
import { supabase } from '../assets/js/supabase.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';
import API from '../assets/js/api.js';
import { AudioPlayer } from '../assets/js/audio-player.js';

export const DetailPage = {
    async init(id) {
        const main = document.getElementById('main-content');
        console.log('[DETAIL] init called with id:', id);
        UI.showLoader();
        this._audioPlayer?.destroy();
        this._audioPlayer = null;
        this.teardownPdfViewer();

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

            const currentUser = App.user;
            const userRole = App.profile?.role;
            const canViewUnapproved = currentUser && (currentUser.id === sub.author_id || userRole === 'admin');

            if (sub.status !== 'approved' && !canViewUnapproved) {
                console.warn('[DETAIL] Blocked non-approved submission for public viewer:', id);
                UI.showToast('Submission not found', 'error');
                UI.hideLoader();
                window.location.hash = 'explore';
                return;
            }

            // Step 2: Handle file path/URL
            if (sub.storage_provider === 'r2') {
                if (sub.content_type === 'image') {
                    sub.public_url = sub.image_url || sub.file_url || sub.public_url || null;
                    if (!sub.thumbnail_url) {
                        sub.thumbnail_url = sub.image_url || sub.file_url || null;
                    }
                } else {
                    sub.public_url = sub.file_url || (sub.file_path?.startsWith?.('http') ? sub.file_path : null);
                }
            } else if (sub.content_type === 'image' && sub.status !== 'approved') {
                if (sub.file_path) {
                    const { data, error: signedError } = await supabase.storage
                        .from('submissions_private')
                        .createSignedUrl(sub.file_path, 3600);
                    if (!signedError) {
                        sub.public_url = data.signedUrl;
                    }
                }

                if (!sub.thumbnail_url && sub.thumbnail_path) {
                    const { data, error: thumbSignedError } = await supabase.storage
                        .from('submissions_private')
                        .createSignedUrl(sub.thumbnail_path, 3600);
                    if (!thumbSignedError) {
                        sub.thumbnail_url = data.signedUrl;
                    }
                }
            } else if (sub.file_path) {
                const { data } = supabase.storage
                    .from(sub.status === 'approved' ? 'approved_public' : 'submissions_private')
                    .getPublicUrl(sub.file_path);
                sub.public_url = data.publicUrl;
            }

            // Step 3: Initial Render (Show content immediately)
            sub.initialViewCount = Number(sub.submission_stats?.[0]?.view_count || 0);
            main.innerHTML = UI.pages.detail(sub, currentUser, userRole);
            this._currentSub = sub;

            // Step 4: Parallelize secondary data (Stats + Like Status)
            console.log('[DETAIL] Fetching secondary stats in parallel...');
            const statsPromise = this.refreshStats(sub.id);
            const likeStatusPromise = this.checkIfLiked(sub.id);

            // Setup static UI elements
            this.setupAudioPlayer(sub);
            this.setupInteractions(sub);
            this.setupPdfViewer(sub);
            this.setupEditButton(sub);
            this.setupPreviewFullscreen();
            this.setupBookmark(sub);

            // Check for ?fullscreen=true in URL
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('fullscreen') === 'true') {
                setTimeout(() => {
                    const btn = document.getElementById('previewFullscreenBtn');
                    if (btn) btn.click();
                }, 500); // Small delay to ensure render is complete
            }

            // Record a view immediately for non-audio content only.
            if (!this.isAudioSubmission(sub)) {
                this.recordView(sub.id);
            }

            // Wait for non-critical data
            await Promise.all([statsPromise, likeStatusPromise]);

            UI.hideLoader();
            console.log('[DETAIL] ✅ Fully Loaded');

            // Clean up fullscreen state on navigation
            window.addEventListener('hashchange', () => {
                this._audioPlayer?.destroy();
                this._audioPlayer = null;
                this.teardownPdfViewer();
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

    setupAudioPlayer(sub) {
        const mount = document.getElementById('audioPlayerMount');
        if (!mount || !this.isAudioSubmission(sub)) {
            return;
        }

        this._audioPlayer?.destroy();
        this._audioPlayer = new AudioPlayer(mount, sub, {
            onPlaybackStart: async () => {
                await this.recordView(sub.id);
            }
        });
        this._audioPlayer.init();
    },

    isAudioSubmission(sub = {}) {
        return sub.content_type === 'audio' || sub.file_type?.startsWith?.('audio/');
    },

    ensureSubmissionStats(sub = this._currentSub) {
        if (!sub) return { avg_rating: 0, like_count: 0, view_count: 0 };
        if (!Array.isArray(sub.submission_stats) || sub.submission_stats.length === 0) {
            sub.submission_stats = [{ avg_rating: 0, like_count: 0, view_count: 0 }];
        }
        return sub.submission_stats[0];
    },

    applyAverageRatingToUi(avgRating, sub = this._currentSub) {
        const stats = this.ensureSubmissionStats(sub);
        stats.avg_rating = UI.getAverageRatingValue(avgRating);

        const avgRatingSpan = document.getElementById('avg-rating');
        if (avgRatingSpan) {
            avgRatingSpan.textContent = `(${UI.formatAverageRating(stats.avg_rating)})`;
        }

        const starContainer = document.getElementById('rating-stars');
        if (starContainer) {
            starContainer.innerHTML = UI.renderStars(stats.avg_rating);
            this.attachStarListeners(starContainer, sub);
        }
    },

    incrementViewCountDisplays(delta = 1, sub = this._currentSub) {
        const increment = Math.max(0, Number(delta) || 0);
        if (!increment) return;

        const stats = this.ensureSubmissionStats(sub);
        stats.view_count = Math.max(0, Number(stats.view_count || 0) + increment);

        const nextCount = String(stats.view_count);
        const viewCountSpan = document.getElementById('view-count');
        if (viewCountSpan) viewCountSpan.textContent = nextCount;

        const audioViewCountSpan = document.getElementById('audio-player-view-count');
        if (audioViewCountSpan) audioViewCountSpan.textContent = nextCount;
    },

    async submitRating(sub, ratingValue) {
        const user = App.user;
        if (!user) {
            UI.showToast('Please login to rate', 'error');
            return;
        }

        UI.showLoader();
        try {
            const { data, error } = await API.rateSubmission(sub.id, user.id, ratingValue);
            if (error || !data) {
                UI.showToast(error?.message || 'Could not save rating.', 'error');
                return;
            }

            this.applyAverageRatingToUi(data.avgRating, sub);
            UI.showToast('Rated!', 'success');
        } finally {
            UI.hideLoader();
        }
    },

    async ensurePdfJsLoaded() {
        if (window.pdfjsLib) {
            return window.pdfjsLib;
        }

        if (!this._pdfJsLoadPromise) {
            this._pdfJsLoadPromise = new Promise((resolve, reject) => {
                const existingScript = document.querySelector('script[data-pdfjs-lib="true"]');
                if (existingScript) {
                    existingScript.addEventListener('load', () => resolve(window.pdfjsLib));
                    existingScript.addEventListener('error', () => reject(new Error('PDF viewer script failed to load.')));
                    return;
                }

                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                script.async = true;
                script.dataset.pdfjsLib = 'true';
                script.onload = () => resolve(window.pdfjsLib);
                script.onerror = () => reject(new Error('PDF viewer script failed to load.'));
                document.head.appendChild(script);
            }).then((pdfjsLib) => {
                if (!pdfjsLib) {
                    throw new Error('PDF viewer is unavailable.');
                }

                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                return pdfjsLib;
            });
        }

        return this._pdfJsLoadPromise;
    },

    async setupPdfViewer(sub) {
        const root = document.getElementById('pdfViewerRoot');
        if (!root) return;

        const stage = document.getElementById('pdfStage');
        const canvas = document.getElementById('pdfCanvas');
        const loading = document.getElementById('pdfLoading');
        const fallback = document.getElementById('pdfFallback');
        const presentBtn = document.getElementById('pdfPresentBtn');
        const prevBtn = document.getElementById('pdfPrevBtn');
        const nextBtn = document.getElementById('pdfNextBtn');
        const zoomOutBtn = document.getElementById('pdfZoomOutBtn');
        const zoomInBtn = document.getElementById('pdfZoomInBtn');
        const fitBtn = document.getElementById('pdfFitBtn');
        const exitBtn = document.getElementById('pdfExitPresentBtn');
        const overlayPrevBtn = document.getElementById('pdfOverlayPrevBtn');
        const overlayNextBtn = document.getElementById('pdfOverlayNextBtn');
        const pageIndicator = document.getElementById('pdfPageIndicator');
        const overlayIndicator = document.getElementById('pdfOverlayPageIndicator');
        const overlayControls = document.getElementById('pdfPresentOverlayControls');

        if (!root || !stage || !canvas || !loading || !fallback || !presentBtn) return;

        const state = {
            sub,
            root,
            stage,
            canvas,
            loading,
            fallback,
            presentBtn,
            prevBtn,
            nextBtn,
            zoomOutBtn,
            zoomInBtn,
            fitBtn,
            exitBtn,
            overlayPrevBtn,
            overlayNextBtn,
            pageIndicator,
            overlayIndicator,
            overlayControls,
            fileUrl: root.dataset.pdfUrl || sub.public_url || sub.file_url || null,
            pdfDoc: null,
            renderTask: null,
            currentPage: 1,
            pageCount: 0,
            zoomFactor: 1,
            isPresenting: false,
            usingNativeFullscreen: false,
            controlsHideTimer: null,
            ready: false
        };

        this._pdfViewerState = state;

        const setControlsEnabled = (enabled) => {
            [presentBtn, prevBtn, nextBtn, zoomOutBtn, zoomInBtn, fitBtn, exitBtn, overlayPrevBtn, overlayNextBtn]
                .filter(Boolean)
                .forEach((button) => {
                    button.disabled = !enabled;
                });
        };

        setControlsEnabled(false);
        presentBtn.classList.add('hidden');

        try {
            const pdfjsLib = await this.ensurePdfJsLoaded();
            if (this._pdfViewerState !== state || !state.fileUrl) return;

            const loadingTask = pdfjsLib.getDocument({
                url: state.fileUrl,
                withCredentials: false
            });
            state.loadingTask = loadingTask;

            const pdfDoc = await loadingTask.promise;
            if (this._pdfViewerState !== state) return;

            state.pdfDoc = pdfDoc;
            state.pageCount = pdfDoc.numPages || 1;
            state.ready = true;

            const renderPage = async ({ fitMode = state.isPresenting ? 'page' : 'width', force = false } = {}) => {
                if (!state.ready || !state.pdfDoc) return;

                const stageRect = state.stage.getBoundingClientRect();
                if (!force && (stageRect.width < 40 || stageRect.height < 40)) return;

                const page = await state.pdfDoc.getPage(state.currentPage);
                if (state.renderTask) {
                    try {
                        state.renderTask.cancel();
                    } catch (_) {
                        // Ignore render cancellation noise.
                    }
                }

                const unscaledViewport = page.getViewport({ scale: 1 });
                const widthPadding = state.isPresenting ? 48 : 40;
                const heightPadding = state.isPresenting ? 48 : 24;
                const fitWidthScale = Math.max(0.25, (stageRect.width - widthPadding) / unscaledViewport.width);
                const fitPageScale = Math.max(0.25, Math.min(
                    (stageRect.width - widthPadding) / unscaledViewport.width,
                    (stageRect.height - heightPadding) / unscaledViewport.height
                ));
                const scale = state.isPresenting
                    ? fitPageScale
                    : (fitMode === 'page' ? fitPageScale : fitWidthScale * state.zoomFactor);

                const viewport = page.getViewport({ scale });
                const outputScale = window.devicePixelRatio || 1;
                const context = state.canvas.getContext('2d', { alpha: false });

                state.canvas.width = Math.floor(viewport.width * outputScale);
                state.canvas.height = Math.floor(viewport.height * outputScale);
                state.canvas.style.width = `${viewport.width}px`;
                state.canvas.style.height = `${viewport.height}px`;
                context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
                context.imageSmoothingEnabled = true;
                context.clearRect(0, 0, state.canvas.width, state.canvas.height);

                state.renderTask = page.render({
                    canvasContext: context,
                    viewport
                });

                try {
                    await state.renderTask.promise;
                } catch (error) {
                    if (error?.name !== 'RenderingCancelledException') {
                        throw error;
                    }
                }

                state.loading.classList.add('hidden');
                state.fallback.classList.add('hidden');
                state.canvas.classList.remove('hidden');
                state.stage.focus({ preventScroll: true });
            };

            const updateIndicators = () => {
                const label = `Page ${state.currentPage} / ${state.pageCount || '--'}`;
                if (state.pageIndicator) state.pageIndicator.textContent = label;
                if (state.overlayIndicator) state.overlayIndicator.textContent = label;
                if (state.prevBtn) state.prevBtn.disabled = state.currentPage <= 1;
                if (state.nextBtn) state.nextBtn.disabled = state.currentPage >= state.pageCount;
                if (state.overlayPrevBtn) state.overlayPrevBtn.disabled = state.currentPage <= 1;
                if (state.overlayNextBtn) state.overlayNextBtn.disabled = state.currentPage >= state.pageCount;
            };

            const goToPage = async (pageNumber) => {
                if (!state.ready) return;
                const nextPage = Math.max(1, Math.min(state.pageCount, Number(pageNumber) || 1));
                if (nextPage === state.currentPage) return;
                state.currentPage = nextPage;
                updateIndicators();
                await renderPage();
            };

            const syncPresentUi = () => {
                state.root.classList.toggle('pdf-present-active', state.isPresenting);
                state.overlayControls?.classList.toggle('hidden', !state.isPresenting);
                state.presentBtn?.classList.toggle('hidden', !state.ready || state.isPresenting);
                state.root.classList.toggle('presenter-controls-visible', state.isPresenting);
                document.body.classList.toggle('body-no-scroll', state.isPresenting);
            };

            const clearControlsHideTimer = () => {
                if (state.controlsHideTimer) {
                    window.clearTimeout(state.controlsHideTimer);
                    state.controlsHideTimer = null;
                }
            };

            const scheduleControlsHide = () => {
                clearControlsHideTimer();
                if (!state.isPresenting) return;

                state.controlsHideTimer = window.setTimeout(() => {
                    if (!state.isPresenting) return;
                    state.root.classList.remove('presenter-controls-visible');
                }, 2200);
            };

            const revealPresentControls = () => {
                if (!state.isPresenting) return;
                state.root.classList.add('presenter-controls-visible');
                scheduleControlsHide();
            };

            const exitPresentMode = async ({ skipFullscreenExit = false } = {}) => {
                if (!state.isPresenting) return;

                state.isPresenting = false;
                clearControlsHideTimer();
                syncPresentUi();

                if (!skipFullscreenExit && document.fullscreenElement === state.root && document.exitFullscreen) {
                    try {
                        await document.exitFullscreen();
                    } catch (_) {
                        // Ignore fullscreen exit failures and fall back to overlay cleanup.
                    }
                }

                await renderPage({ force: true, fitMode: 'width' });
            };

            const enterPresentMode = async () => {
                if (!state.ready || state.isPresenting) return;

                state.isPresenting = true;
                syncPresentUi();
                await renderPage({ force: true, fitMode: 'page' });
                revealPresentControls();

                if (state.root.requestFullscreen) {
                    try {
                        await state.root.requestFullscreen();
                        state.usingNativeFullscreen = document.fullscreenElement === state.root;
                    } catch (_) {
                        state.usingNativeFullscreen = false;
                    }
                }
            };

            state.renderPage = renderPage;
            state.goToPage = goToPage;
            state.enterPresentMode = enterPresentMode;
            state.exitPresentMode = exitPresentMode;
            state.updateIndicators = updateIndicators;
            state.revealPresentControls = revealPresentControls;

            const attachClick = (element, handler) => {
                if (!element) return;
                element.addEventListener('click', handler);
            };

            attachClick(prevBtn, () => goToPage(state.currentPage - 1));
            attachClick(nextBtn, () => goToPage(state.currentPage + 1));
            attachClick(overlayPrevBtn, () => goToPage(state.currentPage - 1));
            attachClick(overlayNextBtn, () => goToPage(state.currentPage + 1));
            attachClick(zoomOutBtn, async () => {
                if (state.isPresenting) return;
                state.zoomFactor = Math.max(0.6, Number((state.zoomFactor - 0.15).toFixed(2)));
                await renderPage({ force: true, fitMode: 'width' });
            });
            attachClick(zoomInBtn, async () => {
                if (state.isPresenting) return;
                state.zoomFactor = Math.min(2.4, Number((state.zoomFactor + 0.15).toFixed(2)));
                await renderPage({ force: true, fitMode: 'width' });
            });
            attachClick(fitBtn, async () => {
                state.zoomFactor = 1;
                await renderPage({ force: true, fitMode: state.isPresenting ? 'page' : 'width' });
            });
            attachClick(presentBtn, () => enterPresentMode());
            attachClick(exitBtn, () => exitPresentMode());

            state.keydownHandler = async (event) => {
                if (!state.isPresenting) return;

                revealPresentControls();

                if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
                    event.preventDefault();
                    await goToPage(state.currentPage + 1);
                    return;
                }

                if (['ArrowLeft', 'PageUp'].includes(event.key)) {
                    event.preventDefault();
                    await goToPage(state.currentPage - 1);
                    return;
                }

                if (event.key === 'Home') {
                    event.preventDefault();
                    await goToPage(1);
                    return;
                }

                if (event.key === 'End') {
                    event.preventDefault();
                    await goToPage(state.pageCount);
                    return;
                }

                if (event.key === 'Escape') {
                    event.preventDefault();
                    await exitPresentMode();
                }
            };

            state.resizeHandler = () => {
                if (!state.ready) return;
                renderPage({ force: true, fitMode: state.isPresenting ? 'page' : 'width' });
            };

            state.presenterInteractionHandler = () => {
                revealPresentControls();
            };

            state.fullscreenChangeHandler = () => {
                if (this._pdfViewerState !== state) return;

                if (document.fullscreenElement === state.root) {
                    state.usingNativeFullscreen = true;
                    return;
                }

                if (state.isPresenting && state.usingNativeFullscreen) {
                    state.usingNativeFullscreen = false;
                    exitPresentMode({ skipFullscreenExit: true });
                }
            };

            document.addEventListener('keydown', state.keydownHandler);
            document.addEventListener('mousemove', state.presenterInteractionHandler);
            document.addEventListener('touchstart', state.presenterInteractionHandler, { passive: true });
            document.addEventListener('touchmove', state.presenterInteractionHandler, { passive: true });
            document.addEventListener('focusin', state.presenterInteractionHandler);
            window.addEventListener('resize', state.resizeHandler);
            document.addEventListener('fullscreenchange', state.fullscreenChangeHandler);

            updateIndicators();
            setControlsEnabled(true);
            presentBtn.classList.remove('hidden');
            await renderPage({ force: true, fitMode: 'width' });
        } catch (error) {
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                console.warn('[DETAIL] PDF viewer unavailable:', error);
            }

            if (this._pdfViewerState !== state) return;

            loading.classList.add('hidden');
            canvas.classList.add('hidden');
            fallback.classList.remove('hidden');
            presentBtn.classList.add('hidden');
            document.body.classList.remove('body-no-scroll');
        }
    },

    teardownPdfViewer() {
        const state = this._pdfViewerState;
        if (!state) return;

        if (state.renderTask) {
            try {
                state.renderTask.cancel();
            } catch (_) {
                // Ignore render cancellation noise.
            }
        }

        if (state.loadingTask?.destroy) {
            try {
                state.loadingTask.destroy();
            } catch (_) {
                // Ignore PDF task destroy failures during teardown.
            }
        }

        if (state.keydownHandler) {
            document.removeEventListener('keydown', state.keydownHandler);
        }

        if (state.resizeHandler) {
            window.removeEventListener('resize', state.resizeHandler);
        }

        if (state.fullscreenChangeHandler) {
            document.removeEventListener('fullscreenchange', state.fullscreenChangeHandler);
        }

        if (state.presenterInteractionHandler) {
            document.removeEventListener('mousemove', state.presenterInteractionHandler);
            document.removeEventListener('touchstart', state.presenterInteractionHandler);
            document.removeEventListener('touchmove', state.presenterInteractionHandler);
            document.removeEventListener('focusin', state.presenterInteractionHandler);
        }

        if (state.controlsHideTimer) {
            window.clearTimeout(state.controlsHideTimer);
        }

        if (document.fullscreenElement === state.root && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }

        document.body.classList.remove('body-no-scroll');
        this._pdfViewerState = null;
    },

    setupPreviewFullscreen() {
        const btn = document.getElementById('previewFullscreenBtn');
        const container = document.getElementById('previewContainer');
        const floatingClose = document.getElementById('floatingCloseBtn');
        if (!btn || !container) return;

        const toggleFullscreen = () => {
            const isFullscreen = container.classList.toggle('fullscreen-active');
            document.body.classList.toggle('body-no-scroll', isFullscreen);

            // Update button UI
            btn.innerHTML = isFullscreen
                ? '<span>✕ Close</span>'
                : '<span>⛶ Fullscreen</span>';

            if (isFullscreen) {
                UI.showToast('Immersive mode — tap Cancel to exit.');
                btn.focus();
            }
        };

        const clickHandler = (e) => {
            e.stopPropagation();
            toggleFullscreen();
        };

        btn.addEventListener('click', clickHandler);
        floatingClose?.addEventListener('click', clickHandler);

        // Listen for scroll messages from iframe
        if (!this._windowListenersAttached) {
            window.addEventListener('message', (e) => {
                const container = document.getElementById('previewContainer');
                if (!container || !container.classList.contains('fullscreen-active')) return;
                const closeBtn = document.getElementById('floatingCloseBtn');
                if (!closeBtn) return;

                if (e.data?.type === 'SHOW_CLOSE_BTN') closeBtn.classList.add('visible');
                if (e.data?.type === 'HIDE_CLOSE_BTN') closeBtn.classList.remove('visible');
            });

            // ESC key to exit
            window.addEventListener('keydown', (e) => {
                const container = document.getElementById('previewContainer');
                if (e.key === 'Escape' && container?.classList.contains('fullscreen-active')) {
                    const isFullscreen = container.classList.toggle('fullscreen-active');
                    document.body.classList.toggle('body-no-scroll', isFullscreen);
                    const btn = document.getElementById('previewFullscreenBtn');
                    if (btn) {
                        btn.innerHTML = '<span>⛶ Fullscreen</span>';
                    }
                }
            });
            this._windowListenersAttached = true;
        }
    },

    setupInteractions(sub) {
        const likeBtn = document.getElementById('like-btn');
        const starContainer = document.getElementById('rating-stars');
        const downloadBtn = document.getElementById('download-btn');

        likeBtn?.addEventListener('click', async () => {
            const user = App.user;
            if (!user) return UI.showToast('Please login to like', 'error');

            UI.showLoader();
            const { error } = await supabase.from('likes').insert({
                submission_id: sub.id, user_id: user.id
            });

            const likeCountSpan = document.getElementById('like-count');

            if (error) {
                if (error.code === '23505') { // Unique constraint violation (already liked)
                    await supabase.from('likes').delete().match({ submission_id: sub.id, user_id: user.id });
                    likeBtn.classList.remove('liked');
                    UI.showToast('Unliked');
                    if (likeCountSpan) likeCountSpan.textContent = Math.max(0, parseInt(likeCountSpan.textContent || 0) - 1);
                } else {
                    UI.showToast(error.message, 'error');
                }
            } else {
                likeBtn.classList.add('liked');
                UI.showToast('Liked!', 'success');
                if (likeCountSpan) likeCountSpan.textContent = parseInt(likeCountSpan.textContent || 0) + 1;
            }

            UI.hideLoader();
        });

        this.attachStarListeners(starContainer, sub);

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

        if (data) likeBtn.classList.add('liked');
    },

    // Re-attach star click listeners after re-rendering stars
    attachStarListeners(container, sub) {
        container?.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', async () => {
                await this.submitRating(sub, star.dataset.value);
            });
        });
    },

    async refreshStats(subId) {
        try {
            let likeCount = 0;
            const stats = this.ensureSubmissionStats(this._currentSub);
            let avgRating = 0;
            let viewCount = 0;

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

            // Count views
            const { count: vCount, error: viewErr } = await supabase
                .from('views')
                .select('id', { count: 'exact', head: true })
                .eq('submission_id', subId);

            if (!viewErr && vCount !== null) {
                viewCount = vCount;
            }

            // Update like count in UI
            const likeCountSpan = document.getElementById('like-count');
            stats.like_count = likeCount;
            if (likeCountSpan) likeCountSpan.textContent = likeCount;

            // Update average rating display
            const avgRatingSpan = document.getElementById('avg-rating');
            if (avgRatingSpan) avgRatingSpan.textContent = `(${UI.formatAverageRating(avgRating)})`;

            // Update view count display
            const viewCountSpan = document.getElementById('view-count');
            stats.avg_rating = avgRating;
            stats.view_count = viewCount;
            if (viewCountSpan) viewCountSpan.textContent = viewCount;
            const audioViewCountSpan = document.getElementById('audio-player-view-count');
            if (audioViewCountSpan) audioViewCountSpan.textContent = viewCount;

            // Update star visual AND re-attach listeners
            const starContainer = document.getElementById('rating-stars');
            if (starContainer) {
                starContainer.innerHTML = UI.renderStars(avgRating);
                if (this._currentSub) {
                    this.attachStarListeners(starContainer, this._currentSub);
                }
            }
        } catch (err) {
            console.error('[DETAIL] refreshStats error:', err);
        }
    },


    async recordView(subId) {
        try {
            const viewerId = App.user ? App.user.id : null;

            // Insert view record
            const { error } = await supabase
                .from('views')
                .insert({
                    submission_id: subId,
                    viewer_id: viewerId
                });

            if (error) {
                console.warn('[DETAIL] Failed to record view:', error);
                return false;
            } else {
                console.log('[DETAIL] View recorded successfully');
                this.incrementViewCountDisplays(1);
                return true;
            }
        } catch (err) {
            console.error('[DETAIL] recordView error:', err);
            return false;
        }
    },

    setupEditButton(sub) {
        const editBtn = document.getElementById('edit-btn');
        editBtn?.addEventListener('click', () => {
            window.location.hash = `edit/${sub.id}`;
        });
    },

    // ==========================================
    // BOOKMARK / SAVE FEATURE
    // ==========================================
    async setupBookmark(sub) {
        const bookmarkBtn = document.getElementById('bookmark-btn');
        if (!bookmarkBtn) return;

        const user = App.user;
        if (!user) {
            bookmarkBtn.addEventListener('click', () => {
                UI.showToast('Please login to save works', 'error');
            });
            return;
        }

        // Check if already bookmarked
        let isBookmarked = false;
        try {
            const { data } = await supabase
                .from('bookmarks')
                .select('id')
                .match({ submission_id: sub.id, user_id: user.id })
                .maybeSingle();

            if (data) {
                isBookmarked = true;
                bookmarkBtn.classList.add('bookmarked');
                bookmarkBtn.querySelector('span:last-child').textContent = 'Saved';
            }
        } catch (err) {
            console.warn('[DETAIL] Bookmark check error:', err);
        }

        bookmarkBtn.addEventListener('click', async () => {
            if (isBookmarked) {
                // Remove bookmark
                const { error } = await supabase
                    .from('bookmarks')
                    .delete()
                    .match({ submission_id: sub.id, user_id: user.id });

                if (!error) {
                    isBookmarked = false;
                    bookmarkBtn.classList.remove('bookmarked');
                    bookmarkBtn.querySelector('span:last-child').textContent = 'Save';
                    UI.showToast('Removed from saved', 'info');
                } else {
                    UI.showToast('Could not remove bookmark', 'error');
                }
            } else {
                // Add bookmark
                const { error } = await supabase
                    .from('bookmarks')
                    .insert({ submission_id: sub.id, user_id: user.id });

                if (!error) {
                    isBookmarked = true;
                    bookmarkBtn.classList.add('bookmarked');
                    bookmarkBtn.querySelector('span:last-child').textContent = 'Saved';
                    UI.showToast('Saved to your collection!', 'success');
                } else if (error.code === '23505') {
                    // Already bookmarked (unique constraint)
                    isBookmarked = true;
                    bookmarkBtn.classList.add('bookmarked');
                    bookmarkBtn.querySelector('span:last-child').textContent = 'Saved';
                } else {
                    UI.showToast('Could not save. Run create_bookmarks.sql first.', 'error');
                }
            }
        });
    },

};
