// ========== FILE: src/js/games/GravityWell.js ==========
import { GameController } from './GameController.js';
import { ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class GravityWellGame extends GameController {
  constructor(options) {
    super(options);
    this.G = 0.5;
    this.M = 5000;
    this.softening = 20;
    this.dt = 1 / 60;
    
    // Состояния игроков
    this.players = {
      [this.user.uid]: { pos: { x: 200, y: 300 }, vel: { x: 2, y: 0 }, color: '#2ecc71', health: 100 },
      [this.opponent.uid || 'bot']: { pos: { x: 600, y: 300 }, vel: { x: -2, y: 0 }, color: '#e74c3c', health: 100 }
    };
    
    this.projectiles = [];
    this.keys = {};
    this.lastShot = 0;
    this.gameStateRef = ref(this.db, `gameSessions/${this.roomId}/gameState`);
    this.inputRef = ref(this.db, `gameSessions/${this.roomId}/inputs/${this.user.uid}`);
    
    // Для бота
    this.botAI = this.opponent.isBot ? this.initBot() : null;
  }
  
  initBot() {
    return {
      update: () => {
        const bot = this.players[this.opponent.uid];
        if (!bot) return;
        // Простое движение по орбите
        const bh = { x: 400, y: 300 };
        const dx = bot.pos.x - bh.x;
        const dy = bot.pos.y - bh.y;
        const r = Math.hypot(dx, dy);
        if (r > 10) {
          const angle = Math.atan2(dy, dx) + 0.02;
          bot.pos.x = bh.x + Math.cos(angle) * r;
          bot.pos.y = bh.y + Math.sin(angle) * r;
        }
        // Стрельба иногда
        if (Math.random() < 0.02) {
          this.shoot(bot.pos, this.players[this.user.uid].pos, this.opponent.uid);
        }
      }
    };
  }
  
  setupListeners() {
    window.addEventListener('keydown', (e) => this.keys[e.code] = true);
    window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    
    // Отправка ввода 20 раз в секунду
    this.inputInterval = setInterval(() => {
      const input = {
        left: this.keys['ArrowLeft'] || false,
        right: this.keys['ArrowRight'] || false,
        up: this.keys['ArrowUp'] || false,
        down: this.keys['ArrowDown'] || false,
        shoot: this.keys['Space'] || false,
        timestamp: Date.now()
      };
      set(this.inputRef, input);
    }, 50);
    
    // Получение ввода оппонента
    const opponentUid = this.opponent.uid || 'bot';
    const opponentInputRef = ref(this.db, `gameSessions/${this.roomId}/inputs/${opponentUid}`);
    const unsub = onValue(opponentInputRef, (snapshot) => {
      const input = snapshot.val();
      if (input && !this.opponent.isBot) {
        this.applyInput(opponentUid, input);
      }
    });
    this.unsubscribes.push(unsub);
    
    // Синхронизация состояния для хоста
    if (this.isHost) {
      this.syncInterval = setInterval(() => {
        // Отправляем состояние всех объектов
        update(this.gameStateRef, {
          players: this.players,
          projectiles: this.projectiles
        });
      }, 50);
    } else {
      // Клиент получает состояние
      const stateUnsub = onValue(this.gameStateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          if (data.players) this.players = data.players;
          if (data.projectiles) this.projectiles = data.projectiles;
        }
      });
      this.unsubscribes.push(stateUnsub);
    }
  }
  
  applyInput(uid, input) {
    const player = this.players[uid];
    if (!player) return;
    const thrust = 0.3;
    if (input.left) player.vel.x -= thrust;
    if (input.right) player.vel.x += thrust;
    if (input.up) player.vel.y -= thrust;
    if (input.down) player.vel.y += thrust;
    
    if (input.shoot && Date.now() - this.lastShot > 300) {
      this.shoot(player.pos, this.players[this.user.uid].pos, uid);
      this.lastShot = Date.now();
    }
  }
  
  shoot(fromPos, targetPos, ownerUid) {
    const dx = targetPos.x - fromPos.x;
    const dy = targetPos.y - fromPos.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const vel = { x: dx / len * 8, y: dy / len * 8 };
    this.projectiles.push({
      pos: { x: fromPos.x, y: fromPos.y },
      vel,
      owner: ownerUid,
      radius: 5
    });
  }
  
  acceleration(pos) {
    const bh = { x: 400, y: 300 };
    const dx = bh.x - pos.x;
    const dy = bh.y - pos.y;
    const r2 = dx*dx + dy*dy + this.softening;
    const r = Math.sqrt(r2);
    const a = this.G * this.M / r2;
    return { x: a * dx / r, y: a * dy / r };
  }
  
  rk4(state, dt) {
    const deriv = (s) => {
      const a = this.acceleration(s.pos);
      return { pos: s.vel, vel: a };
    };
    
    const k1 = deriv(state);
    const k2_state = { pos: { x: state.pos.x + k1.pos.x*dt/2, y: state.pos.y + k1.pos.y*dt/2 }, vel: { x: state.vel.x + k1.vel.x*dt/2, y: state.vel.y + k1.vel.y*dt/2 } };
    const k2 = deriv(k2_state);
    const k3_state = { pos: { x: state.pos.x + k2.pos.x*dt/2, y: state.pos.y + k2.pos.y*dt/2 }, vel: { x: state.vel.x + k2.vel.x*dt/2, y: state.vel.y + k2.vel.y*dt/2 } };
    const k3 = deriv(k3_state);
    const k4_state = { pos: { x: state.pos.x + k3.pos.x*dt, y: state.pos.y + k3.pos.y*dt }, vel: { x: state.vel.x + k3.vel.x*dt, y: state.vel.y + k3.vel.y*dt } };
    const k4 = deriv(k4_state);
    
    const newPos = {
      x: state.pos.x + (k1.pos.x + 2*k2.pos.x + 2*k3.pos.x + k4.pos.x) * dt / 6,
      y: state.pos.y + (k1.pos.y + 2*k2.pos.y + 2*k3.pos.y + k4.pos.y) * dt / 6
    };
    const newVel = {
      x: state.vel.x + (k1.vel.x + 2*k2.vel.x + 2*k3.vel.x + k4.vel.x) * dt / 6,
      y: state.vel.y + (k1.vel.y + 2*k2.vel.y + 2*k3.vel.y + k4.vel.y) * dt / 6
    };
    return { pos: newPos, vel: newVel };
  }
  
  update() {
    if (!this.isHost) return; // Только хост симулирует
    
    // Применяем ввод своего игрока
    const myInput = {
      left: this.keys['ArrowLeft'] || false,
      right: this.keys['ArrowRight'] || false,
      up: this.keys['ArrowUp'] || false,
      down: this.keys['ArrowDown'] || false,
      shoot: this.keys['Space'] || false
    };
    this.applyInput(this.user.uid, myInput);
    
    // Бот
    if (this.botAI) this.botAI.update();
    
    // Интегрируем игроков
    for (let uid in this.players) {
      const p = this.players[uid];
      const newState = this.rk4({ pos: p.pos, vel: p.vel }, this.dt);
      p.pos = newState.pos;
      p.vel = newState.vel;
      
      // Ограничение области
      p.pos.x = Math.max(20, Math.min(780, p.pos.x));
      p.pos.y = Math.max(20, Math.min(580, p.pos.y));
    }
    
    // Обновляем снаряды
    this.projectiles = this.projectiles.filter(proj => {
      const newState = this.rk4({ pos: proj.pos, vel: proj.vel }, this.dt);
      proj.pos = newState.pos;
      proj.vel = newState.vel;
      
      // Проверка попадания
      for (let uid in this.players) {
        if (uid === proj.owner) continue;
        const p = this.players[uid];
        const dx = p.pos.x - proj.pos.x;
        const dy = p.pos.y - proj.pos.y;
        if (Math.hypot(dx, dy) < 20) {
          p.health -= 10;
          if (p.health <= 0) {
            this.endGame(proj.owner);
          }
          return false;
        }
      }
      
      // Удаление за пределами
      return proj.pos.x > 0 && proj.pos.x < 800 && proj.pos.y > 0 && proj.pos.y < 600;
    });
  }
  
  render() {
    this.ctx.clearRect(0, 0, 800, 600);
    
    // Чёрная дыра
    const gradient = this.ctx.createRadialGradient(400, 300, 5, 400, 300, 50);
    gradient.addColorStop(0, '#000');
    gradient.addColorStop(1, '#2c003e');
    this.ctx.beginPath();
    this.ctx.arc(400, 300, 40, 0, 2*Math.PI);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    // Аккреционный диск
    this.ctx.save();
    this.ctx.translate(400, 300);
    this.ctx.rotate(Date.now() * 0.002);
    this.ctx.beginPath();
    this.ctx.ellipse(0, 0, 60, 20, 0, 0, 2*Math.PI);
    this.ctx.fillStyle = 'rgba(255, 100, 0, 0.3)';
    this.ctx.fill();
    this.ctx.restore();
    
    // Игроки
    for (let uid in this.players) {
      const p = this.players[uid];
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.pos.x, p.pos.y, 15, 0, 2*Math.PI);
      this.ctx.fill();
      
      // Полоска здоровья
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(p.pos.x-20, p.pos.y-30, 40, 5);
      this.ctx.fillStyle = '#2ecc71';
      this.ctx.fillRect(p.pos.x-20, p.pos.y-30, 40 * p.health/100, 5);
    }
    
    // Снаряды
    this.projectiles.forEach(proj => {
      this.ctx.fillStyle = '#f1c40f';
      this.ctx.beginPath();
      this.ctx.arc(proj.pos.x, proj.pos.y, proj.radius, 0, 2*Math.PI);
      this.ctx.fill();
    });
  }
  
  destroy() {
    clearInterval(this.inputInterval);
    clearInterval(this.syncInterval);
    super.destroy();
  }
}