import { supabase } from '../assets/js/supabase.js';
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
            <div class="submission-item">
                <div class="sub-info">
                    <h3>${sub.title}</h3>
                    <div class="sub-meta">
                        <span>Category: ${sub.category.replace('_', ' ')}</span>
                        <span>Uploaded: ${new Date(sub.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
                <div class="sub-actions">
                    <a href="#edit/${sub.id}" class="btn btn-edit btn-sm">✏️ Edit</a>
                    <span class="badge badge-${sub.status}">${sub.status}</span>
                </div>
            </div>
        `).join('');
    }
};
