const MAX_HTML_CONTENT_BYTES = 2 * 1024 * 1024;
const LARGE_HTML_PREVIEW_BYTES = 250 * 1024;
const ZIP_TAIL_SCAN_BYTES = 128 * 1024;

const PROJECT_MIME_BY_EXTENSION = {
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    html: 'text/html',
    htm: 'text/html',
    zip: 'application/zip'
};

const PROJECT_EXTENSIONS = ['.pdf', '.pptx', '.doc', '.docx', '.html', '.htm', '.zip'];
const PROJECT_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/html',
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream'
]);
const PROJECT_ALLOWED_MIME_BY_EXTENSION = {
    pdf: new Set(['', 'application/octet-stream', 'application/pdf']),
    pptx: new Set([
        '',
        'application/octet-stream',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint'
    ]),
    doc: new Set(['', 'application/octet-stream', 'application/msword']),
    docx: new Set(['', 'application/octet-stream', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    html: new Set(['', 'application/octet-stream', 'text/html', 'text/plain']),
    htm: new Set(['', 'application/octet-stream', 'text/html', 'text/plain']),
    zip: new Set(['', 'application/octet-stream', 'application/zip', 'application/x-zip-compressed', 'multipart/x-zip'])
};
const PROJECT_ACCEPT_ATTRIBUTE = [
    ...PROJECT_EXTENSIONS,
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'text/html',
    'application/zip',
    'application/x-zip-compressed',
    'multipart/x-zip',
    'application/octet-stream'
].join(',');

const SAFE_SPECIAL_FILENAMES = new Set([
    'cname',
    'license',
    'license.txt',
    'readme',
    'readme.md',
    'robots.txt',
    '.nojekyll',
    '.well-known'
]);

const SAFE_STATIC_EXTENSIONS = new Set([
    'html',
    'htm',
    'css',
    'js',
    'mjs',
    'json',
    'map',
    'txt',
    'md',
    'xml',
    'svg',
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'avif',
    'ico',
    'bmp',
    'mp3',
    'wav',
    'ogg',
    'm4a',
    'aac',
    'mp4',
    'webm',
    'woff',
    'woff2',
    'ttf',
    'otf',
    'eot',
    'webmanifest'
]);

const DANGEROUS_EXTENSIONS = new Set([
    'php',
    'phtml',
    'phar',
    'exe',
    'dll',
    'bat',
    'cmd',
    'com',
    'msi',
    'ps1',
    'psm1',
    'sh',
    'bash',
    'zsh',
    'ksh',
    'cgi',
    'pl',
    'py',
    'rb',
    'jar',
    'war',
    'class',
    'jsp',
    'jspx',
    'asp',
    'aspx',
    'cer',
    'crt',
    'pem',
    'apk',
    'dmg',
    'iso',
    'vbs',
    'scr'
]);

function getExtension(filename = '') {
    const match = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
}

function normalizeMimeType(contentType = '') {
    return String(contentType || '').trim().toLowerCase();
}

function getProjectUploadDescriptor(filename = '', contentType = '') {
    const extension = getExtension(filename);
    const normalizedType = normalizeMimeType(contentType);

    if (!extension || !PROJECT_MIME_BY_EXTENSION[extension]) {
        return {
            extension,
            normalizedType,
            resolvedMimeType: '',
            isSupported: false
        };
    }

    const allowedMimeTypes = PROJECT_ALLOWED_MIME_BY_EXTENSION[extension];
    if (!allowedMimeTypes?.has(normalizedType)) {
        return {
            extension,
            normalizedType,
            resolvedMimeType: '',
            isSupported: false
        };
    }

    return {
        extension,
        normalizedType,
        resolvedMimeType: PROJECT_MIME_BY_EXTENSION[extension] || '',
        isSupported: true
    };
}

function getProjectMimeType(filename = '', contentType = '') {
    return getProjectUploadDescriptor(filename, contentType).resolvedMimeType;
}

function getProjectTypeLabel(fileOrSubmission = {}) {
    const filename = fileOrSubmission.name || fileOrSubmission.filename || fileOrSubmission.file_path || fileOrSubmission.file_url || '';
    const extension = getExtension(filename);
    const type = normalizeMimeType(fileOrSubmission.type || fileOrSubmission.file_type || fileOrSubmission.mime_type || '');

    if (extension === 'zip' || type.includes('zip')) return 'Website project';
    if (extension === 'html' || extension === 'htm' || type === 'text/html') return 'HTML website project';
    if (extension === 'pdf' || type === 'application/pdf') return 'PDF document';
    if (extension === 'pptx' || type.includes('presentationml')) return 'PowerPoint presentation';
    if (extension === 'doc' || type === 'application/msword') return 'Word document';
    if (extension === 'docx' || type.includes('wordprocessingml')) return 'Word document';
    return 'Project file';
}

function validateProjectFile(file) {
    if (!file) return 'Please select a file to upload.';

    const descriptor = getProjectUploadDescriptor(file.name, file.type);
    if (!descriptor.isSupported || !descriptor.resolvedMimeType) {
        return 'Unsupported file type. Upload PDF, PPTX, DOC, DOCX, HTML, or ZIP files only.';
    }

    return null;
}

function validateHtmlContent(content) {
    const htmlContent = String(content || '');
    if (!htmlContent.trim()) {
        return 'Please paste your HTML content before uploading.';
    }

    const byteLength = new Blob([htmlContent]).size;
    if (byteLength > MAX_HTML_CONTENT_BYTES) {
        return `HTML content too large. Keep pasted HTML under ${(MAX_HTML_CONTENT_BYTES / 1024 / 1024).toFixed(0)} MB.`;
    }

    return null;
}

function shouldPausePreview(content) {
    return new Blob([String(content || '')]).size > LARGE_HTML_PREVIEW_BYTES;
}

function decodeZipFilename(bytes) {
    try {
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch (_) {
        return Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
    }
}

function findEndOfCentralDirectory(bytes) {
    for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
        if (
            bytes[offset] === 0x50 &&
            bytes[offset + 1] === 0x4b &&
            bytes[offset + 2] === 0x05 &&
            bytes[offset + 3] === 0x06
        ) {
            return offset;
        }
    }

    return -1;
}

function parseCentralDirectoryEntries(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const entries = [];
    let offset = 0;

    while (offset < bytes.length) {
        if (offset + 46 > bytes.length || view.getUint32(offset, true) !== 0x02014b50) {
            throw new Error('Invalid zip website structure. The ZIP archive metadata could not be read safely.');
        }

        const filenameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const recordLength = 46 + filenameLength + extraLength + commentLength;
        if (offset + recordLength > bytes.length) {
            throw new Error('Invalid zip website structure. The ZIP archive metadata is incomplete.');
        }

        const filenameBytes = bytes.subarray(offset + 46, offset + 46 + filenameLength);
        const filename = decodeZipFilename(filenameBytes);
        const externalAttributes = view.getUint32(offset + 38, true);
        const isDirectory = filename.endsWith('/') || ((externalAttributes >>> 16) & 0o170000) === 0o040000;

        entries.push({
            filename,
            isDirectory
        });

        offset += recordLength;
    }

    return entries;
}

function normalizeZipEntryPath(filename = '') {
    const normalized = String(filename || '').replace(/\\/g, '/').trim();
    if (!normalized) {
        throw new Error('Invalid zip website structure. The ZIP archive contains an empty file path.');
    }

    if (/[\u0000-\u001f]/.test(normalized)) {
        throw new Error(`Unsafe files detected in zip: "${filename}" contains control characters.`);
    }

    if (/^[a-z]:/i.test(normalized) || normalized.startsWith('/')) {
        throw new Error(`Unsafe files detected in zip: "${filename}" contains an absolute path.`);
    }

    const trimmedPath = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
    const segments = trimmedPath.split('/');
    if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
        throw new Error(`Unsafe files detected in zip: "${filename}" contains an unsafe path.`);
    }

    return trimmedPath;
}

function shouldIgnoreZipEntry(pathname) {
    const lower = pathname.toLowerCase();
    return lower.startsWith('__macosx/') || lower.endsWith('/.ds_store') || lower.endsWith('/thumbs.db') || lower === '.ds_store' || lower === 'thumbs.db';
}

function getZipEntryExtension(pathname = '') {
    const baseName = pathname.split('/').pop() || '';
    return getExtension(baseName);
}

function validateZipEntries(entries = []) {
    const normalizedEntries = [];

    for (const entry of entries) {
        const safePath = normalizeZipEntryPath(entry.filename);
        if (shouldIgnoreZipEntry(safePath)) {
            continue;
        }

        if (entry.isDirectory) {
            normalizedEntries.push({ ...entry, safePath, isDirectory: true });
            continue;
        }

        const baseName = safePath.split('/').pop() || '';
        const lowerBaseName = baseName.toLowerCase();
        const extension = getZipEntryExtension(safePath);

        if (DANGEROUS_EXTENSIONS.has(extension)) {
            throw new Error(`Unsafe files detected in zip: "${safePath}" is not allowed in website uploads.`);
        }

        if (extension && !SAFE_STATIC_EXTENSIONS.has(extension)) {
            throw new Error(`Unsafe files detected in zip: "${safePath}" is not a supported static website asset.`);
        }

        if (!extension && !SAFE_SPECIAL_FILENAMES.has(lowerBaseName)) {
            throw new Error(`Invalid zip website structure. "${safePath}" must use a supported static file type.`);
        }

        normalizedEntries.push({ ...entry, safePath, isDirectory: false });
    }

    const fileEntries = normalizedEntries.filter((entry) => !entry.isDirectory);
    if (fileEntries.length === 0) {
        throw new Error('Invalid zip website structure. The ZIP archive does not contain any website files.');
    }

    const hasIndexHtml = fileEntries.some((entry) => entry.safePath.split('/').pop()?.toLowerCase() === 'index.html');
    if (!hasIndexHtml) {
        throw new Error('Invalid zip website structure. Include an index.html file in the website bundle.');
    }

    return {
        fileCount: fileEntries.length,
        hasIndexHtml: true,
        entries: normalizedEntries
    };
}

async function readFileSlice(file, start, endExclusive) {
    const safeStart = Math.max(0, start);
    const safeEnd = Math.min(file.size, endExclusive);
    if (safeEnd <= safeStart) {
        return new Uint8Array(0);
    }

    return new Uint8Array(await file.slice(safeStart, safeEnd).arrayBuffer());
}

async function inspectZipWebsite(file) {
    const tailStart = Math.max(0, file.size - ZIP_TAIL_SCAN_BYTES);
    const tailBytes = await readFileSlice(file, tailStart, file.size);
    const eocdOffset = findEndOfCentralDirectory(tailBytes);

    if (eocdOffset < 0) {
        throw new Error('Invalid zip website structure. The ZIP archive footer is missing or corrupted.');
    }

    const tailView = new DataView(tailBytes.buffer, tailBytes.byteOffset, tailBytes.byteLength);
    const centralDirectorySize = tailView.getUint32(eocdOffset + 12, true);
    const centralDirectoryOffset = tailView.getUint32(eocdOffset + 16, true);

    if (centralDirectorySize === 0 || centralDirectoryOffset === 0xffffffff || centralDirectorySize === 0xffffffff) {
        throw new Error('Invalid zip website structure. The ZIP archive uses an unsupported directory format.');
    }

    let centralDirectoryBytes;
    if (centralDirectoryOffset >= tailStart && centralDirectoryOffset + centralDirectorySize <= file.size) {
        const relativeStart = centralDirectoryOffset - tailStart;
        centralDirectoryBytes = tailBytes.subarray(relativeStart, relativeStart + centralDirectorySize);
    } else {
        centralDirectoryBytes = await readFileSlice(file, centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize);
    }

    const entries = parseCentralDirectoryEntries(centralDirectoryBytes);
    return validateZipEntries(entries);
}

export const ProjectUpload = {
    LARGE_HTML_PREVIEW_BYTES,
    MAX_HTML_CONTENT_BYTES,
    PROJECT_ACCEPT_ATTRIBUTE,
    PROJECT_EXTENSIONS,
    PROJECT_MIME_TYPES,
    getProjectMimeType,
    getProjectUploadDescriptor,
    getProjectTypeLabel,
    inspectZipWebsite,
    shouldPausePreview,
    validateHtmlContent,
    validateProjectFile
};
