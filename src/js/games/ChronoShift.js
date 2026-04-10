import { GameController } from './GameController.js';
import { ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class ChronoShiftGame extends GameController {
  constructor(options) {
    super(options);
    this.player1 = { x: 100, y: 300, vx: 0, vy: 0, width: 30, height: 30, onGround: false };
    this.platforms = [
      { x: 0, y: 550, w: 800, h: 20, pastOnly: false },
      { x: 200, y: 400, w: 100, h: 15, pastOnly: false },
      { x: 500, y: 300, w: 120, h: 15, pastOnly: true },
      { x: 300, y: 200, w: 150, h: 15, pastOnly: true },
    ];
    this.pastPlatforms = this.platforms.filter(p => p.pastOnly);
    this.gravity = 0.5;
    this.keys = { left: false, right: false, jump: false };
    this.lastToggleTime = 0;

    // Для бота
    this.botTimer = null;
    if (this.opponent.isBot && !this.isHost) {
      // Бот будет управлять вторым игроком (переключение платформ)
      this.startBot();
    }

    this.gameStateRef = ref(this.db, `gameSessions/${this.roomId}/gameState`);
  }

  startBot() {
    this.botTimer = setInterval(() => {
      if (!this.isGameActive) return;
      const randomPlatform = this.pastPlatforms[Math.floor(Math.random() * this.pastPlatforms.length)];
      if (randomPlatform) {
        const idx = this.platforms.indexOf(randomPlatform);
        this.sendToggleEvent(idx);
      }
    }, 3500);
  }

  sendToggleEvent(platformIdx) {
    const eventRef = ref(this.db, `gameSessions/${this.roomId}/events/${Date.now()}`);
    set(eventRef, {
      type: 'toggle',
      platformIdx,
      uid: this.user.uid
    });
  }

  setupListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
      if (e.code === 'Space' || e.code === 'KeyW') this.keys.jump = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
      if (e.code === 'Space' || e.code === 'KeyW') this.keys.jump = false;
    });

    // Клик для второго игрока (только если это не хост и не бот)
    if (!this.isHost && !this.opponent.isBot) {
      this.canvas.addEventListener('click', (e) => this.handlePastClick(e));
    }

    // Слушаем события toggle
    const eventsRef = ref(this.db, `gameSessions/${this.roomId}/events`);
    const unsubEvents = onValue(eventsRef, (snap) => {
      const events = snap.val() || {};
      Object.values(events).forEach(ev => {
        if (ev.type === 'toggle' && this.isHost) {
          this.applyToggle(ev.platformIdx);
        }
      });
    });
    this.unsubscribes.push(unsubEvents);

    // Синхронизация платформ (для клиентов)
    if (!this.isHost) {
      this.listenToState('platforms', (platforms) => {
        if (platforms) this.platforms = platforms;
      });
    }

    // Отправка состояния хоста (позиция игрока и платформы)
    if (this.isHost) {
      this.syncInterval = setInterval(() => {
        this.syncState('p1', { x: this.player1.x, y: this.player1.y });
        this.syncState('platforms', this.platforms);
      }, 50);
    } else {
      this.listenToState('p1', (p1) => {
        if (p1) {
          this.player1.x = p1.x;
          this.player1.y = p1.y;
        }
      });
    }
  }

  handlePastClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    this.pastPlatforms.forEach((p, idx) => {
      if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) {
        const globalIdx = this.platforms.indexOf(p);
        this.sendToggleEvent(globalIdx);
      }
    });
  }

  applyToggle(platformIdx) {
    const platform = this.platforms[platformIdx];
    if (!platform) return;
    // Запускаем таймер смены состояния
    platform.changing = true;
    setTimeout(() => {
      platform.pastOnly = !platform.pastOnly;
      platform.changing = false;
      if (platform.pastOnly) {
        this.pastPlatforms.push(platform);
      } else {
        this.pastPlatforms = this.pastPlatforms.filter(p => p !== platform);
      }
    }, 1500);
  }

  update() {
    if (!this.isHost) return; // Только хост симулирует физику

    // Управление первым игроком
    if (this.keys.left) this.player1.vx = -5;
    else if (this.keys.right) this.player1.vx = 5;
    else this.player1.vx *= 0.8;

    if (this.keys.jump && this.player1.onGround) {
      this.player1.vy = -10;
      this.player1.onGround = false;
    }

    this.player1.vy += this.gravity;
    this.player1.x += this.player1.vx;
    this.player1.y += this.player1.vy;

    // Коллизии
    this.player1.onGround = false;
    this.platforms.forEach(p => {
      if (p.pastOnly) return; // Только обычные платформы
      if (this.player1.x < p.x + p.w && this.player1.x + this.player1.width > p.x &&
          this.player1.y + this.player1.height > p.y && this.player1.y < p.y + p.h) {
        if (this.player1.vy > 0) {
          this.player1.y = p.y - this.player1.height;
          this.player1.vy = 0;
          this.player1.onGround = true;
        }
      }
    });

    // Ограничение экрана
    this.player1.x = Math.max(0, Math.min(770, this.player1.x));
    this.player1.y = Math.max(0, Math.min(570, this.player1.y));
  }

  render() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mid = w / 2;

    // Левая половина (цветная)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, mid, h);
    this.ctx.clip();
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, w, h);

    this.platforms.forEach(p => {
      if (!p.pastOnly) {
        this.ctx.fillStyle = '#6C5CE7';
        this.ctx.fillRect(p.x, p.y, p.w, p.h);
      }
    });

    // Игрок 1
    this.ctx.fillStyle = '#2ecc71';
    this.ctx.fillRect(this.player1.x, this.player1.y, 30, 30);
    this.ctx.restore();

    // Правая половина (монохромная с шумом)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(mid, 0, mid, h);
    this.ctx.clip();

    this.ctx.filter = 'grayscale(1) contrast(1.3)';
    this.ctx.fillStyle = '#0a0a15';
    this.ctx.fillRect(0, 0, w, h);

    this.platforms.forEach(p => {
      this.ctx.fillStyle = p.pastOnly ? '#a18aff' : '#aaa';
      if (p.changing) {
        this.ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
      }
      this.ctx.fillRect(p.x, p.y, p.w, p.h);
      this.ctx.globalAlpha = 1.0;
    });

    // Игрок 2 (силуэт)
    this.ctx.fillStyle = '#fff';
    this.ctx.fillRect(600, 300, 30, 30);

    // Шум
    this.ctx.filter = 'none';
    this.ctx.globalAlpha = 0.15;
    this.ctx.fillStyle = '#fff';
    for (let i = 0; i < 100; i++) {
      this.ctx.fillRect(mid + Math.random() * mid, Math.random() * h, 1, 1);
    }
    this.ctx.globalAlpha = 1.0;
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
    clearInterval(this.botTimer);
    super.destroy();
  }
}
