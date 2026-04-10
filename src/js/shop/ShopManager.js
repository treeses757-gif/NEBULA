import { db } from '../firebase-config.js';
import { doc, updateDoc, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export class ShopManager {
  constructor(app) {
    this.app = app;
    this.skins = [
      { id: 'default', name: 'Стандартный', price: 0, gradient: '#aaa' },
      { id: 'gold', name: 'Золотой', price: 500, gradient: 'gold' },
      { id: 'neon', name: 'Неоновый', price: 1000, gradient: 'cyan' },
      { id: 'cyber', name: 'Киберпанк', price: 1500, gradient: '#ff00c1' }
    ];
  }

  renderSkins() {
    const container = document.getElementById('skins-container');
    container.innerHTML = '';
    const user = this.app.user;
    if (!user) return;
    this.skins.forEach(skin => {
      const owned = user.inventory?.includes(skin.id);
      const card = document.createElement('div');
      card.className = 'skin-card';
      if (user.currentSkin === skin.id) card.classList.add('selected');
      card.innerHTML = `
        <div class="skin-preview" style="background:${skin.gradient}"></div>
        <div class="skin-name">${skin.name}</div>
        <div class="skin-price">${skin.price}💰</div>
        <button class="skin-btn" ${owned || user.coins < skin.price ? 'disabled' : ''}>${owned ? 'Куплено' : 'Купить'}</button>
      `;
      card.querySelector('.skin-btn').onclick = () => this.buySkin(skin);
      container.appendChild(card);
    });
  }

  async buySkin(skin) {
    const user = this.app.user;
    if (!user || user.coins < skin.price || user.inventory.includes(skin.id)) return;

    // Анимация монет (простая)
    this.animateCoins();

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      coins: increment(-skin.price),
      inventory: arrayUnion(skin.id)
    });

    user.coins -= skin.price;
    user.inventory.push(skin.id);
    this.app.ui.updateBalanceDisplay(user.coins);
    this.renderSkins();

    // Звук покупки
    this.playSound('data:audio/wav;base64,UklGRlwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVoAAACAgICAf39/f39/f3+AgICAf39/f39/f3+AgICAf39/f39/f3+AgICAf39/f39/f3+AgICAf39/f38=');
  }

  animateCoins() {
    const balanceEl = document.querySelector('.balance');
    if (!balanceEl) return;
    for (let i=0; i<8; i++) {
      const coin = document.createElement('div');
      coin.textContent = '💰';
      coin.style.position = 'fixed';
      coin.style.left = balanceEl.getBoundingClientRect().left + 'px';
      coin.style.top = balanceEl.getBoundingClientRect().top + 'px';
      coin.style.transition = 'all 0.5s cubic-bezier(0.2,0.9,0.4,1)';
      coin.style.zIndex = '9999';
      document.body.appendChild(coin);
      setTimeout(() => {
        coin.style.left = (window.innerWidth/2) + 'px';
        coin.style.top = (window.innerHeight/2) + 'px';
        coin.style.opacity = '0';
        coin.style.transform = 'scale(0.5)';
      }, 10);
      setTimeout(() => coin.remove(), 600);
    }
  }

  playSound(base64) {
    const audio = new Audio(base64);
    audio.volume = 0.3;
    audio.play().catch(e=>{});
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
        <div class="skin-preview" style="background:${skin.gradient}"></div>
        <div class="skin-name">${skin.name}</div>
        <button class="skin-btn">Выбрать</button>
      `;
      card.querySelector('.skin-btn').onclick = () => this.selectSkin(skin.id);
      container.appendChild(card);
    });
  }

  async selectSkin(skinId) {
    const user = this.app.user;
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { currentSkin: skinId });
    user.currentSkin = skinId;
    this.renderInventory();
  }
}
