import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';

export const ExplorePage = {
    _currentCategory: 'all',
    _isLoading: false,

    async init() {
        UI.hideLoader(); // immediately drop the global router loader because we use our own neat skeleton loaders locally!
        const gridTrending = document.querySelector('#grid-trending');
        const gridNew = document.querySelector('#grid-new');
        const gridTop = document.querySelector('#grid-top');
        const searchInput = document.querySelector('#search-input');
        const categoryFilters = document.querySelector('#category-filters');

        this._currentCategory = 'all';
        this._isLoading = false;

        const loadSubmissions = async () => {
            if (this._isLoading) return;
            this._isLoading = true;

            if (gridTrending) gridTrending.innerHTML = this.renderSkeletons(3);
            if (gridNew) gridNew.innerHTML = this.renderSkeletons(3);
            if (gridTop) gridTop.innerHTML = this.renderSkeletons(3);

            const category = this._currentCategory === 'all' ? null : this._currentCategory;
            const search = searchInput?.value.toLowerCase();

            // Fetch a batch to sort locally. Using 50 ensures enough data to pull distinct top metrics.
            const { data, error } = await API.getSubmissions(category, 'created_at', 50, 0);

            if (this._fallbackTimer) clearTimeout(this._fallbackTimer);
            this._isLoading = false;

            if (error) {
                console.warn('[Explore] Load error:', error);

                // Graceful delay for mobile connection spikes
                await new Promise(r => setTimeout(r, 800));

                const errorHtml = `
                    <div class="sd-empty-state" style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                        <span style="font-size: 3rem;">🌐</span>
                        <h3 style="margin-top: 15px;">Connection is being shy...</h3>
                        <p class="text-muted">We couldn't reach the lab. Check your data and try again.</p>
                        <button class="btn btn-primary explore-retry-btn" style="margin-top: 24px; padding: 12px 32px;">Retry Now</button>
                    </div>`;
                if (gridTrending) gridTrending.innerHTML = errorHtml;
                if (gridNew) gridNew.innerHTML = errorHtml;
                if (gridTop) gridTop.innerHTML = errorHtml;
                document.querySelectorAll('.explore-retry-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        window.location.reload();
                    });
                });
                return;
            }

            let filteredData = data || [];
            if (search) {
                filteredData = filteredData.filter(s =>
                    s.title.toLowerCase().includes(search) ||
                    s.profiles?.display_name?.toLowerCase().includes(search)
                );
            }

            if (filteredData.length === 0) {
                const emptyHTML = `<p class="text-muted text-center p-40" style="grid-column: 1/-1;">No matching works found.</p>`;
                if (gridTrending) gridTrending.innerHTML = emptyHTML;
                if (gridNew) gridNew.innerHTML = emptyHTML;
                if (gridTop) gridTop.innerHTML = emptyHTML;
                return;
            }

            // Fetch and bind stats
            const ids = filteredData.map(s => s.id);
            const statsMap = await API.getStatsForSubmissions(ids);

            filteredData.forEach(s => {
                const initStat = statsMap[s.id] || { avg_rating: 0, like_count: 0, view_count: 0 };
                s.submission_stats = [initStat];
            });

            // Splitting data
            const newWorks = filteredData.slice(0, 3);

            const trendingWorks = [...filteredData].sort((a, b) => {
                const statsA = a.submission_stats[0];
                const statsB = b.submission_stats[0];
                if (statsB.like_count !== statsA.like_count) return (statsB.like_count || 0) - (statsA.like_count || 0);
                return (statsB.view_count || 0) - (statsA.view_count || 0);
            }).slice(0, 3);

            const topRatedWorks = [...filteredData].sort((a, b) => {
                const avgA = Number(a.submission_stats[0].avg_rating) || 0;
                const avgB = Number(b.submission_stats[0].avg_rating) || 0;
                return avgB - avgA;
            }).slice(0, 3);

            const renderRow = (works, gridEl, badgeObj) => {
                if (!gridEl) return;
                if (works.length === 0) {
                    gridEl.innerHTML = `<p class="text-muted text-center" style="grid-column: 1/-1;">Not enough data.</p>`;
                } else {
                    gridEl.innerHTML = works.map(w => UI.renderCard(w, badgeObj)).join('');
                }
            };

            renderRow(trendingWorks, gridTrending, { text: '🔥 TRENDING', className: 'badge-trending' });
            renderRow(newWorks, gridNew, { text: '✨ NEW', className: 'badge-new' });
            renderRow(topRatedWorks, gridTop, { text: '⭐ TOP RATED', className: 'badge-top' });
        };

        categoryFilters?.addEventListener('click', async (e) => {
            const chip = e.target.closest('.category-clay-item');
            if (!chip) return;

            categoryFilters.querySelectorAll('.category-clay-item').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            this._currentCategory = chip.dataset.category;
            await loadSubmissions();
        });

        searchInput?.addEventListener('input', UI.debounce(async () => {
            await loadSubmissions();
        }, 500));

        await loadSubmissions();
    },

    renderSkeletons(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-card glass-card">
                    <div class="skeleton-thumb"></div>
                    <div class="skeleton-line"></div>
                    <div class="skeleton-line short"></div>
                </div>
            `;
        }
        return html;
    }
};
