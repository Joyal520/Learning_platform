import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';
import { supabase } from '../assets/js/supabase.js';

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
        thumbnailInput?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    thumbnailPreview.innerHTML = `<img src="${ev.target.result}" alt="Thumbnail preview">`;
                    thumbnailPreview.classList.add('has-image');
                };
                reader.readAsDataURL(file);
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
                    submitBtn.textContent = '⏳ Submitting...';
                }

                const formData = new FormData(form);
                const contentMode = formData.get('content_mode');
                const file = formData.get('file');

                // Validation
                if (contentMode === 'file' && (!file || file.size === 0)) {
                    return UI.showToast('Please select a file to upload.', 'error');
                }
                if (contentMode === 'file' && file.size > 50 * 1024 * 1024) {
                    return UI.showToast('File size exceeds 50MB limit.', 'error');
                }

                UI.showLoader();

                // Get user
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    UI.hideLoader();
                    return UI.showToast('You must be logged in to upload.', 'error');
                }

                // Determine content text
                let contentText = null;
                if (contentMode === 'text') {
                    contentText = formData.get('content_text');
                } else if (contentMode === 'code') {
                    contentText = formData.get('code_content');
                }

                // Validate themes
                const selectedThemes = this.getSelectedThemes();
                if (selectedThemes.length === 0) {
                    UI.hideLoader();
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

                // Convert thumbnail to base64 if present (no storage needed)
                const thumbnailFile = formData.get('thumbnail');
                if (thumbnailFile && thumbnailFile.size > 0) {
                    try {
                        const thumbDataUrl = await this.fileToBase64(thumbnailFile, 400);
                        submissionData.thumbnail_path = thumbDataUrl;
                    } catch (thumbErr) {
                        console.warn('Thumbnail conversion skipped:', thumbErr);
                    }
                }

                console.log('Submitting:', submissionData);

                // Only pass file for file mode
                const fileToUpload = (contentMode === 'file' && file && file.size > 0) ? file : null;
                let { error } = await API.uploadSubmission(submissionData, fileToUpload);

                // If it fails because thumbnail_path column doesn't exist, retry without it
                if (error && error.message?.includes('thumbnail_path')) {
                    console.warn('Retrying without thumbnail_path...');
                    delete submissionData.thumbnail_path;
                    const retry = await API.uploadSubmission(submissionData, fileToUpload);
                    error = retry.error;
                }

                if (error) {
                    console.error('Upload error:', error);
                    UI.showToast(error.message || 'Upload failed. Please try again.', 'error');
                } else {
                    UI.showToast('Uploaded successfully! Waiting for review.', 'success');
                    window.location.hash = '#my-uploads';
                }
            } catch (err) {
                console.error('Unexpected upload error:', err);
                UI.showToast('Something went wrong. Check the console for details.', 'error');
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

    // ========== Theme Multi-Select Logic ==========
    setupThemeSelector() {
        const checkboxes = document.querySelectorAll('input[name="themes"]');
        const tagsContainer = document.getElementById('theme-tags');
        const validationMsg = document.getElementById('theme-msg');

        if (!checkboxes.length) return;

        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const selected = document.querySelectorAll('input[name="themes"]:checked');

                // Enforce max 3
                if (selected.length > 3) {
                    cb.checked = false;
                    validationMsg?.classList.remove('hidden');
                    return;
                }

                validationMsg?.classList.add('hidden');

                // Disable unchecked if 3 selected
                checkboxes.forEach(c => {
                    if (!c.checked) c.disabled = selected.length >= 3;
                });

                // Render tag chips
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

        // Attach remove handlers
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
        this.setupThemeSelector(); // Re-attach listeners for edit mode 


        try {
            // Fetch the submission
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

            // Check permission: must be owner or admin
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                UI.hideLoader();
                window.location.hash = 'login';
                return;
            }

            // Get profile to check role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            const isOwner = user.id === sub.author_id;
            const isAdmin = profile?.role === 'admin';

            if (!isOwner && !isAdmin) {
                UI.showToast('You do not have permission to edit this submission.', 'error');
                UI.hideLoader();
                window.location.hash = 'explore';
                return;
            }

            // Update page header
            const pageHeader = document.querySelector('.page-header');
            if (pageHeader) {
                pageHeader.querySelector('h1').textContent = 'Edit Your Work';
                pageHeader.querySelector('p').textContent = 'Update your submission details below.';
            }

            // Pre-fill form fields
            const titleInput = form.querySelector('input[name="title"]');
            const categorySelect = form.querySelector('select[name="category"]');
            const descriptionTextarea = form.querySelector('textarea[name="description"]');
            const contentTextarea = form.querySelector('textarea[name="content_text"]');
            const codeTextarea = form.querySelector('textarea[name="code_content"]');

            if (titleInput) titleInput.value = sub.title || '';
            if (categorySelect) categorySelect.value = sub.category || '';
            if (descriptionTextarea) descriptionTextarea.value = sub.description || '';

            // Pre-fill new fields
            const audienceSelect = form.querySelector('select[name="audience_level"]');
            if (audienceSelect) audienceSelect.value = sub.audience_level || 'General';

            if (sub.themes && Array.isArray(sub.themes)) {
                sub.themes.forEach(theme => {
                    const cb = form.querySelector(`input[name="themes"][value="${theme}"]`);
                    if (cb) cb.checked = true;
                });
                // Update dots/tags
                this.renderThemeTags(document.getElementById('theme-tags'), document.querySelectorAll('input[name="themes"]'));

                // Enforce disabled state if 3 selected
                const checkboxesArr = document.querySelectorAll('input[name="themes"]');
                const selectedCount = document.querySelectorAll('input[name="themes"]:checked').length;
                checkboxesArr.forEach(c => {
                    if (!c.checked) c.disabled = selectedCount >= 3;
                });
            }

            // Determine content mode and switch to it
            const fileGroup = document.querySelector('#file-input-group');
            const textGroup = document.querySelector('#text-input-group');
            const codeGroup = document.querySelector('#code-input-group');

            if (sub.file_type === 'text/html' && sub.content_text) {
                // Code mode
                const codeRadio = form.querySelector('input[name="content_mode"][value="code"]');
                if (codeRadio) codeRadio.checked = true;
                fileGroup?.classList.add('hidden');
                textGroup?.classList.add('hidden');
                codeGroup?.classList.remove('hidden');
                if (codeTextarea) codeTextarea.value = sub.content_text || '';
                fileGroup?.querySelector('input')?.removeAttribute('required');
                codeGroup?.querySelector('textarea')?.setAttribute('required', '');
                // Update preview
                const previewFrame = document.getElementById('code-preview-frame');
                this.updateCodePreview(sub.content_text, previewFrame);
            } else if (sub.content_text && !sub.file_path) {
                // Text mode
                const textRadio = form.querySelector('input[name="content_mode"][value="text"]');
                if (textRadio) textRadio.checked = true;
                fileGroup?.classList.add('hidden');
                textGroup?.classList.remove('hidden');
                codeGroup?.classList.add('hidden');
                if (contentTextarea) contentTextarea.value = sub.content_text || '';
                fileGroup?.querySelector('input')?.removeAttribute('required');
                textGroup?.querySelector('textarea')?.setAttribute('required', '');
            } else {
                // File mode — keep default, but don't require new file upload
                fileGroup?.querySelector('input')?.removeAttribute('required');
            }

            // Change submit button text
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.textContent = '💾 Save Changes';

            // Setup thumbnail preview for edit mode
            const thumbnailInput = document.getElementById('thumbnail-input');
            const thumbnailPreview = document.getElementById('thumbnail-preview');
            thumbnailInput?.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        thumbnailPreview.innerHTML = `<img src="${ev.target.result}" alt="Thumbnail preview">`;
                        thumbnailPreview.classList.add('has-image');
                    };
                    reader.readAsDataURL(file);
                }
            });

            // Setup content mode toggling (reuse from init)
            const modeRadios = form.querySelectorAll('input[name="content_mode"]');
            modeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    fileGroup?.classList.add('hidden');
                    textGroup?.classList.add('hidden');
                    codeGroup?.classList.add('hidden');

                    fileGroup?.querySelector('input')?.removeAttribute('required');
                    textGroup?.querySelector('textarea')?.removeAttribute('required');
                    codeGroup?.querySelector('textarea')?.removeAttribute('required');

                    if (e.target.value === 'file') {
                        fileGroup?.classList.remove('hidden');
                    } else if (e.target.value === 'text') {
                        textGroup?.classList.remove('hidden');
                        textGroup?.querySelector('textarea')?.setAttribute('required', '');
                    } else if (e.target.value === 'code') {
                        codeGroup?.classList.remove('hidden');
                        codeGroup?.querySelector('textarea')?.setAttribute('required', '');
                    }
                });
            });

            // Live code preview for edit mode
            const editCodeTextarea = document.getElementById('code-textarea');
            const editCodePreviewFrame = document.getElementById('code-preview-frame');
            let debounceTimer;
            editCodeTextarea?.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.updateCodePreview(editCodeTextarea.value, editCodePreviewFrame);
                }, 500);
            });

            // Override form submit for edit
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '⏳ Saving...';
                }

                UI.showLoader();

                try {
                    const formData = new FormData(form);
                    const contentMode = formData.get('content_mode');

                    let contentText = null;
                    if (contentMode === 'text') {
                        contentText = formData.get('content_text');
                    } else if (contentMode === 'code') {
                        contentText = formData.get('code_content');
                    }

                    const updateData = {
                        title: formData.get('title'),
                        category: formData.get('category'),
                        description: formData.get('description') || '',
                        themes: this.getSelectedThemes(),
                        audience_level: formData.get('audience_level') || 'General',
                        status: 'pending', // Reset status to pending for re-review
                        review_note: null,   // Clear previous rejection notes
                        approved_by: null    // Clear previous approver
                    };

                    // Only update content fields if they changed
                    if (contentText !== null) {
                        updateData.content_text = contentText;
                        updateData.file_type = contentMode === 'code' ? 'text/html' : 'text/plain';
                    }

                    // Handle thumbnail if a new one was selected
                    const thumbnailFile = formData.get('thumbnail');
                    if (thumbnailFile && thumbnailFile.size > 0) {
                        try {
                            const thumbDataUrl = await UploadPage.fileToBase64(thumbnailFile, 400);
                            updateData.thumbnail_path = thumbDataUrl;
                        } catch (thumbErr) {
                            console.warn('Thumbnail conversion failed:', thumbErr);
                        }
                    }

                    const { error: updateError } = await API.updateSubmission(id, updateData);

                    if (updateError) {
                        UI.showToast(updateError.message || 'Update failed.', 'error');
                    } else {
                        UI.showToast('Changes saved successfully!', 'success');
                        window.location.hash = `detail/${id}`;
                    }
                } catch (err) {
                    console.error('Edit error:', err);
                    UI.showToast('Something went wrong.', 'error');
                } finally {
                    UI.hideLoader();
                    const submitBtn = form.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = '💾 Save Changes';
                    }
                }
            });

            UI.hideLoader();
        } catch (err) {
            console.error('initEdit error:', err);
            UI.showToast('Failed to load submission for editing.', 'error');
            UI.hideLoader();
        }
    },

    // Convert an image File to a resized base64 data URL
    fileToBase64(file, maxSize = 400) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
                    else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
};
