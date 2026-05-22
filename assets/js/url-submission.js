const TRUSTED_HOST_SUFFIXES = ['github.io', 'vercel.app', 'netlify.app'];

function collapseWhitespace(value = '') {
    return String(value || '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripHtmlTags(value = '') {
    return String(value || '').replace(/<[^>]*>/g, ' ');
}

function sanitizeText(value = '', maxLength = 280) {
    return collapseWhitespace(stripHtmlTags(value)).slice(0, maxLength);
}

function isLoopbackOrLocalHostname(hostname = '') {
    const normalized = String(hostname || '').trim().toLowerCase();
    return normalized === 'localhost'
        || normalized.endsWith('.localhost')
        || normalized === '127.0.0.1'
        || normalized.startsWith('127.')
        || normalized === '::1';
}

function isPrivateIpv4(hostname = '') {
    const match = String(hostname || '').trim().match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return false;

    const octets = match.slice(1).map((part) => Number(part));
    if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }

    const [first, second] = octets;
    return first === 10
        || first === 127
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168);
}

function isTrustedProjectHost(hostname = '') {
    const normalized = String(hostname || '').trim().toLowerCase();
    return TRUSTED_HOST_SUFFIXES.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

export function normalizeProjectUrl(input = '') {
    const raw = String(input || '').trim();
    if (!raw) return '';

    try {
        return new URL(raw).toString();
    } catch (_) {
        return '';
    }
}

export function validateProjectUrl(input = '', { trustedDomainsOnly = false } = {}) {
    const normalizedUrl = normalizeProjectUrl(input);
    if (!normalizedUrl) {
        return { valid: false, error: 'Invalid URL' };
    }

    try {
        const parsedUrl = new URL(normalizedUrl);
        const hostname = parsedUrl.hostname.toLowerCase();

        if (parsedUrl.protocol !== 'https:') {
            return { valid: false, error: 'Invalid URL' };
        }

        if (!hostname || isLoopbackOrLocalHostname(hostname) || isPrivateIpv4(hostname)) {
            return { valid: false, error: 'Invalid URL' };
        }

        if (trustedDomainsOnly && !isTrustedProjectHost(hostname)) {
            return { valid: false, error: 'Invalid URL' };
        }

        return {
            valid: true,
            hostname,
            isTrustedHost: isTrustedProjectHost(hostname),
            normalizedUrl: parsedUrl.toString()
        };
    } catch (_) {
        return { valid: false, error: 'Invalid URL' };
    }
}

export function sanitizeProjectPreviewImage(input = '') {
    const validation = validateProjectUrl(input);
    return validation.valid ? validation.normalizedUrl : '';
}

export function sanitizeProjectMetadata(metadata = {}) {
    return {
        title: sanitizeText(metadata.title || '', 120),
        description: sanitizeText(metadata.description || '', 280),
        previewImage: sanitizeProjectPreviewImage(
            metadata.previewImage || metadata.preview_image || metadata.image || ''
        )
    };
}

export function sanitizeProjectTitle(input = '') {
    return sanitizeText(input, 120);
}

export function sanitizeProjectDescription(input = '') {
    return sanitizeText(input, 280);
}
