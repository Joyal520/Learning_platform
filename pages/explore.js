import { API } from '../assets/js/api.js?v=10';
import { UI } from '../assets/js/ui.js?v=10';
import App from '../assets/js/app.js?v=10';

export const ExplorePage = {
    _stateStorageKey: 'edtechra_explore_state',
    _restoreFlagKey: 'edtechra_explore_restore_once',
    _currentCategory: 'all',
    _currentGroup: null,
    _currentTheme: null,
    _isLoading: false,
    _allFetchedData: [],  // holds all fetched submissions for Load More
    _displayCount: 6,     // initial items to show per section
    _loadMoreStep: 6,     // how many more to show each click
    _topCreators: [],
    _isSearchFocused: false,

    _getDesktopSectionCount() {
        return window.matchMedia('(min-width: 993px)').matches ? 4 : 3;
    },

    _getBaseDisplayCount() {
        return window.matchMedia('(min-width: 993px)').matches ? 4 : 6;
    },

    _readSavedState() {
        try {
            const raw = sessionStorage.getItem(this._stateStorageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
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

        try {
            sessionStorage.setItem(this._stateStorageKey, JSON.stringify(payload));
        } catch (_) {
            // Ignore storage failures and keep Explore functional.
        }
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
        this._currentCategory = 'all';
        this._currentGroup = null;
        this._currentTheme = null;
        this._isLoading = false;
        this._allFetchedData = [];
        this._displayCount = this._getBaseDisplayCount();
        this._topCreators = [];
        this._isSearchFocused = false;
        const shouldRestoreState = this._consumeRestoreFlag();
        const savedState = shouldRestoreState ? this._readSavedState() : null;

        if (savedState) {
            this._currentCategory = savedState.category || 'all';
            this._currentGroup = savedState.group || null;
            this._currentTheme = savedState.theme || null;
            this._displayCount = Number(savedState.displayCount) > 0
                ? Number(savedState.displayCount)
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
            if (!container || !main || !sidebar || !hero || !desktopDiscovery || !mobileDiscovery || !searchCard || !categoriesCard || !sectionsContainer || !creatorsSection) return;

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
                if (desktopDiscovery.nextElementSibling !== creatorsSection) {
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
                sectionsContainer.prepend(creatorsSection);
                sidebar.classList.add('explore-sidebar-empty');
                updateCreatorsVisibility();
            } else {
                closeDesktopDropdown();
                container.classList.remove('explore-mobile-flow');
                container.classList.remove('explore-desktop-flow');
                sidebar.classList.remove('explore-sidebar-empty');
                placeDiscoveryCards(sidebar);
                sectionsContainer.prepend(creatorsSection);
                updateCreatorsVisibility();
            }
        };

        syncResponsiveLayout();

        if (this._mobileLayoutHandler) {
            window.removeEventListener('resize', this._mobileLayoutHandler);
        }
        this._mobileLayoutHandler = UI.debounce(syncResponsiveLayout, 80);
        window.addEventListener('resize', this._mobileLayoutHandler);

        const loadAllSections = async (isLoadMore = false) => {
            if (this._isLoading) return;
            this._isLoading = true;

            const gridTrending = document.querySelector('#grid-trending');
            const gridNew = document.querySelector('#grid-new');
            const gridTop = document.querySelector('#grid-top');
            const creatorsRow = document.querySelector('#trending-creators-row');
            const searchInput = getSearchInput();

            const category = this._currentCategory === 'all' ? null : this._currentCategory;
            const search = searchInput?.value?.toLowerCase()?.trim() || '';

            // Show skeletons only on initial load or filter change
            if (!isLoadMore) {
                [gridTrending, gridNew, gridTop].forEach(g => {
                    if (g) g.innerHTML = this.renderSkeletons(3);
                });
                if (creatorsRow) {
                    creatorsRow.innerHTML = this.renderCreatorSkeletons(3);
                }
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

                if (this._currentTheme) {
                    filteredData = filteredData.filter((submission) =>
                        Array.isArray(submission.themes) && submission.themes.includes(this._currentTheme)
                    );
                }

                if (this._currentGroup) {
                    filteredData = filteredData.filter((submission) =>
                        UI.getContentTypeOption(submission.category, submission.content_type)?.group === this._currentGroup
                    );
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

                if (!this._topCreators.length) {
                    const { data: creators } = await API.getTopCreators(10);
                    this._topCreators = creators || [];
                }

                // Determine if this is images category (uses different card rendering)
                const isImages = this._currentCategory === 'images';

                this._renderCreators(creatorsRow, this._topCreators);

                // --- Trending section ---
                const desktopSectionCount = this._getDesktopSectionCount();

                const trending = [...filteredData].sort((a, b) => {
                    const sA = a.submission_stats[0];
                    const sB = b.submission_stats[0];
                    if (sB.like_count !== sA.like_count) return (sB.like_count || 0) - (sA.like_count || 0);
                    return (sB.view_count || 0) - (sA.view_count || 0);
                }).slice(0, desktopSectionCount);

                this._renderGrid(gridTrending, trending, { text: 'TRENDING', className: 'badge-trending' }, isImages);

                // --- New section ---
                const newItems = filteredData.slice(0, this._displayCount);
                this._renderGrid(gridNew, newItems, { text: 'NEW', className: 'badge-new' }, isImages);

                // --- Top rated section ---
                const topRated = [...filteredData].sort((a, b) => {
                    const avgA = Number(a.submission_stats[0].avg_rating) || 0;
                    const avgB = Number(b.submission_stats[0].avg_rating) || 0;
                    return avgB - avgA;
                }).slice(0, this._displayCount);

                this._renderGrid(gridTop, topRated, { text: 'TOP RATED', className: 'badge-top' }, isImages);

                // Update Load More button visibility
                this._updateLoadMoreButton();
                this._persistState(searchInput?.value || '', window.scrollY);

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
                const trendingCreationsSection = getTrendingCreationsSection();
                if (!trendingCreationsSection) return;
                trendingCreationsSection.scrollIntoView({
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
            requestAnimationFrame(() => {
                window.scrollTo({ top: Math.max(0, Number(savedState.scrollY) || 0), behavior: 'auto' });
            });
        }
    },

    _renderGrid(gridEl, items, badgeObj, isImages) {
        if (!gridEl) return;

        if (items.length === 0) {
            gridEl.innerHTML = `<p class="text-muted text-center" style="grid-column: 1/-1; padding: 40px;">No matching works found.</p>`;
            return;
        }

        if (isImages) {
            gridEl.classList.add('masonry-grid', 'image-feed-grid');
            gridEl.innerHTML = items.map(w => UI.renderMasonryCard(w)).join('');
            this.setupMasonryInteractions(gridEl);
        } else {
            gridEl.classList.remove('masonry-grid', 'image-feed-grid');
            gridEl.innerHTML = items.map(w => UI.renderCard(w, badgeObj)).join('');
            this.setupAudioFeedCards(gridEl, items);
        }
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

    updateAudioFeedRatingState(submissionId, avgRating, activeRating = null) {
        const roundedAverage = Math.round(Number(avgRating) || 0);
        const selectedRating = activeRating ?? roundedAverage;

        document.querySelectorAll(`.audio-feed-card[data-id="${submissionId}"]`).forEach((card) => {
            const ratingValue = card.querySelector('.audio-feed-rating-value');
            const stars = card.querySelectorAll('[data-audio-action="rate"]');

            if (ratingValue) {
                ratingValue.textContent = Number(avgRating || 0).toFixed(1);
            }

            stars.forEach((star) => {
                const value = Number(star.dataset.rating || 0);
                star.classList.toggle('is-active', value <= selectedRating);
            });
        });
    },

    setupAudioFeedCards(gridEl, items) {
        if (!gridEl) return;

        const submissionsById = new Map((items || []).map((item) => [String(item.id), item]));
        const audioCards = gridEl.querySelectorAll('.audio-feed-card');
        if (!audioCards.length) return;

        audioCards.forEach((card) => {
            const submission = submissionsById.get(String(card.dataset.id || ''));
            const audio = card.querySelector('.audio-feed-native');
            const playButton = card.querySelector('[data-audio-action="toggle"]');
            const loopButton = card.querySelector('[data-audio-action="loop"]');
            const likeButton = card.querySelector('[data-audio-action="like"]');
            const rateButtons = card.querySelectorAll('[data-audio-action="rate"]');
            const progressTrack = card.querySelector('[data-audio-action="seek"]');
            const progressFill = card.querySelector('.audio-feed-progress-fill');
            const shareLink = card.querySelector('.audio-feed-share');

            if (!submission || !audio || !playButton || !loopButton || !progressTrack || !progressFill) return;

            const stats = submission.submission_stats?.[0] || (submission.submission_stats = [{
                avg_rating: 0,
                like_count: 0,
                view_count: 0
            }])[0];

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
            });

            rateButtons.forEach((button) => {
                button.addEventListener('click', async (event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    const user = App.user;
                    if (!user) return UI.showToast('Please login to rate', 'error');

                    const rating = Number(button.dataset.rating || 0);
                    const { data, error } = await API.rateSubmission(submission.id, user.id, rating);
                    if (error || !data) {
                        UI.showToast(error?.message || 'Could not save rating.', 'error');
                        return;
                    }

                    stats.avg_rating = data.avgRating;
                    submission._audioFeedUserRating = data.userRating;
                    this.updateAudioFeedRatingState(submission.id, data.avgRating, data.userRating);
                    UI.showToast('Rated!', 'success');
                });
            });

            shareLink?.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            audio.addEventListener('loadedmetadata', syncState);
            audio.addEventListener('timeupdate', syncState);
            audio.addEventListener('play', syncState);
            audio.addEventListener('pause', syncState);
            audio.addEventListener('ended', () => {
                if (!audio.loop) {
                    audio.currentTime = 0;
                }
                syncState();
            });

            card.addEventListener('click', (event) => {
                event.stopPropagation();
            });

            this.updateAudioFeedLikeState(submission.id, !!submission._audioFeedIsLiked, stats.like_count || 0);
            this.updateAudioFeedRatingState(submission.id, stats.avg_rating || 0, submission._audioFeedUserRating);
            syncState();
        });
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
                            ? `<img src="${creator.avatar}" alt="${creator.name}" class="creator-avatar-img">`
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
        if (!gridEl) return;

        gridEl.addEventListener('click', async (e) => {
            const btn = e.target.closest('.interaction-btn');
            const downloadBtn = e.target.closest('.btn-download');
            const shareBtn = e.target.closest('.btn-share');

            if (downloadBtn) {
                e.preventDefault();
                e.stopPropagation();
                await UI.downloadFile(downloadBtn.href, downloadBtn.dataset.filename || 'image');
                return;
            }

            if (shareBtn) {
                e.stopPropagation();
                return;
            }
            
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
                    const fullUrl = card.dataset.fullUrl || card.dataset.previewUrl;
                    const title = imgWrapper.querySelector('.masonry-img')?.alt || 'Image';
                    if (fullUrl) UI.showImageLightbox(fullUrl, title);
                }
            }
        });
    }
};
