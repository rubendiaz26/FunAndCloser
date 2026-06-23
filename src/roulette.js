import { state } from './state.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';

export const CATEGORIES = [
    { name: "🎲 Sorpresa", emoji: "🎲", color: "#7B2CBF",
      topics: ["Sorpresa"] },
    { name: "Recuerdos y Conexión", emoji: "☁️", color: "#FFD166",
      topics: ["El Baúl de los Recuerdos", "Lector de Mentes", "Nuestra Historia", "Secretos Revelados"] },
    { name: "Divertidos y Cotidianos", emoji: "🎭", color: "#06D6A0",
      topics: ["El Socio Ideal", "Cuestión de Gustos", "Terapia de Risas"] },
    { name: "Para Soñar Juntos", emoji: "☀️", color: "#4CC9F0",
      topics: ["La Casa de tus Sueños", "Próxima Parada", "Metas Compartidas", "Futuros Hijos"] },
    { name: "Picantes y Atrevidos", emoji: "🌶️", color: "#EF233C",
      topics: ["Modo Clandestino", "Fantasías sobre la Mesa", "Quién Toma el Control", "Noche de Cita 5 Estrellas"] },
    { name: "Millonarios por un Día", emoji: "💰", color: "#F7B731",
      topics: ["El Gran Lujo", "Inversiones del Corazón", "Caprichos Sin Límite", "Nuestra Vida de Ricos"] },
    { name: "Viajeros en el Tiempo", emoji: "⏳", color: "#A8DADC",
      topics: ["Al Pasado Juntos", "El Futuro que Queremos", "Si Volviéramos a Empezar", "Memorias del Mañana"] },
    { name: "Cultura General", emoji: "🧠", color: "#F4A261",
      topics: ["Astronomía y el Sistema Solar", "Historia y Curiosidades", "Ciencia y Tecnología"] },
    { name: "Geografía", emoji: "🌍", color: "#2EC4B6",
      topics: ["Capitales del Mundo", "Países y Fronteras", "Maravillas Naturales", "Culturas y Tradiciones"] }
];


// Acumulador de rotación para que la rueda siempre gire hacia adelante (sentido horario)
let cumulativeAngle = 0;

export function resetRouletteAngle() {
    cumulativeAngle = 0;
    const wheel = document.getElementById('roulette-wheel');
    if (wheel) {
        wheel.style.transition = 'none';
        wheel.style.transform = 'rotate(0deg)';
    }
}

export function renderRoulette() {
    const wheel = document.getElementById('roulette-wheel');
    const numSectors = CATEGORIES.length;
    const arc = 360 / numSectors;

    let svgHTML = `<svg viewBox="0 0 100 100" class="w-full h-full transform -rotate-90">
        <defs>
            <radialGradient id="inner-shadow" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stop-color="transparent" stop-opacity="0" />
                <stop offset="100%" stop-color="#000" stop-opacity="0.5" />
            </radialGradient>
        </defs>`;

    CATEGORIES.forEach((cat, i) => {
        const startAngle = i * arc;
        const endAngle = (i + 1) * arc;
        
        // Calcular coordenadas SVG para el path del sector
        const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
        const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
        const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
        const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);

        svgHTML += `<path d="M50 50 L${x1} ${y1} A50 50 0 0 1 ${x2} ${y2} Z" fill="${cat.color}" stroke="#1A1A2E" stroke-width="0.8"/>`;

        // Texto centrado en el sector (Aumentar tamaño de emoji y centrar mejor)
        const midAngle = startAngle + arc / 2;
        const textRadius = 32;
        const tx = 50 + textRadius * Math.cos((Math.PI * midAngle) / 180);
        const ty = 50 + textRadius * Math.sin((Math.PI * midAngle) / 180);

        // Rotamos el texto para que mire hacia afuera
        svgHTML += `<text x="${tx}" y="${ty}" transform="rotate(${midAngle + 90}, ${tx}, ${ty})" font-size="20" text-anchor="middle" alignment-baseline="middle" style="filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.4));">${cat.emoji}</text>`;
    });

    // Agregar sombra interior para dar volumen a la ruleta
    svgHTML += `<circle cx="50" cy="50" r="50" fill="url(#inner-shadow)" pointer-events="none" />`;

    svgHTML += `</svg>`;
    wheel.innerHTML = svgHTML;
}

export async function spinRoulette() {
    const wheel = document.getElementById('roulette-wheel');
    const btnSpin = document.getElementById('btn-spin');
    
    // Deshabilitar botón
    btnSpin.disabled = true;

    // Calcular giro: mínimo 5 vueltas completas + un ángulo aleatorio (siempre positivo = horario)
    const extraSpins = 360 * (5 + Math.floor(Math.random() * 4)); // 5 a 8 vueltas
    const randomAngle = Math.floor(Math.random() * 360);
    const deltaAngle = extraSpins + randomAngle; // delta positivo siempre gira en horario

    // El ángulo total acumulado desde el inicio
    const newCumulativeAngle = cumulativeAngle + deltaAngle;

    // Identificar el sector ganador basado en el delta
    const numSectors = CATEGORIES.length;
    const arc = 360 / numSectors;
    
    // La ruleta CSS gira en sentido horario.
    // El puntero está en la parte superior.
    // normalizedAngle = dónde queda el puntero dentro de la ruleta.
    const normalizedAngle = (360 - (newCumulativeAngle % 360)) % 360;
    const winningIndex = Math.floor(normalizedAngle / arc);
    const winningCategory = CATEGORIES[winningIndex];

    // Seleccionar tema específico dentro de la categoría
    let winningTopic;
    if (winningCategory.topics.length === 1 && winningCategory.topics[0] === 'Sorpresa') {
        // En modo Sorpresa: elegir un topic real al azar de TODAS las categorías
        // (el usuario no sabe cuál, solo ve "Sorpresa")
        const allTopics = CATEGORIES
            .filter(c => !(c.topics.length === 1 && c.topics[0] === 'Sorpresa'))
            .flatMap(c => c.topics);
        winningTopic = allTopics[Math.floor(Math.random() * allTopics.length)];
    } else {
        winningTopic = winningCategory.topics[Math.floor(Math.random() * winningCategory.topics.length)];
    }

    // Actualizar Firebase para sincronizar (guardamos el delta para que animateRouletteTo sepa cuánto girar)
    const sessionRef = doc(db, "sessions", state.sessionCode);
    await updateDoc(sessionRef, {
        status: "spinning",
        rouletteAngle: newCumulativeAngle,  // ángulo total absoluto
        category: winningCategory.name,
        topic: winningTopic,
        topicEmoji: winningCategory.emoji
    });
}

export function animateRouletteTo(targetAngle, onComplete) {
    const wheel = document.getElementById('roulette-wheel');
    
    // Asegurarnos de que el ángulo objetivo sea mayor al actual (siempre giro horario)
    // Si por algún motivo targetAngle <= cumulativeAngle, añadimos vueltas extra
    let finalAngle = targetAngle;
    if (finalAngle <= cumulativeAngle) {
        finalAngle = cumulativeAngle + 360 * 5 + (targetAngle % 360);
    }

    // Reactivar transición y aplicar
    wheel.style.transition = 'transform 5.5s cubic-bezier(0.17, 0.67, 0.12, 1.0)';
    wheel.style.transform = `rotate(${finalAngle}deg)`;
    cumulativeAngle = finalAngle;
    
    // Esperar a que termine la transición CSS (5.5s)
    setTimeout(() => {
        if (onComplete) onComplete();
    }, 5700); // 200ms extra de margen
}
