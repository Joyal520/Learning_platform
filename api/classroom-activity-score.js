const { json, readJsonBody } = require('./_lib/r2');

const DEFAULT_SUPABASE_URL = 'https://scwvbyfnnufnlimbswnk.supabase.co';
const LOCAL_DEV_ORIGINS = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000'
]);

function isAllowedScoreSyncOrigin(origin) {
    if (!origin) return false;
    if (LOCAL_DEV_ORIGINS.has(origin)) return true;

    try {
        const url = new URL(origin);
        return url.protocol === 'https:' && /^pub-[a-z0-9-]+\.r2\.dev$/i.test(url.hostname);
    } catch (_) {
        return false;
    }
}

function setCorsHeaders(req, res) {
    const origin = req.headers.origin;
    if (!isAllowedScoreSyncOrigin(origin)) return false;

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
    return true;
}

function getSupabaseConfig() {
    const url = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).replace(/\/+$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) {
        const error = new Error('Missing SUPABASE_SERVICE_ROLE_KEY for activity score sync.');
        error.statusCode = 500;
        throw error;
    }
    return { url, serviceKey };
}

function clampNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.round(number)));
}

function normalizeUuid(value, fieldName) {
    const text = String(value || '').trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
        const error = new Error(`Invalid or missing ${fieldName}.`);
        error.statusCode = 400;
        throw error;
    }
    return text;
}

function normalizeCompletedDays(value, fallbackDay) {
    const days = Array.isArray(value) ? value : [];
    const normalized = new Set(days.map(Number).filter((day) => Number.isFinite(day) && day > 0));
    if (fallbackDay) normalized.add(Number(fallbackDay));
    return [...normalized].sort((a, b) => a - b);
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

async function selectSingle(path, errorMessage) {
    const rows = await supabaseFetch(path);
    if (!Array.isArray(rows) || rows.length === 0) {
        const error = new Error(errorMessage);
        error.statusCode = 404;
        throw error;
    }
    return rows[0];
}

async function upsertActivitySubmission(payload) {
    const rows = await supabaseFetch(
        'activity_submissions?on_conflict=assignment_id,student_id,activity_slug,day_number',
        {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(payload)
        }
    );
    return rows?.[0] || null;
}

async function upsertAssignmentSubmission(payload) {
    const rows = await supabaseFetch(
        'assignment_submissions?on_conflict=assignment_id,student_id',
        {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
            body: JSON.stringify(payload)
        }
    );
    return rows?.[0] || null;
}

async function updateClassroomPoints({ classroomId, studentId, assignmentSubmissionId, totalScore, activitySlug }) {
    const query = [
        `classroom_id=eq.${encodeURIComponent(classroomId)}`,
        `student_id=eq.${encodeURIComponent(studentId)}`,
        `assignment_submission_id=eq.${encodeURIComponent(assignmentSubmissionId)}`,
        'select=id'
    ].join('&');
    const existingRows = await supabaseFetch(`classroom_points?${query}`);
    const payload = {
        classroom_id: classroomId,
        student_id: studentId,
        profile_id: studentId,
        assignment_submission_id: assignmentSubmissionId,
        points: totalScore
    };

    if (existingRows?.[0]?.id) {
        await supabaseFetch(`classroom_points?id=eq.${encodeURIComponent(existingRows[0].id)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify(payload)
        });
        return existingRows[0].id;
    }

    const rows = await supabaseFetch('classroom_points', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
    });
    return rows?.[0]?.id || null;
}

async function getStudentClassroomPoints(classroomId, studentId) {
    const rows = await supabaseFetch(
        [
            'classroom_points?',
            `classroom_id=eq.${encodeURIComponent(classroomId)}`,
            `&student_id=eq.${encodeURIComponent(studentId)}`,
            '&select=points'
        ].join('')
    );
    return (rows || []).reduce((sum, row) => sum + Number(row.points || 0), 0);
}

module.exports = async function handler(req, res) {
    const corsAllowed = setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') {
        if (!corsAllowed && req.headers.origin) {
            return json(res, 403, { error: 'Origin is not allowed for score sync.' });
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
        const classroomId = normalizeUuid(body.classroom_id, 'classroom_id');
        const assignmentId = normalizeUuid(body.assignment_id, 'assignment_id');
        const studentId = normalizeUuid(body.student_id, 'student_id');
        const activitySlug = String(body.activity_slug || '').trim();
        const dayNumber = clampNumber(body.day_number, 1, 365);
        const dayScore = clampNumber(body.day_score ?? body.unit_score, 0, 100);
        const totalDays = clampNumber(body.total_days || 7, 1, 365);

        if (!activitySlug) {
            return json(res, 400, { error: 'Missing activity_slug.' });
        }

        await selectSingle(
            `classrooms?id=eq.${encodeURIComponent(classroomId)}&select=id`,
            'Classroom not found.'
        );
        await selectSingle(
            `assignments?id=eq.${encodeURIComponent(assignmentId)}&classroom_id=eq.${encodeURIComponent(classroomId)}&select=id,classroom_id`,
            'Assignment not found for this classroom.'
        );
        await selectSingle(
            `profiles?id=eq.${encodeURIComponent(studentId)}&select=id`,
            'Student profile not found.'
        );
        await selectSingle(
            `classroom_members?classroom_id=eq.${encodeURIComponent(classroomId)}&profile_id=eq.${encodeURIComponent(studentId)}&select=id`,
            'Student is not a member of this classroom.'
        );

        const completedDays = normalizeCompletedDays(body.completed_days, dayNumber);
        const activityPayload = {
            course_id: String(body.course_id || ''),
            classroom_id: classroomId,
            assignment_id: assignmentId,
            student_id: studentId,
            activity_slug: activitySlug,
            day_number: dayNumber,
            unit_number: clampNumber(body.unit_number || dayNumber, 1, 365),
            reading_score: clampNumber(body.reading_score || 0, 0, 100),
            listening_score: clampNumber(body.listening_score || 0, 0, 100),
            vocabulary_score: clampNumber(body.vocabulary_score || 0, 0, 100),
            day_score: dayScore,
            unit_score: clampNumber(body.unit_score ?? dayScore, 0, 100),
            total_score_so_far: clampNumber(body.total_score_so_far || dayScore, 0, totalDays * 100),
            max_score: clampNumber(body.max_score || 100, 1, 1000),
            total_days: totalDays,
            completed_days: completedDays,
            answers: body.answers && typeof body.answers === 'object' ? body.answers : {},
            metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const activitySubmission = await upsertActivitySubmission(activityPayload);
        const dayRows = await supabaseFetch(
            [
                'activity_submissions?',
                `assignment_id=eq.${encodeURIComponent(assignmentId)}`,
                `&student_id=eq.${encodeURIComponent(studentId)}`,
                `&activity_slug=eq.${encodeURIComponent(activitySlug)}`,
                '&select=day_number,day_score'
            ].join('')
        );
        const syncedCompletedDays = [...new Set((dayRows || []).map((row) => Number(row.day_number)).filter(Boolean))]
            .sort((a, b) => a - b);
        const totalScore = (dayRows || []).reduce((sum, row) => sum + Number(row.day_score || 0), 0);
        const progressPercent = Math.min(100, Math.round((syncedCompletedDays.length / totalDays) * 100));
        const status = progressPercent >= 100 ? 'completed' : 'submitted';

        const assignmentSubmission = await upsertAssignmentSubmission({
            assignment_id: assignmentId,
            classroom_id: classroomId,
            student_id: studentId,
            status,
            note: `Activity progress: ${syncedCompletedDays.length}/${totalDays} days`,
            points_awarded: totalScore,
            score: totalScore,
            progress_percent: progressPercent,
            completed_days: syncedCompletedDays,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        const pointsRowId = await updateClassroomPoints({
            classroomId,
            studentId,
            assignmentSubmissionId: assignmentSubmission.id,
            totalScore,
            activitySlug
        });
        const studentClassroomPoints = await getStudentClassroomPoints(classroomId, studentId);

        return json(res, 200, {
            success: true,
            activitySubmissionId: activitySubmission?.id || null,
            assignmentSubmissionId: assignmentSubmission?.id || null,
            classroomPointsId: pointsRowId,
            status,
            progressPercent,
            completedDays: syncedCompletedDays,
            totalScoreSoFar: totalScore,
            totalDays,
            leaderboard: {
                studentPoints: studentClassroomPoints,
                activityPoints: totalScore
            }
        });
    } catch (error) {
        const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
        return json(res, statusCode, { error: error.message || 'Could not sync activity score.' });
    }
};
