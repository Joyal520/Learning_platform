const { createWriteStream } = require('fs');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');

const { yauzl } = require('playwright-core/lib/zipBundle');

const {
    buildPublicUrl,
    deleteObjects,
    fetchObjectBytes,
    getObjectHead,
    getR2ConfigErrorPayload,
    getSupabaseSubmission,
    json,
    listObjectKeysWithPrefix,
    normalizeObjectKey,
    putObject,
    readJsonBody,
    sanitizeSegment,
    updateSupabaseSubmission,
    validateR2Config,
    verifySupabaseUser
} = require('./_lib/r2');
const { inspectZipEntriesWithReader } = require('./_lib/project-upload');

const CONTENT_TYPE_BY_EXTENSION = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8',
    js: 'application/javascript; charset=utf-8',
    mjs: 'application/javascript; charset=utf-8',
    json: 'application/json; charset=utf-8',
    txt: 'text/plain; charset=utf-8',
    md: 'text/markdown; charset=utf-8',
    xml: 'application/xml; charset=utf-8',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    mp4: 'video/mp4',
    webm: 'video/webm',
    webmanifest: 'application/manifest+json'
};

function getExtension(filename = '') {
    const match = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
}

function getHostedContentType(relativePath = '') {
    return CONTENT_TYPE_BY_EXTENSION[getExtension(relativePath)] || 'application/octet-stream';
}

function getMissingSubmissionColumn(error) {
    const message = String(error?.message || '').trim();
    const patterns = [
        /Could not find the '([^']+)' column/i,
        /column submissions\.([a-zA-Z0-9_]+) does not exist/i,
        /column "([^"]+)" of relation "submissions" does not exist/i
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match?.[1]) return match[1];
    }

    return '';
}

async function updateWebsitePreviewMetadata(accessToken, submissionId, website) {
    const patch = {
        project_url: website.previewUrl,
        preview_url: website.previewUrl,
        metadata: {
            previewUrl: website.previewUrl,
            indexUrl: website.previewUrl,
            entryFilePath: website.entryFilePath,
            extractedRootPath: website.extractedRootPath,
            zipStoragePath: website.zipStoragePath,
            fileCount: website.fileCount
        }
    };
    const optionalColumns = new Set(Object.keys(patch));
    const skippedColumns = [];

    while (Object.keys(patch).length > 0) {
        try {
            const row = await updateSupabaseSubmission(accessToken, submissionId, patch);
            return { saved: true, row, skippedColumns };
        } catch (error) {
            const missingColumn = getMissingSubmissionColumn(error);
            if (!missingColumn || !optionalColumns.has(missingColumn)) {
                throw error;
            }
            delete patch[missingColumn];
            optionalColumns.delete(missingColumn);
            skippedColumns.push(missingColumn);
        }
    }

    return { saved: false, skippedColumns };
}

function decodeZipEntryName(fileName) {
    if (Buffer.isBuffer(fileName) || fileName instanceof Uint8Array) {
        return Buffer.from(fileName).toString('utf8');
    }

    return String(fileName || '');
}

function openZipFromBuffer(buffer) {
    return new Promise((resolve, reject) => {
        yauzl.fromBuffer(buffer, {
            lazyEntries: true,
            decodeStrings: false,
            validateEntrySizes: true
        }, (error, zipfile) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(zipfile);
        });
    });
}

function openEntryReadStream(zipfile, entry) {
    return new Promise((resolve, reject) => {
        zipfile.openReadStream(entry, (error, stream) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(stream);
        });
    });
}

async function extractZipToTemp(buffer, plan, tempDir) {
    const hostedFileMap = new Map(plan.hostedFiles.map((file) => [file.originalPath, file]));
    const zipfile = await openZipFromBuffer(buffer);

    return new Promise((resolve, reject) => {
        let settled = false;

        const fail = (error) => {
            if (settled) return;
            settled = true;
            try {
                zipfile.close();
            } catch (_) {
                // Ignore close failures during error handling.
            }
            reject(error);
        };

        zipfile.on('error', fail);
        zipfile.on('end', () => {
            if (!settled) {
                settled = true;
                resolve();
            }
        });

        zipfile.on('entry', async (entry) => {
            try {
                const entryName = decodeZipEntryName(entry.fileName).replace(/\\/g, '/').replace(/\/+$/, '');
                const hostedFile = hostedFileMap.get(entryName);

                if (!hostedFile) {
                    zipfile.readEntry();
                    return;
                }

                const destinationPath = path.join(tempDir, hostedFile.hostedRelativePath);
                const normalizedDestination = path.resolve(destinationPath);
                if (!normalizedDestination.startsWith(path.resolve(tempDir))) {
                    throw new Error(`Unsafe files detected in zip: "${entryName}" escaped the extraction root.`);
                }

                await fs.mkdir(path.dirname(normalizedDestination), { recursive: true });
                const readStream = await openEntryReadStream(zipfile, entry);
                const writeStream = createWriteStream(normalizedDestination, { flags: 'w' });
                await pipeline(readStream, writeStream);
                zipfile.readEntry();
            } catch (error) {
                fail(error);
            }
        });

        zipfile.readEntry();
    });
}

async function collectExtractedFiles(rootDir, currentDir = rootDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        const relativePath = path.relative(rootDir, absolutePath).replace(/\\/g, '/');
        const stats = await fs.lstat(absolutePath);

        if (stats.isSymbolicLink()) {
            throw new Error(`Unsafe files detected in zip: "${relativePath}" extracted as a symbolic link.`);
        }

        if (stats.isDirectory()) {
            files.push(...await collectExtractedFiles(rootDir, absolutePath));
            continue;
        }

        if (!stats.isFile()) {
            throw new Error(`Unsafe files detected in zip: "${relativePath}" extracted as an unsupported file type.`);
        }

        files.push({
            relativePath,
            absolutePath,
            size: stats.size
        });
    }

    return files;
}

function toProcessingError(error) {
    const message = String(error?.message || 'Website processing failed.').trim();
    return message.slice(0, 400);
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    const missingEnvVars = validateR2Config({ log: true });
    if (missingEnvVars.length > 0) {
        return json(res, 500, getR2ConfigErrorPayload(missingEnvVars));
    }

    let accessToken = null;
    let submissionId = '';
    let extractedRootPrefix = '';
    const uploadedHostedKeys = [];
    let tempDir = '';

    try {
        const auth = await verifySupabaseUser(req);
        accessToken = auth.accessToken;

        const body = await readJsonBody(req);
        submissionId = String(body.submissionId || '').trim();
        if (!submissionId) {
            throw new Error('Missing submissionId.');
        }

        const submission = await getSupabaseSubmission(
            accessToken,
            submissionId,
            'id,author_id,file_path,file_url,file_type,mime_type,storage_provider'
        );

        if (!submission) {
            throw new Error('Submission could not be found.');
        }

        if (submission.author_id !== auth.user.id) {
            throw new Error('You are not allowed to process this website upload.');
        }

        const fileType = String(submission.file_type || submission.mime_type || '').trim().toLowerCase();
        if (!fileType.includes('zip')) {
            return json(res, 200, { ok: true, skipped: true, reason: 'Submission is not a ZIP website.' });
        }

        const originalZipKey = normalizeObjectKey(submission.file_path || body.objectKey);
        if (!originalZipKey) {
            throw new Error('The original ZIP upload path is missing.');
        }

        const safeUserId = sanitizeSegment(auth.user.id);
        const safeSubmissionId = sanitizeSegment(submissionId);
        extractedRootPrefix = `web-projects/${safeUserId}/${safeSubmissionId}`;

        const existingHostedKeys = await listObjectKeysWithPrefix(`${extractedRootPrefix}/`);
        if (existingHostedKeys.length > 0) {
            await deleteObjects(existingHostedKeys);
        }

        const head = await getObjectHead(originalZipKey);
        if (!head?.contentLength) {
            throw new Error('Upload failed due to a network or storage error. Please try again.');
        }

        const zipBytes = Buffer.from(await fetchObjectBytes(originalZipKey));
        const plan = await inspectZipEntriesWithReader({
            size: head.contentLength,
            readSlice: async (start, endExclusive) => {
                const safeStart = Math.max(0, Number(start) || 0);
                const safeEndExclusive = Math.min(head.contentLength, Number(endExclusive) || head.contentLength);
                if (safeEndExclusive <= safeStart) {
                    return new Uint8Array(0);
                }

                return fetchObjectBytes(originalZipKey, {
                    start: safeStart,
                    end: safeEndExclusive - 1
                });
            }
        });

        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `website-${safeSubmissionId}-`));
        await extractZipToTemp(zipBytes, plan, tempDir);

        const extractedFiles = await collectExtractedFiles(tempDir);
        if (extractedFiles.length !== plan.hostedFiles.length) {
            throw new Error('Website processing failed because the extracted file set did not match the validated ZIP contents.');
        }

        const expectedPaths = new Set(plan.hostedFiles.map((file) => file.hostedRelativePath));
        for (const extractedFile of extractedFiles) {
            if (!expectedPaths.has(extractedFile.relativePath)) {
                throw new Error(`Website processing failed because "${extractedFile.relativePath}" was not part of the validated website bundle.`);
            }
        }

        for (const extractedFile of extractedFiles) {
            const objectKey = `${extractedRootPrefix}/${extractedFile.relativePath}`;
            const fileBuffer = await fs.readFile(extractedFile.absolutePath);
            await putObject(objectKey, fileBuffer, {
                contentType: getHostedContentType(extractedFile.relativePath)
            });
            uploadedHostedKeys.push(objectKey);
        }

        const entryFilePath = `${extractedRootPrefix}/${plan.entryFilePath}`;
        const previewUrl = buildPublicUrl(entryFilePath);
        const website = {
            zipStoragePath: originalZipKey,
            extractedRootPath: extractedRootPrefix,
            entryFilePath,
            previewUrl,
            fileCount: plan.fileCount
        };
        const metadataUpdate = await updateWebsitePreviewMetadata(accessToken, submissionId, website).catch((metadataError) => {
            console.warn('[process-website-project] Could not save website preview metadata:', metadataError.message || metadataError);
            return { saved: false, error: metadataError.message || String(metadataError) };
        });

        return json(res, 200, {
            ok: true,
            submissionId,
            website,
            metadataUpdate
        });
    } catch (error) {
        if (uploadedHostedKeys.length > 0) {
            try {
                await deleteObjects(uploadedHostedKeys);
            } catch (cleanupError) {
                console.warn('[process-website-project] Could not clean partial hosted files:', cleanupError);
            }
        }

        return json(res, 400, {
            error: toProcessingError(error),
            code: 'WEBSITE_PROCESSING_FAILED'
        });
    } finally {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
        }
    }
};
