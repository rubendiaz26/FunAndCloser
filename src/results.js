import { state } from './state.js';
import { updateDoc, doc, addDoc, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';
import { openDebate, closeDebate, getDebatesRemaining, DEBATE_PHRASES } from './debate.js';

export async function renderResults() {
    const data = state.sessionData;
    const hostId = data.hostId;
    const guestId = data.guestId;

    // Ronda 1: Cada quien respondió sobre sí mismo
    const hostTruth  = data.round1['host'] || data.round1[hostId] || [];
    const guestTruth = data.round1['guest'] || data.round1[guestId] || [];

    // Ronda 2: Cada quien intentó adivinar al otro
    const hostGuesses  = data.round2['host'] || data.round2[hostId] || [];  // Host adivinó al Guest
    const guestGuesses = data.round2['guest'] || data.round2[guestId] || [];  // Guest adivinó al Host

    // Calcular aciertos
    let hostScore = 0;  // Cuánto acertó el Host sobre el Guest
    let guestScore = 0; // Cuánto acertó el Guest sobre el Host

    // Helper para comparar respuestas con flexibilidad si son multi-select
    // -1 es el valor sentinela para "sin respuesta" (antes era null, pero Firestore no acepta null en arrays)
    function checkHit(guess, truth) {
        if (truth === undefined || truth === null || truth === -1) return false;
        if (guess === undefined || guess === null || guess === -1) return false;
        
        const isTruthArray = Array.isArray(truth);
        const isGuessArray = Array.isArray(guess);
        
        if (!isTruthArray && !isGuessArray) {
            return truth === guess;
        }
        
        const truthArr = isTruthArray ? truth : [truth];
        const guessArr = isGuessArray ? guess : [guess];
        
        // Si adivinas al menos 1 opción elegida por tu pareja (o respuesta correcta), es un acierto
        return guessArr.some(g => truthArr.includes(g));
    }

    const isPersonalCategory = ['Recuerdos y Conexión', 'Divertidos y Cotidianos', 'Para Soñar Juntos', 'Picantes y Atrevidos'].includes(data.category);

    for (let i = 0; i < 10; i++) {
        if (isPersonalCategory) {
            if (checkHit(hostGuesses[i], guestTruth[i])) hostScore++;
            if (checkHit(guestGuesses[i], hostTruth[i])) guestScore++;
        } else {
            const correctAnswer = data.questions[i]?.correctAnswerIndex;
            if (checkHit(hostTruth[i], correctAnswer)) hostScore++;
            if (checkHit(guestTruth[i], correctAnswer)) guestScore++;
        }
    }

    const totalScore = hostScore + guestScore;
    const matchPercent = Math.round((totalScore / 20) * 100);

    // --- Actualizar UI ---
    document.getElementById('results-topic').innerText = `${data.category}: ${data.topic}`;
    document.getElementById('results-match-percent').innerText = `${matchPercent}%`;

    let verdict = "";
    let advice = "";
    if (!isPersonalCategory) {
        if (matchPercent >= 80) verdict = "¡Mentes Brillantes! 🧠✨";
        else if (matchPercent >= 50) verdict = "Conocimiento Sólido 📚";
        else verdict = "¡A seguir aprendiendo! 🌍";
        advice = "Una competencia reñida probando sus conocimientos.";
    } else {
        if (matchPercent >= 80) {
            verdict = "¡Almas Gemelas! 🔥";
            advice = "¡Son increíbles juntos! Sigan cultivando esa conexión única. 💖";
        } else if (matchPercent >= 60) {
            verdict = "Se conocen muy bien 💖";
            advice = "Tienen una conexión sólida. ¡Sigan explorando juntos! ✨";
        } else if (matchPercent >= 40) {
            verdict = "Van por muy buen camino 😊";
            advice = "Cada conversación los acerca más. ¡Sigan hablando! 💬";
        } else {
            verdict = "¡Hay que hablar más! 😅";
            advice = "Conversaciones profundas crean conexiones más fuertes. ❤️";
        }
    }
    document.getElementById('results-verdict').innerText = verdict;
    const adviceEl = document.getElementById('results-advice');
    if (adviceEl) adviceEl.innerText = advice;

    // Animar barra de compatibilidad con pequeño delay
    const bar = document.getElementById('results-match-bar');
    if (bar) setTimeout(() => { bar.style.width = `${matchPercent}%`; }, 300);

    document.getElementById('results-p1-name').innerText = data.playerNames.host;
    document.getElementById('results-p1-score').innerText = `${hostScore}/10`;

    document.getElementById('results-p2-name').innerText = data.playerNames.guest;
    document.getElementById('results-p2-score').innerText = `${guestScore}/10`;

    const winnerText = document.getElementById('results-winner-text');
    if (hostScore > guestScore) {
        winnerText.innerHTML = isPersonalCategory 
            ? `¡<span style="color:#FF6B9D;">${data.playerNames.host}</span> conoce mejor a su pareja!`
            : `¡<span style="color:#FF6B9D;">${data.playerNames.host}</span> domina esta trivia!`;
    } else if (guestScore > hostScore) {
        winnerText.innerHTML = isPersonalCategory
            ? `¡<span style="color:#C77DFF;">${data.playerNames.guest}</span> conoce mejor a su pareja!`
            : `¡<span style="color:#C77DFF;">${data.playerNames.guest}</span> domina esta trivia!`;
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
        const label = btnToggle.querySelector('span.text-white');
        if (label) label.innerText = isHidden ? 'Ocultar desglose' : 'Ver desglose completo';
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

    const btnClose = document.getElementById('btn-debate-close');
    if (btnClose) {
        btnClose.onclick = async () => {
            const debate = state.sessionData?.activeDebate;
            if (debate && debate.initiatorId !== state.uid) {
                return;
            }
            try {
                await updateDoc(doc(db, "sessions", state.sessionCode), { activeDebate: null });
            } catch (e) {
                console.error("Error cerrando debate:", e);
            }
        };
    }

    const formatAnswerText = (ans, opts) => {
        // -1 es el sentinela de "sin respuesta" (reemplaza null en Firestore)
        if (ans === undefined || ans === null || ans === -1) return '\u2014';
        if (Array.isArray(ans)) {
            if (ans.length === 0) return '\u2014';
            // Filtrar sentinelas en arrays multi-select
            const filtered = ans.filter(a => a !== -1 && a !== null && a !== undefined);
            if (filtered.length === 0) return '\u2014';
            return filtered.map(a => opts[a] ?? '\u2014').join(' \u00b7 ');
        }
        return opts[ans] ?? '\u2014';
    };

    const formatAnswerLocal = (ans, opts) => {
        if (ans === undefined || ans === null || ans === -1 || (Array.isArray(ans) && ans.length === 0)) return '\u2014';
        if (Array.isArray(ans)) {
            const filtered = ans.filter(a => a !== -1 && a !== null && a !== undefined);
            if (filtered.length === 0) return '\u2014';
            return filtered.map(a => opts[a] ?? '\u2014').join(', ');
        }
        return opts[ans] ?? '\u2014';
    };

    const checkHitBreakdown = (guess, truth) => {
        // -1 es el sentinela de "sin respuesta"
        if (truth === undefined || truth === null || truth === -1) return null;
        if (guess === undefined || guess === null || guess === -1) return null;
        const isTruthArr = Array.isArray(truth);
        const isGuessArr = Array.isArray(guess);
        if (isTruthArr && truth.filter(a => a !== -1).length === 0) return null;
        if (isGuessArr && guess.filter(a => a !== -1).length === 0) return null;

        const truthArr = (isTruthArr ? truth : [truth]).filter(a => a !== -1);
        const guessArr = (isGuessArr ? guess : [guess]).filter(a => a !== -1);
        if (!isTruthArr && !isGuessArr) return truth === guess;
        return guessArr.some(g => truthArr.includes(g));
    };

    const guessBubble = (text, isHit) => {
        const isMissed = isHit === false;
        const isCorrect = isHit === true;
        const isEmpty = isHit === null;

        let bg = 'rgba(255,255,255,0.04)';
        let icon = '';
        if (isCorrect) {
            bg = 'linear-gradient(135deg, #05a87a, #06D6A0)';
            icon = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;margin-top:1px;"><polyline points="20 6 9 17 4 12"/></svg>`;
        } else if (isMissed) {
            bg = 'linear-gradient(135deg, #c0392b, #e74c3c)';
            icon = `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0;margin-top:1px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        } else {
            icon = `<span style="font-size:12px; opacity:0.3; font-weight:bold;">?</span>`;
        }

        const textColor = isEmpty ? 'rgba(255,255,255,0.3)' : 'white';
        const displayText = isEmpty || text === '—' ? 'Sin respuesta' : text;

        return `<div style="background:${bg}; border:1px solid rgba(255,255,255,0.05); border-radius:14px 14px 14px 4px; padding:10px 12px; flex:1; min-width:0; min-height:42px; display:flex; align-items:center;">
                    <div style="display:flex; align-items:flex-start; gap:7px; width:100%;">
                        <p style="font-size:12px; font-weight:600; color:${textColor}; line-height:1.4; flex-grow:1; margin:0; word-break:break-word;">${displayText}</p>
                        ${icon}
                    </div>
                </div>`;
    };

    const truthBubble = (text) => {
        const isEmpty = text === '—';
        const displayText = isEmpty ? 'Sin respuesta' : text;
        const textColor = isEmpty ? 'rgba(255,255,255,0.3)' : '#E4C7FF';

        return `<div style="background:rgba(199,125,255,0.12); border:1px solid rgba(199,125,255,0.25); border-radius:14px 14px 4px 14px; padding:12px 12px; flex:1; min-width:0; position:relative; min-height:42px; display:flex; align-items:center; margin-top:8px;">
                    <span style="position:absolute; top:-9px; right:8px; background:linear-gradient(90deg,#C77DFF,#9B5DE5); color:white; font-size:8px; font-weight:800; letter-spacing:0.08em; padding:2px 7px; border-radius:99px; box-shadow:0 2px 4px rgba(0,0,0,0.3);">VERDAD</span>
                    <p style="font-size:12px; font-weight:600; color:${textColor}; line-height:1.4; margin:0; word-break:break-word; width:100%;">${displayText}</p>
                </div>`;
    };

    const avatarEl = (name, isHost, label) => {
        const color = isHost ? '#FF6B9D' : '#C77DFF';
        const initial = name ? name[0].toUpperCase() : '?';
        return `<div style="display:flex; flex-direction:column; align-items:center; gap:2px; flex-shrink:0; width:46px;">
                    <div style="width:38px; height:38px; border-radius:12px; background:rgba(255,255,255,0.05); border:2px solid ${color}; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:800; color:${color}; margin-bottom:2px;">
                        ${initial}
                    </div>
                    <span style="font-size:8px; font-weight:800; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:0.05em; text-align:center; line-height:1.1; width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</span>
                    <span style="font-size:8px; color:rgba(255,255,255,0.3); text-align:center;">${label}</span>
                </div>`;
    };

    const isPersonalCategory = ['Recuerdos y Conexión', 'Divertidos y Cotidianos', 'Para Soñar Juntos', 'Picantes y Atrevidos'].includes(data.category);

    questions.forEach((q, i) => {
        const opts = q.options;
        const card = document.createElement('div');
        card.style.cssText = `background:rgba(20,20,38,0.97); border:1px solid rgba(255,255,255,0.08); border-radius:22px; padding:18px 16px; margin-bottom:14px;`;

        if (isPersonalCategory) {
            const guestAnswer = guestTruth[i];
            const hostGuess   = hostGuesses[i];
            const hostHit     = checkHitBreakdown(hostGuess, guestAnswer);

            const hostAnswer  = hostTruth[i];
            const guestGuess  = guestGuesses[i];
            const guestHit    = checkHitBreakdown(guestGuess, hostAnswer);

            const hasDisagreement = !hostHit || !guestHit;

            card.innerHTML = `
                <p style="font-size:10px; font-weight:800; letter-spacing:0.14em; color:rgba(255,255,255,0.38); text-transform:uppercase; margin:0 0 6px 0;">PREGUNTA ${i + 1}</p>
                <p style="font-size:15px; font-weight:700; color:white; line-height:1.45; margin:0 0 18px 0;">${q.question}</p>

                <!-- Host adivina a Guest -->
                <div style="margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                        <span style="font-size:9px; font-weight:800; letter-spacing:0.12em; color:rgba(255,255,255,0.35); white-space:nowrap; text-transform:uppercase;">Adivinando a ${guestName}</span>
                        <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${avatarEl(hostName, true, 'Adivinó:')}
                        ${guessBubble(formatAnswerText(hostGuess, opts), hostHit)}
                        ${avatarEl(guestName, false, 'Dijo:')}
                        ${truthBubble(formatAnswerText(guestAnswer, opts))}
                    </div>
                </div>

                <!-- Guest adivina a Host -->
                <div style="margin-bottom:${hasDisagreement ? '20px' : '0'};">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                        <span style="font-size:9px; font-weight:800; letter-spacing:0.12em; color:rgba(255,255,255,0.35); white-space:nowrap; text-transform:uppercase;">Adivinando a ${hostName}</span>
                        <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${avatarEl(guestName, false, 'Adivinó:')}
                        ${guessBubble(formatAnswerText(guestGuess, opts), guestHit)}
                        ${avatarEl(hostName, true, 'Dijo:')}
                        ${truthBubble(formatAnswerText(hostAnswer, opts))}
                    </div>
                </div>

                ${hasDisagreement ? `
                <button class="btn-debate-trigger" data-q-idx="${i}"
                    style="width:100%; padding:14px 20px; border-radius:16px; font-weight:800; font-size:14px;
                           background:linear-gradient(135deg, rgba(255,107,157,0.14), rgba(199,125,255,0.14));
                           border:1.5px solid rgba(255,107,157,0.4); color:#FF6B9D;
                           display:flex; align-items:center; justify-content:center; gap:8px;
                           cursor:pointer; letter-spacing:0.02em; box-sizing:border-box;">
                    🔥 ¡Botón del Desacuerdo! <span class="debate-remaining-badge" style="font-size:12px; opacity:0.6; font-weight:600;"></span>
                </button>` : ''}
            `;
        } else {
            // Modo Trivia
            const correctAnswer = q.correctAnswerIndex;
            const hostAnswer = hostTruth[i];
            const guestAnswer = guestTruth[i];
            
            const hostHit = checkHitBreakdown(hostAnswer, correctAnswer);
            const guestHit = checkHitBreakdown(guestAnswer, correctAnswer);
            
            card.innerHTML = `
                <p style="font-size:10px; font-weight:800; letter-spacing:0.14em; color:rgba(255,255,255,0.38); text-transform:uppercase; margin:0 0 6px 0;">PREGUNTA ${i + 1}</p>
                <p style="font-size:15px; font-weight:700; color:white; line-height:1.45; margin:0 0 18px 0;">${q.question}</p>

                <div style="margin-bottom:16px;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                        <span style="font-size:9px; font-weight:800; letter-spacing:0.12em; color:rgba(255,255,255,0.35); white-space:nowrap; text-transform:uppercase;">Respuesta de IA</span>
                        <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:center; margin-bottom:16px;">
                        ${truthBubble(formatAnswerText(correctAnswer, opts))}
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                    <span style="font-size:9px; font-weight:800; letter-spacing:0.12em; color:rgba(255,255,255,0.35); white-space:nowrap; text-transform:uppercase;">Sus Respuestas</span>
                    <div style="flex:1; height:1px; background:rgba(255,255,255,0.07);"></div>
                </div>
                
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${avatarEl(hostName, true, 'Jugó:')}
                        ${guessBubble(formatAnswerText(hostAnswer, opts), hostHit)}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${avatarEl(guestName, false, 'Jugó:')}
                        ${guessBubble(formatAnswerText(guestAnswer, opts), guestHit)}
                    </div>
                </div>
            `;
        }

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

            // Helper para debate
            const checkHitLocal = (guess, truth) => {
                if (truth === undefined || truth === null || truth === -1) return false;
                if (guess === undefined || guess === null || guess === -1) return false;
                const isTruthArr = Array.isArray(truth);
                const isGuessArr = Array.isArray(guess);
                if (!isTruthArr && !isGuessArr) return truth === guess;
                const truthArr = (isTruthArr ? truth : [truth]).filter(a => a !== -1);
                const guessArr = (isGuessArr ? guess : [guess]).filter(a => a !== -1);
                return guessArr.some(g => truthArr.includes(g));
            };

            const formatAnswerLocal = (ans) => {
                if (ans === undefined || ans === null || ans === -1 || (Array.isArray(ans) && ans.length === 0)) return '\u2014';
                if (Array.isArray(ans)) {
                    const filtered = ans.filter(a => a !== -1 && a !== null && a !== undefined);
                    if (filtered.length === 0) return '\u2014';
                    return filtered.map(a => opts[a] ?? '\u2014').join(', ');
                }
                return opts[ans] ?? '\u2014';
            };

            // Determinar quién "perdió" en esta pregunta (quién falló)
            const hostHitLocal  = checkHitLocal(hostGuesses[qIdx], guestTruth[qIdx]);
            const guestHitLocal = checkHitLocal(guestGuesses[qIdx], hostTruth[qIdx]);

            // playerA = quien tuvo respuesta diferente (el primero que falló)
            let playerA, answerA, playerB, answerB;
            if (!hostHitLocal) {
                playerA = hostName;
                answerA = formatAnswerLocal(hostGuesses[qIdx]);
                playerB = guestName;
                answerB = formatAnswerLocal(guestTruth[qIdx]);
            } else {
                playerA = guestName;
                answerA = formatAnswerLocal(guestGuesses[qIdx]);
                playerB = hostName;
                answerB = formatAnswerLocal(hostTruth[qIdx]);
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
        questions: [],
        round1Finished: {},
        round2Finished: {}
    });
}
