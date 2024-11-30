const CACHE_NAME = 'bubble-fish-v1';
const ASSETS = [
  './',
  './index.html',
  './game.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './music/mixkit-games-worldbeat-466.mp3'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

// Fetch event
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'scores-sync') {
    event.waitUntil(syncScores());
  }
});

// Periodic sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'scores-sync') {
    event.waitUntil(syncScores());
  }
});

// Push notification
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: 'icons/icon-192.png',
    badge: 'icons/badge-96.png'
  };
  
  event.waitUntil(
    self.registration.showNotification('Bubble Fish', options)
  );
});

async function syncScores() {
  // Implement score syncing logic here
} 