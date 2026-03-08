import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';

export const ExplorePage = {
    _currentCategory: 'all',
    _offset: 0,
    _limit: 8,
    _isLoading: false,
    _hasMore: true,

    async init() {
        const grid = document.querySelector('#explore-grid');
        const searchInput = document.querySelector('#search-input');
        const categoryFilters = document.querySelector('#category-filters');
        const loadMoreBtn = document.querySelector('#btn-load-more');
        const noMoreMsg = document.querySelector('#no-more-msg');
        const loader = document.querySelector('#explore-loader');

        this._currentCategory = 'all';
        this._offset = 0;
        this._isLoading = false;
        this._hasMore = true;

        const loadSubmissions = async (append = false) => {
            if (this._isLoading) return;
            this._isLoading = true;

            if (!append) {
                grid.innerHTML = this.renderSkeletons(8);
                this._offset = 0;
                loadMoreBtn?.classList.add('hidden');
                noMoreMsg?.classList.add('hidden');
            } else {
                loader?.classList.remove('hidden');
            }

            const category = this._currentCategory === 'all' ? null : this._currentCategory;
            const search = searchInput?.value.toLowerCase();

            // Requirements: 8 cards, newest first
            const { data, error } = await API.getSubmissions(category, 'created_at', this._limit, this._offset);

            this._isLoading = false;
            loader?.classList.add('hidden');

            if (error) {
                console.warn('[Explore] Load error:', error);
                if (!append) {
                    grid.innerHTML = `
                        <div class="sd-empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                            <span style="font-size: 2rem;">⚠️</span>
                            <h3>Connection issue</h3>
                            <p class="text-muted">Could not load submissions. Please try again.</p>
                            <button class="btn btn-primary" id="explore-retry-btn" style="margin-top: 16px;">Retry</button>
                        </div>`;
                    document.getElementById('explore-retry-btn')?.addEventListener('click', () => loadSubmissions(false));
                } else {
                    UI.showToast('Error loading more submissions', 'error');
                }
                return;
            }

            let filteredData = data || [];
            if (search) {
                filteredData = filteredData.filter(s =>
                    s.title.toLowerCase().includes(search) ||
                    s.profiles?.display_name?.toLowerCase().includes(search)
                );
            }

            if (!append && filteredData.length === 0) {
                grid.innerHTML = `<p class="text-muted text-center p-40">No matching works found.</p>`;
                this._hasMore = false;
                return;
            }

            const cardsHtml = filteredData.map(sub => UI.renderCard(sub)).join('');

            if (append) {
                grid.insertAdjacentHTML('beforeend', cardsHtml);
            } else {
                grid.innerHTML = cardsHtml;
            }

            // Asynchronously load and update stats for this batch
            const ids = filteredData.map(s => s.id);
            API.getStatsForSubmissions(ids).then(statsMap => {
                ids.forEach(id => {
                    const st = statsMap[id];
                    if (st) {
                        const card = document.querySelector(`.content-card[data-id="${id}"]`);
                        if (card) {
                            const statsDiv = card.querySelector('.card-stats');
                            if (statsDiv) {
                                statsDiv.innerHTML = `
                                    <span>★ ${Number(st.avg_rating).toFixed(1)}</span>
                                    <span>❤ ${st.like_count}</span>
                                    <span>👁 ${st.view_count || 0}</span>
                                `;
                            }
                        }
                    }
                });
            }).catch(console.error);

            // Check if we have more to load
            this._hasMore = filteredData.length >= this._limit;
            if (this._hasMore) {
                loadMoreBtn?.classList.remove('hidden');
                noMoreMsg?.classList.add('hidden');
            } else {
                loadMoreBtn?.classList.add('hidden');
                if (grid.children.length > 0) {
                    noMoreMsg?.classList.remove('hidden');
                }
            }
        };

        // Handle category filter clicks
        categoryFilters?.addEventListener('click', async (e) => {
            const chip = e.target.closest('.category-clay-item');
            if (!chip) return;

            categoryFilters.querySelectorAll('.category-clay-item').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            this._currentCategory = chip.dataset.category;
            await loadSubmissions(false);
        });

        // Handle Load More
        loadMoreBtn?.addEventListener('click', async () => {
            this._offset += this._limit;
            await loadSubmissions(true);
        });

        // Debounced search
        searchInput?.addEventListener('input', UI.debounce(async () => {
            await loadSubmissions(false);
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
