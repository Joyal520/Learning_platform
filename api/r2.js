// Consolidated R2 API handler.
// Merges the following six endpoints into one Serverless Function:
//   /api/r2-sign-upload      → /api/r2?action=sign-upload
//   /api/r2-delete            → /api/r2?action=delete
//   /api/r2-metrics           → /api/r2?action=metrics
//   /api/r2-diagnostics       → /api/r2?action=diagnostics
//   /api/r2-validate-project  → /api/r2?action=validate-project
//   /api/r2-verify-object     → /api/r2?action=verify-object

const {
    buildObjectKey,
    buildPresignedUpload,
    buildPublicUrl,
    deleteObjects,
    fetchObjectBytes,
    getCachedR2Metrics,
    getMissingR2EnvVars,
    getObjectHead,
    getR2ConfigErrorPayload,
    getR2Identity,
    getTeacherStorageUsage,
    json,
    listObjectKeysWithPrefix,
    listObjectsGroupedByFolder,
    METRICS_PREFIXES,
    normalizeObjectKey,
    readJsonBody,
    requireAdmin,
    TEACHER_STORAGE_QUOTA_BYTES,
    validateAsset,
    validateR2Config,
    verifyObjectAvailability,
    verifySupabaseUser
} = require('./_lib/r2');
const { inspectZipEntriesWithReader } = require('./_lib/project-upload');

/* ------------------------------------------------------------------ */
/*  Diagnostics helpers (originally in api/r2-diagnostics.js)         */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = 'https://scwvbyfnnufnlimbswnk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_C2V14zNYsM-H5jtRZOQahw_yxdhpV9z';

async function fetchLatestSubmissions(accessToken, limit = 10) {
    const params = new URLSearchParams({
        select: 'id,title,status,category,content_type,storage_provider,thumbnail_path,thumbnail_url,image_url,file_path,file_url,created_at',
        order: 'created_at.desc',
        limit: String(limit)
    });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/submissions?${params.toString()}`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Could not load latest submissions for diagnostics.');
    }

    return response.json();
}

/* ------------------------------------------------------------------ */
/*  Validate-project helpers (originally in api/r2-validate-project.js) */
/* ------------------------------------------------------------------ */

function getExtension(filename = '') {
    const match = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
}

function classifyProject(filename = '', contentType = '') {
    const extension = getExtension(filename);
    const type = String(contentType || '').toLowerCase();

    if (extension === 'zip' || type.includes('zip')) return 'website_project';
    if (extension === 'html' || extension === 'htm' || type === 'text/html') return 'html_project';
    if (extension === 'pdf' || type === 'application/pdf') return 'pdf_document';
    if (extension === 'pptx' || type.includes('presentationml')) return 'presentation_document';
    if (extension === 'doc' || extension === 'docx' || type.includes('word')) return 'word_document';
    return 'project_file';
}

/* ================================================================== */
/*  Action handlers — each preserves the exact behavior of its        */
/*  original endpoint file.                                           */
/* ================================================================== */

/* ---------- sign-upload (from api/r2-sign-upload.js) --------------- */

async function handleSignUpload(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const missingEnvVars = getMissingR2EnvVars();
        if (missingEnvVars.length > 0) {
            return json(res, 500, getR2ConfigErrorPayload(missingEnvVars));
        }

        const { accessToken, user } = await verifySupabaseUser(req);
        const {
            submissionId,
            assetType,
            filename,
            contentType,
            size,
            preflight
        } = await readJsonBody(req);

        if (!submissionId) {
            throw new Error('Missing submissionId.');
        }

        const requestedSize = Number(size) || 0;
        validateAsset({
            assetType,
            contentType,
            size: requestedSize,
            filename
        });

        // Verify remaining 500 MB cloud storage quota for teacher/user
        if (requestedSize > 0) {
            try {
                const storageUsage = await getTeacherStorageUsage(accessToken, user.id);
                if (storageUsage && (storageUsage.usedBytes + requestedSize > TEACHER_STORAGE_QUOTA_BYTES)) {
                    const remainingMb = storageUsage.remainingMb;
                    const fileMb = Number((requestedSize / (1024 * 1024)).toFixed(1));
                    return json(res, 400, {
                        error: `Not enough cloud storage. You have ${remainingMb} MB remaining, but this file is ${fileMb} MB.`,
                        code: 'STORAGE_QUOTA_EXCEEDED',
                        remainingMb,
                        fileMb,
                        maxMb: 500
                    });
                }
            } catch (quotaErr) {
                console.warn('[R2 Sign] Storage quota preflight check warning:', quotaErr);
            }
        }

        if (preflight) {
            return json(res, 200, { ok: true });
        }

        const objectKey = buildObjectKey({
            assetType,
            submissionId,
            userId: user.id,
            filename,
            contentType
        });

        if (assetType === 'project') {
            const extMatch = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/i);
            console.log('[R2 Sign] Project upload request:', {
                originalFilename: filename || null,
                detectedExtension: extMatch?.[1] || 'unknown',
                contentType,
                objectKey
            });
        }

        const { uploadUrl, headers } = buildPresignedUpload({ objectKey, contentType });
        return json(res, 200, {
            uploadUrl,
            headers,
            objectKey,
            publicUrl: buildPublicUrl(objectKey),
            storageProvider: 'r2'
        });
    } catch (error) {
        if (error.code === 'R2_CONFIG_MISSING') {
            return json(res, error.statusCode || 500, getR2ConfigErrorPayload(error.missingEnv));
        }
        return json(res, 400, { error: error.message || 'Could not create upload URL.' });
    }
}

/* ---------- delete (from api/r2-delete.js) ------------------------ */

async function handleDelete(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const body = await readJsonBody(req);
        const keys = Array.isArray(body.keys) ? body.keys : [];
        const prefixes = Array.isArray(body.prefixes) ? body.prefixes : [];
        const submissionId = String(body.submissionId || '').trim();

        if (keys.length === 0 && prefixes.length === 0) {
            return json(res, 200, { deleted: [] });
        }

        let isAdmin = false;
        let userId = null;

        try {
            const adminContext = await requireAdmin(req);
            isAdmin = adminContext.role === 'admin';
            userId = adminContext.user.id;
        } catch (error) {
            const authContext = await verifySupabaseUser(req);
            userId = authContext.user.id;
        }

        if (!isAdmin) {
            const expectedPathFragment = `/${userId}/${submissionId}`;
            const invalidKey = [...keys, ...prefixes].find((key) => !String(key).includes(expectedPathFragment) && !String(key).includes(`${userId}/${submissionId}`));
            if (invalidKey) {
                throw new Error('You are not allowed to delete these files.');
            }
        }

        const expandedPrefixKeys = [];
        for (const prefix of prefixes) {
            expandedPrefixKeys.push(...await listObjectKeysWithPrefix(prefix));
        }

        const result = await deleteObjects([...keys, ...expandedPrefixKeys]);
        return json(res, 200, result);
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not delete files.' });
    }
}

/* ---------- metrics (from api/r2-metrics.js) ---------------------- */

async function handleMetrics(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    const missingEnvVars = validateR2Config({ log: true });
    if (missingEnvVars.length > 0) {
        return json(res, 500, getR2ConfigErrorPayload(missingEnvVars));
    }

    try {
        await requireAdmin(req);
        const forceRefresh = req.query?.refresh === 'true';
        const summary = await getCachedR2Metrics({ forceRefresh });

        console.log('[R2 Metrics] Bucket:', summary.bucket);
        console.log('[R2 Metrics] Prefixes scanned:', METRICS_PREFIXES.join(', '));
        console.log(
            '[R2 Metrics] Object counts per prefix:',
            `images=${summary.breakdown.images.count},`,
            `audio=${summary.breakdown.audio.count},`,
            `projects=${summary.breakdown.projects.count},`,
            `thumbnails=${summary.breakdown.thumbnails.count},`,
            `other=${summary.breakdown.other.count}`
        );
        console.log('[R2 Metrics] Total bytes calculated:', summary.totalBytes);
        console.log('[R2 Metrics] Cache status:', summary.cached ? `hit (${summary.cacheAgeMs} ms old)` : 'miss');

        return json(res, 200, summary);
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not load Cloudflare R2 metrics.' });
    }
}

/* ---------- diagnostics (from api/r2-diagnostics.js) -------------- */

async function handleDiagnostics(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    const missingEnvVars = validateR2Config({ log: true });
    if (missingEnvVars.length > 0) {
        return json(res, 500, getR2ConfigErrorPayload(missingEnvVars));
    }

    try {
        const { accessToken } = await requireAdmin(req);
        const forceRefresh = req.query?.refresh === 'true';
        const [metrics, groupedObjects, latestSubmissions] = await Promise.all([
            getCachedR2Metrics({ forceRefresh }),
            listObjectsGroupedByFolder({ forceRefresh }),
            fetchLatestSubmissions(accessToken, 10)
        ]);
        const identity = getR2Identity();
        const allObjectKeys = Object.values(groupedObjects.groupedKeys).flat().map((entry) => entry.key).sort();

        const latestSubmissionChecks = await Promise.all(
            latestSubmissions.map(async (submission) => {
                const originalKey = submission.file_path || null;
                const thumbnailKey = submission.thumbnail_path || null;
                const original = submission.storage_provider === 'r2' && originalKey
                    ? await verifyObjectAvailability(originalKey)
                    : { exists: false, listed: false };
                const thumbnail = submission.storage_provider === 'r2' && thumbnailKey
                    ? await verifyObjectAvailability(thumbnailKey)
                    : { exists: false, listed: false };

                return {
                    id: submission.id,
                    title: submission.title,
                    status: submission.status,
                    category: submission.category,
                    contentType: submission.content_type,
                    storageProvider: submission.storage_provider || 'supabase-or-legacy',
                    dbRecordPresent: true,
                    originalKey,
                    thumbnailKey,
                    originalObject: original,
                    thumbnailObject: thumbnail,
                    fileUrl: submission.file_url,
                    thumbnailUrl: submission.thumbnail_url,
                    imageUrl: submission.image_url,
                    createdAt: submission.created_at
                };
            })
        );

        return json(res, 200, {
            activeAccountId: identity.activeAccountId,
            activeBucketName: identity.activeBucketName,
            endpointHost: identity.endpointHost,
            publicBaseUrl: identity.publicBaseUrl,
            inferredAccountToken: identity.inferredAccountToken,
            credentialFingerprint: identity.credentialFingerprint,
            bucket: metrics.bucket,
            cached: metrics.cached,
            cacheAgeMs: metrics.cacheAgeMs,
            realR2ObjectCount: metrics.fileCount,
            realR2TotalBytes: metrics.totalBytes,
            firstFiveObjectKeys: allObjectKeys.slice(0, 5),
            lastFiveObjectKeys: allObjectKeys.slice(-5),
            breakdown: metrics.breakdown,
            groupedKeys: groupedObjects.groupedKeys,
            latestSubmissionChecks
        });
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not load R2 diagnostics.' });
    }
}

/* ---------- validate-project (from api/r2-validate-project.js) ---- */

async function handleValidateProject(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    const missingEnvVars = validateR2Config({ log: true });
    if (missingEnvVars.length > 0) {
        return json(res, 500, getR2ConfigErrorPayload(missingEnvVars));
    }

    try {
        const { user } = await verifySupabaseUser(req);
        const body = await readJsonBody(req);
        const objectKey = normalizeObjectKey(body.objectKey);
        const filename = String(body.filename || '').trim();
        const contentType = String(body.contentType || '').trim().toLowerCase();

        if (!objectKey) {
            throw new Error('Missing objectKey.');
        }

        if (!String(objectKey).includes(`/${user.id}/`) && !String(objectKey).includes(`${user.id}/`)) {
            throw new Error('You are not allowed to validate this upload.');
        }

        const projectType = classifyProject(filename, contentType);
        if (projectType !== 'website_project') {
            return json(res, 200, { ok: true, projectType });
        }

        const head = await getObjectHead(objectKey);
        if (!head || !head.contentLength) {
            throw new Error('Upload failed due to a network or storage error. Please try again.');
        }

        const inspection = await inspectZipEntriesWithReader({
            size: head.contentLength,
            readSlice: async (start, endExclusive) => {
                const safeStart = Math.max(0, Number(start) || 0);
                const safeEndExclusive = Math.min(head.contentLength, Number(endExclusive) || head.contentLength);
                if (safeEndExclusive <= safeStart) {
                    return new Uint8Array(0);
                }

                return fetchObjectBytes(objectKey, {
                    start: safeStart,
                    end: safeEndExclusive - 1
                });
            }
        });

        return json(res, 200, {
            ok: true,
            projectType,
            website: {
                fileCount: inspection.fileCount,
                hasIndexHtml: inspection.hasIndexHtml
            }
        });
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not validate project upload.' });
    }
}

/* ---------- verify-object (from api/r2-verify-object.js) ---------- */

async function handleVerifyObject(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    const missingEnvVars = validateR2Config({ log: true });
    if (missingEnvVars.length > 0) {
        return json(res, 500, getR2ConfigErrorPayload(missingEnvVars));
    }

    try {
        await verifySupabaseUser(req);
        const { objectKey } = await readJsonBody(req);
        if (!objectKey) {
            throw new Error('Missing objectKey.');
        }

        const verification = await verifyObjectAvailability(objectKey);
        return json(res, 200, { objectKey, ...verification });
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not verify R2 object.' });
    }
}

/* ---------- teacher-storage -------------------------------------- */

async function handleTeacherStorage(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const { accessToken, user } = await verifySupabaseUser(req);
        const stats = await getTeacherStorageUsage(accessToken, user.id);
        return json(res, 200, {
            usedBytes: stats.usedBytes,
            maxBytes: stats.maxBytes,
            usedMb: stats.usedMb,
            maxMb: stats.maxMb,
            remainingBytes: stats.remainingBytes,
            remainingMb: stats.remainingMb,
            percentage: stats.percentage,
            fileCount: stats.fileCount
        });
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not load teacher storage stats.' });
    }
}

/* ---------- teacher-materials ------------------------------------ */

async function handleTeacherMaterials(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const { accessToken, user } = await verifySupabaseUser(req);
        const stats = await getTeacherStorageUsage(accessToken, user.id);
        return json(res, 200, {
            materials: stats.materials || [],
            storage: {
                usedBytes: stats.usedBytes,
                maxBytes: stats.maxBytes,
                usedMb: stats.usedMb,
                maxMb: stats.maxMb,
                remainingBytes: stats.remainingBytes,
                remainingMb: stats.remainingMb,
                percentage: stats.percentage,
                fileCount: stats.fileCount
            }
        });
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not load teacher cloud materials.' });
    }
}

/* ================================================================== */
/*  Dispatcher                                                        */
/* ================================================================== */

const ACTION_HANDLERS = {
    'sign-upload': handleSignUpload,
    'delete': handleDelete,
    'metrics': handleMetrics,
    'diagnostics': handleDiagnostics,
    'validate-project': handleValidateProject,
    'verify-object': handleVerifyObject,
    'teacher-storage': handleTeacherStorage,
    'teacher-materials': handleTeacherMaterials
};

const VALID_ACTIONS = Object.keys(ACTION_HANDLERS).join(', ');

module.exports = async function handler(req, res) {
    const action = (req.query?.action || '').trim();

    if (!action) {
        return json(res, 400, {
            error: `Missing required "action" query parameter. Valid actions: ${VALID_ACTIONS}`
        });
    }

    const actionHandler = ACTION_HANDLERS[action];
    if (!actionHandler) {
        return json(res, 400, {
            error: `Unknown action: "${action}". Valid actions: ${VALID_ACTIONS}`
        });
    }

    return actionHandler(req, res);
};
