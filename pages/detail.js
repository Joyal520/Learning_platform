// pages/detail.js
import { supabase } from '../assets/js/supabase.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';
import { API } from '../assets/js/api.js';
import { AudioPlayer } from '../assets/js/audio-player.js';
import {
    PRESENTATION_POINTER_HIDE_MS,
    PRESENTATION_REMOTE_HEARTBEAT_MS,
    buildRemoteJoinUrl,
    cleanupExpiredPresentationSessions,
    createCommandSubscription,
    createPresentationRemoteSession,
    createSessionSubscription,
    deletePresentationRemoteSession,
    getSpeakerNoteForSlide,
    normalizePresentationNotes,
    refreshPresentationRemoteSession,
    removeChannel
} from '../assets/js/presentation-remote.js';

const DEBUG_LOGS = false;
const debugLog = (...args) => { if (DEBUG_LOGS) console.log(...args); };

export const DetailPage = {
    _exploreRestoreFlagKey: 'edtechra_explore_restore_once',

    async init(id) {
        const main = document.getElementById('main-content');
        debugLog('[DETAIL] init called with id:', id);
        UI.showLoader();
        this._audioPlayer?.destroy();
        this._audioPlayer = null;
        this.teardownPdfViewer();
        this.teardownCompletionRatingPrompt();

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
            const isPrivateTeacherResource = sub.resource_purpose === 'teaching_resource' && sub.visibility !== 'public';
            const canViewPrivateTeacherResource = currentUser && (
                currentUser.id === (sub.owner_id || sub.author_id) ||
                userRole === 'admin'
            );

            if (sub.status !== 'approved' && !canViewUnapproved) {
                console.warn('[DETAIL] Blocked non-approved submission for public viewer:', id);
                UI.showToast('Submission not found', 'error');
                UI.hideLoader();
                window.location.hash = 'explore';
                return;
            }

            if (isPrivateTeacherResource && !canViewPrivateTeacherResource) {
                console.warn('[DETAIL] Blocked private teacher resource for non-owner:', id);
                UI.showToast('Submission not found', 'error');
                UI.hideLoader();
                window.location.hash = 'explore';
                return;
            }

            const isPdfSubmission = UI.isPdfSubmission(sub);

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
            } else if (isPdfSubmission && sub.status !== 'approved' && sub.file_path) {
                const { data, error: signedError } = await supabase.storage
                    .from('submissions_private')
                    .createSignedUrl(sub.file_path, 3600);
                if (!signedError) {
                    sub.public_url = data.signedUrl;
                }
            } else if (sub.file_path) {
                const { data } = supabase.storage
                    .from(sub.status === 'approved' ? 'approved_public' : 'submissions_private')
                    .getPublicUrl(sub.file_path);
                sub.public_url = data.publicUrl;
            }

            debugLog('[DETAIL] Active backend project URL:', supabase?.supabaseUrl || 'unknown');
            debugLog('[DETAIL] Resolved submission preview source:', {
                submissionId: sub.id,
                publicUrl: sub.public_url || null,
                fileUrl: sub.file_url || null,
                filePath: sub.file_path || null
            });

            // Step 3: Initial Render (Show content immediately)
            sub.initialViewCount = Number(sub.submission_stats?.[0]?.view_count || 0);
            main.innerHTML = UI.pages.detail(sub, currentUser, userRole);
            UI.hydrateInlinePreviewFrames(main);
            this._currentSub = sub;

            // Step 4: Parallelize secondary data (Stats + Like Status)
            debugLog('[DETAIL] Fetching secondary stats in parallel...');
            const statsPromise = this.refreshStats(sub.id);
            const likeStatusPromise = this.checkIfLiked(sub.id);
            if (currentUser?.id) {
                try {
                    const interactions = await API.getUserSubmissionInteractions([sub.id], currentUser.id);
                    sub._interactiveWebUserRating = Number(interactions?.[sub.id]?.userRating) || null;
                    if (sub._interactiveWebUserRating) {
                        UI.storeRatingMarker?.(sub.id, currentUser.id);
                    }
                } catch (error) {
                    console.warn('[Rating] Existing user rating check failed', error);
                }
            }

            // Setup static UI elements
            this.setupAudioPlayer(sub);
            this.setupBackToExplore();
            this.setupPdfViewer(sub);
            this.setupInteractions(sub);
            this.setupEditButton(sub);
            this.setupPreviewFullscreen();
            this.setupBookmark(sub);
            this.setupCompletionRatingPrompt(sub);

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
            debugLog('[DETAIL] ✅ Fully Loaded');

            // Clean up fullscreen state on navigation
            window.addEventListener('hashchange', () => {
                this._audioPlayer?.destroy();
                this._audioPlayer = null;
                this.teardownPdfViewer();
                this.teardownCompletionRatingPrompt();
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
                debugLog('[DETAIL] Audio playback started, recording view/play count...');
                await this.recordView(sub.id, { source: 'audio-playback' });
            }
        });
        this._audioPlayer.init();
    },

    isAudioSubmission(sub = {}) {
        return UI.isAudioSubmission(sub);
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
            debugLog('[DETAIL] Rating mutation start:', {
                submissionId: sub.id,
                ratingValue,
                backendProjectUrl: supabase?.supabaseUrl || 'unknown'
            });
            const { data, error } = await API.rateSubmission(sub.id, user.id, ratingValue);
            if (error || !data) {
                console.warn('[DETAIL] Rating mutation failed:', error);
                UI.showToast(error?.message || 'Could not save rating.', 'error');
                return;
            }

            this._statsMutationVersion = (this._statsMutationVersion || 0) + 1;
            this.applyAverageRatingToUi(data.avgRating, sub);
            sub._interactiveWebUserRating = data.userRating || Number(ratingValue) || null;
            UI.storeRatingMarker?.(sub.id, user.id);
            this.markRatingRated(sub.id);
            debugLog('[DETAIL] Rating mutation success:', data);
            await this.refreshStats(sub.id, {
                reason: 'rating-success',
                mutationVersion: this._statsMutationVersion
            });
            UI.showToast('Thank you for rating!', 'success');
            UI.triggerBadgeEvaluation({
                userId: user.id,
                reason: 'rating-success'
            });
        } finally {
            UI.hideLoader();
        }
    },

    navigateBackToExplore({ skipRatingPrompt = false } = {}) {
        if (!skipRatingPrompt && this._currentSub?.id && this.shouldUseCompletionRatingPrompt(this._currentSub)) {
            const sub = this._currentSub;
            UI.hydrateActiveUserRatingForSubmission?.(sub).then((hasRated) => {
                if (hasRated || !this.shouldPromptRatingBeforeClose?.(sub)) {
                    this.navigateBackToExplore({ skipRatingPrompt: true });
                    return;
                }

                this.markRatingPrompted(sub?.id);
                this.showCompletionRatingPrompt(sub, {
                    onDone: () => this.navigateBackToExplore({ skipRatingPrompt: true }),
                    onSkip: () => this.navigateBackToExplore({ skipRatingPrompt: true })
                });
            });
            return;
        }

        try {
            sessionStorage.setItem(this._exploreRestoreFlagKey, 'true');
        } catch (_) {
            // Ignore storage failures and fall back to default Explore behavior.
        }

        window.location.hash = 'explore';
    },

    async closeImmersiveViewer({ cleanup } = {}) {
        if (typeof cleanup === 'function') {
            await cleanup();
        }

        if (document.fullscreenElement && document.exitFullscreen) {
            try {
                await document.exitFullscreen();
            } catch (_) {
                // Ignore native fullscreen exit failures and continue closing the viewer.
            }
        }

        this.navigateBackToExplore();
    },

    setupBackToExplore() {
        const backLink = document.querySelector('.back-link');
        if (!backLink) return;

        backLink.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.navigateBackToExplore();
        });
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
        const remoteToggleBtn = document.getElementById('pdfRemoteToggleBtn');
        const remotePanel = document.getElementById('pdfRemotePanel');
        const remoteCloseBtn = document.getElementById('pdfRemoteCloseBtn');
        const remoteEnableBtn = document.getElementById('pdfRemoteEnableBtn');
        const remoteSessionState = document.getElementById('pdfRemoteSessionState');
        const remoteConnectionState = document.getElementById('pdfRemoteConnectionState');
        const remotePairingCode = document.getElementById('pdfRemotePairingCode');
        const remoteQrCode = document.getElementById('pdfRemoteQrCode');
        const remotePairingLink = document.getElementById('pdfRemotePairingLink');
        const pageIndicator = document.getElementById('pdfPageIndicator');
        const overlayIndicator = document.getElementById('pdfOverlayPageIndicator');
        const overlayControls = document.getElementById('pdfPresentOverlayControls');
        const laserPointer = document.getElementById('pdfLaserPointer');

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
            remoteToggleBtn,
            remotePanel,
            remoteCloseBtn,
            remoteEnableBtn,
            remoteSessionState,
            remoteConnectionState,
            remotePairingCode,
            remoteQrCode,
            remotePairingLink,
            pageIndicator,
            overlayIndicator,
            overlayControls,
            laserPointer,
            fileUrl: root.dataset.pdfUrl || sub.public_url || sub.file_url || null,
            pdfDoc: null,
            renderTask: null,
            currentPage: 1,
            pageCount: 0,
            zoomFactor: 1,
            isPresenting: false,
            usingNativeFullscreen: false,
            controlsHideTimer: null,
            pointerHideTimer: null,
            ready: false,
            remotePanelOpen: false,
            remoteNotes: normalizePresentationNotes(sub.presentation_notes),
            remoteSession: null,
            remoteSessionChannel: null,
            remoteCommandChannel: null,
            remoteHeartbeatTimer: null,
            processedCommandIds: new Set()
        };

        this._pdfViewerState = state;

        const setControlsEnabled = (enabled) => {
            [presentBtn, prevBtn, nextBtn, zoomOutBtn, zoomInBtn, fitBtn, exitBtn, overlayPrevBtn, overlayNextBtn, remoteToggleBtn, remoteEnableBtn]
                .filter(Boolean)
                .forEach((button) => {
                    button.disabled = !enabled;
                });
        };

        const showInlinePdfFallback = () => {
            if (!state.fileUrl || !state.fallback) return;
            if (state.fallback.dataset.inlinePdfMounted === 'true') return;

            const safeTitle = String(state.sub?.title || 'Document viewer')
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            state.fallback.insertAdjacentHTML(
                'beforeend',
                `<div class="document-preview-fallback-inline">
                    <iframe class="document-preview-frame immersive-viewer-pdf-frame" src="${state.fileUrl}" title="${safeTitle}" loading="lazy" referrerpolicy="no-referrer"></iframe>
                </div>`
            );
            state.fallback.dataset.inlinePdfMounted = 'true';
        };

        const clearPointerHideTimer = () => {
            if (state.pointerHideTimer) {
                window.clearTimeout(state.pointerHideTimer);
                state.pointerHideTimer = null;
            }
        };

        const hideLaserPointer = async ({ sync = false } = {}) => {
            clearPointerHideTimer();
            state.laserPointer?.classList.add('hidden');
            if (sync && state.remoteSession?.id) {
                try {
                    state.remoteSession = await refreshPresentationRemoteSession(state.remoteSession.id, {
                        title: state.sub.title || '',
                        presentation_notes: state.remoteNotes,
                        current_slide_index: state.currentPage - 1,
                        slide_count: state.pageCount || 1,
                        is_presenting: state.isPresenting,
                        laser_pointer_visible: false,
                        laser_pointer_x: null,
                        laser_pointer_y: null
                    });
                    updateRemotePanelUi();
                } catch (error) {
                    console.warn('[DETAIL] Could not hide remote laser pointer:', error);
                }
            }
        };

        const showLaserPointer = (x, y) => {
            if (!state.laserPointer) return;
            state.laserPointer.style.left = `${x * 100}%`;
            state.laserPointer.style.top = `${y * 100}%`;
            state.laserPointer.classList.remove('hidden');
            clearPointerHideTimer();
            state.pointerHideTimer = window.setTimeout(() => {
                hideLaserPointer({ sync: true }).catch(() => {});
            }, PRESENTATION_POINTER_HIDE_MS);
        };

        const renderRemoteQr = (session) => {
            if (!state.remoteQrCode || !state.remotePairingLink) return;

            const joinUrl = buildRemoteJoinUrl(session.id, session.access_token);
            state.remotePairingLink.href = joinUrl;
            state.remotePairingLink.textContent = joinUrl;
            state.remoteQrCode.innerHTML = '';

            if (window.QRCode) {
                new window.QRCode(state.remoteQrCode, {
                    text: joinUrl,
                    width: 176,
                    height: 176
                });
                return;
            }

            state.remoteQrCode.textContent = 'QR unavailable. Use the link below.';
        };

        const updateRemotePanelUi = () => {
            if (!state.remoteEnableBtn) return;

            const session = state.remoteSession;
            if (!session) {
                state.remoteEnableBtn.textContent = 'Enable remote';
                if (state.remoteSessionState) state.remoteSessionState.textContent = 'Inactive';
                if (state.remoteConnectionState) state.remoteConnectionState.textContent = 'Disconnected';
                if (state.remotePairingCode) state.remotePairingCode.textContent = '------';
                if (state.remoteQrCode) state.remoteQrCode.innerHTML = '<span>Enable remote to generate a pairing QR.</span>';
                if (state.remotePairingLink) {
                    state.remotePairingLink.href = '#remote';
                    state.remotePairingLink.textContent = 'Open remote on this device';
                }
                return;
            }

            state.remoteEnableBtn.textContent = 'Disable remote';
            if (state.remoteSessionState) {
                state.remoteSessionState.textContent = session.is_presenting ? 'Live session' : 'Ready';
            }
            if (state.remoteConnectionState) {
                state.remoteConnectionState.textContent = session.remote_connected ? 'Authorised phone connected' : 'Waiting for phone';
            }
            if (state.remotePairingCode) state.remotePairingCode.textContent = session.pairing_code || '------';
            renderRemoteQr(session);
        };

        const toggleRemotePanel = (force) => {
            if (!state.remotePanel) return;
            state.remotePanelOpen = typeof force === 'boolean' ? force : !state.remotePanelOpen;
            state.remotePanel.classList.toggle('hidden', !state.remotePanelOpen);
            if (state.remotePanelOpen) {
                updateRemotePanelUi();
            }
        };

        const syncRemoteSessionState = async (patch = {}) => {
            if (!state.remoteSession?.id) return;

            try {
                state.remoteSession = await refreshPresentationRemoteSession(state.remoteSession.id, {
                    title: state.sub.title || '',
                    presentation_notes: state.remoteNotes,
                    current_slide_index: Math.max(0, state.currentPage - 1),
                    slide_count: Math.max(1, state.pageCount || 1),
                    is_presenting: state.isPresenting,
                    ...patch
                });
                updateRemotePanelUi();
            } catch (error) {
                console.warn('[DETAIL] Remote session sync failed:', error);
            }
        };

        const teardownRemoteChannels = async () => {
            if (state.remoteHeartbeatTimer) {
                window.clearInterval(state.remoteHeartbeatTimer);
                state.remoteHeartbeatTimer = null;
            }

            await Promise.all([
                removeChannel(state.remoteSessionChannel),
                removeChannel(state.remoteCommandChannel)
            ]);
            state.remoteSessionChannel = null;
            state.remoteCommandChannel = null;
        };

        const destroyRemoteSession = async () => {
            clearPointerHideTimer();
            state.processedCommandIds.clear();

            if (state.remoteSession?.id) {
                try {
                    await deletePresentationRemoteSession(state.remoteSession.id);
                } catch (error) {
                    console.warn('[DETAIL] Remote session delete failed:', error);
                }
            }

            state.remoteSession = null;
            await teardownRemoteChannels();
            updateRemotePanelUi();
        };

        const handleRemoteCommand = async (command) => {
            if (!command || state.processedCommandIds.has(command.id)) return;
            state.processedCommandIds.add(command.id);
            if (state.processedCommandIds.size > 150) {
                const [firstId] = state.processedCommandIds;
                if (firstId) state.processedCommandIds.delete(firstId);
            }

            if (!state.remoteSession || command.session_id !== state.remoteSession.id) return;
            if (state.remoteSession.active_remote_id && command.remote_id !== state.remoteSession.active_remote_id) return;

            if (command.command_type === 'next') {
                await goToPage(state.currentPage + 1, { syncRemote: false });
            } else if (command.command_type === 'prev') {
                await goToPage(state.currentPage - 1, { syncRemote: false });
            } else if (command.command_type === 'goto') {
                await goToPage((Number(command.slide_index) || 0) + 1, { syncRemote: false });
            } else if (command.command_type === 'start') {
                if (!state.isPresenting) {
                    await enterPresentMode({ syncRemote: false });
                }
            } else if (command.command_type === 'end') {
                if (state.isPresenting) {
                    await exitPresentMode({ syncRemote: false });
                }
            } else if (command.command_type === 'pointer_move') {
                const x = Math.max(0, Math.min(1, Number(command.pointer_x) || 0));
                const y = Math.max(0, Math.min(1, Number(command.pointer_y) || 0));
                showLaserPointer(x, y);
                await syncRemoteSessionState({
                    remote_connected: true,
                    laser_pointer_visible: true,
                    laser_pointer_x: x,
                    laser_pointer_y: y
                });
                return;
            } else if (command.command_type === 'pointer_hide') {
                await hideLaserPointer({ sync: false });
            }

            await syncRemoteSessionState({
                remote_connected: true,
                laser_pointer_visible: false,
                laser_pointer_x: null,
                laser_pointer_y: null
            });
        };

        const subscribeRemoteChannels = () => {
            if (!state.remoteSession?.id) return;

            state.remoteSessionChannel = createSessionSubscription(state.remoteSession.id, (payload) => {
                if (payload.eventType === 'DELETE') {
                    state.remoteSession = null;
                    updateRemotePanelUi();
                    hideLaserPointer().catch(() => {});
                    return;
                }

                state.remoteSession = payload.new || state.remoteSession;
                updateRemotePanelUi();
                if (!state.remoteSession?.laser_pointer_visible) {
                    state.laserPointer?.classList.add('hidden');
                }
            });

            state.remoteCommandChannel = createCommandSubscription(state.remoteSession.id, (payload) => {
                handleRemoteCommand(payload.new).catch((error) => {
                    console.warn('[DETAIL] Remote command failed:', error);
                });
            });

            state.remoteHeartbeatTimer = window.setInterval(() => {
                syncRemoteSessionState({
                    remote_connected: Boolean(state.remoteSession?.active_remote_id)
                }).catch(() => {});
            }, PRESENTATION_REMOTE_HEARTBEAT_MS);
        };

        const enableRemoteSession = async () => {
            if (!App.user) {
                UI.showToast('Sign in to enable phone remote control.', 'error');
                return;
            }

            if (state.remoteSession?.id) {
                await destroyRemoteSession();
                UI.showToast('Remote session closed.', 'success');
                return;
            }

            await cleanupExpiredPresentationSessions(App.user.id);
            state.remoteSession = await createPresentationRemoteSession({
                presentationId: state.sub.id,
                hostUserId: App.user.id,
                title: state.sub.title || '',
                presentationNotes: state.remoteNotes,
                currentSlideIndex: state.currentPage - 1,
                slideCount: state.pageCount || 1,
                isPresenting: state.isPresenting
            });

            subscribeRemoteChannels();
            updateRemotePanelUi();
            toggleRemotePanel(true);
            UI.showToast('Remote pairing is ready on this presenter.', 'success');
        };

        setControlsEnabled(false);
        presentBtn.classList.add('hidden');
        updateRemotePanelUi();

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

            const goToPage = async (pageNumber, { syncRemote = true } = {}) => {
                if (!state.ready) return;
                const nextPage = Math.max(1, Math.min(state.pageCount, Number(pageNumber) || 1));
                if (nextPage === state.currentPage) return;
                state.currentPage = nextPage;
                updateIndicators();
                await renderPage();
                if (syncRemote) {
                    await syncRemoteSessionState({
                        laser_pointer_visible: false,
                        laser_pointer_x: null,
                        laser_pointer_y: null
                    });
                }
            };

            const syncPresentUi = () => {
                state.root.classList.toggle('pdf-present-active', state.isPresenting);
                state.overlayControls?.classList.toggle('hidden', !state.isPresenting);
                state.presentBtn?.classList.toggle('hidden', !state.ready || state.isPresenting);
                state.root.classList.toggle('presenter-controls-visible', state.isPresenting);
                document.body.classList.toggle('body-no-scroll', state.isPresenting);
                if (!state.isPresenting) {
                    toggleRemotePanel(false);
                }
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

            const exitPresentMode = async ({ skipFullscreenExit = false, syncRemote = true } = {}) => {
                if (!state.isPresenting) return;

                state.isPresenting = false;
                clearControlsHideTimer();
                syncPresentUi();
                await hideLaserPointer({ sync: false });

                if (!skipFullscreenExit && document.fullscreenElement === state.root && document.exitFullscreen) {
                    try {
                        await document.exitFullscreen();
                    } catch (_) {
                        // Ignore fullscreen exit failures and fall back to overlay cleanup.
                    }
                }

                await renderPage({ force: true, fitMode: 'width' });
                if (syncRemote) {
                    await syncRemoteSessionState({
                        laser_pointer_visible: false,
                        laser_pointer_x: null,
                        laser_pointer_y: null
                    });
                }
            };

            const enterPresentMode = async ({ syncRemote = true } = {}) => {
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

                if (syncRemote) {
                    await syncRemoteSessionState();
                }
            };

            state.renderPage = renderPage;
            state.goToPage = goToPage;
            state.enterPresentMode = enterPresentMode;
            state.exitPresentMode = exitPresentMode;
            state.updateIndicators = updateIndicators;
            state.revealPresentControls = revealPresentControls;
            state.destroyRemoteSession = destroyRemoteSession;
            state.hideLaserPointer = hideLaserPointer;

            const attachClick = (element, handler) => {
                if (!element) return;
                element.addEventListener('click', handler);
            };

            attachClick(prevBtn, () => goToPage(state.currentPage - 1));
            attachClick(nextBtn, () => goToPage(state.currentPage + 1));
            attachClick(overlayPrevBtn, () => goToPage(state.currentPage - 1));
            attachClick(overlayNextBtn, () => goToPage(state.currentPage + 1));
            attachClick(remoteToggleBtn, () => toggleRemotePanel());
            attachClick(remoteCloseBtn, () => toggleRemotePanel(false));
            attachClick(remoteEnableBtn, () => {
                enableRemoteSession().catch((error) => {
                    console.warn('[DETAIL] Remote enable failed:', error);
                    UI.showToast(error.message || 'Could not start remote pairing.', 'error');
                });
            });
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
            attachClick(exitBtn, async (event) => {
                event?.preventDefault?.();
                event?.stopPropagation?.();
                await this.closeImmersiveViewer({
                    cleanup: async () => {
                        if (state.isPresenting) {
                            await exitPresentMode();
                        }
                    }
                });
            });

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
            updateRemotePanelUi();
        } catch (error) {
            if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
                console.warn('[DETAIL] PDF viewer unavailable:', error);
            }

            if (this._pdfViewerState !== state) return;

            loading.classList.add('hidden');
            canvas.classList.add('hidden');
            showInlinePdfFallback();
            fallback.classList.remove('hidden');
            presentBtn.classList.add('hidden');
            document.body.classList.remove('body-no-scroll');
            updateRemotePanelUi();
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

        if (state.pointerHideTimer) {
            window.clearTimeout(state.pointerHideTimer);
        }

        state.hideLaserPointer?.().catch?.(() => {});
        state.destroyRemoteSession?.().catch?.(() => {});

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

        const showFloatingClose = () => {
            floatingClose?.classList.add('visible');
        };

        const hideFloatingClose = () => {
            floatingClose?.classList.remove('visible');
        };

        const clearFloatingCloseTimer = () => {
            if (this._previewCloseHideTimer) {
                clearTimeout(this._previewCloseHideTimer);
                this._previewCloseHideTimer = null;
            }
        };

        const scheduleFloatingCloseHide = (delay = 1500) => {
            if (!floatingClose) return;
            clearFloatingCloseTimer();
            this._previewCloseHideTimer = window.setTimeout(() => {
                const activeContainer = document.getElementById('previewContainer');
                if (!activeContainer?.classList.contains('fullscreen-active')) return;
                hideFloatingClose();
            }, delay);
        };

        const toggleFullscreen = () => {
            const isFullscreen = container.classList.toggle('fullscreen-active');
            document.body.classList.toggle('body-no-scroll', isFullscreen);

            btn.innerHTML = isFullscreen
                ? '<span>✕ Close</span>'
                : '<span>⛶ Fullscreen</span>';

            if (isFullscreen) {
                showFloatingClose();
                scheduleFloatingCloseHide();
                UI.showToast('Immersive mode - tap the X to exit.');
                btn.focus();
            } else {
                hideFloatingClose();
                clearFloatingCloseTimer();
            }
            btn.innerHTML = '<span>â›¶ Fullscreen</span>';
        };

        const resetPreviewFullscreenUi = () => {
            hideFloatingClose();
            clearFloatingCloseTimer();
            container.classList.remove('fullscreen-active');
            document.body.classList.remove('body-no-scroll');
            btn.innerHTML = '<span>â›¶ Fullscreen</span>';
            btn.innerHTML = '<span>â›¶ Fullscreen</span>';
        };

        const closeViewerToExplore = async (event) => {
            event?.preventDefault?.();
            event?.stopPropagation?.();

            await this.closeImmersiveViewer({
                cleanup: () => {
                    resetPreviewFullscreenUi();
                }
            });
            return;

            hideFloatingClose();
            clearFloatingCloseTimer();

            container.classList.remove('fullscreen-active');
            document.body.classList.remove('body-no-scroll');
            btn.innerHTML = '<span>â›¶ Fullscreen</span>';

            if (document.fullscreenElement && document.exitFullscreen) {
                try {
                    await document.exitFullscreen();
                } catch (_) {
                    // Ignore native fullscreen exit failures and continue returning to Explore.
                }
            }

            this.navigateBackToExplore();
        };

        const clickHandler = (e) => {
            e.stopPropagation();
            toggleFullscreen();
        };

        btn.addEventListener('click', clickHandler);
        floatingClose?.addEventListener('click', closeViewerToExplore);

        if (!this._windowListenersAttached) {
            window.addEventListener('message', (e) => {
                const activeContainer = document.getElementById('previewContainer');
                if (!activeContainer || !activeContainer.classList.contains('fullscreen-active')) return;
                const closeBtn = document.getElementById('floatingCloseBtn');
                if (!closeBtn) return;

                if (e.data?.type === 'SHOW_CLOSE_BTN') {
                    closeBtn.classList.add('visible');
                    clearFloatingCloseTimer();
                }
                if (e.data?.type === 'HIDE_CLOSE_BTN') {
                    closeBtn.classList.remove('visible');
                }
            });

            window.addEventListener('keydown', (e) => {
                const activeContainer = document.getElementById('previewContainer');
                if (e.key === 'Escape' && activeContainer?.classList.contains('fullscreen-active')) {
                    const isFullscreen = activeContainer.classList.toggle('fullscreen-active');
                    document.body.classList.toggle('body-no-scroll', isFullscreen);
                    document.getElementById('floatingCloseBtn')?.classList.remove('visible');
                    clearFloatingCloseTimer();
                    const activeBtn = document.getElementById('previewFullscreenBtn');
                    if (activeBtn) {
                        activeBtn.innerHTML = '<span>⛶ Fullscreen</span>';
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
                UI.triggerBadgeEvaluation({
                    userId: user.id,
                    reason: 'like-success'
                });
            }

            UI.hideLoader();
        });

        this.attachStarListeners(starContainer, sub);

        downloadBtn?.addEventListener('click', async () => {
            const user = App.user;
            await supabase.from('downloads').insert({
                submission_id: sub.id, user_id: user?.id || null
            });
            window.open(UI.getSubmissionFileUrl(sub), '_blank');
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

    shouldUseCompletionRatingPrompt(sub = {}) {
        return !!sub && !this.isAudioSubmission(sub) && !UI.isVideoSubmission(sub);
    },

    markRatingPrompted(submissionId) {
        UI.markRatingPrompted?.(submissionId);
    },

    markRatingRated(submissionId) {
        UI.markRatingRated?.(submissionId);
    },

    shouldPromptRatingBeforeClose(sub = {}) {
        return UI.shouldPromptRatingBeforeClose?.(sub) || false;
    },

    setupCompletionRatingPrompt(sub) {
        // Rating prompts are intentionally close-triggered, not scroll-triggered.
    },

    teardownCompletionRatingObserver() {
        this._completionRatingObserver?.disconnect?.();
        this._completionRatingObserver = null;
        if (this._completionRatingScrollHandler) {
            window.removeEventListener('scroll', this._completionRatingScrollHandler);
            this._completionRatingScrollHandler = null;
        }
    },

    teardownCompletionRatingPrompt() {
        this._completionRatingDetailOpen = false;
        this._completionRatingActiveSubmissionId = null;
        this.teardownCompletionRatingObserver();
        this._completionRatingSentinel?.remove?.();
        this._completionRatingSentinel = null;
        document.querySelector('.detail-rating-prompt-overlay')?.remove();
    },

    showCompletionRatingPrompt(sub, { onDone = null, onSkip = null } = {}) {
        document.querySelector('.detail-rating-prompt-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'detail-rating-prompt-overlay rating-modal-overlay';
        overlay.innerHTML = `
            <div class="detail-rating-prompt rating-modal-card" role="dialog" aria-modal="true" aria-label="Rate this work">
                <button type="button" class="detail-rating-prompt-close" aria-label="Close rating prompt">&times;</button>
                <p class="detail-rating-prompt-kicker">Finished reading?</p>
                <h2>Rate this work</h2>
                <p class="detail-rating-prompt-subtitle">Your feedback helps creators improve.</p>
                <div class="detail-rating-prompt-stars" aria-label="Choose a rating">
                    ${[1, 2, 3, 4, 5].map((value) => `
                        <button type="button" class="detail-rating-prompt-star" data-rating="${value}" aria-label="Rate ${value} star${value === 1 ? '' : 's'}">&#9733;</button>
                    `).join('')}
                </div>
                <button type="button" class="detail-rating-prompt-submit">Submit Rating</button>
                <button type="button" class="detail-rating-prompt-secondary">Not now</button>
            </div>
        `;

        const close = ({ skipped = false } = {}) => {
            overlay.remove();
            if (skipped && typeof onSkip === 'function') onSkip();
        };
        const showThanks = () => {
            const card = overlay.querySelector('.detail-rating-prompt');
            if (!card) return;
            card.classList.add('is-thank-you');
            card.innerHTML = `
                <div class="detail-rating-success-icon" aria-hidden="true">✓</div>
                <h2>Thank you for rating!</h2>
                <p class="detail-rating-prompt-subtitle">Your feedback has been saved.</p>
            `;
            window.setTimeout(() => {
                overlay.remove();
                if (typeof onDone === 'function') onDone();
            }, 1300);
        };
        let selectedRating = 0;
        const syncStars = () => {
            overlay.querySelectorAll('.detail-rating-prompt-star').forEach((star) => {
                const value = Number(star.dataset.rating || 0);
                star.classList.toggle('is-selected', value <= selectedRating);
            });
        };

        overlay.querySelector('.detail-rating-prompt-close')?.addEventListener('click', () => close({ skipped: true }));
        overlay.querySelector('.detail-rating-prompt-secondary')?.addEventListener('click', () => close({ skipped: true }));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close({ skipped: true });
        });
        overlay.querySelectorAll('.detail-rating-prompt-star').forEach((button) => {
            button.addEventListener('click', () => {
                selectedRating = Number(button.dataset.rating || 0);
                syncStars();
            });
        });
        overlay.querySelector('.detail-rating-prompt-submit')?.addEventListener('click', async () => {
            if (!selectedRating) {
                UI.showToast('Choose a rating first', 'error');
                return;
            }
            await this.submitRating(sub, selectedRating);
            sub._interactiveWebUserRating = selectedRating;
            this.markRatingRated(sub.id);
            showThanks();
        });

        document.body.appendChild(overlay);
    },
    async refreshStats(subId, { reason = 'general', mutationVersion = this._statsMutationVersion || 0 } = {}) {
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

            if ((this._statsMutationVersion || 0) !== mutationVersion) {
                debugLog('[DETAIL] Skipping stale stats refresh result:', {
                    submissionId: subId,
                    reason,
                    mutationVersion,
                    currentMutationVersion: this._statsMutationVersion || 0
                });
                return;
            }

            debugLog('[DETAIL] Post-mutation refresh result:', {
                submissionId: subId,
                reason,
                likeCount,
                avgRating,
                viewCount
            });

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

            debugLog('[DETAIL] Final rendered count values:', {
                submissionId: subId,
                renderedLikeCount: likeCountSpan?.textContent || null,
                renderedAvgRating: avgRatingSpan?.textContent || null,
                renderedViewCount: viewCountSpan?.textContent || null,
                renderedAudioViewCount: audioViewCountSpan?.textContent || null
            });
        } catch (err) {
            console.error('[DETAIL] refreshStats error:', err);
        }
    },

    async recordView(subId, { source = 'detail-init' } = {}) {
        try {
            const viewerId = App.user ? App.user.id : null;
            debugLog('[DETAIL] Recording view:', {
                submissionId: subId,
                source,
                viewerId,
                backendProjectUrl: supabase?.supabaseUrl || 'unknown'
            });

            const { error } = await API.recordSubmissionView(subId, viewerId);

            if (error) {
                console.warn('[DETAIL] Failed to record view:', error);
                return false;
            } else {
                debugLog('[DETAIL] View recorded successfully');
                this._statsMutationVersion = (this._statsMutationVersion || 0) + 1;
                this.incrementViewCountDisplays(1);
                await this.refreshStats(subId, {
                    reason: `view-success:${source}`,
                    mutationVersion: this._statsMutationVersion
                });
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

