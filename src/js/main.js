import { rtdb, db } from './firebase-config.js';
import { UIManager } from './ui/UIManager.js';
import { AuthManager } from './auth/AuthManager.js';
import { ShopManager } from './shop/ShopManager.js';
import { Matchmaker } from './matchmaking/Matchmaker.js';
import { UploadManager } from './upload/UploadManager.js';
import { ChronoShiftGame } from './games/ChronoShift.js';
import { UserGameController } from './games/UserGameController.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

class NebulaArcade {
  constructor() {
    this.ui = new UIManager(this);
    this.auth = new AuthManager(this);
    this.shop = new ShopManager(this);
    this.matchmaker = new Matchmaker(this);
    this.upload = new UploadManager(this);
    
    this.games = {
      builtin_chrono: { class: ChronoShiftGame, name: 'Хроносдвиг', icon: '⏳', players: 2 }
    };
    
    this.currentGame = null;
    this.user = null;
    this.customGames = [];
    
    this.init();
  }
  
  async init() {
    this.ui.init();
    await this.auth.init();
    await this.loadCustomGames();
    this.renderGameCards();
    this.ui.updateBalanceDisplay();
  }
  
  async loadCustomGames() {
    const snapshot = await getDocs(collection(db, 'games'));
    this.customGames = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
  
  renderGameCards() {
    const allGames = [
      ...Object.entries(this.games).map(([id, g]) => ({ id, ...g, isBuiltin: true })),
      ...this.customGames.map(g => ({ ...g, isBuiltin: false }))
    ];
    
    this.ui.renderGameGrid(allGames, (game) => this.startMatchmaking(game));
  }
  
  startMatchmaking(game) {
    if (!this.user) {
      this.ui.showAuthModal('login');
      return;
    }
    this.matchmaker.joinQueue(game);
  }
  
  onMatchFound(roomId, game, opponent, isHost) {
    this.ui.hideMatchmaking();
    this.startGame(game, roomId, opponent, isHost);
  }
  
  startGame(game, roomId, opponent, isHost) {
    this.ui.showGameScreen();
    
    const GameClass = game.isBuiltin ? game.class : UserGameController;
    
    this.currentGame = new GameClass({
      roomId,
      opponent,
      isHost,
      user: this.user,
      db: rtdb,
      gameData: game,
      onGameEnd: (result) => this.onGameEnd(result),
      onCoinsEarned: (amount) => this.auth.addCoins(amount)
    });
    
    this.currentGame.init();
  }
  
  onGameEnd(result) {
    this.currentGame?.destroy();
    this.currentGame = null;
    this.ui.hideGameScreen();
    this.ui.updateBalanceDisplay();
  }
  
  async refreshGames() {
    await this.loadCustomGames();
    this.renderGameCards();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new NebulaArcade();
  feather.replace();
});
