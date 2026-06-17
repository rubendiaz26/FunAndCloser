import { state } from './state.js';

export const MAX_DEBATES = 3;
let timerInterval = null;

export const DEBATE_PHRASES = [
    { emoji: "🌶️", phrase: "¡{loser}, demuestra que tienes razón o cede de una vez!", challenge: "Tienes 60 segundos para convencer a {winner} de que te equivocaste." },
    { emoji: "🔥", phrase: "¡Hora de la verdad, {loser}!", challenge: "¿Por qué respondiste eso? {winner} está esperando tu excusa... digo, explicación." },
    { emoji: "👀", phrase: "¡{winner} no lo puede creer!", challenge: "Defiéndete, {loser}. El cronómetro no tiene compasión." },
    { emoji: "💣", phrase: "¡Desacuerdo TOTAL detectado!", challenge: "{loser} dice una cosa, {winner} dice otra. ¡Debatan como adultos... o no!" },
    { emoji: "🎤", phrase: "¡Micrófono abierto, {loser}!", challenge: "{winner} ya levantó una ceja. Explícate antes de que el tiempo se acabe." },
    { emoji: "⚡", phrase: "¡Chispa de conflicto encendida!", challenge: "¿Quién conoce mejor la verdad? {loser} tiene 60 segundos para demostrarlo." },
    { emoji: "🃏", phrase: "¡Carta de desacuerdo jugada!", challenge: "{winner} pone en duda tu respuesta, {loser}. ¡Defiéndela o rinde!" },
    { emoji: "🧨", phrase: "¡Bomba de desacuerdo activada!", challenge: "60 segundos para resolver este misterio: ¿quién se conoce mejor?" },
];

/**
 * Retorna cuántos debates quedan disponibles
 */
export function getDebatesRemaining() {
    const used = state.sessionData?.debatesUsed || 0;
    return MAX_DEBATES - used;
}

/**
 * Abre la pantalla de debate para una pregunta en desacuerdo usando los datos sincronizados
 * @param {object} debateData - Datos del debate desde Firebase
 * @param {function} onClose - Callback al cerrar
 */
export function openDebate(debateData, onClose) {
    const { question, playerA, answerA, playerB, answerB, phraseData, endTime } = debateData;
    const remaining = MAX_DEBATES - (state.sessionData?.debatesUsed || 0);

    // Inyectar contenido en la pantalla de debate
    const screen = document.getElementById('view-debate');

    // Frases personalizadas — playerA es quien "perdió" en esta pregunta
    const phrase = phraseData.phrase.replace(/{loser}/g, playerA).replace(/{winner}/g, playerB);
    const challenge = phraseData.challenge.replace(/{loser}/g, playerA).replace(/{winner}/g, playerB);

    document.getElementById('debate-emoji').textContent = phraseData.emoji;
    document.getElementById('debate-headline').textContent = phrase;
    document.getElementById('debate-challenge').textContent = challenge;
    document.getElementById('debate-question-text').textContent = question;
    document.getElementById('debate-answer-a').innerHTML =
        `<span class="text-primary font-bold">${playerA}</span> dijo: <span class="text-white font-medium">"${answerA}"</span>`;
    document.getElementById('debate-answer-b').innerHTML =
        `<span class="text-secondary font-bold">${playerB}</span> dijo: <span class="text-white font-medium">"${answerB}"</span>`;
    document.getElementById('debate-uses-left').textContent =
        remaining > 0 ? `🔥 Debates restantes: ${remaining}` : '⚠️ ¡Último debate!';

    // Mostrar pantalla (overlay)
    screen.classList.remove('hidden');
    screen.classList.add('flex');

    // Animación de entrada
    const card = screen.querySelector('.debate-card');
    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-90', 'opacity-0');
    requestAnimationFrame(() => {
        card.classList.add('transition-all', 'duration-300');
        card.classList.replace('scale-90', 'scale-100');
        card.classList.replace('opacity-0', 'opacity-100');
    });

    // Controlar el estado del botón de cerrar según quién inició el debate
    const btnClose = document.getElementById('btn-debate-close');
    if (btnClose) {
        const isInitiator = state.uid === debateData.initiatorId;
        if (isInitiator) {
            btnClose.disabled = false;
            btnClose.textContent = "✓ Debate cerrado — Siguiente pregunta";
            btnClose.style.opacity = "1";
            btnClose.style.cursor = "pointer";
            btnClose.style.pointerEvents = "auto";
        } else {
            btnClose.disabled = true;
            const initiatorName = debateData.initiatorName || "tu pareja";
            btnClose.textContent = `⏳ Esperando que ${initiatorName} cierre el debate...`;
            btnClose.style.opacity = "0.6";
            btnClose.style.cursor = "not-allowed";
            btnClose.style.pointerEvents = "none";
        }
    }

    startTimer(endTime, onClose);
}

function startTimer(endTime, onClose) {
    clearInterval(timerInterval);

    const circle = document.getElementById('debate-timer-circle');
    const label = document.getElementById('debate-timer-label');
    const circumference = 2 * Math.PI * 45; // r=45
    const totalSeconds = 60; // Duración fija

    function updateTimer() {
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        label.textContent = remaining;

        const progress = remaining / totalSeconds;
        const offset = circumference * (1 - progress);
        circle.style.strokeDashoffset = offset;

        // Cambio de color según urgencia
        if (remaining > 30) {
            circle.style.stroke = '#FF6B9D'; // primary
        } else if (remaining > 10) {
            circle.style.stroke = '#FFD166'; // tertiary (amarillo)
        } else {
            circle.style.stroke = '#FF4444'; // rojo urgente
        }

        if (remaining <= 0) {
            clearInterval(timerInterval);
            finishDebate(onClose);
        }
    }

    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = 0;
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

function finishDebate(onClose) {
    const label = document.getElementById('debate-timer-label');
    label.textContent = '💥';

    // Animar el card de salida
    const card = document.querySelector('.debate-card');
    if (card) {
        card.style.transform = 'scale(0.9)';
        card.style.opacity = '0';
        setTimeout(() => closeDebate(onClose), 350);
    } else {
        closeDebate(onClose);
    }
}

export function closeDebate(onClose) {
    clearInterval(timerInterval);
    const screen = document.getElementById('view-debate');
    screen.classList.add('hidden');
    screen.classList.remove('flex');
    if (typeof onClose === 'function') onClose();
}
