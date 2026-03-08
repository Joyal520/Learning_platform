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
    }
};
