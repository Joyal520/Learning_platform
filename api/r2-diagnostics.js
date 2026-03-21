const {
    getCachedR2Metrics,
    getR2ConfigErrorPayload,
    json,
    listObjectsGroupedByFolder,
    requireAdmin,
    getR2Identity,
    validateR2Config,
    verifyObjectAvailability
} = require('./_lib/r2');

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

module.exports = async function handler(req, res) {
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
};
