// ========== FILE: src/js/games/ChronoShift.js ==========
import { GameController } from './GameController.js';
import { ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class ChronoShiftGame extends GameController {
  constructor(options) {
    super(options);
    this.player1 = { x: 100, y: 300, vx: 0, vy: 0, width: 30, height: 30, onGround: false };
    this.player2 = { x: 600, y: 300, vx: 0, vy: 0 }; // монохромный
    this.platforms = [
      { x: 0, y: 550, w: 800, h: 20 },
      { x: 200, y: 400, w: 100, h: 15 },
      { x: 500, y: 300, w: 120, h: 15, pastOnly: true }, // только для второго игрока
    ];
    this.pastPlatforms = this.platforms.filter(p => p.pastOnly);
    this.gravity = 0.5;
    this.keys = {};
    this.gameStateRef = ref(this.db, `gameSessions/${this.roomId}/gameState`);
  }
  
  setupListeners() {
    window.addEventListener('keydown', (e) => this.keys[e.code] = true);
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    
    // Клик для второго игрока (только если это второй игрок)
    if (!this.isHost || this.opponent.isBot) {
      this.canvas.addEventListener('click', (e) => this.handlePastClick(e));
    }
    
    // Синхронизация с RTDB
    const unsub = onValue(this.gameStateRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (data.p1) {
          this.player1.x = data.p1.x;
          this.player1.y = data.p1.y;
        }
        if (data.platforms) {
          this.platforms = data.platforms;
        }
      }
    });
    this.unsubscribes.push(unsub);
    
    // Отправка состояния каждые 50мс
    this.syncInterval = setInterval(() => {
      if (this.isHost) {
        update(this.gameStateRef, {
          p1: { x: this.player1.x, y: this.player1.y },
          platforms: this.platforms
        });
      }
    }, 50);
  }
  
  update() {
    if (this.isHost) {
      // Управление первым игроком
      if (this.keys['ArrowLeft']) this.player1.vx = -5;
      else if (this.keys['ArrowRight']) this.player1.vx = 5;
      else this.player1.vx *= 0.8;
      
      if (this.keys['Space'] && this.player1.onGround) {
        this.player1.vy = -10;
        this.player1.onGround = false;
      }
      
      this.player1.vy += this.gravity;
      this.player1.x += this.player1.vx;
      this.player1.y += this.player1.vy;
      
      // Коллизии
      this.player1.onGround = false;
      this.platforms.filter(p => !p.pastOnly).forEach(p => {
        if (this.player1.x < p.x + p.w && this.player1.x + this.player1.width > p.x &&
            this.player1.y + this.player1.height > p.y && this.player1.y < p.y + p.h) {
          if (this.player1.vy > 0) {
            this.player1.y = p.y - this.player1.height;
            this.player1.vy = 0;
            this.player1.onGround = true;
          }
        }
      });
    }
    
    // Для второго игрока (бот или реальный) - обработка кликов по pastOnly платформам
  }
  
  handlePastClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Проверяем клик по pastOnly платформам
    this.pastPlatforms.forEach((p, idx) => {
      if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) {
        // Отправить событие toggle
        update(this.gameStateRef, { togglePlatform: idx });
      }
    });
  }
  
  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mid = w / 2;
    
    // Левая половина - игрок 1 (цветная)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, mid, h);
    this.ctx.clip();
    
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, w, h);
    
    // Платформы
    this.platforms.filter(p => !p.pastOnly).forEach(p => {
      this.ctx.fillStyle = '#6C5CE7';
      this.ctx.fillRect(p.x, p.y, p.w, p.h);
    });
    
    // Игрок 1
    this.ctx.fillStyle = '#2ecc71';
    this.ctx.fillRect(this.player1.x, this.player1.y, 30, 30);
    
    this.ctx.restore();
    
    // Правая половина - монохромная с шумом
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(mid, 0, mid, h);
    this.ctx.clip();
    
    this.ctx.filter = 'grayscale(1) contrast(1.3)';
    this.ctx.fillStyle = '#0a0a15';
    this.ctx.fillRect(0, 0, w, h);
    
    // Платформы, включая pastOnly
    this.platforms.forEach(p => {
      this.ctx.fillStyle = p.pastOnly ? '#a18aff' : '#aaa';
      this.ctx.fillRect(p.x, p.y, p.w, p.h);
    });
    
    // Игрок 2 (монохромный силуэт)
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(600, 300, 30, 30); // позиция оппонента
    
    this.ctx.filter = 'none';
    this.ctx.restore();
    
    // Разделительная линия
    this.ctx.beginPath();
    this.ctx.moveTo(mid, 0);
    this.ctx.lineTo(mid, h);
    this.ctx.strokeStyle = '#6C5CE7';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
  }
  
  destroy() {
    clearInterval(this.syncInterval);
    super.destroy();
  }
}