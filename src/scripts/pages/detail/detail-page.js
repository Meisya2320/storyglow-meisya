import ApiService from '../../data/api';
import { showFormattedDate, showLoading, showError } from '../../utils/index';
import { parseActivePathname } from '../../routes/url-parser';

export default class DetailPage {
  async render() {
    return `
      <section class="container">
        <div id="detail-content">
          <!-- Content akan dimuat di sini -->
        </div>
      </section>
    `;
  }

  async afterRender() {
    await this._loadDetail();
  }

  async _loadDetail() {
    const container = document.getElementById('detail-content');
    showLoading(container);

    try {
      const { id } = parseActivePathname();
      
      if (!id) {
        throw new Error('ID story tidak ditemukan');
      }

      console.log('[DETAIL] Loading story:', id);
      
      const story = await ApiService.getStoryDetail(id);
      
      console.log('[DETAIL] Story loaded:', story);
      
      if (!story) {
        throw new Error('Data story tidak ditemukan');
      }
      
      container.innerHTML = this._createDetailView(story);
      
      if (story.lat && story.lon) {
        setTimeout(() => {
          this._initDetailMap(story);
        }, 100);
      }
      
    } catch (error) {
      console.error('[DETAIL] Error:', error);
      showError(container, `Gagal memuat detail story: ${error.message}`);
    }
  }

  _createDetailView(story) {
    const formattedDate = showFormattedDate(story.createdAt);
    const hasLocation = story.lat && story.lon;

    return `
      <div class="detail-container">
        <div class="detail-header">
          <a href="#/" class="back-link">← Kembali ke Beranda</a>
          <h1 class="detail-title">${story.name}</h1>
          <p class="detail-date">📅 ${formattedDate}</p>
        </div>

        <div class="detail-body">
          <div class="detail-image-wrapper">
            <img 
              src="${story.photoUrl}" 
              alt="Story dari ${story.name}" 
              class="detail-image"
            />
          </div>

          <div class="detail-content">
            <h2 class="content-title">Story</h2>
            <p class="content-text">${story.description}</p>

            ${hasLocation ? `
              <div class="location-section">
                <h3 class="location-title">📍 Lokasi</h3>
                <p class="location-coords">Koordinat: ${story.lat.toFixed(6)}, ${story.lon.toFixed(6)}</p>
                <div id="detail-map" class="detail-map"></div>
              </div>
            ` : ''}

            <div class="detail-actions">
              <a href="#/add-story" class="btn-primary">✨ Buat Story Kamu</a>
              <a href="#/map" class="btn-secondary">📍 Lihat Semua di Peta</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async _initDetailMap(story) {
    if (typeof L === 'undefined') {
      await this._loadLeaflet();
    }

    const mapElement = document.getElementById('detail-map');
    if (!mapElement) return;

    const map = L.map(mapElement).setView([story.lat, story.lon], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([story.lat, story.lon]).addTo(map);
    marker.bindPopup(`<b>${story.name}</b><br>${story.description.substring(0, 100)}...`).openPopup();
  }

  async _loadLeaflet() {
    if (typeof L !== 'undefined') return;

    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload = resolve;
      document.head.appendChild(script);
    });
  }
}