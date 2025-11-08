import '../styles/styles.css';
import App from './pages/app';
import NotificationHelper from './utils/notification-helper';
import syncHelper from './utils/sync-helper';
import dbHelper from './utils/db-helper';

// PWA Installation
let deferredPrompt;

document.addEventListener('DOMContentLoaded', () => {
  // Initialize App
  const app = new App({
    drawerButton: document.getElementById('drawer-button'),
    navigationDrawer: document.getElementById('navigation-drawer'),
    content: document.getElementById('main-content'),
  });

  app.renderPage();

  // Initialize PWA Features
  initPWA();
});

// ===== PWA INITIALIZATION =====
async function initPWA() {
  console.log('[PWA] Initializing...');

  // 1. Register Service Worker
  await registerServiceWorker();

  // 2. Setup Install Banner
  setupInstallBanner();

  // 3. Setup Notification Toggle
  setupNotificationToggle();

  // 4. Setup Background Sync
  setupBackgroundSync();

  // 5. Check for pending syncs
  await checkPendingSyncs();

  console.log('[PWA] Initialization complete');
}

// ===== SERVICE WORKER REGISTRATION =====
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW] Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js');
    console.log('[SW] Registered successfully:', registration.scope);

    // Listen for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('[SW] New Service Worker found, installing...');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New SW installed, show update notification
          showUpdateNotification();
        }
      });
    });

    // Check for updates every 1 hour
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

  } catch (error) {
    console.error('[SW] Registration failed:', error);
  }
}

// ===== PWA INSTALL BANNER =====
function setupInstallBanner() {
  const installBanner = document.getElementById('pwa-install-banner');
  const btnInstall = document.getElementById('btn-install-pwa');
  const btnDismiss = document.getElementById('btn-dismiss-install');

  if (!installBanner) return;

  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt available');
    
    // Prevent the default prompt
    e.preventDefault();
    deferredPrompt = e;

    // Show custom install banner
    installBanner.style.display = 'block';
  });

  // Install button
  btnInstall?.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    // Show install prompt
    deferredPrompt.prompt();

    // Wait for user response
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted installation');
    }

    // Clear the prompt
    deferredPrompt = null;
    installBanner.style.display = 'none';
  });

  // Dismiss button
  btnDismiss?.addEventListener('click', () => {
    installBanner.style.display = 'none';
    
    // Don't show again for 7 days
    localStorage.setItem('install_dismissed', Date.now().toString());
  });

  // Check if previously dismissed
  const dismissed = localStorage.getItem('install_dismissed');
  if (dismissed) {
    const daysSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
    if (daysSince < 7) {
      installBanner.style.display = 'none';
    }
  }

  // Hide banner after app is installed
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    installBanner.style.display = 'none';
    
    // Show success message
    showNotificationMessage('✅ StoryGlow berhasil diinstall!', 'success');
  });
}

// ===== NOTIFICATION TOGGLE =====
function setupNotificationToggle() {
  const toggle = document.getElementById('notification-toggle');
  const switchEl = document.getElementById('notification-switch');
  const statusEl = document.getElementById('notification-status');
  const btnTest = document.getElementById('btn-test-notification');

  if (!toggle || !switchEl || !statusEl) {
    console.warn('[NOTIFICATION] Toggle elements not found');
    return;
  }

  // Check browser support
  if (!NotificationHelper.isSupported()) {
    toggle.style.display = 'none';
    console.warn('[NOTIFICATION] Not supported in this browser');
    return;
  }

  // Show toggle
  toggle.style.display = 'block';

  // Check current permission & subscription status
  checkNotificationStatus();

  // Handle toggle change
  switchEl.addEventListener('change', async (e) => {
    const isChecked = e.target.checked;
    
    console.log('[NOTIFICATION] Toggle changed to:', isChecked);

    try {
      const notificationHelper = new NotificationHelper();

      if (isChecked) {
        // ✅ ENABLE NOTIFICATIONS
        console.log('[NOTIFICATION] Requesting permission...');
        statusEl.textContent = 'Meminta izin...';
        
        // Step 1: Request permission
        const permission = await notificationHelper.requestPermission();
        console.log('[NOTIFICATION] Permission result:', permission);
        
        if (permission !== 'granted') {
          throw new Error('Izin notifikasi ditolak');
        }
        
        // Step 2: Subscribe
        console.log('[NOTIFICATION] Subscribing...');
        statusEl.textContent = 'Berlangganan...';
        await notificationHelper.subscribe();
        
        // Step 3: Update UI - PENTING!
        console.log('[NOTIFICATION] ✓ Subscription successful');
        statusEl.textContent = 'Aktif';
        switchEl.checked = true;
        if (btnTest) btnTest.style.display = 'block';
        
        showNotificationMessage('🔔 Notifikasi berhasil diaktifkan!', 'success');

        // Step 4: Show test notification
        setTimeout(async () => {
          console.log('[NOTIFICATION] Showing test notification...');
          try {
            await notificationHelper.showTestNotification();
          } catch (error) {
            console.error('[NOTIFICATION] Test notification error:', error);
          }
        }, 1500);

      } else {
        // ✅ DISABLE NOTIFICATIONS
        console.log('[NOTIFICATION] Unsubscribing...');
        statusEl.textContent = 'Menonaktifkan...';
        
        await notificationHelper.unsubscribe();
        
        statusEl.textContent = 'Tidak aktif';
        switchEl.checked = false;
        if (btnTest) btnTest.style.display = 'none';
        console.log('[NOTIFICATION] ✓ Unsubscribed successfully');
        
        showNotificationMessage('🔕 Notifikasi dinonaktifkan', 'info');
      }

    } catch (error) {
      console.error('[NOTIFICATION] Toggle error:', error);
      
      // Revert toggle on error
      switchEl.checked = !isChecked;
      statusEl.textContent = 'Tidak aktif';
      if (btnTest) btnTest.style.display = 'none';
      
      let errorMsg = 'Gagal mengubah pengaturan notifikasi. ';
      
      if (error.message.includes('ditolak')) {
        errorMsg = '❌ Izin notifikasi ditolak. Aktifkan di pengaturan browser:\n\n';
        errorMsg += 'Chrome: Settings → Privacy → Site Settings → Notifications\n';
        errorMsg += 'Firefox: Settings → Privacy → Permissions → Notifications';
      } else if (error.message.includes('unsupported')) {
        errorMsg = '❌ Browser tidak mendukung push notification.';
      } else {
        errorMsg += error.message;
      }
      
      showNotificationMessage(errorMsg, 'error');
      alert(errorMsg);
    }
  });

  // Manual test button
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      console.log('[NOTIFICATION] Manual test button clicked');
      const notificationHelper = new NotificationHelper();
      try {
        await notificationHelper.showTestNotification();
      } catch (error) {
        console.error('[NOTIFICATION] Manual test error:', error);
        alert('Error: ' + error.message);
      }
    });
  }

  // Check status on page load
  async function checkNotificationStatus() {
    try {
      const notificationHelper = new NotificationHelper();
      
      const permission = Notification.permission;
      console.log('[NOTIFICATION] Current permission:', permission);
      
      const isSubscribed = await notificationHelper.isSubscribed();
      console.log('[NOTIFICATION] Is subscribed:', isSubscribed);
      
      switchEl.checked = isSubscribed && permission === 'granted';
      statusEl.textContent = (isSubscribed && permission === 'granted') ? 'Aktif' : 'Tidak aktif';
      
      // Show/hide test button
      if (btnTest) {
        btnTest.style.display = (isSubscribed && permission === 'granted') ? 'block' : 'none';
      }
      
    } catch (error) {
      console.error('[NOTIFICATION] Status check error:', error);
      switchEl.checked = false;
      statusEl.textContent = 'Tidak aktif';
      if (btnTest) btnTest.style.display = 'none';
    }
  }
}

// ===== BACKGROUND SYNC SETUP =====
function setupBackgroundSync() {
  // Setup auto-sync listener
  syncHelper.setupAutoSync();

  // Listen to sync events
  syncHelper.onSyncEvent((event, data) => {
    console.log('[SYNC EVENT]', event, data);

    const syncStatus = document.getElementById('sync-status');
    const syncMessage = document.getElementById('sync-message');

    if (!syncStatus || !syncMessage) return;

    switch (event) {
      case 'sync-start':
        syncStatus.style.display = 'block';
        syncMessage.innerHTML = '⏳ Menyinkronkan story...';
        break;

      case 'story-synced':
        if (data.success) {
          syncMessage.innerHTML = `✅ Story berhasil disinkronkan!`;
        }
        break;

      case 'sync-complete':
        if (data.success > 0) {
          syncMessage.innerHTML = `${data.success} story berhasil disinkronkan!`;
          
          setTimeout(() => {
            syncStatus.style.display = 'none';
            window.location.reload();
          }, 2000);
        } else {
          syncStatus.style.display = 'none';
        }
        break;

      case 'sync-error':
        syncMessage.innerHTML = '❌ Gagal menyinkronkan story';
        setTimeout(() => {
          syncStatus.style.display = 'none';
        }, 3000);
        break;
    }
  });
  
  // Check pending on page load
  checkPendingSyncs();
  
  // Check pending setiap 5 detik
  setInterval(() => {
    checkPendingSyncs();
  }, 5000);
}

// ===== CHECK PENDING SYNCS =====
async function checkPendingSyncs() {
  try {
    const pendingCount = await syncHelper.getPendingCount();
    
    console.log('[PENDING] Checking pending syncs:', pendingCount);
    
    const syncStatus = document.getElementById('sync-status');
    const syncMessage = document.getElementById('sync-message');
    
    if (!syncStatus || !syncMessage) {
      console.warn('[PENDING] Sync status elements not found');
      return;
    }
    
    if (pendingCount > 0) {
      console.log('[SYNC] Found', pendingCount, 'pending stories');
      
      syncStatus.style.display = 'block';
      
      if (navigator.onLine) {
        syncMessage.textContent = `${pendingCount} story sedang disinkronkan...`;
      } else {
        syncMessage.textContent = `${pendingCount} story menunggu untuk disinkronkan`;
      }

      // Try to sync if online
      if (navigator.onLine) {
        console.log('[PENDING] Online, triggering sync...');
        setTimeout(() => {
          syncHelper.manualSync();
        }, 2000);
      }
    } else {
      syncStatus.style.display = 'none';
    }
  } catch (error) {
    console.error('[SYNC] Check pending error:', error);
  }
}

// ===== SHOW UPDATE NOTIFICATION =====
function showUpdateNotification() {
  const updateBanner = document.createElement('div');
  updateBanner.className = 'update-banner';
  updateBanner.innerHTML = `
    <div class="update-content">
      <span>🎉 Update tersedia!</span>
      <button id="btn-update-app" class="btn-update">Perbarui</button>
    </div>
  `;
  document.body.appendChild(updateBanner);

  document.getElementById('btn-update-app')?.addEventListener('click', () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  });
}

// ===== SHOW NOTIFICATION MESSAGE =====
function showNotificationMessage(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `pwa-notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 100);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ===== ONLINE/OFFLINE STATUS =====
window.addEventListener('online', () => {
  console.log('[NETWORK] Online');
  showNotificationMessage('✅ Koneksi kembali online', 'success');
  
  // Update app version indicator
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = 'Online ✅';
  }
  
  // Check pending syncs
  checkPendingSyncs();
});

window.addEventListener('offline', () => {
  console.log('[NETWORK] Offline');
  showNotificationMessage('📡 Kamu sedang offline', 'warning');
  
  // Update app version indicator
  const versionEl = document.getElementById('app-version');
  if (versionEl) {
    versionEl.textContent = 'Offline Mode 📡';
  }
});