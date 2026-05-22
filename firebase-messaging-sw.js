importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js');

// Keep this config in sync with assets/js/firebase.js.
const firebaseConfig = {
  apiKey: "AIzaSyBAB8QAVQwgTv7UUwIGW78-hI8lQakqHfs",
  authDomain: "edtechra-db7b0.firebaseapp.com",
  projectId: "edtechra-db7b0",
  storageBucket: "edtechra-db7b0.firebasestorage.app",
  messagingSenderId: "196827556166",
  appId: "1:196827556166:web:89f881d384cea76ace5d47"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || 'Edtechra';
  const options = {
    body: notification.body || data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    data: {
      url: data.url || '/'
    }
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});
