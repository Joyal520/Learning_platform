import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';

export const ExplorePage = {
    _currentCategory: 'all',
    _isLoading: false,
    _allFetchedData: [],  // holds all fetched submissions for Load More
    _displayCount: 6,     // initial items to show per section
    _loadMoreStep: 6,     // how many more to show each click

    async init() {
        this._currentCategory = 'all';
        this._isLoading = false;
        this._allFetchedData = [];
        this._displayCount = 6;

        // Always re-query DOM elements fresh (avoids stale reference from cloning)
        const getSearchInput = () => document.querySelector('#search-input');
        const getCategoryFilters = () => document.querySelector('#category-filters');

        const loadAllSections = async (isLoadMore = false) => {
            if (this._isLoading) return;
            this._isLoading = true;

            const gridTrending = document.querySelector('#grid-trending');
            const gridNew = document.querySelector('#grid-new');
            const gridTop = document.querySelector('#grid-top');
            const searchInput = getSearchInput();

            const category = this._currentCategory === 'all' ? null : this._currentCategory;
            const search = searchInput?.value?.toLowerCase()?.trim() || '';

            // Show skeletons only on initial load or filter change
            if (!isLoadMore) {
                [gridTrending, gridNew, gridTop].forEach(g => {
                    if (g) g.innerHTML = this.renderSkeletons(3);
                });
            }

            try {
                let filteredData = [];
                // Fetch a good batch of data if not loading more, or if we need more
                if (!isLoadMore || this._allFetchedData.length === 0) {
                    const { data, error } = await API.getSubmissions(category, 'created_at', 50, 0);
                    if (error) throw error;
                    filteredData = data || [];
                } else {
                    filteredData = this._allFetchedData;
                    // Re-apply search locally since we didn't fetch via API
                    if (search) {
                       filteredData = filteredData.filter(s =>
                           s.title?.toLowerCase().includes(search) ||
                           s.profiles?.display_name?.toLowerCase().includes(search)
                       );
                    }
                }

                // Apply search filter
                if (search) {
                    filteredData = filteredData.filter(s =>
                        s.title?.toLowerCase().includes(search) ||
                        s.profiles?.display_name?.toLowerCase().includes(search)
                    );
                }

                // Fetch stats for all items if we fetched from API
                if ((!isLoadMore || this._allFetchedData.length === 0) && filteredData.length > 0) {
                    const ids = filteredData.map(s => s.id);
                    const statsMap = await API.getStatsForSubmissions(ids);
                    filteredData.forEach(s => {
                        const initStat = statsMap[s.id] || { avg_rating: 0, like_count: 0, view_count: 0 };
                        s.submission_stats = [initStat];
                    });
                    // Store for Load More
                    this._allFetchedData = filteredData;
                }

                // Determine if this is images category (uses different card rendering)
                const isImages = this._currentCategory === 'images';

                // --- Trending section ---
                const trending = [...filteredData].sort((a, b) => {
                    const sA = a.submission_stats[0];
                    const sB = b.submission_stats[0];
                    if (sB.like_count !== sA.like_count) return (sB.like_count || 0) - (sA.like_count || 0);
                    return (sB.view_count || 0) - (sA.view_count || 0);
                }).slice(0, 3);

                this._renderGrid(gridTrending, trending, { text: '🔥 TRENDING', className: 'badge-trending' }, isImages);

                // --- New section ---
                const newItems = filteredData.slice(0, this._displayCount);
                this._renderGrid(gridNew, newItems, { text: '✨ NEW', className: 'badge-new' }, isImages);

                // --- Top rated section ---
                const topRated = [...filteredData].sort((a, b) => {
                    const avgA = Number(a.submission_stats[0].avg_rating) || 0;
                    const avgB = Number(b.submission_stats[0].avg_rating) || 0;
                    return avgB - avgA;
                }).slice(0, this._displayCount);

                this._renderGrid(gridTop, topRated, { text: '⭐ TOP RATED', className: 'badge-top' }, isImages);

                // Update Load More button visibility
                this._updateLoadMoreButton();

            } catch (err) {
                console.warn('[Explore] Load error:', err);
                [gridTrending, gridNew, gridTop].forEach(g => {
                    if (g) {
                        g.innerHTML = `
                            <div class="sd-empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                                <span style="font-size: 2rem;">⚠️</span>
                                <h3>Connection issue</h3>
                                <p class="text-muted">Could not load content. Please try again.</p>
                                <button class="btn btn-primary explore-retry-btn" style="margin-top: 16px;">Retry</button>
                            </div>`;
                        const retryBtn = g.querySelector('.explore-retry-btn');
                        if (retryBtn) retryBtn.addEventListener('click', () => loadAllSections(), { once: true });
                    }
                });
            }

            this._isLoading = false;
        };

        // Category filter click handling
        const categoryFilters = getCategoryFilters();
        if (categoryFilters) {
            // Clone to remove old listeners
            const newFilters = categoryFilters.cloneNode(true);
            categoryFilters.parentNode.replaceChild(newFilters, categoryFilters);
            newFilters.addEventListener('click', async (e) => {
                const chip = e.target.closest('.category-clay-item');
                if (!chip) return;
                newFilters.querySelectorAll('.category-clay-item').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this._currentCategory = chip.dataset.category;
                this._displayCount = 6; // reset on category change
                await loadAllSections();
            });
        }

        // Search input handling
        const searchInput = getSearchInput();
        if (searchInput) {
            const newSearch = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearch, searchInput);
            newSearch.addEventListener('input', UI.debounce(async () => {
                this._displayCount = 6; // reset on search change
                await loadAllSections();
            }, 500));
        }

        // Load More button handling
        const loadMoreBtn = document.querySelector('#explore-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', async () => {
                this._displayCount += this._loadMoreStep;
                loadMoreBtn.classList.add('loading');
                loadMoreBtn.disabled = true;
                await loadAllSections(true);
                loadMoreBtn.classList.remove('loading');
                loadMoreBtn.disabled = false;
            });
        }

        await loadAllSections();
    },

    _renderGrid(gridEl, items, badgeObj, isImages) {
        if (!gridEl) return;

        if (items.length === 0) {
            gridEl.innerHTML = `<p class="text-muted text-center" style="grid-column: 1/-1; padding: 40px;">No matching works found.</p>`;
            return;
        }

        if (isImages) {
            gridEl.classList.add('masonry-grid');
            gridEl.innerHTML = items.map(w => UI.renderMasonryCard(w)).join('');
            this.setupMasonryInteractions(gridEl);
        } else {
            gridEl.classList.remove('masonry-grid');
            gridEl.innerHTML = items.map(w => UI.renderCard(w, badgeObj)).join('');
        }
    },

    _updateLoadMoreButton() {
        const btn = document.querySelector('#explore-load-more');
        if (!btn) return;

        const totalAvailable = this._allFetchedData.length;
        // Show the button if we have more items than currently displayed
        if (totalAvailable > this._displayCount) {
            btn.style.display = 'inline-flex';
            const remaining = totalAvailable - this._displayCount;
            btn.querySelector('.load-more-text').textContent = `Load More (${remaining} more)`;
        } else {
            btn.style.display = 'none';
        }
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
    },

    setupMasonryInteractions(gridEl) {
        if (!gridEl) return;

        gridEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('.interaction-btn');
            const img = e.target.closest('.masonry-img');
            
            if (btn) {
                e.stopPropagation();
                const user = App.user;
                if (!user) return UI.showToast('Please login to interact', 'error');

                const subId = btn.dataset.id;
                
                if (btn.classList.contains('btn-like')) {
                    const { action, error } = await API.toggleLike(subId, user.id);
                    if (!error) {
                        const isLiked = action === 'liked';
                        gridEl.querySelectorAll(`.btn-like[data-id="${subId}"]`).forEach(el => {
                            el.classList.toggle('liked', isLiked);
                            const countSpan = el.querySelector('.like-count');
                            if (countSpan) {
                                countSpan.textContent = parseInt(countSpan.textContent) + (isLiked ? 1 : -1);
                            }
                        });
                        UI.showToast(isLiked ? 'Liked!' : 'Unliked');
                    }
                } else if (btn.classList.contains('btn-save')) {
                    const { action, error } = await API.toggleBookmark(subId, user.id);
                    if (!error) {
                        const isSaved = action === 'saved';
                        gridEl.querySelectorAll(`.btn-save[data-id="${subId}"]`).forEach(el => {
                            el.classList.toggle('bookmarked', isSaved);
                        });
                        UI.showToast(isSaved ? 'Saved to collection!' : 'Removed from collection');
                    }
                }
            } else {
                const imgWrapper = e.target.closest('.masonry-image-wrapper');
                const card = e.target.closest('.masonry-item');
                if (imgWrapper && card) {
                    const fullUrl = card.dataset.fullUrl;
                    const title = imgWrapper.querySelector('.masonry-img')?.alt || 'Image';
                    UI.showImageLightbox(fullUrl, title);
                }
            }
        });
    }
};
