// ========== FILE: src/js/games/SpectralAuction.js ==========
import { GameController } from './GameController.js';
import { ref, set, onValue, update, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class SpectralAuctionGame extends GameController {
  constructor(options) {
    super(options);
    this.round = 1;
    this.maxRounds = 5;
    this.lotValue = 0;
    this.bets = { [this.user.uid]: null, [this.opponent.uid]: null };
    this.scores = { [this.user.uid]: 0, [this.opponent.uid]: 0 };
    this.coins = { [this.user.uid]: 100, [this.opponent.uid]: 100 };
    this.timerEnd = 0;
    this.phase = 'betting'; // betting, reveal, result
    this.revealed = false;
    
    this.gameStateRef = ref(this.db, `gameSessions/${this.roomId}/gameState`);
    this.betRef = ref(this.db, `gameSessions/${this.roomId}/bets/${this.user.uid}`);
    
    // Бот
    this.botAI = this.opponent.isBot ? this.initBot() : null;
  }
  
  initBot() {
    return {
      placeBet: () => {
        if (this.phase !== 'betting') return;
        const myCoins = this.coins[this.opponent.uid];
        const bet = Math.min(myCoins, Math.floor(Math.random() * 20) + 1);
        set(ref(this.db, `gameSessions/${this.roomId}/bets/${this.opponent.uid}`), bet);
      }
    };
  }
  
  async setupListeners() {
    if (this.isHost) {
      this.startNewRound();
    }
    
    const unsub = onValue(this.gameStateRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      
      this.round = data.round;
      this.lotValue = data.lotValue;
      this.scores = data.scores;
      this.coins = data.coins;
      this.phase = data.phase;
      this.timerEnd = data.timerEnd;
      
      if (data.bets) {
        this.bets = data.bets;
      }
      
      this.revealed = (this.phase === 'reveal' || this.phase === 'result');
    });
    this.unsubscribes.push(unsub);
    
    // Слушаем свою ставку
    const betUnsub = onValue(this.betRef, (snap) => {
      // Можно обновить UI
    });
    this.unsubscribes.push(betUnsub);
    
    // Управление
    document.addEventListener('keydown', (e) => {
      if (e.key >= '0' && e.key <= '9' && this.phase === 'betting') {
        const num = parseInt(e.key);
        this.placeBet(num);
      }
    });
  }
  
  startNewRound() {
    if (this.round > this.maxRounds) {
      this.endGame(this.scores[this.user.uid] > this.scores[this.opponent.uid] ? this.user.uid : this.opponent.uid);
      return;
    }
    
    const lotValue = Math.floor(Math.random() * 5) + 1;
    const timerEnd = Date.now() + 10000; // 10 секунд на ставку
    
    update(this.gameStateRef, {
      round: this.round,
      lotValue,
      phase: 'betting',
      timerEnd,
      bets: { [this.user.uid]: null, [this.opponent.uid]: null }
    });
    
    // Таймер на завершение ставок
    setTimeout(() => this.resolveBets(), 10000);
  }
  
  async placeBet(amount) {
    if (this.phase !== 'betting') return;
    if (amount > this.coins[this.user.uid]) return;
    
    await set(this.betRef, amount);
    
    // Если бот, он тоже ставит
    if (this.botAI) {
      setTimeout(() => this.botAI.placeBet(), 500);
    }
  }
  
  resolveBets() {
    if (!this.isHost) return;
    
    const bet1 = this.bets[this.user.uid] || 0;
    const bet2 = this.bets[this.opponent.uid] || 0;
    
    let winner;
    if (bet1 > bet2) winner = this.user.uid;
    else if (bet2 > bet1) winner = this.opponent.uid;
    else winner = null; // ничья
    
    const newScores = { ...this.scores };
    const newCoins = { ...this.coins };
    
    if (winner) {
      newScores[winner] += this.lotValue;
    }
    newCoins[this.user.uid] -= bet1;
    newCoins[this.opponent.uid] -= bet2;
    
    update(this.gameStateRef, {
      phase: 'result',
      scores: newScores,
      coins: newCoins,
      winner
    });
    
    this.round++;
    setTimeout(() => this.startNewRound(), 3000);
  }
  
  update() {
    // Обновление UI
  }
  
  render() {
    this.ctx.clearRect(0, 0, 800, 600);
    
    // Заголовок
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 24px Inter';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`Раунд ${this.round}/${this.maxRounds}`, 400, 50);
    
    // Лот
    this.ctx.font = '48px Inter';
    this.ctx.fillText(`🏆 ${this.lotValue}`, 400, 150);
    
    // Таймер
    if (this.phase === 'betting') {
      const remaining = Math.max(0, Math.ceil((this.timerEnd - Date.now()) / 1000));
      this.ctx.fillText(`${remaining}с`, 400, 220);
      
      // Круговая диаграмма
      const progress = (this.timerEnd - Date.now()) / 10000;
      this.ctx.beginPath();
      this.ctx.arc(400, 300, 50, -Math.PI/2, -Math.PI/2 + (2*Math.PI * progress));
      this.ctx.lineTo(400, 300);
      this.ctx.fillStyle = 'rgba(108, 92, 231, 0.5)';
      this.ctx.fill();
    }
    
    // Игроки
    const drawPlayer = (uid, x, y) => {
      const isMe = uid === this.user.uid;
      const name = isMe ? 'Вы' : (this.opponent.nickname || 'Оппонент');
      
      this.ctx.fillStyle = isMe ? '#2ecc71' : '#e74c3c';
      this.ctx.font = '18px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(name, x, y);
      
      this.ctx.fillText(`Очки: ${this.scores[uid]}`, x, y+30);
      this.ctx.fillText(`Монеты: ${this.coins[uid]}`, x, y+60);
      
      // Ставка (если раскрыта)
      if (this.revealed) {
        const bet = this.bets[uid] || 0;
        this.ctx.fillText(`Ставка: ${bet}`, x, y+90);
      } else if (this.phase === 'betting') {
        this.ctx.fillText('Ставка: ?', x, y+90);
      }
    };
    
    drawPlayer(this.user.uid, 200, 350);
    drawPlayer(this.opponent.uid, 600, 350);
    
    // Инструкция
    if (this.phase === 'betting') {
      this.ctx.fillStyle = '#aaa';
      this.ctx.font = '14px Inter';
      this.ctx.fillText('Нажмите цифру для ставки', 400, 550);
    }
  }
  
  destroy() {
    super.destroy();
  }
}