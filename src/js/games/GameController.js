// ========== FILE: src/js/games/GameController.js ==========
export class GameController {
  constructor(options) {
    this.roomId = options.roomId;
    this.opponent = options.opponent;
    this.isHost = options.isHost;
    this.user = options.user;
    this.db = options.db;
    this.onGameEnd = options.onGameEnd;
    this.onCoinsEarned = options.onCoinsEarned;
    
    this.container = document.getElementById('game-container');
    this.canvas = null;
    this.ctx = null;
    this.animationFrame = null;
    this.unsubscribes = [];
  }
  
  init() {
    this.container.style.display = 'block';
    this.setupCanvas();
    this.setupListeners();
    this.startGameLoop();
  }
  
  setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.display = 'block';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    
    window.addEventListener('resize', () => this.resizeCanvas());
  }
  
  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  setupListeners() {
    // Должны быть переопределены
  }
  
  startGameLoop() {
    const loop = () => {
      this.update();
      this.render();
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }
  
  update() {}
  render() {}
  
  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.unsubscribes.forEach(u => u());
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }
  
  sendGameState(state) {
    // Обновление в RTDB
  }
  
  endGame(winnerUid) {
    const isWin = winnerUid === this.user.uid;
    const reward = isWin ? 100 : 20;
    this.onCoinsEarned(reward);
    this.onGameEnd({ winner: winnerUid });
  }
}