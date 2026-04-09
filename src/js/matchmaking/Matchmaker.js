// ========== FILE: src/js/matchmaking/Matchmaker.js ==========
import { rtdb } from '../firebase-config.js';
import { ref, set, onValue, remove, serverTimestamp, get, child, push, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class Matchmaker {
  constructor(app) {
    this.app = app;
    this.currentGameId = null;
    this.queueRef = null;
    this.roomRef = null;
    this.unsubscribes = [];
    this.timer = null;
    this.timeoutId = null;
    this.botTimeout = null;
  }
  
  joinQueue(gameId) {
    this.currentGameId = gameId;
    const user = this.app.user;
    if (!user) return;
    
    this.app.ui.showMatchmaking();
    this.startTimer();
    
    const queueRef = ref(rtdb, `matchmaking/${gameId}/queue/${user.uid}`);
    set(queueRef, {
      timestamp: serverTimestamp(),
      mmr: user.coins,
      nickname: user.nickname
    });
    
    // Слушаем изменения в очереди
    const gameQueueRef = ref(rtdb, `matchmaking/${gameId}/queue`);
    const unsub = onValue(gameQueueRef, async (snapshot) => {
      const queue = snapshot.val() || {};
      const uids = Object.keys(queue);
      if (uids.length >= 2) {
        const opponentUid = uids.find(uid => uid !== user.uid);
        if (opponentUid) {
          // Создать комнату
          await this.createRoom(gameId, user.uid, opponentUid, queue);
        }
      }
    });
    this.unsubscribes.push(unsub);
    
    // Таймер на бота через 15 сек
    this.botTimeout = setTimeout(() => {
      this.startBotMatch(gameId);
    }, 15000);
  }
  
  async createRoom(gameId, uid1, uid2, queue) {
    // Транзакция для избежания гонки (упрощенно: первый создаёт)
    const roomId = push(ref(rtdb, 'gameSessions')).key;
    const roomRef = ref(rtdb, `gameSessions/${roomId}`);
    
    const player1 = queue[uid1];
    const player2 = queue[uid2];
    
    const roomData = {
      gameId,
      players: {
        [uid1]: { nickname: player1.nickname, skin: 'default', ready: true },
        [uid2]: { nickname: player2.nickname, skin: 'default', ready: true }
      },
      status: 'starting',
      createdAt: serverTimestamp()
    };
    
    await set(roomRef, roomData);
    
    // Удалить из очереди
    await remove(ref(rtdb, `matchmaking/${gameId}/queue/${uid1}`));
    await remove(ref(rtdb, `matchmaking/${gameId}/queue/${uid2}`));
    
    this.cleanup();
    
    // Оповестить основной апп
    const opponent = (uid1 === this.app.user.uid) ? player2 : player1;
    this.app.onMatchFound(roomId, gameId, opponent, uid1 === this.app.user.uid);
  }
  
  startBotMatch(gameId) {
    this.cleanup();
    // Создаём бота
    const roomId = 'bot_' + Date.now();
    const opponent = { nickname: 'Bot_' + Math.floor(Math.random()*1000), isBot: true };
    this.app.onMatchFound(roomId, gameId, opponent, true);
  }
  
  startTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('matchmaking-timer');
    this.timer = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }
  
  cancel() {
    if (this.currentGameId && this.app.user) {
      remove(ref(rtdb, `matchmaking/${this.currentGameId}/queue/${this.app.user.uid}`));
    }
    this.cleanup();
    this.app.ui.hideMatchmaking();
  }
  
  cleanup() {
    clearInterval(this.timer);
    clearTimeout(this.botTimeout);
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];
    this.currentGameId = null;
  }
}