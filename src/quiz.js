import { state } from './state.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';

let currentQuestionIndex = 0;
let currentRound = 1;

export function startQuiz(round) {
    currentRound = round;
    currentQuestionIndex = 0;
    
    // Configurar textos de la UI según la ronda
    document.getElementById('quiz-round-title').innerText = `Ronda ${round}`;
    if (round === 1) {
        document.getElementById('quiz-instruction').innerText = "Responde sobre ti mismo 🤫";
    } else {
        const partnerName = state.role === 'host' ? state.sessionData.playerNames.guest : state.sessionData.playerNames.host;
        document.getElementById('quiz-instruction').innerText = `¿Qué crees que respondió ${partnerName}? 💭`;
    }

    renderQuestion();
}

function renderQuestion() {
    const questions = state.sessionData.questions;
    if (!questions || currentQuestionIndex >= questions.length) {
        finishQuizRound();
        return;
    }

    const q = questions[currentQuestionIndex];
    
    // UI Updates
    document.getElementById('quiz-counter').innerText = `Pregunta ${currentQuestionIndex + 1} de 10`;
    document.getElementById('quiz-progress').style.width = `${((currentQuestionIndex) / 10) * 100}%`;
    document.getElementById('quiz-question').innerText = q.question;

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = "w-full text-left bg-surface border border-gray-700 hover:border-primary hover:bg-gray-800 text-white py-4 px-6 rounded-xl transition active:scale-95";
        btn.innerText = opt;
        btn.onclick = () => handleAnswerOptionClick(index, btn);
        optionsContainer.appendChild(btn);
    });
}

async function handleAnswerOptionClick(optionIndex, btnElement) {
    // Feedback visual
    const allBtns = document.getElementById('quiz-options').querySelectorAll('button');
    allBtns.forEach(b => b.disabled = true);
    btnElement.classList.replace('border-gray-700', 'border-primary');
    btnElement.classList.add('bg-primary', 'bg-opacity-20');

    // Guardar respuesta en Firebase
    const roundKey = currentRound === 1 ? 'round1' : 'round2';
    const fieldPath = `${roundKey}.${state.uid}`;
    
    // Recuperar el array actual o crearlo
    const currentAnswers = state.sessionData[roundKey]?.[state.uid] || [];
    currentAnswers[currentQuestionIndex] = optionIndex;

    const sessionRef = doc(db, "sessions", state.sessionCode);
    await updateDoc(sessionRef, {
        [fieldPath]: currentAnswers
    });

    // Avanzar a la siguiente
    setTimeout(() => {
        currentQuestionIndex++;
        renderQuestion();
    }, 500); // Medio segundo para que vea qué seleccionó
}

function finishQuizRound() {
    // Al terminar las 10 preguntas, el UI se actualiza en main.js via onSessionUpdate
    // porque el array tendrá length 10. Pero mientras tanto, mostramos la pantalla de espera local.
    document.getElementById('quiz-progress').style.width = `100%`;
    // Disparamos un evento o llamamos a una función global para mostrar la pantalla de espera.
    window.dispatchEvent(new Event('quizRoundFinished'));
}
