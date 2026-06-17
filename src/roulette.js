import { state } from './state.js';
import { updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { db } from './firebase.js';

export const CATEGORIES = [
    { name: "Recuerdos y Conexión", emoji: "💭", color: "#FFD166",
      topics: ["El Baúl de los Recuerdos", "Lector de Mentes", "Nuestra Historia", "Secretos Revelados"] },
    { name: "Divertidos y Cotidianos", emoji: "😂", color: "#06D6A0",
      topics: ["El Socio Ideal", "Intercambio de Cuerpos", "Cuestión de Gustos", "Terapia de Risas"] },
    { name: "Para Soñar Juntos", emoji: "🌟", color: "#4CC9F0",
      topics: ["La Casa de tus Sueños", "Próxima Parada (Viajes)", "Metas Compartidas"] },
    { name: "Picantes y Atrevidos", emoji: "🌶️", color: "#FF6B9D",
      topics: ["Modo Clandestino", "Fantasías sobre la Mesa", "Quién Toma el Control", "Noche de Cita 5 Estrellas"] },
    { name: "🎲 Sorpresa", emoji: "🎲", color: "url(#rainbow)",
      topics: ["Sorpresa"] }
];

export function renderRoulette() {
    const wheel = document.getElementById('roulette-wheel');
    const numSectors = CATEGORIES.length;
    const arc = 360 / numSectors;

    let svgHTML = `<svg viewBox="0 0 100 100" class="w-full h-full transform -rotate-90">
        <defs>
            <linearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#FF6B9D" />
                <stop offset="50%" stop-color="#C77DFF" />
                <stop offset="100%" stop-color="#4CC9F0" />
            </linearGradient>
        </defs>`;

    CATEGORIES.forEach((cat, i) => {
        const startAngle = i * arc;
        const endAngle = (i + 1) * arc;
        
        // Calcular coordenadas SVG para el path del sector
        const x1 = 50 + 50 * Math.cos((Math.PI * startAngle) / 180);
        const y1 = 50 + 50 * Math.sin((Math.PI * startAngle) / 180);
        const x2 = 50 + 50 * Math.cos((Math.PI * endAngle) / 180);
        const y2 = 50 + 50 * Math.sin((Math.PI * endAngle) / 180);

        svgHTML += `<path d="M50 50 L${x1} ${y1} A50 50 0 0 1 ${x2} ${y2} Z" fill="${cat.color}" stroke="#1A1A2E" stroke-width="0.5"/>`;

        // Texto centrado en el sector
        const midAngle = startAngle + arc / 2;
        const textRadius = 35;
        const tx = 50 + textRadius * Math.cos((Math.PI * midAngle) / 180);
        const ty = 50 + textRadius * Math.sin((Math.PI * midAngle) / 180);

        // Rotamos el texto para que mire hacia afuera
        svgHTML += `<text x="${tx}" y="${ty}" transform="rotate(${midAngle + 90}, ${tx}, ${ty})" fill="#1A1A2E" font-size="6" font-weight="bold" text-anchor="middle" alignment-baseline="middle">${cat.emoji}</text>`;
    });

    svgHTML += `</svg>`;
    wheel.innerHTML = svgHTML;
}

export async function spinRoulette() {
    const wheel = document.getElementById('roulette-wheel');
    const btnSpin = document.getElementById('btn-spin');
    
    // Deshabilitar botón
    btnSpin.disabled = true;

    // Calcular giro: 5 a 10 vueltas completas + un ángulo aleatorio
    const extraSpins = 360 * (5 + Math.floor(Math.random() * 5));
    const randomAngle = Math.floor(Math.random() * 360);
    const totalAngle = extraSpins + randomAngle;

    // Identificar el sector ganador
    const numSectors = CATEGORIES.length;
    const arc = 360 / numSectors;
    
    // La ruleta CSS gira en sentido horario. 
    // El puntero está en la parte superior (-90 grados o 270 grados en círculo estándar).
    // Con la SVG rotada -90, el sector 0 empieza en la derecha (0 grados) pero ahora está arriba.
    // Necesitamos mapear el ángulo final a la categoría.
    const normalizedAngle = (360 - (totalAngle % 360)) % 360; 
    const winningIndex = Math.floor(normalizedAngle / arc);
    const winningCategory = CATEGORIES[winningIndex];

    // Seleccionar tema específico dentro de la categoría
    let winningTopic = "Tema Sorpresa";
    if (winningCategory.topics.length > 1) {
        winningTopic = winningCategory.topics[Math.floor(Math.random() * winningCategory.topics.length)];
    }

    // Actualizar Firebase para sincronizar
    const sessionRef = doc(db, "sessions", state.sessionCode);
    await updateDoc(sessionRef, {
        status: "spinning",
        rouletteAngle: totalAngle,
        category: winningCategory.name,
        topic: winningTopic,
        topicEmoji: winningCategory.emoji
    });
}

export function animateRouletteTo(angle, onComplete) {
    const wheel = document.getElementById('roulette-wheel');
    // Aplicar transformación
    wheel.style.transform = `rotate(${angle}deg)`;
    
    // Esperar a que termine la transición CSS (4s configurado en HTML)
    setTimeout(() => {
        if (onComplete) onComplete();
    }, 4200); // 200ms extra de margen
}
