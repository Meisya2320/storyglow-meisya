import ApiService from '../../data/api';

export default class AuthPage {
  async render() {
    return `
      <section class="auth-container">
        <div class="container">
          <div class="auth-wrapper">
            <div class="auth-box">
              <h1 class="auth-title">StoryGlow</h1>
              <p class="auth-subtitle">Masuk untuk berbagi cerita Anda</p>

              <div class="auth-tabs">
                <button class="auth-tab active" data-tab="login">Login</button>
                <button class="auth-tab" data-tab="register">Register</button>
              </div>

              <!-- Login Form -->
              <form id="login-form" class="auth-form active">
                <div class="form-group">
                  <label for="login-email" class="form-label">Email</label>
                  <input 
                    type="email" 
                    id="login-email" 
                    name="email" 
                    class="form-input"
                    placeholder="email@example.com"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="login-password" class="form-label">Password</label>
                  <input 
                    type="password" 
                    id="login-password" 
                    name="password" 
                    class="form-input"
                    placeholder="Minimal 8 karakter"
                    required
                  />
                </div>

                <div id="login-message" class="form-message"></div>

                <button type="submit" class="btn-primary btn-full" id="login-btn">
                  <span class="btn-text">Masuk</span>
                  <span class="btn-loader" style="display:none;">
                    <span class="spinner-small"></span> Loading...
                  </span>
                </button>
              </form>

              <!-- Register Form -->
              <form id="register-form" class="auth-form">
                <div class="form-group">
                  <label for="register-name" class="form-label">Nama</label>
                  <input 
                    type="text" 
                    id="register-name" 
                    name="name" 
                    class="form-input"
                    placeholder="Nama lengkap"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="register-email" class="form-label">Email</label>
                  <input 
                    type="email" 
                    id="register-email" 
                    name="email" 
                    class="form-input"
                    placeholder="email@example.com"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="register-password" class="form-label">Password</label>
                  <input 
                    type="password" 
                    id="register-password" 
                    name="password" 
                    class="form-input"
                    placeholder="Minimal 8 karakter"
                    required
                  />
                </div>

                <div id="register-message" class="form-message"></div>

                <button type="submit" class="btn-primary btn-full" id="register-btn">
                  <span class="btn-text">Daftar</span>
                  <span class="btn-loader" style="display:none;">
                    <span class="spinner-small"></span> Loading...
                  </span>
                </button>
              </form>

              <!-- Skip / Guest Mode -->
              <div class="auth-skip">
                <a href="#/" class="skip-link-auth">Lewati dan jelajahi sebagai guest →</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  async afterRender() {
    this._setupAuthTabs();
    this._setupLoginForm();
    this._setupRegisterForm();
    this._setupGuestMode(); // ✅ TAMBAH INI
  }

  _setupAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        // Remove active from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        forms.forEach(f => f.classList.remove('active'));

        // Add active to clicked tab
        tab.classList.add('active');
        document.getElementById(`${targetTab}-form`).classList.add('active');
      });
    });
  }

  _setupLoginForm() {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const message = document.getElementById('login-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const email = formData.get('email');
      const password = formData.get('password');

      try {
        btn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';

        const result = await ApiService.login(email, password);

        this._showMessage(message, '✓ Login berhasil!', 'success');

        setTimeout(() => {
          window.location.hash = '#/';
          window.location.reload();
        }, 1000);

      } catch (error) {
        this._showMessage(message, `Error: ${error.message}`, 'error');
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
      }
    });
  }

  _setupRegisterForm() {
    const form = document.getElementById('register-form');
    const btn = document.getElementById('register-btn');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');
    const message = document.getElementById('register-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const name = formData.get('name');
      const email = formData.get('email');
      const password = formData.get('password');

      if (password.length < 8) {
        this._showMessage(message, 'Password minimal 8 karakter', 'error');
        return;
      }

      try {
        btn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-block';

        await ApiService.register(name, email, password);

        this._showMessage(message, '✓ Register berhasil! Silakan login.', 'success');

        setTimeout(() => {
          // Switch to login tab
          document.querySelector('[data-tab="login"]').click();
          form.reset();
        }, 2000);

      } catch (error) {
        this._showMessage(message, `Error: ${error.message}`, 'error');
      } finally {
        btn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
      }
    });
  }

  // ✅ NEW METHOD: Guest Mode
  _setupGuestMode() {
    const skipLink = document.querySelector('.skip-link-auth');
    
    if (skipLink) {
      skipLink.addEventListener('click', async (e) => {
        e.preventDefault();
        
        console.log('[AUTH] Guest mode activated');
        
        // Show loading message
        const authBox = document.querySelector('.auth-box');
        authBox.style.opacity = '0.6';
        authBox.style.pointerEvents = 'none';
        
        try {
          // Auto-login dengan kredensial default
          const response = await fetch('https://story-api.dicoding.dev/v1/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: 'storyglow.meisyapr@gmail.com',
              password: '12345678'
            })
          });
          
          const data = await response.json();
          
          if (data.error || !data.loginResult?.token) {
            throw new Error('Auto-login failed');
          }
          
          // Save token
          localStorage.setItem('auth_token', data.loginResult.token);
          
          // ✅ SAVE NAMA SEBAGAI "GUEST"
          localStorage.setItem('user_name', 'Guest');
          
          console.log('[AUTH] ✓ Guest login success');
          
          // Redirect ke home
          window.location.hash = '#/';
          window.location.reload();
          
        } catch (error) {
          console.error('[AUTH] Guest login error:', error);
          alert('Gagal masuk sebagai guest. Coba lagi.');
          
          authBox.style.opacity = '1';
          authBox.style.pointerEvents = 'auto';
        }
      });
    }
  }

  _showMessage(element, message, type) {
    element.textContent = message;
    element.className = `form-message ${type}`;
    element.style.display = 'block';

    if (type === 'success') {
      setTimeout(() => {
        element.style.display = 'none';
      }, 3000);
    }
  }
}