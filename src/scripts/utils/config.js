const CONFIG = {
  BASE_URL: 'https://story-api.dicoding.dev/v1',
  
  // App Info
  APP_NAME: 'StoryGlow',
  APP_TAGLINE: 'Platform Berbagi Cerita Menarik dari Seluruh Dunia',
  DEVELOPER: 'Meisya Pradana Mentari',
  
  // PWA Configuration
  PWA: {
    // VAPID Public Key dari Dicoding Story API
    VAPID_PUBLIC_KEY: 'BN7-r0Svv7CxlXMC19FPeRVbc_f-d6qKbvj_JZRh8Y8La2ja04hmSD' +
      '_oAyaGLFEcHyCCZCzFd4r0Uf8VqB5tXjU',
    
    // Service Worker
    SW_PATH: '/sw.js',
    
    // Cache Settings
    CACHE_VERSION: 'v1',
    CACHE_EXPIRATION: 24 * 60 * 60 * 1000, // 24 hours
  },
  
  // Cache keys untuk localStorage (optional, tapi kita pakai session storage)
  CACHE_KEYS: {
    STORIES: 'storyglow_stories_cache',
    LAST_FETCH: 'storyglow_last_fetch'
  },
  
  // Image config
  IMAGE: {
    MAX_SIZE: 1024 * 1024, // 1MB
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  },
  
  // Map config (Leaflet tidak perlu API key)
  MAP: {
    DEFAULT_CENTER: [-2.5489, 118.0149], // Indonesia center
    DEFAULT_ZOOM: 5,
    DETAIL_ZOOM: 13
  },
  
  // Notification Settings
  NOTIFICATION: {
    ENABLED_BY_DEFAULT: false,
    SHOW_WELCOME_NOTIFICATION: true,
  }
};

export default CONFIG;