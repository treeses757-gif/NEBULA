// ========== FILE: src/js/auth/AuthManager.js ==========
import { db } from '../firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export class AuthManager {
  constructor(app) {
    this.app = app;
    this.currentMode = 'login';
  }

  async init() {
    const saved = localStorage.getItem('nebula_session');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        const userDoc = await getDoc(doc(db, 'users', session.nickname_lower));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.passwordHash === session.passwordHash) {
            this.setUser({
              uid: session.nickname_lower,
              nickname: userData.nickname,
              coins: userData.coins,
              inventory: userData.inventory || ['default'],
              currentSkin: userData.currentSkin || 'default'
            });
          } else {
            localStorage.removeItem('nebula_session');
          }
        } else {
          localStorage.removeItem('nebula_session');
        }
      } catch (e) {
        console.warn('Auto-login error', e);
      }
    }
    // Обновляем UI в любом случае
    this.app.ui.updateAuthUI(this.app.user);
  }

  setUser(user) {
    this.app.user = user;
    this.app.ui.updateAuthUI(user);
    if (user) {
      this.app.ui.updateBalanceDisplay(user.coins);
    }
  }

  async handleAuthSubmit() {
    const nicknameInput = document.getElementById('auth-nickname');
    const passwordInput = document.getElementById('auth-password');
    const confirmInput = document.getElementById('auth-confirm');

    const nickname = nicknameInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput ? confirmInput.value : '';

    // Очищаем предыдущие ошибки
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    nicknameInput.classList.remove('error');
    passwordInput.classList.remove('error');
    if (confirmInput) confirmInput.classList.remove('error');

    // Валидация
    if (!nickname.match(/^[A-Za-z0-9_]{3,16}$/)) {
      this.showError('auth-nickname', 'Только латиница, цифры, _, 3-16 символов');
      return;
    }
    if (password.length < 6) {
      this.showError('auth-password', 'Минимум 6 символов');
      return;
    }
    if (this.currentMode === 'register' && password !== confirm) {
      this.showError('auth-confirm', 'Пароли не совпадают');
      return;
    }

    const submitBtn = document.getElementById('auth-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');

    submitBtn.disabled = true;
    btnText.style.display = 'none';
    spinner.style.display = 'inline-block';

    try {
      if (this.currentMode === 'register') {
        await this.register(nickname, password);
      } else {
        await this.login(nickname, password);
      }
      document.getElementById('auth-modal').classList.remove('active');
    } catch (e) {
      alert(e.message);
    } finally {
      submitBtn.disabled = false;
      btnText.style.display = 'inline';
      spinner.style.display = 'none';
    }
  }

  async register(nickname, password) {
    const nicknameLower = nickname.toLowerCase();
    const userRef = doc(db, 'users', nicknameLower);
    const existing = await getDoc(userRef);
    if (existing.exists()) throw new Error('Никнейм уже занят');

    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString();
    const hash = CryptoJS.SHA256(salt + password).toString();

    const userData = {
      nickname,
      nickname_lower: nicknameLower,
      passwordHash: hash,
      salt,
      coins: 500,
      inventory: ['default'],
      currentSkin: 'default',
      createdAt: new Date()
    };

    await setDoc(userRef, userData);

    const session = { nickname_lower: nicknameLower, passwordHash: hash };
    localStorage.setItem('nebula_session', JSON.stringify(session));

    this.setUser({
      uid: nicknameLower,
      nickname,
      coins: 500,
      inventory: ['default'],
      currentSkin: 'default'
    });
  }

  async login(nickname, password) {
    const nicknameLower = nickname.toLowerCase();
    const userRef = doc(db, 'users', nicknameLower);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) throw new Error('Неверный ник или пароль');

    const userData = userDoc.data();
    const hash = CryptoJS.SHA256(userData.salt + password).toString();
    if (hash !== userData.passwordHash) throw new Error('Неверный ник или пароль');

    const session = { nickname_lower: nicknameLower, passwordHash: hash };
    localStorage.setItem('nebula_session', JSON.stringify(session));

    this.setUser({
      uid: nicknameLower,
      nickname: userData.nickname,
      coins: userData.coins,
      inventory: userData.inventory || ['default'],
      currentSkin: userData.currentSkin || 'default'
    });
  }

  async addCoins(amount) {
    if (!this.app.user) return;
    const userRef = doc(db, 'users', this.app.user.uid);
    await updateDoc(userRef, { coins: increment(amount) });
    this.app.user.coins += amount;
    this.app.ui.updateBalanceDisplay(this.app.user.coins);
  }

  showError(fieldId, message) {
    const input = document.getElementById(fieldId);
    if (input) {
      input.classList.add('error');
      const errorDiv = document.querySelector(`.error-message[data-for="${fieldId}"]`);
      if (errorDiv) errorDiv.textContent = message;
    }
  }

  logout() {
    localStorage.removeItem('nebula_session');
    this.app.user = null;
    this.app.ui.updateAuthUI(null);
  }
}
