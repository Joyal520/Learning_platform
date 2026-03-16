const crypto = require('crypto');

const SUPABASE_URL = 'https://scwvbyfnnufnlimbswnk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_C2V14zNYsM-H5jtRZOQahw_yxdhpV9z';
const R2_SIGNED_URL_TTL_SECONDS = 900;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const AUDIO_TYPES = new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac'
]);
const PROJECT_TYPES = new Set([
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed',
    'application/json',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);

const MAX_SIZE_BY_ASSET = {
    image: 15 * 1024 * 1024,
    thumbnail: 10 * 1024 * 1024,
    display: 15 * 1024 * 1024,
    audio: 50 * 1024 * 1024,
    project: 50 * 1024 * 1024
};

const REQUIRED_R2_ENV_NAMES = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const METRICS_PREFIXES = ['images/', 'audio/', 'projects/', 'thumbnails/', 'thumbs/'];
const R2_METRICS_CACHE_TTL_MS = 45000;
const r2MetricsCache = {
    expiresAt: 0,
    objects: null,
    summary: null
};

function getMissingR2EnvVars() {
    return REQUIRED_R2_ENV_NAMES.filter((name) => !process.env[name]);
}

let hasLoggedMissingR2Env = false;

function validateR2Config({ log = false } = {}) {
    const missing = getMissingR2EnvVars();

    if (log && missing.length > 0 && !hasLoggedMissingR2Env) {
        hasLoggedMissingR2Env = true;
        console.error(`[R2] Missing required environment variables: ${missing.join(', ')}`);
    }

    return missing;
}

function clearR2MetricsCache() {
    r2MetricsCache.expiresAt = 0;
    r2MetricsCache.objects = null;
    r2MetricsCache.summary = null;
}

function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`${name} environment variable not configured`);
    }
    return value;
}

function getConfig() {
    const endpoint = getRequiredEnv('R2_ENDPOINT').replace(/\/+$/, '');
    const publicBaseUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, '');
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim() || process.env.R2_ACCOUNT_ID?.trim() || null;

    return {
        accountId,
        accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
        endpoint,
        bucket: getRequiredEnv('R2_BUCKET'),
        publicBaseUrl
    };
}

function json(res, statusCode, body) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            if (!raw) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(new Error('Invalid JSON body.'));
            }
        });
        req.on('error', reject);
    });
}

async function verifySupabaseUser(req) {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        throw new Error('Missing Supabase access token.');
    }

    const accessToken = match[1];
    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!userResponse.ok) {
        throw new Error('Invalid or expired Supabase session.');
    }

    const user = await userResponse.json();
    return { accessToken, user };
}

async function getSupabaseProfileRole(accessToken, userId) {
    const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`;
    const response = await fetch(url, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        throw new Error('Could not verify admin permissions.');
    }

    const rows = await response.json();
    return rows?.[0]?.role || null;
}

async function requireAdmin(req) {
    const { accessToken, user } = await verifySupabaseUser(req);
    const role = await getSupabaseProfileRole(accessToken, user.id);
    if (role !== 'admin') {
        throw new Error('Admin access is required for this action.');
    }
    return { accessToken, user, role };
}

function sha256Hex(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
    return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function formatAmzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getDateStamp(amzDate) {
    return amzDate.slice(0, 8);
}

function getSigningKey(secretAccessKey, dateStamp) {
    const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, 'auto');
    const kService = hmac(kRegion, 's3');
    return hmac(kService, 'aws4_request');
}

function normalizeObjectKey(keyOrUrl) {
    if (!keyOrUrl) return null;

    const trimmed = String(keyOrUrl).trim();
    if (!trimmed) return null;

    if (!/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/^\/+/, '');
    }

    const { bucket, publicBaseUrl } = getConfig();
    const url = new URL(trimmed);

    if (publicBaseUrl && trimmed.startsWith(publicBaseUrl)) {
        return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    }

    const path = decodeURIComponent(url.pathname || '');
    const bucketMarker = `/${bucket}/`;
    const bucketIndex = path.indexOf(bucketMarker);
    if (bucketIndex >= 0) {
        return path.slice(bucketIndex + bucketMarker.length).replace(/^\/+/, '');
    }

    return path.replace(/^\/+/, '');
}

function sanitizeSegment(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function inferExtension(filename = '', contentType = '') {
    const lower = filename.toLowerCase();
    if (lower.includes('.')) {
        return sanitizeSegment(lower.split('.').pop()) || 'bin';
    }

    if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    if (contentType.includes('pdf')) return 'pdf';
    if (contentType.includes('plain')) return 'txt';
    if (contentType.includes('zip')) return 'zip';
    if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
    if (contentType.includes('wav')) return 'wav';
    if (contentType.includes('ogg')) return 'ogg';
    if (contentType.includes('mp4')) return 'mp4';
    if (contentType.includes('json')) return 'json';
    return 'bin';
}

function validateAsset({ assetType, contentType, size }) {
    const maxSize = MAX_SIZE_BY_ASSET[assetType];
    if (!maxSize) {
        throw new Error(`Unsupported asset type: ${assetType}`);
    }

    if (!contentType) {
        throw new Error('Missing file content type.');
    }

    if (!Number.isFinite(size) || size <= 0) {
        throw new Error('Missing or invalid file size.');
    }

    if (size > maxSize) {
        throw new Error(`File exceeds the ${(maxSize / 1024 / 1024).toFixed(0)} MB limit for ${assetType} uploads.`);
    }

    if ((assetType === 'image' || assetType === 'thumbnail' || assetType === 'display') && !IMAGE_TYPES.has(contentType)) {
        throw new Error('Unsupported image type. Use JPG, PNG, or WEBP.');
    }

    if (assetType === 'audio' && !AUDIO_TYPES.has(contentType)) {
        throw new Error('Unsupported audio type. Use MP3, WAV, OGG, WEBM, AAC, or M4A.');
    }

    if (assetType === 'project' && !(PROJECT_TYPES.has(contentType) || AUDIO_TYPES.has(contentType))) {
        throw new Error('Unsupported file type. Use PDF, TXT, ZIP, DOCX, PPTX, JSON, CSV, or supported audio.');
    }
}

function buildObjectKey({ assetType, submissionId, userId, filename, contentType }) {
    const ext = inferExtension(filename, contentType);
    const cleanUserId = sanitizeSegment(userId);
    const cleanSubmissionId = sanitizeSegment(submissionId);

    switch (assetType) {
        case 'thumbnail':
            return `thumbnails/${cleanUserId}/${cleanSubmissionId}.webp`;
        case 'display':
            return `images/${cleanUserId}/${cleanSubmissionId}.webp`;
        case 'image':
            return `images/${cleanUserId}/${cleanSubmissionId}-source.${ext}`;
        case 'audio':
            return `audio/${cleanUserId}/${cleanSubmissionId}.${ext}`;
        case 'project':
            return `projects/${cleanUserId}/${cleanSubmissionId}.${ext}`;
        default:
            throw new Error(`Unsupported asset type: ${assetType}`);
    }
}

function buildPublicUrl(objectKey) {
    const { publicBaseUrl } = getConfig();
    if (!publicBaseUrl) {
        throw new Error('Missing required environment variable: R2_PUBLIC_URL');
    }
    return `${publicBaseUrl}/${objectKey}`;
}

function encodeRfc3986(value) {
    return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildCanonicalPath(bucket, objectKey) {
    return `/${bucket}/${objectKey.split('/').map(encodeRfc3986).join('/')}`;
}

function buildPresignedUpload({ objectKey, contentType }) {
    const { accessKeyId, secretAccessKey, endpoint, bucket } = getConfig();
    const url = new URL(endpoint);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = getDateStamp(amzDate);
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const canonicalUri = buildCanonicalPath(bucket, objectKey);

    const queryEntries = [
        ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
        ['X-Amz-Credential', `${accessKeyId}/${credentialScope}`],
        ['X-Amz-Date', amzDate],
        ['X-Amz-Expires', String(R2_SIGNED_URL_TTL_SECONDS)],
        ['X-Amz-SignedHeaders', 'content-type;host']
    ];

    const canonicalQueryString = queryEntries
        .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
        .join('&');

    const canonicalHeaders = `content-type:${contentType}\nhost:${url.host}\n`;
    const canonicalRequest = [
        'PUT',
        canonicalUri,
        canonicalQueryString,
        canonicalHeaders,
        'content-type;host',
        'UNSIGNED-PAYLOAD'
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest)
    ].join('\n');

    const signingKey = getSigningKey(secretAccessKey, dateStamp);
    const signature = hmac(signingKey, stringToSign, 'hex');
    const presignedUrl = `${endpoint}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    return {
        uploadUrl: presignedUrl,
        headers: { 'Content-Type': contentType }
    };
}

function signRequest({ method, objectKey = '', queryString = '', body = '', contentType = '' }) {
    const { accessKeyId, secretAccessKey, endpoint, bucket } = getConfig();
    const url = new URL(endpoint);
    const now = new Date();
    const amzDate = formatAmzDate(now);
    const dateStamp = getDateStamp(amzDate);
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const canonicalUri = objectKey ? buildCanonicalPath(bucket, objectKey) : `/${bucket}`;
    const payloadHash = sha256Hex(body);

    const headers = {
        host: url.host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate
    };

    if (contentType) {
        headers['content-type'] = contentType;
    }

    const sortedHeaderEntries = Object.entries(headers).sort(([a], [b]) => a.localeCompare(b));
    const canonicalHeaders = sortedHeaderEntries.map(([key, value]) => `${key}:${value}\n`).join('');
    const signedHeaders = sortedHeaderEntries.map(([key]) => key).join(';');
    const canonicalRequest = [
        method,
        canonicalUri,
        queryString,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest)
    ].join('\n');

    const signingKey = getSigningKey(secretAccessKey, dateStamp);
    const signature = hmac(signingKey, stringToSign, 'hex');
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
        endpoint,
        bucket,
        headers: {
            ...headers,
            Authorization: authorization
        }
    };
}

async function deleteObjects(keys) {
    const normalizedKeys = Array.from(
        new Set(
            keys
                .map(normalizeObjectKey)
                .filter(Boolean)
        )
    );

    if (normalizedKeys.length === 0) {
        return { deleted: [] };
    }

    const body = [
        '<Delete>',
        ...normalizedKeys.map((key) => `<Object><Key>${key}</Key></Object>`),
        '</Delete>'
    ].join('');

    const queryString = 'delete=';
    const signed = signRequest({
        method: 'POST',
        queryString,
        body,
        contentType: 'application/xml'
    });

    const response = await fetch(`${signed.endpoint}/${signed.bucket}?${queryString}`, {
        method: 'POST',
        headers: signed.headers,
        body
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`R2 delete failed: ${response.status} ${errorText}`);
    }

    return { deleted: normalizedKeys };
}

function parseTagValues(xml, tagName) {
    const regex = new RegExp(`<${tagName}>(.*?)</${tagName}>`, 'g');
    const values = [];
    let match;
    while ((match = regex.exec(xml)) !== null) {
        values.push(match[1]);
    }
    return values;
}

async function listAllObjects() {
    const allObjects = [];
    let continuationToken = null;

    while (true) {
        const params = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
        if (continuationToken) {
            params.set('continuation-token', continuationToken);
        }

        const queryString = params.toString();
        const signed = signRequest({ method: 'GET', queryString });
        const response = await fetch(`${signed.endpoint}/${signed.bucket}?${queryString}`, {
            method: 'GET',
            headers: signed.headers
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`R2 list failed: ${response.status} ${errorText}`);
        }

        const xml = await response.text();
        const keys = parseTagValues(xml, 'Key');
        const sizes = parseTagValues(xml, 'Size').map((value) => Number(value) || 0);

        keys.forEach((key, index) => {
            allObjects.push({ key, size: sizes[index] || 0 });
        });

        const isTruncated = parseTagValues(xml, 'IsTruncated')[0] === 'true';
        continuationToken = parseTagValues(xml, 'NextContinuationToken')[0] || null;

        if (!isTruncated || !continuationToken) {
            break;
        }
    }

    return allObjects;
}

async function getCachedR2Metrics({ forceRefresh = false } = {}) {
    const now = Date.now();
    if (!forceRefresh && r2MetricsCache.summary && r2MetricsCache.expiresAt > now) {
        return {
            ...r2MetricsCache.summary,
            cached: true,
            cacheAgeMs: R2_METRICS_CACHE_TTL_MS - (r2MetricsCache.expiresAt - now)
        };
    }

    const objects = await listAllObjects();
    const summary = summarizeObjects(objects);
    r2MetricsCache.expiresAt = now + R2_METRICS_CACHE_TTL_MS;
    r2MetricsCache.objects = objects;
    r2MetricsCache.summary = summary;

    return {
        ...summary,
        cached: false,
        cacheAgeMs: 0
    };
}

function redactValue(value, { head = 4, tail = 4 } = {}) {
    if (!value) return null;
    if (value.length <= head + tail) return `${value.slice(0, 1)}***`;
    return `${value.slice(0, head)}...${value.slice(-tail)}`;
}

function fingerprintValue(value) {
    if (!value) return null;
    return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function getR2Identity() {
    const config = getConfig();
    const endpointUrl = new URL(config.endpoint);
    const endpointHost = endpointUrl.host;
    const inferredAccountToken = endpointHost.split('.')[0] || null;

    return {
        activeAccountId: config.accountId,
        activeBucketName: config.bucket,
        endpointHost,
        publicBaseUrl: config.publicBaseUrl || null,
        inferredAccountToken,
        credentialFingerprint: {
            accessKeyId: redactValue(config.accessKeyId),
            accessKeyFingerprint: fingerprintValue(config.accessKeyId),
            secretFingerprint: fingerprintValue(config.secretAccessKey),
            endpointFingerprint: fingerprintValue(config.endpoint),
            bucketFingerprint: fingerprintValue(config.bucket),
            publicBaseUrlFingerprint: fingerprintValue(config.publicBaseUrl || ''),
            accountFingerprint: fingerprintValue(config.accountId || inferredAccountToken || '')
        }
    };
}

async function doesObjectExist(objectKey) {
    if (!objectKey) return false;

    const signed = signRequest({ method: 'HEAD', objectKey });
    const response = await fetch(`${signed.endpoint}/${signed.bucket}/${objectKey.split('/').map(encodeRfc3986).join('/')}`, {
        method: 'HEAD',
        headers: signed.headers
    });

    if (response.status === 404) {
        return false;
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`R2 head failed: ${response.status} ${errorText}`.trim());
    }

    return true;
}

async function verifyObjectAvailability(objectKey) {
    const exists = await doesObjectExist(objectKey);
    if (!exists) {
        return { exists: false, listed: false };
    }

    const objects = r2MetricsCache.objects && r2MetricsCache.expiresAt > Date.now()
        ? r2MetricsCache.objects
        : await listAllObjects();

    const listed = objects.some((object) => object.key === objectKey);
    if (!r2MetricsCache.objects || r2MetricsCache.expiresAt <= Date.now()) {
        r2MetricsCache.objects = objects;
        r2MetricsCache.summary = summarizeObjects(objects);
        r2MetricsCache.expiresAt = Date.now() + R2_METRICS_CACHE_TTL_MS;
    }

    return { exists: true, listed };
}

function groupObjectsByFolder(objects) {
    return objects.reduce((acc, object) => {
        const key = object.key || '';
        const folder = key.includes('/') ? key.split('/')[0] : 'root';
        if (!acc[folder]) {
            acc[folder] = [];
        }
        acc[folder].push({ key, size: object.size || 0 });
        return acc;
    }, {});
}

async function listObjectsGroupedByFolder({ forceRefresh = false } = {}) {
    const metrics = await getCachedR2Metrics({ forceRefresh });
    const objects = forceRefresh || !r2MetricsCache.objects ? await listAllObjects() : r2MetricsCache.objects;
    return {
        bucket: metrics.bucket,
        totalBytes: metrics.totalBytes,
        fileCount: metrics.fileCount,
        groupedKeys: groupObjectsByFolder(objects)
    };
}

function summarizeObjects(objects) {
    const breakdown = {
        images: { bytes: 0, count: 0 },
        thumbnails: { bytes: 0, count: 0 },
        audio: { bytes: 0, count: 0 },
        projects: { bytes: 0, count: 0 },
        other: { bytes: 0, count: 0 }
    };

    let totalBytes = 0;
    for (const object of objects) {
        totalBytes += object.size;

        const key = object.key || '';
        const bucketKey =
            key.startsWith('images/') ? 'images' :
            (key.startsWith('thumbnails/') || key.startsWith('thumbs/')) ? 'thumbnails' :
            key.startsWith('audio/') ? 'audio' :
            key.startsWith('projects/') ? 'projects' :
            'other';

        breakdown[bucketKey].bytes += object.size;
        breakdown[bucketKey].count += 1;
    }

    return {
        bucket: getConfig().bucket,
        prefixesScanned: METRICS_PREFIXES,
        totalBytes,
        fileCount: objects.length,
        breakdown
    };
}

validateR2Config({ log: true });

module.exports = {
    buildObjectKey,
    buildPresignedUpload,
    buildPublicUrl,
    clearR2MetricsCache,
    deleteObjects,
    doesObjectExist,
    getConfig,
    getCachedR2Metrics,
    getMissingR2EnvVars,
    getR2Identity,
    groupObjectsByFolder,
    json,
    listAllObjects,
    listObjectsGroupedByFolder,
    METRICS_PREFIXES,
    normalizeObjectKey,
    readJsonBody,
    requireAdmin,
    summarizeObjects,
    validateR2Config,
    validateAsset,
    verifyObjectAvailability,
    verifySupabaseUser
};
