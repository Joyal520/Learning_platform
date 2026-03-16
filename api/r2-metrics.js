const {
    getCachedR2Metrics,
    json,
    METRICS_PREFIXES,
    requireAdmin,
    validateR2Config
} = require('./_lib/r2');

// Vercel-style serverless route. In local development this is executed by dev-server.js.
module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    const missingEnvVars = validateR2Config({ log: true });
    if (missingEnvVars.length > 0) {
        return json(res, 500, { error: `${missingEnvVars[0]} environment variable not configured` });
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
};
