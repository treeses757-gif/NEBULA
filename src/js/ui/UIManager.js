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
      'auth-submit', 'auth-modal-title', 'confirm-password-group', 'toggle-auth-mode'
    ];
    ids.forEach(id => this.elements[id] = document.getElementById(id));
    this.elements.modalClose = document.querySelectorAll('.modal-close');
    this.elements.tabBtns = document.querySelectorAll('.tab-btn');
  }
  
  initStarfield() {
    const canvas = document.getElementById('starfield-canvas');
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
    const btn = this.elements.fullscreenBtn;
    const icon = btn.querySelector('i');
    
    btn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        icon.setAttribute('data-feather', 'minimize');
        document.getElementById('main-header').classList.add('fullscreen-active');
      } else {
        document.exitFullscreen();
        icon.setAttribute('data-feather', 'maximize');
        document.getElementById('main-header').classList.remove('fullscreen-active');
      }
      feather.replace();
    });
    
    // Анимация вращения
    btn.addEventListener('click', () => {
      btn.style.transform = 'rotate(15deg)';
      setTimeout(() => btn.style.transform = '', 150);
    });
  }
  
  initSearch() {
    const input = this.elements.gameSearch;
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
      const title = card.querySelector('.game-title').textContent.toLowerCase();
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
    // Закрытие по крестику и бэкдропу
    this.elements.modalClose.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
      });
    });
    
    document.querySelectorAll('.modal-backdrop').forEach(bd => {
      bd.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.remove('active');
      });
    });
    
    // Переключение вкладок магазина
    this.elements.tabBtns.forEach(btn => {
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
    this.elements.loginBtn.addEventListener('click', () => this.showAuthModal('login'));
    this.elements.registerBtn.addEventListener('click', () => this.showAuthModal('register'));
    this.elements.toggleAuthMode.addEventListener('click', () => {
      const isLogin = this.elements.authModalTitle.textContent === 'Вход';
      this.showAuthModal(isLogin ? 'register' : 'login');
    });
    
    this.elements.authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.app.auth.handleAuthSubmit();
    });
    
    this.elements.shopBtn.addEventListener('click', () => this.showShop());
    this.elements.inventoryBtn.addEventListener('click', () => this.showInventory());
    this.elements.cancelMatchmaking.addEventListener('click', () => this.app.matchmaker.cancel());
  }
  
  renderGameGrid(games, onPlay) {
    const grid = this.elements.gameGrid;
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
    const modal = this.elements.authModal;
    const title = this.elements.authModalTitle;
    const confirmGroup = this.elements.confirmPasswordGroup;
    const submitBtn = this.elements.authSubmit.querySelector('.btn-text');
    
    title.textContent = mode === 'login' ? 'Вход' : 'Регистрация';
    submitBtn.textContent = mode === 'login' ? 'Войти' : 'Зарегистрироваться';
    confirmGroup.style.display = mode === 'register' ? 'block' : 'none';
    
    this.elements.authForm.reset();
    modal.classList.add('active');
    this.app.auth.currentMode = mode;
  }
  
  showShop() {
    this.elements.shopModal.classList.add('active');
    this.app.shop.renderSkins();
  }
  
  showInventory() {
    this.elements.inventoryModal.classList.add('active');
    this.app.shop.renderInventory();
  }
  
  updateAuthUI(user) {
    if (user) {
      this.elements.guestActions.style.display = 'none';
      this.elements.userActions.style.display = 'flex';
      this.elements.avatarLetter.textContent = user.nickname.charAt(0).toUpperCase();
      this.updateBalanceDisplay(user.coins);
    } else {
      this.elements.guestActions.style.display = 'flex';
      this.elements.userActions.style.display = 'none';
    }
  }
  
  updateBalanceDisplay(coins) {
    if (coins !== undefined) {
      this.elements.balanceValue.textContent = coins;
    }
  }
  
  animateBalanceChange(from, to) {
    const el = this.elements.balanceValue;
    const duration = 800;
    const start = performance.now();
    const update = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = cubicBezier(0.2, 0.9, 0.4, 1, t);
      el.textContent = Math.floor(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }
  
  showMatchmaking() {
    this.elements.matchmakingScreen.style.display = 'flex';
    this.elements.gameGrid.style.display = 'none';
    this.startRadarAnimation();
  }
  
  hideMatchmaking() {
    this.elements.matchmakingScreen.style.display = 'none';
    this.elements.gameGrid.style.display = 'grid';
  }
  
  showMainMenu() {
    this.elements.gameContainer.style.display = 'none';
    this.elements.gameGrid.style.display = 'grid';
  }
  
  startRadarAnimation() {
    // Простая анимация радара
    const canvas = document.getElementById('radar-canvas');
    const ctx = canvas.getContext('2d');
    let angle = 0;
    const draw = () => {
      if (this.elements.matchmakingScreen.style.display === 'none') return;
      ctx.clearRect(0, 0, 200, 200);
      // Рисуем круги
      ctx.strokeStyle = '#6C5CE7';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(100, 100, 30 * i, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Вращающаяся линия
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

function cubicBezier(x1, y1, x2, y2, t) {
  // Упрощенная аппроксимация
  return t;
}