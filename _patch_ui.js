const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'assets', 'js', 'ui.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Insert renderVideoCard before renderCard
const renderVideoCardCode = `    renderVideoCard(sub) {
        this.registerSubmissionCardState(sub);
        const stats = this.ensureSubmissionStats(sub);
        const title = this.escapeHtml(sub.title || 'Untitled Video');
        const authorName = sub.profiles?.display_name || 'Anonymous';
        const avatarUrl = sub.profiles?.avatar_url || '';
        const initials = authorName.charAt(0).toUpperCase();
        const timestamp = this.formatRelativeTime(this.getSubmissionPrimaryTimestamp(sub));
        const shareUrl = this.createWhatsAppShareUrl(title, sub.id);

        let videoId = '';
        
        // Try to get videoId from JSON description first
        let videoMeta = {};
        try {
            videoMeta = typeof sub.description === 'string' && sub.description.startsWith('{')
                ? JSON.parse(sub.description)
                : {};
        } catch (_) {
            videoMeta = {};
        }
        
        videoId = videoMeta.videoId || '';
        
        // If no videoId in description, check file_url/public_url for YouTube URL
        if (!videoId) {
            const url = sub.file_url || sub.public_url || '';
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
                const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (match) videoId = match[1];
            }
        }
        
        const channelName = this.escapeHtml(videoMeta.channel?.name || 'Unknown Channel');
        const channelUrl = videoMeta.channel?.url || '';
        const videoTitle = this.escapeHtml(videoMeta.title || sub.title || 'Untitled Video');
        const embedUrl = videoId ? \`https://www.youtube.com/embed/\${videoId}?rel=0&modestbranding=1&fs=0&controls=1\` : '';
        const ytThumbnail = this.getYouTubeThumbnailUrl(videoId);
        const thumbnailUrl = sub.thumbnail_url || ytThumbnail;

        const channelHtml = channelUrl
            ? \`<a href="\${channelUrl}" target="_blank" rel="noopener noreferrer" class="video-feed-channel-link">\${channelName}</a>\`
            : \`<span class="video-feed-channel-name">\${channelName}</span>\`;

        const defaultThumbnail = 'https://img.youtube.com/vi/null/maxresdefault.jpg';
        const bgImage = thumbnailUrl ? \`url('\${thumbnailUrl}')\` : \`url('\${defaultThumbnail}')\`;

        return \`
            <article class="content-card clay-card video-feed-card animate-fade-in" data-id="\${sub.id}">
                <div class="video-feed-shell">
                    <div class="video-feed-creator-row">
                        <div class="video-feed-avatar">
                            \${avatarUrl
                                ? \`<img src="\${avatarUrl}" alt="\${authorName}" class="video-feed-avatar-img">\`
                                : \`<span class="video-feed-avatar-fallback">\${initials}</span>\`}
                        </div>
                        <div class="video-feed-creator-copy">
                            <h3 class="video-feed-creator-name">\${authorName}</h3>
                            <span class="video-feed-time">\${timestamp}</span>
                        </div>
                    </div>

\${embedUrl ? \`
                        <div class="video-feed-player" data-video-id="\${videoId}">
                            <div class="video-feed-thumbnail" style="background-image: url('\${thumbnailUrl}')">
                                <button class="video-feed-play-btn" aria-label="Play video">
                                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
                                </button>
                            </div>
                            <iframe
                                src="\${embedUrl}"
                                title="\${videoTitle}"
                                frameborder="0"
                                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerpolicy="strict-origin-when-cross-origin"
                                loading="lazy"
                                style="display:none;">
                            </iframe>
                        </div>
                    \` : \`
                        <div class="video-feed-player video-feed-player-fallback">
                            <div class="video-feed-fallback-content">
                                <span class="video-feed-fallback-icon">\\u{1F3AC}</span>
                                <p>Video unavailable</p>
                            </div>
                        </div>
                    \`}

                    <div class="video-feed-footer">
                        <div class="video-feed-meta">
                            <h3 class="card-title video-feed-title">\${videoTitle}</h3>
                            <div class="video-feed-attribution">
                                \${channelHtml}
                                <span class="video-feed-source-badge">YouTube</span>
                            </div>
                        </div>

                        <div class="video-feed-stats">
                            <button class="video-feed-stat video-feed-like-btn" type="button" data-video-action="like" data-id="\${sub.id}" aria-label="Like video">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="m12 21-1.45-1.32C5.4 15.02 2 11.93 2 8.13 2 5.04 4.42 2.5 7.5 2.5c1.74 0 3.41.81 4.5 2.09A5.94 5.94 0 0 1 16.5 2.5C19.58 2.5 22 5.04 22 8.13c0 3.8-3.4 6.89-8.55 11.55Z"></path>
                                </svg>
                                <span class="video-feed-like-count">\${stats.like_count || 0}</span>
                            </button>
                            <span class="video-feed-stat">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M1.5 12s3.8-7 10.5-7 10.5 7 10.5 7-3.8 7-10.5 7S1.5 12 1.5 12Z"></path>
                                    <circle cx="12" cy="12" r="3.2"></circle>
                                </svg>
                                <span>\${stats.view_count || 0}</span>
                            </span>
                            <a href="\${shareUrl}" target="_blank" rel="noopener noreferrer" class="video-feed-share" title="Share on WhatsApp" aria-label="Share on WhatsApp">
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.08.54 4.11 1.56 5.9L0 24l6.37-1.67a11.86 11.86 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.9-11.9a11.82 11.82 0 0 0-3.45-8.4Z"></path>
                                </svg>
                            </a>
                        </div>
                    </div>
                </div>
            </article>
        \`;
    },

`;

// Insert renderVideoCard before renderCard
const renderCardMarker = '    renderCard(sub, badgeObj = null) {';
const idx1 = content.indexOf(renderCardMarker);
if (idx1 === -1) { console.error('Could not find renderCard'); process.exit(1); }
content = content.slice(0, idx1) + renderVideoCardCode + content.slice(idx1);

// 2. Add video dispatch inside renderCard, before isExploreImmersiveCard check
const immersiveCheck = 'if (this.isExploreImmersiveCard(sub)) {';
const idx2 = content.indexOf(immersiveCheck);
if (idx2 === -1) { console.error('Could not find isExploreImmersiveCard check'); process.exit(1); }
const videoDispatch = `if (this.isVideoSubmission(sub)) {
            return this.renderVideoCard(sub);
        }

        `;
content = content.slice(0, idx2) + videoDispatch + content.slice(idx2);

// 3. Add video-input-group to upload page template
const imageGroupMarker = '<!-- Independent Image Flow Container -->';
const idx3 = content.indexOf(imageGroupMarker);
if (idx3 === -1) { console.error('Could not find image group marker'); process.exit(1); }
const videoInputGroup = `<!-- Video URL Input -->
                    <div id="video-input-group" class="form-group hidden">
                        <label>YouTube Video URL*</label>
                        <p class="text-muted text-sm mb-10">Paste a YouTube video link. We'll auto-fetch the title and channel info.</p>
                        <div class="video-url-input-wrapper">
                            <span class="video-url-icon">🎬</span>
                            <input type="url"
                                   name="video_url"
                                   id="video-url-input"
                                   class="form-control video-url-field"
                                   placeholder="https://youtube.com/watch?v=..."
                                   inputmode="url"
                                   autocomplete="url">
                        </div>
                        <div id="video-url-status" class="video-url-status hidden"></div>
                    </div>

                    `;
content = content.slice(0, idx3) + videoInputGroup + content.slice(idx3);

// 4. Update isExploreImmersiveCard to exclude video submissions
const immersiveAudioCheck = 'if (this.isAudioSubmission(sub) || this.isImageSubmission(sub)) return false;';
const idx4 = content.indexOf(immersiveAudioCheck);
if (idx4 !== -1) {
    content = content.slice(0, idx4) + 
        'if (this.isAudioSubmission(sub) || this.isImageSubmission(sub) || this.isVideoSubmission(sub)) return false;' + 
        content.slice(idx4 + immersiveAudioCheck.length);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ ui.js updated successfully');
console.log('  - renderVideoCard function added');
console.log('  - Video dispatch in renderCard added');
console.log('  - Video URL input group added to upload template');
console.log('  - isExploreImmersiveCard updated to exclude video');
