import ApiService from '../../data/api';
import CONFIG from '../../utils/config';
import { showFormattedDate } from '../../utils/index';

export default class MapPage {
  constructor() {
    this.map = null;
    this.markers = [];
    this.stories = [];
    this.currentHighlightedMarker = null;
  }

  async render() {
    return `
      <section class="container">
        <div class="page-header">
          <h1>Peta Sebaran Story</h1>
          <p class="page-subtitle">Lihat lokasi story dari seluruh Dunia</p>
        </div>

        <div class="map-container">
          <div id="map" class="map-view"></div>
          <div class="map-legend">
            <h4>Legend:</h4>
            <div class="legend-item">
              <span class="legend-marker">📍</span>
              <span>Lokasi Story</span>
            </div>
            <p class="legend-note">Klik marker untuk melihat detail story</p>
          </div>
        </div>

        <div class="map-stats" id="map-stats">
          <div class="stat-card">
            <span class="stat-number" id="total-stories">0</span>
            <span class="stat-label">Total Story</span>
          </div>
          <div class="stat-card">
            <span class="stat-number" id="stories-with-location">0</span>
            <span class="stat-label">Story Dengan Lokasi</span>
          </div>
        </div>

        <!-- Story List Sidebar (Optional) -->
        <div id="story-list" class="story-list-sidebar"></div>
      </section>
    `;
  }

  async afterRender() {
    await this._loadLeaflet();
    await this._initializeMap();
    await this._loadMarkersFromAPI();
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

  async _initializeMap() {
    const mapElement = document.getElementById('map');
    
    this.map = L.map(mapElement).setView(
      CONFIG.MAP.DEFAULT_CENTER, 
      CONFIG.MAP.DEFAULT_ZOOM
    );

    // Multiple Tile Layers (Layer Control)
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    });

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19,
    });

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenTopoMap',
      maxZoom: 17,
    });

    // Default layer
    streetLayer.addTo(this.map);

    // Layer control untuk switch antar tampilan
    const baseLayers = {
      "🗺️ Peta Jalan": streetLayer,
      "🛰️ Satelit": satelliteLayer,
      "🏔️ Topografi": topoLayer
    };

    L.control.layers(baseLayers, null, {
      position: 'topright',
      collapsed: false
    }).addTo(this.map);
  }

  async _loadMarkersFromAPI() {
    try {
      console.log('[MAP] Loading stories for markers...');
      this.stories = await ApiService.getAllStories(true);
      
      console.log('[MAP] Total stories:', this.stories.length);
      
      // Filter stories yang punya lokasi
      const storiesWithLocation = this.stories.filter(s => s.lat && s.lon);
      
      console.log('[MAP] Stories with location:', storiesWithLocation.length);
      
      // Update stats
      document.getElementById('total-stories').textContent = this.stories.length;
      document.getElementById('stories-with-location').textContent = storiesWithLocation.length;

      if (!storiesWithLocation.length) {
        console.log('[MAP] No stories with location');
        this._showMapNotification('Belum ada story dengan lokasi. Yuk, bagikan story dengan lokasi! 📍');
        return;
      }

      // Render story list di sidebar (jika ada)
      const listContainer = document.getElementById('story-list');
      if (listContainer) {
        this._renderStoryList(storiesWithLocation);
      }

      // Tambahkan marker untuk setiap story
      storiesWithLocation.forEach(story => {
        console.log('[MAP] Adding marker for:', story.name, story.lat, story.lon);
        this._addMarker(story);
      });

      // Fit bounds jika ada marker
      if (storiesWithLocation.length > 0) {
        const bounds = storiesWithLocation.map(s => [s.lat, s.lon]);
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
      
      console.log('[MAP] All markers added successfully');
    } catch (error) {
      console.error('[MAP] Error loading markers:', error);
      this._showMapNotification('Gagal memuat data peta. Periksa koneksi internet Anda.');
    }
  }

  _renderStoryList(stories) {
    const listContainer = document.getElementById('story-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = stories.map(story => {
      const ratingMatch = story.description.match(/\[(★+☆*)\]/);
      const rating = ratingMatch ? ratingMatch[1] : '';
      
      return `
        <div class="story-list-item" data-story-id="${story.id}">
          <img src="${story.photoUrl}" alt="${story.name}" class="story-thumb" />
          <div class="story-info">
            <h4>${story.name}</h4>
            ${rating ? `<div class="story-rating">${rating}</div>` : ''}
            <p class="story-date">${showFormattedDate(story.createdAt)}</p>
          </div>
          <button class="btn-locate" data-story-id="${story.id}" title="Tampilkan di peta">
            📍
          </button>
        </div>
      `;
    }).join('');

    // Event listener untuk highlight marker
    listContainer.querySelectorAll('.btn-locate').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const storyId = e.target.dataset.storyId;
        this._highlightStory(storyId);
      });
    });

    // Event listener untuk klik item
    listContainer.querySelectorAll('.story-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn-locate')) {
          const storyId = item.dataset.storyId;
          this._highlightStory(storyId);
        }
      });
    });
  }

  _highlightStory(storyId) {
    const story = this.stories.find(s => s.id === storyId);
    if (!story) return;

    // Remove previous highlight
    if (this.currentHighlightedMarker) {
      this.currentHighlightedMarker.setIcon(this._createDefaultIcon());
    }

    // Find and highlight new marker
    const markerData = this.markers.find(m => m.storyId === storyId);
    if (markerData) {
      markerData.marker.setIcon(this._createHighlightIcon());
      this.currentHighlightedMarker = markerData.marker;
      
      // Pan to marker dengan smooth animation
      this.map.flyTo([story.lat, story.lon], 15, {
        duration: 1.5,
        easeLinearity: 0.5
      });
      
      // Open popup
      markerData.marker.openPopup();

      // Highlight item di list
      const listItems = document.querySelectorAll('.story-list-item');
      if (listItems.length > 0) {
        listItems.forEach(item => {
          item.classList.remove('highlighted');
        });
        const listItem = document.querySelector(`.story-list-item[data-story-id="${storyId}"]`);
        if (listItem) {
          listItem.classList.add('highlighted');
          listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }

  _createDefaultIcon() {
    return L.divIcon({
      html: '<div class="custom-marker">📍</div>',
      className: 'custom-marker-wrapper',
      iconSize: [30, 30],
      iconAnchor: [15, 30],
      popupAnchor: [0, -30]
    });
  }

  _createHighlightIcon() {
    return L.divIcon({
      html: '<div class="custom-marker highlighted">📍</div>',
      className: 'custom-marker-wrapper',
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });
  }

  _addMarker(story) {
    const marker = L.marker([story.lat, story.lon], {
      icon: this._createDefaultIcon()
    }).addTo(this.map);
    
    const ratingMatch = story.description.match(/\[(★+☆*)\]/);
    const rating = ratingMatch ? ratingMatch[1] : '';
    let displayDesc = story.description.replace(/\[(★+☆*)\]\s*/, '');
    displayDesc = displayDesc.replace(/Story dari [^:]+:\s*\n*/, '');
    
    const popupContent = `
      <div class="map-popup">
        <img src="${story.photoUrl}" alt="Story ${story.name}" class="popup-image" />
        <div class="popup-content">
          ${rating ? `<div class="popup-rating">${rating}</div>` : ''}
          <h4>${story.name}</h4>
          <p class="popup-date">${showFormattedDate(story.createdAt)}</p>
          <p class="popup-description">${displayDesc.substring(0, 100)}...</p>
          <a href="#/detail/${story.id}" class="popup-link">Lihat Detail →</a>
        </div>
      </div>
    `;
    
    marker.bindPopup(popupContent, { maxWidth: 300 });
    
    // Event saat marker diklik
    marker.on('click', () => {
      this._highlightStory(story.id);
    });
    
    this.markers.push({ storyId: story.id, marker });
  }

  _showMapNotification(message) {
    const notification = L.control({ position: 'bottomright' });
    notification.onAdd = function() {
      const div = L.DomUtil.create('div', 'map-notification');
      div.innerHTML = `
        <div style="
          background: white;
          padding: 16px 20px;
          border-radius: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          max-width: 300px;
          font-family: 'Segoe UI', sans-serif;
          z-index: 700;
        ">
          <p style="margin: 0 0 12px 0; color: #666; line-height: 1.6;">${message}</p>
          <a href="#/add-story" style="
            display: inline-block;
            padding: 8px 16px;
            background: linear-gradient(135deg, #FF69B4, #FF8FA3);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 14px;
          ">Buat Story</a>
        </div>
      `;
      return div;
    };
    notification.addTo(this.map);
  }
}