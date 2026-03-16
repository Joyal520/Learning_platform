const {
    buildObjectKey,
    buildPresignedUpload,
    buildPublicUrl,
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
        const { user } = await verifySupabaseUser(req);
        const {
            submissionId,
            assetType,
            filename,
            contentType,
            size
        } = await readJsonBody(req);

        if (!submissionId) {
            throw new Error('Missing submissionId.');
        }

        validateAsset({
            assetType,
            contentType,
            size: Number(size)
        });

        const objectKey = buildObjectKey({
            assetType,
            submissionId,
            userId: user.id,
            filename,
            contentType
        });

        const { uploadUrl, headers } = buildPresignedUpload({ objectKey, contentType });
        return json(res, 200, {
            uploadUrl,
            headers,
            objectKey,
            publicUrl: buildPublicUrl(objectKey),
            storageProvider: 'r2'
        });
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not create upload URL.' });
    }
};
