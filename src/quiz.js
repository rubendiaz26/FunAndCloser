import { state } from './state.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';

/**
 * Reemplaza el placeholder {pareja} con el nombre correcto según la ronda:
 * - Ronda 1: se reemplaza con el nombre de la PAREJA (respondemos sobre ella).
 * - Ronda 2: se reemplaza con el nombre PROPIO (la pareja respondio sobre nosotros, ahora adivinamos).
 */
function insertarNombrePareja(text, round) {
    const myName = state.role === 'host'
        ? state.sessionData?.playerNames?.host
        : state.sessionData?.playerNames?.guest;
    const partnerName = state.role === 'host'
        ? state.sessionData?.playerNames?.guest
        : state.sessionData?.playerNames?.host;
    // Ronda 1: respondemos sobre nuestra pareja → mostramos nombre de la pareja
    // Ronda 2: adivinamos lo que nuestra pareja dijo de nosotros → mostramos nuestro propio nombre
    const nameToUse = (round === 2) ? myName : partnerName;
    if (!nameToUse) return text;
    return text.replace(/\{pareja\}/gi, nameToUse);
}

let currentQuestionIndex = 0;
let currentRound = 1;
let selectedOptions = new Set();
let localAnswers = [];
const TOTAL_QUESTIONS = 10;

export function startQuiz(round) {
    currentRound = round;
    selectedOptions.clear();

    const roundKey = currentRound === 1 ? 'round1' : 'round2';
    
    // Recuperar caché local por si hubo una recarga a mitad de la ronda
    const cacheKey = `fac_temp_ans_${state.sessionCode}_${state.uid}_${roundKey}`;
    let cachedAnswers = null;
    try {
        const rawCache = localStorage.getItem(cacheKey);
        if (rawCache) cachedAnswers = JSON.parse(rawCache);
    } catch(e) {}

    // Recuperar respuestas anteriores si existen (caché local tiene prioridad, sino Firebase)
    const existingAnswers = cachedAnswers || state.sessionData?.[roundKey]?.[state.role];
    if (Array.isArray(existingAnswers)) {
        localAnswers = [...existingAnswers];
        while (localAnswers.length < 10) localAnswers.push(null);
        const firstUnanswered = localAnswers.findIndex(ans => ans === null || ans === undefined);
        currentQuestionIndex = firstUnanswered !== -1 ? firstUnanswered : 0;
    } else if (existingAnswers && typeof existingAnswers === 'object') {
        localAnswers = Array(10).fill(null);
        for (let i = 0; i < 10; i++) {
            if (existingAnswers[i] !== undefined) {
                localAnswers[i] = existingAnswers[i];
            }
        }
        const firstUnanswered = localAnswers.findIndex(ans => ans === null || ans === undefined);
        currentQuestionIndex = firstUnanswered !== -1 ? firstUnanswered : 0;
    } else {
        localAnswers = Array(10).fill(null);
        currentQuestionIndex = 0;
    }

    // Update round label and icon
    const roundTitle = document.getElementById('quiz-round-title');
    const roundIcon  = document.getElementById('quiz-round-icon');

    if (round === 1) {
        const partnerName = state.role === 'host'
            ? state.sessionData?.playerNames?.guest
            : state.sessionData?.playerNames?.host;
        roundTitle.innerText = partnerName ? `Ronda 1 · Sobre ${partnerName}` : 'Ronda 1 · Sobre tu pareja';
        if (roundIcon) roundIcon.innerText = '💬';
    } else {
        const partnerName = state.role === 'host'
            ? state.sessionData.playerNames.guest
            : state.sessionData.playerNames.host;
        roundTitle.innerText = `Ronda 2 · ¿Qué respondió ${partnerName}?`;
        if (roundIcon) roundIcon.innerText = '🕵️';
    }

    // Show current user name in header
    const myName = state.role === 'host'
        ? state.sessionData?.playerNames?.host
        : state.sessionData?.playerNames?.guest;
    const usernameEl = document.getElementById('quiz-username-display');
    if (usernameEl && myName) usernameEl.innerText = myName;

    // Show category and topic
    const categoryEl = document.getElementById('quiz-category-display');
    if (categoryEl && state.sessionData?.category) {
        categoryEl.innerText = `${state.sessionData.category}: ${state.sessionData.topic}`;
    }

    renderQuestion();
}

function renderHearts(current, total) {
    const container = document.getElementById('quiz-hearts');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < total; i++) {
        const heart = document.createElement('span');
        heart.style.fontSize = '14px';
        heart.style.transition = 'transform 0.2s';
        if (i < current) {
            heart.innerText = '❤️';
        } else {
            heart.style.opacity = '0.25';
            heart.innerText = '🤍';
        }
        container.appendChild(heart);
    }
}

function renderQuestion() {
    const questions = state.sessionData.questions;
    if (!questions || currentQuestionIndex >= questions.length) {
        finishQuizRound();
        return;
    }

    selectedOptions.clear();
    const q = questions[currentQuestionIndex];

    // Counter & hearts
    document.getElementById('quiz-counter').innerText = `Pregunta ${currentQuestionIndex + 1} de ${TOTAL_QUESTIONS}`;
    renderHearts(currentQuestionIndex + 1, TOTAL_QUESTIONS);

    // Question text — replace {pareja} placeholder with correct name per round
    let qTextHtml = insertarNombrePareja(q.question, currentRound);
    if (q.multiSelect) {
        qTextHtml += '<br><span class="text-sm text-[#FF6B9D] font-normal opacity-90 block mt-2">(Puedes elegir hasta 3 opciones)</span>';
    }
    document.getElementById('quiz-question').innerHTML = qTextHtml;

    // Options
    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'w-full text-left text-white rounded-2xl transition active:scale-95 flex items-center justify-between gap-3';
        btn.style.cssText = `
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.10);
            padding: 14px 18px;
            font-size: 14px;
            line-height: 1.4;
        `;

        const textSpan = document.createElement('span');
        textSpan.innerText = insertarNombrePareja(opt, currentRound);
        textSpan.style.flex = '1';

        const checkCircle = document.createElement('div');
        checkCircle.style.cssText = `
            width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
            border: 2px solid rgba(255,255,255,0.2);
            display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
        `;

        btn.appendChild(textSpan);
        btn.appendChild(checkCircle);

        if (q.multiSelect) {
            checkCircle.style.borderRadius = '6px';
        }

        btn.addEventListener('mouseenter', () => {
            if (!selectedOptions.has(index)) {
                btn.style.borderColor = 'rgba(255,107,157,0.5)';
                btn.style.background = 'rgba(255,107,157,0.07)';
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (!selectedOptions.has(index)) {
                btn.style.borderColor = 'rgba(255,255,255,0.10)';
                btn.style.background = 'rgba(255,255,255,0.04)';
            }
        });

        btn.onclick = () => handleAnswerOptionClick(index, btn, checkCircle, q.multiSelect);
        optionsContainer.appendChild(btn);
    });

    // Next button — locked until selection
    const btnNext = document.getElementById('btn-next-question');
    if (btnNext) {
        btnNext.disabled = true;
        btnNext.style.opacity = '0.4';
        btnNext.style.cursor = 'not-allowed';
        btnNext.onclick = null;
        if (currentQuestionIndex === TOTAL_QUESTIONS - 1) {
            btnNext.innerHTML = `Terminar la ronda <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        } else {
            btnNext.innerHTML = `Siguiente pregunta <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
        }
    }
}

async function handleAnswerOptionClick(optionIndex, btnElement, checkCircle, isMultiSelect) {
    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');

    if (isMultiSelect) {
        if (selectedOptions.has(optionIndex)) {
            selectedOptions.delete(optionIndex);
            btnElement.style.borderColor = 'rgba(255,255,255,0.10)';
            btnElement.style.background  = 'rgba(255,255,255,0.04)';
            checkCircle.style.background = 'transparent';
            checkCircle.style.borderColor = 'rgba(255,255,255,0.2)';
            checkCircle.innerHTML = '';
        } else {
            if (selectedOptions.size >= 3) return; // limit reached
            selectedOptions.add(optionIndex);
            btnElement.style.borderColor = '#FF6B9D';
            btnElement.style.background  = 'rgba(255,107,157,0.12)';
            checkCircle.style.background = '#FF6B9D';
            checkCircle.style.borderColor = '#FF6B9D';
            checkCircle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        }
    } else {
        selectedOptions.clear();
        selectedOptions.add(optionIndex);

        // Reset all
        allBtns.forEach(b => {
            b.style.borderColor = 'rgba(255,255,255,0.10)';
            b.style.background  = 'rgba(255,255,255,0.04)';
            const circle = b.querySelector('div');
            if (circle) {
                circle.style.background = 'transparent';
                circle.style.borderColor = 'rgba(255,255,255,0.2)';
                circle.innerHTML = '';
            }
        });

        // Highlight selected
        btnElement.style.borderColor = '#FF6B9D';
        btnElement.style.background  = 'rgba(255,107,157,0.12)';
        checkCircle.style.background = '#FF6B9D';
        checkCircle.style.borderColor = '#FF6B9D';
        checkCircle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    }

    // Guardar respuesta localmente (NO subir a Firebase en cada clic para evitar
    // que Firestore reciba arrays con null que corrompen la estructura de datos)
    localAnswers[currentQuestionIndex] = isMultiSelect ? Array.from(selectedOptions) : optionIndex;

    // Auto-guardado temporal en localStorage
    const roundKey = currentRound === 1 ? 'round1' : 'round2';
    const cacheKey = `fac_temp_ans_${state.sessionCode}_${state.uid}_${roundKey}`;
    localStorage.setItem(cacheKey, JSON.stringify(localAnswers));

    // Unlock "Siguiente pregunta" button inmediatamente
    const btnNext = document.getElementById('btn-next-question');
    if (btnNext) {
        if (selectedOptions.size > 0) {
            btnNext.disabled = false;
            btnNext.style.opacity = '1';
            btnNext.style.cursor = 'pointer';
            btnNext.onclick = () => {
                currentQuestionIndex++;
                renderQuestion();
            };
        } else {
            btnNext.disabled = true;
            btnNext.style.opacity = '0.4';
            btnNext.style.cursor = 'not-allowed';
            btnNext.onclick = null;
        }
    }
}

async function finishQuizRound() {
    document.getElementById('quiz-progress') && (document.getElementById('quiz-progress').style.width = '100%');
    renderHearts(TOTAL_QUESTIONS, TOTAL_QUESTIONS);
    
    const roundKey = currentRound === 1 ? 'round1' : 'round2';
    const cacheKey = `fac_temp_ans_${state.sessionCode}_${state.uid}_${roundKey}`;
    localStorage.removeItem(cacheKey); // Limpiar caché temporal
    
    const sessionRef = doc(db, "sessions", state.sessionCode);

    // Limpiar nulls antes de subir: reemplazar con -1 como sentinela
    // para evitar que Firestore convierta el array en un mapa de objetos.
    // Solo subimos respuestas que realmente se respondieron.
    const cleanAnswers = localAnswers.map(a => {
        if (a === null || a === undefined) return -1; // no debería ocurrir al terminar, pero por seguridad
        return a;
    });

    try {
        await updateDoc(sessionRef, {
            [`${roundKey}.${state.role}`]: Object.assign({}, cleanAnswers),
            [`${roundKey}Finished.${state.role}`]: true
        });
    } catch (e) {
        console.error("Error guardando respuestas finales:", e);
    }

    window.dispatchEvent(new Event('quizRoundFinished'));
}
