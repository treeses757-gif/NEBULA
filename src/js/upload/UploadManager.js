import { storage, db } from '../firebase-config.js';
import { ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export class UploadManager {
  constructor(app) { this.app = app; }

  async submit() {
    const title = document.getElementById('game-title').value.trim();
    const players = parseInt(document.getElementById('game-players').value);
    const avatarFile = document.getElementById('game-avatar').files[0];
    const htmlFile = document.getElementById('game-file').files[0];

    if (!title || !avatarFile || !htmlFile) return alert('Заполните все поля');
    if (htmlFile.size > 40 * 1024) return alert('HTML-файл должен быть не более 40 КБ');
    if (!htmlFile.name.endsWith('.html') && !htmlFile.name.endsWith('.htm')) return alert('Файл должен быть HTML');

    try {
      const avatarPath = `games/${Date.now()}_${avatarFile.name}`;
      const htmlPath = `games/${Date.now()}_${htmlFile.name}`;

      const avatarUpload = await uploadBytes(storageRef(storage, avatarPath), avatarFile);
      const htmlUpload = await uploadBytes(storageRef(storage, htmlPath), htmlFile);

      const avatarUrl = await getDownloadURL(avatarUpload.ref);
      const htmlUrl = await getDownloadURL(htmlUpload.ref);

      await addDoc(collection(db, 'games'), {
        title,
        players,
        avatarUrl,
        htmlUrl,
        ownerUid: this.app.user.uid,
        createdAt: new Date()
      });

      alert('Игра успешно загружена!');
      document.getElementById('upload-modal').classList.remove('active');
      this.app.refreshGames();
    } catch (e) {
      alert('Ошибка загрузки: ' + e.message);
    }
  }
}
