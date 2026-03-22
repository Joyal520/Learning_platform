const {
    fetchObjectBytes,
    getObjectHead,
    getR2ConfigErrorPayload,
    json,
    normalizeObjectKey,
    readJsonBody,
    validateR2Config,
    verifySupabaseUser
} = require('./_lib/r2');
const { inspectZipEntriesWithReader } = require('./_lib/project-upload');

function getExtension(filename = '') {
    const match = String(filename || '').trim().toLowerCase().match(/\.([a-z0-9]+)$/i);
    return match ? match[1] : '';
}

function classifyProject(filename = '', contentType = '') {
    const extension = getExtension(filename);
    const type = String(contentType || '').toLowerCase();

    if (extension === 'zip' || type.includes('zip')) return 'website_project';
    if (extension === 'html' || extension === 'htm' || type === 'text/html') return 'html_project';
    if (extension === 'pdf' || type === 'application/pdf') return 'pdf_document';
    if (extension === 'pptx' || type.includes('presentationml')) return 'presentation_document';
    if (extension === 'doc' || extension === 'docx' || type.includes('word')) return 'word_document';
    return 'project_file';
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

    try {
        const { user } = await verifySupabaseUser(req);
        const body = await readJsonBody(req);
        const objectKey = normalizeObjectKey(body.objectKey);
        const filename = String(body.filename || '').trim();
        const contentType = String(body.contentType || '').trim().toLowerCase();

        if (!objectKey) {
            throw new Error('Missing objectKey.');
        }

        if (!String(objectKey).includes(`/${user.id}/`) && !String(objectKey).includes(`${user.id}/`)) {
            throw new Error('You are not allowed to validate this upload.');
        }

        const projectType = classifyProject(filename, contentType);
        if (projectType !== 'website_project') {
            return json(res, 200, { ok: true, projectType });
        }

        const head = await getObjectHead(objectKey);
        if (!head || !head.contentLength) {
            throw new Error('Upload failed due to a network or storage error. Please try again.');
        }

        const inspection = await inspectZipEntriesWithReader({
            size: head.contentLength,
            readSlice: async (start, endExclusive) => {
                const safeStart = Math.max(0, Number(start) || 0);
                const safeEndExclusive = Math.min(head.contentLength, Number(endExclusive) || head.contentLength);
                if (safeEndExclusive <= safeStart) {
                    return new Uint8Array(0);
                }

                return fetchObjectBytes(objectKey, {
                    start: safeStart,
                    end: safeEndExclusive - 1
                });
            }
        });

        return json(res, 200, {
            ok: true,
            projectType,
            website: {
                fileCount: inspection.fileCount,
                hasIndexHtml: inspection.hasIndexHtml
            }
        });
    } catch (error) {
        return json(res, 400, { error: error.message || 'Could not validate project upload.' });
    }
};
