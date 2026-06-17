import { state } from './state.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';

let currentQuestionIndex = 0;
let currentRound = 1;
let selectedOptionIndex = null;
const TOTAL_QUESTIONS = 10;

export function startQuiz(round) {
    currentRound = round;
    currentQuestionIndex = 0;
    selectedOptionIndex = null;

    // Update round label and icon
    const roundTitle = document.getElementById('quiz-round-title');
    const roundIcon  = document.getElementById('quiz-round-icon');

    if (round === 1) {
        roundTitle.innerText = 'Ronda 1 · Sobre ti';
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

    selectedOptionIndex = null;
    const q = questions[currentQuestionIndex];

    // Counter & hearts
    document.getElementById('quiz-counter').innerText = `Pregunta ${currentQuestionIndex + 1} de ${TOTAL_QUESTIONS}`;
    renderHearts(currentQuestionIndex + 1, TOTAL_QUESTIONS);

    // Question text
    document.getElementById('quiz-question').innerText = q.question;

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
        textSpan.innerText = opt;
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

        btn.addEventListener('mouseenter', () => {
            if (selectedOptionIndex !== index) {
                btn.style.borderColor = 'rgba(255,107,157,0.5)';
                btn.style.background = 'rgba(255,107,157,0.07)';
            }
        });
        btn.addEventListener('mouseleave', () => {
            if (selectedOptionIndex !== index) {
                btn.style.borderColor = 'rgba(255,255,255,0.10)';
                btn.style.background = 'rgba(255,255,255,0.04)';
            }
        });

        btn.onclick = () => handleAnswerOptionClick(index, btn, checkCircle);
        optionsContainer.appendChild(btn);
    });

    // Next button — locked until selection
    const btnNext = document.getElementById('btn-next-question');
    if (btnNext) {
        btnNext.disabled = true;
        btnNext.style.opacity = '0.4';
        btnNext.style.cursor = 'not-allowed';
        btnNext.onclick = null;
    }
}

async function handleAnswerOptionClick(optionIndex, btnElement, checkCircle) {
    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');

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
    selectedOptionIndex = optionIndex;
    btnElement.style.borderColor = '#FF6B9D';
    btnElement.style.background  = 'rgba(255,107,157,0.12)';
    checkCircle.style.background = '#FF6B9D';
    checkCircle.style.borderColor = '#FF6B9D';
    checkCircle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    // Save to Firebase
    const roundKey = currentRound === 1 ? 'round1' : 'round2';
    const fieldPath = `${roundKey}.${state.uid}`;
    const currentAnswers = state.sessionData[roundKey]?.[state.uid] || [];
    currentAnswers[currentQuestionIndex] = optionIndex;

    const sessionRef = doc(db, "sessions", state.sessionCode);
    await updateDoc(sessionRef, { [fieldPath]: currentAnswers });

    // Unlock "Siguiente pregunta" button
    const btnNext = document.getElementById('btn-next-question');
    if (btnNext) {
        btnNext.disabled = false;
        btnNext.style.opacity = '1';
        btnNext.style.cursor = 'pointer';
        btnNext.onclick = () => {
            currentQuestionIndex++;
            renderQuestion();
        };
    }
}

function finishQuizRound() {
    document.getElementById('quiz-progress') && (document.getElementById('quiz-progress').style.width = '100%');
    renderHearts(TOTAL_QUESTIONS, TOTAL_QUESTIONS);
    window.dispatchEvent(new Event('quizRoundFinished'));
}
