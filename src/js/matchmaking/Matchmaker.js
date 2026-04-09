import { rtdb } from '../firebase-config.js';
import { ref, set, onValue, remove, serverTimestamp, push } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class Matchmaker {
  constructor(app) { this.app = app; this.currentGame = null; this.unsubscribes = []; }
  
  joinQueue(game) {
    this.cleanup();
    this.currentGame = game;
    const user = this.app.user;
    this.app.ui.showMatchmaking();
    this.startTimer();
    
    const queueRef = ref(rtdb, `matchmaking/${game.id}/queue/${user.uid}`);
    set(queueRef, { timestamp: serverTimestamp(), nickname: user.nickname });
    
    const gameQueueRef = ref(rtdb, `matchmaking/${game.id}/queue`);
    const unsub = onValue(gameQueueRef, async (snap) => {
      const queue = snap.val() || {};
      const uids = Object.keys(queue);
      if (uids.length >= game.players) {
        // Собрать нужное количество игроков
        const players = uids.slice(0, game.players).map(uid => ({ uid, ...queue[uid] }));
        await this.createRoom(game, players);
      }
    });
    this.unsubscribes.push(unsub);
    
    this.botTimeout = setTimeout(() => {
      if (game.players === 1) this.startSoloGame(game);
      else this.startBotMatch(game);
    }, 15000);
  }
  
  async createRoom(game, players) {
    const roomId = push(ref(rtdb, 'gameSessions')).key;
    const roomData = { gameId: game.id, players: {}, status: 'starting', createdAt: serverTimestamp() };
    players.forEach(p => roomData.players[p.uid] = { nickname: p.nickname, ready: true });
    await set(ref(rtdb, `gameSessions/${roomId}`), roomData);
    players.forEach(p => remove(ref(rtdb, `matchmaking/${game.id}/queue/${p.uid}`)));
    this.cleanup();
    const opponent = players.find(p => p.uid !== this.app.user.uid) || { nickname: 'Bot', isBot: true };
    this.app.onMatchFound(roomId, game, opponent, players[0].uid === this.app.user.uid);
  }
  
  startSoloGame(game) {
    this.cleanup();
    this.app.onMatchFound('solo_' + Date.now(), game, { nickname: 'Solo', isBot: true }, true);
  }
  
  startBotMatch(game) { /* аналогично */ }
  startTimer() { /* ... */ }
  cancel() { /* ... */ }
  cleanup() { clearInterval(this.timer); clearTimeout(this.botTimeout); this.unsubscribes.forEach(u => u()); }
}
