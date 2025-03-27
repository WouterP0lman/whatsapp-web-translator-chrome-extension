
// Service Worker for WhatsApp Translator
const CACHE_NAME = 'whatsapp-translator-cache-v2';
const OFFLINE_URL = '/offline.html';

// Assets to cache for optimal performance
const assetsToCache = [
  '/',
  '/index.html',
  '/chrome-extension',
  '/privacy-policy',
  '/terms-of-service',
  '/contact',
  '/icons/icon16.png',
  '/icons/icon32.png',
  '/icons/icon48.png',
  '/icons/icon128.png',
  '/placeholder.svg',
  '/manifest.webmanifest',
  '/src/index.css',
];

// Optimized installation for faster caching
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell and content');
        return cache.addAll(assetsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting on install');
        return self.skipWaiting();
      })
  );
});

// Optimized activation with clean cache management
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
    .then(() => {
      console.log('[Service Worker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Advanced fetch strategy - Stale-while-revalidate for better performance
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and certain URLs
  if (event.request.method !== 'GET') return;
  
  // Skip API requests and other dynamic content
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('deepl.com') ||
      event.request.url.includes('api.')) {
    return;
  }
  
  // Stale-while-revalidate for HTML navigation requests
  if (event.request.mode === 'navigate' || 
      (event.request.headers.get('accept') && 
       event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // Update cache with fresh content
              if (networkResponse && networkResponse.status === 200) {
                const cacheCopy = networkResponse.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, cacheCopy));
              }
              return networkResponse;
            })
            .catch(() => {
              // If both cache and network fail, serve offline page
              return caches.match(OFFLINE_URL);
            });
            
          // Return cached response immediately if available, otherwise wait for network
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }
  
  // Cache-first strategy for assets (images, stylesheets, scripts, etc.)
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // For cached responses, fetch update in background (no await)
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => cache.put(event.request, networkResponse));
              }
            })
            .catch(() => console.log('[Service Worker] Update failed, but cached version available'));
            
          return cachedResponse;
        }
        
        // If not in cache, fetch from network and cache
        return fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }
            
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(() => {
            // For failed image requests, return placeholder
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
              return caches.match('/placeholder.svg');
            }
            return caches.match(OFFLINE_URL);
          });
      })
  );
});

// Background sync for better offline experience
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[Service Worker] Syncing background data');
    // Implement background sync logic here
  }
});

// Push notification support
self.addEventListener('push', (event) => {
  if (event && event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icons/icon128.png',
      badge: '/icons/icon32.png'
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});
