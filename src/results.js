import { state } from './state.js';
import { updateDoc, doc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';
import { openDebate, closeDebate, getDebatesRemaining, DEBATE_PHRASES } from './debate.js';

export async function renderResults() {
    const data = state.sessionData;
    const hostId = data.hostId;
    const guestId = data.guestId;

    // Ronda 1: Cada quien respondió sobre sí mismo
    const hostTruth  = data.round1[hostId]  || [];
    const guestTruth = data.round1[guestId] || [];

    // Ronda 2: Cada quien intentó adivinar al otro
    const hostGuesses  = data.round2[hostId]  || [];  // Host adivinó al Guest
    const guestGuesses = data.round2[guestId] || [];  // Guest adivinó al Host

    // Calcular aciertos
    let hostScore = 0;  // Cuánto acertó el Host sobre el Guest
    let guestScore = 0; // Cuánto acertó el Guest sobre el Host

    for (let i = 0; i < 10; i++) {
        if (guestTruth[i] !== undefined && hostGuesses[i] === guestTruth[i])  hostScore++;
        if (hostTruth[i]  !== undefined && guestGuesses[i] === hostTruth[i])  guestScore++;
    }

    const totalScore = hostScore + guestScore;
    const matchPercent = Math.round((totalScore / 20) * 100);

    // --- Actualizar UI ---
    document.getElementById('results-topic').innerText = `${data.category}: ${data.topic}`;
    document.getElementById('results-match-percent').innerText = `${matchPercent}%`;

    let verdict = "";
    if (matchPercent >= 80) verdict = "¡Almas Gemelas! 🔥";
    else if (matchPercent >= 60) verdict = "Se conocen muy bien 💖";
    else if (matchPercent >= 40) verdict = "Van por muy buen camino 😊";
    else verdict = "¡Hay que hablar más! 😅";
    document.getElementById('results-verdict').innerText = verdict;

    document.getElementById('results-p1-name').innerText = data.playerNames.host;
    document.getElementById('results-p1-score').innerText = `${hostScore}/10`;

    document.getElementById('results-p2-name').innerText = data.playerNames.guest;
    document.getElementById('results-p2-score').innerText = `${guestScore}/10`;

    const winnerText = document.getElementById('results-winner-text');
    if (hostScore > guestScore) {
        winnerText.innerText = `🏆 ¡${data.playerNames.host} conoce mejor a su pareja!`;
    } else if (guestScore > hostScore) {
        winnerText.innerText = `🏆 ¡${data.playerNames.guest} conoce mejor a su pareja!`;
    } else {
        winnerText.innerText = "🤝 ¡Empate perfecto!";
    }

    // Botón play again: visible solo para el Host
    const btnPlayAgain = document.getElementById('btn-play-again');
    const guestMsg = document.getElementById('results-guest-msg');
    if (state.role === 'host') {
        btnPlayAgain.classList.remove('hidden');
        guestMsg.classList.add('hidden');
        btnPlayAgain.onclick = resetGame;
    } else {
        btnPlayAgain.classList.add('hidden');
        guestMsg.classList.remove('hidden');
    }

    // Renderizar desglose detallado
    renderBreakdown(data, hostTruth, guestTruth, hostGuesses, guestGuesses);

    // Toggle desglose
    const btnToggle = document.getElementById('btn-toggle-breakdown');
    const breakdown = document.getElementById('results-breakdown');
    btnToggle.onclick = () => {
        const isHidden = breakdown.classList.contains('hidden');
        breakdown.classList.toggle('hidden', !isHidden);
        breakdown.classList.toggle('flex', isHidden);
        btnToggle.innerText = isHidden ? '🔼 Ocultar desglose' : '🔍 Ver desglose completo';
    };

    // Persistir resultado solo si es el Host y no se ha guardado
    if (state.role === 'host' && !state.matchSaved) {
        state.matchSaved = true;
        try {
            await addDoc(collection(db, "history"), {
                sessionCode: state.sessionCode,
                date: new Date(),
                category: data.category,
                topic: data.topic,
                hostName: data.playerNames.host,
                guestName: data.playerNames.guest,
                hostScore,
                guestScore,
                matchPercent
            });
        } catch (e) {
            console.error("Error guardando historial:", e);
        }
    }
}

function renderBreakdown(data, hostTruth, guestTruth, hostGuesses, guestGuesses) {
    const container = document.getElementById('results-breakdown');
    container.innerHTML = '';

    const questions = data.questions || [];
    const hostName  = data.playerNames.host;
    const guestName = data.playerNames.guest;

    // Conectar el botón de cerrar debate (una sola vez)
    const btnClose = document.getElementById('btn-debate-close');
    if (btnClose) {
        btnClose.onclick = async () => {
            const debate = state.sessionData?.activeDebate;
            if (debate && debate.initiatorId !== state.uid) {
                return; // Solo el iniciador puede cerrar el debate
            }
            try {
                await updateDoc(doc(db, "sessions", state.sessionCode), { activeDebate: null });
            } catch (e) {
                console.error("Error cerrando debate:", e);
            }
        };
    }

    questions.forEach((q, i) => {
        const opts = q.options;

        // Host adivinó al Guest
        const guestAnswer     = guestTruth[i];
        const hostGuess       = hostGuesses[i];
        const hostHit         = hostGuess === guestAnswer;

        // Guest adivinó al Host
        const hostAnswer      = hostTruth[i];
        const guestGuess      = guestGuesses[i];
        const guestHit        = guestGuess === hostAnswer;

        // Hay desacuerdo si alguno falló
        const hasDisagreement = !hostHit || !guestHit;

        const card = document.createElement('div');
        card.className = "bg-surface border border-gray-700 rounded-xl p-4";

        card.innerHTML = `
            <p class="text-xs text-gray-500 mb-1">Pregunta ${i + 1}</p>
            <p class="text-white font-bold mb-4 text-sm leading-snug">${q.question}</p>

            <!-- Host sobre Guest -->
            <div class="mb-3">
                <p class="text-xs text-gray-500 uppercase tracking-widest mb-1">¿Qué dijo ${guestName} de sí mismo?</p>
                <p class="text-sm text-secondary font-medium">${opts[guestAnswer] ?? '—'}</p>
                <p class="text-xs text-gray-500 mt-1">Y ${hostName} creyó que era: 
                    <span class="${hostHit ? 'text-green-400' : 'text-red-400'} font-bold">
                        ${opts[hostGuess] ?? '—'} ${hostHit ? '✅' : '❌'}
                    </span>
                </p>
            </div>
            <div class="border-t border-gray-700 pt-3">
                <p class="text-xs text-gray-500 uppercase tracking-widest mb-1">¿Qué dijo ${hostName} de sí mismo?</p>
                <p class="text-sm text-primary font-medium">${opts[hostAnswer] ?? '—'}</p>
                <p class="text-xs text-gray-500 mt-1">Y ${guestName} creyó que era:
                    <span class="${guestHit ? 'text-green-400' : 'text-red-400'} font-bold">
                        ${opts[guestGuess] ?? '—'} ${guestHit ? '✅' : '❌'}
                    </span>
                </p>
            </div>
            ${hasDisagreement ? `
            <div class="mt-3 pt-3 border-t border-gray-700">
                <button class="btn-debate-trigger w-full py-2.5 px-4 rounded-xl font-bold text-sm transition active:scale-95 flex items-center justify-center gap-2"
                        data-q-idx="${i}"
                        style="background: linear-gradient(135deg, rgba(255,107,157,0.2), rgba(199,125,255,0.2)); border: 1px solid rgba(255,107,157,0.5); color: #FF6B9D;">
                    🔥 ¡Botón del Desacuerdo! <span class="debate-remaining-badge text-xs opacity-70"></span>
                </button>
            </div>` : ''}
        `;
        container.appendChild(card);
    });

    // Asignar handlers a todos los botones de debate
    container.querySelectorAll('.btn-debate-trigger').forEach(btn => {
        const qIdx = parseInt(btn.dataset.qIdx);
        const q = questions[qIdx];
        const opts = q.options;

        updateDebateBadges();

        btn.addEventListener('click', async () => {
            if (getDebatesRemaining() <= 0) return;

            // Determinar quién "perdió" en esta pregunta (quién falló)
            const hostHitLocal  = hostGuesses[qIdx] === guestTruth[qIdx];
            const guestHitLocal = guestGuesses[qIdx] === hostTruth[qIdx];

            // playerA = quien tuvo respuesta diferente (el primero que falló)
            let playerA, answerA, playerB, answerB;
            if (!hostHitLocal) {
                playerA = hostName;
                answerA = opts[hostGuesses[qIdx]] ?? '—';
                playerB = guestName;
                answerB = opts[guestTruth[qIdx]] ?? '—';
            } else {
                playerA = guestName;
                answerA = opts[guestGuesses[qIdx]] ?? '—';
                playerB = hostName;
                answerB = opts[hostTruth[qIdx]] ?? '—';
            }

            const phraseData = DEBATE_PHRASES[Math.floor(Math.random() * DEBATE_PHRASES.length)];
            const endTime = Date.now() + 60000;
            const newUsedCount = (state.sessionData.debatesUsed || 0) + 1;
            const initiatorName = state.role === 'host' ? state.sessionData.playerNames.host : state.sessionData.playerNames.guest;

            try {
                await updateDoc(doc(db, "sessions", state.sessionCode), {
                    activeDebate: {
                        question: q.question,
                        playerA, answerA,
                        playerB, answerB,
                        phraseData,
                        endTime,
                        initiatorId: state.uid,
                        initiatorName
                    },
                    debatesUsed: newUsedCount
                });
            } catch (e) {
                console.error("Error iniciando debate:", e);
            }
        });
    });
}

export function updateDebateBadges() {
    const remaining = getDebatesRemaining();
    document.querySelectorAll('.btn-debate-trigger').forEach(btn => {
        const badge = btn.querySelector('.debate-remaining-badge');
        if (badge) badge.textContent = `(${remaining} restante${remaining !== 1 ? 's' : ''})`;
        if (remaining <= 0) {
            btn.disabled = true;
            btn.style.opacity = '0.4';
            btn.title = 'Límite de debates alcanzado (máx. 3)';
        }
    });
}

async function resetGame() {
    state.matchSaved = false;
    const sessionRef = doc(db, "sessions", state.sessionCode);
    const nextTurn = state.sessionData.spinnerTurn === 'host' ? 'guest' : 'host';
    await updateDoc(sessionRef, {
        status: 'roulette_waiting',
        spinnerTurn: nextTurn,
        round1: {},
        round2: {},
        questions: []
    });
}
