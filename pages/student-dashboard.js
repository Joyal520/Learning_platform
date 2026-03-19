// pages/student-dashboard.js
import { supabase } from '../assets/js/supabase.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';
import { API } from '../assets/js/api.js';

export const StudentDashboardPage = {
    async init() {
        if (!App.user) {
            window.location.hash = 'login';
            return;
        }

        const main = document.getElementById('main-content');
        const profile = App.profile || { display_name: 'Creator' };
        main.innerHTML = UI.pages.studentDashboard(profile);

        // Setup horizontal scroll controls for saved creations
        this.setupSavedScroll();

        // Make the page usable immediately, then fill sections independently.
        this.loadStats();
        this.loadRecentCreations();
        this.loadLeaderboard();
        this.loadActivityFeed();
        this.loadSavedCreations();
    },

    async getCreatorRankings() {
        if (this._creatorRankingsPromise) {
            return this._creatorRankingsPromise;
        }

        this._creatorRankingsPromise = API.getTopCreators(500)
            .then(({ data, error }) => {
                if (error) throw error;
                this._creatorRankings = data || [];
                return this._creatorRankings;
            })
            .finally(() => {
                this._creatorRankingsPromise = null;
            });

        return this._creatorRankingsPromise;
    },

    async loadStats() {
        const userId = App.user.id;

        try {
            const worksCountPromise = supabase
                .from('submissions')
                .select('*', { count: 'exact', head: true })
                .eq('author_id', userId)
                .eq('status', 'approved');

            const userSubsPromise = supabase
                .from('submissions')
                .select('id')
                .eq('author_id', userId)
                .eq('status', 'approved');

            const [
                { count: worksCount },
                { data: userSubs },
                creatorRankings
            ] = await Promise.all([worksCountPromise, userSubsPromise, this.getCreatorRankings()]);

            let totalLikes = 0;
            let totalRating = 0;
            let totalViews = 0;
            let ratedCount = 0;

            if (userSubs && userSubs.length > 0) {
                const subIds = userSubs.map(s => s.id);

                try {
                    const { data: statsData } = await supabase
                        .from('submission_stats')
                        .select('like_count, avg_rating, view_count')
                        .in('id', subIds);

                    if (statsData) {
                        statsData.forEach(s => {
                            totalLikes += (s.like_count || 0);
                            totalViews += (s.view_count || 0);
                            if (s.avg_rating > 0) {
                                totalRating += Number(s.avg_rating);
                                ratedCount++;
                            }
                        });
                    }
                } catch (e) { console.warn('Stats lookup error:', e); }
            }

            const avgRating = ratedCount > 0 ? (totalRating / ratedCount).toFixed(1) : '0.0';

            const rankIndex = creatorRankings.findIndex((creator) => creator.id === userId);
            const rank = rankIndex >= 0 ? rankIndex + 1 : 0;

            // Update DOM — set data-target AND text content directly
            const elWorks = document.getElementById('sd-stat-works');
            const elLikes = document.getElementById('sd-stat-likes');
            const elRating = document.getElementById('sd-stat-rating');
            const elViews = document.getElementById('sd-stat-views');
            const elRank = document.getElementById('sd-stat-rank');

            if (elWorks) { elWorks.setAttribute('data-target', worksCount || 0); elWorks.textContent = worksCount || 0; }
            if (elLikes) { elLikes.setAttribute('data-target', totalLikes); elLikes.textContent = totalLikes; }
            if (elRating) { elRating.setAttribute('data-target', avgRating); elRating.textContent = avgRating; }
            if (elViews) { elViews.setAttribute('data-target', totalViews); elViews.textContent = totalViews; }
            if (elRank) {
                elRank.setAttribute('data-target', rank);
                elRank.textContent = rank > 0 ? `#${rank}` : '#—';
            }

            // Update new leaderboard rank badge if it exists
            const elRankBadge = document.getElementById('sd-user-rank-badge');
            if (elRankBadge) elRankBadge.textContent = rank > 0 ? `#${rank}` : '#--';

            this.animateCounters();

        } catch (err) {
            console.warn('[StudentDashboard] Stats load error:', err);
        }
    },

    async loadRecentCreations() {
        const userId = App.user.id;
        const grid = document.getElementById('sd-recent-grid');
        if (!grid) return;

        try {
            // Step 1: Fetch submissions WITHOUT submission_stats join (more reliable)
            const { data, error } = await supabase
                .from('submissions')
                .select(`
                    id, title, category, author_id, thumbnail_path, thumbnail_url,
                    status, created_at, updated_at,
                    profiles!author_id (display_name)
                `)
                .eq('author_id', userId)
                .order('created_at', { ascending: false })
                .limit(3);

            if (error) {
                console.error('[StudentDashboard] Recent creations query error:', error);
                grid.innerHTML = '<p class="text-muted" style="padding: 16px;">Could not load your creations.</p>';
                return;
            }

            if (!data || data.length === 0) {
                grid.innerHTML = `
                    <div class="sd-empty-state">
                        <span class="sd-empty-icon">✨</span>
                        <h3>No creations yet</h3>
                        <p>Start sharing your creativity with the world!</p>
                    </div>
                `;
                return;
            }

            // Add empty stats placeholder so renderCard doesn't break
            const cardsData = data.map(sub => {
                sub.submission_stats = [{ avg_rating: 0, like_count: 0 }];
                return sub;
            });

            grid.innerHTML = cardsData.map(sub => UI.renderCard(sub)).join('');

            // Step 2: Lazy load fresh stats (non-blocking)
            const ids = data.map(s => s.id);
            try {
                const { data: freshStats } = await supabase
                    .from('submission_stats')
                    .select('id, avg_rating, like_count, view_count')
                    .in('id', ids);

                if (freshStats) {
                    freshStats.forEach(stat => {
                        const card = grid.querySelector(`[data-id="${stat.id}"]`);
                        if (card) {
                            const statsEl = card.querySelector('.card-stats');
                            if (statsEl) {
                                statsEl.innerHTML = `
                                    <span>★ ${Number(stat.avg_rating).toFixed(1)}</span>
                                    <span>❤ ${stat.like_count}</span>
                                    <span>👁 ${stat.view_count || 0}</span>
                                `;
                            }
                        }
                    });
                }
            } catch (statsErr) {
                console.warn('[StudentDashboard] Stats fetch error (non-critical):', statsErr);
            }

        } catch (err) {
            console.warn('[StudentDashboard] Recent creations error:', err);
            grid.innerHTML = '<p class="text-muted">Could not load your creations.</p>';
        }
    },

    async loadActivityFeed() {
        const container = document.getElementById('sd-activity-feed');
        if (!container) return;

        const userId = App.user.id;

        try {
            // Get the user's submission IDs
            const { data: userSubs } = await supabase
                .from('submissions')
                .select('id, title')
                .eq('author_id', userId);

            if (!userSubs || userSubs.length === 0) {
                container.innerHTML = `
                    <div class="sd-notif-empty">
                        <span>📭</span>
                        <p>No activity yet. Upload a creation to start getting engagement!</p>
                    </div>
                `;
                return;
            }

            const subIds = userSubs.map(s => s.id);
            const subTitleMap = {};
            userSubs.forEach(s => { subTitleMap[s.id] = s.title; });

            const [recentLikesResult, recentRatingsResult] = await Promise.all([
                supabase
                    .from('likes')
                    .select('id, submission_id, user_id, created_at, profiles!user_id(display_name)')
                    .in('submission_id', subIds)
                    .neq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(10),
                supabase
                    .from('ratings')
                    .select('id, submission_id, user_id, rating, created_at, profiles!user_id(display_name)')
                    .in('submission_id', subIds)
                    .neq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(10)
            ]);

            const recentLikes = recentLikesResult.data;
            const recentRatings = recentRatingsResult.data;

            // Merge and sort by created_at
            const activities = [];

            if (recentLikes) {
                recentLikes.forEach(like => {
                    activities.push({
                        type: 'like',
                        icon: '❤️',
                        name: like.profiles?.display_name || 'Someone',
                        title: subTitleMap[like.submission_id] || 'your work',
                        time: like.created_at,
                        text: `${like.profiles?.display_name || 'Someone'} liked "${subTitleMap[like.submission_id] || 'your work'}"`
                    });
                });
            }

            if (recentRatings) {
                recentRatings.forEach(rating => {
                    const stars = '★'.repeat(rating.rating) + '☆'.repeat(5 - rating.rating);
                    activities.push({
                        type: 'rating',
                        icon: '⭐',
                        name: rating.profiles?.display_name || 'Someone',
                        title: subTitleMap[rating.submission_id] || 'your work',
                        time: rating.created_at,
                        text: `${rating.profiles?.display_name || 'Someone'} rated "${subTitleMap[rating.submission_id] || 'your work'}" ${stars}`
                    });
                });
            }

            // Sort by most recent
            activities.sort((a, b) => new Date(b.time) - new Date(a.time));

            // Take top 5
            const topActivities = activities.slice(0, 5);

            if (topActivities.length === 0) {
                container.innerHTML = `
                    <div class="sd-notif-empty">
                        <span>📭</span>
                        <p>No activity yet. Share your work and get noticed!</p>
                    </div>
                `;
                return;
            }

            container.innerHTML = topActivities.map(activity => `
                <div class="sd-notif-item">
                    <span class="sd-notif-icon">${activity.icon}</span>
                    <div class="sd-notif-content">
                        <p>${activity.text}</p>
                        <span class="sd-notif-time">${this.timeAgo(activity.time)}</span>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            console.warn('[StudentDashboard] Activity feed error:', err);
            container.innerHTML = '<p class="text-muted" style="padding: 16px;">Could not load activity feed.</p>';
        }
    },

    async loadSavedCreations() {
        const list = document.getElementById('sd-saved-list');
        if (!list) return;

        const userId = App.user.id;

        try {
            // Step 1: Get bookmark entries (simple query, no joins)
            const { data: bookmarks, error } = await supabase
                .from('bookmarks')
                .select('id, submission_id, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.warn('[StudentDashboard] Bookmarks query error:', error);
                list.innerHTML = `
                    <div class="sd-saved-placeholder" style="padding: 40px; text-align: center;">
                        <span style="font-size: 2rem; display: block; margin-bottom: 10px;">🔖</span>
                        <p class="text-muted">Bookmark feature requires database setup.</p>
                    </div>
                `;
                return;
            }

            if (!bookmarks || bookmarks.length === 0) {
                list.innerHTML = `
                    <div class="sd-saved-placeholder" style="padding: 40px; text-align: center;">
                        <span style="font-size: 2rem; display: block; margin-bottom: 10px;">🔖</span>
                        <p class="text-muted">No saved creations yet.</p>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">Use the bookmark button on any work to save it here.</p>
                    </div>
                `;
                return;
            }

            // Step 2: Fetch submission data WITHOUT submission_stats join
            const subIds = bookmarks.map(b => b.submission_id);
            const { data: submissions, error: subError } = await supabase
                .from('submissions')
                .select(`
                    id, title, category, author_id, thumbnail_path, thumbnail_url,
                    status, created_at, updated_at,
                    profiles!author_id (display_name)
                `)
                .in('id', subIds);

            if (subError) {
                console.warn('[StudentDashboard] Saved submissions query error:', subError);
                list.innerHTML = '<p class="text-muted" style="padding: 16px; text-align: center;">Could not load saved creations.</p>';
                return;
            }

            if (!submissions || submissions.length === 0) {
                list.innerHTML = `
                    <div class="sd-saved-placeholder" style="padding: 40px; text-align: center;">
                        <span style="font-size: 2rem; display: block; margin-bottom: 10px;">🔖</span>
                        <p class="text-muted">No saved creations yet.</p>
                    </div>
                `;
                return;
            }

            // Render bookmarked submissions as horizontal cards in the vertical list
            list.innerHTML = submissions.map(sub => {
                sub.submission_stats = [{ avg_rating: 0, like_count: 0, view_count: 0 }];
                return UI.pages.renderSavedCard(sub);
            }).join('');

        } catch (err) {
            console.warn('[StudentDashboard] Saved creations error:', err);
            const list = document.getElementById('sd-saved-list');
            if (list) list.innerHTML = '<p class="text-muted" style="padding: 16px;">Could not load saved creations.</p>';
        }
    },

    async loadLeaderboard() {
        try {
            const creatorRankings = await this.getCreatorRankings();

            if (!creatorRankings || creatorRankings.length === 0) {
                const podium = document.getElementById('sd-lb-podium');
                if (podium) podium.innerHTML = '<p class="text-muted">No creators yet this week.</p>';
                return;
            }

            this._leaderboardData = creatorRankings.slice(0, 10);

            // Render
            this.renderLeaderboard();

        } catch (err) {
            console.warn('[StudentDashboard] Leaderboard error:', err);
            const podium = document.getElementById('sd-lb-podium');
            if (podium) podium.innerHTML = '<p class="text-muted">Could not load leaderboard.</p>';
        }
    },

    renderLeaderboard() {
        const podium = document.getElementById('sd-lb-podium');
        const runners = document.getElementById('sd-lb-runners');
        if (!podium || !this._leaderboardData) return;

        const top3 = this._leaderboardData.slice(0, 3);
        const rest = this._leaderboardData.slice(3, 10);
        const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
        const getAvatarMarkup = (creator, className) => {
            const avatarUrl = creator?.avatar || creator?.avatar_url || creator?.profile_image_url || '';
            const displayName = creator?.name || creator?.display_name || 'Creator';
            const initial = displayName.trim().charAt(0).toUpperCase() || '?';
            const toneIndex = ((initial.charCodeAt(0) || 65) % 4) + 1;

            return avatarUrl
                ? `<img src="${escapeHtml(avatarUrl)}" class="${className}" alt="${escapeHtml(displayName)}">`
                : `<span class="${className} sd-avatar-fallback sd-avatar-tone-${toneIndex}" data-initial="${escapeHtml(initial)}">${escapeHtml(initial)}</span>`;
        };
        const getTodayPoints = (creator) => {
            const rawValue = creator?.points_today ?? creator?.pointsToday ?? creator?.today_points ?? creator?.todayPoints ?? creator?.daily_points ?? creator?.dailyPoints ?? null;
            const value = Number.isFinite(Number(rawValue)) ? Math.max(0, Number(rawValue)) : 0;
            if (value > 0) {
                return { className: 'positive', label: `+${value} today` };
            }

            return { className: 'muted', label: '0 today' };
        };
        const getMovementMeta = (creator) => {
            const rawValue = creator?.rank_change_today ?? creator?.rankChangeToday ?? creator?.rank_delta ?? creator?.rankDelta ?? creator?.movement ?? null;
            const value = Number.isFinite(Number(rawValue)) ? Number(rawValue) : null;

            if (value === null || value === 0) {
                return { className: 'neutral', label: '-' };
            }

            return value > 0
                ? { className: 'up', label: `+${value}` }
                : { className: 'down', label: `${value}` };
        };
        const getNextRankMeta = (creator, boardIndex) => {
            const previousCreator = this._leaderboardData[boardIndex - 1];
            const currentPoints = Number(creator?.points || 0);
            const previousPoints = Number(previousCreator?.points || 0);
            const targetPoints = previousPoints > currentPoints ? previousPoints : currentPoints + 1;
            const progress = targetPoints > 0 ? Math.min(100, (currentPoints / targetPoints) * 100) : 0;

            return { targetPoints, progress };
        };

        // Map colors and badges for podium
        const podiumConfig = [
            { rank: 2, class: 'silver', badge: 'Rising Star' },
            { rank: 1, class: 'gold', badge: 'Creative Champion' },
            { rank: 3, class: 'bronze', badge: 'Top Creator' }
        ];

        // Reorder for visual podium (2nd, 1st, 3rd)
        const reordered = [
            top3[1] || { name: '---', points: 0, placeholder: true },
            top3[0] || { name: '---', points: 0, placeholder: true },
            top3[2] || { name: '---', points: 0, placeholder: true }
        ];

        const confettiPieces = [
            { left: '8%', top: '6%', rotate: '-18deg', color: '#ffd562', delay: '-0.9s', duration: '5.4s', driftX: '-10px', driftY: '54px', width: '9px', height: '18px', radius: '999px' },
            { left: '16%', top: '2%', rotate: '16deg', color: '#8da7ff', delay: '-2.8s', duration: '6.1s', driftX: '9px', driftY: '58px', width: '10px', height: '16px', radius: '999px' },
            { left: '24%', top: '12%', rotate: '-24deg', color: '#7c5cff', delay: '-1.7s', duration: '5.7s', driftX: '-7px', driftY: '48px', width: '8px', height: '15px', radius: '4px' },
            { left: '31%', top: '5%', rotate: '24deg', color: '#ff9f67', delay: '-3.2s', duration: '6.4s', driftX: '11px', driftY: '56px', width: '11px', height: '18px', radius: '999px' },
            { left: '39%', top: '16%', rotate: '-14deg', color: '#6dd3c7', delay: '-0.6s', duration: '5.8s', driftX: '-8px', driftY: '46px', width: '8px', height: '14px', radius: '999px' },
            { left: '47%', top: '1%', rotate: '12deg', color: '#ffd562', delay: '-2.1s', duration: '6.2s', driftX: '6px', driftY: '60px', width: '10px', height: '17px', radius: '5px' },
            { left: '56%', top: '10%', rotate: '-18deg', color: '#ec7ab7', delay: '-3.6s', duration: '5.6s', driftX: '-9px', driftY: '50px', width: '9px', height: '16px', radius: '999px' },
            { left: '64%', top: '4%', rotate: '22deg', color: '#8da7ff', delay: '-1.3s', duration: '6.3s', driftX: '8px', driftY: '58px', width: '10px', height: '16px', radius: '4px' },
            { left: '72%', top: '15%', rotate: '-10deg', color: '#ffd562', delay: '-2.4s', duration: '5.9s', driftX: '-6px', driftY: '44px', width: '8px', height: '14px', radius: '999px' },
            { left: '80%', top: '6%', rotate: '18deg', color: '#7c5cff', delay: '-4.1s', duration: '6.5s', driftX: '10px', driftY: '54px', width: '10px', height: '18px', radius: '999px' },
            { left: '88%', top: '11%', rotate: '-16deg', color: '#6dd3c7', delay: '-1.9s', duration: '5.5s', driftX: '-8px', driftY: '48px', width: '9px', height: '15px', radius: '4px' }
        ];

        podium.innerHTML = `
            <div class="sd-lb-celebration">
                <div class="sd-lb-confetti" aria-hidden="true">
                    ${confettiPieces.map((piece) => `<span class="sd-lb-confetti-piece" style="left:${piece.left};top:${piece.top};--piece-rotate:${piece.rotate};--piece-color:${piece.color};--confetti-delay:${piece.delay};--confetti-duration:${piece.duration};--confetti-drift-x:${piece.driftX};--confetti-drift-y:${piece.driftY};--piece-width:${piece.width};--piece-height:${piece.height};--piece-radius:${piece.radius};"></span>`).join('')}
                </div>
                <div class="sd-lb-stars" aria-hidden="true">
                    <span class="sd-lb-star sd-lb-star-a">★</span>
                    <span class="sd-lb-star sd-lb-star-b">★</span>
                    <span class="sd-lb-star sd-lb-star-c">★</span>
                    <span class="sd-lb-star sd-lb-star-d">★</span>
                </div>
                <div class="sd-lb-podium-stage sd-podium-layout-v2">
                    ${reordered.map((creator, i) => {
                        const config = podiumConfig[i];
                        const creatorName = escapeHtml(creator.name || '---');
                        const avatarHtml = getAvatarMarkup(creator, 'sd-lb-avatar-img');
                        const topPoints = top3[0]?.points || 1;
                        const progress = creator.placeholder ? 0 : Math.min(100, (creator.points / topPoints) * 100);
                        const isFirst = config.rank === 1;
                        const isCurrentUser = creator?.id && App.user?.id && creator.id === App.user.id;
                        const crownHtml = isFirst ? '<div class="sd-podium-crown" aria-hidden="true">👑</div>' : '';

                        return `
                            <div class="sd-podium-item ${config.class} ${creator.placeholder ? 'placeholder' : ''} ${isCurrentUser ? 'current-user' : ''}">
                                <div class="sd-podium-avatar-wrapper">
                                    ${crownHtml}
                                    <div class="sd-podium-avatar">${avatarHtml}</div>
                                    <div class="sd-podium-rank-badge">${config.rank}</div>
                                </div>
                                <div class="sd-podium-base">
                                    <div class="sd-podium-top-ring"></div>
                                    <div class="sd-podium-info">
                                        <span class="sd-podium-name" title="${creatorName}">${creatorName}</span>
                                        <span class="sd-podium-badge">${config.badge}</span>
                                        <span class="sd-podium-pts">${creator.points} pts</span>
                                        <div class="sd-podium-progress"><div class="sd-pp-inner" style="width: ${progress}%"></div></div>
                                    </div>
                                    <div class="sd-podium-foot">
                                        <span class="sd-podium-foot-value">${creator.points} pts</span>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        if (runners) {
            runners.innerHTML = rest.length > 0 ? rest.map((creator, i) => {
                const rank = i + 4;
                const avatarHtml = getAvatarMarkup(creator, 'sd-lb-avatar-img');
                const movement = getMovementMeta(creator);
                const todayMeta = getTodayPoints(creator);
                const { targetPoints, progress } = getNextRankMeta(creator, rank - 1);
                const isCurrentUser = creator?.id && App.user?.id && creator.id === App.user.id;
                const creatorName = escapeHtml(creator.name || 'Unknown creator');

                return `
                    <div class="sd-lb-compact-row ${isCurrentUser ? 'is-current-user' : ''}" style="--i: ${i}">
                        <div class="sd-lb-compact-rank">
                            <span class="sd-lb-compact-rank-value">${rank}</span>
                            <span class="sd-lb-compact-move ${movement.className}">${movement.label}</span>
                        </div>
                        <div class="sd-lb-compact-avatar">${avatarHtml}</div>
                        <div class="sd-lb-compact-copy">
                            <span class="sd-lb-compact-name">${creatorName}</span>
                            <span class="sd-lb-compact-today ${todayMeta.className}">${todayMeta.label}</span>
                        </div>
                        <div class="sd-lb-compact-score">
                            <span class="sd-lb-compact-points">${creator.points} pts</span>
                            <span class="sd-lb-compact-next">Next: ${targetPoints}</span>
                        </div>
                        <div class="sd-lb-compact-progress">
                            <div class="sd-lb-compact-progress-meta">
                                <span class="sd-lb-compact-progress-current">${creator.points} pts</span>
                                <span class="sd-lb-compact-progress-target">${targetPoints}</span>
                            </div>
                            <div class="sd-lb-compact-progress-track">
                                <div class="sd-lb-compact-progress-fill" style="width: ${progress}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('') : '<p class="text-muted" style="text-align:center; font-size: 0.8rem; padding: 10px;">Climb higher to reach the top!</p>';
        }

        return;

        // Generate Confetti HTML
        let confettiHtml = '<div class="lb-confetti-container">';
        for (let i = 0; i < 40; i++) {
            const left = Math.random() * 100;
            const delay = Math.random() * 4;
            const duration = Math.random() * 2 + 3; // 3-5s
            const color = ['#7c5cff', '#5aa7ff', '#FFD700', '#f97316', '#22c55e', '#ec4899'][Math.floor(Math.random() * 6)];
            confettiHtml += `<div class="lb-confetti" style="left: ${left}%; animation-delay: -${delay}s; animation-duration: ${duration}s; background-color: ${color};"></div>`;
        }
        confettiHtml += '</div>';

        podium.innerHTML = confettiHtml + '<div style="display: flex; justify-content: center; align-items: flex-end; width: 100%; gap: 12px;">' + reordered.map((creator, i) => {
            const config = podiumConfig[i];
            const initials = creator.name.charAt(0).toUpperCase();
            const avatarHtml = creator.avatar ? `<img src="${creator.avatar}" class="sd-lb-avatar-img">` : initials;
            const topPoints = top3[0]?.points || 1;
            const progress = creator.placeholder ? 0 : Math.min(100, (creator.points / topPoints) * 100);

            const isFirst = config.rank === 1;
            const crownHtml = isFirst ? `<div class="sd-podium-crown">👑</div>` : '';

            return `
                <div class="sd-podium-item ${config.class} ${creator.placeholder ? 'placeholder' : ''}">
                    <div class="sd-podium-avatar-wrapper">
                        ${crownHtml}
                        <div class="sd-podium-avatar">${avatarHtml}</div>
                        <div class="sd-podium-rank-badge">${config.rank}</div>
                    </div>
                    <div class="sd-podium-base">
                        <div class="sd-podium-info">
                            <span class="sd-podium-name">${creator.name}</span>
                            <span class="sd-podium-badge">${config.badge}</span>
                            <span class="sd-podium-pts">${creator.points} pts</span>
                            <div class="sd-podium-progress"><div class="sd-pp-inner" style="width: ${progress}%"></div></div>
                        </div>
                    </div>
                </div>
            `;
        }).join('') + '</div>';

        // Render runners up (4-10)
        if (runners) {
            runners.innerHTML = rest.length > 0 ? rest.map((creator, i) => {
                const rank = i + 4;
                const initials = creator.name.charAt(0).toUpperCase();
                const avatarHtml = creator.avatar ? `<img src="${creator.avatar}" class="sd-lb-avatar-img">` : initials;

                const topPoints = top3[0]?.points || 1;
                const runnerProgress = Math.min(100, (creator.points / topPoints) * 100);

                return `
                    <div class="sd-runner-item" style="--i: ${i}">
                        <div class="sd-runner-top">
                            <span class="sd-runner-rank">${rank}</span>
                            <div class="sd-runner-avatar">${avatarHtml}</div>
                            <span class="sd-runner-name">${creator.name}</span>
                            <span class="sd-runner-points">${creator.points} pts</span>
                        </div>
                        <div class="sd-runner-progress-wrapper">
                            <div class="sd-runner-progress">
                                <div class="sd-runner-fill" style="width: ${runnerProgress}%"></div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('') : '<p class="text-muted" style="text-align:center; font-size: 0.8rem; padding: 10px;">Climb higher to reach the top!</p>';
        }
    },

    setupSavedScroll() {
        const parent = document.getElementById('sd-saved-scroll-parent');
        const btnPrev = document.getElementById('sd-saved-prev');
        const btnNext = document.getElementById('sd-saved-next');

        if (!parent || !btnPrev || !btnNext) return;

        const scrollAmount = 260; // card width + gap

        btnPrev.addEventListener('click', () => {
            parent.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });

        btnNext.addEventListener('click', () => {
            parent.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });

        // Hide/show arrows based on scroll position
        const toggleArrows = () => {
            btnPrev.style.opacity = parent.scrollLeft <= 5 ? '0.3' : '1';
            btnPrev.style.pointerEvents = parent.scrollLeft <= 5 ? 'none' : 'auto';

            const isAtEnd = parent.scrollLeft + parent.clientWidth >= parent.scrollWidth - 5;
            btnNext.style.opacity = isAtEnd ? '0.3' : '1';
            btnNext.style.pointerEvents = isAtEnd ? 'none' : 'auto';
        };

        parent.addEventListener('scroll', toggleArrows);
        window.addEventListener('resize', toggleArrows);
        setTimeout(toggleArrows, 500); // Initial check after load
    },

    // Utility: relative time string
    timeAgo(dateStr) {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);

        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
        if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString();
    },

    animateCounters() {
        const counters = document.querySelectorAll('.sd-counter');
        counters.forEach(counter => {
            const target = parseFloat(counter.getAttribute('data-target') || '0');
            if (target === 0) return;

            const isDecimal = String(target).includes('.');
            const isRank = counter.id === 'sd-stat-rank';
            const duration = 1200;
            const startTime = performance.now();

            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = target * eased;

                if (isRank) {
                    counter.textContent = `#${Math.round(current) || 1}`;
                } else if (isDecimal) {
                    counter.textContent = current.toFixed(1);
                } else {
                    counter.textContent = Math.round(current);
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };

            requestAnimationFrame(animate);
        });
    }
};
