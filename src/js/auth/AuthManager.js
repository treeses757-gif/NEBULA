import { db } from '../firebase-config.js';
import { doc, getDoc, setDoc, updateDoc, increment, runTransaction } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export class AuthManager {
  // ... constructor и init без изменений

  async handleAuthSubmit() {
    // валидация как ранее, плюс проверка сложности пароля
    const password = document.getElementById('auth-password').value;
    if (!/(?=.*[A-Z])|(?=.*\d)/.test(password)) {
      alert('Пароль должен содержать хотя бы одну заглавную букву или цифру');
      return;
    }
    // ... остальная логика
  }

  async register(nickname, password) {
    const nicknameLower = nickname.toLowerCase();
    const userRef = doc(db, 'users', nicknameLower);

    try {
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(userRef);
        if (docSnap.exists()) throw new Error('Никнейм занят');
        const salt = CryptoJS.lib.WordArray.random(16).toString();
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
        transaction.set(userRef, userData);
        return userData;
      });
      // после транзакции устанавливаем сессию и пользователя
      const hash = CryptoJS.SHA256(salt + password).toString(); // надо сохранить salt из транзакции? Лучше пересчитать
      // Упростим: сохраняем сессию после успешной регистрации
    } catch (e) {
      throw e;
    }
  }
}
