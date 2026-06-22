import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';

export const ExplorePage = {
    _stateStorageKey: 'edtechra_explore_state',
    _restoreFlagKey: 'edtechra_explore_restore_once',
    _currentCategory: 'all',
    _currentGroup: null,
    _currentTheme: null,
    _isLoading: false,
    _allFetchedData: [],  // holds all fetched submissions for local Explore batching
    _feedCacheByCategory: new Map(),
    _statsCache: new Map(),
    _interactionCacheByUser: new Map(),
    _loadRequestId: 0,
    _displayCount: 12,    // total cards rendered across sections
    _loadMoreStep: 12,    // cards appended per Load More click
    _batchSectionSize: 4,
    _fetchPageSize: 12,
    _topCreators: [],
    _isSearchFocused: false,
    _mobileInfiniteObserver: null,
    _mobileInfiniteLoadHandler: null,
    _mobileInfiniteFallback: false,

    _getDesktopSectionCount() {
        return window.matchMedia('(min-width: 993px)').matches ? 4 : 3;
    },

    _isMobileExplorePagination() {
        return window.matchMedia('(max-width: 768px)').matches;
    },

    _getFetchPageSize() {
        return this._fetchPageSize;
    },

    _getBaseDisplayCount() {
        return this._batchSectionSize * 3;
    },

    _isMobileAllWorkFeed() {
        return window.matchMedia('(max-width: 640px)').matches
            && this._currentCategory === 'all'
            && !this._currentGroup
            && !this._currentTheme;
    },

    getWorkId(item = {}) {
        const directId = item.id
            || item.submission_id
            || item.work_id
            || item.uuid
            || item.slug;
        if (directId) return String(directId);

        const projectUrl = item.github_url || item.project_url;
        if (projectUrl) return String(projectUrl);

        const title = String(item.title || '').trim();
        const author = String(
            item.author_id
            || item.profiles?.id
            || item.profiles?.display_name
            || item.author
            || ''
        ).trim();
        const createdDate = String(
            item.created_at
            || item.submitted_at
            || item.uploaded_at
            || item.updated_at
            || item.approved_at
            || item.createdAt
            || ''
        ).trim();

        if (title || author || createdDate) {
            return [title, author, createdDate].join('|');
        }

        return '';
    },

    uniqueByWorkId(items = []) {
        const seen = new Set();
        return (Array.isArray(items) ? items : []).filter((item) => {
            const id = this.getWorkId(item);
            if (!id) return true;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    },

    _getSubmissionId(submission) {
        return this.getWorkId(submission);
    },

    _getNestedStats(submission = {}) {
        return submission.submission_stats?.[0]
            || submission.stats
            || submission.stat
            || submission.metrics
            || {};
    },

    _getFeedCacheKey(category, search = '') {
        return [
            String(category || 'all'),
            String(this._currentGroup || ''),
            String(this._currentTheme || ''),
            String(search || '').trim().toLowerCase()
        ].join('|');
    },

    _sortNewCandidates(items) {
        return [...items].sort((a, b) =>
            this._getSubmissionTimestamp(b) - this._getSubmissionTimestamp(a)
        );
    },

    _getSubmissionStats(submission = {}) {
        return this._getNestedStats(submission);
    },

    _getSubmissionTimestamp(submission = {}) {
        const rawDate = submission.created_at
            || submission.submitted_at
            || submission.uploaded_at
            || submission.updated_at
            || submission.createdAt
            || submission.timestamp
            || submission.approved_at
            || '';
        const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
        return Number.isFinite(timestamp) ? timestamp : 0;
    },

    getItemDate(item = {}) {
        const rawDate = item.created_at
            || item.submitted_at
            || item.uploaded_at
            || item.updated_at
            || item.approved_at
            || item.createdAt
            || 0;
        const timestamp = rawDate ? new Date(rawDate).getTime() : 0;
        return Number.isFinite(timestamp) ? timestamp : 0;
    },

    _getStatNumber(item = {}, keys = []) {
        const stats = this._getNestedStats(item);
        for (const key of keys) {
            const flatValue = Number(item?.[key]);
            if (Number.isFinite(flatValue)) return Math.max(0, flatValue);

            const statsValue = Number(stats?.[key]);
            if (Number.isFinite(statsValue)) return Math.max(0, statsValue);
        }
        return 0;
    },

    getItemViews(item = {}) {
        return this._getStatNumber(item, [
            'view_count',
            'views',
            'views_count'
        ]);
    },

    getItemLikes(item = {}) {
        return this._getStatNumber(item, [
            'like_count',
            'likes',
            'likes_count'
        ]);
    },

    getItemShares(item = {}) {
        return this._getStatNumber(item, [
            'share_count',
            'shares',
            'shares_count'
        ]);
    },

    getItemBookmarks(item = {}) {
        return this._getStatNumber(item, [
            'bookmark_count',
            'save_count',
            'saves',
            'saved_count',
            'bookmarks'
        ]);
    },

    getItemRating(item = {}) {
        return this._getStatNumber(item, [
            'average_rating',
            'avg_rating',
            'rating_average',
            'rating'
        ]);
    },

    _getAverageRating(submission = {}) {
        return this.getItemRating(submission);
    },

    _getRatingCount(submission = {}) {
        return this._getStatNumber(submission, ['rating_count', 'ratings_count', 'review_count']);
    },

    _getEngagementScore(submission = {}) {
        const views = this.getItemViews(submission);
        const likes = this.getItemLikes(submission);
        const shares = this.getItemShares(submission);
        const bookmarks = this.getItemBookmarks(submission);
        const rating = this.getItemRating(submission);

        return views + (likes * 3) + (shares * 4) + (bookmarks * 2) + (rating * 5);
    },

    _isTrendingEligible(submission = {}) {
        const rating = this.getItemRating(submission);
        if (rating <= 3) return false;

        return this.getItemViews(submission) > 0
            || this.getItemLikes(submission) > 0
            || this.getItemShares(submission) > 0
            || this.getItemBookmarks(submission) > 0;
    },

    _sortTrendingCandidates(items) {
        return [...items].sort((a, b) => {
            const scoreA = this._getEngagementScore(a);
            const scoreB = this._getEngagementScore(b);

            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }

            return this.getItemDate(b) - this.getItemDate(a);
        });
    },

    _sortTopRatedCandidates(items) {
        return [...items].sort((a, b) => {
            const ratingA = this._getAverageRating(a);
            const ratingB = this._getAverageRating(b);

            if (ratingB !== ratingA) {
                return ratingB - ratingA;
            }

            const ratingCountA = this._getRatingCount(a);
            const ratingCountB = this._getRatingCount(b);
            if (ratingCountB !== ratingCountA) {
                return ratingCountB - ratingCountA;
            }

            const scoreA = this._getEngagementScore(a);
            const scoreB = this._getEngagementScore(b);
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }

            return this._getSubmissionTimestamp(b) - this._getSubmissionTimestamp(a);
        });
    },

    _takeEligibleCandidates(sourceItems, count, excludedIds) {
        const selected = [];

        for (const item of sourceItems || []) {
            const submissionId = this._getSubmissionId(item);
            if (!submissionId || excludedIds.has(submissionId)) continue;

            selected.push(item);
            excludedIds.add(submissionId);

            if (selected.length >= count) break;
        }

        return selected;
    },

    _buildFeedState(items, totalCardsToRender) {
        const baseItems = this.uniqueByWorkId(items);
        const newCandidates = this._sortNewCandidates(baseItems);
        const useNewestOrderedAllWorks = this._currentCategory === 'all'
            && !this._currentGroup
            && !this._currentTheme;
        const trendingCandidates = useNewestOrderedAllWorks
            ? newCandidates
            : this._sortTrendingCandidates(baseItems).filter((item) => this._isTrendingEligible(item));
        const topRatedCandidates = useNewestOrderedAllWorks
            ? newCandidates
            : this._sortTopRatedCandidates(baseItems).filter((item) => this._getAverageRating(item) > 0);
        const perSectionLimit = Math.max(
            this._batchSectionSize,
            Math.ceil((Number(totalCardsToRender) || this._getBaseDisplayCount()) / 3)
        );
        const usedInPreview = new Set();
        const takeForSection = (sourceItems) => this._takeEligibleCandidates(sourceItems, perSectionLimit, usedInPreview);
        const sections = {
            trending: takeForSection(trendingCandidates),
            new: takeForSection(newCandidates),
            top: takeForSection(topRatedCandidates)
        };
        const targetTotal = Math.max(0, Number(totalCardsToRender) || this._getBaseDisplayCount());
        const fillNewestSection = () => {
            let totalRendered = Object.values(sections).reduce((total, groupItems) => total + groupItems.length, 0);
            if (totalRendered >= targetTotal) return;

            for (const item of newCandidates) {
                const submissionId = this._getSubmissionId(item);
                if (!submissionId || usedInPreview.has(submissionId)) continue;

                sections.new.push(item);
                usedInPreview.add(submissionId);
                totalRendered += 1;

                if (totalRendered >= targetTotal) break;
            }
        };
        fillNewestSection();

        return {
            sections,
            totalRendered: Object.values(sections).reduce((total, groupItems) => total + groupItems.length, 0),
            totalAvailableUnique: new Set(baseItems.map((item) => this.getWorkId(item)).filter(Boolean)).size
        };
    },

    _buildImageFeedState(items, totalCardsToRender) {
        const newestFirst = this._sortNewCandidates(this.uniqueByWorkId(items));
        const renderedIds = new Set();
        const orderedItems = [];

        for (const item of newestFirst) {
            const submissionId = this.getWorkId(item);
            if (!submissionId || renderedIds.has(submissionId)) continue;

            renderedIds.add(submissionId);
            orderedItems.push(item);

            if (orderedItems.length >= Math.max(0, Number(totalCardsToRender) || 0)) {
                break;
            }
        }

        return {
            items: orderedItems,
            totalRendered: orderedItems.length,
            totalAvailableUnique: new Set(newestFirst.map((item) => this.getWorkId(item)).filter(Boolean)).size
        };
    },

    _getDefaultExploreBaseItems(filteredItems = [], cacheItems = [], search = '') {
        const isDefaultAllWorksView = this._currentCategory === 'all'
            && !this._currentGroup
            && !this._currentTheme
            && !String(search || '').trim();

        if (filteredItems.length || !isDefaultAllWorksView) {
            return filteredItems;
        }

        return this.uniqueByWorkId(Array.isArray(cacheItems) ? cacheItems.filter(Boolean) : []);
    },

    _getSingleFeedEmptyMessage(search = '') {
        const isFilteredFeed = this._currentCategory !== 'all'
            || !!this._currentGroup
            || !!this._currentTheme
            || !!String(search || '').trim();

        return isFilteredFeed
            ? 'No works found in this category yet.'
            : 'No matching works found.';
    },

    _configureImageFeedSections(isImageFeed) {
        const isMobileAllWorkFeed = this._isMobileAllWorkFeed();
        const useSingleFeed = isImageFeed || isMobileAllWorkFeed;
        const trendingSection = document.querySelector('#trending-creations');
        const topSection = document.querySelector('#grid-top')?.closest('.explore-row-section') || null;
        const feedSection = document.querySelector('#explore-feed-section');
        const feedTitle = feedSection?.querySelector('.explore-row-title') || null;
        const feedCopy = feedSection?.querySelector('.explore-row-copy') || null;

        if (feedTitle && !feedTitle.dataset.defaultTitle) {
            feedTitle.dataset.defaultTitle = feedTitle.textContent || '';
        }

        if (feedCopy && !feedCopy.dataset.defaultCopy) {
            feedCopy.dataset.defaultCopy = feedCopy.textContent || '';
        }

        if (trendingSection) {
            trendingSection.hidden = useSingleFeed;
        }

        if (topSection) {
            topSection.hidden = useSingleFeed;
        }

        if (feedSection) {
            feedSection.classList.toggle('explore-feed-section-images', !!isImageFeed);
        }

        if (feedTitle) {
            feedTitle.textContent = isImageFeed
                ? 'Latest Images'
                : isMobileAllWorkFeed
                    ? 'All Works'
                : (feedTitle.dataset.defaultTitle || 'Newly Submitted');
        }

        if (feedCopy) {
            feedCopy.textContent = isImageFeed
                ? 'A single newest-first stream of image submissions from the community.'
                : isMobileAllWorkFeed
                    ? 'Newest works from across the learning community in one continuous feed.'
                : (feedCopy.dataset.defaultCopy || 'Fresh ideas and new uploads from across the learning community.');
        }
    },

    _createFeedCacheEntry() {
        return {
            items: [],
            nextOffset: 0,
            hasMore: true,
            loading: false
        };
    },

    _getFeedCacheEntry(cacheKey) {
        if (!this._feedCacheByCategory.has(cacheKey)) {
            this._feedCacheByCategory.set(cacheKey, this._createFeedCacheEntry());
        }
        return this._feedCacheByCategory.get(cacheKey);
    },

    _cleanupMobileInfiniteScroll({ preserveHandler = false } = {}) {
        if (this._mobileInfiniteObserver) {
            this._mobileInfiniteObserver.disconnect();
            this._mobileInfiniteObserver = null;
        }
        if (!preserveHandler) {
            this._mobileInfiniteLoadHandler = null;
        }
        const trigger = document.querySelector('#explore-mobile-feed-trigger');
        const status = document.querySelector('#explore-mobile-feed-status');
        if (trigger) {
            trigger.hidden = true;
            trigger.setAttribute('aria-hidden', 'true');
        }
        if (status) {
            status.hidden = true;
            status.classList.remove('is-visible');
            status.innerHTML = '';
        }
    },

    _setMobileInfiniteStatus(isVisible) {
        const status = document.querySelector('#explore-mobile-feed-status');
        if (!status) return;

        status.hidden = !isVisible;
        status.classList.toggle('is-visible', !!isVisible);
        status.innerHTML = isVisible
            ? `<div class="explore-mobile-feed-status-grid">${this.renderSkeletons(2)}</div>`
            : '';
    },

    _setupMobileInfiniteScroll(cacheEntry = null) {
        const trigger = document.querySelector('#explore-mobile-feed-trigger');
        if (!trigger) return;

        this._cleanupMobileInfiniteScroll({ preserveHandler: true });

        if (!this._isMobileExplorePagination()) return;

        const hasMore = !!cacheEntry?.hasMore;
        trigger.hidden = !hasMore;
        trigger.setAttribute('aria-hidden', hasMore ? 'false' : 'true');
        if (!hasMore) return;

        if (typeof IntersectionObserver === 'undefined') {
            this._mobileInfiniteFallback = true;
            this._updateLoadMoreButton(null, cacheEntry);
            return;
        }

        const loadNextPage = async () => {
            if (!this._mobileInfiniteLoadHandler || this._isLoading || App.currentPage !== 'explore') return;
            try {
                this._setMobileInfiniteStatus(true);
                await this._mobileInfiniteLoadHandler();
            } catch (error) {
                console.warn('[Explore] Mobile infinite scroll failed; showing Load More fallback.', error);
                this._mobileInfiniteFallback = true;
                this._updateLoadMoreButton(null, cacheEntry);
            } finally {
                this._setMobileInfiniteStatus(false);
            }
        };

        this._mobileInfiniteObserver = new IntersectionObserver((entries) => {
            const shouldLoad = entries.some((entry) => entry.isIntersecting);
            if (shouldLoad) window.setTimeout(loadNextPage, 0);
        }, {
            root: null,
            rootMargin: '600px 0px',
            threshold: 0.01
        });

        this._mobileInfiniteObserver.observe(trigger);
    },

    _filterLoadedSubmissions(items = [], search = '') {
        let filtered = this.uniqueByWorkId(items);
        const normalizedSearch = String(search || '').toLowerCase().trim();

        if (this._currentCategory === 'images') {
            filtered = filtered.filter((submission) => UI.isStrictImageSubmission(submission));
        } else if (this._currentCategory === 'songs') {
            filtered = filtered.filter((submission) => UI.isAudioSubmission(submission));
        } else if (this._currentCategory === 'video') {
            filtered = filtered.filter((submission) => UI.isVideoSubmission(submission));
        }

        if (this._currentTheme) {
            filtered = filtered.filter((submission) =>
                Array.isArray(submission.themes) && submission.themes.includes(this._currentTheme)
            );
        }

        if (this._currentGroup) {
            filtered = filtered.filter((submission) =>
                UI.getContentTypeOption(submission.category, submission.content_type)?.group === this._currentGroup
            );
        }

        if (normalizedSearch) {
            filtered = filtered.filter((submission) =>
                submission.title?.toLowerCase().includes(normalizedSearch) ||
                submission.profiles?.display_name?.toLowerCase().includes(normalizedSearch)
            );
        }

        return filtered;
    },

    async _enrichLoadedSubmissions(submissions = []) {
        const list = Array.isArray(submissions) ? submissions.filter(Boolean) : [];
        const ids = [...new Set(list.map((submission) => submission.id).filter(Boolean))];
        if (!ids.length) return;

        const missingStatsIds = ids.filter((id) => !this._statsCache.has(id));
        if (missingStatsIds.length) {
            const statsMap = await API.getStatsForSubmissions(missingStatsIds);
            missingStatsIds.forEach((id) => {
                this._statsCache.set(id, statsMap[id] || { avg_rating: 0, like_count: 0, view_count: 0 });
            });
        }

        let interactionMap = {};
        const userId = App.user?.id || null;
        if (userId) {
            if (!this._interactionCacheByUser.has(userId)) {
                this._interactionCacheByUser.set(userId, new Map());
            }
            const userInteractionCache = this._interactionCacheByUser.get(userId);
            const missingInteractionIds = ids.filter((id) => !userInteractionCache.has(id));
            if (missingInteractionIds.length) {
                const fetchedInteractions = await API.getUserSubmissionInteractions(missingInteractionIds, userId);
                missingInteractionIds.forEach((id) => {
                    userInteractionCache.set(id, fetchedInteractions[id] || { liked: false, bookmarked: false, userRating: null });
                });
            }
            ids.forEach((id) => {
                interactionMap[id] = userInteractionCache.get(id) || {};
            });
        }

        list.forEach((submission) => {
            const initStat = this._statsCache.get(submission.id) || { avg_rating: 0, like_count: 0, view_count: 0 };
            const interaction = interactionMap[submission.id] || {};
            initStat.user_has_liked = !!interaction.liked;
            initStat.user_has_bookmarked = !!interaction.bookmarked;
            submission.submission_stats = [initStat];
            submission._feedIsLiked = !!interaction.liked;
            submission._feedIsBookmarked = !!interaction.bookmarked;
            submission._audioFeedIsLiked = !!interaction.liked;
            submission._audioFeedIsBookmarked = !!interaction.bookmarked;
            submission._interactiveWebLiked = !!interaction.liked;
            submission._interactiveWebBookmarked = !!interaction.bookmarked;
            submission._interactiveWebUserRating = Number(interaction.userRating) || null;
        });
    },

    async _fetchNextSubmissionsPage(cacheEntry, category) {
        if (!cacheEntry || cacheEntry.loading || !cacheEntry.hasMore) {
            return [];
        }

        cacheEntry.loading = true;
        try {
            const fetchPageSize = this._getFetchPageSize();
            const { data, error } = await API.getSubmissions(category, 'created_at', fetchPageSize, cacheEntry.nextOffset);
            if (error) throw error;

            const pageItems = Array.isArray(data) ? data : [];
            const loadedIds = new Set(this.uniqueByWorkId(cacheEntry.items).map((item) => this.getWorkId(item)).filter(Boolean));
            const freshItems = pageItems.filter((item) => {
                const id = this.getWorkId(item);
                if (!id) return true;
                if (loadedIds.has(id)) return false;
                loadedIds.add(id);
                return true;
            });
            cacheEntry.items = this.uniqueByWorkId(cacheEntry.items);
            cacheEntry.items.push(...freshItems);
            cacheEntry.nextOffset += pageItems.length;
            cacheEntry.hasMore = pageItems.length >= fetchPageSize;

            await this._enrichLoadedSubmissions(freshItems);
            return freshItems;
        } finally {
            cacheEntry.loading = false;
        }
    },

    async _ensureLoadedForDisplayTarget(cacheEntry, category, search, { isImages = false, isMobileAllWorkFeed = false } = {}) {
        if (!cacheEntry) return;

        const needsMoreLoadedItems = () => {
            const filteredItems = this._filterLoadedSubmissions(cacheEntry.items, search);
            const matchedItems = this._getDefaultExploreBaseItems(filteredItems, cacheEntry.items, search);

            if (isImages || isMobileAllWorkFeed) {
                return this._buildImageFeedState(matchedItems, this._displayCount).totalRendered < this._displayCount;
            }

            return this._buildFeedState(matchedItems, this._displayCount).totalRendered < this._displayCount;
        };

        while (cacheEntry.hasMore && needsMoreLoadedItems()) {
            const offsetBeforeFetch = cacheEntry.nextOffset;
            await this._fetchNextSubmissionsPage(cacheEntry, category);

            if (cacheEntry.nextOffset === offsetBeforeFetch) {
                break;
            }
        }
    },

    _readSavedState() {
        try {
            const raw = sessionStorage.getItem(this._stateStorageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    },

    _writeSavedState(payload) {
        try {
            sessionStorage.setItem(this._stateStorageKey, JSON.stringify(payload));
        } catch (_) {
            // Ignore storage failures and keep Explore functional.
        }
    },

    _persistState(searchValue = '', scrollY = window.scrollY) {
        const payload = {
            category: this._currentCategory || 'all',
            group: this._currentGroup || null,
            theme: this._currentTheme || null,
            search: String(searchValue || ''),
            displayCount: this._displayCount,
            scrollY: Math.max(0, Number(scrollY) || 0)
        };

        const currentState = this._readSavedState() || {};
        if (currentState.returnToSubmissionId) {
            payload.returnToSubmissionId = currentState.returnToSubmissionId;
            payload.returnCardViewportOffset = currentState.returnCardViewportOffset;
        }

        this._writeSavedState(payload);
    },

    _storeReturnPoint(cardEl, submissionId = cardEl?.dataset?.id || null) {
        if (!submissionId || !cardEl) return;

        const currentState = this._readSavedState() || {};
        const searchValue = document.querySelector('#search-input')?.value || currentState.search || '';
        const rect = cardEl.getBoundingClientRect();

        this._writeSavedState({
            category: this._currentCategory || 'all',
            group: this._currentGroup || null,
            theme: this._currentTheme || null,
            search: String(searchValue),
            displayCount: this._displayCount,
            scrollY: Math.max(0, Number(window.scrollY) || 0),
            returnToSubmissionId: String(submissionId),
            returnCardViewportOffset: Math.max(0, Math.round(rect.top))
        });
    },

    _restoreExplorePosition(savedState) {
        const fallbackScrollY = Math.max(0, Number(savedState?.scrollY) || 0);
        const targetSubmissionId = savedState?.returnToSubmissionId ? String(savedState.returnToSubmissionId) : '';
        const viewportOffset = Math.max(0, Number(savedState?.returnCardViewportOffset) || 0);
        const clearReturnTarget = () => {
            const nextState = { ...(this._readSavedState() || {}) };
            delete nextState.returnToSubmissionId;
            delete nextState.returnCardViewportOffset;
            this._writeSavedState(nextState);
        };

        const applyRestore = () => {
            const targetCard = targetSubmissionId
                ? document.querySelector(`.explore-container [data-id="${targetSubmissionId}"]`)
                : null;

            if (targetCard) {
                const targetTop = targetCard.getBoundingClientRect().top + window.scrollY - viewportOffset;
                window.scrollTo({ top: Math.max(0, Math.round(targetTop)), behavior: 'auto' });
                return;
            }

            window.scrollTo({ top: fallbackScrollY, behavior: 'auto' });
        };

        requestAnimationFrame(() => {
            applyRestore();
            requestAnimationFrame(() => {
                applyRestore();
                clearReturnTarget();
            });
        });
    },

    _consumeRestoreFlag() {
        try {
            const shouldRestore = sessionStorage.getItem(this._restoreFlagKey) === 'true';
            sessionStorage.removeItem(this._restoreFlagKey);
            return shouldRestore;
        } catch (_) {
            return false;
        }
    },

    async init() {
        this._cleanupMobileInfiniteScroll();
        this._currentCategory = 'all';
        this._currentGroup = null;
        this._currentTheme = null;
        this._isLoading = false;
        this._allFetchedData = [];
        if (!(this._feedCacheByCategory instanceof Map)) this._feedCacheByCategory = new Map();
        if (!(this._statsCache instanceof Map)) this._statsCache = new Map();
        if (!(this._interactionCacheByUser instanceof Map)) this._interactionCacheByUser = new Map();
        this._loadRequestId = 0;
        this._displayCount = this._getBaseDisplayCount();
        this._topCreators = [];
        this._isSearchFocused = false;
        this._mobileInfiniteFallback = false;
        const shouldRestoreState = this._consumeRestoreFlag();
        const savedState = shouldRestoreState ? this._readSavedState() : null;

        if (savedState) {
            this._currentCategory = savedState.category || 'all';
            this._currentGroup = savedState.group || null;
            this._currentTheme = savedState.theme || null;
            const savedDisplayCount = Number(savedState.displayCount) || 0;
            this._displayCount = savedDisplayCount > 0
                ? Math.max(this._getBaseDisplayCount(), Math.ceil(savedDisplayCount / this._loadMoreStep) * this._loadMoreStep)
                : this._getBaseDisplayCount();
        }

        // Always re-query DOM elements fresh (avoids stale reference from cloning)
        const getSearchInput = () => document.querySelector('#search-input');
        const getCategoryFilters = () => document.querySelector('#category-filters');
        const getCreatorsSection = () => document.querySelector('.explore-creators-section');
        const getSectionsContainer = () => document.querySelector('.explore-sections-container');
        const getTrendingCreationsSection = () => document.querySelector('#trending-creations');
        const getChipViewport = () => document.querySelector('.explore-desktop-flow #explore-chip-viewport');
        const getChipDropdownLayer = () => document.querySelector('.explore-desktop-flow #explore-chip-dropdown-layer');
        const updateCreatorsVisibility = () => {
            const creatorsSection = getCreatorsSection();
            const sectionsContainer = getSectionsContainer();
            const searchValue = getSearchInput()?.value?.trim() || '';
            const hasExpandedCategoryGroup = !!getCategoryFilters()?.querySelector('.category-filter-group.expanded');
            const shouldShowCreators = !this._isSearchFocused
                && !searchValue
                && this._currentCategory === 'all'
                && !this._currentGroup
                && !this._currentTheme
                && !hasExpandedCategoryGroup;

            creatorsSection?.classList.toggle('is-hidden', !shouldShowCreators);
            sectionsContainer?.classList.toggle('creators-hidden', !shouldShowCreators);
        };
        const syncDesktopActiveState = (filtersRoot = getCategoryFilters()) => {
            if (!filtersRoot) return;

            filtersRoot.querySelectorAll('.category-clay-item, .category-parent-toggle').forEach((item) => {
                item.classList.remove('active');
            });

            if (this._currentCategory === 'all' && !this._currentGroup && !this._currentTheme) {
                filtersRoot.querySelector('.category-card-all')?.classList.add('active');
                return;
            }

            if (this._currentGroup && this._currentCategory === 'all' && !this._currentTheme) {
                filtersRoot.querySelector(`.category-parent-toggle[data-group-filter="${this._currentGroup}"]`)?.classList.add('active');
                return;
            }

            const matchingChips = Array.from(filtersRoot.querySelectorAll('.category-clay-item')).filter((chip) => {
                if (chip.dataset.category !== this._currentCategory) return false;
                return (chip.dataset.theme || '') === (this._currentTheme || '');
            });

            const visibleChip = matchingChips.find((chip) => !chip.closest('.category-children'));
            if (visibleChip) {
                visibleChip.classList.add('active');
                return;
            }

            const groupedChip = matchingChips[0];
            groupedChip?.classList.add('active');
            const parentToggle = groupedChip?.closest('.category-filter-group')?.querySelector('.category-parent-toggle');
            parentToggle?.classList.add('active');
        };
        const closeDesktopDropdown = (filtersRoot = getCategoryFilters(), dropdownLayer = getChipDropdownLayer()) => {
            if (filtersRoot) {
                filtersRoot.querySelectorAll('.category-filter-group').forEach((group) => {
                    group.classList.remove('expanded');
                });
                filtersRoot.querySelectorAll('.category-parent-toggle').forEach((toggle) => {
                    toggle.classList.remove('active');
                    toggle.setAttribute('aria-expanded', 'false');
                });
            }

            if (dropdownLayer) {
                dropdownLayer.classList.remove('is-open');
                dropdownLayer.setAttribute('aria-hidden', 'true');
                dropdownLayer.innerHTML = '';
                dropdownLayer.style.left = '';
                dropdownLayer.style.top = '';
                dropdownLayer.style.minWidth = '';
                dropdownLayer.dataset.group = '';
            }

            syncDesktopActiveState(filtersRoot);
            updateCreatorsVisibility();
        };
        const positionDesktopDropdown = (anchorButton, dropdownLayer, chipBar) => {
            if (!anchorButton || !dropdownLayer || !chipBar || !dropdownLayer.childElementCount) return;

            const chipBarRect = chipBar.getBoundingClientRect();
            const anchorRect = anchorButton.getBoundingClientRect();
            const dropdownWidth = dropdownLayer.offsetWidth;
            const minLeft = 12;
            const maxLeft = Math.max(minLeft, chipBar.clientWidth - dropdownWidth - 12);
            const desiredLeft = anchorRect.left - chipBarRect.left;
            const left = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
            const top = anchorRect.bottom - chipBarRect.top + 8;

            dropdownLayer.style.left = `${Math.round(left)}px`;
            dropdownLayer.style.top = `${Math.round(top)}px`;
            dropdownLayer.style.minWidth = `${Math.max(220, Math.round(anchorRect.width))}px`;
        };
        const openDesktopDropdown = (groupWrapper, parentToggle, filtersRoot) => {
            const dropdownLayer = getChipDropdownLayer();
            const chipBar = document.querySelector('.explore-desktop-flow .explore-chip-bar');
            const sourcePanel = groupWrapper?.querySelector('.category-children');
            if (!dropdownLayer || !chipBar || !sourcePanel || !sourcePanel.children.length) return;

            filtersRoot.querySelectorAll('.category-filter-group').forEach((group) => {
                const isTarget = group === groupWrapper;
                group.classList.toggle('expanded', isTarget);
            });
            filtersRoot.querySelectorAll('.category-parent-toggle').forEach((toggle) => {
                const isTarget = toggle === parentToggle;
                toggle.classList.toggle('active', isTarget);
                toggle.setAttribute('aria-expanded', String(isTarget));
            });

            dropdownLayer.innerHTML = `
                <div class="explore-chip-dropdown-panel" data-group-panel="${groupWrapper.dataset.group || ''}">
                    ${sourcePanel.innerHTML}
                </div>
            `;
            dropdownLayer.classList.add('is-open');
            dropdownLayer.setAttribute('aria-hidden', 'false');
            dropdownLayer.dataset.group = groupWrapper.dataset.group || '';
            positionDesktopDropdown(parentToggle, dropdownLayer, chipBar);
            updateCreatorsVisibility();
        };
        const bindDesktopChipScroll = () => {
            const chipViewport = getChipViewport();
            const chipRow = document.querySelector('.explore-desktop-flow .category-sidebar-list');
            const leftBtn = document.querySelector('.explore-desktop-flow [data-chip-scroll="left"]');
            const rightBtn = document.querySelector('.explore-desktop-flow [data-chip-scroll="right"]');
            if (!chipViewport || !chipRow || !leftBtn || !rightBtn || chipViewport.dataset.desktopScrollBound === 'true') return;

            const updateDesktopChipControls = () => {
                if (!window.matchMedia('(min-width: 993px)').matches) return;
                const maxScrollLeft = Math.max(0, chipViewport.scrollWidth - chipViewport.clientWidth);
                leftBtn.disabled = chipViewport.scrollLeft <= 4;
                rightBtn.disabled = chipViewport.scrollLeft >= maxScrollLeft - 4;
            };

            chipViewport.addEventListener('wheel', (event) => {
                if (!window.matchMedia('(min-width: 993px)').matches) return;
                if (!event.shiftKey && Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;

                event.preventDefault();
                chipViewport.scrollBy({
                    left: event.deltaX || event.deltaY,
                    behavior: 'auto'
                });
                updateDesktopChipControls();
            }, { passive: false });

            const scrollByAmount = (direction) => {
                chipViewport.scrollBy({
                    left: direction * Math.min(320, chipViewport.clientWidth * 0.8),
                    behavior: 'smooth'
                });
            };

            leftBtn.addEventListener('click', () => scrollByAmount(-1));
            rightBtn.addEventListener('click', () => scrollByAmount(1));

            const dragThreshold = 8;
            let isPointerDown = false;
            let dragMoved = false;
            let hasDragGesture = false;
            let dragStartX = 0;
            let dragStartScrollLeft = 0;

            chipViewport.addEventListener('pointerdown', (event) => {
                if (!window.matchMedia('(min-width: 993px)').matches) return;
                if (event.pointerType === 'mouse' && event.button !== 0) return;

                isPointerDown = true;
                dragMoved = false;
                hasDragGesture = false;
                dragStartX = event.clientX;
                dragStartScrollLeft = chipViewport.scrollLeft;
            });

            chipViewport.addEventListener('pointermove', (event) => {
                if (!isPointerDown || !window.matchMedia('(min-width: 993px)').matches) return;

                const deltaX = event.clientX - dragStartX;
                if (!hasDragGesture) {
                    if (Math.abs(deltaX) < dragThreshold) return;
                    hasDragGesture = true;
                    chipViewport.classList.add('is-dragging');
                    chipViewport.setPointerCapture?.(event.pointerId);
                }

                dragMoved = true;
                chipViewport.scrollLeft = dragStartScrollLeft - deltaX;
                updateDesktopChipControls();
            });

            const stopPointerDrag = (event) => {
                if (!isPointerDown) return;
                const shouldReleasePointer = hasDragGesture;
                isPointerDown = false;
                hasDragGesture = false;
                chipViewport.classList.remove('is-dragging');
                if (shouldReleasePointer) {
                    chipViewport.releasePointerCapture?.(event.pointerId);
                }
                updateDesktopChipControls();
            };

            chipViewport.addEventListener('pointerup', stopPointerDrag);
            chipViewport.addEventListener('pointercancel', stopPointerDrag);
            chipViewport.addEventListener('mouseleave', () => {
                if (!isPointerDown) return;
                isPointerDown = false;
                chipViewport.classList.remove('is-dragging');
                updateDesktopChipControls();
            });
            chipViewport.addEventListener('click', (event) => {
                if (!dragMoved) return;
                event.preventDefault();
                event.stopPropagation();
                dragMoved = false;
            }, true);

            chipViewport.addEventListener('scroll', updateDesktopChipControls, { passive: true });
            chipViewport.addEventListener('scroll', () => {
                const dropdownLayer = getChipDropdownLayer();
                const filtersRoot = getCategoryFilters();
                const openGroup = filtersRoot?.querySelector('.category-filter-group.expanded');
                const anchorButton = openGroup?.querySelector('.category-parent-toggle');
                const chipBar = document.querySelector('.explore-desktop-flow .explore-chip-bar');
                if (anchorButton && dropdownLayer?.classList.contains('is-open')) {
                    positionDesktopDropdown(anchorButton, dropdownLayer, chipBar);
                }
            }, { passive: true });
            window.addEventListener('resize', () => {
                updateDesktopChipControls();
                const dropdownLayer = getChipDropdownLayer();
                const filtersRoot = getCategoryFilters();
                const openGroup = filtersRoot?.querySelector('.category-filter-group.expanded');
                const anchorButton = openGroup?.querySelector('.category-parent-toggle');
                const chipBar = document.querySelector('.explore-desktop-flow .explore-chip-bar');
                if (anchorButton && dropdownLayer?.classList.contains('is-open')) {
                    positionDesktopDropdown(anchorButton, dropdownLayer, chipBar);
                }
            });
            window.addEventListener('scroll', () => {
                const dropdownLayer = getChipDropdownLayer();
                const filtersRoot = getCategoryFilters();
                const openGroup = filtersRoot?.querySelector('.category-filter-group.expanded');
                const anchorButton = openGroup?.querySelector('.category-parent-toggle');
                const chipBar = document.querySelector('.explore-desktop-flow .explore-chip-bar');
                if (anchorButton && dropdownLayer?.classList.contains('is-open')) {
                    positionDesktopDropdown(anchorButton, dropdownLayer, chipBar);
                }
            }, { passive: true });

            updateDesktopChipControls();
            chipViewport.dataset.desktopScrollBound = 'true';
        };
        const syncResponsiveLayout = () => {
            const container = document.querySelector('.light-theme-explore.explore-container');
            const main = document.querySelector('.explore-main');
            const sidebar = document.querySelector('.explore-sidebar');
            const hero = document.querySelector('.explore-hero');
            const desktopDiscovery = document.querySelector('.explore-desktop-discovery');
            const mobileDiscovery = document.querySelector('.explore-mobile-discovery');
            const searchCard = document.querySelector('[data-mobile-slot="search"]');
            const categoriesCard = document.querySelector('[data-mobile-slot="categories"]');
            const sectionsContainer = document.querySelector('.explore-sections-container');
            const creatorsSection = document.querySelector('.explore-creators-section');
            if (!container || !main || !sidebar || !hero || !desktopDiscovery || !mobileDiscovery || !searchCard || !categoriesCard || !sectionsContainer) return;

            const isMobile = window.matchMedia('(max-width: 640px)').matches;
            const isDesktop = window.matchMedia('(min-width: 993px)').matches;
            const placeDiscoveryCards = (target) => {
                if (!target) return;
                [searchCard, categoriesCard].forEach((card, index) => {
                    if (card.parentNode !== target || target.children[index] !== card) {
                        target.appendChild(card);
                    }
                });
            };

            if (isDesktop) {
                container.classList.add('explore-desktop-flow');
                container.classList.remove('explore-mobile-flow');
                placeDiscoveryCards(desktopDiscovery);
                if (hero.nextElementSibling !== desktopDiscovery) {
                    hero.insertAdjacentElement('afterend', desktopDiscovery);
                }
                if (creatorsSection && desktopDiscovery.nextElementSibling !== creatorsSection) {
                    desktopDiscovery.insertAdjacentElement('afterend', creatorsSection);
                }
                sidebar.classList.add('explore-sidebar-empty');
                bindDesktopChipScroll();
                updateCreatorsVisibility();
                return;
            }

            if (isMobile) {
                closeDesktopDropdown();
                container.classList.add('explore-mobile-flow');
                container.classList.remove('explore-desktop-flow');
                placeDiscoveryCards(mobileDiscovery);
                if (hero.nextElementSibling !== mobileDiscovery) {
                    hero.insertAdjacentElement('afterend', mobileDiscovery);
                }
                if (creatorsSection) sectionsContainer.prepend(creatorsSection);
                sidebar.classList.add('explore-sidebar-empty');
                updateCreatorsVisibility();
            } else {
                closeDesktopDropdown();
                container.classList.remove('explore-mobile-flow');
                container.classList.remove('explore-desktop-flow');
                sidebar.classList.remove('explore-sidebar-empty');
                placeDiscoveryCards(sidebar);
                if (creatorsSection) sectionsContainer.prepend(creatorsSection);
                updateCreatorsVisibility();
            }
        };

        let loadAllSections = null;
        let lastMobileAllWorkFeedMode = this._isMobileAllWorkFeed();

        syncResponsiveLayout();

        if (this._mobileLayoutHandler) {
            window.removeEventListener('resize', this._mobileLayoutHandler);
        }
        this._mobileLayoutHandler = UI.debounce(() => {
            const wasMobileAllWorkFeed = lastMobileAllWorkFeedMode;
            syncResponsiveLayout();
            const isMobileAllWorkFeed = this._isMobileAllWorkFeed();
            lastMobileAllWorkFeedMode = isMobileAllWorkFeed;
            if (wasMobileAllWorkFeed !== isMobileAllWorkFeed && loadAllSections) {
                loadAllSections();
            }
        }, 80);
        window.addEventListener('resize', this._mobileLayoutHandler);

        loadAllSections = async (isLoadMore = false) => {
            if (this._isLoading) return;
            if (!isLoadMore) {
                this._mobileInfiniteFallback = false;
                this._cleanupMobileInfiniteScroll({ preserveHandler: true });
            }
            const requestId = ++this._loadRequestId;
            this._isLoading = true;

            const gridTrending = document.querySelector('#grid-trending');
            const gridNew = document.querySelector('#grid-new');
            const gridTop = document.querySelector('#grid-top');
            const creatorsRow = document.querySelector('#trending-creators-row');
            const searchInput = getSearchInput();

            const category = this._currentCategory === 'all' ? null : this._currentCategory;
            const isImages = this._currentCategory === 'images';
            const isMobileAllWorkFeed = this._isMobileAllWorkFeed();
            const search = searchInput?.value?.toLowerCase()?.trim() || '';
            const cacheKey = this._getFeedCacheKey(category, search);
            const cacheEntry = this._getFeedCacheEntry(cacheKey);

            this._configureImageFeedSections(isImages);

            // Show skeletons only on initial load or filter change
            if (!isLoadMore) {
                const skeletonGrids = (isImages || isMobileAllWorkFeed)
                    ? [gridNew]
                    : [gridTrending, gridNew, gridTop];

                skeletonGrids.forEach((gridEl) => {
                    if (gridEl) gridEl.innerHTML = this.renderSkeletons(this._batchSectionSize);
                });
                if (isImages || isMobileAllWorkFeed) {
                    if (gridTrending) gridTrending.innerHTML = '';
                    if (gridTop) gridTop.innerHTML = '';
                }
                if (creatorsRow) creatorsRow.innerHTML = this.renderCreatorSkeletons(3);
            }

            try {
                await this._ensureLoadedForDisplayTarget(cacheEntry, category, search, {
                    isImages,
                    isMobileAllWorkFeed
                });
                if (requestId !== this._loadRequestId) return;

                const filteredData = this._filterLoadedSubmissions(cacheEntry.items, search);
                const baseData = this._getDefaultExploreBaseItems(filteredData, cacheEntry.items, search);
                if (requestId !== this._loadRequestId) return;
                this._allFetchedData = baseData;

                if (!isImages && !this._topCreators.length) {
                    const { data: creators } = await API.getTopCreators(10);
                    this._topCreators = creators || [];
                }

                const liveGridTrending = document.querySelector('#grid-trending');
                const liveGridNew = document.querySelector('#grid-new');
                const liveGridTop = document.querySelector('#grid-top');
                const liveCreatorsRow = document.querySelector('#trending-creators-row');

                if (isImages) {
                    const imageFeedState = this._buildImageFeedState(baseData, this._displayCount);
                    this._renderGrid(liveGridNew, imageFeedState.items, null, true, this._getSingleFeedEmptyMessage(search));
                    if (liveGridTrending) liveGridTrending.innerHTML = '';
                    if (liveGridTop) liveGridTop.innerHTML = '';
                    this._updateLoadMoreButton(imageFeedState, cacheEntry);
                } else if (isMobileAllWorkFeed) {
                    const mobileFeedState = this._buildImageFeedState(baseData, this._displayCount);
                    this._renderCreators(liveCreatorsRow, this._topCreators);
                    this._renderGrid(liveGridNew, mobileFeedState.items, null, false, this._getSingleFeedEmptyMessage(search));
                    if (liveGridTrending) liveGridTrending.innerHTML = '';
                    if (liveGridTop) liveGridTop.innerHTML = '';
                    this._updateLoadMoreButton(mobileFeedState, cacheEntry);
                } else {
                    const feedState = this._buildFeedState(baseData, this._displayCount);
                    this._renderCreators(liveCreatorsRow, this._topCreators);
                    this._renderGrid(liveGridTrending, feedState.sections.trending, { text: 'TRENDING', className: 'badge-trending' }, false, 'No trending works yet.');
                    this._renderGrid(liveGridNew, feedState.sections.new, { text: 'NEW', className: 'badge-new' }, false, 'No new works yet.');
                    this._renderGrid(liveGridTop, feedState.sections.top, { text: 'TOP RATED', className: 'badge-top' }, false, 'No rated works yet.');
                    this._updateLoadMoreButton(feedState, cacheEntry);
                }

                this._mobileInfiniteLoadHandler = async () => {
                    if (this._isLoading) return;
                    this._displayCount += this._loadMoreStep;
                    this._persistState(getSearchInput()?.value || '');
                    await loadAllSections(true);
                };
                this._setupMobileInfiniteScroll(cacheEntry);
                this._persistState(searchInput?.value || '', window.scrollY);

            } catch (err) {
                if (requestId !== this._loadRequestId) return;
                if (this._isMobileExplorePagination() && isLoadMore) {
                    this._mobileInfiniteFallback = true;
                    this._updateLoadMoreButton(null, cacheEntry);
                }
                const errorMessage = err?.message || String(err);
                console.error(`[Explore] loadAllSections failed while querying submissions: ${errorMessage}`, {
                    functionName: 'loadAllSections',
                    table: 'submissions',
                    code: err?.code || null,
                    details: err?.details || null,
                    hint: err?.hint || null
                });
                [gridTrending, gridNew, gridTop].forEach((gridEl) => {
                    if (!gridEl) return;
                    gridEl.innerHTML = `
                        <div class="sd-empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                            <span style="font-size: 2rem;">⚠️</span>
                            <h3>Connection issue</h3>
                            <p class="text-muted">Could not load content. Please try again.</p>
                            <button class="btn btn-primary explore-retry-btn" style="margin-top: 16px;">Retry</button>
                        </div>`;
                    const retryBtn = gridEl.querySelector('.explore-retry-btn');
                    if (retryBtn) retryBtn.addEventListener('click', () => loadAllSections(), { once: true });
                });
            }

            if (requestId === this._loadRequestId) {
                this._isLoading = false;
            }
        };

        // Category filter click handling
        const categoryFilters = getCategoryFilters();
        if (categoryFilters) {
            // Clone to remove old listeners
            const newFilters = categoryFilters.cloneNode(true);
            categoryFilters.parentNode.replaceChild(newFilters, categoryFilters);
            if (this._desktopSubcategoryDismissHandler) {
                document.removeEventListener('click', this._desktopSubcategoryDismissHandler);
            }
            this._desktopSubcategoryDismissHandler = (event) => {
                if (!window.matchMedia('(min-width: 993px)').matches) return;
                if (event.target.closest('#category-filters') || event.target.closest('#explore-chip-dropdown-layer')) return;
                const dropdownLayer = getChipDropdownLayer();
                if (!dropdownLayer?.classList.contains('is-open')) return;
                closeDesktopDropdown(newFilters, dropdownLayer);
            };
            document.addEventListener('click', this._desktopSubcategoryDismissHandler);
            newFilters.addEventListener('click', async (e) => {
                const parentToggle = e.target.closest('.category-parent-toggle');
                if (parentToggle) {
                    this._currentCategory = 'all';
                    this._currentGroup = parentToggle.dataset.groupFilter || null;
                    this._currentTheme = null;
                    this._displayCount = this._getBaseDisplayCount();
                    syncDesktopActiveState(newFilters);
                    updateCreatorsVisibility();

                    if (newFilters.closest('.explore-desktop-flow')) {
                        const targetGroup = parentToggle.dataset.group;
                        const targetWrapper = newFilters.querySelector(`.category-filter-group[data-group="${targetGroup}"]`);
                        const dropdownLayer = getChipDropdownLayer();
                        const shouldExpand = !targetWrapper?.classList.contains('expanded')
                            || dropdownLayer?.dataset.group !== targetGroup;

                        if (!targetWrapper) return;
                        if (!shouldExpand) {
                            closeDesktopDropdown(newFilters, dropdownLayer);
                            await loadAllSections();
                            return;
                        }

                        openDesktopDropdown(targetWrapper, parentToggle, newFilters);
                        await loadAllSections();
                        return;
                    }

                    const targetGroup = parentToggle.dataset.group;
                    const targetWrapper = newFilters.querySelector(`.category-filter-group[data-group="${targetGroup}"]`);
                    const shouldExpand = !targetWrapper?.classList.contains('expanded');

                    newFilters.querySelectorAll('.category-filter-group').forEach(group => {
                        const isTarget = group.dataset.group === targetGroup;
                        group.classList.toggle('expanded', shouldExpand && isTarget);
                        const toggle = group.querySelector('.category-parent-toggle');
                        if (toggle) {
                            toggle.setAttribute('aria-expanded', String(shouldExpand && isTarget));
                        }
                    });
                    updateCreatorsVisibility();
                    await loadAllSections();
                    return;
                }

                const chip = e.target.closest('.category-clay-item');
                if (!chip) return;
                newFilters.querySelectorAll('.category-clay-item, .category-parent-toggle').forEach(c => c.classList.remove('active'));
                closeDesktopDropdown(newFilters);
                chip.classList.add('active');
                this._currentCategory = chip.dataset.category;
                this._currentGroup = chip.closest('.category-filter-group')?.querySelector('.category-parent-toggle')?.dataset.groupFilter || null;
                this._currentTheme = chip.dataset.theme || null;
                this._displayCount = this._getBaseDisplayCount(); // reset on category change
                updateCreatorsVisibility();
                await loadAllSections();
            });

            const dropdownLayer = getChipDropdownLayer();
            if (dropdownLayer) {
                if (this._desktopDropdownClickHandler) {
                    dropdownLayer.removeEventListener('click', this._desktopDropdownClickHandler);
                }
                this._desktopDropdownClickHandler = async (event) => {
                    const chip = event.target.closest('.category-clay-item');
                    if (!chip) return;
                    const panel = chip.closest('.explore-chip-dropdown-panel');
                    const sourceGroup = panel?.dataset.groupPanel || '';
                    const sourceWrapper = sourceGroup
                        ? newFilters.querySelector(`.category-filter-group[data-group="${sourceGroup}"]`)
                        : null;
                    const sourceToggle = sourceWrapper?.querySelector('.category-parent-toggle');

                    newFilters.querySelectorAll('.category-clay-item, .category-parent-toggle').forEach((item) => item.classList.remove('active'));
                    closeDesktopDropdown(newFilters, dropdownLayer);
                    if (sourceToggle) {
                        sourceToggle.classList.add('active');
                        sourceToggle.setAttribute('aria-expanded', 'false');
                    }
                    this._currentCategory = chip.dataset.category;
                    this._currentGroup = sourceToggle?.dataset.groupFilter || null;
                    this._currentTheme = chip.dataset.theme || null;
                    this._displayCount = this._getBaseDisplayCount();
                    syncDesktopActiveState(newFilters);
                    updateCreatorsVisibility();
                    await loadAllSections();
                };
                dropdownLayer.addEventListener('click', this._desktopDropdownClickHandler);
            }
        }

        const sectionsContainer = getSectionsContainer();
        if (sectionsContainer) {
            if (this._detailLaunchCaptureHandler) {
                sectionsContainer.removeEventListener('click', this._detailLaunchCaptureHandler, true);
            }

            this._detailLaunchCaptureHandler = (event) => {
                const detailTrigger = event.target.closest('a[href^="#detail/"], [data-link^="detail/"], .masonry-author-stub');
                if (!detailTrigger) return;

                const cardEl = detailTrigger.closest('[data-id]');
                const submissionId = cardEl?.dataset?.id
                    || detailTrigger.dataset?.submissionId
                    || detailTrigger.getAttribute('href')?.replace(/^#detail\//, '')
                    || detailTrigger.dataset?.link?.replace(/^detail\//, '');

                if (!cardEl || !submissionId) return;
                this._storeReturnPoint(cardEl, submissionId);
            };

            sectionsContainer.addEventListener('click', this._detailLaunchCaptureHandler, true);
        }

        // Search input handling
        const searchInput = getSearchInput();
        if (searchInput) {
            const newSearch = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearch, searchInput);
            if (savedState?.search) {
                newSearch.value = savedState.search;
            }
            const searchBox = newSearch.closest('.search-box-clay');
            if (searchBox && searchBox.dataset.mobileSearchFocusBound !== 'true') {
                const focusSearchFromShell = (event) => {
                    if (!window.matchMedia('(max-width: 640px)').matches) return;
                    if (event.target === newSearch) return;
                    if (document.activeElement !== newSearch) {
                        newSearch.focus({ preventScroll: true });
                        if (typeof newSearch.setSelectionRange === 'function') {
                            const end = newSearch.value.length;
                            newSearch.setSelectionRange(end, end);
                        }
                    }
                };
                searchBox.addEventListener('pointerdown', focusSearchFromShell);
                searchBox.addEventListener('touchstart', focusSearchFromShell, { passive: true });
                searchBox.dataset.mobileSearchFocusBound = 'true';
            }
            newSearch.addEventListener('focus', () => {
                this._isSearchFocused = true;
                updateCreatorsVisibility();
            });
            newSearch.addEventListener('blur', () => {
                this._isSearchFocused = false;
                updateCreatorsVisibility();
            });
            newSearch.addEventListener('input', () => {
                this._persistState(newSearch.value);
                updateCreatorsVisibility();
            });
            newSearch.addEventListener('input', UI.debounce(async () => {
                this._displayCount = this._getBaseDisplayCount(); // reset on search change
                await loadAllSections();
            }, 500));
        }

        // Load More button handling
        const loadMoreBtn = document.querySelector('#explore-load-more');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', async () => {
                this._displayCount += this._loadMoreStep;
                this._persistState(getSearchInput()?.value || '');
                loadMoreBtn.classList.add('loading');
                loadMoreBtn.disabled = true;
                await loadAllSections(true);
                loadMoreBtn.classList.remove('loading');
                loadMoreBtn.disabled = false;
            });
        }

        const heroCta = document.querySelector('#explore-hero-cta');
        if (heroCta) {
            heroCta.addEventListener('click', (event) => {
                event.preventDefault();
                const feedSection = document.querySelector('#explore-feed-section');
                if (!feedSection) return;
                feedSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        }

        updateCreatorsVisibility();
        await loadAllSections();
        syncDesktopActiveState(getCategoryFilters());

        if (this._exploreScrollPersistenceHandler) {
            window.removeEventListener('scroll', this._exploreScrollPersistenceHandler);
        }
        this._exploreScrollPersistenceHandler = UI.debounce(() => {
            if (App.currentPage !== 'explore') return;
            this._persistState(getSearchInput()?.value || '', window.scrollY);
        }, 80);
        window.addEventListener('scroll', this._exploreScrollPersistenceHandler, { passive: true });

        if (savedState && shouldRestoreState) {
            this._restoreExplorePosition(savedState);
        }
    },

    cleanup() {
        this._cleanupMobileInfiniteScroll();
    },

    _renderGrid(gridEl, items, badgeObj, isImages, emptyMessage = 'No matching works found.') {
        if (!gridEl) return;

        if (items.length === 0) {
            gridEl.innerHTML = `<p class="text-muted text-center" style="grid-column: 1/-1; padding: 40px;">${emptyMessage}</p>`;
            return;
        }

        if (isImages) {
            gridEl.classList.add('masonry-grid', 'image-feed-grid');
            const imageItems = items.filter((item) => UI.isStrictImageSubmission(item));
            if (imageItems.length === 0) {
                gridEl.classList.remove('masonry-grid', 'image-feed-grid');
                gridEl.innerHTML = `<p class="text-muted text-center" style="grid-column: 1/-1; padding: 40px;">${emptyMessage}</p>`;
                return;
            }
            gridEl.innerHTML = imageItems.map((item) => UI.renderMasonryCard(item)).join('');
            this.setupMasonryInteractions(gridEl);
        } else {
            gridEl.classList.remove('masonry-grid', 'image-feed-grid');
            gridEl.innerHTML = items.map(w => UI.renderCard(w, badgeObj)).join('');
            this.setupAudioFeedCards(gridEl, items);
        }
    },

    _renderUnifiedFeed(gridEl, items) {
        if (!gridEl) return;

        const isMobileFeed = window.matchMedia('(max-width: 640px)').matches;

        if (items.length === 0) {
            gridEl.classList.remove('masonry-grid', 'image-feed-grid', 'explore-unified-feed-list', 'explore-unified-feed-grid');
            gridEl.innerHTML = `<p class="text-muted text-center" style="grid-column: 1/-1; padding: 40px;">No matching works found.</p>`;
            return;
        }

        gridEl.classList.remove('masonry-grid', 'image-feed-grid', 'explore-unified-feed-list', 'explore-unified-feed-grid');
        gridEl.classList.add(isMobileFeed ? 'explore-unified-feed-list' : 'explore-unified-feed-grid');
        gridEl.innerHTML = items.map((item) => {
            const isImage = UI.isStrictImageSubmission(item);
            if (!isMobileFeed && isImage) {
                return UI.renderMasonryCard(item);
            }
            return UI.renderCard(item);
        }).join('');

        this.setupMasonryInteractions(gridEl);
        this.setupAudioFeedCards(gridEl, items);
    },

    pauseOtherAudioCards(activeAudio) {
        document.querySelectorAll('.audio-feed-native').forEach((audioEl) => {
            if (audioEl !== activeAudio && !audioEl.paused) {
                audioEl.pause();
            }
        });
    },

    updateAudioFeedLikeState(submissionId, isLiked, likeCount) {
        document.querySelectorAll(`.audio-feed-card[data-id="${submissionId}"]`).forEach((card) => {
            const likeButton = card.querySelector('[data-audio-action="like"]');
            const likeCountEl = card.querySelector('.audio-feed-like-count');
            likeButton?.classList.toggle('is-active', !!isLiked);
            likeButton?.setAttribute('aria-pressed', String(!!isLiked));
            if (likeCountEl) likeCountEl.textContent = String(Math.max(0, Number(likeCount) || 0));
        });
    },

    updateAudioFeedBookmarkState(submissionId, isBookmarked) {
        document.querySelectorAll(`.audio-feed-card[data-id="${submissionId}"]`).forEach((card) => {
            const bookmarkButton = card.querySelector('[data-audio-action="bookmark"]');
            bookmarkButton?.classList.toggle('is-active', !!isBookmarked);
            bookmarkButton?.setAttribute('aria-pressed', String(!!isBookmarked));
        });
    },

    updateAudioFeedRatingState(submissionId, avgRating, activeRating = null) {
        const resolvedAverage = UI.getAverageRatingValue(avgRating);
        const roundedAverage = Math.round(resolvedAverage);
        const selectedRating = activeRating ?? roundedAverage;

        document.querySelectorAll(`.audio-feed-card[data-id="${submissionId}"]`).forEach((card) => {
            const ratingValue = card.querySelector('.audio-feed-rating-value');
            const stars = card.querySelectorAll('[data-audio-action="select-rate"]');

            if (ratingValue) {
                ratingValue.textContent = UI.formatAverageRating(resolvedAverage);
            }

            stars.forEach((star) => {
                const value = Number(star.dataset.rating || 0);
                star.classList.toggle('is-active', value <= selectedRating);
                star.classList.toggle('is-selected', value <= selectedRating);
            });
        });
    },

    updateAudioFeedViewState(submissionId, viewCount) {
        const nextCount = String(Math.max(0, Number(viewCount) || 0));

        document.querySelectorAll(`.audio-feed-card[data-id="${submissionId}"]`).forEach((card) => {
            const viewCountEl = card.querySelector('.audio-feed-view-count');
            if (viewCountEl) {
                viewCountEl.textContent = nextCount;
            }
        });
    },

    setupAudioFeedCards(gridEl, items) {
        if (!gridEl) return;

        const submissionsById = new Map((items || []).map((item) => [String(item.id), item]));
        const audioCards = gridEl.querySelectorAll('.audio-feed-card');
        if (!audioCards.length) return;
        if (gridEl.dataset.audioMenuDocumentBound !== 'true') {
            document.addEventListener('click', (event) => {
                gridEl.querySelectorAll('.audio-feed-card.is-audio-menu-open').forEach((openCard) => {
                    if (openCard.contains(event.target)) return;
                    openCard.classList.remove('is-audio-menu-open');
                    openCard.querySelector('[data-audio-action="menu"]')?.setAttribute('aria-expanded', 'false');
                });
            });
            gridEl.dataset.audioMenuDocumentBound = 'true';
        }

        audioCards.forEach((card) => {
            if (card.dataset.audioFeedBound === 'true') return;
            const submission = submissionsById.get(String(card.dataset.id || ''));
            const audio = card.querySelector('.audio-feed-native');
            const playButton = card.querySelector('[data-audio-action="toggle"]');
            const loopButton = card.querySelector('[data-audio-action="loop"]');
            const likeButton = card.querySelector('[data-audio-action="like"]');
            const bookmarkButton = card.querySelector('[data-audio-action="bookmark"]');
            const menuButton = card.querySelector('[data-audio-action="menu"]');
            const openRateButton = card.querySelector('[data-audio-action="open-rate"]');
            const closeRateButton = card.querySelector('[data-audio-action="close-rate"]');
            const submitRateButton = card.querySelector('[data-audio-action="submit-rate"]');
            const rateButtons = card.querySelectorAll('[data-audio-action="select-rate"]');
            const progressTrack = card.querySelector('[data-audio-action="seek"]');
            const progressFill = card.querySelector('.audio-feed-progress-fill');
            const shareLink = card.querySelector('.audio-feed-share');

            if (!submission || !audio || !playButton || !loopButton || !progressTrack || !progressFill) return;

            const stats = submission.submission_stats?.[0] || (submission.submission_stats = [{
                avg_rating: 0,
                like_count: 0,
                view_count: 0
            }])[0];
            let hasCountedPlayForCurrentSession = false;

            const markAudioAvailability = (isAvailable) => {
                card.classList.toggle('is-audio-unavailable', !isAvailable);
                playButton.disabled = !isAvailable;
                playButton.setAttribute('aria-disabled', String(!isAvailable));
                if (!isAvailable) {
                    playButton.setAttribute('aria-label', 'Audio unavailable');
                }
            };

            const ensurePlaybackSubmission = async () => {
                if (submission.file_url || submission.file_path || submission.file_type || submission.storage_provider) {
                    return submission;
                }

                if (!submission._audioFeedPlaybackPromise) {
                    submission._audioFeedPlaybackPromise = API.getSubmissionPlaybackData(submission.id)
                        .then(({ data, error }) => {
                            if (error) throw error;
                            if (data) Object.assign(submission, data);
                            return submission;
                        })
                        .catch((error) => {
                            console.warn('[Explore] Audio playback metadata lookup failed:', error);
                            return submission;
                        });
                }

                return submission._audioFeedPlaybackPromise;
            };

            const syncState = () => {
                const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
                const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
                const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

                card.classList.toggle('is-playing', !audio.paused && !audio.ended);
                card.classList.toggle('is-looping', !!audio.loop);
                progressFill.style.width = `${progress}%`;
                progressTrack.setAttribute('aria-valuenow', String(Math.round(progress)));
                playButton.setAttribute('aria-label', audio.paused ? 'Play audio' : 'Pause audio');
                loopButton.setAttribute('aria-label', audio.loop ? 'Disable loop' : 'Enable loop');
                loopButton.classList.toggle('is-active', !!audio.loop);
            };

            const resetPlaybackSession = () => {
                hasCountedPlayForCurrentSession = false;
            };

            const countPlaybackStart = async () => {
                if (hasCountedPlayForCurrentSession) {
                    return;
                }

                const { error } = await API.recordSubmissionView(submission.id, App.user?.id || null);
                if (error) {
                    console.warn('[Explore] Failed to record audio play count:', error);
                    return;
                }

                hasCountedPlayForCurrentSession = true;
                stats.view_count = Math.max(0, Number(stats.view_count || 0) + 1);
                this.updateAudioFeedViewState(submission.id, stats.view_count);
            };

            const ensureSource = async () => {
                if (audio.dataset.sourceState === 'ready') {
                    return audio.currentSrc || audio.src || null;
                }

                if (!audio._sourcePromise) {
                    audio.dataset.sourceState = 'loading';
                    audio._sourcePromise = (async () => {
                        const playbackSubmission = await ensurePlaybackSubmission();
                        const sourceUrl = await UI.resolveAudioSourceUrl(playbackSubmission);
                        const fileType = playbackSubmission.file_type || playbackSubmission.mime_type || '';
                        const looksPlayable = !fileType || fileType.startsWith('audio/');

                        if (!sourceUrl || !looksPlayable) {
                            audio.dataset.sourceState = 'missing';
                            markAudioAvailability(false);
                            return null;
                        }

                        audio.src = sourceUrl;
                        audio.preload = 'metadata';
                        audio.dataset.sourceState = 'ready';
                        markAudioAvailability(true);
                        return sourceUrl;
                    })().catch((error) => {
                        console.warn('[Explore] Audio source resolution failed:', error);
                        audio.dataset.sourceState = 'missing';
                        markAudioAvailability(false);
                        return null;
                    });
                }

                return audio._sourcePromise;
            };

            const seekToRatio = async (ratio) => {
                const sourceUrl = await ensureSource();
                if (!sourceUrl) return false;

                const safeRatio = Math.max(0, Math.min(1, ratio));
                const applySeek = () => {
                    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return false;
                    audio.currentTime = audio.duration * safeRatio;
                    syncState();
                    return true;
                };

                if (applySeek()) return true;

                audio.load();
                audio.addEventListener('loadedmetadata', () => {
                    applySeek();
                }, { once: true });
                return true;
            };

            playButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const sourceUrl = await ensureSource();
                if (!sourceUrl) {
                    return;
                }

                if (audio.paused) {
                    this.pauseOtherAudioCards(audio);
                    try {
                        await audio.play();
                    } catch (error) {
                        console.warn('[Explore] Inline audio playback failed:', error);
                        UI.showToast('Unable to play audio right now.', 'error');
                    }
                } else {
                    audio.pause();
                }

                syncState();
            });

            loopButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                audio.loop = !audio.loop;
                syncState();
            });

            progressTrack.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const rect = progressTrack.getBoundingClientRect();
                if (rect.width <= 0) return;
                const ratio = (event.clientX - rect.left) / rect.width;
                await seekToRatio(ratio);
            });

            likeButton?.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const user = App.user;
                if (!user) return UI.showToast('Please login to like', 'error');

                const { action, error } = await API.toggleLike(submission.id, user.id);
                if (error) {
                    UI.showToast(error.message || 'Could not update like.', 'error');
                    return;
                }

                const isLiked = action === 'liked';
                submission._audioFeedIsLiked = isLiked;
                stats.like_count = Math.max(0, Number(stats.like_count || 0) + (isLiked ? 1 : -1));
                this.updateAudioFeedLikeState(submission.id, isLiked, stats.like_count);
                UI.showToast(isLiked ? 'Liked!' : 'Unliked');
                if (isLiked) {
                    UI.triggerBadgeEvaluation({
                        userId: user.id,
                        reason: 'like-success'
                    });
                }
            });

            bookmarkButton?.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const user = App.user;
                if (!user) return UI.showToast('Please login to save', 'error');

                const { action, error } = await API.toggleBookmark(submission.id, user.id);
                if (error) {
                    UI.showToast(error.message || 'Could not update save.', 'error');
                    return;
                }

                const isBookmarked = action === 'saved';
                submission._audioFeedIsBookmarked = isBookmarked;
                this.updateAudioFeedBookmarkState(submission.id, isBookmarked);
                UI.showToast(isBookmarked ? 'Saved to collection!' : 'Removed from collection');
            });

            menuButton?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const isOpen = card.classList.toggle('is-audio-menu-open');
                menuButton.setAttribute('aria-expanded', String(isOpen));
            });

            let selectedAudioRating = Number(submission._audioFeedUserRating || Math.round(stats.avg_rating) || 0);

            const syncSelectedAudioRating = () => {
                rateButtons.forEach((star) => {
                    const value = Number(star.dataset.rating || 0);
                    star.classList.toggle('is-selected', value <= selectedAudioRating);
                });
            };

            openRateButton?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                card.classList.remove('is-audio-menu-open');
                menuButton?.setAttribute('aria-expanded', 'false');
                card.classList.add('is-audio-rating-open');
                syncSelectedAudioRating();
            });

            closeRateButton?.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                card.classList.remove('is-audio-rating-open');
            });

            rateButtons.forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    selectedAudioRating = Number(button.dataset.rating || 0);
                    syncSelectedAudioRating();
                });
            });

            submitRateButton?.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const user = App.user;
                if (!user) return UI.showToast('Please login to rate', 'error');
                if (!selectedAudioRating) return UI.showToast('Choose a rating first', 'error');

                const { data, error } = await API.rateSubmission(submission.id, user.id, selectedAudioRating);
                if (error || !data) {
                    UI.showToast(error?.message || 'Could not save rating.', 'error');
                    return;
                }

                stats.avg_rating = data.avgRating;
                submission._audioFeedUserRating = data.userRating;
                selectedAudioRating = Number(data.userRating || selectedAudioRating);
                this.updateAudioFeedRatingState(submission.id, data.avgRating, data.userRating);
                UI.showToast('Thank you for rating!', 'success');
                const dialog = card.querySelector('.audio-feed-rating-dialog');
                if (dialog) {
                    dialog.classList.add('is-thank-you');
                    dialog.innerHTML = `
                        <div class="detail-rating-success-icon" aria-hidden="true">✓</div>
                        <h4>Thank you for rating!</h4>
                        <p class="detail-rating-prompt-subtitle">Your feedback has been saved.</p>
                    `;
                }
                window.setTimeout(() => {
                    card.classList.remove('is-audio-rating-open');
                }, 1300);
                UI.triggerBadgeEvaluation({
                    userId: user.id,
                    reason: 'rating-success'
                });
            });

            shareLink?.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            audio.addEventListener('loadedmetadata', syncState);
            audio.addEventListener('timeupdate', syncState);
            audio.addEventListener('play', syncState);
            audio.addEventListener('playing', async () => {
                syncState();
                await countPlaybackStart();
            });
            audio.addEventListener('pause', syncState);
            audio.addEventListener('seeked', () => {
                if ((audio.currentTime || 0) <= 0.01 && audio.paused) {
                    resetPlaybackSession();
                }
            });
            audio.addEventListener('ended', () => {
                if (!audio.loop) {
                    resetPlaybackSession();
                    audio.currentTime = 0;
                }
                syncState();
            });

            card.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            this.updateAudioFeedLikeState(submission.id, !!submission._audioFeedIsLiked, stats.like_count || 0);
            this.updateAudioFeedBookmarkState(submission.id, !!submission._audioFeedIsBookmarked);
            this.updateAudioFeedRatingState(submission.id, stats.avg_rating || 0, submission._audioFeedUserRating);
            syncState();
            card.dataset.audioFeedBound = 'true';
        });
    },

    _updateLoadMoreButton(feedState = null, cacheEntry = null) {
        const btn = document.querySelector('#explore-load-more');
        if (!btn) return;
        const container = btn.closest('.explore-load-more-container');

        const useMobileInfiniteScroll = this._isMobileExplorePagination() && !this._mobileInfiniteFallback;
        if (useMobileInfiniteScroll) {
            if (container) container.style.display = 'none';
            btn.style.display = 'none';
            btn.disabled = true;
            return;
        }

        if (container) container.style.display = '';

        const useSingleNewestFeed = this._currentCategory === 'images' || this._isMobileAllWorkFeed();
        const resolvedFeedState = feedState || (
            useSingleNewestFeed
                ? this._buildImageFeedState(this._allFetchedData, this._displayCount)
                : this._buildFeedState(this._allFetchedData, this._displayCount)
        );
        const totalAvailable = Number(resolvedFeedState.totalAvailableUnique) || 0;
        const totalRendered = Number(resolvedFeedState.totalRendered) || 0;
        const hasMoreRemote = !!cacheEntry?.hasMore;

        if (hasMoreRemote || totalAvailable > totalRendered) {
            btn.style.display = 'inline-flex';
            btn.disabled = false;
            const remaining = Math.max(0, totalAvailable - totalRendered);
            btn.querySelector('.load-more-text').textContent = remaining > 0
                ? `Load More (${remaining} more)`
                : 'Load More';
        } else {
            btn.style.display = 'none';
            btn.disabled = true;
        }
    },

    renderCreatorSkeletons(count) {
        return Array.from({ length: count }, () => '<div class="creator-skeleton"></div>').join('');
    },

    _renderCreators(container, creators) {
        if (!container) return;

        const topCreators = (creators || []).slice(0, 5);

        if (!topCreators.length) {
            container.innerHTML = `
                <div class="creators-empty-state">
                    <span>Creators will appear here as new work is published.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = topCreators.map((creator, index) => `
            <article class="creator-spotlight-card animate-fade-in" data-rank="${index + 1}">
                <div class="creator-spotlight-media">
                    <div class="creator-rank-badge">${index === 0 ? 'Trending' : 'Creator'}</div>
                    <div class="creator-avatar-shell">
                        ${creator.avatar
                            ? `<img src="${creator.avatar}" alt="${creator.name}" class="creator-avatar-img" loading="lazy" decoding="async">`
                            : `<span class="creator-avatar-fallback">${creator.name.charAt(0).toUpperCase()}</span>`}
                    </div>
                </div>
                <div class="creator-spotlight-copy">
                    <h3 class="creator-name">${creator.name}</h3>
                    <p class="creator-title">${creator.title}</p>
                    <p class="creator-points">${creator.points} pts</p>
                </div>
            </article>
        `).join('');
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
        UI.setupMasonryCardInteractions(gridEl, {
            getUserId: () => App.user?.id || null
        });
    }
};
