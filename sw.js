// Service Worker untuk StoryGlow PWA
// Version 1.0.0

const CACHE_VERSION = 'storyglow-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const API_CACHE = `${CACHE_VERSION}-api`;

// URL base untuk cache (auto-detect)
const BASE_URL = self.location.origin + self.location.pathname.replace(/\/[^/]*$/, '/');

const STATIC_ASSETS = [
  BASE_URL,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}favicon.png`,
];

// ===== INSTALL =====
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('[SW] Some assets failed to cache:', err);
        });
      })
  );
  
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key.startsWith('storyglow-') && 
                          key !== STATIC_CACHE && 
                          key !== DYNAMIC_CACHE && 
                          key !== API_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  
  self.clients.claim();
});

// ===== FETCH =====
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (!request.url.startsWith('http')) return;
  
  // API requests: Network First
  if (url.origin === 'https://story-api.dicoding.dev') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
  
  // Static assets: Cache First
  event.respondWith(cacheFirstStrategy(request));
});

// Cache First Strategy
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      
      // ✅ FIX: Cache images dari story-api
      const url = new URL(request.url);
      if (url.hostname === 'story-api.dicoding.dev' && 
          (request.url.includes('.jpg') || 
           request.url.includes('.jpeg') || 
           request.url.includes('.png') || 
           request.url.includes('.webp'))) {
        console.log('[SW] Caching image:', request.url);
        cache.put(request, response.clone());
      } else if (url.hostname !== 'story-api.dicoding.dev') {
        // Cache static assets
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    
    // ✅ FIX: Return placeholder image jika offline
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="20">Image Offline</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    
    if (request.destination === 'document') {
      return caches.match(`${BASE_URL}offline.html`);
    }
    throw error;
  }
}

// Network First Strategy
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Network failed, using cache:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

// ===== PUSH NOTIFICATION =====
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let notificationData = {
    title: '✨ StoryGlow',
    body: 'Ada story baru! Klik untuk melihat.',
    icon: `${BASE_URL}favicon.png`,
    badge: `${BASE_URL}favicon.png`,
    tag: 'storyglow-notification',
  };
  
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || '✨ StoryGlow',
        body: data.body || 'Ada update baru!',
        icon: data.icon || `${BASE_URL}favicon.png`,
        badge: `${BASE_URL}favicon.png`,
        tag: data.tag || 'storyglow-notification',
        data: {
          url: data.url || BASE_URL,
          storyId: data.storyId || null,
        },
        actions: [
          {
            action: 'open',
            title: '👀 Lihat',
          },
          {
            action: 'close',
            title: '❌ Tutup',
          }
        ],
        requireInteraction: false,
        vibrate: [200, 100, 200],
      };
    } catch (error) {
      console.error('[SW] Push data parse error:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// ===== NOTIFICATION CLICK =====
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  const storyId = event.notification.data?.storyId;
  let targetUrl = BASE_URL;
  
  if (storyId) {
    targetUrl = `${BASE_URL}#/detail/${storyId}`;
  } else if (event.notification.data?.url) {
    targetUrl = event.notification.data.url;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.startsWith(BASE_URL) && 'focus' in client) {
            return client.focus().then(() => {
              client.postMessage({
                type: 'NAVIGATE',
                url: targetUrl
              });
            });
          }
        }
        
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-stories') {
    event.waitUntil(syncOfflineStories());
  }
});

async function syncOfflineStories() {
  try {
    const db = await openDB();
    const stories = await getAllPendingStories(db);
    
    console.log('[SW] Syncing', stories.length, 'offline stories');
    
    for (const story of stories) {
      try {
        const token = story.token;
        
        const response = await fetch('https://story-api.dicoding.dev/v1/stories', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: story.formData
        });
        
        if (response.ok) {
          console.log('[SW] Story synced:', story.id);
          await deletePendingStory(db, story.id);
        }
      } catch (error) {
        console.error('[SW] Sync failed for story:', story.id, error);
      }
    }
    
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        count: stories.length
      });
    });
    
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// ===== IndexedDB Helpers =====
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('storyglow-db', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-stories')) {
        db.createObjectStore('pending-stories', { keyPath: 'id' });
      }
    };
  });
}

function getAllPendingStories(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-stories'], 'readonly');
    const store = transaction.objectStore('pending-stories');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deletePendingStory(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-stories'], 'readwrite');
    const store = transaction.objectStore('pending-stories');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ===== MESSAGE HANDLER =====
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});