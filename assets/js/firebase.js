import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getMessaging, getToken, isSupported } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBAB8QAVQwgTv7UUwIGW78-hI8lQakqHfs",
  authDomain: "edtechra-db7b0.firebaseapp.com",
  projectId: "edtechra-db7b0",
  storageBucket: "edtechra-db7b0.firebasestorage.app",
  messagingSenderId: "196827556166",
  appId: "1:196827556166:web:89f881d384cea76ace5d47"
};

export const firebaseVapidKey = "BNhMY3u3OCstppO2Ct4xPCFVN9vPdZJPBdbbuaFC-aZemp6h3q6EJqfpVNQA9gRcMnXoonf2gjYcLXqLF8T9nKA";

const app = initializeApp(firebaseConfig);

export async function getFirebaseMessaging() {
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  return getMessaging(app);
}

export async function requestNotificationPermission(serviceWorkerRegistration = null) {
  try {
    if (!('Notification' in window)) {
      console.warn("Notifications are not supported in this browser");
      return null;
    }

    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      console.warn("Firebase messaging is not supported in this browser");
      return null;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      const token = await getToken(messaging, {
        vapidKey: firebaseVapidKey,
        ...(serviceWorkerRegistration ? { serviceWorkerRegistration } : {})
      });

      console.log("FCM Token:", token);

      return token;
    }

    console.log("Notification permission denied");
    return null;
  } catch (error) {
    console.error("Notification error:", error);
    return null;
  }
}
