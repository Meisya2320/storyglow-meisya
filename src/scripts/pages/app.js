import routes from '../routes/routes';
import { getActiveRoute } from '../routes/url-parser';
import ApiService from '../data/api';

class App {
  #content = null;
  #drawerButton = null;
  #navigationDrawer = null;

  constructor({ navigationDrawer, drawerButton, content }) {
    this.#content = content;
    this.#drawerButton = drawerButton;
    this.#navigationDrawer = navigationDrawer;

    this._setupDrawer();
    this._setupHashChangeListener();
    this._updateDrawerButtonAriaExpanded(false);
    this._setupLogoutButton();
    this._updateHeaderAuth();
  }

  _setupDrawer() {
    this.#drawerButton.addEventListener('click', () => {
      const isOpen = this.#navigationDrawer.classList.toggle('open');
      this._updateDrawerButtonAriaExpanded(isOpen);
    });

    document.body.addEventListener('click', (event) => {
      if (
        !this.#navigationDrawer.contains(event.target) &&
        !this.#drawerButton.contains(event.target)
      ) {
        this.#navigationDrawer.classList.remove('open');
        this._updateDrawerButtonAriaExpanded(false);
      }

      this.#navigationDrawer.querySelectorAll('a').forEach((link) => {
        if (link.contains(event.target)) {
          this.#navigationDrawer.classList.remove('open');
          this._updateDrawerButtonAriaExpanded(false);
        }
      });
    });
  }

  _setupHashChangeListener() {
    window.addEventListener('hashchange', () => {
      this.renderPage();
    });
  }

  _updateDrawerButtonAriaExpanded(isOpen) {
    this.#drawerButton.setAttribute('aria-expanded', isOpen.toString());
  }

  _setupLogoutButton() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleLogout();
      });
    }
  }

  _handleLogout() {
    const confirmed = confirm('Yakin ingin keluar?');
    if (confirmed) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_name');
      
      this._updateHeaderAuth();
      
      window.location.hash = '#/auth';
      
      alert('Berhasil logout!');
    }
  }

  _updateHeaderAuth() {
    const userName = localStorage.getItem('user_name');
    
    // Desktop header actions
    const userInfoEl = document.getElementById('user-info');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (userName) {
      if (userInfoEl) {
        userInfoEl.textContent = `👋 ${userName}`;
        userInfoEl.style.display = 'inline-block';
      }
      if (logoutBtn) {
        logoutBtn.style.display = 'inline-block';
      }
      
      this._addMobileUserInfo(userName);
    } else {
      if (userInfoEl) userInfoEl.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
      
      this._removeMobileUserInfo();
    }
  }

  _addMobileUserInfo(userName) {
    const navDrawer = document.getElementById('navigation-drawer');
    let mobileUserInfo = navDrawer.querySelector('.nav-user-mobile');
    
    if (!mobileUserInfo) {
      mobileUserInfo = document.createElement('div');
      mobileUserInfo.className = 'nav-user-mobile';
      mobileUserInfo.innerHTML = `
        <span class="user-info">👋 ${userName}</span>
        <button class="btn-logout" id="mobile-logout-btn">Keluar</button>
      `;
      navDrawer.appendChild(mobileUserInfo);
      
      const mobileLogoutBtn = mobileUserInfo.querySelector('#mobile-logout-btn');
      if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this._handleLogout();
        });
      }
    } else {
      mobileUserInfo.querySelector('.user-info').textContent = `👋 ${userName}`;
    }
  }

  _removeMobileUserInfo() {
    const navDrawer = document.getElementById('navigation-drawer');
    const mobileUserInfo = navDrawer.querySelector('.nav-user-mobile');
    if (mobileUserInfo) {
      mobileUserInfo.remove();
    }
  }

  _requireAuth(url) {
  const publicPages = ['/auth'];
  
  // Jika halaman public, allow
  if (publicPages.includes(url)) {
    return true;
  }
  
  // Cek apakah ada token
  const token = localStorage.getItem('auth_token');
  
  // ✅ FIX: Jika tidak ada token, auto-login (jangan redirect loop!)
  if (!token) {
    console.log('[AUTH] No token, attempting auto-login...');
    
    // Trigger auto-login di ApiService
    ApiService.ensureAuthenticated()
      .then(() => {
        console.log('[AUTH] Auto-login success, reloading page');
        // Setelah login, render ulang halaman yang diminta
        this.renderPage();
      })
      .catch(error => {
        console.error('[AUTH] Auto-login failed:', error);
        // Jika auto-login gagal, baru redirect ke /auth
        window.location.hash = '#/auth';
      });
    
    return false;
  }
  
  return true;
}

  // Custom View Transition berdasarkan halaman
  async renderPage() {
    const url = getActiveRoute();
    const page = routes[url];

    if (!page) {
      window.location.hash = '#/';
      return;
    }

    const canAccess = this._requireAuth(url);
    if (!canAccess) {
      return;
    }

    this._updateHeaderAuth();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      // ✅ Gunakan View Transition API dengan custom animation
      if (document.startViewTransition) {
        console.log('[APP] Using View Transition API for:', url);
        
        const transition = document.startViewTransition(async () => {
          // Set view-transition-name berdasarkan route untuk custom animation
          this.#content.dataset.viewTransition = this._getTransitionName(url);
          
          this.#content.innerHTML = await page.render();
          await page.afterRender();
        });
        
        await transition.finished;
        console.log('[APP] Transition completed');
      } else {
        // Fallback untuk browser yang tidak support
        console.log('[APP] View Transition API not supported, using fallback');
        this.#content.innerHTML = await page.render();
        await page.afterRender();
      }
    } catch (error) {
      console.error('[APP] Error rendering page:', error);
      this.#content.innerHTML = `
        <div class="error-container container">
          <div class="error-icon">⚠️</div>
          <h3>Terjadi Kesalahan</h3>
          <p>Maaf, halaman tidak dapat dimuat. Silakan coba lagi.</p>
          <button onclick="location.reload()" class="btn-retry">Muat Ulang</button>
        </div>
      `;
    }
  }

  // Tentukan nama transition berdasarkan route
  _getTransitionName(url) {
    if (url === '/') return 'home';
    if (url === '/auth') return 'auth';
    if (url === '/add-review' || url === '/add-story') return 'form';
    if (url === '/map') return 'map';
    if (url.startsWith('/detail')) return 'detail';
    return 'default';
  }
}

export default App;