import { db, isConfigured } from './firebase.js';
import { doc, setDoc, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state } from './state.js';

function generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export async function createSession(hostName) {
    if (!isConfigured) {
        console.warn("Firebase no configurado, simulando creación de sala...");
        return generateCode();
    }

    const code = generateCode();
    const sessionRef = doc(db, "sessions", code);
    
    await setDoc(sessionRef, {
        code: code,
        status: "waiting",
        hostId: state.uid,
        guestId: null,
        spinnerTurn: "host",
        playerNames: { host: hostName, guest: null },
        category: null,
        topic: null,
        rouletteAngle: 0,
        questions: [],
        round1: {},
        round2: {},
        scores: { matchA: 0, matchB: 0, total: 0 }
    });

    return code;
}

export async function joinSession(code, guestName) {
    if (!isConfigured) {
        console.warn("Firebase no configurado, simulando unirse a sala...");
        return true;
    }

    code = code.toUpperCase();
    const sessionRef = doc(db, "sessions", code);
    const docSnap = await getDoc(sessionRef);

    if (!docSnap.exists()) {
        alert("La sala no existe.");
        return false;
    }

    const data = docSnap.data();
    if (data.guestId && data.guestId !== state.uid) {
        alert("La sala ya está llena.");
        return false;
    }

    await updateDoc(sessionRef, {
        guestId: state.uid,
        "playerNames.guest": guestName
    });

    return true;
}

export function listenToSession(code, onUpdateCallback) {
    if (!isConfigured) {
        console.warn("Simulando actualización de sesión en 3 segundos...");
        setTimeout(() => {
            onUpdateCallback({ status: 'waiting', guestId: 'mock-guest' });
        }, 3000);
        return;
    }

    const sessionRef = doc(db, "sessions", code);
    state.unsubscribeSession = onSnapshot(sessionRef, (docSnap) => {
        if (docSnap.exists()) {
            state.sessionData = docSnap.data();
            onUpdateCallback(state.sessionData);
        } else {
            console.log("La sesión fue eliminada");
        }
    });
}
