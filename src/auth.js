import { auth, googleProvider, isConfigured } from './firebase.js';
import { signInWithPopup, signInAnonymously, onAuthStateChanged as firebaseOnAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { state } from './state.js';

export async function loginWithGoogle() {
    if (!isConfigured) {
        console.warn("Simulando login de Google...");
        let uid = localStorage.getItem('mockUid');
        if (!uid) {
            uid = 'mock-' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('mockUid', uid);
        }
        state.playerName = "Usuario Local";
        localStorage.setItem('playerName', state.playerName);
        return uid;
    }

    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Guardamos el nombre del usuario de Google
        if (user.displayName) {
            const firstName = user.displayName.split(' ')[0];
            state.playerName = firstName;
            localStorage.setItem('playerName', firstName);
        }
        
        return user.uid;
    } catch (error) {
        console.error("Error en login con Google:", error);
        throw error;
    }
}

export async function loginAnonymously(name) {
    if (!isConfigured) {
        console.warn("Simulando login anónimo...");
        let uid = localStorage.getItem('mockUid');
        if (!uid) {
            uid = 'mock-' + Math.random().toString(36).substring(2, 9);
            localStorage.setItem('mockUid', uid);
        }
        state.playerName = name;
        localStorage.setItem('playerName', name);
        return uid;
    }

    try {
        const result = await signInAnonymously(auth);
        state.playerName = name;
        localStorage.setItem('playerName', name);
        return result.user.uid;
    } catch (error) {
        console.error("Error en login anónimo:", error);
        throw error;
    }
}

// Helper para escuchar el estado de autenticación
export function onAuthStateChanged(callback) {
    if (!isConfigured) {
        setTimeout(() => callback(null), 100);
        return;
    }
    return firebaseOnAuthStateChanged(auth, callback);
}
