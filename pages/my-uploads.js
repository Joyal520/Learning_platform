import { supabase } from '../assets/js/supabase.js';
import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';

export const MyUploadsPage = {
    async init() {
        const listContainer = document.querySelector('#my-uploads-list');
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

        if (data.length === 0) {
            listContainer.innerHTML = `<p class="text-muted text-center p-40">You haven't uploaded anything yet.</p>`;
            return;
        }

        listContainer.innerHTML = data.map(sub => `
            <div class="submission-item glass-card" data-id="${sub.id}">
                <div class="sub-info">
                    <h3>${sub.title}</h3>
                    <div class="sub-meta">
                        <span>Category: ${sub.category.replace('_', ' ')}</span>
                        <span>Uploaded: ${new Date(sub.created_at).toLocaleDateString()}</span>
                        <span class="badge badge-${sub.status}">${sub.status}</span>
                    </div>
                </div>
                <div class="sub-actions">
                    <a href="#edit/${sub.id}" class="btn btn-outline btn-sm">✏️ Edit</a>
                    <button class="btn btn-danger btn-sm action-delete" data-id="${sub.id}">Delete</button>
                </div>
            </div>
        `).join('');

        this.setupActions();
    },

    setupActions() {
        document.querySelectorAll('.action-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const title = btn.closest('.submission-item')?.querySelector('h3')?.textContent || 'this submission';
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
                console.log('[MyUploads] Attempting to delete:', id);
                const { data: sub, error: fetchError } = await supabase
                    .from('submissions')
                    .select('id, storage_provider, thumbnail_path, thumbnail_url, image_url, file_path, file_url')
                    .eq('id', id)
                    .maybeSingle();

                if (fetchError) throw fetchError;

                const { error } = await supabase.from('submissions').delete().eq('id', id);

                if (error) throw error;

                if (sub?.storage_provider === 'r2') {
                    try {
                        await API.deleteStoredMedia([
                            sub.thumbnail_path || sub.thumbnail_url,
                            sub.image_url,
                            sub.file_path,
                            sub.file_url
                        ], id);
                    } catch (cleanupErr) {
                        console.warn('[MyUploads] R2 cleanup warning:', cleanupErr);
                    }
                }
                
                UI.showToast('Submission deleted.', 'success');
                this.init(); // Refresh list
            } catch (err) {
                console.error('[MyUploads] Delete failed:', err);
                UI.showToast('Delete failed: ' + err.message, 'error');
            } finally {
                overlay.remove();
            }
        });
    }
};
