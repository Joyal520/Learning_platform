const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'assets', 'css', 'styles.css');
let content = fs.readFileSync(filePath, 'utf8');

const cssToAppend = `

/* =========================================
   VIDEO CONTENT MODULE STYLES
   ========================================= */

/* Upload Form: Video Input Group */
.video-url-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.video-url-icon {
    position: absolute;
    left: 1rem;
    font-size: 1.25rem;
    pointer-events: none;
}

.video-url-field {
    padding-left: 3.2rem !important;
    font-family: inherit;
    font-size: 0.95rem;
}

.video-url-status {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    animation: fadeInHalf 0.3s ease;
}

.video-url-status.valid {
    background: rgba(34, 197, 94, 0.1);
    color: #15803d;
    border: 1px solid rgba(34, 197, 94, 0.2);
}

.video-url-status.invalid {
    background: rgba(239, 68, 68, 0.1);
    color: #b91c1c;
    border: 1px solid rgba(239, 68, 68, 0.2);
}

/* Explore Feed: Video Card (Learning Stream Layout) */
.video-feed-card {
    width: 100%;
    margin-bottom: 2rem;
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    overflow: hidden;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.video-feed-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-lg);
}

.video-feed-shell {
    display: flex;
    flex-direction: column;
}

.video-feed-creator-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
}

.video-feed-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, #e2e8f0, #cbd5e1);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.video-feed-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.video-feed-avatar-fallback {
    font-weight: 700;
    color: #475569;
    font-size: 1.1rem;
}

.video-feed-creator-copy {
    display: flex;
    flex-direction: column;
}

.video-feed-creator-name {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
}

.video-feed-time {
    font-size: 0.8rem;
    color: var(--text-muted);
}

.video-feed-player {
    position: relative;
    width: 100%;
    padding-bottom: 56.25%; /* 16:9 Aspect Ratio */
    background: #000;
    margin: 0;
}

.video-feed-player iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border: none;
}

.video-feed-player iframe::-webkit-media-controls-fullscreen-button {
    display: none !important;
}

.video-feed-thumbnail {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.video-feed-play-btn {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s, background 0.2s;
}

.video-feed-play-btn svg {
    width: 28px;
    height: 28px;
    color: #fff;
    margin-left: 4px;
}

.video-feed-play-btn:hover {
    transform: scale(1.1);
    background: rgba(239, 68, 68, 0.9);
}

.video-feed-player-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1e293b;
}

.video-feed-fallback-content {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #94a3b8;
}

.video-feed-fallback-icon {
    font-size: 3rem;
    opacity: 0.5;
    margin-bottom: 0.5rem;
    display: block;
}

.video-feed-footer {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.video-feed-meta {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.video-feed-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.4;
}

.video-feed-attribution {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
}

.video-feed-channel-link,
.video-feed-channel-name {
    color: var(--text-muted);
    font-weight: 500;
}

.video-feed-channel-link:hover {
    color: var(--accent-light);
    text-decoration: underline;
}

.video-feed-source-badge {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
}

.video-feed-stats {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
}

.video-feed-stat {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--text-muted);
    font-size: 0.9rem;
    font-weight: 500;
    background: none;
    border: none;
    padding: 0;
    cursor: default;
}

.video-feed-like-btn {
    cursor: pointer;
    transition: color 0.2s;
}

.video-feed-like-btn:hover {
    color: var(--accent-light);
}

.video-feed-like-btn.is-active {
    color: #ef4444;
}

.video-feed-like-btn.is-active svg {
    fill: currentColor;
}

.video-feed-stat svg,
.video-feed-share svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
}

.video-feed-share {
    margin-left: auto;
    color: #25D366; /* WhatsApp Green */
    opacity: 0.8;
    transition: opacity 0.2s, transform 0.2s;
    display: flex;
    align-items: center;
}

.video-feed-share:hover {
    opacity: 1;
    transform: scale(1.1);
}

/* Dark Theme Adjustments */
html[data-theme="dark"] .video-feed-card {
    background: var(--bg-card);
    border-color: rgba(255, 255, 255, 0.05);
}

html[data-theme="dark"] .video-feed-creator-row,
html[data-theme="dark"] .video-feed-stats {
    border-color: rgba(255, 255, 255, 0.05);
}

/* Responsive */
@media (max-width: 640px) {
    .video-feed-card {
        border-radius: 0;
        border-left: none;
        border-right: none;
        margin-bottom: 1rem;
        margin-left: 0;
        margin-right: 0;
    }
    
    .video-feed-player {
        margin: 0;
    }
}
`;

if (!content.includes('VIDEO CONTENT MODULE STYLES')) {
    content += cssToAppend;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Appended video styles to styles.css');
} else {
    console.log('Styles already exist in styles.css');
}
