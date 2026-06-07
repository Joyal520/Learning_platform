const { json, readJsonBody } = require('./_lib/r2');

const DEFAULT_SUPABASE_URL = 'https://scwvbyfnnufnlimbswnk.supabase.co';
const DEFAULT_ALLOWED_ORIGINS = new Set([
    'https://joyal520.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
]);

function getAllowedOrigins() {
    const configured = String(process.env.LIVE_QUIZ_ALLOWED_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isAllowedOrigin(origin) {
    if (!origin) return false;
    if (getAllowedOrigins().has(origin)) return true;

    try {
        const url = new URL(origin);
        return url.protocol === 'https:' && /^pub-[a-z0-9-]+\.r2\.dev$/i.test(url.hostname);
    } catch (_) {
        return false;
    }
}

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (!isAllowedOrigin(origin)) return false;

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
    return true;
}

function getSupabaseConfig() {
    const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
        const error = new Error('Missing SUPABASE_SERVICE_ROLE_KEY for Live Quiz score sync.');
        error.statusCode = 500;
        throw error;
    }
    return { url, serviceKey };
}

function restHeaders(serviceKey, extra = {}) {
    return {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        ...extra
    };
}

async function supabaseFetch(path, options = {}) {
    const { url, serviceKey } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...options,
        headers: restHeaders(serviceKey, options.headers || {})
    });
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch (_) {
            body = text;
        }
    }
    if (!response.ok) {
        const message = body?.message || body?.error || `Supabase request failed: ${response.status}`;
        const error = new Error(message);
        error.statusCode = response.status;
        error.details = body;
        throw error;
    }
    return body;
}

function isMissingRelationError(error) {
    const code = String(error?.details?.code || error?.code || '').toLowerCase();
    const message = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`.toLowerCase();
    return code === '42p01' || code === 'pgrst205' || message.includes('could not find the table');
}

function isMissingColumnError(error) {
    const code = String(error?.details?.code || error?.code || '').toLowerCase();
    const message = `${error?.message || ''} ${JSON.stringify(error?.details || {})}`.toLowerCase();
    return code === '42703' || code === 'pgrst204' || message.includes('column');
}

function normalizeUuid(value, fieldName, { required = true } = {}) {
    const text = String(value || '').trim();
    if (!text && !required) return '';
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
        const error = new Error(`Invalid or missing ${fieldName}.`);
        error.statusCode = 400;
        throw error;
    }
    return text;
}

function normalizeText(value, fieldName) {
    const text = String(value || '').trim();
    if (!text) {
        const error = new Error(`Missing ${fieldName}.`);
        error.statusCode = 400;
        throw error;
    }
    return text;
}

function normalizeNumber(value, fieldName, { min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = {}) {
    if (value === undefined || value === null || value === '') {
        if (!required) return null;
        const error = new Error(`Missing ${fieldName}.`);
        error.statusCode = 400;
        throw error;
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        const error = new Error(`Invalid ${fieldName}.`);
        error.statusCode = 400;
        throw error;
    }
    return Math.round(number);
}

function normalizeResult(row, index) {
    if (!row || typeof row !== 'object') {
        const error = new Error(`Invalid result at index ${index}.`);
        error.statusCode = 400;
        throw error;
    }

    const profileId = normalizeUuid(row.profile_id || row.student_id, `results[${index}].profile_id`);
    const score = normalizeNumber(row.score, `results[${index}].score`, { min: 0, required: true });
    return {
        profileId,
        studentId: String(row.student_id || '').trim() || profileId,
        studentName: String(row.student_name || row.name || '').trim(),
        score,
        correctCount: normalizeNumber(row.correct_count, `results[${index}].correct_count`, { min: 0 }),
        wrongCount: normalizeNumber(row.wrong_count, `results[${index}].wrong_count`, { min: 0 }),
        totalQuestions: normalizeNumber(row.total_questions, `results[${index}].total_questions`, { min: 0 }),
        accuracy: normalizeNumber(row.accuracy, `results[${index}].accuracy`, { min: 0, max: 100 }),
        finalRank: normalizeNumber(row.final_rank, `results[${index}].final_rank`, { min: 1 })
    };
}

async function getClassroom(classroomId, warnings) {
    try {
        const rows = await supabaseFetch(
            `classrooms?id=eq.${encodeURIComponent(classroomId)}&select=id,teacher_id`
        );
        return rows?.[0] || null;
    } catch (error) {
        if (!isMissingColumnError(error)) throw error;
        warnings.push('classrooms.teacher_id column unavailable; teacher_id match was not checked.');
        const rows = await supabaseFetch(
            `classrooms?id=eq.${encodeURIComponent(classroomId)}&select=id`
        );
        return rows?.[0] || null;
    }
}

async function isClassroomMember(classroomId, profileId) {
    const rows = await supabaseFetch(
        [
            'classroom_members?',
            `classroom_id=eq.${encodeURIComponent(classroomId)}`,
            `&profile_id=eq.${encodeURIComponent(profileId)}`,
            '&select=id'
        ].join('')
    );
    return Array.isArray(rows) && rows.length > 0;
}

async function pointsAlreadyAwarded(classroomId, profileId, liveQuizSessionId) {
    const rows = await supabaseFetch(
        [
            'classroom_points?',
            `classroom_id=eq.${encodeURIComponent(classroomId)}`,
            `&profile_id=eq.${encodeURIComponent(profileId)}`,
            '&source=eq.live_quiz',
            `&activity_slug=eq.${encodeURIComponent(liveQuizSessionId)}`,
            '&select=id'
        ].join('')
    );
    return rows?.[0]?.id || null;
}

async function insertClassroomPoints(classroomId, profileId, points, liveQuizSessionId, result) {
    const rows = await supabaseFetch('classroom_points', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
            classroom_id: classroomId,
            student_id: profileId,
            profile_id: profileId,
            assignment_submission_id: null,
            points,
            source: 'live_quiz',
            activity_slug: liveQuizSessionId,
            metadata: {
                live_quiz_session_id: liveQuizSessionId,
                student_name: result.studentName,
                correct_count: result.correctCount || 0,
                wrong_count: result.wrongCount || 0,
                total_questions: result.totalQuestions || 0,
                accuracy: result.accuracy || 0,
                final_rank: result.finalRank || null
            }
        })
    });
    return rows?.[0]?.id || null;
}

async function upsertLiveQuizResults({ classroomId, teacherId, liveQuizSessionId, quizId, source, reason, results }) {
    const extendedRows = results.map((result) => ({
        classroom_id: classroomId,
        class_id: classroomId,
        teacher_id: teacherId || null,
        source,
        live_quiz_session_id: liveQuizSessionId,
        firebase_game_id: liveQuizSessionId,
        quiz_id: quizId || null,
        student_id: result.profileId,
        profile_id: result.profileId,
        student_name: result.studentName,
        score: result.score,
        points_awarded: result.score,
        correct_count: result.correctCount || 0,
        wrong_count: result.wrongCount || 0,
        total_questions: result.totalQuestions || 0,
        accuracy: result.accuracy || 0,
        final_rank: result.finalRank || null,
        classroom_points_reason: reason
    }));

    try {
        await supabaseFetch('live_quiz_results?on_conflict=classroom_id,profile_id,live_quiz_session_id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(extendedRows)
        });
        return { ok: true, mode: 'extended' };
    } catch (error) {
        if (isMissingRelationError(error)) return { ok: false, missing: true };
        if (!isMissingColumnError(error)) throw error;
    }

    const legacyRows = results.map((result) => ({
        class_id: classroomId,
        source,
        firebase_game_id: liveQuizSessionId,
        firebase_pin: '',
        student_id: result.profileId,
        student_name: result.studentName,
        score: result.score,
        correct_count: result.correctCount || 0,
        wrong_count: result.wrongCount || 0,
        total_questions: result.totalQuestions || 0,
        accuracy: result.accuracy || 0
    }));

    try {
        await supabaseFetch('live_quiz_results?on_conflict=class_id,firebase_game_id,student_id', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify(legacyRows)
        });
        return { ok: true, mode: 'legacy' };
    } catch (error) {
        if (isMissingRelationError(error) || isMissingColumnError(error)) return { ok: false, unavailable: true };
        throw error;
    }
}

module.exports = async function handler(req, res) {
    const corsAllowed = setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        if (!corsAllowed && req.headers.origin) {
            return json(res, 403, { error: 'Origin is not allowed for Live Quiz score sync.' });
        }
        res.statusCode = 204;
        return res.end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const body = await readJsonBody(req);
        const warnings = [];
        const classroomId = normalizeUuid(body.classroom_id || body.classId, 'classroom_id');
        const teacherId = normalizeUuid(body.teacher_id, 'teacher_id', { required: false });
        const liveQuizSessionId = normalizeText(
            body.live_quiz_session_id || body.firebase_game_id || body.game_id,
            'live_quiz_session_id'
        );
        const quizId = String(body.quiz_id || '').trim();
        const source = String(body.source || 'edtechra-live-quiz').trim() || 'edtechra-live-quiz';

        if (!Array.isArray(body.results) || body.results.length === 0) {
            return json(res, 400, { error: 'results must be a non-empty array.' });
        }

        const normalizedResults = body.results.map((row, index) => normalizeResult(row, index));
        const classroom = await getClassroom(classroomId, warnings);
        if (!classroom?.id) {
            return json(res, 404, { error: 'Classroom not found.' });
        }
        if (teacherId && classroom.teacher_id && classroom.teacher_id !== teacherId) {
            return json(res, 403, { error: 'teacher_id does not match this classroom.' });
        }

        const reason = `Live Quiz: ${liveQuizSessionId}`;
        const validMembers = [];
        let skippedInvalidMembers = 0;
        let skippedDuplicates = 0;
        let insertedPoints = 0;

        for (const result of normalizedResults) {
            const isMember = await isClassroomMember(classroomId, result.profileId);
            if (!isMember) {
                skippedInvalidMembers += 1;
                continue;
            }

            validMembers.push(result);
            const existingPointsId = await pointsAlreadyAwarded(classroomId, result.profileId, liveQuizSessionId);
            if (existingPointsId) {
                skippedDuplicates += 1;
                continue;
            }

            await insertClassroomPoints(classroomId, result.profileId, result.score, liveQuizSessionId, result);
            insertedPoints += 1;
        }

        if (validMembers.length) {
            try {
                const liveQuizSync = await upsertLiveQuizResults({
                    classroomId,
                    teacherId: teacherId || classroom.teacher_id || '',
                    liveQuizSessionId,
                    quizId,
                    source,
                    reason,
                    results: validMembers
                });
                if (liveQuizSync.missing || liveQuizSync.unavailable) {
                    warnings.push('live_quiz_results table not found or unavailable; classroom_points sync completed/skipped separately.');
                }
            } catch (error) {
                console.warn('[Live Quiz Sync] live_quiz_results upsert failed', {
                    message: error?.message || String(error),
                    classroomId,
                    liveQuizSessionId
                });
                warnings.push('live_quiz_results table not found or unavailable; classroom_points sync completed/skipped separately.');
            }
        }

        return json(res, 200, {
            ok: true,
            processed: normalizedResults.length,
            inserted_points: insertedPoints,
            skipped_duplicates: skippedDuplicates,
            skipped_invalid_members: skippedInvalidMembers,
            warnings
        });
    } catch (error) {
        const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
        console.warn('[Live Quiz Sync] request failed', {
            statusCode,
            message: error?.message || String(error)
        });
        return json(res, statusCode, {
            error: statusCode >= 500 ? 'Could not sync Live Quiz score.' : error.message
        });
    }
};
