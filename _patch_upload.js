const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'pages', 'upload.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add videoGroup reference in init()
const imageGroupRef = "const imageGroup = document.querySelector('#image-input-group');";
const idx1 = content.indexOf(imageGroupRef);
if (idx1 === -1) { console.error('Could not find imageGroup ref'); process.exit(1); }
content = content.slice(0, idx1 + imageGroupRef.length) +
    "\n        const videoGroup = document.querySelector('#video-input-group');" +
    "\n        const videoUrlInput = document.getElementById('video-url-input');" +
    "\n        const videoUrlStatus = document.getElementById('video-url-status');" +
    content.slice(idx1 + imageGroupRef.length);

// 2. Update applyContentTypeRules to handle video category
// Find where isImageCategory is checked and add video handling
const imageGroupToggle = "imageGroup?.classList.toggle('hidden', !isImageCategory);";
const idx2 = content.indexOf(imageGroupToggle);
if (idx2 === -1) { console.error('Could not find imageGroup toggle'); process.exit(1); }

// Add video category detection and toggle right after imageGroup toggle
const videoToggleCode = `
            const isVideoCategory = modeOptions.useVideoUrl;
            videoGroup?.classList.toggle('hidden', !isVideoCategory);
            if (videoUrlInput) {
                videoUrlInput.required = isVideoCategory;
                videoUrlInput.disabled = !isVideoCategory;
            }`;
content = content.slice(0, idx2 + imageGroupToggle.length) + videoToggleCode + content.slice(idx2 + imageGroupToggle.length);

// 3. Add video submission handling in form submit
// Find the isImageCategory check in submit handler
const isImageCategorySubmit = "const isImageCategory = category === 'images';";
const idx3 = content.indexOf(isImageCategorySubmit);
if (idx3 === -1) { console.error('Could not find isImageCategory submit check'); process.exit(1); }
content = content.slice(0, idx3 + isImageCategorySubmit.length) +
    "\n                const isVideoCategory = category === 'video';" +
    content.slice(idx3 + isImageCategorySubmit.length);

// 4. Add video validation before general validation
const imageValidation = "if (isImageCategory && !selectedImageFile) {";
const idx4 = content.indexOf(imageValidation);
if (idx4 === -1) { console.error('Could not find image validation'); process.exit(1); }
const videoValidation = `if (isVideoCategory) {
                    const videoUrlValue = document.getElementById('video-url-input')?.value?.trim() || '';
                    const parsed = UI.parseYouTubeUrl(videoUrlValue);
                    if (!parsed) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit for Review';
                        return UI.showToast('Please enter a valid YouTube URL.', 'error');
                    }
                }
                `;
content = content.slice(0, idx4) + videoValidation + content.slice(idx4);

// 5. Add video submission path before the image category submission path
const imageSubmitPath = "// If image category, we submit as";
const idx5 = content.indexOf(imageSubmitPath);
if (idx5 === -1) { console.error('Could not find image submit path'); process.exit(1); }
const videoSubmitPath = `// If video category, handle YouTube video submission
                if (isVideoCategory) {
                    const videoUrlValue = document.getElementById('video-url-input')?.value?.trim() || '';
                    const parsed = UI.parseYouTubeUrl(videoUrlValue);

                    if (!parsed) {
                        UI.hideLoader();
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Submit for Review';
                        return UI.showToast('Invalid YouTube URL.', 'error');
                    }

                    // Fetch metadata via oEmbed
                    let videoTitle = formData.get('title') || 'Untitled Video';
                    let channelName = 'Unknown Channel';
                    let channelUrl = '';

                    try {
                        const oembedUrl = \`https://noembed.com/embed?url=\${encodeURIComponent(parsed.normalizedUrl)}\`;
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
                        submitBtn.textContent = 'Submit for Review';
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
                        status: 'pending'
                    };

                    console.log('[Upload] Submitting video:', submissionData);
                    const { error } = await API.uploadSubmission(submissionData, null, null, null);

                    if (error) {
                        console.error('Video upload error:', error);
                        UI.showToast(this.mapUploadError(error), 'error');
                    } else {
                        UI.hideLoader();
                        await UI.showSubmissionSuccessCelebration(3500);
                        await UI.triggerBadgeEvaluation({
                            userId: user.id,
                            reason: 'upload-success',
                            awaitPopups: true
                        });
                        window.location.hash = '#my-uploads';
                    }

                    return; // Exit early — video path complete
                }

                `;
content = content.slice(0, idx5) + videoSubmitPath + content.slice(idx5);

// 6. Skip file/contentMode validation for video category
const fileValidation = "if (!isImageCategory && contentMode === 'file' && (!file || file.size === 0)) {";
const idx6 = content.indexOf(fileValidation);
if (idx6 !== -1) {
    content = content.replace(fileValidation, "if (!isImageCategory && !isVideoCategory && contentMode === 'file' && (!file || file.size === 0)) {");
}

const fileSizeValidation = "if (!isImageCategory && contentMode === 'file' && file && file.size > 50 * 1024 * 1024) {";
const idx7 = content.indexOf(fileSizeValidation);
if (idx7 !== -1) {
    content = content.replace(fileSizeValidation, "if (!isImageCategory && !isVideoCategory && contentMode === 'file' && file && file.size > 50 * 1024 * 1024) {");
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ upload.js updated successfully');
console.log('  - videoGroup DOM references added');
console.log('  - applyContentTypeRules updated for video');
console.log('  - Video validation added');
console.log('  - Video submission path added');
console.log('  - File validations skip video category');
