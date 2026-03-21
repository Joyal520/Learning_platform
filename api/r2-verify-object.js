const {
    getR2ConfigErrorPayload,
    json,
    readJsonBody,
    validateR2Config,
    verifyObjectAvailability,
    verifySupabaseUser
} = require('./_lib/r2');

module.exports = async function handler(req, res) {
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
};
