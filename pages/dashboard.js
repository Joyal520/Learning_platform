// pages/dashboard.js
import { supabase } from '../assets/js/supabase.js';
import { UI } from '../assets/js/ui.js';
import App from '../assets/js/app.js';

export const DashboardPage = {
    currentTab: 'pending',

    async init() {
        if (!App.profile || App.profile.role !== 'admin') {
            window.location.hash = 'home';
            return;
        }

        const main = document.getElementById('main-content');
        main.innerHTML = UI.pages.dashboard(App.profile.role);

        this.setupTabs();
        this.loadTabContent();
        if (App.profile.role === 'admin') this.loadStats();
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelector('.tab-btn.active').classList.remove('active');
                btn.classList.add('active');
                this.currentTab = btn.dataset.tab;
                this.loadTabContent();
            });
        });
    },

    async loadStats() {
        const { count: users } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: pending } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
        const { count: approved } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved');

        // Calculate Storage Usage (Estimate)
        const { data: subs } = await supabase.from('submissions').select('content_text, thumbnail_path');
        let totalBytes = 0;
        subs?.forEach(s => {
            if (s.content_text) totalBytes += s.content_text.length;
            if (s.thumbnail_path?.startsWith('data:')) {
                // Estimate size of base64 data URL (approx 75% of string length)
                totalBytes += Math.round(s.thumbnail_path.length * 0.75);
            }
        });

        const limitBytes = 1024 * 1024 * 1024; // 1 GB
        const usedMB = (totalBytes / (1024 * 1024)).toFixed(1);
        const percent = Math.min((totalBytes / limitBytes) * 100, 100).toFixed(1);

        const elU = document.getElementById('stat-users');
        const elP = document.getElementById('stat-pending');
        const elA = document.getElementById('stat-approved');
        const elS = document.getElementById('stat-storage');
        const elB = document.getElementById('storage-bar');

        if (elU) elU.textContent = users;
        if (elP) elP.textContent = pending;
        if (elA) elA.textContent = approved;
        if (elS) elS.textContent = `${usedMB} MB`;
        if (elB) elB.style.width = `${percent}%`;
    },

    async loadTabContent() {
        const content = document.getElementById('dashboard-content');
        content.innerHTML = `<div class="loader-inline"><div class="spinner"></div></div>`;

        if (this.currentTab === 'users') {
            const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (error) return UI.showToast(error.message, 'error');
            content.innerHTML = data.map(u => UI.pages.userRow(u)).join('');
            this.setupUserActions();
        } else {
            let query = supabase.from('submissions').select('*, profiles!author_id(display_name)').order('created_at', { ascending: false });
            if (this.currentTab === 'pending') query = query.eq('status', 'pending');

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
                const { error } = await supabase.from('submissions').update({
                    status: 'approved',
                    approved_by: App.user.id
                }).eq('id', id);

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
