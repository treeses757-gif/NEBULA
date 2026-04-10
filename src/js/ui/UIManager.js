export class UIManager {
  constructor(app) {
    this.app = app;
    this.elements = {};
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
      'guest-actions', 'user-actions', 'balance-value', 'avatar-letter',
      'login-btn', 'register-btn', 'shop-btn', 'inventory-btn', 'create-game-btn',
      'fullscreen-btn', 'game-search', 'game-grid', 'matchmaking-screen', 'game-container',
      'auth-modal', 'shop-modal', 'inventory-modal', 'upload-modal', 'cancel-matchmaking',
      'auth-form', 'auth-nickname', 'auth-password', 'auth-confirm',
      'auth-submit', 'auth-modal-title', 'confirm-password-group', 'toggle-auth-mode',
      'matchmaking-timer', 'radar-canvas', 'skins-container', 'inventory-container',
      'upload-form', 'game-title', 'game-players', 'game-avatar', 'game-file'
    ];
    ids.forEach(id => this.elements[id] = document.getElementById(id));
    this.elements.modalClose = document.querySelectorAll('.modal-close');
    this.elements.tabBtns = document.querySelectorAll('.tab-btn');
  }

  initStarfield() {
    const canvas = document.getElementById('starfield-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const stars = [];
    for (let i = 0; i < 150; i++) {
      stars.push({ x: Math.random(), y: Math.random(), radius: Math.random() * 1.5, phase: Math.random() * Math.PI * 2 });
    }
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.phase += 0.005;
        const x = (s.x + Math.sin(s.phase) * 0.02) * canvas.width;
        const y = (s.y + Math.cos(s.phase) * 0.02) * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, s.radius, 0, 2*Math.PI);
        ctx.fillStyle = `rgba(255,255,255,${0.5+Math.sin(s.phase)*0.2})`;
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
      } else {
        document.exitFullscreen();
        icon.setAttribute('data-feather', 'maximize');
      }
      feather.replace();
      btn.style.transform = 'rotate(15deg)';
      setTimeout(() => btn.style.transform = '', 150);
    });
  }

  initSearch() {
    const input = this.elements.gameSearch;
    input.addEventListener('input', () => {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = setTimeout(() => this.filterGames(input.value), 300);
    });
  }

  filterGames(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.game-card').forEach(card => {
      const title = card.querySelector('.game-title')?.textContent.toLowerCase() || '';
      const match = title.includes(q);
      card.style.transition = 'opacity 0.2s, transform 0.2s';
      card.style.opacity = match ? '1' : '0';
      card.style.transform = match ? '' : 'scale(0.8)';
      card.style.pointerEvents = match ? '' : 'none';
    });
  }

  initModals() {
    this.elements.modalClose?.forEach(btn => btn.addEventListener('click', e => e.target.closest('.modal').classList.remove('active')));
    document.querySelectorAll('.modal-backdrop').forEach(bd => bd.addEventListener('click', e => e.target.closest('.modal').classList.remove('active')));
    this.elements.tabBtns?.forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('skins-tab').style.display = btn.dataset.tab === 'skins' ? 'block' : 'none';
      document.getElementById('boosters-tab').style.display = btn.dataset.tab === 'boosters' ? 'block' : 'none';
    }));
  }

  initEventListeners() {
    this.elements.loginBtn.onclick = () => this.showAuthModal('login');
    this.elements.registerBtn.onclick = () => this.showAuthModal('register');
    this.elements.toggleAuthMode.onclick = () => this.showAuthModal(this.elements.authModalTitle.textContent === 'Вход' ? 'register' : 'login');
    this.elements.authForm.onsubmit = e => { e.preventDefault(); this.app.auth.handleAuthSubmit(); };
    this.elements.shopBtn.onclick = () => { if (!this.app.user) this.showAuthModal('login'); else this.showShop(); };
    this.elements.inventoryBtn.onclick = () => { if (!this.app.user) this.showAuthModal('login'); else this.showInventory(); };
    this.elements.createGameBtn.onclick = () => { if (!this.app.user) this.showAuthModal('login'); else this.elements.uploadModal.classList.add('active'); };
    this.elements.cancelMatchmaking.onclick = () => this.app.matchmaker.cancel();
    this.elements.uploadForm.onsubmit = e => { e.preventDefault(); this.app.upload.submit(); };
  }

  renderGameGrid(games, onPlay) {
    const grid = this.elements.gameGrid;
    grid.innerHTML = '';
    games.forEach(game => {
      const card = document.createElement('div');
      card.className = 'game-card';
      const iconHtml = game.avatarUrl
        ? `<img src="${game.avatarUrl}" alt="${game.name || game.title}">`
        : `<span class="game-icon-emoji">${game.icon || '🎮'}</span>`;
      card.innerHTML = `
        <div class="game-icon">${iconHtml}</div>
        <div class="game-title">${game.name || game.title}</div>
        <div class="game-players">👥 ${game.players}</div>
        <button class="play-btn">Играть</button>
      `;
      card.querySelector('.play-btn').onclick = e => { e.stopPropagation(); onPlay(game); };
      grid.appendChild(card);
    });
  }

  showAuthModal(mode) {
    this.elements.authModalTitle.textContent = mode === 'login' ? 'Вход' : 'Регистрация';
    this.elements.confirmPasswordGroup.style.display = mode === 'register' ? 'block' : 'none';
    this.elements.authForm.reset();
    this.elements.authModal.classList.add('active');
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
    if (this.elements.balanceValue) this.elements.balanceValue.textContent = coins;
  }

  animateBalanceChange(from, to) {
    const el = this.elements.balanceValue;
    const duration = 800;
    const start = performance.now();
    const update = (now) => {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = Math.floor(from + (to - from) * t);
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

  showGameScreen() {
    this.elements.gameGrid.style.display = 'none';
    this.elements.gameContainer.style.display = 'flex';
  }

  hideGameScreen() {
    this.elements.gameContainer.style.display = 'none';
    this.elements.gameGrid.style.display = 'grid';
  }

  startRadarAnimation() {
    const canvas = this.elements.radarCanvas;
    const ctx = canvas.getContext('2d');
    let angle = 0;
    const draw = () => {
      if (this.elements.matchmakingScreen.style.display === 'none') return;
      ctx.clearRect(0, 0, 200, 200);
      ctx.strokeStyle = '#6C5CE7';
      for (let i=1; i<=3; i++) { ctx.beginPath(); ctx.arc(100,100,30*i,0,2*Math.PI); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(100,100); ctx.lineTo(100+Math.cos(angle)*90, 100+Math.sin(angle)*90);
      ctx.strokeStyle = '#a18aff'; ctx.lineWidth=2; ctx.stroke();
      angle += 0.05;
      requestAnimationFrame(draw);
    };
    draw();
  }
}
