const WAVESURFER_MODULE_URL = 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';

let wavesurferModulePromise = null;
let r2PublicBaseUrlPromise = null;

function formatTime(totalSeconds) {
    const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function loadWaveSurfer() {
    if (!wavesurferModulePromise) {
        wavesurferModulePromise = import(WAVESURFER_MODULE_URL);
    }

    return wavesurferModulePromise;
}

async function getR2PublicBaseUrl() {
    if (!r2PublicBaseUrlPromise) {
        r2PublicBaseUrlPromise = fetch('/api/r2-public-config')
            .then(async (response) => {
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || !payload.publicBaseUrl) {
                    throw new Error(payload.error || 'R2 public URL not available.');
                }
                return String(payload.publicBaseUrl).replace(/\/+$/, '');
            });
    }

    return r2PublicBaseUrlPromise;
}

async function resolveAudioSourceUrl(submission) {
    if (submission?.storage_provider === 'r2' && submission?.file_path && !/^https?:\/\//i.test(submission.file_path)) {
        try {
            const publicBaseUrl = await getR2PublicBaseUrl();
            return `${publicBaseUrl}/${String(submission.file_path).replace(/^\/+/, '')}`;
        } catch (error) {
            console.warn('[AudioPlayer] Falling back from R2_PUBLIC_URL lookup:', error);
        }
    }

    return submission?.file_url || submission?.public_url || submission?.file_path || null;
}

function buildFallbackMarkup(sourceUrl, fileType) {
    return `
        <audio controls class="preview-audio audio-player-fallback-element">
            <source src="${sourceUrl}" type="${fileType || 'audio/mpeg'}">
        </audio>
    `;
}

export class AudioPlayer {
    constructor(container, submission) {
        this.container = container;
        this.submission = submission;
        this.waveSurfer = null;
        this.isScrubbing = false;
        this.isDestroyed = false;
        this.boundHandlers = [];
    }

    renderShell() {
        this.container.innerHTML = `
            <section class="audio-player-card" aria-label="Audio player">
                <div class="audio-player-topline">
                    <div class="audio-player-copy">
                        <p class="audio-player-kicker">Audio Preview</p>
                        <h2 class="audio-player-title">${this.submission.title || 'Untitled audio'}</h2>
                        <div class="audio-player-meta">
                            <span class="audio-player-author">${this.submission.profiles?.display_name || 'Anonymous'}</span>
                            <span class="audio-player-dot"></span>
                            <span class="audio-player-views"><span class="audio-player-views-value" id="audio-player-view-count">${Number(this.submission.initialViewCount || 0)}</span> views</span>
                        </div>
                    </div>
                    <button class="audio-player-play" type="button" data-role="play-toggle" aria-label="Play audio">
                        <span class="audio-player-play-icon">▶</span>
                    </button>
                </div>

                <div class="audio-player-wave-shell">
                    <div class="audio-player-glow"></div>
                    <div class="audio-player-wave" data-role="waveform"></div>
                </div>

                <div class="audio-player-controls">
                    <div class="audio-player-progress-group">
                        <input class="audio-player-progress" data-role="progress" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek audio">
                        <div class="audio-player-time-row">
                            <span data-role="current-time">0:00</span>
                            <span data-role="duration">0:00</span>
                        </div>
                    </div>

                    <div class="audio-player-volume-wrap">
                        <span class="audio-player-volume-icon">🔊</span>
                        <input class="audio-player-volume" data-role="volume" type="range" min="0" max="1" value="1" step="0.01" aria-label="Volume">
                    </div>
                </div>
            </section>
        `;

        this.elements = {
            playButton: this.container.querySelector('[data-role="play-toggle"]'),
            playIcon: this.container.querySelector('.audio-player-play-icon'),
            waveform: this.container.querySelector('[data-role="waveform"]'),
            progress: this.container.querySelector('[data-role="progress"]'),
            currentTime: this.container.querySelector('[data-role="current-time"]'),
            duration: this.container.querySelector('[data-role="duration"]'),
            volume: this.container.querySelector('[data-role="volume"]')
        };
    }

    bind(element, eventName, handler) {
        element?.addEventListener(eventName, handler);
        this.boundHandlers.push(() => element?.removeEventListener(eventName, handler));
    }

    updatePlayState() {
        const isPlaying = this.waveSurfer?.isPlaying?.() || false;
        if (this.elements.playIcon) {
            this.elements.playIcon.textContent = isPlaying ? '❚❚' : '▶';
        }
        if (this.elements.playButton) {
            this.elements.playButton.setAttribute('aria-label', isPlaying ? 'Pause audio' : 'Play audio');
        }
    }

    updateTime(currentSeconds, durationSeconds = this.waveSurfer?.getDuration?.() || 0) {
        if (this.elements.currentTime) {
            this.elements.currentTime.textContent = formatTime(currentSeconds);
        }
        if (this.elements.duration) {
            this.elements.duration.textContent = formatTime(durationSeconds);
        }
        if (this.elements.progress && !this.isScrubbing && durationSeconds > 0) {
            this.elements.progress.value = String(Math.min(1000, Math.round((currentSeconds / durationSeconds) * 1000)));
        }
    }

    async init() {
        this.renderShell();

        const sourceUrl = await resolveAudioSourceUrl(this.submission);
        if (!sourceUrl) {
            this.showFallback(null, 'Audio file is not available for playback.');
            return;
        }

        this.sourceUrl = sourceUrl;
        this.submission.public_url = sourceUrl;

        try {
            const { default: WaveSurfer } = await loadWaveSurfer();
            if (this.isDestroyed) return;

            this.waveSurfer = WaveSurfer.create({
                container: this.elements.waveform,
                url: sourceUrl,
                height: window.innerWidth < 640 ? 72 : 92,
                waveColor: '#35c7ff',
                progressColor: '#6dffb8',
                cursorColor: '#f8fafc',
                barWidth: window.innerWidth < 640 ? 2 : 3,
                barGap: 2,
                barRadius: 999,
                normalize: true,
                dragToSeek: true
            });

            this.bind(this.elements.playButton, 'click', () => this.waveSurfer?.playPause());
            this.bind(this.elements.volume, 'input', (event) => {
                this.waveSurfer?.setVolume(Number(event.target.value));
            });
            this.bind(this.elements.progress, 'input', (event) => {
                this.isScrubbing = true;
                const duration = this.waveSurfer?.getDuration?.() || 0;
                const nextTime = (Number(event.target.value) / 1000) * duration;
                this.updateTime(nextTime, duration);
            });
            this.bind(this.elements.progress, 'change', (event) => {
                const ratio = Number(event.target.value) / 1000;
                this.waveSurfer?.seekTo(Math.max(0, Math.min(1, ratio)));
                this.isScrubbing = false;
            });

            this.waveSurfer.on('ready', () => {
                this.updateTime(0, this.waveSurfer.getDuration());
                this.waveSurfer.setVolume(Number(this.elements.volume?.value || 1));
                this.updatePlayState();
            });
            this.waveSurfer.on('timeupdate', (currentTime) => {
                this.updateTime(currentTime, this.waveSurfer.getDuration());
            });
            this.waveSurfer.on('play', () => this.updatePlayState());
            this.waveSurfer.on('pause', () => this.updatePlayState());
            this.waveSurfer.on('finish', () => {
                this.updatePlayState();
                this.updateTime(this.waveSurfer.getDuration(), this.waveSurfer.getDuration());
            });
            this.waveSurfer.on('error', (error) => {
                console.error('[AudioPlayer] WaveSurfer error:', error);
                this.showFallback(sourceUrl);
            });
        } catch (error) {
            console.error('[AudioPlayer] Failed to initialize custom player:', error);
            this.showFallback(sourceUrl);
        }
    }

    showFallback(sourceUrl = this.sourceUrl, message = null) {
        if (!sourceUrl) {
            this.container.innerHTML = `<div class="file-placeholder">${message || 'Audio file unavailable.'}</div>`;
            return;
        }

        this.destroyWaveSurferOnly();
        this.container.innerHTML = `
            <section class="audio-player-card audio-player-card-fallback">
                <div class="audio-player-fallback-note">${message || 'Waveform preview unavailable. Using standard audio playback.'}</div>
                ${buildFallbackMarkup(sourceUrl, this.submission.file_type)}
            </section>
        `;
    }

    destroyWaveSurferOnly() {
        if (this.waveSurfer) {
            this.waveSurfer.destroy();
            this.waveSurfer = null;
        }
    }

    destroy() {
        this.isDestroyed = true;
        this.boundHandlers.forEach((unbind) => unbind());
        this.boundHandlers = [];
        this.destroyWaveSurferOnly();
    }
}
