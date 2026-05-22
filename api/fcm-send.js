const crypto = require('crypto');
const {
    json,
    readJsonBody,
    requireAdmin
} = require('./_lib/r2');

const SUPABASE_URL = 'https://scwvbyfnnufnlimbswnk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_C2V14zNYsM-H5jtRZOQahw_yxdhpV9z';

const REQUIRED_FCM_ENV = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];

function base64Url(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function getPrivateKey() {
    return String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

function getMissingFcmEnv() {
    return REQUIRED_FCM_ENV.filter((name) => !process.env[name]);
}

async function getGoogleAccessToken() {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claim = {
        iss: process.env.FIREBASE_CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    };
    const unsignedJwt = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
    const signature = crypto.createSign('RSA-SHA256').update(unsignedJwt).sign(getPrivateKey(), 'base64url');

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${unsignedJwt}.${signature}`
        })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Firebase auth failed: ${response.status} ${errorText}`.trim());
    }

    const payload = await response.json();
    return payload.access_token;
}

async function supabaseGet(path, accessToken) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${accessToken}`
        }
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Supabase query failed: ${response.status} ${errorText}`.trim());
    }

    return response.json();
}

async function getSubmission(accessToken, submissionId) {
    const params = new URLSearchParams({
        id: `eq.${submissionId}`,
        select: 'id,author_id,status'
    });
    const rows = await supabaseGet(`submissions?${params.toString()}`, accessToken);
    return rows?.[0] || null;
}

async function getTokens(accessToken, userId = null) {
    const params = new URLSearchParams({
        select: 'id,user_id,token'
    });

    if (userId) {
        params.set('user_id', `eq.${userId}`);
    }

    const rows = await supabaseGet(`fcm_tokens?${params.toString()}`, accessToken);
    return (rows || []).filter((row) => row?.token);
}

async function sendFcmMessage(accessToken, token, notification, data = {}) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: {
                token,
                notification,
                data,
                webpush: {
                    fcm_options: {
                        link: data.url || '/'
                    }
                }
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`FCM send failed: ${response.status} ${errorText}`.trim());
    }

    return response.json();
}

async function sendToTokens(tokens, notification, data) {
    if (!tokens.length) {
        return { sent: 0, failed: 0 };
    }

    const googleAccessToken = await getGoogleAccessToken();
    const results = await Promise.allSettled(
        tokens.map((row) => sendFcmMessage(googleAccessToken, row.token, notification, data))
    );

    return results.reduce((summary, result) => {
        if (result.status === 'fulfilled') summary.sent += 1;
        else {
            summary.failed += 1;
            console.warn('[FCM] Failed send:', result.reason?.message || result.reason);
        }
        return summary;
    }, { sent: 0, failed: 0 });
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return json(res, 405, { error: 'Method not allowed.' });
    }

    try {
        const missingEnv = getMissingFcmEnv();
        if (missingEnv.length) {
            return json(res, 500, {
                error: `Notifications are not configured. Missing ${missingEnv.join(', ')}.`,
                code: 'FCM_CONFIG_MISSING',
                missingEnv
            });
        }

        const { accessToken } = await requireAdmin(req);
        const body = await readJsonBody(req);

        if (body.event !== 'work-approved') {
            return json(res, 400, { error: 'Unsupported notification event.' });
        }

        if (!body.submissionId) {
            return json(res, 400, { error: 'Missing submissionId.' });
        }

        const submission = await getSubmission(accessToken, body.submissionId);
        if (!submission) {
            return json(res, 404, { error: 'Submission not found.' });
        }

        if (submission.status !== 'approved') {
            return json(res, 200, { sent: 0, failed: 0, skipped: true, reason: 'submission-not-approved' });
        }

        const creatorTokens = await getTokens(accessToken, submission.author_id);
        const allTokens = await getTokens(accessToken);
        const feedTokens = allTokens.filter((row) => row.user_id !== submission.author_id);

        const workApproved = await sendToTokens(
            creatorTokens,
            {
                title: 'Work Approved',
                body: 'Your work has been approved and is now live on Edtechra.'
            },
            {
                event: 'work-approved',
                submissionId: String(submission.id),
                url: `/#detail/${submission.id}`
            }
        );

        const newFeedPost = await sendToTokens(
            feedTokens,
            {
                title: 'New Feed Post',
                body: 'New creative work has been posted on Edtechra.'
            },
            {
                event: 'new-feed-post',
                submissionId: String(submission.id),
                url: '/#explore'
            }
        );

        return json(res, 200, {
            sent: workApproved.sent + newFeedPost.sent,
            failed: workApproved.failed + newFeedPost.failed,
            workApproved,
            newFeedPost,
            creatorExcludedFromFeed: true
        });
    } catch (error) {
        console.error('[FCM] Notification handler failed:', error);
        return json(res, 500, { error: error.message || 'Notification send failed.' });
    }
};
