// pages/explore.js
import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';

export const ExplorePage = {
    async init() {
        const grid = document.querySelector('#explore-grid');
        const searchInput = document.querySelector('#search-input');
        const categoryFilters = document.querySelector('#category-filters');
        let currentCategory = 'all';

        const loadSubmissions = async () => {
            grid.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;

            const category = currentCategory === 'all' ? null : currentCategory;
            const search = searchInput.value.toLowerCase();

            // Use 'created_at' for the latest submissions
            const sort = 'created_at';

            let { data, error } = await API.getSubmissions(category, sort);

            if (error) {
                UI.showToast('Error loading submissions', 'error');
                return;
            }

            if (search) {
                data = data.filter(s =>
                    s.title.toLowerCase().includes(search) ||
                    s.profiles?.display_name?.toLowerCase().includes(search)
                );
            }

            if (data.length === 0) {
                grid.innerHTML = `<p class="text-muted text-center p-40">No matching works found.</p>`;
                return;
            }

            grid.innerHTML = data.map(sub => UI.renderCard(sub)).join('');

            // Asynchronously load and update stats
            const ids = data.map(s => s.id);
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
                                `;
                            }
                        }
                    }
                });
            }).catch(console.error);
        };

        // Handle category filter clicks
        categoryFilters?.addEventListener('click', (e) => {
            const chip = e.target.closest('.category-clay-item');
            if (!chip) return;

            // Update active state
            categoryFilters.querySelectorAll('.category-clay-item').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            currentCategory = chip.dataset.category;
            loadSubmissions();
        });


        searchInput.addEventListener('input', UI.debounce(loadSubmissions, 500));

        await loadSubmissions();
    }
};
