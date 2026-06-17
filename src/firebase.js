import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Configuración real de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD4xEASs11rTbDmHno-gck6OlJ37qjXLdQ",
  authDomain: "funandcloser.firebaseapp.com",
  projectId: "funandcloser",
  storageBucket: "funandcloser.firebasestorage.app",
  messagingSenderId: "904180527388",
  appId: "1:904180527388:web:98c05ea6bd5e56e2af0ad9",
  measurementId: "G-HEDJBSVZBZ"
};

let app, db, auth, googleProvider;
const isConfigured = firebaseConfig.apiKey !== "TU_API_KEY";

if (isConfigured) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
} else {
    console.warn("⚠️ FIREBASE NO CONFIGURADO: Debes agregar las credenciales en src/firebase.js");
}

export { db, auth, googleProvider, isConfigured };
