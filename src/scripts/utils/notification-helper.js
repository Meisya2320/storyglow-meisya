// Push Notification Helper untuk StoryGlow
// Improved version dengan better UX

const VAPID_PUBLIC_KEY = 'BN7-r0Svv7CxlXMC19FPeRVbc_f-d6qKbvj_JZRh8Y8La2ja04hmSD_oAyaGLFEcHyCCZCzFd4r0Uf8VqB5tXjU';

class NotificationHelper {
  constructor() {
    this.subscription = null;
  }

  static isSupported() {
    return 'Notification' in window && 
           'serviceWorker' in navigator && 
           'PushManager' in window;
  }

  static getPermissionStatus() {
    if (!NotificationHelper.isSupported()) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  async requestPermission() {
    if (!NotificationHelper.isSupported()) {
      throw new Error('Push notification tidak didukung browser ini');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Izin notifikasi ditolak');
    }

    console.log('[NOTIFICATION] Permission granted');
    return permission;
  }

  async subscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('[NOTIFICATION] Service Worker ready, subscribing...');

      let subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        console.log('[NOTIFICATION] Already subscribed');
        this.subscription = subscription;
        return subscription;
      }

      const applicationServerKey = this._urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      console.log('[NOTIFICATION] New subscription created');
      await this._sendSubscriptionToServer(subscription);

      this.subscription = subscription;
      return subscription;
    } catch (error) {
      console.error('[NOTIFICATION] Subscribe error:', error);
      throw error;
    }
  }

  async unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        console.log('[NOTIFICATION] No active subscription');
        return;
      }

      await subscription.unsubscribe();
      console.log('[NOTIFICATION] Unsubscribed successfully');
      await this._removeSubscriptionFromServer(subscription);
      this.subscription = null;
    } catch (error) {
      console.error('[NOTIFICATION] Unsubscribe error:', error);
      throw error;
    }
  }

  async isSubscribed() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  }

  async getSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      return await registration.pushManager.getSubscription();
    } catch {
      return null;
    }
  }

  async _sendSubscriptionToServer(subscription) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.warn('[NOTIFICATION] No auth token, skipping server registration');
        return;
      }

      const response = await fetch('https://story-api.dicoding.dev/v1/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      if (!response.ok) {
        console.warn('[NOTIFICATION] Server registration not supported');
      } else {
        console.log('[NOTIFICATION] Subscription registered to server');
      }
    } catch (error) {
      console.warn('[NOTIFICATION] Server registration skipped:', error.message);
    }
  }

  async _removeSubscriptionFromServer(subscription) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      await fetch('https://story-api.dicoding.dev/v1/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      console.log('[NOTIFICATION] Subscription removed from server');
    } catch (error) {
      console.warn('[NOTIFICATION] Server unsubscribe skipped:', error.message);
    }
  }

  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Show test notification (untuk debugging)
  async showTestNotification() {
    if (!NotificationHelper.isSupported()) {
      console.warn('[NOTIFICATION] Not supported');
      return;
    }

    const permission = Notification.permission;
    console.log('[NOTIFICATION] Current permission:', permission);

    if (permission !== 'granted') {
      console.warn('[NOTIFICATION] Permission not granted');
      alert('Izin notifikasi belum diberikan. Aktifkan toggle notification terlebih dahulu.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('[NOTIFICATION] Service Worker ready, showing notification...');

      await registration.showNotification('🎉 Notifikasi Berhasil!', {
        body: 'Push notification StoryGlow sudah aktif! Anda akan mendapat update story terbaru.',
        icon: './favicon.png',
        badge: './favicon.png',
        tag: 'storyglow-test',
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: { url: window.location.href },
        actions: [
          { action: 'explore', title: '✨ Jelajahi' },
          { action: 'close', title: '✓ OK' },
        ],
      });

      console.log('[NOTIFICATION] Test notification shown');
    } catch (error) {
      console.error('[NOTIFICATION] Show test error:', error);
      alert('Gagal menampilkan notifikasi: ' + error.message);
    }
  }
}

export default NotificationHelper;
