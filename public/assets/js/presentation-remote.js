import { supabase } from './supabase.js';

export const PRESENTATION_REMOTE_TTL_MS = 20 * 60 * 1000;
export const PRESENTATION_REMOTE_HEARTBEAT_MS = 10000;
export const PRESENTATION_POINTER_THROTTLE_MS = 60;
export const PRESENTATION_POINTER_HIDE_MS = 1200;

const SESSION_TABLE = 'presentation_remote_sessions';
const COMMAND_TABLE = 'presentation_remote_commands';

function nowIso() {
    return new Date().toISOString();
}

function plusMs(ms) {
    return new Date(Date.now() + ms).toISOString();
}

function randomId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes || [])
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32) || `remote-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createPairingCode() {
    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
}

export function normalizePresentationNotes(rawNotes) {
    if (!rawNotes) return [];

    if (Array.isArray(rawNotes)) {
        return rawNotes.map((note) => String(note || '').trim());
    }

    if (typeof rawNotes === 'object') {
        const entries = Object.entries(rawNotes)
            .map(([key, value]) => [Number(key), String(value || '').trim()])
            .filter(([index]) => Number.isInteger(index) && index >= 0)
            .sort((a, b) => a[0] - b[0]);

        if (!entries.length) return [];

        const notes = [];
        entries.forEach(([index, value]) => {
            notes[index] = value;
        });
        return notes.map((note) => String(note || '').trim());
    }

    return String(rawNotes || '')
        .split(/\n-{3,}\n/g)
        .map((note) => note.trim());
}

export function notesToTextareaValue(notes) {
    return normalizePresentationNotes(notes).join('\n---\n');
}

export function notesFromTextareaValue(value) {
    const parsed = String(value || '')
        .split(/\n-{3,}\n/g)
        .map((note) => note.trim());

    if (!parsed.some(Boolean)) return [];
    return parsed;
}

export function getSpeakerNoteForSlide(notes, slideIndex) {
    const normalizedNotes = normalizePresentationNotes(notes);
    return String(normalizedNotes[slideIndex] || '').trim();
}

export function buildRemoteJoinUrl(sessionId, accessToken) {
    const hash = `#remote/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(accessToken)}`;
    return `${window.location.origin}${window.location.pathname}${hash}`;
}

export function parseRemoteRouteContext() {
    const rawHash = window.location.hash.replace(/^#/, '');
    const [pathPart, queryString = ''] = rawHash.split('?');
    const pathSegments = pathPart.split('/').filter(Boolean);
    const sessionId = pathSegments[1] || null;
    const params = new URLSearchParams(queryString);

    return {
        sessionId,
        accessToken: params.get('token') || '',
        queryString
    };
}

export async function cleanupExpiredPresentationSessions(hostUserId = null) {
    let query = supabase
        .from(SESSION_TABLE)
        .delete()
        .lt('expires_at', nowIso());

    if (hostUserId) {
        query = query.eq('host_user_id', hostUserId);
    }

    const { error } = await query;
    if (error) {
        console.warn('[PresentationRemote] Cleanup failed:', error);
    }
}

export async function createPresentationRemoteSession({
    presentationId,
    hostUserId,
    title = '',
    presentationNotes = [],
    currentSlideIndex = 0,
    slideCount = 1,
    isPresenting = false
}) {
    await cleanupExpiredPresentationSessions(hostUserId);

    const accessToken = randomId();
    const pairingCode = createPairingCode();
    const payload = {
        presentation_id: presentationId,
        host_user_id: hostUserId,
        title: String(title || '').trim(),
        presentation_notes: normalizePresentationNotes(presentationNotes),
        current_slide_index: Math.max(0, Number(currentSlideIndex) || 0),
        slide_count: Math.max(1, Number(slideCount) || 1),
        is_presenting: !!isPresenting,
        active_remote_id: null,
        remote_connected: false,
        pairing_code: pairingCode,
        access_token: accessToken,
        last_activity_at: nowIso(),
        expires_at: plusMs(PRESENTATION_REMOTE_TTL_MS),
        laser_pointer_visible: false,
        laser_pointer_x: null,
        laser_pointer_y: null
    };

    const { data, error } = await supabase
        .from(SESSION_TABLE)
        .insert([payload])
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function refreshPresentationRemoteSession(sessionId, patch = {}) {
    const nextPatch = {
        ...patch,
        last_activity_at: nowIso(),
        expires_at: plusMs(PRESENTATION_REMOTE_TTL_MS)
    };

    const { data, error } = await supabase
        .from(SESSION_TABLE)
        .update(nextPatch)
        .eq('id', sessionId)
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export async function deletePresentationRemoteSession(sessionId) {
    const { error } = await supabase
        .from(SESSION_TABLE)
        .delete()
        .eq('id', sessionId);

    if (error) throw error;
}

export async function getPresentationRemoteSessionById(sessionId) {
    const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select('*')
        .eq('id', sessionId)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function getPresentationRemoteSessionByCode(pairingCode) {
    const { data, error } = await supabase
        .from(SESSION_TABLE)
        .select('*')
        .eq('pairing_code', String(pairingCode || '').trim())
        .gt('expires_at', nowIso())
        .order('last_activity_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function claimPresentationRemoteSession(sessionId, remoteId, accessToken = '') {
    const query = supabase
        .from(SESSION_TABLE)
        .update({
            active_remote_id: remoteId,
            remote_connected: true,
            last_activity_at: nowIso(),
            expires_at: plusMs(PRESENTATION_REMOTE_TTL_MS)
        })
        .eq('id', sessionId)
        .or(`active_remote_id.is.null,active_remote_id.eq.${remoteId}`);

    if (accessToken) {
        query.eq('access_token', accessToken);
    }

    const { data, error } = await query.select('*').single();
    if (error) throw error;
    return data;
}

export async function releasePresentationRemoteSession(sessionId, remoteId) {
    const { data, error } = await supabase
        .from(SESSION_TABLE)
        .update({
            active_remote_id: null,
            remote_connected: false,
            laser_pointer_visible: false,
            laser_pointer_x: null,
            laser_pointer_y: null,
            last_activity_at: nowIso(),
            expires_at: plusMs(PRESENTATION_REMOTE_TTL_MS)
        })
        .eq('id', sessionId)
        .eq('active_remote_id', remoteId)
        .select('*')
        .maybeSingle();

    if (error) throw error;
    return data;
}

export async function sendPresentationRemoteCommand({
    sessionId,
    presentationId,
    remoteId,
    commandType,
    slideIndex = null,
    pointerX = null,
    pointerY = null
}) {
    const payload = {
        session_id: sessionId,
        presentation_id: presentationId,
        remote_id: remoteId,
        command_type: commandType,
        slide_index: Number.isInteger(slideIndex) ? slideIndex : null,
        pointer_x: typeof pointerX === 'number' ? pointerX : null,
        pointer_y: typeof pointerY === 'number' ? pointerY : null
    };

    const { data, error } = await supabase
        .from(COMMAND_TABLE)
        .insert([payload])
        .select('*')
        .single();

    if (error) throw error;
    return data;
}

export function createSessionSubscription(sessionId, onChange) {
    return supabase
        .channel(`presentation-session-${sessionId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: SESSION_TABLE,
            filter: `id=eq.${sessionId}`
        }, (payload) => onChange?.(payload))
        .subscribe();
}

export function createCommandSubscription(sessionId, onInsert) {
    return supabase
        .channel(`presentation-command-${sessionId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: COMMAND_TABLE,
            filter: `session_id=eq.${sessionId}`
        }, (payload) => onInsert?.(payload))
        .subscribe();
}

export async function removeChannel(channel) {
    if (!channel) return;
    try {
        await supabase.removeChannel(channel);
    } catch (error) {
        console.warn('[PresentationRemote] Channel removal failed:', error);
    }
}

export function createThrottledPointerSender(sendFn, delay = PRESENTATION_POINTER_THROTTLE_MS) {
    let lastSentAt = 0;
    let timeoutId = null;
    let queuedPayload = null;

    const flush = async () => {
        timeoutId = null;
        if (!queuedPayload) return;
        lastSentAt = Date.now();
        const payload = queuedPayload;
        queuedPayload = null;
        await sendFn(payload);
    };

    return async (payload) => {
        queuedPayload = payload;
        const elapsed = Date.now() - lastSentAt;
        if (elapsed >= delay) {
            await flush();
            return;
        }

        if (timeoutId) return;
        timeoutId = window.setTimeout(() => {
            flush().catch((error) => {
                console.warn('[PresentationRemote] Pointer flush failed:', error);
            });
        }, delay - elapsed);
    };
}
