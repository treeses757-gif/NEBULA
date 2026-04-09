export class UIManager {
  constructor(app) {
    this.app = app;
    this.elements = {};
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
    const ids = ['guest-actions','user-actions','balance-value','avatar-letter','login-btn','register-btn','shop-btn','inventory-btn','create-game-btn','fullscreen-btn','game-search','game-grid','matchmaking-screen','game-container','auth-modal','shop-modal','inventory-modal','upload-modal','cancel-matchmaking','auth-form','auth-nickname','auth-password','auth-confirm','auth-submit','auth-modal-title','confirm-password-group','toggle-auth-mode','matchmaking-timer','radar-canvas','skins-container','inventory-container','upload-form','game-title','game-players','game-avatar','game-file'];
    ids.forEach(id => this.elements[id] = document.getElementById(id));
    this.elements.modalClose = document.querySelectorAll('.modal-close');
    this.elements.tabBtns = document.querySelectorAll('.tab-btn');
  }
  
  initStarfield() { /* как раньше */ }
  initFullscreen() { /* как раньше */ }
  initSearch() { /* как раньше */ }
  
  filterGameCards(query) {
    document.querySelectorAll('.game-card').forEach(card => {
      const title = card.querySelector('.game-title')?.textContent.toLowerCase() || '';
      const match = title.includes(query.toLowerCase());
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
    this.elements.loginBtn?.addEventListener('click', () => this.showAuthModal('login'));
    this.elements.registerBtn?.addEventListener('click', () => this.showAuthModal('register'));
    this.elements.toggleAuthMode?.addEventListener('click', () => {
      const isLogin = this.elements.authModalTitle.textContent === 'Вход';
      this.showAuthModal(isLogin ? 'register' : 'login');
    });
    this.elements.authForm?.addEventListener('submit', e => { e.preventDefault(); this.app.auth.handleAuthSubmit(); });
    this.elements.shopBtn?.addEventListener('click', () => this.showShop());
    this.elements.inventoryBtn?.addEventListener('click', () => this.showInventory());
    this.elements.createGameBtn?.addEventListener('click', () => this.showUploadModal());
    this.elements.cancelMatchmaking?.addEventListener('click', () => this.app.matchmaker.cancel());
    this.elements.uploadForm?.addEventListener('submit', e => { e.preventDefault(); this.app.upload.uploadGame(); });
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
        <div class="game-players">👥 ${game.players || 2}</div>
        <button class="play-btn">Играть</button>
      `;
      card.querySelector('.play-btn').addEventListener('click', e => { e.stopPropagation(); onPlay(game); });
      grid.appendChild(card);
    });
  }
  
  showAuthModal(mode) { /* как раньше */ }
  showShop() { this.elements.shopModal?.classList.add('active'); this.app.shop.renderSkins(); }
  showInventory() { this.elements.inventoryModal?.classList.add('active'); this.app.shop.renderInventory(); }
  showUploadModal() { this.elements.uploadModal?.classList.add('active'); }
  
  updateAuthUI(user) {
    const guest = this.elements.guestActions;
    const userPanel = this.elements.userActions;
    if (user) {
      guest.style.display = 'none';
      userPanel.style.display = 'flex';
      this.elements.avatarLetter.textContent = user.nickname.charAt(0).toUpperCase();
      this.updateBalanceDisplay(user.coins);
    } else {
      guest.style.display = 'flex';
      userPanel.style.display = 'none';
    }
  }
  
  updateBalanceDisplay(coins) { if (this.elements.balanceValue) this.elements.balanceValue.textContent = coins; }
  showMatchmaking() { this.elements.matchmakingScreen.style.display = 'flex'; this.elements.gameGrid.style.display = 'none'; this.startRadarAnimation(); }
  hideMatchmaking() { this.elements.matchmakingScreen.style.display = 'none'; }
  showGameScreen() { this.elements.gameGrid.style.display = 'none'; this.elements.gameContainer.style.display = 'block'; }
  hideGameScreen() { this.elements.gameContainer.style.display = 'none'; this.elements.gameGrid.style.display = 'grid'; }
  startRadarAnimation() { /* ... */ }
}
