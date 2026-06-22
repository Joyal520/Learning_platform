import { supabase } from '../assets/js/supabase.js';
import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';

const DEBUG_LOGS = false;
const debugLog = (...args) => { if (DEBUG_LOGS) console.log(...args); };

export const MyUploadsPage = {
    _submissions: [],
    _filter: 'all',
    _search: '',
    _sortOrder: 'newest',

    async init() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('submissions')
            .select('*')
            .eq('author_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            UI.showToast('Failed to load uploads', 'error');
            return;
        }

        this._submissions = data || [];
        this._filter = 'all';
        this._search = '';
        this._sortOrder = 'newest';

        this.renderStats();
        this.renderHeroArt();
        this.renderSubmissions();
        this.setupFilters();
        this.setupActions();
    },

    renderStats() {
        const statsContainer = document.querySelector('#my-gallery-stats');
        if (!statsContainer) return;

        const counts = this._submissions.reduce((acc, sub) => {
            const status = String(sub.status || 'pending').toLowerCase();
            acc.total += 1;
            if (status === 'approved') acc.approved += 1;
            else if (status === 'rejected') acc.rejected += 1;
            else acc.pending += 1;
            return acc;
        }, { total: 0, approved: 0, pending: 0, rejected: 0 });

        statsContainer.innerHTML = `
            <div class="my-gallery-stat-card">
                <span class="my-gallery-stat-icon" aria-hidden="true">&#128193;</span>
                <span class="my-gallery-stat-copy">
                    <strong class="my-gallery-stat-number">${counts.total}</strong>
                    <small class="my-gallery-stat-label">Total Submissions</small>
                </span>
            </div>
            <div class="my-gallery-stat-card">
                <span class="my-gallery-stat-icon my-gallery-stat-icon-approved" aria-hidden="true">&#10003;</span>
                <span class="my-gallery-stat-copy">
                    <strong class="my-gallery-stat-number">${counts.approved}</strong>
                    <small class="my-gallery-stat-label">Approved</small>
                </span>
            </div>
            <div class="my-gallery-stat-card">
                <span class="my-gallery-stat-icon my-gallery-stat-icon-pending" aria-hidden="true">&#9716;</span>
                <span class="my-gallery-stat-copy">
                    <strong class="my-gallery-stat-number">${counts.pending}</strong>
                    <small class="my-gallery-stat-label">Pending</small>
                </span>
            </div>
            <div class="my-gallery-stat-card">
                <span class="my-gallery-stat-icon my-gallery-stat-icon-rejected" aria-hidden="true">&times;</span>
                <span class="my-gallery-stat-copy">
                    <strong class="my-gallery-stat-number">${counts.rejected}</strong>
                    <small class="my-gallery-stat-label">Rejected</small>
                </span>
            </div>
        `;
    },

    renderHeroArt() {
        const heroArt = document.querySelector('#my-gallery-hero-art');
        if (!heroArt) return;

        const previews = this._submissions.slice(0, 2).map((sub, index) => {
            const thumb = this.getSubmissionThumb(sub);
            const title = UI.escapeHtml(sub.title || 'Creation preview');
            const className = `my-gallery-hero-float my-gallery-hero-float-${index + 1}`;
            return thumb
                ? `<img class="${className}" src="${UI.escapeHtml(thumb)}" alt="${title}" loading="lazy" decoding="async" onerror="this.replaceWith(document.createElement('span'));">`
                : `<div class="${className}">${UI.getCategoryEmoji(sub.category, sub.content_type)}</div>`;
        }).join('');

        heroArt.innerHTML = `
            ${previews || '<div class="my-gallery-hero-float my-gallery-hero-float-1">✨</div><div class="my-gallery-hero-float my-gallery-hero-float-2">📄</div>'}
            <div class="my-gallery-paper-visual"></div>
            <div class="my-gallery-folder-visual"><span></span></div>
        `;
    },

    setupFilters() {
        document.querySelectorAll('[data-gallery-filter]').forEach((button) => {
            button.addEventListener('click', () => {
                this._filter = button.dataset.galleryFilter || 'all';
                document.querySelectorAll('[data-gallery-filter]').forEach((chip) => {
                    chip.classList.toggle('is-active', chip === button);
                });
                this.renderSubmissions();
            });
        });

        const searchInput = document.querySelector('#my-gallery-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._search = searchInput.value.trim().toLowerCase();
                this.renderSubmissions();
            });
        }

        const sortButton = document.querySelector('#my-gallery-sort-btn');
        if (sortButton) {
            sortButton.addEventListener('click', () => {
                this._sortOrder = this._sortOrder === 'newest' ? 'oldest' : 'newest';
                sortButton.dataset.sortOrder = this._sortOrder;
                sortButton.textContent = this._sortOrder === 'newest' ? 'Sort' : 'Oldest';
                this.renderSubmissions();
            });
        }

        const filterButton = document.querySelector('#my-gallery-filter-btn');
        if (filterButton) {
            filterButton.addEventListener('click', () => {
                document.querySelector('#my-gallery-category-filters')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }
    },

    renderSubmissions() {
        const listContainer = document.querySelector('#my-uploads-list');
        if (!listContainer) return;

        const visible = this.getVisibleSubmissions();

        if (this._submissions.length === 0) {
            listContainer.innerHTML = `
                <div class="my-gallery-empty-state">
                    <span>✨</span>
                    <h3>No creations yet</h3>
                    <p>Your submitted creations will appear here once you upload your first work.</p>
                    <a href="#upload" class="my-gallery-empty-btn" data-link="upload">Upload New Work</a>
                </div>
            `;
            return;
        }

        if (visible.length === 0) {
            listContainer.innerHTML = `
                <div class="my-gallery-empty-state">
                    <span>🔎</span>
                    <h3>No matching submissions</h3>
                    <p>Try a different search term or category filter.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = visible.map((sub) => this.renderGalleryCard(sub)).join('');
        this.setupActions();
    },

    getVisibleSubmissions() {
        const search = this._search;
        return [...this._submissions]
            .filter((sub) => this.matchesFilter(sub))
            .filter((sub) => {
                if (!search) return true;
                const title = String(sub.title || '').toLowerCase();
                const category = `${sub.category || ''} ${sub.content_type || ''} ${UI.getContentTypeLabel(sub.category, sub.content_type)}`.toLowerCase();
                return title.includes(search) || category.includes(search);
            })
            .sort((a, b) => {
                const aTime = new Date(a.created_at || 0).getTime();
                const bTime = new Date(b.created_at || 0).getTime();
                return this._sortOrder === 'oldest' ? aTime - bTime : bTime - aTime;
            });
    },

    matchesFilter(sub) {
        if (this._filter === 'all') return true;
        const normalizedCategory = UI.normalizeCategoryValue(sub.category, sub.content_type);
        const contentType = String(sub.content_type || '').toLowerCase();
        const fileType = String(sub.file_type || sub.mime_type || '').toLowerCase();
        const refs = `${sub.file_url || ''} ${sub.file_path || ''} ${sub.thumbnail_url || ''}`.toLowerCase();

        if (this._filter === 'short_stories') {
            return normalizedCategory === 'short_stories' || normalizedCategory.includes('story');
        }
        if (this._filter === 'video') {
            return UI.isVideoSubmission(sub) || normalizedCategory === 'video' || contentType === 'video';
        }
        if (this._filter === 'pdf') {
            return fileType.includes('pdf') || refs.includes('.pdf') || normalizedCategory === 'pdf';
        }
        if (this._filter === 'images') {
            return UI.isImageSubmission(sub) || normalizedCategory === 'images' || contentType === 'image';
        }
        return true;
    },

    renderGalleryCard(sub) {
        const title = UI.escapeHtml(sub.title || 'Untitled creation');
        const category = UI.escapeHtml(UI.getContentTypeLabel(sub.category, sub.content_type) || 'Creation');
        const status = String(sub.status || 'pending').toLowerCase();
        const date = this.formatDate(sub.created_at);
        const thumb = this.getSubmissionThumb(sub);
        const fallback = UI.escapeHtml(UI.getThumbnailFallbackUrl(sub) || 'assets/images/default.png');
        const stats = UI.ensureSubmissionStats(sub);
        const statusLabel = this.getStatusLabel(status);
        const placeholderIcon = UI.getCategoryEmoji(sub.category, sub.content_type);

        return `
            <article class="my-gallery-card" data-id="${sub.id}">
                <div class="my-gallery-card-media">
                    <span class="my-gallery-status-badge my-gallery-status-${status}">${statusLabel}</span>
                    <button class="my-gallery-card-menu" type="button" aria-label="Submission actions">⋮</button>
                    ${thumb
                        ? `<img src="${UI.escapeHtml(thumb)}" alt="${title}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='${fallback}';">`
                        : `<div class="my-gallery-card-placeholder"><span>${placeholderIcon}</span></div>`}
                    ${UI.isVideoSubmission(sub) ? '<span class="my-gallery-video-badge">▶</span>' : ''}
                </div>
                <div class="my-gallery-card-body">
                    <h3>${title}</h3>
                    <p>${category} <span>•</span> ${date}</p>
                    <div class="my-gallery-card-stats">
                        <span>★ ${UI.formatAverageRating(stats)}</span>
                        <span>♥ ${stats.like_count || 0}</span>
                        <span>👁 ${stats.view_count || 0}</span>
                    </div>
                    <div class="my-gallery-card-actions">
                        <a href="#edit/${sub.id}" class="my-gallery-edit-btn" data-link="edit/${sub.id}">✏ Edit</a>
                        <button class="my-gallery-delete-btn action-delete" type="button" data-id="${sub.id}">Delete</button>
                    </div>
                </div>
            </article>
        `;
    },

    getSubmissionThumb(sub) {
        const urls = UI.getSubmissionImageUrls(sub);
        return urls?.previewUrl || urls?.fullUrl || '';
    },

    getStatusLabel(status) {
        if (status === 'approved') return '✓ Approved';
        if (status === 'rejected') return '× Rejected';
        return '◔ Pending';
    },

    formatDate(value) {
        if (!value) return 'Unknown date';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Unknown date';
        return date.toLocaleDateString();
    },

    setupActions() {
        document.querySelectorAll('.action-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const title = btn.closest('.my-gallery-card, .submission-item')?.querySelector('h3')?.textContent || 'this submission';
                this.showDeleteConfirmation(id, title);
            });
        });
    },

    showDeleteConfirmation(id, title) {
        document.querySelector('.delete-modal-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'delete-modal-overlay';
        overlay.innerHTML = `
            <div class="delete-modal">
                <h3>⚠️ Delete Submission</h3>
                <p>Are you sure you want to permanently delete <strong>"${title}"</strong>? This action cannot be undone.</p>
                <div class="delete-modal-actions">
                    <button class="btn btn-cancel" id="delete-cancel">Cancel</button>
                    <button class="btn btn-confirm-delete" id="delete-confirm">Yes, Delete</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('delete-cancel').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        document.getElementById('delete-confirm').addEventListener('click', async () => {
            const confirmBtn = document.getElementById('delete-confirm');
            confirmBtn.textContent = 'Deleting...';
            confirmBtn.disabled = true;

            try {
                debugLog('[MyUploads] Attempting to delete:', id);
                const { data: sub, error: fetchError } = await supabase
                    .from('submissions')
                    .select('*')
                    .eq('id', id)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                const { error } = await supabase.from('submissions').delete().eq('id', id);

                if (error) throw error;

                const zipWebsiteState = UI.getSubmissionZipWebsiteState(sub || {});
                if (sub?.storage_provider === 'r2') {
                    try {
                        await API.deleteStoredMedia([
                            sub.thumbnail_path || sub.thumbnail_url,
                            sub.image_url,
                            sub.file_path,
                            sub.file_url,
                            zipWebsiteState.extracted_root_path ? `${zipWebsiteState.extracted_root_path}/` : null
                        ], id);
                    } catch (cleanupErr) {
                        console.warn('[MyUploads] R2 cleanup warning:', cleanupErr);
                    }
                }

                UI.showToast('Submission deleted.', 'success');
                this.init();
            } catch (err) {
                console.error('[MyUploads] Delete failed:', err);
                UI.showToast('Delete failed: ' + err.message, 'error');
            } finally {
                overlay.remove();
            }
        });
    }
};
