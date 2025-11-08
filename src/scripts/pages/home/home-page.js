// 📦 Import modul yang dibutuhkan
import ApiService from '../../data/api';
import dbHelper from '../../utils/db-helper';
import { showFormattedDate, truncateText, showLoading, showError } from '../../utils/index';

export default class HomePage {
  async render() {
    return `
      <section class="hero-section">
        <div class="container">
          <div class="hero-content">
            <h1 class="hero-title">
              Bagikan <span class="highlight">Cerita</span> & Momenmu
            </h1>
            <p class="hero-subtitle">
              Berbagi pengalaman dan cerita menarik dari seluruh Dunia
            </p>
            <div class="hero-actions">
              <a href="#/add-story" class="btn-primary">
                ✨ Buat Story
              </a>
              <a href="#/map" class="btn-secondary">
                🗺️ Lihat Peta Story
              </a>
            </div>
          </div>
        </div>
      </section>

      <section class="stories-section container">
        <div class="section-header">
          <h2>Story Terbaru</h2>
          <p class="section-subtitle">Cerita dan momen dari berbagai kota</p>
        </div>
        
        <div id="stories-container" class="stories-grid">
          <!-- Stories akan dimuat di sini -->
        </div>
      </section>
    `;
  }

  async afterRender() {
    await this._loadStories();

    // ✅ Tambahkan listener ketika koneksi kembali online
    window.addEventListener('online', async () => {
      console.log('[SYNC] Koneksi kembali online — mencoba sinkronisasi...');
      await this._syncPendingStories();
    });
  }

  // ===============================
  // 1️⃣ Fungsi utama untuk memuat story
  // ===============================
  async _loadStories() {
    const container = document.getElementById('stories-container');
    showLoading(container);

    try {
      let stories;

      if (navigator.onLine) {
        console.log('[HOME] Online - Fetching from API');
        stories = await ApiService.getAllStories(true);

        // Cache hasil ke IndexedDB
        if (stories && stories.length > 0) {
          await dbHelper.cacheStories(stories);
          console.log('[HOME] Stories cached to IndexedDB');
        }

        // ✅ Saat online, juga jalankan sinkronisasi offline story (kalau ada)
        await this._syncPendingStories();
      } else {
        console.log('[HOME] Offline - Loading from cache');
        stories = await dbHelper.getCachedStories();

        if (!stories || stories.length === 0) {
          throw new Error('Tidak ada story yang di-cache. Hubungkan ke internet untuk melihat story.');
        }
      }

      if (!stories || !stories.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon" style="font-size: 5rem; margin-bottom: 20px; animation: float 3s ease-in-out infinite;">
              📖✨
            </div>
            <h3 style="font-size: 1.8rem; color: var(--text-dark); margin-bottom: 12px; font-weight: 700;">
              Belum Ada Story
            </h3>
            <p style="font-size: 1.2rem; color: var(--text-light); margin-bottom: 28px;">
              Jadilah yang pertama membagikan cerita! 💖
            </p>
            <a href="#/add-story" class="btn-primary">✨ Buat Story Pertama</a>
          </div>
        `;
        return;
      }

      container.innerHTML = stories.map(story => this._createStoryCard(story)).join('');
      console.log('[HOME] Stories rendered successfully');
      
    } catch (error) {
      console.error('[HOME] Error loading stories:', error);
      let errorMessage = 'Gagal memuat story. ';
      if (!navigator.onLine) {
        errorMessage = 'Kamu sedang offline dan belum ada story yang di-cache.';
      }
      showError(container, errorMessage);
    }
  }

  // ===============================
  // 2️⃣ Fungsi membuat tampilan kartu story
  // ===============================
  _createStoryCard(story) {
    const formattedDate = showFormattedDate(story.createdAt || story.cachedAt);
    const truncatedDesc = truncateText(story.description, 120);
    const hasLocation = story.lat && story.lon;

    return `
      <article class="story-card" onclick="location.hash='#/detail/${story.id}'">
        <div class="card-image-wrapper">
          <img 
            src="${story.photoUrl}" 
            alt="Story dari ${story.name}"
            class="card-image"
            loading="lazy"
            decoding="async"
          />
          ${hasLocation ? '<span class="location-badge">📍 Lokasi Tersedia</span>' : ''}
        </div>
        
        <div class="card-content">
          <h3 class="card-title">${story.name}</h3>
          <p class="card-date">${formattedDate}</p>
          <p class="card-description">${truncatedDesc}</p>
          <div class="card-footer">
            <span class="read-more">Baca Selengkapnya →</span>
          </div>
        </div>
      </article>
    `;
  }

  // ===============================
  // 3️⃣ Fungsi sinkronisasi story offline
  // ===============================
  async _syncPendingStories() {
    try {
      const pendingStories = await dbHelper.getPendingStories?.(); // Pastikan fungsi ini ada
      if (!pendingStories || pendingStories.length === 0) {
        console.log('[SYNC] Tidak ada story yang menunggu sinkronisasi.');
        return;
      }

      console.log(`[SYNC] Menemukan ${pendingStories.length} story untuk dikirim...`);
      for (const story of pendingStories) {
        try {
          await ApiService.addStory(story);
          await dbHelper.markStoryAsSynced(story.id);
          console.log(`[SYNC] Story "${story.name}" berhasil diunggah.`);
        } catch (uploadError) {
          console.warn(`[SYNC] Gagal mengunggah story "${story.name}":`, uploadError);
        }
      }
    } catch (err) {
      console.error('[SYNC] Terjadi kesalahan saat sinkronisasi:', err);
    }
  }
}
