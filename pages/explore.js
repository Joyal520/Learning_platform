// pages/explore.js
import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';

export const ExplorePage = {
    async init() {
        const grid = document.querySelector('#explore-grid');
        const catFilter = document.querySelector('#filter-category');
        const sortFilter = document.querySelector('#filter-sort');
        const searchInput = document.querySelector('#search-input');

        const loadSubmissions = async () => {
            grid.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;

            const category = catFilter.value === 'all' ? null : catFilter.value;
            const sort = sortFilter.value;
            const search = searchInput.value.toLowerCase();

            let { data, error } = await API.getSubmissions(category, sort);

            if (error) {
                UI.showToast('Error loading submissions', 'error');
                return;
            }

            // Client side search filter (can be moved to server if needed)
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
        };

        catFilter.addEventListener('change', loadSubmissions);
        sortFilter.addEventListener('change', loadSubmissions);
        searchInput.addEventListener('input', UI.debounce(loadSubmissions, 500));

        await loadSubmissions();
    }
};
