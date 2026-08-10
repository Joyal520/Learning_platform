// assets/js/api.js
import { supabase } from './supabase.js';
import { buildAppUrl } from './path-utils.js';
import { ProjectUpload } from './project-upload.js';
import {
    sanitizeProjectDescription,
    sanitizeProjectMetadata,
    sanitizeProjectPreviewImage,
    sanitizeProjectTitle,
    validateProjectUrl
} from './url-submission.js';

const DEBUG_LOGS = false;
const debugLog = (...args) => { if (DEBUG_LOGS) console.log(...args); };

function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`TIMEOUT: ${label} took more than ${ms / 1000}s`)), ms)
        )
    ]);
}

async function withRetry(fn, { maxAttempts = 3, baseDelayMs = 500, label = 'API call' } = {}) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            const isTransient = err?.message?.includes('TIMEOUT') ||
                err?.message?.includes('Failed to fetch') ||
                err?.message?.includes('NetworkError') ||
                err?.message?.includes('Load failed') ||
                err?.code === 'PGRST301' ||
                (err?.status >= 500 && err?.status < 600) ||
                err?.status === 429;
            if (!isTransient || attempt >= maxAttempts) throw err;
            const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 200;
            console.warn(`[API] ${label} attempt ${attempt}/${maxAttempts} failed, retrying in ${Math.round(delay)}ms:`, err?.message || err);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
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

    const resolvedApiUrl = buildAppUrl(path);
    debugLog('[API] Resolved API URL:', { path, resolvedApiUrl });
    return resolvedApiUrl;
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

function getFileExtension(filename = '') {
    const match = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
}

function resolveUploadContentType(filename = '', contentType = '') {
    return ProjectUpload.getProjectMimeType(filename, contentType)
        || String(contentType || '').trim().toLowerCase()
        || 'application/octet-stream';
}

function shouldLogSubmissionPayloadDebug() {
    const hostname = globalThis?.location?.hostname || '';
    return hostname === 'localhost' || hostname === '127.0.0.1';
}

function logSubmissionPayloadKeys(label, payload, context = {}) {
    if (!shouldLogSubmissionPayloadDebug()) return;
    debugLog(`[API][DEV] ${label} payload keys:`, {
        keys: Object.keys(payload || {}).sort(),
        context
    });
}

function isPresentationLikeSubmission(payload = {}, existingSubmission = null) {
    const sources = [payload, existingSubmission].filter(Boolean);
    return sources.some((source) => {
        const category = String(source.category || '').trim().toLowerCase();
        const contentType = String(source.content_type || '').trim().toLowerCase();
        const fileType = String(source.file_type || source.mime_type || '').trim().toLowerCase();

        return category === 'presentations'
            || contentType.includes('presentation')
            || fileType.includes('presentationml')
            || fileType.includes('powerpoint')
            || fileType.includes('/pdf')
            || fileType === 'application/pdf';
    });
}

function isUrlLikeSubmission(payload = {}, existingSubmission = null) {
    const sources = [payload, existingSubmission].filter(Boolean);
    return sources.some((source) => {
        const submissionType = String(source.type || source.submission_type || '').trim().toLowerCase();
        const contentType = String(source.content_type || '').trim().toLowerCase();
        const contentMode = String(source.content_mode || '').trim().toLowerCase();
        const fileType = String(source.file_type || source.mime_type || '').trim().toLowerCase();

        return submissionType === 'url'
            || contentType === 'url'
            || contentMode === 'url'
            || fileType === 'text/uri-list';
    });
}

function normalizeUrlSubmissionPayload(payload = {}, options = {}) {
    const { existingSubmission = null } = options;
    if (!isUrlLikeSubmission(payload, existingSubmission)) {
        return { ...payload };
    }

    const nextPayload = { ...payload };
    const existingPreviewImage = sanitizeProjectPreviewImage(
        existingSubmission?.image_url || existingSubmission?.thumbnail_url || ''
    );
    const urlValidation = validateProjectUrl(
        nextPayload.url || nextPayload.external_url || nextPayload.file_url || existingSubmission?.file_url || ''
    );

    if (!urlValidation.valid) {
        throw new Error(urlValidation.error || 'Invalid URL');
    }

    const metadata = sanitizeProjectMetadata({
        title: nextPayload.title || existingSubmission?.title || '',
        description: nextPayload.description || existingSubmission?.description || '',
        previewImage: nextPayload.previewImage
            || nextPayload.preview_image
            || nextPayload.image_url
            || nextPayload.thumbnail_url
            || existingPreviewImage
    });

    nextPayload.content_type = 'url';
    nextPayload.file_type = 'text/uri-list';
    nextPayload.mime_type = 'text/uri-list';
    nextPayload.file_url = urlValidation.normalizedUrl;
    nextPayload.file_path = null;
    nextPayload.file_size = 0;
    nextPayload.storage_provider = null;
    nextPayload.content_text = null;

    if (metadata.title) {
        nextPayload.title = sanitizeProjectTitle(metadata.title);
    }

    nextPayload.description = sanitizeProjectDescription(metadata.description);

    if (metadata.previewImage) {
        nextPayload.image_url = metadata.previewImage;
        nextPayload.thumbnail_url = metadata.previewImage;
        nextPayload.thumbnail_path = null;
    }

    delete nextPayload.type;
    delete nextPayload.url;
    delete nextPayload.external_url;
    delete nextPayload.previewImage;
    delete nextPayload.preview_image;
    delete nextPayload.submission_type;
    delete nextPayload.content_mode;

    return nextPayload;
}

function sanitizeSubmissionPayload(payload = {}, options = {}) {
    const { existingSubmission = null } = options;
    const sanitized = applyDigitalClassroomMetadataGuard(
        normalizeUrlSubmissionPayload(payload, { existingSubmission }),
        { existingSubmission }
    );
    const isPresentation = isPresentationLikeSubmission(sanitized, existingSubmission);

    if (!isPresentation) {
        delete sanitized.presentation_notes;
    }

    return sanitized;
}

function normalizeMetadataValue(value) {
    return String(value || '').trim().toLowerCase();
}

function applyDigitalClassroomMetadataGuard(payload = {}, options = {}) {
    const { existingSubmission = null } = options;
    const nextPayload = { ...payload };
    const source = normalizeMetadataValue(nextPayload.source || existingSubmission?.source);
    const uploadContext = normalizeMetadataValue(nextPayload.upload_context || existingSubmission?.upload_context);
    const isDigitalClassroomUpload = source === 'digital_classroom' || uploadContext === 'classroom';

    if (!isDigitalClassroomUpload) return nextPayload;

    nextPayload.source = 'digital_classroom';
    nextPayload.upload_context = 'classroom';
    nextPayload.resource_purpose = 'teaching_resource';

    const payloadVisibility = normalizeMetadataValue(nextPayload.visibility);
    const existingVisibility = normalizeMetadataValue(existingSubmission?.visibility);
    const visibility = payloadVisibility || existingVisibility || 'private';
    nextPayload.visibility = visibility === 'public' ? 'public' : 'private';

    if (nextPayload.visibility === 'private') {
        nextPayload.explore_visible = false;
    } else if (!existingSubmission && nextPayload.explore_visible !== true) {
        nextPayload.explore_visible = false;
    }

    return nextPayload;
}

const OPTIONAL_SUBMISSION_METADATA_COLUMNS = new Set([
    'owner_id',
    'owner_role',
    'resource_purpose',
    'resource_type',
    'visibility',
    'explore_visible',
    'upload_context',
    'source',
    'classroom_id',
    'teacher_id',
    'updated_at'
]);

function getMissingSubmissionColumn(error) {
    const message = String(error?.message || error?.details || '').trim();
    const patterns = [
        /Could not find the '([^']+)' column/i,
        /column submissions\.([a-zA-Z0-9_]+) does not exist/i,
        /column "([^"]+)" of relation "submissions" does not exist/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match?.[1]) return match[1];
    }

    return null;
}

async function insertSubmissionWithMetadataRetry(payload, selectColumns = 'id') {
    const nextPayload = { ...payload };
    const removedColumns = [];

    for (let attempt = 0; attempt < OPTIONAL_SUBMISSION_METADATA_COLUMNS.size + 1; attempt += 1) {
        const result = await withTimeout(
            supabase.from('submissions').insert([nextPayload]).select(selectColumns).single(),
            120000,
            'Database INSERT'
        );

        if (!result.error) {
            if (removedColumns.length) {
                console.warn('[API] Uploaded without unsupported optional submission metadata columns:', removedColumns);
            }
            return result;
        }

        const missingColumn = getMissingSubmissionColumn(result.error);
        if (!missingColumn || !OPTIONAL_SUBMISSION_METADATA_COLUMNS.has(missingColumn) || !(missingColumn in nextPayload)) {
            return result;
        }

        removedColumns.push(missingColumn);
        delete nextPayload[missingColumn];
    }

    return {
        data: null,
        error: new Error('Could not insert submission after checking optional metadata columns.')
    };
}

function isPublicExploreSubmission(row = {}) {
    const status = String(row.status || '').trim().toLowerCase();
    const visibility = String(row.visibility || '').trim().toLowerCase();
    return status === 'approved'
        && visibility === 'public'
        && row.explore_visible === true
        && row.is_deleted !== true;
}

async function validateUploadedProject({ objectKey, filename, contentType }) {
    return callServerApi('/api/r2-validate-project', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            objectKey,
            filename,
            contentType: resolveUploadContentType(filename, contentType)
        })
    });
}

async function processWebsiteProject({ submissionId, objectKey }) {
    return callServerApi('/api/process-website-project', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            submissionId,
            objectKey
        })
    });
}

async function fetchProjectUrlMetadata(url) {
    return callServerApi('/api/fetch-url-metadata', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    });
}

async function uploadAssetToR2({ submissionId, assetType, file, filename = file?.name, contentType = file?.type }) {
    if (!file) return null;
    const resolvedContentType = resolveUploadContentType(filename, contentType);

    debugLog('[API] R2 upload requested:', {
        submissionId,
        assetType,
        originalFilename: filename,
        originalFileSize: file.size,
        contentType: resolvedContentType
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
            contentType: resolvedContentType,
            size: file.size
        })
    });

    if (assetType === 'project') {
        debugLog('[API] Project signed upload ready:', {
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
        debugLog('[API] Project PUT completed:', {
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

    debugLog('[API] R2 upload result:', {
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
        debugLog('[API] Project upload verified in R2:', {
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

function createAssetVersionToken() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(16).slice(2, 10);
    return `${timestamp}-${randomSuffix}`;
}

function buildVersionedUploadSubmissionId(submissionId, versionToken) {
    return `${submissionId}-${versionToken}`;
}

function appendVersionQuery(url, versionToken) {
    if (!url || !versionToken) return url || null;

    try {
        const parsedUrl = new URL(url, globalThis.location?.origin || 'http://localhost');
        parsedUrl.searchParams.set('v', versionToken);
        return parsedUrl.toString();
    } catch (_) {
        return `${url}${String(url).includes('?') ? '&' : '?'}v=${encodeURIComponent(versionToken)}`;
    }
}

function extractObjectKeyFromPublicUrl(url) {
    if (!url) return null;

    try {
        const parsedUrl = new URL(url, globalThis.location?.origin || 'http://localhost');
        return decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, '')) || null;
    } catch (_) {
        return null;
    }
}

async function preflightR2Upload({ assetType, file, filename = file?.name, contentType = file?.type }) {
    if (!file) return null;
    const resolvedContentType = resolveUploadContentType(filename, contentType);

    await callServerApi('/api/r2-sign-upload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            submissionId: createUploadPreflightId(),
            assetType,
            filename,
            contentType: resolvedContentType,
            size: file.size,
            preflight: true
        })
    });

    return true;
}

async function deleteR2Assets(keysOrUrls, submissionId) {
    const entries = (keysOrUrls || []).filter(Boolean);
    const keys = entries.filter((value) => !String(value).endsWith('/'));
    const prefixes = entries.filter((value) => String(value).endsWith('/'));
    if (keys.length === 0 && prefixes.length === 0) return;

    await callServerApi('/api/r2-delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            submissionId,
            keys,
            prefixes
        })
    });
}

export const API = {
    async fetchProjectUrlMetadata(url) {
        return fetchProjectUrlMetadata(url);
    },

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
        const logPrefix = `[Explore:getSubmissions]`;
        console.log(`${logPrefix} Request started`, { category, sort, limit, offset });

        return withRetry(async () => {
            let query = supabase
                .from('submissions')
                .select(`
                    id,
                    title,
                    description,
                    category,
                    themes,
                    author_id,
                    thumbnail_path,
                    thumbnail_url,
                    image_url,
                    file_type,
                    mime_type,
                    file_url,
                    file_path,
                    content_type,
                    status,
                    visibility,
                    explore_visible,
                    is_deleted,
                    created_at,
                    updated_at,
                    profiles!author_id (display_name, avatar_url)
                `)
                .eq('status', 'approved')
                .eq('visibility', 'public')
                .eq('explore_visible', true)
                .or('is_deleted.is.null,is_deleted.eq.false');

            if (category) {
                query = query.eq('category', category);
            }

            const { data, error } = await query
                .order(sort, { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                console.error(`${logPrefix} Supabase query error:`, { code: error.code, message: error.message, details: error.details, hint: error.hint });
                return { data, error };
            }

            const filtered = (data || []).filter((row) => isPublicExploreSubmission(row));
            console.log(`${logPrefix} Success — ${filtered.length} records returned (${(data || []).length} raw)`, { category, offset });
            return {
                data: filtered,
                error: null
            };
        }, { label: `getSubmissions(cat=${category}, offset=${offset})` });
    },

    async getSubmissionById(id) {
        if (!id) {
            return { data: null, error: new Error('Submission id is required.') };
        }

        try {
            const { data, error } = await supabase
                .from('submissions')
                .select(`
                    *,
                    profiles!author_id (display_name, avatar_url)
                `)
                .eq('id', id)
                .maybeSingle();


    async getSubmissionById(id) {
        if (!id) {
            return { data: null, error: new Error('Submission id is required.') };
        }

        try {
            const { data, error } = await supabase
                .from('submissions')
                .select(`
                    *,
                    profiles!author_id (display_name, avatar_url)
                `)
                .eq('id', id)
                .maybeSingle();

            return { data, error };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getStatsForSubmissions(ids) {
        if (!ids || ids.length === 0) return {};
        try {
            const { data: statsData, error } = await supabase
                .from('submission_stats')
                .select('id, avg_rating, like_count, view_count')
                .in('id', ids);

            if (error) {
                console.error('[API] getStatsForSubmissions query error:', { code: error.code, message: error.message, details: error.details });
            }

            const statsMap = {};
            if (statsData) {
                statsData.forEach(s => { statsMap[s.id] = s; });
            }
            return statsMap;
        } catch (e) {
            console.error('[API] getStatsForSubmissions exception:', e.message || e);
            return {};
        }
    },

    async getUserSubmissionInteractions(ids, userId) {
        if (!ids || ids.length === 0 || !userId) return {};

        try {
            const uniqueIds = [...new Set(ids.filter(Boolean))];
            const [likesResult, bookmarksResult, ratingsResult] = await Promise.all([
                supabase.from('likes').select('submission_id').eq('user_id', userId).in('submission_id', uniqueIds),
                supabase.from('bookmarks').select('submission_id').eq('user_id', userId).in('submission_id', uniqueIds),
                supabase.from('ratings').select('submission_id, rating').eq('user_id', userId).in('submission_id', uniqueIds)
            ]);

            if (likesResult.error) console.warn('[API] getUserSubmissionInteractions likes query error:', likesResult.error.message);
            if (bookmarksResult.error) console.warn('[API] getUserSubmissionInteractions bookmarks query error:', bookmarksResult.error.message);
            if (ratingsResult.error) console.warn('[API] getUserSubmissionInteractions ratings query error:', ratingsResult.error.message);

            const interactionMap = {};
            uniqueIds.forEach((id) => {
                interactionMap[id] = { liked: false, bookmarked: false, userRating: null };
            });

            (likesResult.data || []).forEach((row) => {
                if (!interactionMap[row.submission_id]) interactionMap[row.submission_id] = {};
                interactionMap[row.submission_id].liked = true;
            });

            (bookmarksResult.data || []).forEach((row) => {
                if (!interactionMap[row.submission_id]) interactionMap[row.submission_id] = {};
                interactionMap[row.submission_id].bookmarked = true;
            });

            (ratingsResult.data || []).forEach((row) => {
                if (!interactionMap[row.submission_id]) interactionMap[row.submission_id] = {};
                interactionMap[row.submission_id].userRating = Number(row.rating) || null;
            });

            return interactionMap;
        } catch (error) {
            console.error('[API] getUserSubmissionInteractions exception:', error.message || error);
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
                status,
                visibility,
                explore_visible,
                is_deleted,
                profiles!author_id(display_name, avatar_url)
            `)
            .eq('status', 'approved')
            .eq('visibility', 'public')
            .eq('explore_visible', true)
            .or('is_deleted.is.null,is_deleted.eq.false')
            .limit(500);

        if (error) {
            return { data: [], error };
        }

        const publicSubmissions = (submissions || []).filter((row) => isPublicExploreSubmission(row));

        if (publicSubmissions.length === 0) {
            return { data: [], error: null };
        }

        const statsMap = await this.getStatsForSubmissions(publicSubmissions.map((submission) => submission.id));
        const creatorMap = new Map();

        publicSubmissions.forEach((submission) => {
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
        debugLog('[API] === UPLOAD START ===');
        let createdSubmissionId = null;
        const uploadedKeys = [];
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('[API] No active session found. Attempting anyway...');
            } else {
                debugLog('[API] Session verified for:', session.user.email);
            }

            const sanitizedSubmissionData = sanitizeSubmissionPayload(submissionData);
            logSubmissionPayloadKeys('uploadSubmission.insert', sanitizedSubmissionData, {
                fileType: file?.type || null,
                fileName: file?.name || null
            });

            const payloadStr = JSON.stringify(sanitizedSubmissionData);
            debugLog(`[API] Payload size: ${(payloadStr.length / 1024).toFixed(2)} KB`);

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

            debugLog('[API] Sending insert request...');
            const { data: sub, error: insertError } = await insertSubmissionWithMetadataRetry(sanitizedSubmissionData, 'id');

            if (insertError) throw insertError;
            debugLog('[API] Insert successful, ID:', sub.id);
            const subId = sub.id;
            createdSubmissionId = subId;
            const updateObject = {};

            if (thumbnailBlob) {
                debugLog('[API] Uploading thumbnail to R2...');
                debugLog('[API] Generated thumbnail asset:', {
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
                debugLog('[API] Uploading display image to R2...');
                debugLog('[API] Generated display asset:', {
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

                if (assetType === 'project') {
                    await validateUploadedProject({
                        objectKey: fileUpload.objectKey,
                        filename: file.name,
                        contentType: file.type
                    });
                }

                const resolvedFileType = resolveUploadContentType(file.name, file.type);
                updateObject.file_path = fileUpload.objectKey;
                updateObject.file_url = fileUpload.publicUrl;
                updateObject.file_type = resolvedFileType;
                updateObject.mime_type = resolvedFileType;
                updateObject.file_size = file.size;
                updateObject.storage_provider = 'r2';
            }

            if (Object.keys(updateObject).length > 0) {
                const sanitizedUpdateObject = sanitizeSubmissionPayload(updateObject, {
                    existingSubmission: sanitizedSubmissionData
                });
                logSubmissionPayloadKeys('uploadSubmission.postUploadUpdate', sanitizedUpdateObject, {
                    submissionId: subId
                });
                const { error: updateError } = await supabase.from('submissions').update(sanitizedUpdateObject).eq('id', subId);
                if (updateError) throw updateError;
            }

            if (file && updateObject.mime_type?.includes('zip')) {
                await processWebsiteProject({
                    submissionId: subId,
                    objectKey: updateObject.file_path
                });
            }

            debugLog('[API] === UPLOAD COMPLETE ===');
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
        debugLog('[API] === UPDATE START ===', id);
        let uploadedThumbnailKey = null;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) console.warn('[API] No session found.');

            const nextUpdateData = { ...updateData };
            delete nextUpdateData.thumbnail_path;

            const { data: existingSubmission, error: existingSubmissionError } = await supabase
                .from('submissions')
                .select('id, category, content_type, file_type, mime_type, file_url, image_url, thumbnail_path, thumbnail_url, visibility, explore_visible, upload_context, source, resource_purpose, classroom_id')
                .eq('id', id)
                .maybeSingle();

            if (existingSubmissionError) {
                console.warn('[API] Could not load existing submission metadata for sanitization:', existingSubmissionError);
            }

            if (thumbnailBlob) {
                const thumbnailVersion = createAssetVersionToken();
                const versionedUploadId = buildVersionedUploadSubmissionId(id, thumbnailVersion);
                debugLog('[API] Uploading thumbnail to R2...');
                debugLog('[API] Generated thumbnail asset:', {
                    filename: `thumbnail-${id}-${thumbnailVersion}.webp`,
                    size: thumbnailBlob.size
                });
                const thumbUpload = await uploadAssetToR2({
                    submissionId: versionedUploadId,
                    assetType: 'thumbnail',
                    file: thumbnailBlob,
                    filename: `thumbnail-${id}-${thumbnailVersion}.webp`,
                    contentType: thumbnailBlob.type || 'image/webp'
                });
                uploadedThumbnailKey = thumbUpload.objectKey;
                nextUpdateData.thumbnail_path = thumbUpload.objectKey;
                nextUpdateData.thumbnail_url = appendVersionQuery(thumbUpload.publicUrl, thumbnailVersion);
                nextUpdateData.storage_provider = 'r2';
                debugLog('[API] Thumbnail stored:', nextUpdateData.thumbnail_url);
            }

            if (displayBlob) {
                debugLog('[API] Uploading display image to R2...');
                debugLog('[API] Generated display asset:', {
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
                nextUpdateData.image_url = displayUpload.publicUrl;
                nextUpdateData.storage_provider = 'r2';
                debugLog('[API] Display image stored:', displayUpload.publicUrl);
            }

            const sanitizedUpdateData = sanitizeSubmissionPayload(nextUpdateData, {
                existingSubmission
            });
            logSubmissionPayloadKeys('updateSubmission.update', sanitizedUpdateData, {
                submissionId: id,
                existingCategory: existingSubmission?.category || null,
                existingContentType: existingSubmission?.content_type || null,
                existingFileType: existingSubmission?.file_type || null
            });

            debugLog('[API] Updating database record...');
            const { data, error } = await supabase
                .from('submissions')
                .update(sanitizedUpdateData)
                .eq('id', id)
                .select('id, thumbnail_path, thumbnail_url');

            if (error) {
                console.error('[API] DB Update Error:', error);
                throw error;
            }

            if (uploadedThumbnailKey) {
                const previousThumbnailPath = existingSubmission?.thumbnail_path || extractObjectKeyFromPublicUrl(existingSubmission?.thumbnail_url);
                const nextThumbnailPath = sanitizedUpdateData.thumbnail_path || data?.[0]?.thumbnail_path || null;

                if (previousThumbnailPath && nextThumbnailPath && previousThumbnailPath !== nextThumbnailPath) {
                    try {
                        await deleteR2Assets([previousThumbnailPath], id);
                        debugLog('[API] Deleted replaced thumbnail asset:', previousThumbnailPath);
                    } catch (cleanupError) {
                        console.warn('[API] Failed to delete previous thumbnail asset:', cleanupError);
                    }
                }
            }

            debugLog('[API] Update succeeded!');
            return { data, error: null };
        } catch (err) {
            console.error('[API] Error in updateSubmission:', err);
            if (uploadedThumbnailKey) {
                try {
                    await deleteR2Assets([uploadedThumbnailKey], id);
                } catch (cleanupErr) {
                    console.warn('[API] Failed to clean uploaded replacement thumbnail:', cleanupErr);
                }
            }
            return { error: err };
        }
    },

    async uploadImagePost(submissionData, imageBlob, thumbnailBlob = null) {
        debugLog('[API] === IMAGE POST UPLOAD START ===');
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

            const sanitizedSubmissionData = sanitizeSubmissionPayload(submissionData);
            logSubmissionPayloadKeys('uploadImagePost.insert', sanitizedSubmissionData, {
                imageType: imageBlob?.type || null
            });

            debugLog('[API] Inserting image post record...');
            const { data: sub, error: insertError } = await insertSubmissionWithMetadataRetry(sanitizedSubmissionData, 'id');

            if (insertError) throw insertError;
            debugLog('[API] Image post created, ID:', sub.id);

            const subId = sub.id;
            createdSubmissionId = subId;
            const updateObject = {};

            if (!imageBlob) {
                throw new Error('Image upload requires a full-size image file.');
            }

            const imageType = imageBlob.type || submissionData.mime_type || 'image/webp';
            debugLog('[API] Uploading full-size image to R2...');
            debugLog('[API] Full-size image asset:', {
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
                debugLog('[API] Uploading thumbnail to R2...');
                debugLog('[API] Generated thumbnail asset:', {
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
                const sanitizedUpdateObject = sanitizeSubmissionPayload(updateObject, {
                    existingSubmission: sanitizedSubmissionData
                });
                logSubmissionPayloadKeys('uploadImagePost.postUploadUpdate', sanitizedUpdateObject, {
                    submissionId: subId
                });
                const { data: updatedRow, error: updateError } = await supabase
                    .from('submissions')
                    .update(sanitizedUpdateObject)
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

            debugLog('[API] === IMAGE POST UPLOAD COMPLETE ===');
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

    async recordSubmissionView(submissionId, viewerId = null) {
        try {
            debugLog('[API] recordSubmissionView start:', {
                submissionId,
                viewerId,
                backendProjectUrl: supabase?.supabaseUrl || 'unknown'
            });
            const { error } = await supabase
                .from('views')
                .insert({
                    submission_id: submissionId,
                    viewer_id: viewerId
                });

            if (error) {
                console.warn('[API] recordSubmissionView failed:', error);
            } else {
                debugLog('[API] recordSubmissionView success:', { submissionId, viewerId });
            }
            return { error };
        } catch (err) {
            console.error('[API] View record error:', err);
            return { error: err };
        }
    },

    async rateSubmission(submissionId, userId, rating) {
        try {
            const parsedRating = Math.max(1, Math.min(5, Number(rating) || 0));
            debugLog('[API] rateSubmission start:', {
                submissionId,
                userId,
                rating: parsedRating,
                backendProjectUrl: supabase?.supabaseUrl || 'unknown'
            });
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

            debugLog('[API] rateSubmission refresh result:', {
                submissionId,
                avgRating,
                ratingCount,
                userRating: parsedRating
            });

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
            const { data } = await supabase
                .from('likes')
                .select('id')
                .match({ submission_id: submissionId, user_id: userId })
                .maybeSingle();

            if (data) {
                const { error: deleteError } = await supabase
                    .from('likes')
                    .delete()
                    .match({ submission_id: submissionId, user_id: userId });
                if (deleteError) throw deleteError;
                return { action: 'unliked', error: null };
            }

            const { error } = await supabase
                .from('likes')
                .insert({ submission_id: submissionId, user_id: userId });

            if (error && error.code === '23505') {
                const { error: deleteError } = await supabase
                    .from('likes')
                    .delete()
                    .match({ submission_id: submissionId, user_id: userId });
                if (deleteError) throw deleteError;
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
    },

    async sendWorkApprovedNotifications(submissionId) {
        if (!submissionId) {
            return { sent: 0, failed: 0, skipped: true, error: 'Missing submission id.' };
        }

        try {
            return await callServerApi('/api/fcm-send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    event: 'work-approved',
                    submissionId
                })
            });
        } catch (error) {
            console.warn('[API] Notification send failed:', error);
            return { sent: 0, failed: 0, skipped: true, error: error.message || 'Notification send failed.' };
        }
    }
};
