// pages/dashboard.js
import { supabase } from '../assets/js/supabase.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';
import { API } from '../assets/js/api.js';

export const DashboardPage = {
    currentTab: 'pending',

    isLocalDevelopment() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1';
    },

    formatStorageUsage(totalBytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = totalBytes;
        let unitIndex = 0;

        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }

        const decimals = unitIndex === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;
        return `${value.toFixed(decimals)} ${units[unitIndex]}`;
    },

    normalizeStoragePath(value) {
        if (!value) return null;

        if (!value.startsWith('http')) {
            return value.replace(/^\/+/, '');
        }

        try {
            const url = new URL(value);
            const marker = '/object/public/approved_public/';
            const idx = url.pathname.indexOf(marker);
            if (idx === -1) return null;
            return decodeURIComponent(url.pathname.slice(idx + marker.length)).replace(/^\/+/, '');
        } catch (err) {
            console.warn('[Dashboard] Could not normalize storage path:', value, err);
            return null;
        }
    },

    async init() {
        if (!App.profile || App.profile.role !== 'admin') {
            window.location.hash = 'home';
            return;
        }

        const main = document.getElementById('main-content');
        main.innerHTML = UI.pages.dashboard(App.profile.role);

        this.setupTabs();
        this.setupDiagnostics();
        this.loadTabContent();
        if (App.profile.role === 'admin') this.loadStats();
    },

    setupDiagnostics() {
        const button = document.getElementById('run-r2-diagnostics-btn');
        const panel = document.getElementById('r2-diagnostics-panel');
        const status = document.getElementById('r2-diagnostics-status');
        const output = document.getElementById('r2-diagnostics-output');

        if (!button || !panel || !status || !output) return;

        button.addEventListener('click', async () => {
            console.log('[Dashboard] Starting authenticated R2 diagnostics request...');
            panel.style.display = 'block';
            status.textContent = 'Running authenticated R2 diagnostics...';
            output.textContent = '';
            button.disabled = true;
            button.textContent = 'Running...';

            try {
                const diagnostics = await API.getR2Diagnostics(true);
                console.log('[Dashboard] R2 diagnostics request succeeded:', diagnostics);

                status.textContent = 'Authenticated R2 diagnostics completed.';
                output.textContent = JSON.stringify({
                    activeAccountId: diagnostics.activeAccountId || '(not configured)',
                    activeBucketName: diagnostics.activeBucketName,
                    endpointHost: diagnostics.endpointHost,
                    publicBaseUrl: diagnostics.publicBaseUrl || '(not configured)',
                    realR2ObjectCount: diagnostics.realR2ObjectCount,
                    realR2TotalBytes: diagnostics.realR2TotalBytes,
                    firstFiveObjectKeys: diagnostics.firstFiveObjectKeys || [],
                    lastFiveObjectKeys: diagnostics.lastFiveObjectKeys || []
                }, null, 2);
            } catch (err) {
                console.error('[Dashboard] R2 diagnostics request failed:', err);
                status.textContent = `Diagnostics failed: ${err.message}`;
                output.textContent = '';
            } finally {
                button.disabled = false;
                button.textContent = 'Run R2 Diagnostics';
            }
        });
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const active = document.querySelector('.tab-btn.active');
                if (active) active.classList.remove('active');
                btn.classList.add('active');
                this.currentTab = btn.dataset.tab;
                this.loadTabContent();
            });
        });
    },

    async loadStats() {
        const elS = document.getElementById('stat-storage');
        const elB = document.getElementById('storage-bar');
        const elCount = document.getElementById('stat-storage-count');
        const elBucket = document.getElementById('stat-storage-bucket');
        const elBreakdown = document.getElementById('stat-storage-breakdown');

        if (elS) elS.textContent = 'Loading...';
        if (elCount) elCount.textContent = 'Loading files...';
        if (elBucket) elBucket.textContent = 'Bucket: --';
        if (elBreakdown) elBreakdown.textContent = 'Loading Cloudflare metrics...';

        const [
            { count: users },
            { count: pending },
            { count: approved }
        ] = await Promise.all([
            supabase.from('profiles').select('*', { count: 'exact', head: true }),
            supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
            supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved')
        ]);

        let storageUnavailable = false;
        let metrics = null;
        let storageMessage = 'Cloudflare R2 metrics are currently unavailable.';
        let isLocalDevFallback = false;

        try {
            metrics = await API.getR2Metrics();
        } catch (err) {
            const isLocalMissingRoute = this.isLocalDevelopment() && err?.status === 404;
            if (isLocalMissingRoute) {
                console.info('[Dashboard] R2 metrics API is not available in local development:', err.url || '/api/r2-metrics');
                storageMessage = 'Cloudflare R2 metrics are not available in local development.';
                isLocalDevFallback = true;
            } else {
                console.error('R2 metrics error:', err);
            }
            storageUnavailable = true;
        }

        const elU = document.getElementById('stat-users');
        const elP = document.getElementById('stat-pending');
        const elA = document.getElementById('stat-approved');

        if (elU) elU.textContent = users || '0';
        if (elP) elP.textContent = pending || '0';
        if (elA) elA.textContent = approved || '0';
        if (elS) {
            elS.textContent = storageUnavailable ? 'Unavailable' : this.formatStorageUsage(metrics.totalBytes || 0);
            elS.title = storageUnavailable
                ? storageMessage
                : 'Live total calculated from Cloudflare R2 object sizes.';
        }
        if (elCount) {
            elCount.textContent = storageUnavailable
                ? (isLocalDevFallback ? 'Metrics unavailable in local dev' : 'Metrics unavailable')
                : `${metrics.fileCount || 0} files`;
        }
        if (elBucket) {
            elBucket.textContent = storageUnavailable
                ? (isLocalDevFallback ? 'Bucket: local dev fallback' : 'Bucket: unavailable')
                : `Bucket: ${metrics.bucket}`;
        }
        if (elBreakdown) {
            elBreakdown.textContent = storageUnavailable
                ? (isLocalDevFallback ? 'Cloudflare metrics are unavailable locally.' : 'Could not load folder breakdown.')
                : `images ${metrics.breakdown.images.count} | audio ${metrics.breakdown.audio.count} | projects ${metrics.breakdown.projects.count} | thumbs ${metrics.breakdown.thumbnails.count}`;
        }
        if (elB) {
            elB.style.width = storageUnavailable ? '0%' : ((metrics.totalBytes || 0) > 0 ? '100%' : '0%');
            elB.title = storageUnavailable
                ? storageMessage
                : 'Live total available. No quota percentage is shown because bucket limit data is not exposed here.';
        }
    },

    async loadTabContent() {
        const content = document.getElementById('tab-content');
        content.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;

        if (this.currentTab === 'users') {
            const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (error) return UI.showToast(error.message, 'error');
            content.innerHTML = data.map(u => UI.pages.userRow(u)).join('');
            this.setupUserActions();
        } else {
            // Optimized: Select only required fields, avoiding massive content_text downloads
            let query = supabase.from('submissions')
                .select('id, title, category, status, created_at, author_id, review_note, thumbnail_path, thumbnail_url, profiles!author_id(display_name)')
                .order('created_at', { ascending: false });
            if (this.currentTab === 'pending') query = query.eq('status', 'pending');
            if (this.currentTab === 'approved') query = query.eq('status', 'approved');

            const { data, error } = await query;

            if (error) return UI.showToast(error.message, 'error');

            if (data.length === 0) {
                content.innerHTML = `<p class="text-muted text-center p-40">No submissions found here.</p>`;
            } else {
                content.innerHTML = data.map(sub => UI.pages.submissionRow(sub, App.profile.role)).join('');
                this.setupSubmissionActions();
            }
        }
    },

    setupSubmissionActions() {
        document.querySelectorAll('.action-approve').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                let error = null;

                try {
                    const { data: sub, error: fetchError } = await supabase
                        .from('submissions')
                        .select('id, content_type')
                        .eq('id', id)
                        .maybeSingle();

                    if (fetchError) throw fetchError;
                    if (sub?.content_type === 'image') {
                        await API.promotePendingImageSubmission(id);
                    }

                    const { error: approveError } = await supabase.from('submissions').update({
                        status: 'approved',
                        approved_by: App.user.id
                    }).eq('id', id);
                    error = approveError;
                } catch (approveErr) {
                    error = approveErr;
                }

                if (error) UI.showToast(error.message, 'error');
                else {
                    UI.showToast('Submission approved!', 'success');
                    this.loadTabContent();
                }
            });
        });

        document.querySelectorAll('.action-reject').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const note = prompt('Enter rejection reason:');
                if (note === null) return;

                const { error } = await supabase.from('submissions').update({
                    status: 'rejected',
                    review_note: note
                }).eq('id', id);

                if (error) UI.showToast(error.message, 'error');
                else {
                    UI.showToast('Submission rejected');
                    this.loadTabContent();
                }
            });
        });

        document.querySelectorAll('.action-preview').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.hash = `detail/${btn.dataset.id}`;
            });
        });

        // Edit action — navigate to edit page
        document.querySelectorAll('.action-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                window.location.hash = `edit/${btn.dataset.id}`;
            });
        });

        // Delete action — show confirmation modal
        document.querySelectorAll('.action-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const title = btn.closest('.submission-item')?.querySelector('h3')?.textContent || 'this submission';
                this.showDeleteConfirmation(id, title);
            });
        });
    },

    showDeleteConfirmation(submissionId, title) {
        // Remove any existing modal
        document.querySelector('.delete-modal-overlay')?.remove();

        const overlay = document.createElement('div');
        overlay.className = 'delete-modal-overlay';
        overlay.innerHTML = `
            <div class="delete-modal">
                <h3>⚠️ Delete Submission</h3>
                <p>Are you sure you want to permanently delete <strong>"${title}"</strong>? This action cannot be undone. All associated likes, ratings, views, and bookmarks will also be removed.</p>
                <div class="delete-modal-actions">
                    <button class="btn btn-cancel" id="delete-cancel">Cancel</button>
                    <button class="btn btn-confirm-delete" id="delete-confirm">Yes, Delete</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Cancel
        document.getElementById('delete-cancel').addEventListener('click', () => {
            overlay.remove();
        });

        // Click outside to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        // Confirm delete
        document.getElementById('delete-confirm').addEventListener('click', async () => {
            const confirmBtn = document.getElementById('delete-confirm');
            console.log('[Dashboard] Delete confirmed for ID:', submissionId);
            confirmBtn.textContent = 'Deleting...';
            confirmBtn.disabled = true;

            try {
                console.log('[Dashboard] Cleaning up dependent records for ID:', submissionId);
                
                // 0. Fetch submission files before deletion to clear storage
                const { data: sub, error: subError } = await supabase.from('submissions')
                    .select('id, title, thumbnail_path, thumbnail_url, image_url, file_path, file_url, category, storage_provider')
                    .eq('id', submissionId)
                    .maybeSingle();

                if (subError) throw subError;
                if (!sub) throw new Error('Submission could not be found. It may already be deleted or you may not have permission.');

                // 1. Delete dependent records first (to avoid foreign key constraint errors)
                const [lErr, bErr, rErr, cErr, vErr, dErr, pErr] = await Promise.all([
                    supabase.from('likes').delete().eq('submission_id', submissionId),
                    supabase.from('bookmarks').delete().eq('submission_id', submissionId),
                    supabase.from('ratings').delete().eq('submission_id', submissionId),
                    supabase.from('comments').delete().eq('submission_id', submissionId),
                    supabase.from('views').delete().eq('submission_id', submissionId),
                    supabase.from('downloads').delete().eq('submission_id', submissionId),
                    supabase.from('reports').delete().eq('submission_id', submissionId)
                ]);

                if (lErr?.error) console.warn('[Dashboard] Could not clear likes:', lErr.error);
                if (bErr?.error) console.warn('[Dashboard] Could not clear bookmarks:', bErr.error);
                if (rErr?.error) console.warn('[Dashboard] Could not clear ratings:', rErr.error);
                if (cErr?.error) console.warn('[Dashboard] Could not clear comments:', cErr.error);
                if (vErr?.error) console.warn('[Dashboard] Could not clear views:', vErr.error);
                if (dErr?.error) console.warn('[Dashboard] Could not clear downloads:', dErr.error);
                if (pErr?.error) console.warn('[Dashboard] Could not clear reports:', pErr.error);

                // 2. Delete the submission itself
                console.log('[Dashboard] Deleting submission record:', submissionId);
                let removalMode = 'hard-delete';
                let removalError = null;
                let removed = false;

                const { data: deletedRow, error } = await supabase
                    .from('submissions')
                    .delete()
                    .eq('id', submissionId)
                    .select('id')
                    .maybeSingle();

                if (error) {
                    removalError = error;
                } else if (deletedRow) {
                    removed = true;
                } else {
                    removalError = new Error('Delete did not remove the submission.');
                }

                if (!removed) {
                    console.warn('[Dashboard] Hard delete unavailable, attempting soft delete fallback:', removalError);
                    const { data: softDeletedRow, error: softDeleteError } = await supabase
                        .from('submissions')
                        .update({
                            status: 'rejected',
                            review_note: 'Removed by admin'
                        })
                        .eq('id', submissionId)
                        .select('id')
                        .maybeSingle();

                    if (softDeleteError) {
                        throw softDeleteError;
                    }

                    if (!softDeletedRow) {
                        throw new Error('Delete failed: no submission row was removed or hidden from public content.');
                    }

                    removalMode = 'soft-delete';
                    removed = true;
                }

                // 3. Clear Storage Files to free up Cloud Space
                if (removed && sub) {
                    try {
                        if (sub.storage_provider === 'r2') {
                            await API.deleteStoredMedia([
                                sub.thumbnail_path || sub.thumbnail_url,
                                sub.image_url,
                                sub.file_path,
                                sub.file_url
                            ], submissionId);
                        } else {
                            const pathsToDeleteFromPublic = new Set();
                            const thumbPath = this.normalizeStoragePath(sub.thumbnail_path || sub.thumbnail_url)
                                || `thumbnails/${submissionId}.webp`;
                            const imagePath = this.normalizeStoragePath(sub.image_url);

                            if (thumbPath) pathsToDeleteFromPublic.add(thumbPath);
                            if (imagePath) pathsToDeleteFromPublic.add(imagePath);

                            if (pathsToDeleteFromPublic.size > 0) {
                                await supabase.storage.from('approved_public').remove([...pathsToDeleteFromPublic]);
                            }

                            if (sub.file_path) {
                                await supabase.storage.from('submissions_private').remove([sub.file_path]);
                            }
                        }
                    } catch (storageErr) {
                        console.error('[Dashboard] Error clearing files from storage:', storageErr);
                    }
                }

                if (!removed) {
                    console.error('[Dashboard] Submission removal failed:', removalError);
                    UI.showToast(`Delete failed: ${removalError?.message || 'Unknown error'}`, 'error');
                } else {
                    console.log('[Dashboard] Delete successful via', removalMode);
                    UI.showToast(removalMode === 'hard-delete' ? 'Submission deleted permanently' : 'Submission removed from public content', 'success');
                    this.loadTabContent();
                    this.loadStats();
                }
            } catch (err) {
                console.error('[Dashboard] Unexpected delete error:', err);
                UI.showToast('Delete failed: ' + err.message, 'error');
            }

            overlay.remove();
        });
    },

    setupUserActions() {
        document.querySelectorAll('.role-select').forEach(sel => {
            sel.addEventListener('change', async () => {
                const id = sel.dataset.id;
                const newRole = sel.value;
                const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
                if (error) UI.showToast(error.message, 'error');
                else UI.showToast('Role updated successfully', 'success');
            });
        });
    }
};
