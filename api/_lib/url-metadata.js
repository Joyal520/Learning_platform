const dns = require('dns').promises;
const net = require('net');

const MAX_HTML_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 8000;

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

function isLoopbackHostname(hostname = '') {
    const normalized = String(hostname || '').trim().toLowerCase();
    return normalized === 'localhost'
        || normalized.endsWith('.localhost')
        || normalized === '127.0.0.1'
        || normalized.startsWith('127.')
        || normalized === '::1';
}

function isPrivateIpv4(address = '') {
    const match = String(address || '').trim().match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
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

function isPrivateIpv6(address = '') {
    const normalized = String(address || '').trim().toLowerCase();
    return normalized === '::1'
        || normalized.startsWith('fc')
        || normalized.startsWith('fd')
        || normalized.startsWith('fe80:');
}

function isPrivateAddress(address = '') {
    const family = net.isIP(address);
    if (family === 4) return isPrivateIpv4(address);
    if (family === 6) return isPrivateIpv6(address);
    return false;
}

function normalizeUrlInput(rawUrl = '') {
    const value = String(rawUrl || '').trim();
    if (!value) {
        throw new Error('Invalid URL');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(value);
    } catch (_) {
        throw new Error('Invalid URL');
    }

    if (parsedUrl.protocol !== 'https:') {
        throw new Error('Invalid URL');
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (!hostname || isLoopbackHostname(hostname) || isPrivateAddress(hostname)) {
        throw new Error('Invalid URL');
    }

    return parsedUrl;
}

async function assertPublicHostname(parsedUrl) {
    const hostname = parsedUrl.hostname.toLowerCase();

    if (net.isIP(hostname)) {
        if (isPrivateAddress(hostname)) {
            throw new Error('Invalid URL');
        }
        return;
    }

    let records;
    try {
        records = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch (_) {
        throw new Error('Unable to fetch preview');
    }

    if (!Array.isArray(records) || records.length === 0) {
        throw new Error('Unable to fetch preview');
    }

    if (records.some((record) => isPrivateAddress(record.address))) {
        throw new Error('Invalid URL');
    }
}

async function readHtmlSnippet(response) {
    if (!response.body || typeof response.body.getReader !== 'function') {
        return '';
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const chunks = [];
    let totalBytes = 0;

    try {
        while (totalBytes < MAX_HTML_BYTES) {
            const { done, value } = await reader.read();
            if (done || !value) break;

            const remaining = MAX_HTML_BYTES - totalBytes;
            const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
            chunks.push(chunk);
            totalBytes += chunk.byteLength;

            if (value.byteLength > remaining) {
                break;
            }
        }
    } finally {
        try {
            await reader.cancel();
        } catch (_) {
            // Ignore best-effort stream cancellation errors.
        }
    }

    return chunks.map((chunk, index) => decoder.decode(chunk, { stream: index < chunks.length - 1 })).join('');
}

function decodeHtmlEntities(value = '') {
    return String(value || '')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>');
}

function extractMetaContent(html = '', selectors = []) {
    for (const selector of selectors) {
        const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
            new RegExp(`<meta[^>]+property=["']${escapedSelector}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapedSelector}["'][^>]*>`, 'i'),
            new RegExp(`<meta[^>]+name=["']${escapedSelector}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
            new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapedSelector}["'][^>]*>`, 'i')
        ];

        for (const pattern of patterns) {
            const match = html.match(pattern);
            if (match?.[1]) {
                return decodeHtmlEntities(match[1]);
            }
        }
    }

    return '';
}

function extractTitleTag(html = '') {
    const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    return match?.[1] ? decodeHtmlEntities(match[1]) : '';
}

function normalizePreviewImageUrl(value = '', baseUrl = '') {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
        const parsed = new URL(raw, baseUrl || undefined);
        if (parsed.protocol !== 'https:' || isLoopbackHostname(parsed.hostname) || isPrivateAddress(parsed.hostname)) {
            return '';
        }
        return parsed.toString();
    } catch (_) {
        return '';
    }
}

function buildHostFallbackTitle(urlString = '') {
    try {
        const hostname = new URL(urlString).hostname.replace(/^www\./i, '');
        return sanitizeText(hostname, 120);
    } catch (_) {
        return '';
    }
}

function extractUrlMetadata(html = '', finalUrl = '') {
    const title = sanitizeText(
        extractMetaContent(html, ['og:title', 'twitter:title'])
        || extractTitleTag(html)
        || buildHostFallbackTitle(finalUrl),
        120
    );
    const description = sanitizeText(
        extractMetaContent(html, ['og:description', 'description', 'twitter:description']),
        280
    );
    const previewImage = normalizePreviewImageUrl(
        extractMetaContent(html, ['og:image', 'twitter:image']),
        finalUrl
    );

    return {
        title,
        description,
        previewImage
    };
}

async function fetchUrlMetadata(rawUrl = '') {
    const parsedUrl = normalizeUrlInput(rawUrl);
    await assertPublicHostname(parsedUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(parsedUrl.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'user-agent': 'EDTECHRA URL metadata fetcher',
                accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1'
            }
        });

        if (!response.ok) {
            throw new Error('Unable to fetch preview');
        }

        const html = await readHtmlSnippet(response);
        const finalUrl = normalizeUrlInput(response.url || parsedUrl.toString()).toString();
        const metadata = extractUrlMetadata(html, finalUrl);

        return {
            url: finalUrl,
            title: metadata.title,
            description: metadata.description,
            previewImage: metadata.previewImage
        };
    } catch (error) {
        if (error?.message === 'Invalid URL' || error?.message === 'Unable to fetch preview') {
            throw error;
        }

        throw new Error('Unable to fetch preview');
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = {
    fetchUrlMetadata
};
