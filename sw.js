const CACHE_NAME = 'bubble-fish-v1';
const ASSETS = [
  './',
  './index.html',
  './game.js',
  './manifest.json',
  './icons/bubble-fish-192.png',
  './icons/bubble-fish-512.png',
  './icons/bubble-fish-maskable-192.png',
  './icons/bubble-fish-maskable-512.png',
  './music/mixkit-games-worldbeat-466.mp3'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      })
    ))
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          // Cache new resources
          if (response.ok && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
  );
});

// Background sync
self.addEventListener('sync', event => {
  if (event.tag === 'sync-scores') {
    event.waitUntil(syncScores());
  }
});

// Periodic sync
self.addEventListener('periodicsync', event => {
  if (event.tag === 'sync-scores') {
    event.waitUntil(syncScores());
  }
});

// Push notification
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: './icons/bubble-fish-192.png',
    badge: './icons/bubble-fish-192.png'
  };
  
  event.waitUntil(
    self.registration.showNotification('Bubble Fish', options)
  );
});

// Helper functions
async function syncScores() {
  try {
    const scores = await getStoredScores();
    await fetch('/api/sync-scores', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(scores)
    });
    await clearStoredScores();
  } catch (error) {
    console.error('Score sync failed:', error);
  }
}

async function getStoredScores() {
  // Implement score storage retrieval
  return [];
}

async function clearStoredScores() {
  // Implement score storage clearing
} 