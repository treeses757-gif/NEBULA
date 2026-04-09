// ========== FILE: src/js/games/RuneWeaver.js ==========
import { GameController } from './GameController.js';
import { ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

export class RuneWeaverGame extends GameController {
  constructor(options) {
    super(options);
    this.boardSize = 7;
    this.cellSize = 60;
    this.offsetX = (800 - this.boardSize * this.cellSize) / 2;
    this.offsetY = (600 - this.boardSize * this.cellSize) / 2;
    
    // Инициализация ячеек
    this.cells = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill().map(() => ({
      owner: null,
      edges: 0b0000 // N,E,S,W
    })));
    
    this.currentPlayer = 0; // 0 - хост, 1 - оппонент
    this.isMyTurn = this.isHost;
    this.selectedCell = null;
    this.gameStateRef = ref(this.db, `gameSessions/${this.roomId}/gameState`);
    this.animProgress = 0;
    
    // Для бота
    this.botAI = this.opponent.isBot ? this.initBot() : null;
  }
  
  initBot() {
    return {
      makeMove: () => {
        if (!this.isMyTurn) return;
        // Простой случайный ход
        const empty = [];
        for (let i=0; i<this.boardSize; i++) {
          for (let j=0; j<this.boardSize; j++) {
            if (this.cells[i][j].owner === null) empty.push({x:i, y:j});
          }
        }
        if (empty.length === 0) return;
        const {x, y} = empty[Math.floor(Math.random()*empty.length)];
        this.cells[x][y].owner = 1;
        this.isMyTurn = false;
        this.currentPlayer = 0;
        this.captureTerritory();
        update(this.gameStateRef, { cells: this.cells, turn: this.currentPlayer });
      }
    };
  }
  
  setupListeners() {
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    
    if (this.isHost) {
      // Хост управляет состоянием
      this.syncInterval = setInterval(() => {
        update(this.gameStateRef, { cells: this.cells, turn: this.currentPlayer });
      }, 100);
    } else {
      const unsub = onValue(this.gameStateRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          if (data.cells) this.cells = data.cells;
          if (data.turn !== undefined) {
            this.currentPlayer = data.turn;
            this.isMyTurn = (this.currentPlayer === 1);
          }
        }
      });
      this.unsubscribes.push(unsub);
    }
  }
  
  handleClick(e) {
    if (!this.isMyTurn) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const col = Math.floor((x - this.offsetX) / this.cellSize);
    const row = Math.floor((y - this.offsetY) / this.cellSize);
    if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return;
    
    if (this.cells[row][col].owner === null) {
      this.cells[row][col].owner = this.isHost ? 0 : 1;
      this.isMyTurn = false;
      this.currentPlayer = this.isHost ? 1 : 0;
      this.captureTerritory();
      
      if (this.isHost) {
        update(this.gameStateRef, { cells: this.cells, turn: this.currentPlayer });
      } else {
        // Отправить ход хосту
        set(ref(this.db, `gameSessions/${this.roomId}/move`), {
          row, col, player: this.currentPlayer
        });
      }
      
      if (this.botAI && !this.isMyTurn) {
        setTimeout(() => this.botAI.makeMove(), 500);
      }
    }
  }
  
  captureTerritory() {
    // Flood fill для каждой пустой ячейки
    const visited = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(false));
    const toCapture = [];
    
    for (let i=0; i<this.boardSize; i++) {
      for (let j=0; j<this.boardSize; j++) {
        if (this.cells[i][j].owner === null && !visited[i][j]) {
          const region = [];
          const queue = [[i, j]];
          visited[i][j] = true;
          let touchesEmpty = false;
          let borderOwner = null;
          
          while (queue.length) {
            const [r, c] = queue.shift();
            region.push([r, c]);
            
            // Проверяем соседей
            const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
            for (let [nr, nc] of neighbors) {
              if (nr < 0 || nr >= this.boardSize || nc < 0 || nc >= this.boardSize) {
                touchesEmpty = true;
                continue;
              }
              if (this.cells[nr][nc].owner === null) {
                if (!visited[nr][nc]) {
                  visited[nr][nc] = true;
                  queue.push([nr, nc]);
                }
              } else {
                if (borderOwner === null) borderOwner = this.cells[nr][nc].owner;
                else if (borderOwner !== this.cells[nr][nc].owner) touchesEmpty = true;
              }
            }
          }
          
          if (!touchesEmpty && borderOwner !== null) {
            region.forEach(([r, c]) => toCapture.push([r, c, borderOwner]));
          }
        }
      }
    }
    
    toCapture.forEach(([r, c, owner]) => {
      this.cells[r][c].owner = owner;
    });
  }
  
  update() {
    if (this.botAI && this.isMyTurn && this.opponent.isBot) {
      // Бот делает ход
      this.botAI.makeMove();
    }
  }
  
  render() {
    this.ctx.clearRect(0, 0, 800, 600);
    
    // Сетка
    for (let i=0; i<this.boardSize; i++) {
      for (let j=0; j<this.boardSize; j++) {
        const x = this.offsetX + j * this.cellSize;
        const y = this.offsetY + i * this.cellSize;
        
        // Фон ячейки
        if (this.cells[i][j].owner === 0) {
          this.ctx.fillStyle = '#6C5CE7';
        } else if (this.cells[i][j].owner === 1) {
          this.ctx.fillStyle = '#e74c3c';
        } else {
          this.ctx.fillStyle = '#1a1a2e';
        }
        this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
        
        // Рёбра
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        const edges = this.cells[i][j].edges;
        if (!(edges & 0b1000)) { // N
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x+this.cellSize, y);
          this.ctx.stroke();
        }
        if (!(edges & 0b0100)) { // E
          this.ctx.beginPath();
          this.ctx.moveTo(x+this.cellSize, y);
          this.ctx.lineTo(x+this.cellSize, y+this.cellSize);
          this.ctx.stroke();
        }
        if (!(edges & 0b0010)) { // S
          this.ctx.beginPath();
          this.ctx.moveTo(x, y+this.cellSize);
          this.ctx.lineTo(x+this.cellSize, y+this.cellSize);
          this.ctx.stroke();
        }
        if (!(edges & 0b0001)) { // W
          this.ctx.beginPath();
          this.ctx.moveTo(x, y);
          this.ctx.lineTo(x, y+this.cellSize);
          this.ctx.stroke();
        }
      }
    }
    
    // Индикатор хода
    this.ctx.fillStyle = this.isMyTurn ? '#2ecc71' : '#e74c3c';
    this.ctx.beginPath();
    this.ctx.arc(760, 30, 15, 0, 2*Math.PI);
    this.ctx.fill();
  }
  
  destroy() {
    clearInterval(this.syncInterval);
    super.destroy();
  }
}