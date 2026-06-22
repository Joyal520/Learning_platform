import { API } from '../assets/js/api.js';
import { UI } from '../assets/js/ui.js';
import { supabase } from '../assets/js/supabase.js';
import { ImageUtils } from '../assets/js/image-utils.js';
import { ProjectUpload } from '../assets/js/project-upload.js';
import {
    sanitizeProjectDescription,
    sanitizeProjectMetadata,
    sanitizeProjectTitle,
    validateProjectUrl
} from '../assets/js/url-submission.js';
import App from '../assets/js/app.js';
import { notesFromTextareaValue, notesToTextareaValue } from '../assets/js/presentation-remote.js';

const DEBUG_LOGS = false;
const debugLog = (...args) => { if (DEBUG_LOGS) console.log(...args); };

export const UploadPage = {
    _imageFile: null,
    _imageCompressedBlob: null,
    _imageThumbnailBlob: null,
    _imageMetadata: null,
    _imagePreviewUrl: null,
    _isSubmitting: false,

    getActiveRole() {
        return App.profile?.role || localStorage.getItem('edtechra_role') || null;
    },

    getUploadContext() {
        const form = document.querySelector('#upload-form');
        const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
        const params = new URLSearchParams(hashQuery);
        const isClassroom = form?.dataset.uploadContext === 'classroom'
            || params.get('context') === 'classroom'
            || params.get('source') === 'digital_classroom';

        return {
            uploadContext: isClassroom ? 'classroom' : 'global',
            source: isClassroom ? 'digital_classroom' : 'dashboard',
            classroomId: form?.dataset.classroomId || params.get('classroomId') || null
        };
    },

    isTeacherResourceUpload() {
        const context = this.getUploadContext();
        return this.getActiveRole() === 'teacher' && context.uploadContext === 'classroom';
    },

    getUploadIdleText() {
        return 'Submit';
    },

    getTeacherVisibility(formData) {
        const visibility = String(formData.get('visibility') || 'private').toLowerCase();
        return visibility === 'public' ? 'public' : 'private';
    },

    buildResourceMetadata(user, formData, category) {
        const isTeacherResource = this.isTeacherResourceUpload();
        const role = this.getActiveRole() || 'student';
        const context = this.getUploadContext();
        const teacherVisibility = isTeacherResource ? this.getTeacherVisibility(formData) : 'public';
        return {
            owner_id: user.id,
            owner_role: isTeacherResource ? 'teacher' : role,
            resource_purpose: isTeacherResource ? 'teaching_resource' : 'creative_work',
            resource_type: UI.normalizeCategoryValue(category),
            visibility: teacherVisibility,
            ...(isTeacherResource ? { explore_visible: teacherVisibility === 'public' } : {}),
            upload_context: context.uploadContext,
            source: context.source,
            classroom_id: isTeacherResource && context.classroomId ? context.classroomId : null,
            teacher_id: isTeacherResource ? user.id : null,
            updated_at: new Date().toISOString()
        };
    },

    async showTeacherResourceSuccess(resourceId) {
        UI.showToast('Resource uploaded successfully.', 'success');
        const actions = document.querySelector('#upload-form .form-actions');
        if (!actions) return;
        const context = this.getUploadContext();
        const classroomParam = context.classroomId ? `?classroomId=${encodeURIComponent(context.classroomId)}` : '';
        const assignSeparator = context.classroomId ? '&' : '?';

        actions.innerHTML = `
            <div class="teacher-upload-success-actions">
                <p class="notice success">Resource uploaded successfully.</p>
                <a class="btn btn-primary" href="#classroom/resources${classroomParam}">View in My Teaching Resources</a>
                <a class="btn btn-outline" href="#classroom/resources${classroomParam}${assignSeparator}assignResource=${encodeURIComponent(resourceId || '')}">Assign Now</a>
            </div>
        `;
    },

    init() {
        const form = document.querySelector('#upload-form');
        if (!form || form.dataset.uploadInitialized === 'true') return;
        form.dataset.uploadInitialized = 'true';
        const submitIdleText = this.getUploadIdleText();
        const fileGroup = document.querySelector('#file-input-group');
        const textGroup = document.querySelector('#text-input-group');
        const codeGroup = document.querySelector('#code-input-group');
        const urlGroup = document.querySelector('#url-input-group');
        const imageGroup = document.querySelector('#image-input-group');
        const videoGroup = document.querySelector('#video-input-group');
        const videoUrlInput = document.getElementById('video-url-input');
        const videoUrlStatus = document.getElementById('video-url-status');
        const thumbnailGroup = document.querySelector('#thumbnail-input-group');
        const modeRadios = document.querySelectorAll('input[name="content_mode"]');
        const thumbnailInput = document.getElementById('thumbnail-input');
        const thumbnailPreview = document.getElementById('thumbnail-preview');
        const urlInput = document.getElementById('project-url-input');

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
            code: document.querySelector('input[name="content_mode"][value="code"]')?.closest('.mode-tab'),
            url: document.querySelector('input[name="content_mode"][value="url"]')?.closest('.mode-tab')
        };
        const modeInputs = {
            file: document.querySelector('input[name="content_mode"][value="file"]'),
            text: document.querySelector('input[name="content_mode"][value="text"]'),
            code: document.querySelector('input[name="content_mode"][value="code"]'),
            url: document.querySelector('input[name="content_mode"][value="url"]')
        };
        const supportedProjectAccept = ProjectUpload.PROJECT_ACCEPT_ATTRIBUTE;
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
            const nextMode = modeOptions[activeMode]
                ? activeMode
                : (modeOptions.file ? 'file' : modeOptions.url ? 'url' : modeOptions.code ? 'code' : 'text');
            const textInput = textGroup?.querySelector('textarea');
            const codeInput = codeGroup?.querySelector('textarea');

            refreshThemeOptions();

            nonImageFields?.classList.toggle('hidden', isImageCategory);
            imageGroup?.classList.toggle('hidden', !isImageCategory);
            const isVideoCategory = modeOptions.useVideoUrl;
            videoGroup?.classList.toggle('hidden', !isVideoCategory);
            if (videoUrlInput) {
                videoUrlInput.required = isVideoCategory;
                videoUrlInput.disabled = !isVideoCategory;
            }
            thumbnailGroup?.classList.toggle('hidden', isImageCategory);
            fileGroup?.classList.add('hidden');
            textGroup?.classList.add('hidden');
            codeGroup?.classList.add('hidden');
            urlGroup?.classList.add('hidden');

            fileInput?.removeAttribute('required');
            textInput?.removeAttribute('required');
            codeInput?.removeAttribute('required');
            urlInput?.removeAttribute('required');
            if (fileInput) fileInput.disabled = true;
            if (textInput) textInput.disabled = true;
            if (codeInput) codeInput.disabled = true;
            if (urlInput) urlInput.disabled = true;
            if (imageInput) {
                imageInput.required = false;
                imageInput.disabled = !isImageCategory;
            }

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
                if (imageInput) {
                    imageInput.required = true;
                    imageInput.disabled = false;
                }
            } else if (nextMode === 'file') {
                fileGroup?.classList.remove('hidden');
                if (fileInput) {
                    fileInput.required = true;
                    fileInput.disabled = false;
                }
            } else if (nextMode === 'text') {
                textGroup?.classList.remove('hidden');
                if (textInput) {
                    textInput.required = true;
                    textInput.disabled = false;
                }
            } else if (nextMode === 'code') {
                codeGroup?.classList.remove('hidden');
                if (codeInput) {
                    codeInput.required = true;
                    codeInput.disabled = false;
                }
            } else if (nextMode === 'url') {
                urlGroup?.classList.remove('hidden');
                if (urlInput) {
                    urlInput.required = true;
                    urlInput.disabled = false;
                }
            }

            const isAudioCategory = UI.normalizeCategoryValue(selectedCategory) === 'songs';

            if (fileInput) {
                fileInput.accept = isAudioCategory ? supportedAudioAccept : supportedProjectAccept;
            }
            if (fileLabel) {
                fileLabel.textContent = isAudioCategory
                    ? 'File Upload* (MP3 or WAV - Max 50MB)'
                    : 'Project Upload* (PDF, PPTX, DOC, DOCX, HTML, or ZIP - Max 50MB)';
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

            this.togglePresentationNotesEditor({
                category: selectedCategory,
                contentMode: nextMode
            });
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

        const updateVideoUrlStatus = () => {
            if (!videoUrlInput || !videoUrlStatus || videoUrlInput.disabled) return;
            const value = videoUrlInput.value.trim();
            videoUrlStatus.classList.remove('valid', 'invalid');
            if (!value) {
                videoUrlStatus.textContent = '';
                videoUrlStatus.classList.add('hidden');
                return;
            }

            const parsed = UI.parseYouTubeUrl(value);
            videoUrlStatus.classList.remove('hidden');
            if (parsed) {
                videoUrlStatus.textContent = 'YouTube link ready.';
                videoUrlStatus.classList.add('valid');
            } else {
                videoUrlStatus.textContent = 'Please paste a valid YouTube watch, short, share, or embed link.';
                videoUrlStatus.classList.add('invalid');
            }
        };

        videoUrlInput?.addEventListener('input', updateVideoUrlStatus);
        videoUrlInput?.addEventListener('blur', updateVideoUrlStatus);

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
                    thumbnailPreview.innerHTML = `<img src="${placeholder}" alt="Thumbnail preview" decoding="async" style="filter: blur(4px)">`;
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
                            thumbnailPreview.innerHTML = `<img src="${compressedUrl}" alt="Compressed Thumbnail preview" decoding="async">`;

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
                const projectUrlInput = formData.get('project_url');
                const selectedImageFile = this._imageFile || this._imageCompressedBlob || null;
                const isImageCategory = category === 'images';
                const isVideoCategory = category === 'video';

                // Validation
                if (isVideoCategory) {
                    const videoUrlValue = document.getElementById('video-url-input')?.value?.trim() || '';
                    const parsed = UI.parseYouTubeUrl(videoUrlValue);
                    if (!parsed) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast('Please enter a valid YouTube watch, short, share, or embed link.', 'error');
                    }
                }
                if (isImageCategory && !selectedImageFile) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitIdleText;
                    return UI.showToast('Please select an image to upload.', 'error');
                }
                if (!isImageCategory && !isVideoCategory && contentMode === 'file' && (!file || file.size === 0)) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitIdleText;
                    return UI.showToast('Please select a file to upload.', 'error');
                }
                if (!isImageCategory && !isVideoCategory && contentMode === 'file' && file && file.size > 50 * 1024 * 1024) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitIdleText;
                    return UI.showToast('File size exceeds 50MB limit.', 'error');
                }
                if (!isImageCategory && contentMode === 'url') {
                    const validation = validateProjectUrl(projectUrlInput);
                    if (!validation.valid) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast(validation.error || 'Invalid URL', 'error');
                    }
                }
                if (!isImageCategory && contentMode === 'file') {
                    const validationError = this.validateProjectFile(file, category);
                    if (validationError) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast(validationError, 'error');
                    }

                    if (this.isWebsiteZip(file)) {
                        try {
                            await ProjectUpload.inspectZipWebsite(file);
                        } catch (zipError) {
                            UI.hideLoader();
                            submitBtn.disabled = false;
                            submitBtn.textContent = submitIdleText;
                            return UI.showToast(this.mapUploadError(zipError), 'error');
                        }
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
                let urlSubmission = null;

                if (contentMode === 'text') {
                    contentText = formData.get('content_text');
                } else if (contentMode === 'code') {
                    contentText = formData.get('code_content');
                    const htmlValidationError = ProjectUpload.validateHtmlContent(contentText);
                    if (htmlValidationError) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast(htmlValidationError, 'error');
                    }

                    fileToUpload = this.buildHtmlProjectFile(formData.get('title'), contentText);
                    finalFileSize = fileToUpload.size;
                    finalFileType = ProjectUpload.getProjectMimeType(fileToUpload.name, fileToUpload.type) || 'text/html';
                } else if (contentMode === 'file') {
                    fileToUpload = file && file.size > 0 ? file : null;
                    if (fileToUpload) {
                        finalFileSize = fileToUpload.size;
                        finalFileType = ProjectUpload.getProjectMimeType(fileToUpload.name, fileToUpload.type) || fileToUpload.type || 'application/octet-stream';
                    }
                } else if (contentMode === 'url') {
                    const validation = validateProjectUrl(projectUrlInput);
                    if (!validation.valid) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast(validation.error || 'Invalid URL', 'error');
                    }

                    let extractedMetadata;
                    try {
                        extractedMetadata = await API.fetchProjectUrlMetadata(validation.normalizedUrl);
                    } catch (metadataError) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast(this.mapUploadError(metadataError) || 'Unable to fetch preview', 'error');
                    }

                    const mergedMetadata = sanitizeProjectMetadata({
                        title: formData.get('title') || extractedMetadata?.title || '',
                        description: formData.get('description') || extractedMetadata?.description || '',
                        previewImage: extractedMetadata?.previewImage || ''
                    });

                    urlSubmission = {
                        url: extractedMetadata?.url || validation.normalizedUrl,
                        title: sanitizeProjectTitle(mergedMetadata.title || formData.get('title') || ''),
                        description: sanitizeProjectDescription(mergedMetadata.description || formData.get('description') || ''),
                        previewImage: mergedMetadata.previewImage || ''
                    };
                    finalFileType = 'text/uri-list';
                }

                const selectedThemes = this.getSelectedThemes();
                if (selectedThemes.length === 0) {
                    UI.hideLoader();
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitIdleText;
                    return UI.showToast('Please select at least 1 theme.', 'error');
                }

                // If video category, handle YouTube video submission
                if (isVideoCategory) {
                    const videoUrlValue = document.getElementById('video-url-input')?.value?.trim() || '';
                    const parsed = UI.parseYouTubeUrl(videoUrlValue);

                    if (!parsed) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast('Please enter a valid YouTube watch, short, share, or embed link.', 'error');
                    }

                    // Fetch metadata via oEmbed
                    let videoTitle = formData.get('title') || 'Untitled Video';
                    let channelName = 'Unknown Channel';
                    let channelUrl = '';

                    try {
                        const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(parsed.normalizedUrl)}`;
                        const oembedRes = await fetch(oembedUrl);
                        if (oembedRes.ok) {
                            const oembedData = await oembedRes.json();
                            if (oembedData.title) videoTitle = oembedData.title;
                            if (oembedData.author_name) channelName = oembedData.author_name;
                            if (oembedData.author_url) channelUrl = oembedData.author_url;
                        }
                    } catch (metaErr) {
                        console.warn('[Upload] YouTube metadata fetch failed, using defaults:', metaErr);
                    }

                    const videoMetadata = JSON.stringify({
                        videoId: parsed.videoId,
                        source: parsed.source,
                        title: videoTitle,
                        channel: { name: channelName, url: channelUrl },
                        thumbnail: UI.getYouTubeThumbnailUrl(parsed.videoId)
                    });

                    const selectedThemes = this.getSelectedThemes();
                    if (selectedThemes.length === 0) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast('Please select at least 1 theme.', 'error');
                    }

                    const submissionData = {
                        author_id: user.id,
                        title: videoTitle,
                        category: 'video',
                        content_type: 'video',
                        file_type: 'video/youtube',
                        mime_type: 'video/youtube',
                        file_url: parsed.normalizedUrl,
                        file_size: 0,
                        description: videoMetadata,
                        thumbnail_url: UI.getYouTubeThumbnailUrl(parsed.videoId),
                        themes: selectedThemes,
                        audience_level: this.normalizeAudienceLevel(formData.get('audience_level')),
                        status: 'pending',
                        ...this.buildResourceMetadata(user, formData, 'video')
                    };

                    debugLog('[Upload] Submitting video:', submissionData);
                    const { data, error } = await API.uploadSubmission(submissionData, null, null, null);

                    if (error) {
                        console.error('Video upload error:', error);
                        UI.showToast(this.mapUploadError(error), 'error');
                    } else {
                        UI.hideLoader();
                        if (this.isTeacherResourceUpload()) {
                            await this.showTeacherResourceSuccess(data?.id);
                        } else {
                            await UI.showSubmissionSuccessCelebration(3500);
                            await UI.triggerBadgeEvaluation({
                                userId: user.id,
                                reason: 'upload-success',
                                awaitPopups: true
                            });
                            window.location.hash = '#my-uploads';
                        }
                    }

                    return; // Exit early — video path complete
                }

                // If image category, we submit as "Image Post" not just normal submission
                if (isImageCategory) {
                    if (!this._imageFile && !this._imageCompressedBlob) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = submitIdleText;
                        return UI.showToast('Please select an image to upload.', 'error');
                    }

                    const meta = this._imageMetadata || {};
                    const fullSizeImage = this._imageFile;
                    const imageThumbnail = this._imageThumbnailBlob || this._imageFile;
                    const submissionData = {
                        author_id: user.id,
                        title: formData.get('title'),
                        description: formData.get('description') || '',
                        category: formData.get('category'),
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
                        audience_level: this.normalizeAudienceLevel(formData.get('audience_level')),
                        ...this.buildResourceMetadata(user, formData, formData.get('category'))
                    };

                    const { data, error } = await API.uploadImagePost(
                        submissionData,
                        fullSizeImage,
                        imageThumbnail
                    );

                    if (error) {
                        console.error('Image Upload error:', error);
                        UI.showToast(error.message || 'Image Upload failed.', 'error');
                    } else {
                        UI.hideLoader();
                        if (this.isTeacherResourceUpload()) {
                            await this.showTeacherResourceSuccess(data?.id);
                        } else {
                            await UI.showSubmissionSuccessCelebration(3500);
                            await UI.triggerBadgeEvaluation({
                                userId: user.id,
                                reason: 'upload-success',
                                awaitPopups: true
                            });
                            window.location.hash = '#my-uploads';
                        }
                        this._resetImageSelection();
                    }

                } else {
                    // Normal File/Text/Code Submission Path
                    const submissionData = {
                        author_id: user.id,
                        title: urlSubmission?.title || sanitizeProjectTitle(formData.get('title')),
                        category: formData.get('category'),
                        themes: selectedThemes,
                        audience_level: this.normalizeAudienceLevel(formData.get('audience_level')),
                        description: urlSubmission?.description || sanitizeProjectDescription(formData.get('description') || ''),
                        content_text: contentText,
                        file_type: finalFileType,
                        file_size: finalFileSize,
                        mime_type: finalFileType,
                        status: 'pending', // Normal flows require review
                        ...this.buildResourceMetadata(user, formData, formData.get('category'))
                    };

                    if (urlSubmission) {
                        submissionData.type = 'url';
                        submissionData.url = urlSubmission.url;
                        submissionData.content_type = 'url';
                        submissionData.previewImage = urlSubmission.previewImage;
                    }

                    const presentationNotes = this.getPresentationNotesValue();
                    if (presentationNotes && this.shouldAttachPresentationNotes({
                        category: submissionData.category,
                        contentMode,
                        fileType: submissionData.file_type,
                        mimeType: submissionData.mime_type,
                        contentType: submissionData.content_type
                    })) {
                        submissionData.presentation_notes = presentationNotes;
                    }

                    // Processing high-performance thumbnail pipeline
                    let thumbnailBlob = null;
                    let displayBlob = null;
                    const thumbnailFile = formData.get('thumbnail');

                    if (thumbnailFile && thumbnailFile.size > 0 && thumbnailFile.type.startsWith('image/')) {
                        if (thumbnailFile.size > 10 * 1024 * 1024) {
                            UI.hideLoader();
                            submitBtn.disabled = false;
                            submitBtn.textContent = submitIdleText;
                            return UI.showToast('Thumbnail image exceeds 10MB limit.', 'error');
                        }

                        debugLog('[Upload] Starting thumbnail compression pipeline...');
                        try {
                            if (thumbnailInput._compressedBlob) {
                                debugLog('[Upload] Using pre-compressed thumbnail blob');
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

                    debugLog('Submitting standard post:', submissionData);
                    const { data, error } = await API.uploadSubmission(submissionData, fileToUpload, thumbnailBlob, displayBlob);

                    if (error) {
                        console.error('Upload error:', error);
                        UI.showToast(this.mapUploadError(error), 'error');
                    } else {
                        UI.hideLoader();
                        if (this.isTeacherResourceUpload()) {
                            await this.showTeacherResourceSuccess(data?.id);
                        } else {
                            await UI.showSubmissionSuccessCelebration(3500);
                            await UI.triggerBadgeEvaluation({
                                userId: user.id,
                                reason: 'upload-success',
                                awaitPopups: true
                            });
                            window.location.hash = '#my-uploads';
                        }
                    }
                }
            } catch (err) {
                console.error('Unexpected upload error:', err);
                UI.showToast(this.mapUploadError(err), 'error');
            } finally {
                this._isSubmitting = false;
                delete form.dataset.submitting;
                UI.hideLoader();
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = submitIdleText;
                }
            }
        });
    },

    updateCodePreview(code, iframe) {
        if (!iframe) return;

        if (ProjectUpload.shouldPausePreview(code)) {
            iframe.srcdoc = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                    <style>
                        body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; color: #0f172a; background: #f8fafc; }
                        .notice { border: 1px solid #cbd5e1; border-radius: 12px; padding: 1rem; background: white; }
                    </style>
                </head>
                <body>
                    <div class="notice">
                        <strong>Live preview paused for large HTML.</strong>
                        <p>Your code is still preserved exactly and can be uploaded normally.</p>
                    </div>
                </body>
                </html>
            `;
            return;
        }

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

        return ProjectUpload.validateProjectFile(file);
    },

    ensurePresentationNotesEditor() {
        const form = document.querySelector('#upload-form');
        if (!form) return null;

        let group = document.getElementById('presentation-notes-group');
        if (group) return group;

        const descriptionGroup = form.querySelector('textarea[name="description"]')?.closest('.form-group');
        if (!descriptionGroup) return null;

        group = document.createElement('div');
        group.id = 'presentation-notes-group';
        group.className = 'form-group hidden';
        group.innerHTML = `
            <label>Speaker Notes <span class="text-muted text-sm">(optional)</span></label>
            <p class="text-muted text-sm">Add one notes block per slide, separated by a line containing only <code>---</code>. These notes stay off the audience screen and only appear in the presenter remote.</p>
            <textarea id="presentation-notes-textarea" class="form-control" rows="8" placeholder="Opening note\n---\nSecond slide note"></textarea>
        `;

        descriptionGroup.insertAdjacentElement('afterend', group);
        return group;
    },

    togglePresentationNotesEditor({ category = '', contentMode = 'file', force = false } = {}) {
        const group = this.ensurePresentationNotesEditor();
        if (!group) return;

        const shouldShow = force || (UI.normalizeCategoryValue(category) === 'presentations' && contentMode === 'file');
        group.classList.toggle('hidden', !shouldShow);
    },

    getPresentationNotesValue() {
        const group = document.getElementById('presentation-notes-group');
        const textarea = document.getElementById('presentation-notes-textarea');
        if (!group || group.classList.contains('hidden') || !textarea) return null;

        const notes = notesFromTextareaValue(textarea.value);
        return notes.length ? notes : null;
    },

    setPresentationNotesValue(notes) {
        const group = this.ensurePresentationNotesEditor();
        const textarea = document.getElementById('presentation-notes-textarea');
        if (!group || !textarea) return;
        textarea.value = notesToTextareaValue(notes);
    },

    isPresentationSubmission(sub = {}) {
        const normalizedCategory = UI.normalizeCategoryValue(sub.category, sub.content_type);
        const fileType = String(sub.file_type || sub.mime_type || '').toLowerCase();
        return normalizedCategory === 'presentations'
            || fileType.includes('pdf')
            || fileType.includes('powerpoint')
            || fileType.includes('presentationml');
    },

    shouldAttachPresentationNotes({ category = '', contentMode = 'file', fileType = '', mimeType = '', contentType = '' } = {}) {
        const normalizedCategory = UI.normalizeCategoryValue(category, contentType);
        const normalizedFileType = String(fileType || mimeType || '').toLowerCase();
        return normalizedCategory === 'presentations'
            && contentMode === 'file'
            && (
                normalizedFileType.includes('pdf')
                || normalizedFileType.includes('powerpoint')
                || normalizedFileType.includes('presentationml')
            );
    },

    isUrlSubmissionRecord(sub = {}) {
        const contentType = String(sub?.content_type || '').trim().toLowerCase();
        const fileType = String(sub?.file_type || sub?.mime_type || '').trim().toLowerCase();
        return contentType === 'url' || fileType === 'text/uri-list';
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
            this.togglePresentationNotesEditor({
                category: categorySelect.value,
                contentMode: sub.content_text ? (sub.file_type === 'text/html' ? 'code' : 'text') : 'file',
                force: this.isPresentationSubmission(sub)
            });

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
                if (this.isUrlSubmissionRecord(sub)) {
                    const modeRadio = form.querySelector('input[name="content_mode"][value="url"]');
                    if (modeRadio) {
                        modeRadio.checked = true;
                        modeRadio.dispatchEvent(new Event('change'));
                    }

                    const urlInput = document.getElementById('project-url-input');
                    if (urlInput) {
                        urlInput.value = sub.file_url || '';
                    }
                } else if (sub.content_text) {
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
            this.setPresentationNotesValue(sub.presentation_notes);
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
            const urlGroup = document.querySelector('#url-input-group');

            if (this.isUrlSubmissionRecord(sub)) {
                form.querySelector('input[name="content_mode"][value="url"]').checked = true;
                fileGroup?.classList.add('hidden');
                textGroup?.classList.add('hidden');
                codeGroup?.classList.add('hidden');
                urlGroup?.classList.remove('hidden');
                const urlInput = document.getElementById('project-url-input');
                if (urlInput) {
                    urlInput.value = sub.file_url || '';
                    urlInput.required = true;
                    urlInput.disabled = false;
                }
                fileGroup?.querySelector('input')?.removeAttribute('required');
            } else if (sub.file_type === 'text/html' && sub.content_text) {
                form.querySelector('input[name="content_mode"][value="code"]').checked = true;
                fileGroup?.classList.add('hidden');
                textGroup?.classList.add('hidden');
                codeGroup?.classList.remove('hidden');
                urlGroup?.classList.add('hidden');
                form.querySelector('textarea[name="code_content"]').value = sub.content_text || '';
                fileGroup?.querySelector('input')?.removeAttribute('required');
                this.updateCodePreview(sub.content_text, document.getElementById('code-preview-frame'));
            } else if (sub.content_text && !sub.file_path) {
                form.querySelector('input[name="content_mode"][value="text"]').checked = true;
                fileGroup?.classList.add('hidden');
                textGroup?.classList.remove('hidden');
                codeGroup?.classList.add('hidden');
                urlGroup?.classList.add('hidden');
                form.querySelector('textarea[name="content_text"]').value = sub.content_text || '';
                fileGroup?.querySelector('input')?.removeAttribute('required');
            } else {
                urlGroup?.classList.add('hidden');
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
                thumbnailPreview.innerHTML = `<img src="${existingThumb}" alt="Current thumbnail" loading="lazy" decoding="async">`;
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
                        thumbnailPreview.innerHTML = `<img src="${placeholder}" alt="Preview" decoding="async" style="filter:blur(4px)">`;

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
                                thumbnailPreview.innerHTML = `<img src="${compressedUrl}" alt="Compressed Preview" decoding="async">`;
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
                    const projectUrlInput = formData.get('project_url');
                    let contentText = null;
                    let urlSubmission = null;
                    if (contentMode === 'text') contentText = formData.get('content_text');
                    else if (contentMode === 'code') {
                        contentText = formData.get('code_content');
                        const htmlValidationError = ProjectUpload.validateHtmlContent(contentText);
                        if (htmlValidationError) {
                            throw new Error(htmlValidationError);
                        }
                    } else if (contentMode === 'url') {
                        const validation = validateProjectUrl(projectUrlInput);
                        if (!validation.valid) {
                            throw new Error(validation.error || 'Invalid URL');
                        }

                        let extractedMetadata;
                        try {
                            extractedMetadata = await API.fetchProjectUrlMetadata(validation.normalizedUrl);
                        } catch (metadataError) {
                            throw new Error(this.mapUploadError(metadataError) || 'Unable to fetch preview');
                        }

                        const mergedMetadata = sanitizeProjectMetadata({
                            title: formData.get('title') || extractedMetadata?.title || '',
                            description: formData.get('description') || extractedMetadata?.description || '',
                            previewImage: extractedMetadata?.previewImage || ''
                        });

                        urlSubmission = {
                            url: extractedMetadata?.url || validation.normalizedUrl,
                            title: sanitizeProjectTitle(mergedMetadata.title || formData.get('title') || ''),
                            description: sanitizeProjectDescription(mergedMetadata.description || formData.get('description') || ''),
                            previewImage: mergedMetadata.previewImage || ''
                        };
                    }

                    const updateData = {
                        title: urlSubmission?.title || sanitizeProjectTitle(formData.get('title')),
                        category: formData.get('category'),
                        description: urlSubmission?.description || sanitizeProjectDescription(formData.get('description') || ''),
                        themes: this.getSelectedThemes(),
                        audience_level: this.normalizeAudienceLevel(formData.get('audience_level')),
                        status: 'pending'
                    };

                    const presentationNotes = this.getPresentationNotesValue();

                    if (urlSubmission) {
                        updateData.type = 'url';
                        updateData.url = urlSubmission.url;
                        updateData.content_type = 'url';
                        updateData.file_type = 'text/uri-list';
                        updateData.mime_type = 'text/uri-list';
                        updateData.file_size = 0;
                        updateData.previewImage = urlSubmission.previewImage;
                    } else if (contentText !== null) {
                        updateData.content_text = contentText;
                        updateData.file_type = contentMode === 'code' ? 'text/html' : 'text/plain';
                        updateData.mime_type = updateData.file_type;
                    }

                    if (presentationNotes && this.shouldAttachPresentationNotes({
                        category: updateData.category,
                        contentMode,
                        fileType: updateData.file_type || sub.file_type,
                        mimeType: updateData.mime_type || sub.mime_type,
                        contentType: sub.content_type
                    })) {
                        updateData.presentation_notes = presentationNotes;
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

                    if (updateError) UI.showToast(this.mapUploadError(updateError), 'error');
                    else {
                        UI.showToast('Changes saved successfully!', 'success');
                        window.location.hash = `detail/${id}`;
                    }
                } catch (err) {
                    console.error('Edit error:', err);
                    UI.showToast(this.mapUploadError(err), 'error');
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

    isWebsiteZip(file) {
        return ProjectUpload.getProjectUploadDescriptor(file?.name, file?.type)?.extension === 'zip';
    },

    mapUploadError(error) {
        const message = String(error?.message || '').trim();
        if (!message) {
            return 'Upload failed due to a network or storage error. Please try again.';
        }

        if (
            message.includes('Unsupported file type') ||
            message.includes('Unsupported project type') ||
            message.includes('Unsupported audio type') ||
            message.includes('Invalid zip website structure') ||
            message.includes('Unsafe files detected in zip') ||
            message.includes('HTML content too large') ||
            message.includes('Please paste your HTML content')
        ) {
            return message;
        }

        if (message.includes('File exceeds') || message.includes('File size exceeds')) {
            return 'File too large. Please upload a file within the 50 MB limit.';
        }

        if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
            return 'Upload failed due to a network or storage error. Please try again.';
        }

        if (message.includes('Upload failed for') || message.includes('Upload verification failed')) {
            return 'Upload failed due to a network or storage error. Please try again.';
        }

        return message;
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

