const { fetchUrlMetadata } = require('./_lib/url-metadata');

function json(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
    const chunks = [];

    for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) return {};

    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (_) {
        throw new Error('INVALID_JSON');
    }
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    let body;
    try {
        body = await readJsonBody(req);
    } catch (error) {
        return json(res, 400, { error: 'Invalid request body.' });
    }

    try {
        const metadata = await fetchUrlMetadata(body?.url || '');
        return json(res, 200, metadata);
    } catch (error) {
        const message = error?.message === 'Invalid URL' ? 'Invalid URL' : 'Unable to fetch preview';
        const statusCode = message === 'Invalid URL' ? 400 : 422;
        return json(res, statusCode, { error: message });
    }
};
