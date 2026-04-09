// ========== FILE: src/js/shop/ShopManager.js ==========
import { db } from '../firebase-config.js';
import { doc, updateDoc, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export class ShopManager {
  constructor(app) {
    this.app = app;
    this.skins = [
      { id: 'default', name: 'Стандартный', price: 0, gradient: 'linear-gradient(135deg, #aaa, #666)' },
      { id: 'gold', name: 'Золотой', price: 500, gradient: 'linear-gradient(135deg, #f1c40f, #e67e22)' },
      { id: 'neon', name: 'Неоновый', price: 1000, gradient: 'linear-gradient(135deg, #00f2fe, #4facfe)', glow: true },
      { id: 'cyber', name: 'Киберпанк', price: 1500, gradient: 'repeating-linear-gradient(45deg, #ff00c1, #00fff9)' }
    ];
  }
  
  renderSkins() {
    const container = document.getElementById('skins-container');
    container.innerHTML = '';
    const user = this.app.user;
    if (!user) return;
    
    this.skins.forEach(skin => {
      const card = document.createElement('div');
      card.className = 'skin-card';
      if (user.currentSkin === skin.id) card.classList.add('selected');
      
      const owned = user.inventory.includes(skin.id);
      
      card.innerHTML = `
        <div class="skin-preview" style="background: ${skin.gradient}; ${skin.glow ? 'box-shadow: 0 0 15px #4facfe;' : ''}"></div>
        <div class="skin-name">${skin.name}</div>
        <div class="skin-price">${skin.price} 💰</div>
        <button class="skin-btn" data-skin-id="${skin.id}" ${owned || user.coins < skin.price ? 'disabled' : ''}>
          ${owned ? 'Куплено' : 'Купить'}
        </button>
      `;
      
      card.querySelector('.skin-btn').addEventListener('click', () => this.buySkin(skin));
      container.appendChild(card);
    });
  }
  
  async buySkin(skin) {
    const user = this.app.user;
    if (!user || user.coins < skin.price || user.inventory.includes(skin.id)) return;
    
    // Анимация "монетки летят" (упрощенно)
    this.animateCoinsFly();
    
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      coins: increment(-skin.price),
      inventory: arrayUnion(skin.id)
    });
    
    user.coins -= skin.price;
    user.inventory.push(skin.id);
    this.app.ui.updateBalanceDisplay(user.coins);
    this.renderSkins();
    
    // Звук (base64 не реализован для краткости, можно добавить)
  }
  
  animateCoinsFly() {
    // Заглушка
  }
  
  renderInventory() {
    const container = document.getElementById('inventory-container');
    container.innerHTML = '';
    const user = this.app.user;
    if (!user) return;
    
    this.skins.filter(s => user.inventory.includes(s.id)).forEach(skin => {
      const card = document.createElement('div');
      card.className = 'skin-card';
      if (user.currentSkin === skin.id) card.classList.add('selected');
      
      card.innerHTML = `
        <div class="skin-preview" style="background: ${skin.gradient};"></div>
        <div class="skin-name">${skin.name}</div>
        <button class="skin-btn" data-skin-id="${skin.id}">Выбрать</button>
      `;
      card.querySelector('.skin-btn').addEventListener('click', () => this.selectSkin(skin.id));
      container.appendChild(card);
    });
  }
  
  async selectSkin(skinId) {
    const user = this.app.user;
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { currentSkin: skinId });
    user.currentSkin = skinId;
    this.renderInventory();
    // Можно обновить аватар
  }
}