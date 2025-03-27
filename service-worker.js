
// Service Worker for WhatsApp Translator
const CACHE_NAME = 'whatsapp-translator-cache-v1';
const OFFLINE_URL = '/';

// Lijst van assets die gecached moeten worden
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
];

// Service worker installatie - cache belangrijke assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(assetsToCache);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting on install');
        return self.skipWaiting();
      })
  );
});

// Service worker activatie - verwijder oude caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  
  return self.clients.claim();
});

// Fetch strategie - Network first, fall back to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  // Skip some Supabase requests and other dynamic content
  if (event.request.url.includes('supabase.co') || 
      event.request.url.includes('deepl.com') ||
      event.request.url.includes('api.')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Als het een valide response is, voeg toe aan cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback naar cache als network request faalt
        return caches.match(event.request)
          .then((response) => {
            if (response) {
              return response;
            }
            // Als geen cache, probeer de offline pagina
            return caches.match(OFFLINE_URL);
          });
      })
  );
});

// Background sync voor offline operaties (als nodig)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    // Implementeer hier logica voor background sync
    console.log('[Service Worker] Background sync');
  }
});
