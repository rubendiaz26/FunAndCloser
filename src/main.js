import { loginWithGoogle, loginAnonymously, onAuthStateChanged, logout } from './auth.js';
import { state } from './state.js';
import { createSession, joinSession, listenToSession, verifyActiveSession } from './session.js';
import { isConfigured, db } from './firebase.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { renderRoulette, spinRoulette, animateRouletteTo, resetRouletteAngle } from './roulette.js';
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
    history: document.getElementById('view-history'),
    generation_error: document.getElementById('view-generation-error')
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
const btnExitGame = document.getElementById('btn-exit-game');
const btnExitQuiz = document.getElementById('btn-exit-quiz');
const btnLogout = document.getElementById('btn-logout');
const btnCancelLoading = document.getElementById('btn-cancel-loading');
const btnCancelWaiting = document.getElementById('btn-cancel-waiting');
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
    onAuthStateChanged(async (user) => {
        if (user) {
            state.uid = user.uid;
            
            const savedGender = localStorage.getItem('playerGender');
            if (savedGender) state.playerGender = savedGender;

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

            // Intentar reconectar si hay sesión activa
            const activeSessionRaw = localStorage.getItem('fac_active_session');
            if (activeSessionRaw) {
                try {
                    const activeSession = JSON.parse(activeSessionRaw);
                    const sessionData = await verifyActiveSession(activeSession.code);
                    
                    if (sessionData && 
                       ((activeSession.role === 'host' && sessionData.hostId === state.uid) || 
                        (activeSession.role === 'guest' && sessionData.guestId === state.uid))) {
                        
                        state.sessionCode = activeSession.code;
                        state.role = activeSession.role;
                        
                        if (sessionData.status === 'waiting') {
                            showView(activeSession.role === 'host' ? views.lobbyHost : views.lobbyGuest);
                            if (activeSession.role === 'host') {
                                document.getElementById('host-room-code').innerText = activeSession.code;
                            }
                        } else {
                            // Mostrar temporalmente loading hasta que onSessionUpdate pinte la vista correcta
                            showView(views.loading); 
                        }
                        
                        listenToSession(activeSession.code, onSessionUpdate);
                        return; // Evita mostrar la vista de "home"
                    } else {
                        // Limpiar si ya no es válida
                        localStorage.removeItem('fac_active_session');
                    }
                } catch(e) {
                    console.error("Error reconectando:", e);
                }
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
            const genderEl = document.querySelector('input[name="login-gender"]:checked');
            if(genderEl) {
                state.playerGender = genderEl.value;
                localStorage.setItem('playerGender', genderEl.value);
            }
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
            const genderEl = document.querySelector('input[name="login-gender"]:checked');
            if(genderEl) {
                state.playerGender = genderEl.value;
                localStorage.setItem('playerGender', genderEl.value);
            }
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

    btnExitGame?.addEventListener('click', () => {
        localStorage.removeItem('fac_active_session');
        showView(views.home);
    });

    btnExitQuiz?.addEventListener('click', () => {
        if(confirm("¿Seguro que quieres salir de la ronda actual? Se perderá el progreso no guardado.")) {
            localStorage.removeItem('fac_active_session');
            location.reload();
        }
    });

    // Botones de escape en pantallas de bloqueo (loading / waiting)
    function handleCancelAndExit() {
        if(confirm("¿Seguro que quieres salir del juego?")) {
            localStorage.removeItem('fac_active_session');
            location.reload();
        }
    }
    btnCancelLoading?.addEventListener('click', handleCancelAndExit);
    btnCancelWaiting?.addEventListener('click', handleCancelAndExit);

    btnLogout?.addEventListener('click', async () => {
        if(confirm("¿Seguro que quieres cerrar sesión y volver a la pantalla de inicio?")) {
            await logout();
            localStorage.removeItem('playerName');
            localStorage.removeItem('fac_active_session');
            location.reload();
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
        localStorage.setItem('fac_active_session', JSON.stringify({ code: code, role: 'host' }));
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
        localStorage.setItem('fac_active_session', JSON.stringify({ code: code, role: 'guest' }));
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

    // Quien giró la ruleta es quien inicia la Ronda 2
    const isSpinner = state.role === state.sessionData?.spinnerTurn;

    if (isSpinner) {
        btnStartRound2.classList.remove('hidden');
        round2WaitingMsg.classList.add('hidden');
        btnStartRound2.disabled = false;
        btnStartRound2.innerText = 'Iniciar Ronda 2';
        // Evitar añadir múltiples listeners con .onclick = fn
        btnStartRound2.onclick = async () => {
            btnStartRound2.disabled = true;
            btnStartRound2.innerText = 'Iniciando...';
            try {
                await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'round2' });
            } catch (error) {
                console.error("Error updating to round2:", error);
                alert("Hubo un error de conexión al iniciar la Ronda 2. Reintentando...");
                btnStartRound2.disabled = false;
                btnStartRound2.innerText = 'Iniciar Ronda 2';
            }
        };
    } else {
        btnStartRound2.classList.add('hidden');
        round2WaitingMsg.classList.remove('hidden');
        // Actualizar el mensaje de espera para que sea claro quién debe iniciar
        const spinnerName = state.sessionData?.spinnerTurn === 'host'
            ? state.sessionData?.playerNames?.host
            : state.sessionData?.playerNames?.guest;
        round2WaitingMsg.innerText = spinnerName
            ? `Esperando a que ${spinnerName} inicie la Ronda 2...`
            : 'Esperando a que el otro jugador inicie la Ronda 2...';
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
    
    // Transición a la ruleta (también resetea el ciclo del juego anterior)
    if (sessionData.status === 'roulette_waiting' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        resetRouletteAngle(); // Resetear ángulo acumulado para nueva partida
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

        // Inicializar selector de intensidad
        initSpicySelector(sessionData.spicyLevel || 1);
    }

    // Sincronizar selector de intensidad cuando el host lo cambia
    if (sessionData.status === 'roulette_waiting' && typeof sessionData.spicyLevel === 'number') {
        setSpicyUI(sessionData.spicyLevel);
    }

    // Animación de la ruleta
    if (sessionData.status === 'spinning' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        
        // Aseguramos que la vista sea la correcta incluso si reconectó tarde
        showView(views.roulette);
        // Renderizar la ruleta SIEMPRE antes de animar (por si reconectó y el wheel está vacío)
        renderRoulette();
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

        // AMBOS jugadores avanzan a loading después del reveal
        // El host escribe en Firestore, pero el invitado también ve la transición local
        if (state.role === sessionData.spinnerTurn) {
            // Quien giró escribe el cambio en Firebase (sincroniza al otro)
            setTimeout(async () => {
                await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'loading' });
            }, 2500);
        }
        // Ambos jugadores ven la pantalla de loading localmente después del delay
        setTimeout(() => {
            showView(views.loading);
        }, 2500);
    }

    // Llamada a Gemini (loading)
    if (sessionData.status === 'loading' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        showView(views.loading);
        
        // Solo el Host Técnico hace la llamada a la API
        if (state.role === 'host') {
            const category = sessionData.category;
            const topic = sessionData.topic;
            // Usamos el topic como clave (sin emojis, compatible con Firestore field paths)
            // Esto garantiza variedad: misma categoría + distinto topic = preguntas distintas
            const topicKey = topic.replace(/\s+/g, '_').replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9_]/g, '');
            const usedQuestions = sessionData.usedQuestions?.[topicKey] || [];
            
            try {
                // Timeout de 25 segundos: si Gemini no responde, lanzamos error controlado
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout: Gemini tardó demasiado')), 25000)
                );
                const questions = await Promise.race([
                    generateQuestions(topic, category, usedQuestions, sessionData.spicyLevel || 1),
                    timeoutPromise
                ]);
                
                // Extraer solo el texto de las preguntas nuevas para guardar en el historial
                const newQuestionsTexts = questions.map(q => q.question);
                const updatedUsedQuestions = [...usedQuestions, ...newQuestionsTexts];

                // Guardar preguntas en caché local por si hay pérdida de conexión
                localStorage.setItem(`fac_questions_${state.sessionCode}`, JSON.stringify(questions));
                await updateDoc(doc(db, "sessions", state.sessionCode), { 
                    questions: questions,
                    [`usedQuestions.${topicKey}`]: updatedUsedQuestions,
                    status: 'round1'
                });
            } catch (err) {
                console.error("Fallo al generar preguntas:", err);
                await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'generation_error' });
            }
        }
    }

    // Error en generación de la IA
    if (sessionData.status === 'generation_error' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        showView(views.generation_error);
        if (state.role === 'host') {
            document.getElementById('btn-retry-generation').classList.remove('hidden');
            document.getElementById('guest-waiting-retry').classList.add('hidden');
        } else {
            document.getElementById('btn-retry-generation').classList.add('hidden');
            document.getElementById('guest-waiting-retry').classList.remove('hidden');
        }
    }

    // Inicio de Ronda 1
    if (sessionData.status === 'round1' && isNewStatus) {
        lastProcessedStatus = sessionData.status;

        // Si el jugador ya terminó la ronda (e.g. recargó la página después de responder)
        // enviarlo a esperar en lugar de mostrarle el quiz desde cero
        if (sessionData.round1Finished?.[state.role] === true) {
            showView(views.waitingPartner);
        } else {
            // Intentar recuperar preguntas de caché si Firebase falla
            if (!sessionData.questions && localStorage.getItem(`fac_questions_${state.sessionCode}`)) {
                sessionData.questions = JSON.parse(localStorage.getItem(`fac_questions_${state.sessionCode}`));
            }
            showView(views.quiz);
            startQuiz(1);
        }
    }

    // Guardar respuestas de Ronda 1 en caché local
    if (sessionData.status === 'round1' && sessionData.round1?.[state.role]) {
        localStorage.setItem(`fac_r1_${state.sessionCode}_${state.uid}`, JSON.stringify(sessionData.round1[state.role]));
    }

    // Syncing de Ronda 1: Comprobar si ambos terminaron → ir a pantalla intermedia o resultados
    if (sessionData.status === 'round1' && state.role === 'host') {
        const p1Finished = sessionData.round1Finished?.['host'] === true;
        const p2Finished = sessionData.round1Finished?.['guest'] === true;
        if (p1Finished && p2Finished) {
            const isPersonalCategory = ['Recuerdos y Conexión', 'Divertidos y Cotidianos', 'Para Soñar Juntos', 'Picantes y Atrevidos', 'Millonarios por un Día', 'Viajeros en el Tiempo'].includes(sessionData.category);
            if (isPersonalCategory) {
                await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'round2_intro' });
            } else {
                await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'results' });
            }
        }
    }

    // Pantalla intermedia antes de Ronda 2
    // IMPORTANTE: usar isNewStatus aquí para que no sobreescriba la vista del quiz
    // cuando Firestore dispara snapshots intermedios.
    if (sessionData.status === 'round2_intro' && isNewStatus) {
        lastProcessedStatus = sessionData.status;
        showRound2Intro();
    }

    // Inicio de Ronda 2
    if (sessionData.status === 'round2' && isNewStatus) {
        lastProcessedStatus = sessionData.status;

        // Si el jugador ya terminó la ronda 2, enviarlo a espera en lugar de inyectarlo en el quiz
        if (sessionData.round2Finished?.[state.role] === true) {
            const waitingView = views.waitingPartner;
            waitingView.querySelector('h2').innerText = '¡Ronda 2 completada!';
            waitingView.querySelector('p').innerText = 'Calculando compatibilidad...';
            const spinnerCard = waitingView.querySelector('.glass-card');
            if (spinnerCard) spinnerCard.classList.add('hidden');
            showView(waitingView);
        } else {
            showView(views.quiz);
            try {
                startQuiz(2);
            } catch (error) {
                console.error("Error in startQuiz(2):", error);
                alert("Ocurrió un error al cargar la Ronda 2. Por favor, recarga la página.");
            }
        }
    }

    // Guardar respuestas de Ronda 2 en caché local
    if (sessionData.status === 'round2' && sessionData.round2?.[state.role]) {
        localStorage.setItem(`fac_r2_${state.sessionCode}_${state.uid}`, JSON.stringify(sessionData.round2[state.role]));
    }

    // Syncing de Ronda 2: Comprobar si ambos terminaron
    if (sessionData.status === 'round2' && state.role === 'host') {
        const p1Finished = sessionData.round2Finished?.['host'] === true;
        const p2Finished = sessionData.round2Finished?.['guest'] === true;
        if (p1Finished && p2Finished) {
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

document.getElementById('btn-retry-generation')?.addEventListener('click', async () => {
    document.getElementById('btn-retry-generation').innerText = "Reintentando... 🔄";
    document.getElementById('btn-retry-generation').disabled = true;
    await updateDoc(doc(db, "sessions", state.sessionCode), { status: 'loading' });
    
    // Restaurar texto para cuando reaparezca el error
    setTimeout(() => {
        document.getElementById('btn-retry-generation').innerText = "Reintentar Generación 🔄";
        document.getElementById('btn-retry-generation').disabled = false;
    }, 2000);
});

document.addEventListener('DOMContentLoaded', init);

// ── Selector de Intensidad (Spicy Level) ───────────────────────────────────

/**
 * Aplica el estilo visual activo al botón del nivel seleccionado.
 * Nivel 1 = 💧 Normal, 2 = 🌶️ Picante, 3 = 🔥 Muy Atrevido
 */
function setSpicyUI(level) {
    const STYLES = {
        1: { active: '#4CC9F0', bg: 'rgba(76,201,240,0.15)' },
        2: { active: '#FF6B9D', bg: 'rgba(255,107,157,0.15)' },
        3: { active: '#FF4500', bg: 'rgba(255,69,0,0.18)' }
    };
    document.querySelectorAll('.spicy-btn').forEach(btn => {
        const lvl = parseInt(btn.dataset.level);
        if (lvl === level) {
            btn.style.color = STYLES[level].active;
            btn.style.background = STYLES[level].bg;
            btn.style.borderRadius = '0';
        } else {
            btn.style.color = '#94a3b8';
            btn.style.background = 'transparent';
        }
    });
}

/**
 * Inicializa el selector: aplica UI inicial y configura interactividad según rol.
 */
function initSpicySelector(currentLevel) {
    setSpicyUI(currentLevel);

    const buttons = document.querySelectorAll('.spicy-btn');
    const guestNote = document.getElementById('spicy-guest-note');

    if (state.role === 'host') {
        // El host puede cambiar el nivel
        if (guestNote) guestNote.classList.add('hidden');
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.style.cursor = 'pointer';
            btn.onclick = async () => {
                const newLevel = parseInt(btn.dataset.level);
                setSpicyUI(newLevel);
                // Guardar en Firebase para sincronizar con el guest
                try {
                    await updateDoc(doc(db, 'sessions', state.sessionCode), { spicyLevel: newLevel });
                } catch(e) {
                    console.error('Error guardando spicyLevel:', e);
                }
            };
        });
    } else {
        // El guest solo ve, no puede cambiar
        if (guestNote) guestNote.classList.remove('hidden');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.cursor = 'default';
            btn.onclick = null;
        });
    }
}

