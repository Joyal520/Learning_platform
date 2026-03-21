// assets/js/api.js
import { supabase } from './supabase.js?v=11';

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT: ${label} took more than ${ms / 1000}s`)), ms)
        )
    ]);
}

function extensionFromContentType(contentType = '') {
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('gif')) return 'gif';
    if (contentType.includes('webp')) return 'webp';
    return 'bin';
}

async function getAccessToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
}

function resolveApiUrl(path) {
    if (!path) {
        throw new Error('Missing API path.');
    }

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return new URL(normalizedPath, window.location.origin).toString();
}

function formatServerApiError(payload, response) {
    const missingEnv = Array.isArray(payload?.missingEnv) ? payload.missingEnv.filter(Boolean) : [];
    if (payload?.code === 'R2_CONFIG_MISSING' && missingEnv.length > 0) {
        return `Upload is not configured correctly on this environment. Missing ${missingEnv.join(', ')}.`;
    }

    return payload?.error || `Request failed with status ${response.status}.`;
}

async function callServerApi(path, options = {}) {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        throw new Error('Authentication failed. Please log in again.');
    }

    const apiUrl = resolveApiUrl(path);
    const response = await fetch(apiUrl, {
        ...options,
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${accessToken}`
        }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(formatServerApiError(payload, response));
        error.status = response.status;
        error.url = apiUrl;
        error.code = payload?.code || null;
        error.missingEnv = Array.isArray(payload?.missingEnv) ? payload.missingEnv : [];
        throw error;
    }

    return payload;
}

async function uploadAssetToR2({ submissionId, assetType, file, filename = file?.name, contentType = file?.type }) {
    if (!file) return null;

    console.log('[API] R2 upload requested:', {
        submissionId,
        assetType,
        originalFilename: filename,
        originalFileSize: file.size,
        contentType
    });

    const signedUpload = await callServerApi('/api/r2-sign-upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            submissionId,
            assetType,
            filename,
            contentType,
            size: file.size
        })
    });

    if (assetType === 'project') {
        console.log('[API] Project signed upload ready:', {
            originalFilename: filename,
            objectKey: signedUpload.objectKey,
            publicUrl: signedUpload.publicUrl
        });
    }

    const uploadResponse = await fetch(signedUpload.uploadUrl, {
        method: 'PUT',
        headers: signedUpload.headers,
        body: file
    });

    if (assetType === 'project') {
        console.log('[API] Project PUT completed:', {
            objectKey: signedUpload.objectKey,
            status: uploadResponse.status,
            ok: uploadResponse.ok
        });
    }

    if (!uploadResponse.ok) {
        throw new Error(`Upload failed for ${assetType}: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    const verification = await callServerApi('/api/r2-verify-object', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            objectKey: signedUpload.objectKey
        })
    });

    console.log('[API] R2 upload result:', {
        assetType,
        destinationStorageProvider: signedUpload.storageProvider,
        destinationObjectKey: signedUpload.objectKey,
        publicUrl: signedUpload.publicUrl,
        uploadSucceeded: uploadResponse.ok,
        objectExists: verification.exists,
        objectListed: verification.listed
    });

    if (!verification.exists) {
        throw new Error(`Upload verification failed for ${assetType}: ${signedUpload.objectKey}`);
    }

    if (assetType === 'project') {
        console.log('[API] Project upload verified in R2:', {
            objectKey: signedUpload.objectKey,
            exists: verification.exists,
            listed: verification.listed
        });
    }

    return signedUpload;
}

function createUploadPreflightId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `preflight-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function preflightR2Upload({ assetType, file, filename = file?.name, contentType = file?.type }) {
    if (!file) return null;

    await callServerApi('/api/r2-sign-upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            submissionId: createUploadPreflightId(),
            assetType,
            filename,
            contentType,
            size: file.size,
            preflight: true
        })
    });

    return true;
}

async function deleteR2Assets(keysOrUrls, submissionId) {
    const keys = (keysOrUrls || []).filter(Boolean);
    if (keys.length === 0) return;

    await callServerApi('/api/r2-delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            submissionId,
            keys
        })
    });
}

export const API = {
    async promotePendingImageSubmission(submissionId) {
        const { data: sub, error: fetchError } = await supabase
            .from('submissions')
            .select('id, content_type, file_path, thumbnail_path, mime_type, storage_provider, image_url, thumbnail_url, file_url')
            .eq('id', submissionId)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!sub) throw new Error('Submission not found.');
        if (sub.content_type !== 'image') return { image_url: null, thumbnail_url: null };
        if (!sub.file_path) throw new Error('Pending image submission is missing its original file.');
        if (sub.storage_provider === 'r2') {
            return {
                image_url: sub.image_url || sub.file_url || null,
                thumbnail_url: sub.thumbnail_url || null
            };
        }

        const imageType = sub.mime_type || 'image/webp';
        const imageExt = extensionFromContentType(imageType);
        const publicImagePath = `image-posts/${submissionId}.${imageExt}`;

        const { data: imageBlob, error: imageDownloadError } = await supabase.storage
            .from('submissions_private')
            .download(sub.file_path);
        if (imageDownloadError) throw imageDownloadError;

        const { error: imageUploadError } = await supabase.storage
            .from('approved_public')
            .upload(publicImagePath, imageBlob, { contentType: imageType, upsert: true });
        if (imageUploadError) throw imageUploadError;

        const { data: publicImage } = supabase.storage.from('approved_public').getPublicUrl(publicImagePath);
        const updateObject = { image_url: publicImage.publicUrl };

        if (sub.thumbnail_path) {
            const { data: thumbBlob, error: thumbDownloadError } = await supabase.storage
                .from('submissions_private')
                .download(sub.thumbnail_path);
            if (thumbDownloadError) throw thumbDownloadError;

            const publicThumbPath = `thumbnails/${submissionId}.webp`;
            const { error: thumbUploadError } = await supabase.storage
                .from('approved_public')
                .upload(publicThumbPath, thumbBlob, { contentType: 'image/webp', upsert: true });
            if (thumbUploadError) throw thumbUploadError;

            const { data: publicThumb } = supabase.storage.from('approved_public').getPublicUrl(publicThumbPath);
            updateObject.thumbnail_url = publicThumb.publicUrl;
        }

        const { error: updateError } = await supabase
            .from('submissions')
            .update(updateObject)
            .eq('id', submissionId);
        if (updateError) throw updateError;

        return updateObject;
    },

    async getSubmissions(category = null, sort = 'created_at', limit = 20, offset = 0) {
        let query = supabase
            .from('submissions')
            .select(`
                id,
                title,
                description,
                category,
                themes,
                author_id,
                file_path,
                file_url,
                file_type,
                mime_type,
                storage_provider,
                thumbnail_path,
                thumbnail_url,
                image_url,
                content_type,
                status,
                created_at,
                updated_at,
                profiles!author_id (display_name, avatar_url)
            `)
            .eq('status', 'approved');

        if (category) {
            query = query.eq('category', category);
        } else {
            query = query.neq('category', 'images');
        }

        const { data, error } = await query
            .order(sort, { ascending: false })
            .range(offset, offset + limit - 1);

        return { data, error };
    },

    async getStatsForSubmissions(ids) {
        if (!ids || ids.length === 0) return {};
        try {
            const { data: statsData } = await supabase
                .from('submission_stats')
                .select('id, avg_rating, like_count, view_count')
                .in('id', ids);

            const statsMap = {};
            if (statsData) {
                statsData.forEach(s => { statsMap[s.id] = s; });
            }
            return statsMap;
        } catch (e) {
            console.warn('[API] Could not fetch stats:', e.message);
            return {};
        }
    },

    async getTopCreators(limit = 10) {
        const resolvedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 500;
        const { data: submissions, error } = await supabase
            .from('submissions')
            .select(`
                id,
                author_id,
                category,
                content_type,
                profiles!author_id(display_name, avatar_url)
            `)
            .eq('status', 'approved')
            .limit(500);

        if (error) {
            return { data: [], error };
        }

        if (!submissions || submissions.length === 0) {
            return { data: [], error: null };
        }

        const statsMap = await this.getStatsForSubmissions(submissions.map((submission) => submission.id));
        const creatorMap = new Map();

        submissions.forEach((submission) => {
            const authorId = submission.author_id;
            if (!authorId) return;

            const profile = submission.profiles || {};
            const stats = statsMap[submission.id] || { avg_rating: 0, like_count: 0, view_count: 0 };
            const points = this.calculateCreatorPoints(stats);
            const title = this.getCreatorTitle(submission);

            if (!creatorMap.has(authorId)) {
                creatorMap.set(authorId, {
                    id: authorId,
                    name: profile.display_name || 'Anonymous Creator',
                    avatar: profile.avatar_url || null,
                    points: 0,
                    title,
                    topSubmissionPoints: points
                });
            }

            const creator = creatorMap.get(authorId);
            creator.points += points;
            if (points >= creator.topSubmissionPoints) {
                creator.topSubmissionPoints = points;
                creator.title = title;
            }
        });

        const data = [...creatorMap.values()]
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return a.name.localeCompare(b.name);
            })
            .slice(0, resolvedLimit)
            .map(({ topSubmissionPoints, ...creator }) => creator);

        return { data, error: null };
    },

    calculateCreatorPoints(stats = {}) {
        const likeCount = Number(stats.like_count) || 0;
        const viewCount = Number(stats.view_count) || 0;
        const avgRating = Number(stats.avg_rating) || 0;
        return (likeCount * 5) + viewCount + Math.round(avgRating * 10);
    },

    getCreatorTitle(submission = {}) {
        const category = String(submission.category || '');
        const contentType = String(submission.content_type || '');
        const label = `${category} ${contentType}`.toLowerCase();

        if (label.includes('story')) return 'Young Storyteller';
        if (label.includes('writing') || label.includes('poem') || label.includes('essay')) return 'Aspiring Writer';
        if (label.includes('image') || label.includes('art') || label.includes('media')) return 'Creative Artist';
        if (label.includes('learning') || label.includes('tool') || label.includes('project')) return 'Curious Builder';
        if (label.includes('fun')) return 'Imaginative Maker';
        return 'Creative Explorer';
    },

    async uploadSubmission(submissionData, file = null, thumbnailBlob = null, displayBlob = null) {
        console.log('[API] === UPLOAD START ===');
        let createdSubmissionId = null;
        const uploadedKeys = [];
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('[API] No active session found. Attempting anyway...');
            } else {
                console.log('[API] Session verified for:', session.user.email);
            }

            const payloadStr = JSON.stringify(submissionData);
            console.log(`[API] Payload size: ${(payloadStr.length / 1024).toFixed(2)} KB`);

            if (thumbnailBlob) {
                await preflightR2Upload({
                    assetType: 'thumbnail',
                    file: thumbnailBlob,
                    filename: 'thumbnail-preflight.webp',
                    contentType: thumbnailBlob.type || 'image/webp'
                });
            }

            if (displayBlob) {
                await preflightR2Upload({
                    assetType: 'display',
                    file: displayBlob,
                    filename: 'display-preflight.webp',
                    contentType: displayBlob.type || 'image/webp'
                });
            }

            if (file) {
                await preflightR2Upload({
                    assetType: file.type?.startsWith('audio/') ? 'audio' : 'project',
                    file
                });
            }

            console.log('[API] Sending insert request...');
            const { data: sub, error: insertError } = await withTimeout(
                supabase.from('submissions').insert([submissionData]).select('id').single(),
                120000,
                'Database INSERT'
            );

            if (insertError) throw insertError;
            console.log('[API] Insert successful, ID:', sub.id);
            const subId = sub.id;
            createdSubmissionId = subId;
            const updateObject = {};

            if (thumbnailBlob) {
                console.log('[API] Uploading thumbnail to R2...');
                console.log('[API] Generated thumbnail asset:', {
                    filename: `thumbnail-${subId}.webp`,
                    size: thumbnailBlob.size
                });
                const thumbUpload = await uploadAssetToR2({
                    submissionId: subId,
                    assetType: 'thumbnail',
                    file: thumbnailBlob,
                    filename: `thumbnail-${subId}.webp`,
                    contentType: thumbnailBlob.type || 'image/webp'
                });
                uploadedKeys.push(thumbUpload.objectKey);
                updateObject.thumbnail_path = thumbUpload.objectKey;
                updateObject.thumbnail_url = thumbUpload.publicUrl;
                updateObject.storage_provider = 'r2';
            }

            if (displayBlob) {
                console.log('[API] Uploading display image to R2...');
                console.log('[API] Generated display asset:', {
                    filename: `display-${subId}.webp`,
                    size: displayBlob.size
                });
                const displayUpload = await uploadAssetToR2({
                    submissionId: subId,
                    assetType: 'display',
                    file: displayBlob,
                    filename: `display-${subId}.webp`,
                    contentType: displayBlob.type || 'image/webp'
                });
                uploadedKeys.push(displayUpload.objectKey);
                updateObject.image_url = displayUpload.publicUrl;
                updateObject.storage_provider = 'r2';
            }

            if (file) {
                const assetType = file.type?.startsWith('audio/') ? 'audio' : 'project';
                const fileUpload = await uploadAssetToR2({
                    submissionId: subId,
                    assetType,
                    file
                });
                uploadedKeys.push(fileUpload.objectKey);
                updateObject.file_path = fileUpload.objectKey;
                updateObject.file_url = fileUpload.publicUrl;
                updateObject.file_type = file.type;
                updateObject.file_size = file.size;
                updateObject.storage_provider = 'r2';
            }

            if (Object.keys(updateObject).length > 0) {
                const { error: updateError } = await supabase.from('submissions').update(updateObject).eq('id', subId);
                if (updateError) throw updateError;
            }

            console.log('[API] === UPLOAD COMPLETE ===');
            return { data: sub, error: null };
        } catch (err) {
            console.error('[API] Upload failed:', err);
            if (uploadedKeys.length > 0 && createdSubmissionId) {
                try {
                    await deleteR2Assets(uploadedKeys, createdSubmissionId);
                } catch (cleanupErr) {
                    console.warn('[API] Failed to clean uploaded R2 objects:', cleanupErr);
                }
            }
            if (createdSubmissionId) {
                try {
                    await supabase.from('submissions').delete().eq('id', createdSubmissionId);
                } catch (deleteErr) {
                    console.warn('[API] Failed to clean failed submission row:', deleteErr);
                }
            }
            return { error: err };
        }
    },

    async updateSubmission(id, updateData, thumbnailBlob = null, displayBlob = null) {
        console.log('[API] === UPDATE START ===', id);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) console.warn('[API] No session found.');

            delete updateData.thumbnail_path;

            if (thumbnailBlob) {
                console.log('[API] Uploading thumbnail to R2...');
                console.log('[API] Generated thumbnail asset:', {
                    filename: `thumbnail-${id}.webp`,
                    size: thumbnailBlob.size
                });
                const thumbUpload = await uploadAssetToR2({
                    submissionId: id,
                    assetType: 'thumbnail',
                    file: thumbnailBlob,
                    filename: `thumbnail-${id}.webp`,
                    contentType: thumbnailBlob.type || 'image/webp'
                });
                updateData.thumbnail_path = thumbUpload.objectKey;
                updateData.thumbnail_url = thumbUpload.publicUrl;
                updateData.storage_provider = 'r2';
                console.log('[API] Thumbnail stored:', thumbUpload.publicUrl);
            }

            if (displayBlob) {
                console.log('[API] Uploading display image to R2...');
                console.log('[API] Generated display asset:', {
                    filename: `display-${id}.webp`,
                    size: displayBlob.size
                });
                const displayUpload = await uploadAssetToR2({
                    submissionId: id,
                    assetType: 'display',
                    file: displayBlob,
                    filename: `display-${id}.webp`,
                    contentType: displayBlob.type || 'image/webp'
                });
                updateData.image_url = displayUpload.publicUrl;
                updateData.storage_provider = 'r2';
                console.log('[API] Display image stored:', displayUpload.publicUrl);
            }

            console.log('[API] Updating database record...');
            const { data, error } = await supabase
                .from('submissions')
                .update(updateData)
                .eq('id', id)
                .select('id');

            if (error) {
                console.error('[API] DB Update Error:', error);
                throw error;
            }

            console.log('[API] Update succeeded!');
            return { data, error: null };
        } catch (err) {
            console.error('[API] Error in updateSubmission:', err);
            return { error: err };
        }
    },

    async uploadImagePost(submissionData, imageBlob, thumbnailBlob = null) {
        console.log('[API] === IMAGE POST UPLOAD START ===');
        let createdSubmissionId = null;
        const uploadedKeys = [];
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('[API] No active session for image upload.');
            }

            await preflightR2Upload({
                assetType: 'image',
                file: imageBlob,
                contentType: imageBlob?.type || submissionData.mime_type || 'image/webp'
            });

            if (thumbnailBlob) {
                await preflightR2Upload({
                    assetType: 'thumbnail',
                    file: thumbnailBlob,
                    filename: 'thumbnail-preflight.webp',
                    contentType: thumbnailBlob.type || 'image/webp'
                });
            }

            console.log('[API] Inserting image post record...');
            const { data: sub, error: insertError } = await withTimeout(
                supabase.from('submissions').insert([submissionData]).select('id').single(),
                60000,
                'Image Post INSERT'
            );

            if (insertError) throw insertError;
            console.log('[API] Image post created, ID:', sub.id);

            const subId = sub.id;
            createdSubmissionId = subId;
            const updateObject = {};

            if (!imageBlob) {
                throw new Error('Image upload requires a full-size image file.');
            }

            const imageType = imageBlob.type || submissionData.mime_type || 'image/webp';
            console.log('[API] Uploading full-size image to R2...');
            console.log('[API] Full-size image asset:', {
                filename: imageBlob.name || `image-${subId}`,
                size: imageBlob.size
            });
            const imageUpload = await uploadAssetToR2({
                submissionId: subId,
                assetType: 'image',
                file: imageBlob,
                contentType: imageType
            });
            uploadedKeys.push(imageUpload.objectKey);

            updateObject.file_path = imageUpload.objectKey;
            updateObject.file_url = imageUpload.publicUrl;
            updateObject.file_type = imageType;
            updateObject.file_size = imageBlob.size;
            updateObject.image_url = imageUpload.publicUrl;
            updateObject.storage_provider = 'r2';

            if (thumbnailBlob) {
                console.log('[API] Uploading thumbnail to R2...');
                console.log('[API] Generated thumbnail asset:', {
                    filename: `thumbnail-${subId}.webp`,
                    size: thumbnailBlob.size
                });
                const thumbUpload = await uploadAssetToR2({
                    submissionId: subId,
                    assetType: 'thumbnail',
                    file: thumbnailBlob,
                    filename: `thumbnail-${subId}.webp`,
                    contentType: thumbnailBlob.type || 'image/webp'
                });
                uploadedKeys.push(thumbUpload.objectKey);
                updateObject.thumbnail_path = thumbUpload.objectKey;
                updateObject.thumbnail_url = thumbUpload.publicUrl;
            }

            if (Object.keys(updateObject).length > 0) {
                const { data: updatedRow, error: updateError } = await supabase
                    .from('submissions')
                    .update(updateObject)
                    .eq('id', subId)
                    .select('id, file_path, thumbnail_path')
                    .maybeSingle();

                if (updateError) {
                    throw updateError;
                }

                if (!updatedRow?.file_path) {
                    throw new Error('Image upload did not save the full-size source file.');
                }
            }

            console.log('[API] === IMAGE POST UPLOAD COMPLETE ===');
            return { data: sub, error: null };
        } catch (err) {
            console.error('[API] Image post upload failed:', err);
            if (uploadedKeys.length > 0 && createdSubmissionId) {
                try {
                    await deleteR2Assets(uploadedKeys, createdSubmissionId);
                } catch (cleanupErr) {
                    console.warn('[API] Could not clean up failed image objects:', cleanupErr);
                }
            }
            if (createdSubmissionId) {
                try {
                    await supabase.from('submissions').delete().eq('id', createdSubmissionId);
                } catch (cleanupErr) {
                    console.warn('[API] Could not clean up failed image post row:', cleanupErr);
                }
            }
            return { error: err };
        }
    },

    async getSubmissionPlaybackData(submissionId) {
        try {
            const { data, error } = await supabase
                .from('submissions')
                .select('id, file_path, file_url, file_type, mime_type, storage_provider, content_type')
                .eq('id', submissionId)
                .maybeSingle();

            return { data, error };
        } catch (err) {
            console.error('[API] Submission playback fetch error:', err);
            return { data: null, error: err };
        }
    },

    async rateSubmission(submissionId, userId, rating) {
        try {
            const parsedRating = Math.max(1, Math.min(5, Number(rating) || 0));
            const { error } = await supabase
                .from('ratings')
                .upsert({
                    submission_id: submissionId,
                    user_id: userId,
                    rating: parsedRating
                }, { onConflict: 'submission_id,user_id' });

            if (error) throw error;

            const { data: ratings, error: ratingsError } = await supabase
                .from('ratings')
                .select('rating')
                .eq('submission_id', submissionId);

            if (ratingsError) throw ratingsError;

            const ratingCount = ratings?.length || 0;
            const ratingSum = (ratings || []).reduce((sum, item) => sum + Number(item.rating || 0), 0);
            const avgRating = ratingCount > 0 ? ratingSum / ratingCount : 0;

            return {
                data: {
                    avgRating,
                    ratingCount,
                    userRating: parsedRating
                },
                error: null
            };
        } catch (err) {
            console.error('[API] Rating error:', err);
            return { data: null, error: err };
        }
    },

    async toggleLike(submissionId, userId) {
        try {
            const { error } = await supabase
                .from('likes')
                .insert({ submission_id: submissionId, user_id: userId });

            if (error && error.code === '23505') {
                await supabase.from('likes').delete().match({ submission_id: submissionId, user_id: userId });
                return { action: 'unliked', error: null };
            }

            if (error) throw error;
            return { action: 'liked', error: null };
        } catch (err) {
            console.error('[API] Like error:', err);
            return { error: err };
        }
    },

    async toggleBookmark(submissionId, userId) {
        try {
            const { data } = await supabase
                .from('bookmarks')
                .select('id')
                .match({ submission_id: submissionId, user_id: userId })
                .maybeSingle();

            if (data) {
                await supabase.from('bookmarks').delete().match({ submission_id: submissionId, user_id: userId });
                return { action: 'removed', error: null };
            }

            const { error: insErr } = await supabase
                .from('bookmarks')
                .insert({ submission_id: submissionId, user_id: userId });
            if (insErr) throw insErr;
            return { action: 'saved', error: null };
        } catch (err) {
            console.error('[API] Bookmark error:', err);
            return { error: err };
        }
    },

    async deleteStoredMedia(keysOrUrls, submissionId) {
        await deleteR2Assets(keysOrUrls, submissionId);
    },

    async getR2Metrics() {
        return callServerApi('/api/r2-metrics', { method: 'GET' });
    },

    async getR2Diagnostics(refresh = true) {
        const query = refresh ? '?refresh=true' : '';
        return callServerApi(`/api/r2-diagnostics${query}`, { method: 'GET' });
    }
};
