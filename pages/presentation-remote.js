import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';
import {
    PRESENTATION_REMOTE_HEARTBEAT_MS,
    PRESENTATION_POINTER_HIDE_MS,
    buildRemoteJoinUrl,
    claimPresentationRemoteSession,
    createSessionSubscription,
    createThrottledPointerSender,
    getPresentationRemoteSessionByCode,
    getPresentationRemoteSessionById,
    getSpeakerNoteForSlide,
    parseRemoteRouteContext,
    releasePresentationRemoteSession,
    removeChannel,
    sendPresentationRemoteCommand
} from '../assets/js/presentation-remote.js';

const REMOTE_STORAGE_KEY = 'edtechra_presentation_remote_state';

export const PresentationRemotePage = {
    _remoteId: null,
    _session: null,
    _sessionChannel: null,
    _heartbeatTimer: null,
    _pointerHideTimer: null,
    _pointerSender: null,

    async init() {
        this.teardown();

        const main = document.getElementById('main-content');
        if (!main) return;

        this._remoteId = this._remoteId || this.restoreStoredState()?.remoteId || this.createRemoteId();
        this._pointerSender = createThrottledPointerSender((payload) => this.sendPointerMove(payload));

        main.innerHTML = this.renderShell();
        this.bindStaticActions();

        const route = parseRemoteRouteContext();
        if (route.sessionId) {
            await this.connectFromRoute(route.sessionId, route.accessToken);
            return;
        }

        const stored = this.restoreStoredState();
        if (stored?.sessionId && stored?.accessToken) {
            await this.connectFromRoute(stored.sessionId, stored.accessToken, { silent: true });
        }
    },

    createRemoteId() {
        if (globalThis.crypto?.randomUUID) {
            return globalThis.crypto.randomUUID();
        }
        return `remote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    },

    renderShell() {
        return `
            <section class="remote-page-shell">
                <div class="remote-page-card glass-card">
                    <div class="remote-page-header">
                        <p class="remote-page-kicker">Presentation Remote</p>
                        <h1>Control your live deck from your phone</h1>
                        <p class="remote-page-copy">Use the QR code on the presenter screen or enter the 6-digit pairing code. The phone must be signed into the same Edtechra account as the presenter.</p>
                    </div>

                    <div class="remote-connection-card">
                        <label for="remotePairingCode">Manual pairing code</label>
                        <div class="remote-join-row">
                            <input id="remotePairingCode" class="form-control remote-pairing-input" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="123456">
                            <button type="button" id="remotePairingJoinBtn" class="btn btn-primary">Connect</button>
                        </div>
                        <p class="remote-connection-help" id="remoteConnectionHelp">QR pairing is the fastest option. Manual pairing works as a backup.</p>
                    </div>

                    <div class="remote-session-card hidden" id="remoteSessionCard">
                        <div class="remote-session-meta">
                            <div>
                                <span class="remote-status-pill" id="remoteStatusPill">Connecting</span>
                                <h2 id="remotePresentationTitle">Presentation session</h2>
                            </div>
                            <div class="remote-slide-counter" id="remoteSlideCounter">Slide -- / --</div>
                        </div>

                        <div class="remote-control-grid">
                            <button type="button" class="btn btn-outline remote-nav-button" id="remotePrevBtn">Previous</button>
                            <button type="button" class="btn btn-primary remote-nav-button" id="remoteNextBtn">Next</button>
                        </div>

                        <div class="remote-secondary-controls">
                            <button type="button" class="btn btn-outline" id="remoteStartBtn">Start</button>
                            <button type="button" class="btn btn-outline" id="remoteEndBtn">End</button>
                            <div class="remote-jump-group">
                                <input id="remoteJumpInput" class="form-control" inputmode="numeric" pattern="[0-9]*" min="1" placeholder="Slide #">
                                <button type="button" class="btn btn-outline" id="remoteJumpBtn">Jump</button>
                            </div>
                        </div>

                        <div class="remote-notes-card">
                            <div class="remote-section-heading">
                                <h3>Speaker Notes</h3>
                                <span id="remoteConnectionStateLabel">Waiting</span>
                            </div>
                            <div class="remote-notes-body" id="remoteNotesBody">No notes for this slide yet.</div>
                        </div>

                        <div class="remote-pointer-card">
                            <div class="remote-section-heading">
                                <h3>Laser Pointer</h3>
                                <span>Touch and drag</span>
                            </div>
                            <div class="remote-pointer-surface" id="remotePointerSurface">
                                <span>Touch here to move the laser pointer</span>
                            </div>
                        </div>

                        <div class="remote-footer-actions">
                            <a class="btn btn-outline hidden" id="remoteSessionLink" target="_blank" rel="noopener noreferrer">Open pairing link</a>
                            <button type="button" class="btn btn-outline" id="remoteDisconnectBtn">Disconnect</button>
                        </div>
                    </div>

                    <div class="remote-login-state hidden" id="remoteLoginState">
                        <p>Please sign in to Edtechra on this phone with the same account that opened the presenter view.</p>
                        <a href="#login" class="btn btn-primary" data-link="login">Go to login</a>
                    </div>
                </div>
            </section>
        `;
    },

    bindStaticActions() {
        document.getElementById('remotePairingJoinBtn')?.addEventListener('click', () => this.connectFromCode());
        document.getElementById('remoteDisconnectBtn')?.addEventListener('click', () => this.disconnect());
        document.getElementById('remotePrevBtn')?.addEventListener('click', () => this.sendCommand('prev'));
        document.getElementById('remoteNextBtn')?.addEventListener('click', () => this.sendCommand('next'));
        document.getElementById('remoteStartBtn')?.addEventListener('click', () => this.sendCommand('start'));
        document.getElementById('remoteEndBtn')?.addEventListener('click', () => this.sendCommand('end'));
        document.getElementById('remoteJumpBtn')?.addEventListener('click', () => this.jumpToSlide());
        document.getElementById('remotePairingCode')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.connectFromCode();
            }
        });

        const surface = document.getElementById('remotePointerSurface');
        if (!surface) return;

        const getPayload = (event) => {
            const rect = surface.getBoundingClientRect();
            const point = event.touches?.[0] || event;
            const x = Math.max(0, Math.min(1, (point.clientX - rect.left) / rect.width));
            const y = Math.max(0, Math.min(1, (point.clientY - rect.top) / rect.height));
            return { x, y };
        };

        const moveHandler = (event) => {
            if (!this._session) return;
            event.preventDefault();
            const payload = getPayload(event);
            this._pointerSender?.(payload);
            this.schedulePointerHide();
        };

        const hideHandler = () => {
            this.sendCommand('pointer_hide').catch((error) => {
                console.warn('[PresentationRemotePage] Pointer hide failed:', error);
            });
        };

        surface.addEventListener('pointerdown', moveHandler);
        surface.addEventListener('pointermove', moveHandler);
        surface.addEventListener('pointerup', hideHandler);
        surface.addEventListener('pointerleave', hideHandler);
        surface.addEventListener('touchstart', moveHandler, { passive: false });
        surface.addEventListener('touchmove', moveHandler, { passive: false });
        surface.addEventListener('touchend', hideHandler);
    },

    async connectFromRoute(sessionId, accessToken, { silent = false } = {}) {
        if (!App.user) {
            this.showLoginState();
            return;
        }

        try {
            const session = await getPresentationRemoteSessionById(sessionId);
            if (!session || session.access_token !== accessToken) {
                throw new Error('This pairing link is invalid or has expired.');
            }

            await this.finishConnection(session, accessToken);
        } catch (error) {
            if (!silent) UI.showToast(error.message || 'Could not connect to the presentation.', 'error');
        }
    },

    async connectFromCode() {
        if (!App.user) {
            this.showLoginState();
            return;
        }

        const input = document.getElementById('remotePairingCode');
        const pairingCode = String(input?.value || '').replace(/\D/g, '').slice(0, 6);
        if (pairingCode.length !== 6) {
            UI.showToast('Enter the full 6-digit pairing code.', 'error');
            return;
        }

        try {
            const session = await getPresentationRemoteSessionByCode(pairingCode);
            if (!session) {
                throw new Error('No active presentation session matches that code.');
            }

            await this.finishConnection(session, session.access_token);
        } catch (error) {
            UI.showToast(error.message || 'Could not connect with that pairing code.', 'error');
        }
    },

    async finishConnection(session, accessToken) {
        if (new Date(session.expires_at).getTime() <= Date.now()) {
            throw new Error('This presentation session has already expired.');
        }

        if (session.active_remote_id && session.active_remote_id !== this._remoteId) {
            throw new Error('Another phone already controls this presentation.');
        }

        const claimed = await claimPresentationRemoteSession(session.id, this._remoteId, accessToken);
        this._session = claimed;
        this.persistState({
            sessionId: claimed.id,
            accessToken,
            remoteId: this._remoteId
        });

        this._sessionChannel = createSessionSubscription(claimed.id, (payload) => {
            const next = payload.new || payload.old || null;
            if (!next) return;
            if (payload.eventType === 'DELETE') {
                this.handleExpiredSession();
                return;
            }
            this._session = next;
            this.renderSession();
            if (new Date(next.expires_at).getTime() <= Date.now()) {
                this.handleExpiredSession();
            }
        });

        this._heartbeatTimer = window.setInterval(() => {
            if (!this._session?.id) return;
            claimPresentationRemoteSession(this._session.id, this._remoteId, accessToken)
                .then((nextSession) => {
                    this._session = nextSession;
                    this.renderSession();
                })
                .catch((error) => {
                    console.warn('[PresentationRemotePage] Heartbeat failed:', error);
                });
        }, PRESENTATION_REMOTE_HEARTBEAT_MS);

        this.renderSession();
        UI.showToast('Phone remote connected.', 'success');
    },

    renderSession() {
        const session = this._session;
        const sessionCard = document.getElementById('remoteSessionCard');
        const loginState = document.getElementById('remoteLoginState');
        if (!session || !sessionCard) return;

        loginState?.classList.add('hidden');
        sessionCard.classList.remove('hidden');

        const isConnected = session.remote_connected && session.active_remote_id === this._remoteId;
        const currentSlide = Number(session.current_slide_index || 0) + 1;
        const slideCount = Number(session.slide_count || 1);
        const note = getSpeakerNoteForSlide(session.presentation_notes, Number(session.current_slide_index || 0));

        const titleEl = document.getElementById('remotePresentationTitle');
        const statusPill = document.getElementById('remoteStatusPill');
        const slideCounter = document.getElementById('remoteSlideCounter');
        const notesBody = document.getElementById('remoteNotesBody');
        const stateLabel = document.getElementById('remoteConnectionStateLabel');
        const sessionLink = document.getElementById('remoteSessionLink');

        if (titleEl) titleEl.textContent = session.title || 'Live presentation session';
        if (statusPill) {
            statusPill.textContent = isConnected ? (session.is_presenting ? 'Live' : 'Ready') : 'Reconnecting';
            statusPill.className = `remote-status-pill ${isConnected ? 'connected' : 'disconnected'}`;
        }
        if (slideCounter) slideCounter.textContent = `Slide ${currentSlide} / ${slideCount}`;
        if (notesBody) notesBody.textContent = note || 'No notes for this slide yet.';
        if (stateLabel) stateLabel.textContent = isConnected ? 'Connected' : 'Waiting for presenter';
        if (sessionLink) {
            sessionLink.href = buildRemoteJoinUrl(session.id, session.access_token);
            sessionLink.classList.remove('hidden');
        }
    },

    showLoginState() {
        document.getElementById('remoteLoginState')?.classList.remove('hidden');
        document.getElementById('remoteSessionCard')?.classList.add('hidden');
    },

    async sendCommand(commandType, slideIndex = null) {
        if (!this._session?.id) return;

        await sendPresentationRemoteCommand({
            sessionId: this._session.id,
            presentationId: this._session.presentation_id,
            remoteId: this._remoteId,
            commandType,
            slideIndex
        });
    },

    async sendPointerMove({ x, y }) {
        if (!this._session?.id) return;

        await sendPresentationRemoteCommand({
            sessionId: this._session.id,
            presentationId: this._session.presentation_id,
            remoteId: this._remoteId,
            commandType: 'pointer_move',
            pointerX: x,
            pointerY: y
        });
    },

    async jumpToSlide() {
        const input = document.getElementById('remoteJumpInput');
        const targetSlide = Math.max(1, Number(input?.value || 0));
        if (!targetSlide) {
            UI.showToast('Enter a slide number first.', 'error');
            return;
        }

        await this.sendCommand('goto', targetSlide - 1);
    },

    schedulePointerHide() {
        if (this._pointerHideTimer) {
            window.clearTimeout(this._pointerHideTimer);
        }

        this._pointerHideTimer = window.setTimeout(() => {
            this.sendCommand('pointer_hide').catch((error) => {
                console.warn('[PresentationRemotePage] Pointer auto-hide failed:', error);
            });
        }, PRESENTATION_POINTER_HIDE_MS);
    },

    async disconnect() {
        if (this._session?.id) {
            try {
                await releasePresentationRemoteSession(this._session.id, this._remoteId);
            } catch (error) {
                console.warn('[PresentationRemotePage] Disconnect failed:', error);
            }
        }

        this.clearStoredState();
        this.teardown();
        this.init();
    },

    handleExpiredSession() {
        this.clearStoredState();
        UI.showToast('This presentation session has ended or expired.', 'error');
        this.teardown();
        document.getElementById('remoteSessionCard')?.classList.add('hidden');
    },

    persistState(state) {
        sessionStorage.setItem(REMOTE_STORAGE_KEY, JSON.stringify(state));
    },

    restoreStoredState() {
        try {
            return JSON.parse(sessionStorage.getItem(REMOTE_STORAGE_KEY) || 'null');
        } catch (_) {
            return null;
        }
    },

    clearStoredState() {
        sessionStorage.removeItem(REMOTE_STORAGE_KEY);
    },

    teardown() {
        if (this._heartbeatTimer) {
            window.clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }

        if (this._pointerHideTimer) {
            window.clearTimeout(this._pointerHideTimer);
            this._pointerHideTimer = null;
        }

        removeChannel(this._sessionChannel);
        this._sessionChannel = null;
        this._session = null;
    }
};
