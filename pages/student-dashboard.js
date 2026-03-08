// pages/student-dashboard.js
import { supabase } from '../assets/js/supabase.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';

export const StudentDashboardPage = {
    async init() {
        if (!App.user) {
            window.location.hash = 'login';
            return;
        }

        const main = document.getElementById('main-content');
        const profile = App.profile || { display_name: 'Creator' };
        main.innerHTML = UI.pages.studentDashboard(profile);

        // Load data in parallel for performance
        await Promise.all([
            this.loadStats(),
            this.loadRecentCreations(),
            this.loadLeaderboard(),
            this.loadActivityFeed(),
            this.loadSavedCreations()
        ]);

        // Setup horizontal scroll controls for saved creations
        this.setupSavedScroll();

        // Initialize animated counters after data loads
        this.animateCounters();
    },

    async loadStats() {
        const userId = App.user.id;

        try {
            // Get user's approved submissions count
            const { count: worksCount } = await supabase
                .from('submissions')
                .select('*', { count: 'exact', head: true })
                .eq('author_id', userId)
                .eq('status', 'approved');

            // Get all user submission IDs for stats lookup
            const { data: userSubs } = await supabase
                .from('submissions')
                .select('id')
                .eq('author_id', userId)
                .eq('status', 'approved');

            let totalLikes = 0;
            let totalRating = 0;
            let totalViews = 0;
            let ratedCount = 0;

            if (userSubs && userSubs.length > 0) {
                const subIds = userSubs.map(s => s.id);

                // Fetch likes directly from likes table
                try {
                    const { count: likeCount } = await supabase
                        .from('likes')
                        .select('id', { count: 'exact', head: true })
                        .in('submission_id', subIds);
                    totalLikes = likeCount || 0;
                } catch (e) { console.warn('Likes count error:', e); }

                // Fetch ratings directly from ratings table
                try {
                    const { data: ratingsData } = await supabase
                        .from('ratings')
                        .select('rating')
                        .in('submission_id', subIds);
                    if (ratingsData && ratingsData.length > 0) {
                        const sum = ratingsData.reduce((acc, r) => acc + r.rating, 0);
                        totalRating = sum / ratingsData.length;
                        ratedCount = ratingsData.length;
                    }
                } catch (e) { console.warn('Ratings count error:', e); }

                // Fetch views directly from views table
                try {
                    const { count: viewCount } = await supabase
                        .from('views')
                        .select('id', { count: 'exact', head: true })
                        .in('submission_id', subIds);
                    totalViews = viewCount || 0;
                } catch (e) { console.warn('Views count error:', e); }
            }

            const avgRating = ratedCount > 0 ? totalRating.toFixed(1) : '0.0';

            // Calculate rank
            const { data: allProfiles } = await supabase.from('profiles').select('id');
            let rank = 1;
            if (allProfiles) {
                rank = Math.max(1, allProfiles.length - (worksCount || 0) + 1);
                if (rank > allProfiles.length) rank = allProfiles.length;
            }

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
            if (elRank) { elRank.setAttribute('data-target', rank); elRank.textContent = `#${rank}`; }

            // Update new leaderboard rank badge if it exists
            const elRankBadge = document.getElementById('sd-user-rank-badge');
            if (elRankBadge) elRankBadge.textContent = `#${rank}`;

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

            // Fetch recent likes on user's submissions (exclude self-likes)
            const { data: recentLikes } = await supabase
                .from('likes')
                .select('id, submission_id, user_id, created_at, profiles!user_id(display_name)')
                .in('submission_id', subIds)
                .neq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            // Fetch recent ratings on user's submissions (exclude self-ratings)
            const { data: recentRatings } = await supabase
                .from('ratings')
                .select('id, submission_id, user_id, rating, created_at, profiles!user_id(display_name)')
                .in('submission_id', subIds)
                .neq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

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
            const { data: allSubs, error } = await supabase
                .from('submissions')
                .select('id, author_id, profiles!author_id(display_name)')
                .eq('status', 'approved')
                .limit(200);

            if (error) throw error;

            if (!allSubs || allSubs.length === 0) {
                const podium = document.getElementById('sd-lb-podium');
                if (podium) podium.innerHTML = '<p class="text-muted">No creators yet this week.</p>';
                return;
            }

            // Get like counts
            const subIds = allSubs.map(s => s.id);
            let likesMap = {};
            const { data: likesData } = await supabase
                .from('likes')
                .select('submission_id')
                .in('submission_id', subIds);

            if (likesData) {
                likesData.forEach(l => {
                    likesMap[l.submission_id] = (likesMap[l.submission_id] || 0) + 1;
                });
            }

            // Aggregate by author
            const authorMap = {};
            allSubs.forEach(sub => {
                const authorId = sub.author_id;
                const name = sub.profiles?.display_name || 'Anonymous';
                const likes = likesMap[sub.id] || 0;

                if (!authorMap[authorId]) {
                    authorMap[authorId] = { name, points: 0 };
                }
                authorMap[authorId].points += likes;
            });

            // Store full top 10
            this._leaderboardData = Object.values(authorMap)
                .sort((a, b) => b.points - a.points)
                .slice(0, 10);

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

        podium.innerHTML = reordered.map((creator, i) => {
            const config = podiumConfig[i];
            const initials = creator.name.charAt(0).toUpperCase();
            const topPoints = top3[0]?.points || 1;
            const progress = creator.placeholder ? 0 : Math.min(100, (creator.points / topPoints) * 100);

            const isFirst = config.rank === 1;
            const crownHtml = isFirst ? `<div class="sd-podium-crown">👑</div>` : '';

            return `
                <div class="sd-podium-item ${config.class} ${creator.placeholder ? 'placeholder' : ''}">
                    <div class="sd-podium-avatar-wrapper">
                        ${crownHtml}
                        <div class="sd-podium-avatar">${initials}</div>
                        <div class="sd-podium-rank-badge">${config.rank}</div>
                    </div>
                    <div class="sd-podium-base">
                        <div class="sd-podium-info">
                            <span class="sd-podium-name">${creator.name}</span>
                            <span class="sd-podium-badge">${config.badge}</span>
                            <div class="sd-podium-stats">
                                <span class="sd-podium-pts">${creator.points} pts</span>
                                <div class="sd-podium-progress"><div class="sd-pp-inner" style="width: ${progress}%"></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Render runners up (4-10)
        if (runners) {
            runners.innerHTML = rest.length > 0 ? rest.map((creator, i) => {
                const rank = i + 4;
                const initials = creator.name.charAt(0).toUpperCase();
                return `
                    <div class="sd-runner-item" style="--i: ${i}">
                        <span class="sd-runner-rank">${rank}</span>
                        <div class="sd-runner-avatar">${initials}</div>
                        <span class="sd-runner-name">${creator.name}</span>
                        <span class="sd-runner-points">${creator.points} pts</span>
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
