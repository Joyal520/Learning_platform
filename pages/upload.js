import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';
import { supabase } from '../assets/js/supabase.js';
import { ImageUtils } from '../assets/js/image-utils.js';
import App from '../assets/js/app.js';

export const UploadPage = {
    _imageFile: null,
    _imageCompressedBlob: null,
    _imageThumbnailBlob: null,
    _imageMetadata: null,
    _imagePreviewUrl: null,
    _isSubmitting: false,

    init() {
        const form = document.querySelector('#upload-form');
        if (!form || form.dataset.uploadInitialized === 'true') return;
        form.dataset.uploadInitialized = 'true';
        const fileGroup = document.querySelector('#file-input-group');
        const textGroup = document.querySelector('#text-input-group');
        const codeGroup = document.querySelector('#code-input-group');
        const imageGroup = document.querySelector('#image-input-group');
        const thumbnailGroup = document.querySelector('#thumbnail-input-group');
        const modeRadios = document.querySelectorAll('input[name="content_mode"]');
        const thumbnailInput = document.getElementById('thumbnail-input');
        const thumbnailPreview = document.getElementById('thumbnail-preview');

        // Reset image state
        this._resetImageSelection();

        // Image Dropzone Elements
        const imageDropZone = document.getElementById('image-drop-zone');
        const imageFileInput = document.getElementById('image-file-input');
        const imageRemoveBtn = document.getElementById('image-remove-btn');

        // Category (Content Type) dropdown logic
        const categorySelect = document.querySelector('select[name="category"]');
        const nonImageFields = document.getElementById('non-image-fields');
        const fileInput = document.getElementById('file-input');
        const imageInput = document.getElementById('image-file-input');
        const fileLabel = fileGroup?.querySelector('label');
        const themeLabel = document.querySelector('#theme-dropdown')?.closest('.form-group')?.querySelector('label');
        const themeDropdown = document.getElementById('theme-dropdown');
        const themeTags = document.getElementById('theme-tags');
        const themeValidationMsg = document.getElementById('theme-msg');
        const modeTabs = {
            file: document.querySelector('input[name="content_mode"][value="file"]')?.closest('.mode-tab'),
            text: document.querySelector('input[name="content_mode"][value="text"]')?.closest('.mode-tab'),
            code: document.querySelector('input[name="content_mode"][value="code"]')?.closest('.mode-tab')
        };
        const modeInputs = {
            file: document.querySelector('input[name="content_mode"][value="file"]'),
            text: document.querySelector('input[name="content_mode"][value="text"]'),
            code: document.querySelector('input[name="content_mode"][value="code"]')
        };
        const supportedProjectAccept = [
            '.pdf', '.doc', '.docx', '.html', '.zip',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/html', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'
        ].join(',');
        const supportedAudioAccept = [
            '.mp3', '.wav',
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav'
        ].join(',');

        const syncThemeSelectionState = () => {
            const checkboxes = document.querySelectorAll('input[name="themes"]');
            const selected = document.querySelectorAll('input[name="themes"]:checked');
            const selectedCount = selected.length;

            themeValidationMsg?.classList.add('hidden');
            checkboxes.forEach((checkbox) => {
                if (!checkbox.checked) {
                    checkbox.disabled = selectedCount >= 3;
                }
            });

            this.renderThemeTags(themeTags, checkboxes);
        };

        const refreshThemeOptions = () => {
            if (!themeDropdown) return;

            const selectedCategory = categorySelect?.value || '';
            const availableThemeSet = new Set(UI.getThemeOptionsForCategory(selectedCategory));
            const preservedThemes = this.getSelectedThemes().filter((theme) => availableThemeSet.has(theme));
            const isLessons = UI.normalizeCategoryValue(selectedCategory) === 'lessons';

            if (themeLabel) {
                themeLabel.innerHTML = `${isLessons ? 'Subject' : 'Theme'}* <span class="text-muted text-sm">(select up to 3)</span>`;
            }

            themeDropdown.innerHTML = UI.renderThemeOptions(selectedCategory, preservedThemes);
            this.setupThemeSelector();
            syncThemeSelectionState();
        };

        const applyContentTypeRules = () => {
            const selectedCategory = categorySelect?.value || '';
            const modeOptions = UI.getContentModeOptions(selectedCategory);
            const isImageCategory = modeOptions.useImageUploader;
            const activeMode = document.querySelector('input[name="content_mode"]:checked')?.value;
            const nextMode = modeOptions[activeMode] ? activeMode : (modeOptions.file ? 'file' : modeOptions.code ? 'code' : 'text');

            refreshThemeOptions();

            nonImageFields?.classList.toggle('hidden', isImageCategory);
            imageGroup?.classList.toggle('hidden', !isImageCategory);
            thumbnailGroup?.classList.toggle('hidden', isImageCategory);
            fileGroup?.classList.add('hidden');
            textGroup?.classList.add('hidden');
            codeGroup?.classList.add('hidden');

            fileInput?.removeAttribute('required');
            textGroup?.querySelector('textarea')?.removeAttribute('required');
            codeGroup?.querySelector('textarea')?.removeAttribute('required');
            if (imageInput) imageInput.required = false;

            Object.entries(modeTabs).forEach(([mode, tab]) => {
                if (!tab || !modeInputs[mode]) return;
                const isVisible = Boolean(modeOptions[mode]);
                tab.classList.toggle('hidden', !isVisible);
                modeInputs[mode].disabled = !isVisible;
            });

            if (modeInputs[nextMode] && !modeInputs[nextMode].checked) {
                modeInputs[nextMode].checked = true;
            }

            if (isImageCategory) {
                imageGroup?.classList.remove('hidden');
                if (imageInput) imageInput.required = true;
            } else if (nextMode === 'file') {
                fileGroup?.classList.remove('hidden');
                if (fileInput) fileInput.required = true;
            } else if (nextMode === 'text') {
                textGroup?.classList.remove('hidden');
                const textInput = textGroup?.querySelector('textarea');
                if (textInput) textInput.required = true;
            } else if (nextMode === 'code') {
                codeGroup?.classList.remove('hidden');
                const codeInput = codeGroup?.querySelector('textarea');
                if (codeInput) codeInput.required = true;
            }

            const isAudioCategory = UI.normalizeCategoryValue(selectedCategory) === 'songs';

            if (fileInput) {
                fileInput.accept = isAudioCategory ? supportedAudioAccept : supportedProjectAccept;
            }
            if (fileLabel) {
                fileLabel.textContent = isAudioCategory
                    ? 'File Upload* (MP3 or WAV - Max 50MB)'
                    : 'Project Upload* (PDF, DOC, DOCX, HTML, or ZIP - Max 50MB)';
            }

            if (isImageCategory) {
                if (thumbnailInput) {
                    thumbnailInput._compressedBlob = null;
                    thumbnailInput.value = '';
                }
                if (thumbnailPreview) {
                    thumbnailPreview.innerHTML = '<span class="thumbnail-placeholder">ðŸ“· Click or drag to add a cover image</span>';
                    thumbnailPreview.classList.remove('has-image');
                }
            }
        };

        categorySelect?.addEventListener('change', applyContentTypeRules);

        // Toggle file/text/code inputs (now only within #non-image-fields)
        modeRadios.forEach(radio => {
            radio.addEventListener('change', applyContentTypeRules);
        });

        applyContentTypeRules();

        // ========== Image Dropzone Events (FIXED LOOP BUG) ==========
        if (imageDropZone && imageFileInput) {
            const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation(); };
            
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
                imageDropZone.addEventListener(event, preventDefaults);
            });

            ['dragenter', 'dragover'].forEach(event => {
                imageDropZone.addEventListener(event, () => imageDropZone.classList.add('drag-over'));
            });

            ['dragleave', 'drop'].forEach(event => {
                imageDropZone.addEventListener(event, () => imageDropZone.classList.remove('drag-over'));
            });

            imageDropZone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0) this._handleImageSelect(files[0]);
            });

            // FIX: Only trigger click if the target is the drop zone itself or safe elements, 
            // preventing clicks on the remove button or inputs from bubbling back up.
            imageDropZone.addEventListener('click', (e) => {
                // Prevent trigger if the file input or remove button was the source
                if (e.target.closest('#image-remove-btn') || e.target === imageFileInput) return;
                imageFileInput.click();
            });

            imageFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this._handleImageSelect(e.target.files[0]);
                }
            });

            imageRemoveBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this._resetImageSelection();
            });
        }

        // ========== Theme Multi-Select ==========
        refreshThemeOptions();

        // Thumbnail preview & Compression prompt
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

                    // --- NEW: Compression Permission Flow ---
                    const sizeKB = file.size / 1024;
                    if (sizeKB > 300) { // Only prompt for images > 300KB
                        const allowed = await UI.showCompressionModal(sizeKB);
                        if (allowed) {
                            const compressedBlob = await ImageUtils.compressToTarget(
                                file,
                                150,
                                640,
                                'Thumbnail',
                                (p, txt) => UI.updateCompressionProgress(p, txt)
                            );

                            await UI.showCompressionSuccess(sizeKB, compressedBlob.size / 1024);

                            // Replace preview with compressed version
                            const compressedUrl = URL.createObjectURL(compressedBlob);
                            thumbnailPreview.innerHTML = `<img src="${compressedUrl}" alt="Compressed Thumbnail preview">`;

                            // Store the compressed blob on the input for form submission
                            // We can use a custom property since we can't easily replace the File in the input
                            thumbnailInput._compressedBlob = compressedBlob;
                        } else {
                            // User denied, clear any previous compressed blob
                            thumbnailInput._compressedBlob = null;
                            // Show original (blurred placeholder already shown)
                        }
                    }
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

            if (this._isSubmitting) {
                return;
            }

            this._isSubmitting = true;
            form.dataset.submitting = 'true';

            try {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = '⏳ Processing...';
                }

                const formData = new FormData(form);
                const category = formData.get('category');
                const contentMode = formData.get('content_mode');
                const file = formData.get('file');

                // Validation
                if (category !== 'images' && contentMode === 'file' && (!file || file.size === 0)) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit for Review';
                    return UI.showToast('Please select a file to upload.', 'error');
                }
                if (contentMode === 'file' && file.size > 50 * 1024 * 1024) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit for Review';
                    return UI.showToast('File size exceeds 50MB limit.', 'error');
                }
                if (category !== 'images' && contentMode === 'file') {
                    const validationError = this.validateProjectFile(file, category);
                    if (validationError) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit for Review';
                        return UI.showToast(validationError, 'error');
                    }
                }

                UI.showLoader();
                const user = App.user;

                if (!user) {
                    UI.hideLoader();
                    return UI.showToast('Authentication failed. Please login again.', 'error');
                }

                // Content Type Specific Variables
                let contentText = null;
                let fileToUpload = null;
                let finalFileSize = 0;
                let finalFileType = 'text/plain';

                if (contentMode === 'text') {
                    contentText = formData.get('content_text');
                } else if (contentMode === 'code') {
                    contentText = formData.get('code_content');
                    fileToUpload = this.buildHtmlProjectFile(formData.get('title'), contentText);
                    finalFileSize = fileToUpload.size;
                    finalFileType = 'text/html';
                } else if (contentMode === 'file') {
                    fileToUpload = file && file.size > 0 ? file : null;
                    if (fileToUpload) {
                        finalFileSize = fileToUpload.size;
                        finalFileType = fileToUpload.type;
                    }
                }

                const selectedThemes = this.getSelectedThemes();
                if (selectedThemes.length === 0) {
                    UI.hideLoader();
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit for Review';
                    return UI.showToast('Please select at least 1 theme.', 'error');
                }

                // If image category, we submit as "Image Post" not just normal submission
                if (category === 'images') {
                    if (!this._imageFile && !this._imageCompressedBlob) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit for Review';
                        return UI.showToast('Please select an image to upload.', 'error');
                    }

                    const meta = this._imageMetadata || {};
                    const fullSizeImage = this._imageFile;
                    const imageThumbnail = this._imageThumbnailBlob || this._imageFile;
                    const submissionData = {
                        author_id: user.id,
                        title: formData.get('title'),
                        description: formData.get('description') || '',
                        category: this.normalizeSubmissionCategory(formData.get('category')),
                        content_type: 'image',
                        file_type: fullSizeImage?.type || 'image/webp',
                        file_size: fullSizeImage?.size || 0,
                        original_size: meta.originalSize || this._imageFile?.size || 0,
                        compressed_size: imageThumbnail?.size || 0,
                        image_width: meta.width || 0,
                        image_height: meta.height || 0,
                        mime_type: fullSizeImage?.type || 'image/webp',
                        status: 'pending', // Restore moderation flow - images must be approved first
                        themes: selectedThemes,
                        audience_level: this.normalizeAudienceLevel(formData.get('audience_level'))
                    };

                    const { error } = await API.uploadImagePost(
                        submissionData,
                        fullSizeImage,
                        imageThumbnail
                    );

                    if (error) {
                        console.error('Image Upload error:', error);
                        UI.showToast(error.message || 'Image Upload failed.', 'error');
                    } else {
                        UI.showToast('Thank you for uploading your work. Your submission has been received and is now pending review.', 'success');
                        this._resetImageSelection();
                        setTimeout(() => window.location.hash = '#my-uploads', 1500);
                    }

                } else {
                    // Normal File/Text/Code Submission Path
                    const submissionData = {
                        author_id: user.id,
                        title: formData.get('title'),
                        category: this.normalizeSubmissionCategory(formData.get('category')),
                        themes: selectedThemes,
                        audience_level: this.normalizeAudienceLevel(formData.get('audience_level')),
                        description: formData.get('description') || '',
                        content_text: contentText,
                        file_type: finalFileType,
                        file_size: finalFileSize,
                        status: 'pending' // Normal flows require review
                    };

                    // Processing high-performance thumbnail pipeline
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

                        console.log('[Upload] Starting thumbnail compression pipeline...');
                        try {
                            if (thumbnailInput._compressedBlob) {
                                console.log('[Upload] Using pre-compressed thumbnail blob');
                                thumbnailBlob = thumbnailInput._compressedBlob;
                                displayBlob = await ImageUtils.compressToTarget(thumbnailFile, 500, 1400, 'Display');
                            } else {
                                const versions = await ImageUtils.createThumbnailAndDisplayVersions(thumbnailFile);
                                thumbnailBlob = versions.thumbnail;
                                displayBlob = versions.display;
                            }
                        } catch (imgErr) {
                            console.error('[Upload] Image pipeline failed:', imgErr);
                        }
                    }

                    console.log('Submitting standard post:', submissionData);
                    const { error } = await API.uploadSubmission(submissionData, fileToUpload, thumbnailBlob, displayBlob);

                    const fileExtension = fileToUpload?.name?.split('.')?.pop()?.toLowerCase() || '';
                    const projectSuccessMessage = fileExtension === 'zip'
                        ? 'Thank you. Your website package has been uploaded successfully.'
                        : 'Thank you. Your project file has been uploaded successfully.';

                    if (error) {
                        console.error('Upload error:', error);
                        UI.showToast(error.message || 'Upload failed.', 'error');
                    } else {
                        UI.showToast(fileToUpload && !fileToUpload.type?.startsWith('audio/') ? projectSuccessMessage : 'Thank you for uploading your work. Your submission has been received and is now pending review.', 'success');
                        setTimeout(() => window.location.hash = '#my-uploads', 1500);
                    }
                }
            } catch (err) {
                console.error('Unexpected upload error:', err);
                UI.showToast('Something went wrong. Check the console.', 'error');
            } finally {
                this._isSubmitting = false;
                delete form.dataset.submitting;
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

    normalizeSubmissionCategory(category) {
        const rawValue = String(category || '').trim();
        if (!rawValue) return null;
        return UI.normalizeCategoryValue(rawValue);
    },

    normalizeAudienceLevel(level) {
        const value = String(level || '').trim();
        const audienceMap = {
            Kids: 'Beginner',
            General: 'Intermediate',
            Adult: 'Advanced'
        };

        return audienceMap[value] || value || 'Beginner';
    },

    buildHtmlProjectFile(title, code) {
        const rawBaseName = String(title || 'project').trim() || 'project';
        const safeBaseName = rawBaseName
            .toLowerCase()
            .replace(/\.html?$/i, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 80) || 'project';
        const htmlContent = String(code || '');

        return new File([htmlContent], `${safeBaseName}.html`, { type: 'text/html' });
    },

    validateProjectFile(file, category = '') {
        if (!file) return 'Please select a file to upload.';

        const normalizedCategory = UI.normalizeCategoryValue(category);
        if (normalizedCategory === 'songs') {
            const allowedAudioTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav']);
            const allowedAudioExtensions = ['.mp3', '.wav'];
            const lowerName = file.name?.toLowerCase?.() || '';
            const hasAllowedAudioExtension = allowedAudioExtensions.some((ext) => lowerName.endsWith(ext));

            if (!allowedAudioTypes.has(file.type) && !hasAllowedAudioExtension) {
                return 'Unsupported audio type. Use MP3 or WAV.';
            }

            return null;
        }

        const projectAllowedExtensions = ['.pdf', '.doc', '.docx', '.html', '.zip'];
        const allowedTypes = new Set([
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/html',
            'application/zip',
            'application/x-zip-compressed',
            'application/octet-stream'
        ]);
        const allowedExtensions = projectAllowedExtensions;
        const lowerName = file.name?.toLowerCase?.() || '';
        const hasAllowedExtension = allowedExtensions.some((ext) => lowerName.endsWith(ext));

        if (!allowedTypes.has(file.type) && !hasAllowedExtension) {
            return 'Unsupported project type. Use PDF, DOC, DOCX, HTML, or ZIP.';
        }

        return null;
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
            const categorySelect = form.querySelector('select[name="category"]');
            categorySelect.value = UI.normalizeCategoryValue(sub.category, sub.content_type);
            
            // Trigger category change logic to show/hide correct groups
            categorySelect.dispatchEvent(new Event('change'));

            if (sub.category === 'images') {
                // If it's an image post, category is 'images', content_type is 'image'
                const existingImagePreview = sub.image_url || sub.thumbnail_url || null;
                if (existingImagePreview) {
                    const preview = document.getElementById('image-upload-preview');
                    const img = document.getElementById('image-preview-img');
                    const zone = document.getElementById('image-drop-zone');
                    
                    if (preview && img && zone) {
                        img.src = existingImagePreview;
                        preview.style.display = 'block';
                        zone.classList.add('has-file');
                        zone.querySelector('.drop-zone-content').style.display = 'none';
                    }
                }
            } else {
                // For other types, handle content mode
                if (sub.content_text) {
                    const isHTML = sub.file_type === 'text/html';
                    const mode = isHTML ? 'code' : 'text';
                    const modeRadio = form.querySelector(`input[name="content_mode"][value="${mode}"]`);
                    if (modeRadio) {
                        modeRadio.checked = true;
                        modeRadio.dispatchEvent(new Event('change'));
                    }
                    
                    if (isHTML) {
                        const codeArea = document.getElementById('code-textarea');
                        if (codeArea) {
                            codeArea.value = sub.content_text;
                            codeArea.dispatchEvent(new Event('input'));
                        }
                    } else {
                        const textArea = form.querySelector('textarea[name="content_text"]');
                        if (textArea) textArea.value = sub.content_text;
                    }
                } else {
                    const modeRadio = form.querySelector('input[name="content_mode"][value="file"]');
                    if (modeRadio) {
                        modeRadio.checked = true;
                        modeRadio.dispatchEvent(new Event('change'));
                    }
                }
            }
            form.querySelector('textarea[name="description"]').value = sub.description || '';
            const audienceSelect = form.querySelector('select[name="audience_level"]');
            if (audienceSelect) audienceSelect.value = this.normalizeAudienceLevel(sub.audience_level);

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
            const thumbnailGroup = document.getElementById('thumbnail-input-group');

            // Show existing thumbnail if available
            const existingThumb = sub.thumbnail_url
                || (sub.storage_provider === 'r2' ? null : UI.resolveMediaUrl(sub.thumbnail_path))
                || UI.getThumbnailFallbackUrl(sub);
            if (sub.category !== 'images' && existingThumb) {
                thumbnailPreview.innerHTML = `<img src="${existingThumb}" alt="Current thumbnail">`;
                thumbnailPreview.classList.add('has-image');
            }
            if (sub.category === 'images') {
                thumbnailGroup?.classList.add('hidden');
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

                        // --- NEW: Compression Permission Flow (Edit Mode) ---
                        const sizeKB = file.size / 1024;
                        if (sizeKB > 300) {
                            const allowed = await UI.showCompressionModal(sizeKB);
                            if (allowed) {
                                const compressedBlob = await ImageUtils.compressToTarget(
                                    file,
                                    150,
                                    640,
                                    'Thumbnail',
                                    (p, txt) => UI.updateCompressionProgress(p, txt)
                                );
                                await UI.showCompressionSuccess(sizeKB, compressedBlob.size / 1024);
                                const compressedUrl = URL.createObjectURL(compressedBlob);
                                thumbnailPreview.innerHTML = `<img src="${compressedUrl}" alt="Compressed Preview">`;
                                thumbnailInput._compressedBlob = compressedBlob;
                            } else {
                                thumbnailInput._compressedBlob = null;
                            }
                        }
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
                        category: this.normalizeSubmissionCategory(formData.get('category')),
                        description: formData.get('description') || '',
                        themes: this.getSelectedThemes(),
                        audience_level: this.normalizeAudienceLevel(formData.get('audience_level')),
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
                        if (thumbnailInput._compressedBlob) {
                            thumbnailBlob = thumbnailInput._compressedBlob;
                            displayBlob = await ImageUtils.compressToTarget(thumbnailFile, 500, 1400, 'Display');
                        } else {
                            const versions = await ImageUtils.createThumbnailAndDisplayVersions(thumbnailFile);
                            thumbnailBlob = versions.thumbnail;
                            displayBlob = versions.display;
                        }
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
    },

    // ==========================================
    // IMAGE UPLOAD DOM & COMPRESSION LOGIC
    // ==========================================

    async _handleImageSelect(file) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const maxSize = 50 * 1024 * 1024; // 50MB

        // Validate type
        if (!allowedTypes.includes(file.type)) {
            return UI.showToast(`Unsupported format. Use JPG, PNG, or WEBP.`, 'error');
        }

        // Validate size
        if (file.size > maxSize) {
            return UI.showToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 50 MB.`, 'error');
        }

        this._imageFile = file;

        const dropZone = document.getElementById('image-drop-zone');
        const previewOpts = document.getElementById('image-upload-preview');
        const previewImg = document.getElementById('image-preview-img');
        const previewInfo = document.getElementById('image-preview-info');
        const compressionStatus = document.getElementById('image-compression-status');

        dropZone?.classList.add('has-file');
        if (previewOpts) previewOpts.style.display = 'flex';

        // Blur placeholder
        try {
            const placeholder = await ImageUtils.generatePlaceholder(file);
            if (previewImg) {
                previewImg.src = placeholder;
                previewImg.style.filter = 'blur(6px)';
            }
        } catch (e) {
            console.warn('Placeholder failed:', e);
        }

        const originalSizeKB = file.size / 1024;
        if (previewInfo) {
            previewInfo.innerHTML = `
                <span class="preview-filename">${file.name}</span>
                <span class="preview-size">${originalSizeKB.toFixed(0)} KB</span>
            `;
        }

        // Compress if > 100 KB
        if (originalSizeKB > 100) {
            if (compressionStatus) {
                compressionStatus.style.display = 'block';
                compressionStatus.innerHTML = `
                    <div class="compression-bar-mini">
                        <div class="compression-bar-fill-mini" id="comp-fill-mini" style="width: 5%"></div>
                    </div>
                    <span class="compression-text-mini">Compressing...</span>
                `;
            }

            try {
                // Background compression logic
                const result = await ImageUtils.compressForUpload(file, (progress, text) => {
                    const fill = document.getElementById('comp-fill-mini');
                    const textEl = compressionStatus?.querySelector('.compression-text-mini');
                    if (fill) fill.style.width = `${progress}%`;
                    if (textEl) textEl.textContent = text;
                });

                this._imageCompressedBlob = result.blob;
                this._imageThumbnailBlob = result.thumbnail;
                this._imageMetadata = {
                    originalSize: file.size,
                    compressedSize: result.thumbnail?.size || file.size,
                    width: result.width,
                    height: result.height
                };

                this._cleanupImagePreview();
                this._imagePreviewUrl = URL.createObjectURL(file);
                if (previewImg) {
                    previewImg.src = this._imagePreviewUrl;
                    previewImg.style.filter = 'none';
                }

                if (compressionStatus) {
                    compressionStatus.innerHTML = `<span class="compression-done">Full-size image preserved. Optimized thumbnail: ${(result.thumbnail.size / 1024).toFixed(0)} KB</span>`;
                }

                if (previewInfo) {
                    previewInfo.innerHTML = `<span class="preview-filename">${file.name}</span><span class="preview-size">${originalSizeKB.toFixed(0)} KB <span style="color: #22c55e; font-size: 0.8em;">(full size preserved)</span></span>`;
                }
            } catch (err) {
                console.error('Image compression failed:', err);
                UI.showToast('Thumbnail generation failed. Using original image.', 'warning');
                this._imageCompressedBlob = file;
                if (compressionStatus) compressionStatus.style.display = 'none';

                this._cleanupImagePreview();
                this._imagePreviewUrl = URL.createObjectURL(file);
                if (previewImg) {
                    previewImg.src = this._imagePreviewUrl;
                    previewImg.style.filter = 'none';
                }
            }
        } else {
            // Small file — no compression needed
            if (compressionStatus) {
                compressionStatus.style.display = 'block';
                compressionStatus.innerHTML = `<span class="compression-done">✅ No compression needed (${originalSizeKB.toFixed(0)} KB)</span>`;
            }

            try {
                const result = await ImageUtils.compressForUpload(file, null);
                this._imageCompressedBlob = result.blob;
                this._imageThumbnailBlob = result.thumbnail;
                this._imageMetadata = {
                    originalSize: file.size,
                    compressedSize: result.thumbnail?.size || file.size,
                    width: result.width,
                    height: result.height
                };
            } catch (e) {
                this._imageCompressedBlob = file;
            }

            this._cleanupImagePreview();
            this._imagePreviewUrl = URL.createObjectURL(this._imageCompressedBlob || file);
            if (previewImg) {
                previewImg.src = this._imagePreviewUrl;
                previewImg.style.filter = 'none';
            }
        }
    },

    _resetImageSelection() {
        this._imageFile = null;
        this._imageCompressedBlob = null;
        this._imageThumbnailBlob = null;
        this._imageMetadata = null;
        this._cleanupImagePreview();

        const dropZone = document.getElementById('image-drop-zone');
        const previewOpts = document.getElementById('image-upload-preview');
        const fileInput = document.getElementById('image-file-input');
        const compressionStatus = document.getElementById('image-compression-status');

        dropZone?.classList.remove('has-file', 'drag-over');
        if (previewOpts) previewOpts.style.display = 'none';
        if (fileInput) fileInput.value = '';
        if (compressionStatus) compressionStatus.style.display = 'none';
    },

    _cleanupImagePreview() {
        if (this._imagePreviewUrl) {
            URL.revokeObjectURL(this._imagePreviewUrl);
            this._imagePreviewUrl = null;
        }
    }
};
