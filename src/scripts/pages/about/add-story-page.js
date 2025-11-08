import ApiService from '../../data/api';
import { compressImage, getUserLocation } from '../../utils/index';
import syncHelper from '../../utils/sync-helper';

export default class AddStoryPage {
  constructor() {
    this.selectedFile = null;
    this.userLocation = null;
    this.stream = null;
    this.isCameraMode = false;
  }

  async render() {
    return `
      <section class="container">
        <div class="page-header">
          <h1>✨ Buat Story</h1>
          <p class="page-subtitle">Ceritakan momen menarik atau pengalaman yang ingin kamu bagikan</p>
        </div>

        <!-- Offline Indicator -->
        ${!navigator.onLine ? `
          <div class="offline-indicator">
            <span class="offline-icon">📡</span>
            <div class="offline-text">
              <strong>Mode Offline</strong>
              <p>Story akan disimpan dan dikirim otomatis saat online</p>
            </div>
          </div>
        ` : ''}

        <div class="form-container">
          <form id="story-form" class="story-form">
            
            <div class="form-group">
              <label for="description" class="form-label">
                Cerita Kamu *
              </label>
              <textarea 
                id="description" 
                name="description" 
                class="form-textarea"
                rows="6"
                placeholder="Ceritakan pengalaman atau momen menarik kamu..."
                required
                aria-required="true"
              ></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">
                Foto Story *
              </label>
              
              <input 
                type="file" 
                id="photo" 
                name="photo"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                class="file-input"
                style="display: none;"
              />

              <div class="photo-options">
                <button type="button" id="btn-gallery" class="btn-photo-option">
                  📷 Pilih dari Galeri
                </button>
                <button type="button" id="btn-camera" class="btn-photo-option">
                  📸 Ambil Foto
                </button>
              </div>

              <div id="camera-capture" class="photo-source" style="display: none;">
                <div class="camera-container">
                  <video id="camera-video" class="camera-video" autoplay playsinline></video>
                  <canvas id="camera-canvas" class="camera-canvas" style="display:none;"></canvas>
                  <div class="camera-controls">
                    <button type="button" id="btn-capture" class="btn-capture">
                      📸 Ambil Foto
                    </button>
                    <button type="button" id="btn-stop-camera" class="btn-stop-camera">
                      ❌ Tutup Kamera
                    </button>
                  </div>
                </div>
              </div>

              <div id="image-preview" class="image-preview"></div>
            </div>

            <div class="form-group">
              <label class="form-label checkbox-label">
                <input 
                  type="checkbox" 
                  id="use-location" 
                  name="use-location"
                  class="form-checkbox"
                />
                <span>Gunakan lokasi saya</span>
              </label>
              <small class="form-hint">Lokasi akan ditampilkan di peta story</small>
            </div>

            <div id="form-message" class="form-message"></div>

            <div class="form-actions">
              <button type="submit" class="btn-primary btn-submit" id="submit-btn">
                <span class="btn-text">
                  ${navigator.onLine ? 'Bagikan Story' : 'Simpan Offline'}
                </span>
                <span class="btn-loader" style="display:none;">
                  <span class="spinner-small"></span> Memproses...
                </span>
              </button>
              <a href="#/" class="btn-secondary">Batal</a>
            </div>
          </form>
        </div>
      </section>

      <div id="camera-permission-modal" class="modal" style="display:none;">
        <div class="modal-content">
          <div class="modal-icon">📷</div>
          <h3>Izin Akses Kamera</h3>
          <p>Aplikasi membutuhkan akses ke kamera untuk mengambil foto. Klik "Izinkan" pada popup browser.</p>
          <div class="modal-actions">
            <button id="btn-request-camera" class="btn-primary">Minta Izin Kamera</button>
            <button id="btn-close-modal" class="btn-secondary">Batal</button>
          </div>
        </div>
      </div>
    `;
  }

  async afterRender() {
    this._setupForm();
    this._setupPhotoOptions();
    this._setupFileInput();
    this._setupCamera();
    this._setupLocationCheckbox();
    this._updateOnlineStatus();
  }

  _updateOnlineStatus() {
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn?.querySelector('.btn-text');
    
    const updateUI = () => {
      if (btnText) {
        btnText.textContent = navigator.onLine ? 'Bagikan Story' : 'Simpan Offline';
      }
    };

    window.addEventListener('online', updateUI);
    window.addEventListener('offline', updateUI);
  }

_setupPhotoOptions() {
  const btnGallery = document.getElementById('btn-gallery');
  const btnCamera = document.getElementById('btn-camera');
  const fileInput = document.getElementById('photo');
  const cameraCapture = document.getElementById('camera-capture');

  // ✅ Tombol Galeri langsung membuka file picker
  btnGallery.addEventListener('click', (e) => {
    e.preventDefault(); // ✅ Prevent default
    this.isCameraMode = false;
    this._stopCamera();
    if (cameraCapture) cameraCapture.style.display = 'none';
    
    console.log('[PHOTO] Opening gallery...');
    fileInput.click(); // Trigger file input
  });

  // ✅ Tombol Kamera membuka kamera
  btnCamera.addEventListener('click', async (e) => {
    e.preventDefault(); // ✅ Prevent default
    this.isCameraMode = true;
    if (cameraCapture) cameraCapture.style.display = 'block';
    await this._startCamera(); // ✅ Langsung start, tanpa modal
  });
}

  async _requestCameraPermission() {
    const modal = document.getElementById('camera-permission-modal');
    const btnRequest = document.getElementById('btn-request-camera');
    const btnClose = document.getElementById('btn-close-modal');

    modal.style.display = 'flex';

    btnRequest.onclick = async () => {
      modal.style.display = 'none';
      await this._startCamera();
    };

    btnClose.onclick = () => {
      modal.style.display = 'none';
      document.getElementById('camera-capture').style.display = 'none';
    };
  }

async _startCamera() {
  try {
    const video = document.getElementById('camera-video');
    
    console.log('[CAMERA] Requesting camera access...');
    
    // ✅ FIX: Request permission dengan proper constraints
    this.stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment', // Use back camera on mobile
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false // ✅ Explicitly no audio
    });
    
    video.srcObject = this.stream;
    await video.play(); // ✅ Ensure video plays
    
    console.log('[CAMERA] Camera started successfully');
    this._showMessage('✓ Kamera berhasil diaktifkan', 'success');
    
  } catch (error) {
    console.error('[CAMERA] Error accessing camera:', error);
    
    let errorMessage = 'Gagal mengakses kamera. ';
    if (error.name === 'NotAllowedError') {
      errorMessage += 'Anda menolak izin akses kamera. Silakan izinkan di pengaturan browser.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'Kamera tidak ditemukan di perangkat Anda.';
    } else if (error.name === 'NotReadableError') {
      errorMessage += 'Kamera sedang digunakan aplikasi lain.';
    } else {
      errorMessage += error.message;
    }
    
    this._showMessage(errorMessage, 'error');
    document.getElementById('camera-capture').style.display = 'none';
  }
}

  _setupCamera() {
    const btnCapture = document.getElementById('btn-capture');
    const btnStop = document.getElementById('btn-stop-camera');

    btnCapture.addEventListener('click', () => {
      this._capturePhoto();
    });

    btnStop.addEventListener('click', () => {
      this._stopCamera();
      document.getElementById('camera-capture').style.display = 'none';
    });
  }

  _capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const ctx = canvas.getContext('2d');
    const preview = document.getElementById('image-preview');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (blob) {
        this.selectedFile = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        
        const imageUrl = URL.createObjectURL(blob);
        preview.innerHTML = `
          <img src="${imageUrl}" alt="Preview foto" class="preview-image" />
          <p class="preview-caption">📷 Foto dari kamera</p>
          <button type="button" class="btn-retake" id="btn-retake">🔄 Ambil Ulang</button>
        `;

        this._stopCamera();
        document.getElementById('camera-capture').style.display = 'none';

        document.getElementById('btn-retake').addEventListener('click', async () => {
          preview.innerHTML = '';
          this.selectedFile = null;
          document.getElementById('btn-camera').click();
        });

        this._showMessage('✓ Foto berhasil diambil!', 'success');
        console.log('[CAMERA] Photo captured:', this.selectedFile.size, 'bytes');
      }
    }, 'image/jpeg', 0.9);
  }

  _stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
      console.log('[CAMERA] Camera stopped');
    }
  }

  _setupForm() {
    const form = document.getElementById('story-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this._handleSubmit(e);
    });
  }

  _setupFileInput() {
    const fileInput = document.getElementById('photo');
    const preview = document.getElementById('image-preview');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.selectedFile = file;
        
        const errors = ApiService.validateImage(file);
        if (errors.length > 0) {
          this._showMessage(errors.join(', '), 'error');
          fileInput.value = '';
          preview.innerHTML = '';
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          preview.innerHTML = `
            <img src="${e.target.result}" alt="Preview foto" class="preview-image" />
            <p class="preview-caption">📷 ${file.name}</p>
            <button type="button" class="btn-change-photo" id="btn-change-photo">🔄 Ganti Foto</button>
          `;
          
          document.getElementById('btn-change-photo').addEventListener('click', () => {
            fileInput.click();
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }

  _setupLocationCheckbox() {
    const checkbox = document.getElementById('use-location');
    checkbox.addEventListener('change', async (e) => {
      if (e.target.checked) {
        try {
          this.userLocation = await getUserLocation();
          this._showMessage('✓ Lokasi berhasil diambil', 'success');
        } catch (error) {
          this._showMessage('Gagal mendapatkan lokasi. Menggunakan lokasi default.', 'warning');
          e.target.checked = false;
        }
      } else {
        this.userLocation = null;
      }
    });
  }

  async _handleSubmit(event) {
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoader = submitBtn.querySelector('.btn-loader');

  console.log('=== SUBMIT STORY ===');
  console.log('[SUBMIT] Online status:', navigator.onLine);

  try {
    // Disable button
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';

    // Get form data
    const formData = new FormData(event.target);
    const description = formData.get('description')?.trim();

    console.log('[SUBMIT] Description length:', description?.length);

    // Validasi
    if (!this.selectedFile) {
      throw new Error('Foto wajib diupload atau diambil dari kamera');
    }

    console.log('[SUBMIT] ✓ Validation passed');

    // Compress image
    this._showMessage('Mengompres gambar...', 'info');
    const compressedFile = await compressImage(this.selectedFile, 800, 0.8);
    console.log('[SUBMIT] ✓ Image compressed:', Math.round(compressedFile.size / 1024), 'KB');

    // ✅ CHECK: Online atau Offline?
    if (!navigator.onLine) {
      console.log('[SUBMIT] OFFLINE - Saving to IndexedDB...');
      await this._saveOffline(description, compressedFile);
      return;
    }

    // ✅ ONLINE: Upload langsung
    console.log('[SUBMIT] ONLINE - Uploading to server...');
    
    const uploadData = new FormData();
    uploadData.append('description', description);
    uploadData.append('photo', compressedFile, 'story.jpg');

    if (this.userLocation) {
      uploadData.append('lat', this.userLocation.lat.toString());
      uploadData.append('lon', this.userLocation.lon.toString());
      console.log('[SUBMIT] ✓ Location added');
    }

    this._showMessage('Mengirim story ke server...', 'info');
    
    const result = await ApiService.addStoryGuest(uploadData);
    
    console.log('[SUBMIT] ✓ UPLOAD SUCCESS!', result);

    this._showMessage('✓ Story berhasil dibagikan!', 'success');
    
    this._stopCamera();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('[SUBMIT] Redirecting to home...');
    window.location.href = window.location.origin + window.location.pathname;
    
  } catch (error) {
    console.error('[SUBMIT] === ERROR ===');
    console.error('[SUBMIT]', error);
    
    let errorMessage = error.message;
    
    if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.';
    } else if (error.message.includes('CORS')) {
      errorMessage = 'Error CORS. Aplikasi harus di-deploy ke hosting untuk berfungsi dengan baik.';
    }
    
    this._showMessage(`Error: ${errorMessage}`, 'error');
    
    submitBtn.disabled = false;
    btnText.style.display = 'inline';
    btnLoader.style.display = 'none';
  }
}

// ✅ IMPROVED: Save story offline
async _saveOffline(description, photoFile) {
  try {
    console.log('[OFFLINE] === SAVING STORY OFFLINE ===');
    console.log('[OFFLINE] Description:', description.substring(0, 50) + '...');
    console.log('[OFFLINE] Photo size:', Math.round(photoFile.size / 1024), 'KB');
    console.log('[OFFLINE] Photo type:', photoFile.type);
    console.log('[OFFLINE] Has location:', !!(this.userLocation));

    await syncHelper.saveOfflineStory(
      description,
      photoFile,
      this.userLocation
    );

    console.log('[OFFLINE] ✓ Story saved to IndexedDB');

    this._showMessage(
      '✓ Story disimpan offline! Akan dikirim otomatis saat online.',
      'success'
    );

    this._stopCamera();

    await new Promise(resolve => setTimeout(resolve, 2000));

    // ✅ Redirect to home to show sync banner
    window.location.href = window.location.origin + window.location.pathname;

  } catch (error) {
    console.error('[OFFLINE] === SAVE ERROR ===');
    console.error('[OFFLINE]', error);
    throw new Error('Gagal menyimpan story offline: ' + error.message);
  }
}

  _showMessage(message, type = 'info') {
    const messageEl = document.getElementById('form-message');
    
    if (!messageEl) {
      console.warn('Form message element not found');
      return;
    }
    
    messageEl.textContent = message;
    messageEl.className = `form-message ${type}`;
    messageEl.style.display = 'block';
    
    if (type === 'success') {
      setTimeout(() => {
        if (messageEl) {
          messageEl.style.display = 'none';
        }
      }, 3000);
    }
  }

  beforeDestroy() {
    this._stopCamera();
  }
}