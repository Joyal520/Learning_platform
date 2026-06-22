const crypto = require('crypto');
const OpenAI = require('openai');
const { json, verifySupabaseUser } = require('./_lib/r2');

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const DEFAULT_SUPABASE_URL = 'https://scwvbyfnnufnlimbswnk.supabase.co';

function getSupabaseConfig() {
    const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
        const error = new Error('Missing SUPABASE_SERVICE_ROLE_KEY for Paper Grader save.');
        error.statusCode = 500;
        throw error;
    }
    return { url, serviceKey };
}

async function supabaseFetch(pathname, options = {}) {
    const { url, serviceKey } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/${pathname}`, {
        ...options,
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const message = body?.message || body?.error || `Supabase request failed: ${response.status}`;
        const error = new Error(message);
        error.statusCode = response.status;
        error.details = body;
        throw error;
    }
    return body;
}

function normalizeUuid(value, fieldName, { required = true } = {}) {
    const normalized = String(value || '').trim();
    if (!normalized && !required) return '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
        const error = new Error(`Invalid ${fieldName}.`);
        error.statusCode = 400;
        throw error;
    }
    return normalized;
}

function clampScore(value) {
    return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

function sumNumericSubscores(subscores) {
    return Object.values(subscores || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function trimWords(value, maxWords = 50) {
    const words = String(value || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    return words.slice(0, maxWords).join(' ');
}

function createAssessmentId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMode(moduleType) {
    const value = String(moduleType || 'essay').trim();
    if (value === 'worksheet') return 'worksheet_grading';
    if (value === 'picture_description') return 'picture_description';
    if (value === 'handwriting') return 'handwriting_contest';
    return 'essay_correction';
}

function serializeError(error) {
    return {
        message: error?.message || String(error || 'Unknown error.'),
        statusCode: error?.statusCode || 500,
        details: error?.details || null
    };
}

function readRawBody(req, maxBytes = MAX_IMAGE_BYTES + 1024 * 1024) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (chunk) => {
            size += chunk.length;
            if (size > maxBytes) {
                reject(new Error('Uploaded image is too large.'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

function parseMultipart(buffer, contentType = '') {
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) throw new Error('Missing upload boundary.');

    const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
    const raw = buffer.toString('latin1');
    const fields = {};
    let file = null;

    raw.split(boundary).forEach((part) => {
        const trimmed = part.replace(/^\r\n/, '').replace(/\r\n$/, '');
        if (!trimmed || trimmed === '--') return;

        const headerEnd = trimmed.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;

        const headerText = trimmed.slice(0, headerEnd);
        let bodyText = trimmed.slice(headerEnd + 4);
        bodyText = bodyText.replace(/\r\n--$/, '').replace(/\r\n$/, '');

        const name = headerText.match(/name="([^"]+)"/i)?.[1] || '';
        const filename = headerText.match(/filename="([^"]*)"/i)?.[1] || '';
        const type = headerText.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() || '';
        if (!name) return;

        if (filename) {
            file = {
                fieldName: name,
                filename,
                type,
                buffer: Buffer.from(bodyText, 'latin1')
            };
        } else {
            fields[name] = Buffer.from(bodyText, 'latin1').toString('utf8').trim();
        }
    });

    return { fields, file };
}

function parseJsonBody(buffer) {
    try {
        return buffer?.length ? JSON.parse(buffer.toString('utf8')) : {};
    } catch (error) {
        const parseError = new Error('Request body must be valid JSON.');
        parseError.statusCode = 400;
        throw parseError;
    }
}

function validateAndNormalize(rawJson, expectedModuleType) {
    let parsed;
    try {
        parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    } catch (error) {
        throw new Error(`Response is not valid JSON: ${error.message}`);
    }

    if (parsed.unclear === true) {
        return {
            module_type: expectedModuleType,
            score: 0,
            subscores: {},
            mistakes: [],
            feedback: 'Unclear text. Please upload a clearer image.',
            top_issue: 'Unclear text',
            improvement: 'Ensure the camera is focused and lighting is bright.',
            unclear: true,
            extracted_text: 'Unclear text',
            corrected_text: '',
            ocr_confidence: 0
        };
    }

    [
        'module_type',
        'score',
        'subscores',
        'mistakes',
        'feedback',
        'top_issue',
        'improvement',
        'unclear',
        'extracted_text',
        'corrected_text',
        'ocr_confidence'
    ].forEach((field) => {
        if (!(field in parsed)) throw new Error(`Missing required schema field: ${field}`);
    });

    parsed.module_type = expectedModuleType;
    parsed.score = clampScore(typeof parsed.score === 'number' ? parsed.score : Number(parsed.score) || 0);
    parsed.subscores = parsed.subscores && typeof parsed.subscores === 'object' ? parsed.subscores : {};
    parsed.mistakes = Array.isArray(parsed.mistakes) ? parsed.mistakes : [];
    parsed.feedback = trimWords(parsed.feedback || '', 50);
    parsed.top_issue = String(parsed.top_issue || '');
    parsed.improvement = String(parsed.improvement || '');
    parsed.unclear = parsed.unclear === true || parsed.unclear === 'true';
    parsed.extracted_text = String(parsed.extracted_text || '');
    parsed.corrected_text = String(parsed.corrected_text || '');
    parsed.ocr_confidence = Number(parsed.ocr_confidence) || 0;
    return parsed;
}

function getModuleInstructions(moduleType, additionalInput) {
    if (moduleType === 'worksheet') {
        return `
Evaluate the handwritten worksheet answers against the provided Answer Key.
Answer Key: "${additionalInput}"
Grade out of 100 using this rubric:
- correct_answers: 70
- completion: 15
- presentation_neatness: 10
- instruction_following: 5
Subscores object MUST contain exactly those keys with integer values that sum to the final score.
Score value: final score out of 100.
Mistakes array: List incorrect answers or grading concerns, max 3 items.
Feedback: 2 to 3 bullet lines, maximum 50 words total. Mention the score and areas to improve.
Top Issue: The main worksheet grading concern.
Improvement: One short teacher-friendly next step.
`;
    }

    if (moduleType === 'picture_description') {
        return `
Evaluate the handwritten description of a picture.
Description context/prompt: "${additionalInput}"
Grade out of 100 using this rubric:
- relevance_to_picture: 25
- grammar: 20
- vocabulary: 20
- sentence_structure: 15
- coherence: 10
- spelling_punctuation: 10
Subscores object MUST contain exactly those keys with integer values that sum to the final score.
Score value: final score out of 100.
Feedback: 2 to 3 bullet lines, maximum 50 words total. Mention the score and 2 to 3 areas to improve.
Top Issue: The main grammar, relevance, or clarity concern.
Improvement: One short language suggestion.
`;
    }

    if (moduleType === 'handwriting') {
        return `
Evaluate the beautiful handwriting contest entry.
Reference Text to copy (if any): "${additionalInput}"
Grade out of 100 using this rubric:
- letter_formation: 25
- spacing: 20
- alignment: 20
- slant_consistency: 15
- neatness_readability: 20
Subscores object MUST contain exactly those keys with integer values that sum to the final score.
Score value: final score out of 100.
Feedback: 2 to 3 bullet lines, maximum 50 words total. Mention the score and 2 to 3 areas to improve.
Top Issue: The main handwriting concern.
Improvement: One short handwriting tip.
`;
    }

    return `
Evaluate the handwritten answer sheet.
Grade out of 100 using this rubric:
- grammar: 25
- vocabulary: 20
- coherence: 20
- sentence_structure: 20
- spelling_punctuation: 15
Subscores object MUST contain exactly those keys with integer values that sum to the final score.
Score value: final score out of 100.
Feedback: 2 to 3 bullet lines, maximum 50 words total. Mention the score and 2 to 3 areas to improve.
Top Issue: A single line describing the primary writing issue.
Improvement: A short action point.
`;
}

async function evaluateHandwriting(base64Image, moduleType, additionalInput) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        const error = new Error('AI grading is not configured yet. Add OPENAI_API_KEY to the server environment to enable automatic assessment.');
        error.statusCode = 503;
        throw error;
    }

    const openai = new OpenAI({ apiKey });
    const systemPrompt = `You are the OCR Assessment Engine inside Edtechra Digital Classroom.
Evaluate student work strictly. Do not use greetings or closing statements. Never use motivational language or over-praise.

${getModuleInstructions(moduleType, additionalInput)}

CRITICAL RULES:
1. If the image is completely blurry, illegible, contains no handwriting, or cannot be parsed:
   You MUST return ONLY this JSON object:
   { "unclear": true }
2. Otherwise, transcribe the handwriting, assess it, and respond with ONLY a valid JSON object matching the schema below.
3. OCR confidence must be a decimal from 0.0 to 1.0.
4. Feedback must be short, teacher-friendly, and no more than 50 words.

Unified JSON Schema:
{
  "module_type": "${moduleType}",
  "score": 0,
  "subscores": {},
  "mistakes": [
    {
      "question": "Q1 or N/A",
      "error": "incorrect text / answer",
      "correction": "corrected text / answer",
      "type": "grammar | spelling | structure | neatness"
    }
  ],
  "feedback": "bullet point 1\\nbullet point 2",
  "top_issue": "main problem description",
  "improvement": "actionable tip",
  "unclear": false,
  "extracted_text": "complete transcribed student handwriting text",
  "corrected_text": "complete corrected version of the student text",
  "ocr_confidence": 0.95
}`;

    const response = await openai.chat.completions.create({
        model: process.env.PAPER_GRADER_MODEL || 'gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Scan and grade this handwritten answer sheet.' },
                    { type: 'image_url', image_url: { url: base64Image } }
                ]
            }
        ],
        response_format: { type: 'json_object' },
        max_tokens: 1500
    });

    const rawResponse = response.choices[0]?.message?.content;
    if (!rawResponse) throw new Error('Empty response from OCR Assessment Engine.');
    return validateAndNormalize(rawResponse, moduleType);
}

function normalizeScore(evaluation, moduleType) {
    if (evaluation.unclear) return 0;
    if (moduleType === 'worksheet') {
        const score = Number(evaluation.score || 0);
        if (score > 0) return score;
        return sumNumericSubscores(evaluation.subscores);
    }
    const score = Number(evaluation.score || 0);
    if (score > 10) return score;
    if (score > 0) return score * 10;
    return sumNumericSubscores(evaluation.subscores);
}

async function verifyTeacherAndStudent({ classroomId, studentId, user }) {
    if (!classroomId || !studentId) return;

    await supabaseFetch(
        `classrooms?id=eq.${encodeURIComponent(classroomId)}&teacher_id=eq.${encodeURIComponent(user.id)}&select=id`,
        { method: 'GET' }
    ).then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) {
            const error = new Error('Teacher session does not match this classroom.');
            error.statusCode = 403;
            throw error;
        }
    });

    await supabaseFetch(
        [
            'classroom_members?',
            `classroom_id=eq.${encodeURIComponent(classroomId)}`,
            `&profile_id=eq.${encodeURIComponent(studentId)}`,
            '&role=neq.teacher',
            '&select=id'
        ].join(''),
        { method: 'GET' }
    ).then((rows) => {
        if (!Array.isArray(rows) || rows.length === 0) {
            const error = new Error('Selected student is not in this classroom.');
            error.statusCode = 400;
            throw error;
        }
    });
}

async function findExistingOcrPoints(classroomId, studentId, assessmentId) {
    const rows = await supabaseFetch(
        [
            'classroom_points?',
            `classroom_id=eq.${encodeURIComponent(classroomId)}`,
            `&profile_id=eq.${encodeURIComponent(studentId)}`,
            '&source=eq.ocr_assessment',
            `&activity_slug=eq.${encodeURIComponent(assessmentId)}`,
            '&select=id'
        ].join(''),
        { method: 'GET' }
    );
    return rows?.[0]?.id || null;
}

async function savePaperGraderAssessment({ fields, user, evaluation, totalScore, createdAt, assessmentId }) {
    const classroomId = normalizeUuid(fields.classroom_id, 'classroom_id', { required: false });
    const studentId = normalizeUuid(fields.student_id || fields.profile_id, 'student_id', { required: false });
    if (!classroomId || !studentId) return null;
    const stableAssessmentId = String(assessmentId || fields.assessment_id || createAssessmentId()).trim();

    await verifyTeacherAndStudent({ classroomId, studentId, user });

    const mode = String(evaluation.module_type || fields.module_type || 'essay');
    const assessmentMode = normalizeMode(mode);
    const existingPointsId = await findExistingOcrPoints(classroomId, studentId, stableAssessmentId);
    const metadata = {
        assessment_id: stableAssessmentId,
        source: 'ocr_assessment',
        assessment_mode: assessmentMode,
        classroom_id: classroomId,
        student_id: studentId,
        profile_id: studentId,
        selected_evaluation_mode: mode,
        score: totalScore,
        feedback: evaluation.feedback || '',
        improvement: evaluation.improvement || '',
        rubric: evaluation.subscores || {},
        detected_text: evaluation.extracted_text || '',
        created_at: createdAt,
        ocr_confidence: evaluation.ocr_confidence || 0,
        grade_status: evaluation.unclear ? 'Needs clearer upload' : (totalScore >= 75 ? 'Strong' : totalScore >= 50 ? 'Developing' : 'Needs support'),
        reason: `OCR Assessment: ${assessmentMode}`
    };

    if (existingPointsId) {
        return {
            assessmentId: stableAssessmentId,
            classroomPointsId: existingPointsId,
            metadata,
            duplicate: true
        };
    }

    const rows = await supabaseFetch('classroom_points', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
            classroom_id: classroomId,
            student_id: studentId,
            profile_id: studentId,
            assignment_submission_id: null,
            points: totalScore,
            source: 'ocr_assessment',
            activity_slug: stableAssessmentId,
            metadata
        })
    });

    return {
        assessmentId: stableAssessmentId,
        classroomPointsId: rows?.[0]?.id || null,
        metadata,
        duplicate: false
    };
}

function buildRetryPayload({ fields, user, evaluation, totalScore, createdAt, assessmentId }) {
    return {
        action: 'save_points',
        classroom_id: fields.classroom_id || '',
        student_id: fields.student_id || fields.profile_id || '',
        profile_id: fields.profile_id || fields.student_id || '',
        teacher_id: fields.teacher_id || user?.id || '',
        module_type: evaluation.module_type || fields.module_type || 'essay',
        assessment_id: assessmentId,
        created_at: createdAt,
        total_score: totalScore,
        evaluation: {
            module_type: evaluation.module_type || fields.module_type || 'essay',
            score: evaluation.score,
            subscores: evaluation.subscores || {},
            mistakes: evaluation.mistakes || [],
            feedback: evaluation.feedback || '',
            top_issue: evaluation.top_issue || '',
            improvement: evaluation.improvement || '',
            unclear: evaluation.unclear === true,
            extracted_text: evaluation.extracted_text || '',
            corrected_text: evaluation.corrected_text || '',
            ocr_confidence: evaluation.ocr_confidence || 0
        }
    };
}

async function handleSavePointsOnly({ req, res, body, user }) {
    if (!user?.id) {
        return json(res, 401, { success: false, error: 'Teacher login is required to save OCR assessment points.' });
    }

    const fields = {
        classroom_id: body.classroom_id,
        student_id: body.student_id || body.profile_id,
        profile_id: body.profile_id || body.student_id,
        teacher_id: body.teacher_id || user.id,
        module_type: body.module_type || body.evaluation?.module_type || 'essay',
        assessment_id: body.assessment_id
    };
    if (fields.teacher_id && fields.teacher_id !== user.id) {
        return json(res, 403, { success: false, error: 'Teacher session does not match this classroom.' });
    }

    const evaluation = validateAndNormalize(body.evaluation || {}, fields.module_type);
    const totalScore = clampScore(body.total_score !== undefined ? body.total_score : normalizeScore(evaluation, fields.module_type));
    const createdAt = String(body.created_at || new Date().toISOString());
    const assessmentId = String(body.assessment_id || createAssessmentId()).trim();

    const saveResult = await savePaperGraderAssessment({
        fields,
        user,
        evaluation,
        totalScore,
        createdAt,
        assessmentId
    });

    return json(res, 200, {
        success: true,
        leaderboard_saved: true,
        leaderboard_duplicate: Boolean(saveResult?.duplicate),
        success_message: saveResult?.duplicate
            ? 'AI assessment score was already added to the classroom leaderboard.'
            : 'AI assessment completed. Score added to the classroom leaderboard.',
        assessment_id: saveResult?.assessmentId || assessmentId,
        classroom_points_id: saveResult?.classroomPointsId || ''
    });
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const authHeader = req.headers.authorization || '';
        const authContext = authHeader ? await verifySupabaseUser(req) : null;
        const user = authContext?.user || null;
        const rawBody = await readRawBody(req);
        const contentType = req.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
            const body = parseJsonBody(rawBody);
            if (body.action === 'save_points') {
                return handleSavePointsOnly({ req, res, body, user });
            }
            return json(res, 400, { success: false, error: 'Unsupported OCR assessment action.' });
        }

        const { fields, file } = parseMultipart(rawBody, contentType);
        const classroomId = String(fields.classroom_id || '').trim();
        const studentId = String(fields.student_id || fields.profile_id || '').trim();
        if ((classroomId || studentId) && !user?.id) {
            return json(res, 401, { error: 'Teacher login is required to save Paper Grader results.' });
        }
        if (fields.teacher_id && user?.id && fields.teacher_id !== user.id) {
            return json(res, 403, { error: 'Teacher session does not match this classroom.' });
        }
        if (!file?.buffer?.length) return json(res, 400, { error: 'Upload an answer sheet image.' });
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) return json(res, 400, { error: 'Only JPG, PNG, and WebP images are supported.' });
        if (file.buffer.length > MAX_IMAGE_BYTES) return json(res, 400, { error: 'Image must be 8MB or smaller.' });

        const supportedModuleTypes = new Set(['essay', 'worksheet', 'picture_description', 'handwriting']);
        const requestedModuleType = String(fields.module_type || 'essay').trim();
        const moduleType = supportedModuleTypes.has(requestedModuleType) ? requestedModuleType : 'essay';
        const base64Image = `data:${file.type};base64,${file.buffer.toString('base64')}`;
        const evaluation = await evaluateHandwriting(
            base64Image,
            moduleType,
            fields.answer_key || fields.image_prompt || fields.reference_text || ''
        );
        const totalScore = clampScore(normalizeScore(evaluation, moduleType));
        const createdAt = new Date().toISOString();
        const assessmentId = String(fields.assessment_id || createAssessmentId()).trim();
        let saveResult = null;
        let leaderboardError = null;
        const leaderboardRequired = Boolean(classroomId && studentId);
        if (leaderboardRequired) {
            try {
                saveResult = await savePaperGraderAssessment({
                    fields,
                    user,
                    evaluation,
                    totalScore,
                    createdAt,
                    assessmentId
                });
            } catch (saveError) {
                leaderboardError = serializeError(saveError);
            }
        }
        file.buffer = null;
        const leaderboardSaved = leaderboardRequired ? Boolean(saveResult?.classroomPointsId) : false;
        const retrySavePayload = !leaderboardRequired || leaderboardSaved
            ? null
            : buildRetryPayload({ fields, user, evaluation, totalScore, createdAt, assessmentId });

        return json(res, 200, {
            success: true,
            classroom_id: classroomId,
            student_id: studentId,
            profile_id: studentId,
            teacher_id: fields.teacher_id || user?.id || '',
            selected_evaluation_mode: moduleType,
            created_at: createdAt,
            image_deleted: true,
            leaderboard_saved: leaderboardSaved,
            leaderboard_required: leaderboardRequired,
            leaderboard_duplicate: Boolean(saveResult?.duplicate),
            leaderboard_update_failed: Boolean(leaderboardError),
            leaderboard_error: leaderboardError,
            retry_save_payload: retrySavePayload,
            success_message: !leaderboardRequired
                ? 'Assessment completed and image deleted securely.'
                : leaderboardSaved
                ? 'AI assessment completed. Score added to the classroom leaderboard.'
                : 'Assessment completed, but leaderboard update failed. Please retry saving the score.',
            assessment_id: saveResult?.assessmentId || assessmentId,
            classroom_points_id: saveResult?.classroomPointsId || '',
            image_url: '',
            total_score: totalScore,
            grade_status: evaluation.unclear ? 'Needs clearer upload' : (totalScore >= 75 ? 'Strong' : totalScore >= 50 ? 'Developing' : 'Needs support'),
            ...evaluation
        });
    } catch (error) {
        const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
        return json(res, statusCode, { success: false, error: error.message || 'OCR Assessment Engine failed.' });
    }
};
