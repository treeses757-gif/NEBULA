// ========== FILE: src/js/games/DrumEcho.js ==========
import { GameController } from './GameController.js';
import { ref, set, onValue, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class DrumEchoGame extends GameController {
  constructor(options) {
    super(options);
    this.columns = 4;
    this.columnWidth = 100;
    this.noteSpeed = 150; // пикселей в секунду
    this.hitWindow = 100; // мс
    
    this.notes = [];
    this.score = { [this.user.uid]: 0, [this.opponent.uid]: 0 };
    this.combo = 0;
    this.glitchActive = false;
    this.glitchEnd = 0;
    
    // Синхронизация времени
    this.serverTimeOffset = 0;
    this.gameStartTime = null;
    
    this.keys = {};
    this.gameStateRef = ref(this.db, `gameSessions/${this.roomId}/gameState`);
    this.eventsRef = ref(this.db, `gameSessions/${this.roomId}/events`);
    
    // Генерация паттерна
    this.seed = this.roomId;
    this.generatePattern();
    
    // Бот
    this.botAI = this.opponent.isBot ? this.initBot() : null;
  }
  
  generatePattern() {
    // Детерминированный паттерн на основе seed
    let hash = 0;
    for (let i=0; i<this.seed.length; i++) {
      hash = ((hash << 5) - hash) + this.seed.charCodeAt(i);
      hash |= 0;
    }
    const random = (max) => {
      hash = (hash * 9301 + 49297) % 233280;
      return (hash / 233280) * max;
    };
    
    const noteCount = 40;
    for (let i=0; i<noteCount; i++) {
      this.notes.push({
        time: i * 0.6 + 1, // секунды от старта
        column: Math.floor(random(this.columns)),
        hit: false
      });
    }
  }
  
  async setupListeners() {
    // Получаем серверное время для синхронизации
    const timeRef = ref(this.db, '.info/serverTimeOffset');
    const unsubTime = onValue(timeRef, (snap) => {
      this.serverTimeOffset = snap.val() || 0;
    });
    this.unsubscribes.push(unsubTime);
    
    if (this.isHost) {
      // Устанавливаем время старта
      const startTime = Date.now() + this.serverTimeOffset + 3000; // через 3 сек
      this.gameStartTime = startTime;
      await set(this.gameStateRef, { startTime, seed: this.seed });
    } else {
      const unsub = onValue(this.gameStateRef, (snap) => {
        const data = snap.val();
        if (data) {
          this.gameStartTime = data.startTime;
          if (data.scores) this.score = data.scores;
        }
      });
      this.unsubscribes.push(unsub);
    }
    
    // Обработка событий
    const eventsUnsub = onValue(this.eventsRef, (snap) => {
      const events = snap.val();
      if (!events) return;
      Object.values(events).forEach(event => {
        if (event.type === 'hit' && event.uid !== this.user.uid) {
          // Обновляем счёт оппонента
          this.score[event.uid] = event.score;
        } else if (event.type === 'glitch' && event.target === this.user.uid) {
          this.glitchActive = true;
          this.glitchEnd = Date.now() + 400;
          setTimeout(() => this.glitchActive = false, 400);
        }
      });
    });
    this.unsubscribes.push(eventsUnsub);
    
    // Управление
    window.addEventListener('keydown', (e) => {
      const keyMap = { 'KeyA': 0, 'KeyS': 1, 'KeyD': 2, 'KeyF': 3 };
      if (keyMap.hasOwnProperty(e.code)) {
        this.handleHit(keyMap[e.code]);
      }
      if (e.code === 'KeyG' && this.combo >= 10) {
        this.activateGlitch();
      }
    });
    
    // Бот
    if (this.botAI) {
      this.botInterval = setInterval(() => this.botAI.update(), 100);
    }
  }
  
  initBot() {
    return {
      update: () => {
        if (!this.gameStartTime) return;
        const now = Date.now() + this.serverTimeOffset;
        const elapsed = (now - this.gameStartTime) / 1000;
        
        this.notes.forEach(note => {
          if (!note.hit && !note.botHit && Math.abs(note.time - elapsed) < 0.08) {
            if (Math.random() < 0.8) {
              note.botHit = true;
              const accuracy = Math.random() * 100;
              const points = accuracy > 80 ? 100 : 50;
              this.score[this.opponent.uid] += points;
              this.sendEvent('hit', { column: note.column, accuracy, score: this.score[this.opponent.uid] });
            }
          }
        });
      }
    };
  }
  
  handleHit(column) {
    if (!this.gameStartTime) return;
    const now = Date.now() + this.serverTimeOffset;
    const elapsed = (now - this.gameStartTime) / 1000;
    
    const note = this.notes.find(n => n.column === column && !n.hit && Math.abs(n.time - elapsed) < this.hitWindow/1000);
    if (note) {
      note.hit = true;
      const diff = Math.abs(note.time - elapsed) * 1000;
      const accuracy = Math.max(0, 100 - diff);
      const points = accuracy > 80 ? 100 : 50;
      this.score[this.user.uid] += points;
      this.combo++;
      
      this.sendEvent('hit', { column, accuracy, score: this.score[this.user.uid] });
    } else {
      this.combo = 0;
    }
  }
  
  activateGlitch() {
    if (this.combo < 10) return;
    this.combo = 0;
    this.sendEvent('glitch', { target: this.opponent.uid });
  }
  
  sendEvent(type, data) {
    const eventRef = ref(this.db, `gameSessions/${this.roomId}/events/${Date.now()}`);
    set(eventRef, { type, uid: this.user.uid, ...data });
  }
  
  update() {
    if (!this.gameStartTime) return;
    const now = Date.now() + this.serverTimeOffset;
    const elapsed = (now - this.gameStartTime) / 1000;
    
    // Удаление старых нот
    this.notes = this.notes.filter(n => n.time > elapsed - 2 || !n.hit);
    
    // Проверка окончания
    if (this.notes.every(n => n.hit || n.botHit) && this.notes.length > 0) {
      const myScore = this.score[this.user.uid];
      const oppScore = this.score[this.opponent.uid];
      const winner = myScore > oppScore ? this.user.uid : this.opponent.uid;
      this.endGame(winner);
    }
  }
  
  render() {
    this.ctx.clearRect(0, 0, 800, 600);
    
    if (!this.gameStartTime) {
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '24px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Ожидание синхронизации...', 400, 300);
      return;
    }
    
    const now = Date.now() + this.serverTimeOffset;
    const elapsed = (now - this.gameStartTime) / 1000;
    
    // Колонки
    for (let i=0; i<this.columns; i++) {
      const x = 200 + i * this.columnWidth;
      this.ctx.strokeStyle = '#444';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, 0, this.columnWidth, 600);
      
      // Зона попадания
      this.ctx.fillStyle = 'rgba(108, 92, 231, 0.2)';
      this.ctx.fillRect(x, 500, this.columnWidth, 50);
    }
    
    // Ноты
    if (!this.glitchActive) {
      this.notes.forEach(note => {
        if (note.hit) return;
        const y = 500 - (note.time - elapsed) * this.noteSpeed;
        if (y < -20 || y > 600) return;
        
        const x = 200 + note.column * this.columnWidth;
        const gradient = this.ctx.createLinearGradient(x, y, x+this.columnWidth, y+30);
        gradient.addColorStop(0, '#6C5CE7');
        gradient.addColorStop(1, '#a18aff');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(x+5, y, this.columnWidth-10, 20);
      });
    }
    
    // Счёт
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 24px Inter';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Вы: ${this.score[this.user.uid]}`, 20, 50);
    this.ctx.fillText(`Оппонент: ${this.score[this.opponent.uid]}`, 20, 90);
    this.ctx.fillText(`Комбо: ${this.combo}`, 20, 130);
    
    if (this.glitchActive) {
      this.ctx.fillStyle = '#f00';
      this.ctx.font = '48px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('ПОМЕХА!', 400, 300);
    }
  }
  
  destroy() {
    clearInterval(this.botInterval);
    super.destroy();
  }
}