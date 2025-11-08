// Background Sync Helper untuk StoryGlow
// Fitur: Offline story submission & auto-sync
// Author: Meisya Pradana Mentari

import dbHelper from './db-helper';

class SyncHelper {
  constructor() {
    this.isSyncing = false;
    this.listeners = [];
  }

  // Check if background sync is supported
  static isSupported() {
    return 'serviceWorker' in navigator && 'SyncManager' in window;
  }

  // Register background sync
  async registerSync(tag = 'sync-stories') {
    if (!SyncHelper.isSupported()) {
      console.warn('[SYNC] Background Sync not supported');
      // Fallback: try manual sync
      await this.manualSync();
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(tag);
      console.log('[SYNC] Background sync registered:', tag);
    } catch (error) {
      console.error('[SYNC] Registration failed:', error);
      // Fallback: try manual sync
      await this.manualSync();
    }
  }

  // Manual sync (fallback ketika background sync tidak support)
  async manualSync() {
    if (this.isSyncing) {
      console.log('[SYNC] Already syncing...');
      return;
    }

    if (!navigator.onLine) {
      console.log('[SYNC] Offline, skipping manual sync');
      return;
    }

    this.isSyncing = true;
    this._notifyListeners('sync-start', {});

    try {
      const pendingStories = await dbHelper.getAllPendingStories();
      
      if (pendingStories.length === 0) {
        console.log('[SYNC] No pending stories to sync');
        this.isSyncing = false;
        return;
      }

      console.log('[SYNC] Syncing', pendingStories.length, 'stories...');

      let successCount = 0;
      let failCount = 0;

      for (const story of pendingStories) {
        try {
          console.log('[SYNC] Processing story ID:', story.id);
          await this._syncStory(story);
          await dbHelper.deletePendingStory(story.id);
          successCount++;
          
          this._notifyListeners('story-synced', { 
            storyId: story.id,
            success: true 
          });
        } catch (error) {
          console.error('[SYNC] Failed to sync story:', story.id, error);
          failCount++;
          
          this._notifyListeners('story-synced', { 
            storyId: story.id,
            success: false,
            error: error.message 
          });
        }
      }

      console.log(`[SYNC] Complete. Success: ${successCount}, Failed: ${failCount}`);

      this._notifyListeners('sync-complete', {
        total: pendingStories.length,
        success: successCount,
        failed: failCount
      });

    } catch (error) {
      console.error('[SYNC] Manual sync error:', error);
      this._notifyListeners('sync-error', { error: error.message });
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync single story
  async _syncStory(story) {
    console.log('[SYNC] === SYNCING STORY ===');
    console.log('[SYNC] Story ID:', story.id);
    
    const token = story.token || localStorage.getItem('auth_token');
    
    if (!token) {
      console.error('[SYNC] No token available!');
      throw new Error('No authentication token');
    }

    // Reconstruct FormData
    const formData = new FormData();
    formData.append('description', story.description);
    
    console.log('[SYNC] Description:', story.description.substring(0, 50) + '...');
    
    // Convert base64 back to blob
    if (story.photoBase64) {
      console.log('[SYNC] Converting base64 to blob...');
      const blob = this._base64ToBlob(story.photoBase64, story.photoType || 'image/jpeg');
      formData.append('photo', blob, story.photoName || 'story.jpg');
      console.log('[SYNC] ✓ Photo blob created, size:', blob.size);
    } else {
      console.error('[SYNC] No photo data!');
      throw new Error('Photo data missing');
    }

    if (story.lat && story.lon) {
      formData.append('lat', story.lat.toString());
      formData.append('lon', story.lon.toString());
      console.log('[SYNC] ✓ Location added:', story.lat, story.lon);
    }

    console.log('[SYNC] Uploading to API...');
    
    // Send to API
    const response = await fetch('https://story-api.dicoding.dev/v1/stories', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    console.log('[SYNC] Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[SYNC] Upload failed:', errorData);
      throw new Error(errorData.message || 'Upload failed');
    }

    const result = await response.json();
    console.log('[SYNC] ✓✓✓ STORY SYNCED SUCCESSFULLY ✓✓✓');
    console.log('[SYNC] Result:', result);
    
    return result;
  }

  // Save story for offline (to IndexedDB)
  async saveOfflineStory(description, photoFile, location = null) {
    try {
      console.log('[SYNC] === SAVE OFFLINE STORY ===');
      
      // Convert photo to base64 untuk storage
      console.log('[SYNC] Converting photo to base64...');
      const photoBase64 = await this._fileToBase64(photoFile);
      console.log('[SYNC] ✓ Photo converted, size:', photoBase64.length, 'chars');

      const storyData = {
        description,
        photoBase64,
        photoName: photoFile.name,
        photoSize: photoFile.size,
        photoType: photoFile.type,
        lat: location?.lat || null,
        lon: location?.lon || null,
        token: localStorage.getItem('auth_token'),
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      console.log('[SYNC] Story data prepared:', {
        descLength: description.length,
        photoSize: photoFile.size,
        hasLocation: !!(location?.lat),
        hasToken: !!storyData.token
      });

      const id = await dbHelper.addPendingStory(storyData);
      console.log('[SYNC] ✓ Story saved to IndexedDB with ID:', id);

      // Trigger sync immediately if already online
      if (navigator.onLine) {
        console.log('[SYNC] Already online, triggering immediate sync...');
        setTimeout(() => {
          this.manualSync();
        }, 2000); // Wait 2 seconds
      } else {
        console.log('[SYNC] Offline, will sync when online');
        await this.registerSync();
      }

      return id;

    } catch (error) {
      console.error('[SYNC] === SAVE ERROR ===');
      console.error('[SYNC]', error);
      throw error;
    }
  }

  // Get pending stories count
  async getPendingCount() {
    return await dbHelper.getPendingCount();
  }

  // Check if there are pending stories
  async hasPendingStories() {
    const count = await this.getPendingCount();
    return count > 0;
  }

  // Listen to sync events
  onSyncEvent(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  // Notify listeners
  _notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[SYNC] Listener error:', error);
      }
    });
  }

  // Helper: Convert file to base64
  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Helper: Convert base64 to blob
  _base64ToBlob(base64, mimeType) {
    const byteString = atob(base64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([ab], { type: mimeType });
  }

  // Listen for online event to trigger sync
  setupAutoSync() {
    let syncTimeout;
    
    // Event: Device goes online
    window.addEventListener('online', async () => {
      console.log('[SYNC] === DEVICE ONLINE ===');
      console.log('[SYNC] Waiting 3 seconds for connection to stabilize...');
      
      if (syncTimeout) clearTimeout(syncTimeout);
      
      syncTimeout = setTimeout(async () => {
        console.log('[SYNC] Checking for pending stories...');
        const count = await this.getPendingCount();
        console.log('[SYNC] Pending stories:', count);
        
        if (count > 0) {
          console.log('[SYNC] Triggering manual sync...');
          await this.manualSync();
        } else {
          console.log('[SYNC] No pending stories to sync');
        }
      }, 3000); // Wait 3 seconds
    });

    // Polling: Check every 10 seconds if online and has pending
    setInterval(async () => {
      if (navigator.onLine && !this.isSyncing) {
        const count = await this.getPendingCount();
        if (count > 0) {
          console.log('[SYNC] Polling: Found', count, 'pending stories');
          await this.manualSync();
        }
      }
    }, 10000); // Every 10 seconds

    // Listen to service worker messages
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_COMPLETE') {
          console.log('[SYNC] Received sync complete message:', event.data);
          this._notifyListeners('sync-complete', event.data);
        }
      });
    }
  }
}

// Singleton instance
const syncHelper = new SyncHelper();

export default syncHelper;