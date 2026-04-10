export class GameController {
  constructor(options) {
    this.roomId = options.roomId;
    this.opponent = options.opponent;
    this.isHost = options.isHost;
    this.user = options.user;
    this.db = options.db; // Realtime Database
    this.onGameEnd = options.onGameEnd;
    this.onCoinsEarned = options.onCoinsEarned;
    this.gameData = options.gameData; // дополнительные данные игры

    this.container = document.getElementById('game-container');
    this.canvas = null;
    this.ctx = null;
    this.animationFrame = null;
    this.unsubscribes = [];
    this.isGameActive = true;
  }

  init() {
    this.container.style.display = 'flex';
    this.setupCanvas();
    this.setupListeners();
    this.setupRoomStatusListener();
    this.startGameLoop();
  }

  setupCanvas() {
    this.canvas = document.createElement('canvas');
    this.resizeCanvas();
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.innerHTML = '';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.canvas.width = w || 800;
    this.canvas.height = h || 600;
  }

  setupListeners() {
    // Переопределяется в дочерних классах
  }

  setupRoomStatusListener() {
    const roomRef = ref(this.db, `gameSessions/${this.roomId}/status`);
    const unsub = onValue(roomRef, (snap) => {
      const status = snap.val();
      if (status === 'finished' || status === 'aborted') {
        this.isGameActive = false;
        this.endGame(null);
      }
    });
    this.unsubscribes.push(unsub);
  }

  startGameLoop() {
    const loop = () => {
      if (this.isGameActive) {
        this.update();
        this.render();
      }
      this.animationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  update() {}
  render() {}

  syncState(path, data) {
    const stateRef = ref(this.db, `gameSessions/${this.roomId}/gameState/${path}`);
    set(stateRef, data);
  }

  listenToState(path, callback) {
    const stateRef = ref(this.db, `gameSessions/${this.roomId}/gameState/${path}`);
    const unsub = onValue(stateRef, (snap) => {
      callback(snap.val());
    });
    this.unsubscribes.push(unsub);
  }

  endGame(winnerUid) {
    if (!this.isGameActive) return;
    this.isGameActive = false;
    // Сообщаем комнате о завершении
    set(ref(this.db, `gameSessions/${this.roomId}/status`), 'finished');
    if (winnerUid) {
      const isWin = winnerUid === this.user.uid;
      const reward = isWin ? 100 : 20;
      this.onCoinsEarned(reward);
    }
    this.onGameEnd({ winner: winnerUid });
    this.destroy();
  }

  destroy() {
    cancelAnimationFrame(this.animationFrame);
    this.unsubscribes.forEach(u => u());
    this.container.style.display = 'none';
    this.container.innerHTML = '';
    window.removeEventListener('resize', this.resizeCanvas);
  }
}
