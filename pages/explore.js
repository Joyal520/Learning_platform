import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';

export const ExplorePage = {
    _currentCategory: 'all',
    _isLoading: false,

    async init() {
        const gridTrending = document.querySelector('#grid-trending');
        const gridNew = document.querySelector('#grid-new');
        const gridTop = document.querySelector('#grid-top');
        const searchInput = document.querySelector('#search-input');
        const categoryFilters = document.querySelector('#category-filters');

        this._currentCategory = 'all';
        this._isLoading = false;

        const loadSection = async (gridEl, label, badgeObj, sortAndSliceFn) => {
            if (!gridEl) return;
            const category = this._currentCategory === 'all' ? null : this._currentCategory;
            const search = searchInput?.value.toLowerCase();

            gridEl.innerHTML = this.renderSkeletons(3);

            try {
                // Fetch independently to isolate failures
                const { data, error } = await API.getSubmissions(category, 'created_at', 50, 0);
                if (error) throw error;

                let filteredData = data || [];
                // Filtering: If 'all' is selected, hide images from the main feed as requested.
                if (this._currentCategory === 'all') {
                    filteredData = filteredData.filter(s => s.category !== 'images');
                }

                if (search) {
                    filteredData = filteredData.filter(s =>
                        s.title.toLowerCase().includes(search) ||
                        s.profiles?.display_name?.toLowerCase().includes(search)
                    );
                }

                if (filteredData.length === 0) {
                    gridEl.innerHTML = `<p class="text-muted text-center p-40" style="grid-column: 1/-1;">No matching works found.</p>`;
                    return;
                }

                const ids = filteredData.map(s => s.id);
                const statsMap = await API.getStatsForSubmissions(ids);

                filteredData.forEach(s => {
                    const initStat = statsMap[s.id] || { avg_rating: 0, like_count: 0, view_count: 0 };
                    s.submission_stats = [initStat];
                });

                const finalList = sortAndSliceFn(filteredData);

                const isImages = this._currentCategory === 'images';

                if (finalList.length === 0) {
                    gridEl.innerHTML = `<p class="text-muted text-center" style="grid-column: 1/-1;">Not enough data.</p>`;
                } else {
                    if (isImages) {
                        gridEl.classList.add('masonry-grid');
                        gridEl.innerHTML = finalList.map(w => UI.renderMasonryCard(w)).join('');
                        this.setupMasonryInteractions(gridEl);
                    } else {
                        gridEl.classList.remove('masonry-grid');
                        gridEl.innerHTML = finalList.map(w => UI.renderCard(w, badgeObj)).join('');
                    }
                }
            } catch (err) {
                console.warn(`[Explore] Load error for ${label}:`, err);
                const errorHtml = `
                    <div class="sd-empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <span style="font-size: 2rem;">⚠️</span>
                        <h3>Connection issue</h3>
                        <p class="text-muted">Could not load ${label}. Please try again.</p>
                        <button class="btn btn-primary explore-retry-btn" style="margin-top: 16px;">Retry</button>
                    </div>`;
                gridEl.innerHTML = errorHtml;
                const retryBtn = gridEl.querySelector('.explore-retry-btn');
                if (retryBtn) {
                    // Safe, isolated closure per section!
                    retryBtn.addEventListener('click', () => loadSection(gridEl, label, badgeObj, sortAndSliceFn), { once: true });
                }
            }
        };

        const loadAllSubmissions = async () => {
            if (this._isLoading) return;
            this._isLoading = true;

            const sortTrending = (arr) => [...arr].sort((a, b) => {
                const statsA = a.submission_stats[0];
                const statsB = b.submission_stats[0];
                if (statsB.like_count !== statsA.like_count) return (statsB.like_count || 0) - (statsA.like_count || 0);
                return (statsB.view_count || 0) - (statsA.view_count || 0);
            }).slice(0, 3);

            const sortNew = (arr) => arr.slice(0, 3);

            const sortTop = (arr) => [...arr].sort((a, b) => {
                const avgA = Number(a.submission_stats[0].avg_rating) || 0;
                const avgB = Number(b.submission_stats[0].avg_rating) || 0;
                return avgB - avgA;
            }).slice(0, 3);

            // Execute in parallel mapping to isolated handlers
            await Promise.all([
                loadSection(gridTrending, 'trending works', { text: '🔥 TRENDING', className: 'badge-trending' }, sortTrending),
                loadSection(gridNew, 'new works', { text: '✨ NEW', className: 'badge-new' }, sortNew),
                loadSection(gridTop, 'top rated works', { text: '⭐ TOP RATED', className: 'badge-top' }, sortTop)
            ]);

            this._isLoading = false;
        };

        // Handle category filter clicks
        if (categoryFilters) {
            // Remove old listeners by cloning or just rely on DOM replacement?
            // Existing code didn't cleanup, but we can just use the provided standard approach
            const handleCategoryClick = async (e) => {
                const chip = e.target.closest('.category-clay-item');
                if (!chip) return;

                categoryFilters.querySelectorAll('.category-clay-item').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');

                this._currentCategory = chip.dataset.category;
                await loadAllSubmissions();
            };
            // Cleanup existing listeners if any (by cloning)
            const newFilters = categoryFilters.cloneNode(true);
            categoryFilters.parentNode.replaceChild(newFilters, categoryFilters);
            newFilters.addEventListener('click', handleCategoryClick);
        }

        // Debounced search
        if (searchInput) {
            const newSearch = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearch, searchInput);
            newSearch.addEventListener('input', UI.debounce(async () => {
                await loadAllSubmissions();
            }, 500));
        }

        await loadAllSubmissions();
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
                        // Toggle visual state for all instances of this button for this ID
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
