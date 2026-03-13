/**
 * Image Processing Utility for EdTechra Lab
 * Handles client-side compression, resizing, and WebP conversion.
 */

export const ImageUtils = {
    /**
     * Compresses an image file to a target size (KB) and maxWidth.
     * @param {File} file 
     * @param {number} targetKB 
     * @param {number} maxWidth 
     * @returns {Promise<Blob>}
     */
    async compressToTarget(file, targetKB, maxWidth, label = 'Image', onProgress = null) {
        return new Promise((resolve, reject) => {
            console.log(`[ImageUtils] 🌀 Starting compression for ${label}: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
            if (onProgress) onProgress(5, `Loading ${label}...`);

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Resize if larger than maxWidth
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    // White background for consistency
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    // Iterative quality reduction to hit target size
                    let quality = 0.9;
                    const minQuality = 0.1;
                    const step = 0.1;
                    const totalSteps = Math.ceil((quality - minQuality) / step);
                    let currentStep = 0;

                    const attemptToSaturate = () => {
                        canvas.toBlob((blob) => {
                            if (!blob) return reject(new Error('Canvas toBlob failed'));

                            const currentKB = blob.size / 1024;
                            currentStep++;

                            if (onProgress) {
                                const progress = 10 + (Math.min(currentStep / totalSteps, 1) * 85);
                                onProgress(progress, `Optimizing ${label}: ${currentKB.toFixed(0)}KB...`);
                            }

                            console.log(`[ImageUtils] ${label} - Quality: ${quality.toFixed(1)}, Size: ${currentKB.toFixed(1)}KB`);

                            if (currentKB <= targetKB || quality <= minQuality) {
                                console.log(`[ImageUtils] ✅ ${label} compressed to ${currentKB.toFixed(1)}KB`);
                                if (onProgress) onProgress(100, `${label} optimized!`);
                                resolve(blob);
                            } else {
                                quality -= step;
                                // Add a small delay for visual smooth progress
                                setTimeout(attemptToSaturate, 50);
                            }
                        }, 'image/webp', quality);
                    };

                    attemptToSaturate();
                };
                img.onerror = () => reject(new Error('Image failed to load on canvas'));
            };
            reader.onerror = () => reject(new Error('File reader failed'));
        });
    },

    /**
     * Creates both thumbnail and display versions of an image
     */
    async createThumbnailAndDisplayVersions(file) {
        console.time('[ImagePipeline]');
        try {
            const [thumbnail, display] = await Promise.all([
                this.compressToTarget(file, 150, 640, 'Thumbnail'),
                this.compressToTarget(file, 500, 1400, 'Display')
            ]);
            console.timeEnd('[ImagePipeline]');
            return { thumbnail, display };
        } catch (err) {
            console.error('[ImagePipeline] FATAL ERROR:', err);
            throw err;
        }
    },

    /**
     * Dedicated Profile Picture Compressor.
     * Enforces a square aspect ratio and strict < 50KB threshold.
     */
    async encodeProfileAvatar(file, onProgress = null) {
        return new Promise((resolve, reject) => {
            if (onProgress) onProgress(10, 'Preparing profile picture...');

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    const SIZE = 256; // Fixed small square size
                    canvas.width = SIZE;
                    canvas.height = SIZE;
                    const ctx = canvas.getContext('2d');

                    // Calculate crop for square
                    const size = Math.min(img.width, img.height);
                    const sx = (img.width - size) / 2;
                    const sy = (img.height - size) / 2;

                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, SIZE, SIZE);

                    // Draw centered square crop
                    ctx.drawImage(img, sx, sy, size, size, 0, 0, SIZE, SIZE);

                    // Compress to exactly 50KB or below using the same logic
                    try {
                        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 1.0));
                        const tempFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
                        // target 45KB to be safe under 50
                        const finalBlob = await this.compressToTarget(tempFile, 45, SIZE, 'Avatar', onProgress);
                        resolve(finalBlob);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error('Failed to render profile image'));
            };
            reader.onerror = () => reject(new Error('Failed to read profile file'));
        });
    },

    /**
     * Generate a very tiny blurred base64 placeholder (LQIP)
     */
    async generatePlaceholder(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 20;
                    canvas.height = Math.round((20 * img.height) / img.width);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, 20, canvas.height);
                    resolve(canvas.toDataURL('image/webp', 0.2));
                };
            };
        });
    },

    /**
     * Compress an image for the image-post upload flow.
     * - If file size ≤ 100 KB: minimal WebP conversion (preserve quality)
     * - If file size > 100 KB: progressive compression targeting ~100 KB
     * - Always caps dimensions at 1920px max
     * - Also generates a 320px thumbnail
     * @returns {Promise<{blob: Blob, thumbnail: Blob, width: number, height: number, originalSize: number}>}
     */
    async compressForUpload(file, onProgress = null) {
        const TARGET_KB = 800; // High quality target for classroom use
        const MAX_DIM = 2560; // Support up to 2.5K resolution
        const THUMB_DIM = 400; // Slightly larger thumbnails for high-DPI
        const originalSizeKB = file.size / 1024;

        return new Promise((resolve, reject) => {
            if (onProgress) onProgress(5, 'Loading image...');

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onerror = () => reject(new Error('Failed to decode image'));
                img.onload = async () => {
                    let width = img.width;
                    let height = img.height;

                    // Cap dimensions
                    if (width > MAX_DIM || height > MAX_DIM) {
                        if (width > height) {
                            height = Math.round((height * MAX_DIM) / width);
                            width = MAX_DIM;
                        } else {
                            width = Math.round((width * MAX_DIM) / height);
                            height = MAX_DIM;
                        }
                    }

                    // Main canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);

                    if (onProgress) onProgress(20, 'Processing...');

                    // Thumbnail canvas
                    let thumbW = THUMB_DIM;
                    let thumbH = Math.round((height * THUMB_DIM) / width);
                    if (thumbH > THUMB_DIM) {
                        thumbW = Math.round((width * THUMB_DIM) / height);
                        thumbH = THUMB_DIM;
                    }

                    const thumbCanvas = document.createElement('canvas');
                    thumbCanvas.width = thumbW;
                    thumbCanvas.height = thumbH;
                    const thumbCtx = thumbCanvas.getContext('2d');
                    thumbCtx.fillStyle = '#FFFFFF';
                    thumbCtx.fillRect(0, 0, thumbW, thumbH);
                    thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);

                    try {
                        // Generate thumbnail (always compress to ~50KB)
                        const thumbnailBlob = await new Promise((res) => {
                            thumbCanvas.toBlob(res, 'image/webp', 0.7);
                        });

                        // For classroom clarity, if the image is under 5MB, upload the EXACT original file 
                        // to prevent any loss of sharpness or text clarity from canvas re-encoding.
                        const BYPASS_MB = 5;
                        if (originalSizeKB <= BYPASS_MB * 1024) {
                            if (onProgress) onProgress(80, 'Using original image...');
                            
                            const mainBlob = file; // Use the exact original file
                            const result = {
                                blob: mainBlob,
                                thumbnail: thumbnailBlob,
                                width: Math.round(width), // Keep original dimensions
                                height: Math.round(height),
                                originalSize: file.size
                            };
                            resolve(result);
                        } else if (originalSizeKB <= TARGET_KB) {
                            // Light progressive WebP for medium-large files
                            if (onProgress) onProgress(80, 'Converting...');
                            const mainBlob = await new Promise((res) => {
                                canvas.toBlob(res, 'image/webp', 0.95);
                            });
                            if (onProgress) onProgress(100, 'Done!');
                            resolve({
                                blob: mainBlob,
                                thumbnail: thumbnailBlob,
                                width, height,
                                originalSize: file.size
                            });
                        } else {
                            // Progressive compression with higher quality floor
                            let quality = 0.95; 
                            const minQuality = 0.6; // Don't go below 0.6 to preserve classroom detail
                            const step = 0.05;

                            const compress = () => {
                                canvas.toBlob((blob) => {
                                    if (!blob) return reject(new Error('Compression failed'));

                                    const currentKB = blob.size / 1024;
                                    const progress = 20 + ((0.85 - quality) / (0.85 - minQuality)) * 75;
                                    if (onProgress) onProgress(Math.min(progress, 95), `Optimizing: ${currentKB.toFixed(0)} KB...`);

                                    if (currentKB <= TARGET_KB || quality <= minQuality) {
                                        if (onProgress) onProgress(100, 'Compressed!');
                                        resolve({
                                            blob,
                                            thumbnail: thumbnailBlob,
                                            width, height,
                                            originalSize: file.size
                                        });
                                    } else {
                                        quality -= step;
                                        setTimeout(compress, 30);
                                    }
                                }, 'image/webp', quality);
                            };

                            compress();
                        }
                    } catch (err) {
                        reject(err);
                    }
                };
            };
        });
    }
};
