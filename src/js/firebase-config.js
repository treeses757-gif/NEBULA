// ========== FILE: src/js/firebase-config.js ==========
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyADQHyaiHrnCzk-IsrgZguP1Sl6eRqo9pc",
  authDomain: "minigames-fb308.firebaseapp.com",
  projectId: "minigames-fb308",
  storageBucket: "minigames-fb308.firebasestorage.app",
  messagingSenderId: "73826070494",
  appId: "1:73826070494:web:23dd86d36861af4190f74f",
  measurementId: "G-TT3BD4T6FF"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export default app;
