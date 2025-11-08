// IndexedDB Helper untuk StoryGlow
// Fitur: Offline storage, Pending stories queue, dan Auto Sync
// Author: Meisya Pradana Mentari

const DB_NAME = 'storyglow-db';
const DB_VERSION = 1;

// Object Stores
const STORES = {
  PENDING_STORIES: 'pending-stories',
  CACHED_STORIES: 'cached-stories',
  APP_STATE: 'app-state'
};

class DBHelper {
  constructor() {
    this.db = null;
  }

  // === OPEN CONNECTION ===
  async openDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[DB] Error opening database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[DB] Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[DB] Upgrading database schema...');

        // Store untuk pending stories
        if (!db.objectStoreNames.contains(STORES.PENDING_STORIES)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_STORIES, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[DB] Created pending-stories store');
        }

        // Store untuk cached stories
        if (!db.objectStoreNames.contains(STORES.CACHED_STORIES)) {
          const cachedStore = db.createObjectStore(STORES.CACHED_STORIES, { 
            keyPath: 'id' 
          });
          cachedStore.createIndex('timestamp', 'cachedAt', { unique: false });
          console.log('[DB] Created cached-stories store');
        }

        // Store untuk app state
        if (!db.objectStoreNames.contains(STORES.APP_STATE)) {
          db.createObjectStore(STORES.APP_STATE, { keyPath: 'key' });
          console.log('[DB] Created app-state store');
        }
      };
    });
  }

  // === PENDING STORIES (untuk offline sync) ===

  // Tambah story ke pending queue
  async addPendingStory(storyData) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_STORIES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_STORIES);

      const pendingStory = {
        ...storyData,
        timestamp: Date.now(),
        status: 'pending'
      };

      const request = store.add(pendingStory);

      request.onsuccess = () => {
        console.log('[DB] Pending story added:', request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[DB] Error adding pending story:', request.error);
        reject(request.error);
      };
    });
  }

  // Ambil semua pending stories
  async getAllPendingStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_STORIES], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_STORIES);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log('[DB] Retrieved pending stories:', request.result.length);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[DB] Error getting pending stories:', request.error);
        reject(request.error);
      };
    });
  }

  // Ambil story pending by ID
  async getPendingStory(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_STORIES], 'readonly');
      const store = transaction.objectStore(STORES.PENDING_STORIES);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Hapus story dari pending queue
  async deletePendingStory(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_STORIES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_STORIES);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('[DB] Pending story deleted:', id);
        resolve();
      };

      request.onerror = () => {
        console.error('[DB] Error deleting pending story:', request.error);
        reject(request.error);
      };
    });
  }

  // Tandai story sudah disinkron ke server
  async markStoryAsSynced(id) {
    return this.deletePendingStory(id);
  }

  // Sinkronisasi semua pending story ke server
  async syncPendingStories(apiService) {
    const pendingStories = await this.getAllPendingStories();
    if (!pendingStories.length) {
      console.log('[DB] Tidak ada story yang perlu disinkron.');
      return;
    }

    console.log(`[DB] Sinkronisasi ${pendingStories.length} story...`);

    for (const story of pendingStories) {
      try {
        console.log(`[DB] Uploading story ID: ${story.id}`);
        await apiService.addStory(story);
        await this.deletePendingStory(story.id);
        console.log(`[DB] Story "${story.id}" berhasil disinkron.`);
      } catch (error) {
        console.warn(`[DB] Gagal upload story "${story.id}":`, error);
      }
    }
  }

  // Hapus semua pending stories
  async clearPendingStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PENDING_STORIES], 'readwrite');
      const store = transaction.objectStore(STORES.PENDING_STORIES);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[DB] All pending stories cleared');
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  // === CACHED STORIES (untuk offline viewing) ===

  // Cache stories dari API
  async cacheStories(stories) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_STORIES], 'readwrite');
      const store = transaction.objectStore(STORES.CACHED_STORIES);

      // ✅ Pastikan clear selesai dulu sebelum menulis ulang
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        const cachedAt = Date.now();
        stories.forEach(story => store.put({ ...story, cachedAt }));
      };

      transaction.oncomplete = () => {
        console.log('[DB] Stories cached:', stories.length);
        resolve();
      };

      transaction.onerror = () => {
        console.error('[DB] Error caching stories:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // Ambil semua cached stories
  async getCachedStories() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_STORIES], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_STORIES);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log('[DB] Retrieved cached stories:', request.result.length);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('[DB] Error getting cached stories:', request.error);
        reject(request.error);
      };
    });
  }

  // Ambil satu cached story berdasarkan ID
  async getCachedStory(id) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.CACHED_STORIES], 'readonly');
      const store = transaction.objectStore(STORES.CACHED_STORIES);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // === APP STATE ===

  async setState(key, value) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.APP_STATE], 'readwrite');
      const store = transaction.objectStore(STORES.APP_STATE);
      const request = store.put({ key, value, updatedAt: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getState(key) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.APP_STATE], 'readonly');
      const store = transaction.objectStore(STORES.APP_STATE);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }

  // === UTILITAS ===

  async getPendingCount() {
    const stories = await this.getAllPendingStories();
    return stories.length;
  }

  async hasOfflineData() {
    const pending = await this.getPendingCount();
    const cached = await this.getCachedStories();
    return pending > 0 || cached.length > 0;
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[DB] Database closed');
    }
  }
}

// Singleton instance
const dbHelper = new DBHelper();
export default dbHelper;