import { supabase } from './supabase.js';
import { firebaseVapidKey, getFirebaseMessaging, requestNotificationPermission } from './firebase.js';

const PROMPTED_KEY = 'edtechra_fcm_permission_prompted';
const DEVICE_ID_KEY = 'edtechra_fcm_device_id';

function getNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
}

function getDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}

async function hashToken(token) {
    if (!crypto.subtle) {
        let hash = 0;
        for (let i = 0; i < token.length; i += 1) {
            hash = ((hash << 5) - hash) + token.charCodeAt(i);
            hash |= 0;
        }
        return `fallback-${Math.abs(hash)}`;
    }

    const bytes = new TextEncoder().encode(token);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

async function getServiceWorkerRegistration() {
    if (!('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker.ready.catch(() => null);
}

async function getCurrentFcmToken({ requestPermission = false } = {}) {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        return { token: null, reason: 'unsupported-browser' };
    }

    const permission = getNotificationPermission();
    if (permission === 'denied') {
        return { token: null, reason: 'permission-denied' };
    }

    const registration = await getServiceWorkerRegistration();
    if (!registration) {
        return { token: null, reason: 'missing-service-worker' };
    }

    if (permission !== 'granted') {
        if (!requestPermission) {
            return { token: null, reason: 'permission-not-granted' };
        }

        const token = await requestNotificationPermission(registration);
        return token ? { token, reason: null } : { token: null, reason: getNotificationPermission() === 'denied' ? 'permission-denied' : 'missing-token' };
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
        return { token: null, reason: 'unsupported-browser' };
    }

    const { getToken } = await import('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging.js');
    const token = await getToken(messaging, {
        vapidKey: firebaseVapidKey,
        serviceWorkerRegistration: registration
    }).catch((error) => {
        console.warn('[Notifications] Could not get FCM token:', error);
        return null;
    });

    return token ? { token, reason: null } : { token: null, reason: 'missing-token' };
}

export const Notifications = {
    async syncTokenForUser(user, { requestPermission = false } = {}) {
        if (!user?.id) return { saved: false, reason: 'missing-user' };

        const result = await getCurrentFcmToken({ requestPermission });
        if (!result.token) {
            if (!['permission-not-granted'].includes(result.reason)) {
                console.info('[Notifications] FCM token sync skipped:', result.reason);
            }
            return { saved: false, reason: result.reason };
        }

        const tokenHash = await hashToken(result.token);
        const { error } = await supabase
            .from('fcm_tokens')
            .upsert({
                user_id: user.id,
                token: result.token,
                token_hash: tokenHash,
                device_id: getDeviceId(),
                user_agent: navigator.userAgent || null,
                platform: navigator.platform || null,
                permission: getNotificationPermission(),
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,device_id' });

        if (error) {
            console.warn('[Notifications] Could not save FCM token:', error);
            return { saved: false, reason: 'save-failed', error };
        }

        return { saved: true, reason: null };
    },

    async maybePromptAndSync(user) {
        if (!user?.id || !('Notification' in window)) return;

        const permission = getNotificationPermission();
        if (permission === 'granted') {
            await this.syncTokenForUser(user);
            return;
        }

        if (permission === 'default' && !localStorage.getItem(PROMPTED_KEY)) {
            localStorage.setItem(PROMPTED_KEY, '1');
            await this.syncTokenForUser(user, { requestPermission: true });
        }
    }
};
