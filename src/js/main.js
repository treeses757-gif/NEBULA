// ========== FILE: src/js/main.js ==========
import { rtdb } from './firebase-config.js';
import { UIManager } from './ui/UIManager.js';
import { AuthManager } from './auth/AuthManager.js';
import { ShopManager } from './shop/ShopManager.js';
import { Matchmaker } from './matchmaking/Matchmaker.js';
import { ChronoShiftGame } from './games/ChronoShift.js';
import { GravityWellGame } from './games/GravityWell.js';
import { RuneWeaverGame } from './games/RuneWeaver.js';
import { DrumEchoGame } from './games/DrumEcho.js';
import { SpectralAuctionGame } from './games/SpectralAuction.js';

class NebulaArcade {
  constructor() {
    this.ui = new UIManager(this);
    this.auth = new AuthManager(this);
    this.shop = new ShopManager(this);
    this.matchmaker = new Matchmaker(this);
    
    this.games = {
      chronoShift: ChronoShiftGame,
      gravityWell: GravityWellGame,
      runeWeaver: RuneWeaverGame,
      drumEcho: DrumEchoGame,
      spectralAuction: SpectralAuctionGame
    };
    
    this.currentGame = null;
    this.user = null;
    
    this.init();
  }
  
  async init() {
    this.ui.init();
    await this.auth.init();
    this.renderGameCards();
    this.ui.updateBalanceDisplay();
  }
  
  renderGameCards() {
    const gamesData = [
      { id: 'chronoShift', name: 'Хроносдвиг', icon: '⏳' }, // замените на путь к картинке
      { id: 'gravityWell', name: 'Гравитационный колодец', icon: '🌀' },
      { id: 'runeWeaver', name: 'Рунный сплетник', icon: '🔮' },
      { id: 'drumEcho', name: 'Эхо барабанов', icon: '🥁' },
      { id: 'spectralAuction', name: 'Спектральный аукцион', icon: '👻' }
    ];
    
    this.ui.renderGameGrid(gamesData, (gameId) => this.startMatchmaking(gameId));
  }
  
  startMatchmaking(gameId) {
    if (!this.user) {
      this.ui.showAuthModal('login');
      return;
    }
    this.matchmaker.joinQueue(gameId);
  }
  
  onMatchFound(roomId, gameId, opponent, isHost) {
    this.ui.hideMatchmaking();
    this.startGame(gameId, roomId, opponent, isHost);
  }
  
  startGame(gameId, roomId, opponent, isHost) {
    const GameClass = this.games[gameId];
    if (!GameClass) return;
    
    this.ui.showGameScreen();
    
    this.currentGame = new GameClass({
      roomId,
      opponent,
      isHost,
      user: this.user,
      db: rtdb,
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.gameApp = new NebulaArcade();
  feather.replace();
});
