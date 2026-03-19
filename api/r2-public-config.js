const {
    getConfig,
    getR2ConfigErrorPayload,
    json
} = require('./_lib/r2');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const { publicBaseUrl } = getConfig();
        return json(res, 200, { publicBaseUrl });
    } catch (error) {
        if (error.code === 'R2_CONFIG_MISSING') {
            return json(res, error.statusCode || 500, getR2ConfigErrorPayload(error.missingEnv));
        }

        return json(res, 500, { error: error.message || 'Could not load R2 public config.' });
    }
};
