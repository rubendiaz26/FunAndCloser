import { loginWithGoogle, loginAnonymously, onAuthStateChanged } from './auth.js';
import { state } from './state.js';
import { createSession, joinSession, listenToSession } from './session.js';
import { isConfigured, db } from './firebase.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderRoulette, spinRoulette, animateRouletteTo } from './roulette.js';
import { generateQuestions } from './geminiService.js';
import { startQuiz } from './quiz.js';
import { renderResults, updateDebateBadges } from './results.js';
import { loadHistory } from './history.js';
import { openDebate, closeDebate } from './debate.js';

const views = {
    login: document.getElementById('view-login'),
    home: document.getElementById('view-home'),
    lobbyHost: document.getElementById('view-lobby-host'),
    lobbyGuest: document.getElementById('view-lobby-guest'),
    roulette: document.getElementById('view-roulette'),
    revealing: document.getElementById('view-revealing'),
    loading: document.getElementById('view-loading'),
    quiz: document.getElementById('view-quiz'),
    waitingPartner: document.getElementById('view-waiting-partner'),
    round2Intro: document.getElementById('view-round2-intro'),
    results: document.getElementById('view-results'),
    history: document.getElementById('view-history')
};

const btnLoginGoogle = document.getElementById('btn-login-google');
const inputGuestName = document.getElementById('login-guest-name');
const btnLoginGuest = document.getElementById('btn-login-guest');
const btnCreate = document.getElementById('btn-create-session');
const inputCode = document.getElementById('join-code');
const btnJoin = document.getElementById('btn-join-session');
const btnStartGame = document.getElementById('btn-start-game');
const btnSpin = document.getElementById('btn-spin');

const btnViewHistoryHome = document.getElementById('btn-view-history-home');
const btnViewHistory = document.getElementById('btn-view-history');
const btnBackHome = document.getElementById('btn-back-home');

let lastProcessedStatus = null;

function showView(viewElement) {
    Object.values(views).forEach(el => {
        if(el) {
            el.classList.remove('active');
            el.classList.add('hidden');
        }
    });
    if(viewElement) {
        viewElement.classList.remove('hidden');
        viewElement.classList.add('active');
    }
}

async function init() {
    // Autocompletar código si viene por URL
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code');
    if (codeParam) {
        inputCode.value = codeParam.toUpperCase();
    }

    if (!isConfigured) {
        const warning = document.createElement('div');
        warning.className = "bg-red-500 text-white text-center p-2 mb-4 rounded shadow";
        warning.innerHTML = "<b>Modo Offline (Simulado):</b> Falta configurar Firebase en <code>src/firebase.js</code>";
        document.getElementById('app-container').prepend(warning);
    }

    // Escuchar cambios en la sesión de autenticación
    onAuthStateChanged((user) => {
        if (user) {
            state.uid = user.uid;
            // Si el nombre viene de Google, actualizar la UI
            if (user.displayName) {
                const firstName = user.displayName.split(' ')[0];
                state.playerName = firstName;
                localStorage.setItem('playerName', firstName);
                document.getElementById('user-profile-name').innerText = firstName;
            } else {
                const savedName = localStorage.getItem('playerName');
                if (savedName) document.getElementById('user-profile-name').innerText = savedName;
            }
            
            if (user.photoURL) {
                document.getElementById('user-profile-pic').src = user.photoURL;
            }
            showView(views.home);
        } else {
            showView(views.login);
        }
    });

    btnLoginGoogle?.addEventListener('click', async () => {
        btnLoginGoogle.disabled = true;
        btnLoginGoogle.innerHTML = "Conectando...";
        try {
            await loginWithGoogle();
        } catch (e) {
            alert("Error al iniciar sesión");
            btnLoginGoogle.disabled = false;
            btnLoginGoogle.innerHTML = "Continuar con Google";
        }
    });

    btnLoginGuest?.addEventListener('click', async () => {
        const name = inputGuestName.value.trim() || "Invitado";
        btnLoginGuest.disabled = true;
        btnLoginGuest.innerHTML = "Entrando...";
        try {
            await loginAnonymously(name);
        } catch (e) {
            alert("Error al entrar como invitado");
            btnLoginGuest.disabled = false;
            btnLoginGuest.innerHTML = "Entrar como Invitado";
        }
    });

    btnCreate.addEventListener('click', handleCreate);
    btnJoin.addEventListener('click', handleJoin);
    btnStartGame.addEventListener('click', async () => {
        await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'roulette_waiting' });
    });
    btnSpin.addEventListener('click', spinRoulette);

    btnViewHistoryHome?.addEventListener('click', async () => {
        showView(views.history);
        await loadHistory();
    });
    btnViewHistory?.addEventListener('click', async () => {
        showView(views.history);
        await loadHistory();
    });
    btnBackHome?.addEventListener('click', () => {
        // Volver a la pantalla anterior dependiendo de dónde veníamos
        if (state.currentStatus === 'results') {
            showView(views.results);
        } else {
            showView(views.home);
        }
    });

    window.addEventListener('quizRoundFinished', () => {
        // Si Firebase ya cambió de estado mientras contestábamos, ir directo
        if (state.currentStatus === 'round2_intro') {
            showRound2Intro();
        } else if (state.currentStatus === 'results') {
            showView(views.results);
            renderResults();
        } else {
            // Si estamos en la ronda 2, cambiar el mensaje temporalmente
            if (state.currentStatus === 'round2') {
                const waitingView = views.waitingPartner;
                waitingView.querySelector('h2').innerText = '¡Ronda 2 completada!';
                waitingView.querySelector('p').innerText = 'Calculando compatibilidad...';
                const spinnerCard = waitingView.querySelector('.glass-card');
                if (spinnerCard) spinnerCard.classList.add('hidden');
            }
            showView(views.waitingPartner);
        }
    });
}

async function handleCreate() {
    const name = state.playerName || localStorage.getItem('playerName');
    if (!name) return alert("Error: No se encontró el nombre de usuario");
    
    state.role = 'host';

    btnCreate.innerText = "Creando...";
    btnCreate.disabled = true;

    const code = await createSession(name);
    if (code) {
        state.sessionCode = code;
        document.getElementById('host-room-code').innerText = code;
        showView(views.lobbyHost);
        listenToSession(code, onSessionUpdate);
    }

    btnCreate.innerText = "Crear Partida (Host)";
    btnCreate.disabled = false;
}

async function handleJoin() {
    const name = state.playerName || localStorage.getItem('playerName');
    const code = inputCode.value.trim().toUpperCase();
    
    if (!name) return alert("Error: No se encontró el nombre de usuario");
    if (!code || code.length !== 6) return alert("Código inválido de 6 caracteres");

    state.role = 'guest';

    btnJoin.innerText = "Conectando...";
    btnJoin.disabled = true;

    const success = await joinSession(code, name);
    if (success) {
        state.sessionCode = code;
        showView(views.lobbyGuest);
        listenToSession(code, onSessionUpdate);
    }

    btnJoin.innerText = "Unirse";
    btnJoin.disabled = false;
}
function showRound2Intro() {
    showView(views.round2Intro);
    const btnStartRound2 = document.getElementById('btn-start-round2');
    const round2WaitingMsg = document.getElementById('round2-waiting-msg');
    if (state.role === 'host') {
        btnStartRound2.classList.remove('hidden');
        round2WaitingMsg.classList.add('hidden');
        // Evitar añadir múltiples listeners con .onclick = fn
        btnStartRound2.onclick = async () => {
            btnStartRound2.disabled = true;
            btnStartRound2.innerText = 'Iniciando...';
            await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'round2' });
        };
    } else {
        btnStartRound2.classList.add('hidden');
        round2WaitingMsg.classList.remove('hidden');
    }
}

async function onSessionUpdate(sessionData) {
    // Siempre actualizar el estado actual para que los eventos locales puedan leerlo
    state.currentStatus = sessionData.status;
    state.sessionData = sessionData;

    // Lobby Host logic
    if (state.role === 'host' && sessionData.status === 'waiting') {
        if (sessionData.guestId) {
            document.getElementById('host-waiting-msg').classList.add('hidden');
            document.getElementById('host-ready-msg').classList.remove('hidden');
        }
    }

    // Prevents re-triggering logic for the same status multiple times
    const isNewStatus = lastProcessedStatus !== sessionData.status;
    
    // Transición a la ruleta
    if (sessionData.status === 'roulette_waiting' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        showView(views.roulette);
        renderRoulette();
        const turnMsg = document.getElementById('roulette-turn-msg');
        
        if (state.role === sessionData.spinnerTurn) {
            turnMsg.innerText = "Es tu turno de girar";
            btnSpin.disabled = false;
        } else {
            const partnerName = state.role === 'host' ? sessionData.playerNames.guest : sessionData.playerNames.host;
            turnMsg.innerText = `Turno de ${partnerName}`;
            btnSpin.disabled = true;
        }
    }

    // Animación de la ruleta
    if (sessionData.status === 'spinning' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        
        // Aseguramos que la vista sea la correcta incluso si reconectó tarde
        showView(views.roulette);
        document.getElementById('roulette-turn-msg').innerText = "¡Girando...!";
        btnSpin.disabled = true;
        
        // Animamos localmente en ambas pantallas
        animateRouletteTo(sessionData.rouletteAngle, async () => {
            // Solo quien giró avanza el estado en la base de datos
            if (state.role === sessionData.spinnerTurn) {
                await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'revealing' });
            }
        });
    }

    // Reveal de categoría y tema específico
    if (sessionData.status === 'revealing' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        showView(views.revealing);
        document.getElementById('reveal-emoji').innerText = sessionData.topicEmoji || '🎲';
        document.getElementById('reveal-category').innerText = sessionData.category || 'Categoría';
        document.getElementById('reveal-topic').innerText = sessionData.topic || 'Tema Sorpresa';

        // Solo quien giró avanza a loading
        if (state.role === sessionData.spinnerTurn) {
            setTimeout(async () => {
                await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'loading' });
            }, 3000);
        }
    }

    // Llamada a Gemini (loading)
    if (sessionData.status === 'loading' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        showView(views.loading);
        
        // Solo el Host Técnico hace la llamada a la API
        if (state.role === 'host') {
            const category = sessionData.category;
            const usedQuestions = sessionData.usedQuestions?.[category] || [];
            
            const questions = await generateQuestions(sessionData.topic, category, usedQuestions);
            
            // Extraer solo el texto de las preguntas nuevas para guardar en el historial
            const newQuestionsTexts = questions.map(q => q.question);
            const updatedUsedQuestions = [...usedQuestions, ...newQuestionsTexts];

            // Guardar preguntas en caché local por si hay pérdida de conexión
            localStorage.setItem(`fac_questions_${state.sessionCode}`, JSON.stringify(questions));
            await updateDoc(doc(db, "sessions", state.sessionCode), { 
                questions: questions,
                [`usedQuestions.${category}`]: updatedUsedQuestions,
                status: 'round1'
            });
        }
    }

    // Inicio de Ronda 1
    if (sessionData.status === 'round1' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        // Intentar recuperar preguntas de caché si Firebase falla
        if (!sessionData.questions && localStorage.getItem(`fac_questions_${state.sessionCode}`)) {
            sessionData.questions = JSON.parse(localStorage.getItem(`fac_questions_${state.sessionCode}`));
        }
        showView(views.quiz);
        startQuiz(1);
    }

    // Guardar respuestas de Ronda 1 en caché local
    if (sessionData.status === 'round1' && sessionData.round1?.[state.uid]) {
        localStorage.setItem(`fac_r1_${state.sessionCode}_${state.uid}`, JSON.stringify(sessionData.round1[state.uid]));
    }

    // Syncing de Ronda 1: Comprobar si ambos terminaron → ir a pantalla intermedia
    if (sessionData.status === 'round1' && state.role === 'host') {
        const p1 = sessionData.round1?.[sessionData.hostId]?.length || 0;
        const p2 = sessionData.round1?.[sessionData.guestId]?.length || 0;
        if (p1 === 10 && p2 === 10) {
            await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'round2_intro' });
        }
    }

    // Pantalla intermedia antes de Ronda 2 (sin isNewStatus para que funcione aunque se llegue tarde)
    if (sessionData.status === 'round2_intro') {
        if (isNewStatus) lastProcessedStatus = sessionData.status;
        showRound2Intro();
    }

    // Inicio de Ronda 2
    if (sessionData.status === 'round2' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        showView(views.quiz);
        startQuiz(2);
    }

    // Guardar respuestas de Ronda 2 en caché local
    if (sessionData.status === 'round2' && sessionData.round2?.[state.uid]) {
        localStorage.setItem(`fac_r2_${state.sessionCode}_${state.uid}`, JSON.stringify(sessionData.round2[state.uid]));
    }

    // Syncing de Ronda 2: Comprobar si ambos terminaron
    if (sessionData.status === 'round2' && state.role === 'host') {
        const p1 = sessionData.round2?.[sessionData.hostId]?.length || 0;
        const p2 = sessionData.round2?.[sessionData.guestId]?.length || 0;
        if (p1 === 10 && p2 === 10) {
            await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'results' });
        }
    }

    // Ir a resultados
    if (sessionData.status === 'results') {
        if (isNewStatus) {
            lastProcessedStatus = sessionData.status;
            // Limpiar caché de progreso al terminar
            localStorage.removeItem(`fac_questions_${state.sessionCode}`);
            localStorage.removeItem(`fac_r1_${state.sessionCode}_${state.uid}`);
            localStorage.removeItem(`fac_r2_${state.sessionCode}_${state.uid}`);
        }
        showView(views.results);
        renderResults();
    }

    // Sincronización del Debate
    if (sessionData.activeDebate) {
        if (state.currentDebateEndTime !== sessionData.activeDebate.endTime) {
            state.currentDebateEndTime = sessionData.activeDebate.endTime;
            openDebate(sessionData.activeDebate, async () => {
                // Al cerrar el debate local, el host limpia el estado en Firebase para sincronizar cierre
                if (state.role === 'host') {
                    try {
                        await updateDoc(doc(db, "sessions", state.sessionCode), { activeDebate: null });
                    } catch(e) {}
                }
            });
        }
    } else {
        if (state.currentDebateEndTime) {
            state.currentDebateEndTime = null;
            closeDebate();
        }
    }

    // Actualizar insignias de debates si estamos en la pantalla de resultados
    if (sessionData.status === 'results') {
        updateDebateBadges();
    }
}

document.getElementById('btn-copy-code')?.addEventListener('click', () => {
    const code = document.getElementById('host-room-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('btn-copy-code');
        const oldText = btn.innerText;
        btn.innerText = "✅ ¡Copiado!";
        setTimeout(() => btn.innerText = oldText, 2000);
    });
});

document.getElementById('btn-share-link')?.addEventListener('click', async () => {
    const code = document.getElementById('host-room-code').innerText;
    const shareUrl = window.location.origin + window.location.pathname + '?code=' + code;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'FunAndCloser - Únete a mi partida',
                text: '¡Entra a mi sala para jugar FunAndCloser!',
                url: shareUrl
            });
        } catch (err) {
            console.log('Error compartiendo:', err);
        }
    } else {
        // Fallback: copiar al portapapeles
        navigator.clipboard.writeText(shareUrl).then(() => {
            const btn = document.getElementById('btn-share-link');
            const oldText = btn.innerText;
            btn.innerText = "✅ ¡Enlace Copiado!";
            setTimeout(() => btn.innerText = oldText, 2000);
        });
    }
});

document.addEventListener('DOMContentLoaded', init);
