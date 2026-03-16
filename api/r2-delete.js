const {
    deleteObjects,
    json,
    readJsonBody,
    requireAdmin,
    verifySupabaseUser
} = require('./_lib/r2');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const body = await readJsonBody(req);
        const keys = Array.isArray(body.keys) ? body.keys : [];
        const submissionId = String(body.submissionId || '').trim();

        if (keys.length === 0) {
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
            const invalidKey = keys.find((key) => !String(key).includes(expectedPathFragment) && !String(key).includes(`${userId}/${submissionId}`));
            if (invalidKey) {
                throw new Error('You are not allowed to delete these files.');
            }
        }

        const result = await deleteObjects(keys);
        return json(res, 200, result);
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not delete files.' });
    }
};
