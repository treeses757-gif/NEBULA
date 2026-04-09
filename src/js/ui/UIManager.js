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
      'matchmaking-status', 'matchmaking-timer', 'radar-canvas'
    ];
    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
    this.elements.modalClose = document.querySelectorAll('.modal-close');
    this.elements.tabBtns = document.querySelectorAll('.tab-btn');
    this.elements.skinsContainer = document.getElementById('skins-container');
    this.elements.inventoryContainer = document.getElementById('inventory-container');
  }
  
  initStarfield() {
    const canvas = document.getElementById('starfield-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    this.starfieldCtx = ctx;
    
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        radius: Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.005
      });
    }
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
    
    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      
      stars.forEach(s => {
        s.phase += s.speed;
        const offsetX = Math.sin(s.phase) * 0.02;
        const offsetY = Math.cos(s.phase * 1.3) * 0.02;
        const x = (s.x + offsetX) * canvas.width;
        const y = (s.y + offsetY) * canvas.height;
        
        ctx.beginPath();
        ctx.arc(x, y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(s.phase) * 0.2})`;
        ctx.fill();
      });
      
      requestAnimationFrame(animate);
    };
    animate();
  }
  
  initFullscreen() {
    const btn = this.elements['fullscreen-btn'];
    if (!btn) {
      console.warn('Fullscreen button not found');
      return;
    }
    const icon = btn.querySelector('i');
    
    btn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        if (icon) icon.setAttribute('data-feather', 'minimize');
        document.getElementById('main-header').classList.add('fullscreen-active');
      } else {
        document.exitFullscreen();
        if (icon) icon.setAttribute('data-feather', 'maximize');
        document.getElementById('main-header').classList.remove('fullscreen-active');
      }
      if (icon) feather.replace();
    });
    
    btn.addEventListener('click', () => {
      btn.style.transform = 'rotate(15deg)';
      setTimeout(() => btn.style.transform = '', 150);
    });
  }
  
  initSearch() {
    const input = this.elements['game-search'];
    if (!input) return;
    input.addEventListener('input', () => {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => {
        this.filterGameCards(input.value.toLowerCase());
      }, 300);
    });
  }
  
  filterGameCards(query) {
    const cards = document.querySelectorAll('.game-card');
    cards.forEach(card => {
      const titleElem = card.querySelector('.game-title');
      if (!titleElem) return;
      const title = titleElem.textContent.toLowerCase();
      const shouldShow = title.includes(query) || query === '';
      
      card.style.transition = 'opacity 0.2s, transform 0.2s';
      if (!shouldShow) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.8)';
        card.style.pointerEvents = 'none';
      } else {
        card.style.opacity = '1';
        card.style.transform = '';
        card.style.pointerEvents = '';
      }
    });
  }
  
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
        const skinsTab = document.getElementById('skins-tab');
        const boostersTab = document.getElementById('boosters-tab');
        if (skinsTab) skinsTab.style.display = tab === 'skins' ? 'block' : 'none';
        if (boostersTab) boostersTab.style.display = tab === 'boosters' ? 'block' : 'none';
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
    
    this.elements['shop-btn']?.addEventListener('click', () => this.showShop());
    this.elements['inventory-btn']?.addEventListener('click', () => this.showInventory());
    this.elements['cancel-matchmaking']?.addEventListener('click', () => this.app.matchmaker.cancel());
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
    if (this.app.auth) this.app.auth.currentMode = mode;
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
  
  animateBalanceChange(from, to) {
    const el = this.elements['balance-value'];
    if (!el) return;
    const duration = 800;
    const start = performance.now();
    const update = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = this.cubicBezier(0.2, 0.9, 0.4, 1, t);
      el.textContent = Math.floor(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
  
  cubicBezier(x1, y1, x2, y2, t) {
    // Упрощенная аппроксимация для счетчика
    return t;
  }
  
  showMatchmaking() {
    const screen = this.elements['matchmaking-screen'];
    const grid = this.elements['game-grid'];
    if (screen) screen.style.display = 'flex';
    if (grid) grid.style.display = 'none';
    this.startRadarAnimation();
  }
  
  hideMatchmaking() {
    const screen = this.elements['matchmaking-screen'];
    if (screen) screen.style.display = 'none';
  }
  
  showMainMenu() {
    const gameContainer = this.elements['game-container'];
    const grid = this.elements['game-grid'];
    if (gameContainer) gameContainer.style.display = 'none';
    if (grid) grid.style.display = 'grid';
  }
  
  showGameScreen() {
    const grid = this.elements['game-grid'];
    const gameContainer = this.elements['game-container'];
    if (grid) grid.style.display = 'none';
    if (gameContainer) gameContainer.style.display = 'block';
  }
  
  hideGameScreen() {
    const gameContainer = this.elements['game-container'];
    const grid = this.elements['game-grid'];
    if (gameContainer) gameContainer.style.display = 'none';
    if (grid) grid.style.display = 'grid';
  }
  
  startRadarAnimation() {
    const canvas = this.elements['radar-canvas'];
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let angle = 0;
    const draw = () => {
      const screen = this.elements['matchmaking-screen'];
      if (!screen || screen.style.display === 'none') return;
      ctx.clearRect(0, 0, 200, 200);
      ctx.strokeStyle = '#6C5CE7';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(100, 100, 30 * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(100, 100);
      const x = 100 + Math.cos(angle) * 90;
      const y = 100 + Math.sin(angle) * 90;
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#a18aff';
      ctx.lineWidth = 2;
      ctx.stroke();
      angle += 0.05;
      requestAnimationFrame(draw);
    };
    draw();
  }
}
