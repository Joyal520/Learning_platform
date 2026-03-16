// assets/js/api.js
import { supabase } from './supabase.js';

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
        const error = new Error(payload.error || `Request failed with status ${response.status}.`);
        error.status = response.status;
        error.url = apiUrl;
        throw error;
    }

    return payload;
}

async function uploadAssetToR2({ submissionId, assetType, file, filename = file?.name, contentType = file?.type }) {
    if (!file) return null;

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

    const uploadResponse = await fetch(signedUpload.uploadUrl, {
        method: 'PUT',
        headers: signedUpload.headers,
        body: file
    });

    if (!uploadResponse.ok) {
        throw new Error(`Upload failed for ${assetType}: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    return signedUpload;
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
                author_id,
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
    }
};
