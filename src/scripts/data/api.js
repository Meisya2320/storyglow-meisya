import CONFIG from '../utils/config';

const ENDPOINTS = {
  REGISTER: `${CONFIG.BASE_URL}/register`,
  LOGIN: `${CONFIG.BASE_URL}/login`,
  STORIES: `${CONFIG.BASE_URL}/stories`,
  STORIES_GUEST: `${CONFIG.BASE_URL}/stories/guest`,
  STORY_DETAIL: (id) => `${CONFIG.BASE_URL}/stories/${id}`,
};

class ApiService {
  // Register user baru
  static async register(name, email, password) {
    try {
      const response = await fetch(ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Register failed');
      }
      
      return data;
    } catch (error) {
      console.error('[API] Register error:', error);
      throw error;
    }
  }

  // Login user
  static async login(email, password) {
    try {
      const response = await fetch(ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (data.error || !data.loginResult?.token) {
        throw new Error(data.message || 'Login failed');
      }
      
      // Simpan token
      localStorage.setItem('auth_token', data.loginResult.token);
      localStorage.setItem('user_name', data.loginResult.name);
      
      return data.loginResult;
    } catch (error) {
      console.error('[API] Login error:', error);
      throw error;
    }
  }

  // Get token dari localStorage
  static getToken() {
    return localStorage.getItem('auth_token');
  }

  // Check apakah user sudah login
  static isLoggedIn() {
    return !!this.getToken();
  }

  // Pastikan user terautentikasi
  static async ensureAuthenticated() {
    let token = this.getToken();
    
    if (token) {
      // Coba validasi token
      try {
        const testResponse = await fetch(ENDPOINTS.STORIES + '?size=1', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (testResponse.ok) return token;

        // Kalau token invalid, hapus
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_name');
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_name');
      }
    }

    // Auto-login dengan kredensial default project
    console.log('[API] Logging in with default credentials...');
    
    const credentials = {
      email: 'storyglow.meisyapr@gmail.com',
      password: '12345678',
    };
    
    try {
      const loginResult = await this.login(credentials.email, credentials.password);
      console.log('[API] ✓ Auto-login success!');
      return loginResult.token;
    } catch (error) {
      console.error('[API] Auto-login failed:', error);
      throw new Error('Authentication failed. Please refresh the page.');
    }
  }

  // Get all stories (auth)
  static async getAllStories(withLocation = true) {
    try {
      const token = await this.ensureAuthenticated();
      
      const params = withLocation ? '?location=1&size=50' : '?size=50';
      const url = ENDPOINTS.STORIES + params;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        return this.getAllStories(withLocation);
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.message || 'Failed to fetch stories');
      
      return data.listStory || [];
    } catch (error) {
      console.error('[API] Error fetching stories:', error);
      return [];
    }
  }

  // Get detail story by ID
  static async getStoryDetail(id) {
    try {
      const token = await this.ensureAuthenticated();
      
      const response = await fetch(ENDPOINTS.STORY_DETAIL(id), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        return this.getStoryDetail(id);
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.message || 'Failed to fetch detail');
      
      return data.story;
    } catch (error) {
      console.error('[API] Error fetching detail:', error);
      throw error;
    }
  }

  // Tambah story baru
  static async addStoryGuest(formData) {
    try {
      const token = await this.ensureAuthenticated();
      
      const response = await fetch(ENDPOINTS.STORIES, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      
      if (response.status === 401) {
        localStorage.removeItem('auth_token');
        return this.addStoryGuest(formData);
      }
      
      const data = await response.json();
      if (data.error) throw new Error(data.message || 'Upload failed');
      
      console.log('[API] ✓ Upload success!');
      return data;
    } catch (error) {
      console.error('[API] Upload error:', error);
      throw error;
    }
  }

  // Validasi file image
  static validateImage(file) {
    const errors = [];
    
    if (!file) errors.push('File tidak boleh kosong');
    else {
      if (!CONFIG.IMAGE.ALLOWED_TYPES.includes(file.type))
        errors.push('Format file harus JPG, PNG, atau WebP');
      if (file.size > CONFIG.IMAGE.MAX_SIZE)
        errors.push('Ukuran file maksimal 1MB');
    }
    
    return errors;
  }
}

export default ApiService;
