const { Readable } = require('stream');

const {
    buildPublicUrl,
    getConfig,
    getR2ConfigErrorPayload,
    json,
    normalizeObjectKey
} = require('./_lib/r2');

function sanitizeFilename(filename = '') {
    const clean = String(filename || '')
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    return clean || 'download';
}

function isAllowedPublicUrl(rawUrl, publicBaseUrl) {
    if (!rawUrl || !publicBaseUrl) return false;

    try {
        const requested = new URL(rawUrl);
        const allowed = new URL(publicBaseUrl);

        if (requested.origin !== allowed.origin) return false;

        const allowedPath = allowed.pathname.replace(/\/+$/, '');
        return requested.pathname === allowedPath || requested.pathname.startsWith(`${allowedPath}/`);
    } catch (_) {
        return false;
    }
}

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const sourceUrl = req.query?.url;
        const requestedFilename = sanitizeFilename(req.query?.filename || '');
        const { publicBaseUrl } = getConfig();

        if (!sourceUrl) {
            return json(res, 400, { error: 'Missing url query parameter.' });
        }

        if (!isAllowedPublicUrl(sourceUrl, publicBaseUrl)) {
            return json(res, 403, { error: 'Download URL is not allowed.' });
        }

        const objectKey = normalizeObjectKey(sourceUrl);
        if (!objectKey) {
            return json(res, 400, { error: 'Could not resolve the requested object key.' });
        }

        const safePublicUrl = buildPublicUrl(objectKey);
        const upstream = await fetch(safePublicUrl);
        if (!upstream.ok || !upstream.body) {
            return json(res, upstream.status || 502, { error: 'Could not fetch the requested file.' });
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
        const contentLength = upstream.headers.get('content-length');
        const filename = requestedFilename || sanitizeFilename(objectKey.split('/').pop());

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'private, max-age=60');
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        Readable.fromWeb(upstream.body).pipe(res);
    } catch (error) {
        if (error.code === 'R2_CONFIG_MISSING') {
            return json(res, error.statusCode || 500, getR2ConfigErrorPayload(error.missingEnv));
        }

        console.error('[download-file] failed:', error);
        return json(res, 500, { error: error.message || 'Could not download file.' });
    }
};
