// ========== FILE: src/js/ui/UIManager.js ==========
export class UIManager {
  constructor(app) {
    this.app = app;
    this.elements = {};
    this.starfieldCtx = null;
    this.searchDebounceTimer = null;
  }

  init() {
    this.cacheElements();
    this.initStarfield();
    this.initFullscreen();
    this.initSearch();
    this.initModals();
    this.initEventListeners();
  }

  cacheElements() {
    const ids = [
      'guest-actions', 'user-actions', 'balance-value', 'user-avatar', 'avatar-letter',
      'login-btn', 'register-btn', 'shop-btn', 'inventory-btn', 'fullscreen-btn',
      'game-search', 'game-grid', 'matchmaking-screen', 'game-container',
      'auth-modal', 'shop-modal', 'inventory-modal', 'cancel-matchmaking',
      'auth-form', 'auth-nickname', 'auth-password', 'auth-confirm',
      'auth-submit', 'auth-modal-title', 'confirm-password-group', 'toggle-auth-mode',
      'matchmaking-status', 'matchmaking-timer', 'radar-canvas', 'skins-container', 'inventory-container'
    ];
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
    this.elements.modalClose = document.querySelectorAll('.modal-close');
    this.elements.tabBtns = document.querySelectorAll('.tab-btn');
  }

  initStarfield() { /* без изменений */ }

  initFullscreen() { /* без изменений */ }

  initSearch() { /* без изменений */ }

  filterGameCards(query) { /* без изменений */ }

  initModals() {
    this.elements.modalClose?.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
      });
    });

    this.elements.tabBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('skins-tab').style.display = tab === 'skins' ? 'block' : 'none';
        document.getElementById('boosters-tab').style.display = tab === 'boosters' ? 'block' : 'none';
      });
    });
  }

  initEventListeners() {
    this.elements['login-btn']?.addEventListener('click', () => this.showAuthModal('login'));
    this.elements['register-btn']?.addEventListener('click', () => this.showAuthModal('register'));
    this.elements['toggle-auth-mode']?.addEventListener('click', () => {
      const isLogin = this.elements['auth-modal-title'].textContent === 'Вход';
      this.showAuthModal(isLogin ? 'register' : 'login');
    });

    this.elements['auth-form']?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.app.auth.handleAuthSubmit();
    });

    this.elements['shop-btn']?.addEventListener('click', () => {
      if (!this.app.user) {
        this.showAuthModal('login');
        return;
      }
      this.showShop();
    });

    this.elements['inventory-btn']?.addEventListener('click', () => {
      if (!this.app.user) {
        this.showAuthModal('login');
        return;
      }
      this.showInventory();
    });

    this.elements['cancel-matchmaking']?.addEventListener('click', () => {
      this.app.matchmaker.cancel();
    });
  }

  renderGameGrid(games, onPlay) {
    const grid = this.elements['game-grid'];
    if (!grid) return;
    grid.innerHTML = '';
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';
      card.innerHTML = `
        <div class="game-icon">${game.icon}</div>
        <div class="game-title">${game.name}</div>
        <button class="play-btn">Играть</button>
      `;
      card.querySelector('.play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!this.app.user) {
          this.showAuthModal('login');
          return;
        }
        onPlay(game.id);
      });
      grid.appendChild(card);
    });
  }

  showAuthModal(mode) {
    const modal = this.elements['auth-modal'];
    if (!modal) return;
    const title = this.elements['auth-modal-title'];
    const confirmGroup = this.elements['confirm-password-group'];
    const submitBtn = this.elements['auth-submit']?.querySelector('.btn-text');

    if (title) title.textContent = mode === 'login' ? 'Вход' : 'Регистрация';
    if (submitBtn) submitBtn.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    if (confirmGroup) confirmGroup.style.display = mode === 'register' ? 'block' : 'none';

    this.elements['auth-form']?.reset();
    modal.classList.add('active');
    this.app.auth.currentMode = mode;
  }

  showShop() {
    this.elements['shop-modal']?.classList.add('active');
    this.app.shop.renderSkins();
  }

  showInventory() {
    this.elements['inventory-modal']?.classList.add('active');
    this.app.shop.renderInventory();
  }

  updateAuthUI(user) {
    const guestActions = this.elements['guest-actions'];
    const userActions = this.elements['user-actions'];
    if (!guestActions || !userActions) return;

    if (user) {
      guestActions.style.display = 'none';
      userActions.style.display = 'flex';
      const letterEl = this.elements['avatar-letter'];
      if (letterEl) letterEl.textContent = user.nickname.charAt(0).toUpperCase();
      this.updateBalanceDisplay(user.coins);
    } else {
      guestActions.style.display = 'flex';
      userActions.style.display = 'none';
    }
  }

  updateBalanceDisplay(coins) {
    const bal = this.elements['balance-value'];
    if (bal && coins !== undefined) {
      bal.textContent = coins;
    }
  }

  // ... остальные методы без изменений ...
}
