const ZIP_TAIL_SCAN_BYTES = 128 * 1024;
const MAX_WEBSITE_FILE_COUNT = 500;
const MAX_WEBSITE_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_WEBSITE_SINGLE_FILE_BYTES = 20 * 1024 * 1024;

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

function decodeZipFilename(bytes) {
    return Buffer.from(bytes).toString('utf8');
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
        const compressedSize = view.getUint32(offset + 20, true);
        const uncompressedSize = view.getUint32(offset + 24, true);
        const unixMode = (externalAttributes >>> 16) & 0xffff;
        const fileType = unixMode & 0o170000;
        const isDirectory = filename.endsWith('/') || fileType === 0o040000;
        const isSymlink = fileType === 0o120000;

        entries.push({
            filename,
            isDirectory,
            isSymlink,
            compressedSize,
            uncompressedSize
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

function buildWebsiteHostingPlan(entries = []) {
    const normalizedEntries = [];
    let totalUncompressedBytes = 0;

    for (const entry of entries) {
        const safePath = normalizeZipEntryPath(entry.filename);
        if (shouldIgnoreZipEntry(safePath)) {
            continue;
        }

        if (entry.isDirectory) {
            normalizedEntries.push({ ...entry, safePath, isDirectory: true });
            continue;
        }

        if (entry.isSymlink) {
            throw new Error(`Unsafe files detected in zip: "${safePath}" uses a symbolic link and cannot be hosted.`);
        }

        const baseName = safePath.split('/').pop() || '';
        const lowerBaseName = baseName.toLowerCase();
        const extension = getExtension(baseName);

        if (DANGEROUS_EXTENSIONS.has(extension)) {
            throw new Error(`Unsafe files detected in zip: "${safePath}" is not allowed in website uploads.`);
        }

        if (extension && !SAFE_STATIC_EXTENSIONS.has(extension)) {
            throw new Error(`Unsafe files detected in zip: "${safePath}" is not a supported static website asset.`);
        }

        if (!extension && !SAFE_SPECIAL_FILENAMES.has(lowerBaseName)) {
            throw new Error(`Invalid zip website structure. "${safePath}" must use a supported static file type.`);
        }

        const fileBytes = Number(entry.uncompressedSize);
        if (!Number.isFinite(fileBytes) || fileBytes < 0) {
            throw new Error(`Invalid zip website structure. "${safePath}" could not be measured safely.`);
        }

        if (fileBytes > MAX_WEBSITE_SINGLE_FILE_BYTES) {
            throw new Error(`Invalid zip website structure. "${safePath}" exceeds the ${(MAX_WEBSITE_SINGLE_FILE_BYTES / 1024 / 1024).toFixed(0)} MB per-file limit.`);
        }

        totalUncompressedBytes += fileBytes;
        if (totalUncompressedBytes > MAX_WEBSITE_TOTAL_BYTES) {
            throw new Error(`Invalid zip website structure. Extracted website files exceed the ${(MAX_WEBSITE_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB limit.`);
        }

        normalizedEntries.push({ ...entry, safePath, isDirectory: false, fileBytes });
    }

    const fileEntries = normalizedEntries.filter((entry) => !entry.isDirectory);
    if (fileEntries.length === 0) {
        throw new Error('Invalid zip website structure. The ZIP archive does not contain any website files.');
    }

    if (fileEntries.length > MAX_WEBSITE_FILE_COUNT) {
        throw new Error(`Invalid zip website structure. The ZIP archive contains too many files (${fileEntries.length}). Keep website bundles under ${MAX_WEBSITE_FILE_COUNT} files.`);
    }

    const rootIndexEntry = fileEntries.find((entry) => entry.safePath.toLowerCase() === 'index.html');
    const wrapperCandidates = new Set(fileEntries.map((entry) => entry.safePath.split('/')[0]).filter(Boolean));

    let wrapperFolder = '';
    if (!rootIndexEntry) {
        if (wrapperCandidates.size !== 1) {
            throw new Error('Invalid zip website structure. Use either a root index.html file or one wrapper folder that contains the whole website.');
        }

        wrapperFolder = [...wrapperCandidates][0];
        const wrapperIndexPath = `${wrapperFolder}/index.html`;
        const wrapperIndexEntry = fileEntries.find((entry) => entry.safePath.toLowerCase() === wrapperIndexPath.toLowerCase());
        if (!wrapperIndexEntry) {
            throw new Error('Invalid zip website structure. Include an index.html file at the project root or inside the single wrapper folder.');
        }
    }

    const hostedFiles = fileEntries.map((entry) => {
        const hostedRelativePath = wrapperFolder
            ? entry.safePath.slice(wrapperFolder.length + 1)
            : entry.safePath;

        const normalizedHostedPath = hostedRelativePath.replace(/\\/g, '/');
        if (!normalizedHostedPath || normalizedHostedPath.startsWith('../') || normalizedHostedPath.includes('/../')) {
            throw new Error(`Unsafe files detected in zip: "${entry.safePath}" could not be normalized into a hosted path.`);
        }

        return {
            originalPath: entry.safePath,
            hostedRelativePath: normalizedHostedPath,
            fileBytes: entry.fileBytes
        };
    });

    const entryFile = hostedFiles.find((entry) => entry.hostedRelativePath.toLowerCase() === 'index.html');
    if (!entryFile) {
        throw new Error('Invalid zip website structure. The hosted website must resolve to a root index.html file.');
    }

    return {
        fileCount: fileEntries.length,
        hasIndexHtml: true,
        totalUncompressedBytes,
        wrapperFolder,
        entryFilePath: entryFile.hostedRelativePath,
        hostedFiles,
        entries: normalizedEntries
    };
}

function validateZipEntries(entries = []) {
    return buildWebsiteHostingPlan(entries);
}

async function inspectZipEntriesWithReader({ size, readSlice }) {
    const tailStart = Math.max(0, size - ZIP_TAIL_SCAN_BYTES);
    const tailBytes = await readSlice(tailStart, size);
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
    if (centralDirectoryOffset >= tailStart && centralDirectoryOffset + centralDirectorySize <= size) {
        const relativeStart = centralDirectoryOffset - tailStart;
        centralDirectoryBytes = tailBytes.subarray(relativeStart, relativeStart + centralDirectorySize);
    } else {
        centralDirectoryBytes = await readSlice(centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize);
    }

    const entries = parseCentralDirectoryEntries(centralDirectoryBytes);
    return validateZipEntries(entries);
}

module.exports = {
    MAX_WEBSITE_FILE_COUNT,
    MAX_WEBSITE_SINGLE_FILE_BYTES,
    MAX_WEBSITE_TOTAL_BYTES,
    buildWebsiteHostingPlan,
    inspectZipEntriesWithReader,
    validateZipEntries
};
