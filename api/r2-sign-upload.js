const {
    buildObjectKey,
    buildPresignedUpload,
    buildPublicUrl,
    getMissingR2EnvVars,
    getR2ConfigErrorPayload,
    json,
    readJsonBody,
    validateAsset,
    verifySupabaseUser
} = require('./_lib/r2');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const missingEnvVars = getMissingR2EnvVars();
        if (missingEnvVars.length > 0) {
            return json(res, 500, getR2ConfigErrorPayload(missingEnvVars));
        }

        const { user } = await verifySupabaseUser(req);
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

        validateAsset({
            assetType,
            contentType,
            size: Number(size),
            filename
        });

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
};
