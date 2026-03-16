const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const API_DIR = path.join(ROOT_DIR, 'api');
const DEFAULT_PORT = Number(process.env.PORT || 3000);
const REQUIRED_R2_ENV_NAMES = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];

const MIME_TYPES = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.webp': 'image/webp'
};

function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return {};

    const env = {};
    const raw = fs.readFileSync(filePath, 'utf8');

    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const separatorIndex = trimmed.indexOf('=');
        if (separatorIndex === -1) continue;

        const key = trimmed.slice(0, separatorIndex).trim();
        const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
    }

    return env;
}

function applyLocalEnv() {
    const sources = [
        path.join(ROOT_DIR, '.env'),
        path.join(ROOT_DIR, '.env.local'),
        path.join(ROOT_DIR, '.env.txt')
    ];

    const aliasMap = {
        'Access Key ID': 'R2_ACCESS_KEY_ID',
        'Secret Access Key': 'R2_SECRET_ACCESS_KEY',
        'Endpoint': 'R2_ENDPOINT'
    };

    for (const source of sources) {
        const values = parseEnvFile(source);
        for (const [rawKey, rawValue] of Object.entries(values)) {
            const key = aliasMap[rawKey] || rawKey;
            if (!process.env[key]) {
                process.env[key] = rawValue;
            }
        }
    }
}

function listMountedApiRoutes() {
    if (!fs.existsSync(API_DIR)) return [];

    return fs.readdirSync(API_DIR)
        .filter((entry) => entry.endsWith('.js'))
        .map((entry) => `/api/${entry.replace(/\.js$/, '')}`)
        .sort();
}

function getLocalRuntimeStatus() {
    const missingEnvNames = REQUIRED_R2_ENV_NAMES.filter((name) => !process.env[name]);

    return {
        mountedRoutes: listMountedApiRoutes(),
        missingEnvNames,
        runningUrl: `http://localhost:${DEFAULT_PORT}`
    };
}

function logRuntimeStatus() {
    const status = getLocalRuntimeStatus();

    console.log('[DEV SERVER]');
    console.log(`Running on ${status.runningUrl}`);
    console.log(`API routes enabled: ${status.mountedRoutes.length > 0 ? '/api/*' : 'none'}`);
    console.log(`Mounted routes: ${status.mountedRoutes.length > 0 ? status.mountedRoutes.join(', ') : 'none'}`);
    if (status.missingEnvNames.length > 0) {
        console.log(`Missing env variables: ${status.missingEnvNames.join(', ')}`);
    } else {
        console.log('Missing env variables: none');
    }
}

function sendJson(res, statusCode, body) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
}

function resolveSafePath(urlPathname) {
    const decoded = decodeURIComponent(urlPathname);
    const trimmed = decoded === '/' ? '/index.html' : decoded;
    const normalized = path.normalize(trimmed).replace(/^(\.\.[/\\])+/, '');
    return path.join(ROOT_DIR, normalized.replace(/^[/\\]+/, ''));
}

function serveStatic(req, res, pathname) {
    const filePath = resolveSafePath(pathname);

    if (!filePath.startsWith(ROOT_DIR)) {
        sendJson(res, 403, { error: 'Forbidden.' });
        return;
    }

    let targetPath = filePath;
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
        targetPath = path.join(targetPath, 'index.html');
    }

    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
        targetPath = path.join(ROOT_DIR, 'index.html');
    }

    const extension = path.extname(targetPath).toLowerCase();
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    fs.createReadStream(targetPath).pipe(res);
}

async function serveApi(req, res, pathname) {
    const relativePath = pathname.replace(/^\/api\//, '');
    const routePath = path.join(API_DIR, `${relativePath}.js`);

    if (!routePath.startsWith(API_DIR) || !fs.existsSync(routePath)) {
        sendJson(res, 404, { error: 'API route not found.' });
        return;
    }

    try {
        delete require.cache[require.resolve(routePath)];
        const handler = require(routePath);
        req.query = Object.fromEntries(new URL(req.url, `http://${req.headers.host}`).searchParams.entries());
        await handler(req, res);
    } catch (error) {
        console.error(`[dev-server] API error in ${pathname}:`, error);
        if (!res.headersSent) {
            sendJson(res, 500, { error: error.message || 'Local API execution failed.' });
        } else if (!res.writableEnded) {
            res.end();
        }
    }
}

applyLocalEnv();
logRuntimeStatus();

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
        await serveApi(req, res, url.pathname);
        return;
    }

    serveStatic(req, res, url.pathname);
});

server.listen(DEFAULT_PORT, () => {
    console.log(`[DEV SERVER] Ready`);
});
