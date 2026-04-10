import { rtdb } from '../firebase-config.js';
import { ref, set, onValue, remove, serverTimestamp, push, get, update, runTransaction } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class Matchmaker {
  constructor(app) {
    this.app = app;
    this.currentGame = null;
    this.unsubscribes = [];
    this.timer = null;
    this.botTimeout = null;
    this.userQueueRef = null;
  }

  joinQueue(game) {
    // Очистка предыдущих подписок и таймеров
    this.cleanup();
    this.currentGame = game;
    const user = this.app.user;
    if (!user) return;

    this.app.ui.showMatchmaking();
    this.startTimer();

    const queueRef = ref(rtdb, `matchmaking/${game.id}/queue/${user.uid}`);
    this.userQueueRef = queueRef;
    set(queueRef, {
      timestamp: serverTimestamp(),
      nickname: user.nickname,
      mmr: user.coins || 100
    });

    // Слушаем очередь
    const gameQueueRef = ref(rtdb, `matchmaking/${game.id}/queue`);
    const unsub = onValue(gameQueueRef, async (snapshot) => {
      const queue = snapshot.val() || {};
      const uids = Object.keys(queue);
      if (uids.length >= game.players) {
        // Отбираем нужное количество игроков в порядке присоединения
        const players = uids.slice(0, game.players).map(uid => ({
          uid,
          ...queue[uid]
        }));
        await this.createRoom(game, players);
      }
    });
    this.unsubscribes.push(unsub);

    // Таймер на бота (15 секунд)
    this.botTimeout = setTimeout(() => {
      if (game.players === 1) {
        this.startSoloGame(game);
      } else {
        this.startBotMatch(game);
      }
    }, 15000);
  }

  async createRoom(game, players) {
    // Атомарное удаление из очереди с проверкой, что игроки ещё там
    const queueRef = ref(rtdb, `matchmaking/${game.id}/queue`);
    try {
      await runTransaction(queueRef, (currentQueue) => {
        if (!currentQueue) return {};
        const newQueue = { ...currentQueue };
        players.forEach(p => {
          if (newQueue[p.uid]) delete newQueue[p.uid];
        });
        return newQueue;
      });
    } catch (e) {
      console.warn('Transaction failed, fallback to individual removes', e);
      players.forEach(p => remove(ref(rtdb, `matchmaking/${game.id}/queue/${p.uid}`)));
    }

    this.cleanup();

    const roomId = push(ref(rtdb, 'gameSessions')).key;
    const roomData = {
      gameId: game.id,
      players: {},
      status: 'starting',
      createdAt: serverTimestamp()
    };
    players.forEach(p => {
      roomData.players[p.uid] = {
        nickname: p.nickname,
        ready: true
      };
    });

    await set(ref(rtdb, `gameSessions/${roomId}`), roomData);

    // Определяем оппонента для текущего пользователя (может быть ботом)
    const opponent = players.find(p => p.uid !== this.app.user.uid) || {
      uid: players[0].uid === this.app.user.uid ? players[1].uid : players[0].uid,
      nickname: players.find(p => p.uid !== this.app.user.uid)?.nickname || 'Opponent',
      isBot: players.some(p => p.isBot)
    };
    const isHost = players[0].uid === this.app.user.uid;

    this.app.onMatchFound(roomId, game, opponent, isHost);
  }

  startSoloGame(game) {
    this.cleanup();
    // Удаляем пользователя из очереди, если он там ещё есть
    if (this.userQueueRef) remove(this.userQueueRef);
    const roomId = 'solo_' + Date.now();
    const opponent = { uid: 'bot_solo', nickname: '🤖 Бот', isBot: true };
    this.app.onMatchFound(roomId, game, opponent, true);
  }

  startBotMatch(game) {
    this.cleanup();
    if (this.userQueueRef) remove(this.userQueueRef);
    const botId = 'bot_' + Date.now();
    const opponent = { uid: botId, nickname: '🤖 Бот', isBot: true };
    // Создаём комнату с ботом
    const roomId = push(ref(rtdb, 'gameSessions')).key;
    const roomData = {
      gameId: game.id,
      players: {
        [this.app.user.uid]: { nickname: this.app.user.nickname, ready: true },
        [botId]: { nickname: opponent.nickname, ready: true, isBot: true }
      },
      status: 'starting',
      createdAt: serverTimestamp()
    };
    set(ref(rtdb, `gameSessions/${roomId}`), roomData).then(() => {
      this.app.onMatchFound(roomId, game, opponent, true);
    });
  }

  startTimer() {
    let seconds = 0;
    const timerEl = document.getElementById('matchmaking-timer');
    this.timer = setInterval(() => {
      seconds++;
      const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
      const secs = (seconds % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  cancel() {
    if (this.currentGame && this.app.user) {
      remove(ref(rtdb, `matchmaking/${this.currentGame.id}/queue/${this.app.user.uid}`));
    }
    this.cleanup();
    this.app.ui.hideMatchmaking();
  }

  cleanup() {
    clearInterval(this.timer);
    this.timer = null;
    clearTimeout(this.botTimeout);
    this.botTimeout = null;
    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];
    this.currentGame = null;
    this.userQueueRef = null;
  }
}
