export function getAppBasePath() {
    const pathname = String(window.location.pathname || '/');
    if (!pathname || pathname === '/') return '/';

    if (pathname.endsWith('/')) {
        return pathname;
    }

    const lastSlashIndex = pathname.lastIndexOf('/');
    if (lastSlashIndex <= 0) return '/';
    return pathname.slice(0, lastSlashIndex + 1);
}

export function buildAppPath(path = '') {
    const raw = String(path || '').trim();
    if (!raw) return getAppBasePath();
    if (/^(?:https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw;

    const basePath = getAppBasePath();
    const normalized = raw.replace(/^\/+/, '');
    const joined = `${basePath}${normalized}`.replace(/\/{2,}/g, '/');
    return joined.startsWith('/') ? joined : `/${joined}`;
}

export function buildAppUrl(path = '') {
    const resolvedPath = buildAppPath(path);
    if (/^(?:https?:)?\/\//i.test(resolvedPath) || resolvedPath.startsWith('data:')) {
        return resolvedPath;
    }

    return new URL(resolvedPath, window.location.origin).toString();
}

export function logAppRuntime(label = 'runtime') {
}
