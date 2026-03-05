import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';
import { supabase } from '../assets/js/supabase.js';
import { ImageUtils } from '../assets/js/image-utils.js';
import App from '../assets/js/app.js';

export const UploadPage = {
    init() {
        const form = document.querySelector('#upload-form');
        const fileGroup = document.querySelector('#file-input-group');
        const textGroup = document.querySelector('#text-input-group');
        const codeGroup = document.querySelector('#code-input-group');
        const modeRadios = document.querySelectorAll('input[name="content_mode"]');
        const thumbnailInput = document.getElementById('thumbnail-input');
        const thumbnailPreview = document.getElementById('thumbnail-preview');

        // Toggle file/text/code inputs
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                fileGroup.classList.add('hidden');
                textGroup.classList.add('hidden');
                codeGroup.classList.add('hidden');

                // Remove all required
                fileGroup.querySelector('input')?.removeAttribute('required');
                textGroup.querySelector('textarea')?.removeAttribute('required');
                codeGroup.querySelector('textarea')?.removeAttribute('required');

                if (e.target.value === 'file') {
                    fileGroup.classList.remove('hidden');
                    fileGroup.querySelector('input').required = true;
                } else if (e.target.value === 'text') {
                    textGroup.classList.remove('hidden');
                    textGroup.querySelector('textarea').required = true;
                } else if (e.target.value === 'code') {
                    codeGroup.classList.remove('hidden');
                    codeGroup.querySelector('textarea').required = true;
                }
            });
        });

        // ========== Theme Multi-Select ==========
        this.setupThemeSelector();

        // Thumbnail preview
        thumbnailInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                // Quick validation
                if (file.size > 10 * 1024 * 1024) {
                    UI.showToast('Image exceeds 10MB limit.', 'error');
                    e.target.value = '';
                    return;
                }

                // Show generic loader on preview area
                thumbnailPreview.innerHTML = '<div class="loader-inline"><div class="spinner"></div></div>';

                try {
                    // Generate placeholder preview (fast)
                    const placeholder = await ImageUtils.generatePlaceholder(file);
                    thumbnailPreview.innerHTML = `<img src="${placeholder}" alt="Thumbnail preview" style="filter: blur(4px)">`;
                    thumbnailPreview.classList.add('has-image');
                } catch (err) {
                    console.error('Preview error:', err);
                }
            }
        });

        // Live Code Preview
        const codeTextarea = document.getElementById('code-textarea');
        const codePreviewFrame = document.getElementById('code-preview-frame');
        let debounceTimer;
        codeTextarea?.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.updateCodePreview(codeTextarea.value, codePreviewFrame);
            }, 500);
        });

        // Form submit
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            try {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '⏳ Processing...';
                }

                const formData = new FormData(form);
                const contentMode = formData.get('content_mode');
                const file = formData.get('file');

                // Validation
                if (contentMode === 'file' && (!file || file.size === 0)) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit for Review';
                    return UI.showToast('Please select a file to upload.', 'error');
                }
                if (contentMode === 'file' && file.size > 50 * 1024 * 1024) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit for Review';
                    return UI.showToast('File size exceeds 50MB limit.', 'error');
                }

                UI.showLoader();
                const user = App.user;

                if (!user) {
                    UI.hideLoader();
                    return UI.showToast('Authentication failed. Please login again.', 'error');
                }

                // Determine content text
                let contentText = null;
                if (contentMode === 'text') {
                    contentText = formData.get('content_text');
                } else if (contentMode === 'code') {
                    contentText = formData.get('code_content');
                }

                const selectedThemes = this.getSelectedThemes();
                if (selectedThemes.length === 0) {
                    UI.hideLoader();
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit for Review';
                    return UI.showToast('Please select at least 1 theme.', 'error');
                }

                const submissionData = {
                    author_id: user.id,
                    title: formData.get('title'),
                    category: formData.get('category'),
                    themes: selectedThemes,
                    audience_level: formData.get('audience_level'),
                    description: formData.get('description') || '',
                    content_text: contentText,
                    file_type: contentMode === 'file' ? file.type : (contentMode === 'code' ? 'text/html' : 'text/plain'),
                    file_size: contentMode === 'file' ? file.size : 0,
                    status: 'pending'
                };

                // Processing high-performance image pipeline
                let thumbnailBlob = null;
                let displayBlob = null;
                const thumbnailFile = formData.get('thumbnail');

                if (thumbnailFile && thumbnailFile.size > 0 && thumbnailFile.type.startsWith('image/')) {
                    if (thumbnailFile.size > 10 * 1024 * 1024) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit for Review';
                        return UI.showToast('Thumbnail image exceeds 10MB limit.', 'error');
                    }

                    console.log('[Upload] Starting image compression pipeline...');
                    try {
                        const versions = await ImageUtils.createThumbnailAndDisplayVersions(thumbnailFile);
                        thumbnailBlob = versions.thumbnail;
                        displayBlob = versions.display;
                    } catch (imgErr) {
                        console.error('[Upload] Image pipeline failed:', imgErr);
                    }
                }

                console.log('Submitting:', submissionData);
                if (submitBtn) submitBtn.textContent = '⏳ Uploading...';

                const fileToUpload = (contentMode === 'file' && file && file.size > 0) ? file : null;
                const { error } = await API.uploadSubmission(submissionData, fileToUpload, thumbnailBlob, displayBlob);

                if (error) {
                    console.error('Upload error:', error);
                    UI.showToast(error.message || 'Upload failed.', 'error');
                } else {
                    UI.showToast('Uploaded successfully! Waiting for review.', 'success');
                    window.location.hash = '#my-uploads';
                }
            } catch (err) {
                console.error('Unexpected upload error:', err);
                UI.showToast('Something went wrong. Check the console.', 'error');
            } finally {
                UI.hideLoader();
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit for Review';
                }
            }
        });
    },

    updateCodePreview(code, iframe) {
        if (!iframe) return;
        iframe.srcdoc = UI.wrapCodeForPreview(code);
    },

    setupThemeSelector() {
        const checkboxes = document.querySelectorAll('input[name="themes"]');
        const tagsContainer = document.getElementById('theme-tags');
        const validationMsg = document.getElementById('theme-msg');

        if (!checkboxes.length) return;

        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const selected = document.querySelectorAll('input[name="themes"]:checked');

                if (selected.length > 3) {
                    cb.checked = false;
                    validationMsg?.classList.remove('hidden');
                    return;
                }

                validationMsg?.classList.add('hidden');
                checkboxes.forEach(c => {
                    if (!c.checked) c.disabled = selected.length >= 3;
                });

                this.renderThemeTags(tagsContainer, checkboxes);
            });
        });
    },

    renderThemeTags(container, checkboxes) {
        if (!container) return;
        const selected = document.querySelectorAll('input[name="themes"]:checked');
        container.innerHTML = Array.from(selected).map(cb => `
            <span class="theme-tag" data-value="${cb.value}">
                ${cb.value}
                <span class="theme-tag-remove" data-theme="${cb.value}">×</span>
            </span>
        `).join('');

        container.querySelectorAll('.theme-tag-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.theme;
                const cb = document.querySelector(`input[name="themes"][value="${val}"]`);
                if (cb) {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change'));
                }
            });
        });
    },

    getSelectedThemes() {
        return Array.from(document.querySelectorAll('input[name="themes"]:checked')).map(cb => cb.value);
    },

    async initEdit(id) {
        const form = document.querySelector('#upload-form');
        if (!form) return;

        UI.showLoader();
        this.setupThemeSelector();

        try {
            const { data: sub, error } = await supabase
                .from('submissions')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error || !sub) {
                UI.showToast('Submission not found', 'error');
                UI.hideLoader();
                window.location.hash = 'my-uploads';
                return;
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                UI.hideLoader();
                window.location.hash = 'login';
                return;
            }

            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            const isOwner = user.id === sub.author_id;
            const isAdmin = profile?.role === 'admin';

            if (!isOwner && !isAdmin) {
                UI.showToast('Unauthorized.', 'error');
                UI.hideLoader();
                window.location.hash = 'explore';
                return;
            }

            // Fill fields
            form.querySelector('input[name="title"]').value = sub.title || '';
            form.querySelector('select[name="category"]').value = sub.category || '';
            form.querySelector('textarea[name="description"]').value = sub.description || '';
            const audienceSelect = form.querySelector('select[name="audience_level"]');
            if (audienceSelect) audienceSelect.value = sub.audience_level || 'General';

            if (sub.themes && Array.isArray(sub.themes)) {
                sub.themes.forEach(theme => {
                    const cb = form.querySelector(`input[name="themes"][value="${theme}"]`);
                    if (cb) cb.checked = true;
                });
                this.renderThemeTags(document.getElementById('theme-tags'), document.querySelectorAll('input[name="themes"]'));
                const checkboxesArr = document.querySelectorAll('input[name="themes"]');
                const selectedCount = document.querySelectorAll('input[name="themes"]:checked').length;
                checkboxesArr.forEach(c => {
                    if (!c.checked) c.disabled = selectedCount >= 3;
                });
            }

            // Content Mode
            const fileGroup = document.querySelector('#file-input-group');
            const textGroup = document.querySelector('#text-input-group');
            const codeGroup = document.querySelector('#code-input-group');

            if (sub.file_type === 'text/html' && sub.content_text) {
                form.querySelector('input[name="content_mode"][value="code"]').checked = true;
                fileGroup?.classList.add('hidden');
                textGroup?.classList.add('hidden');
                codeGroup?.classList.remove('hidden');
                form.querySelector('textarea[name="code_content"]').value = sub.content_text || '';
                fileGroup?.querySelector('input')?.removeAttribute('required');
                this.updateCodePreview(sub.content_text, document.getElementById('code-preview-frame'));
            } else if (sub.content_text && !sub.file_path) {
                form.querySelector('input[name="content_mode"][value="text"]').checked = true;
                fileGroup?.classList.add('hidden');
                textGroup?.classList.remove('hidden');
                codeGroup?.classList.add('hidden');
                form.querySelector('textarea[name="content_text"]').value = sub.content_text || '';
                fileGroup?.querySelector('input')?.removeAttribute('required');
            } else {
                fileGroup?.querySelector('input')?.removeAttribute('required');
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = '💾 Save Changes';

            // New thumbnail change handler
            const thumbnailInput = document.getElementById('thumbnail-input');
            const thumbnailPreview = document.getElementById('thumbnail-preview');

            // Show existing thumbnail if available
            const existingThumb = sub.thumbnail_url || sub.thumbnail_path;
            if (existingThumb) {
                thumbnailPreview.innerHTML = `<img src="${existingThumb}" alt="Current thumbnail">`;
                thumbnailPreview.classList.add('has-image');
            }

            thumbnailInput?.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    if (file.size > 10 * 1024 * 1024) {
                        UI.showToast('Image exceeds 10MB limit.', 'error');
                        e.target.value = '';
                        return;
                    }
                    thumbnailPreview.innerHTML = '<div class="loader-inline"><div class="spinner"></div></div>';
                    try {
                        const placeholder = await ImageUtils.generatePlaceholder(file);
                        thumbnailPreview.innerHTML = `<img src="${placeholder}" alt="Preview" style="filter:blur(4px)">`;
                    } catch (err) { console.error(err); }
                }
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                UI.showLoader();
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '⏳ Saving...';
                }

                try {
                    const formData = new FormData(form);
                    const contentMode = formData.get('content_mode');
                    let contentText = null;
                    if (contentMode === 'text') contentText = formData.get('content_text');
                    else if (contentMode === 'code') contentText = formData.get('code_content');

                    const updateData = {
                        title: formData.get('title'),
                        category: formData.get('category'),
                        description: formData.get('description') || '',
                        themes: this.getSelectedThemes(),
                        audience_level: formData.get('audience_level') || 'General',
                        status: 'pending'
                    };

                    if (contentText !== null) {
                        updateData.content_text = contentText;
                        updateData.file_type = contentMode === 'code' ? 'text/html' : 'text/plain';
                    }

                    let thumbnailBlob = null;
                    let displayBlob = null;
                    const thumbnailFile = formData.get('thumbnail');

                    if (thumbnailFile && thumbnailFile.size > 0 && thumbnailFile.type.startsWith('image/')) {
                        const versions = await ImageUtils.createThumbnailAndDisplayVersions(thumbnailFile);
                        thumbnailBlob = versions.thumbnail;
                        displayBlob = versions.display;
                    }

                    const { error: updateError } = await API.updateSubmission(id, updateData, thumbnailBlob, displayBlob);

                    if (updateError) UI.showToast(updateError.message || 'Update failed.', 'error');
                    else {
                        UI.showToast('Changes saved successfully!', 'success');
                        window.location.hash = `detail/${id}`;
                    }
                } catch (err) {
                    console.error('Edit error:', err);
                    UI.showToast('Something went wrong.', 'error');
                } finally {
                    UI.hideLoader();
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '💾 Save Changes';
                    }
                }
            });

            UI.hideLoader();
        } catch (err) {
            console.error('initEdit error:', err);
            UI.showToast('Failed to load for editing.', 'error');
            UI.hideLoader();
        }
    }
};
