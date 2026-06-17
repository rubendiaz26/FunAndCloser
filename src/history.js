import { state } from './state.js';
import { db } from './firebase.js';
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function loadHistory() {
    try {
        // Obtenemos todo el historial ordenado por fecha descendente
        const q = query(collection(db, "history"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        
        const allHistory = [];
        snapshot.forEach(doc => {
            allHistory.push({ id: doc.id, ...doc.data() });
        });

        const myName = state.playerName || localStorage.getItem('playerName');
        
        // Filtramos para obtener las partidas donde participó este jugador
        // Si no hay nombre, mostramos todas
        let coupleHistory = allHistory;
        let partnerName = null;
        
        if (myName) {
            coupleHistory = allHistory.filter(game => 
                game.hostName === myName || game.guestName === myName
            );
            
            // Encontrar el nombre de la pareja (asumiendo que siempre juegan los dos)
            if (coupleHistory.length > 0) {
                const recentGame = coupleHistory[0];
                partnerName = recentGame.hostName === myName ? recentGame.guestName : recentGame.hostName;
            }
        }

        renderDashboard(coupleHistory, myName, partnerName);
    } catch (error) {
        console.error("Error cargando el historial:", error);
        document.getElementById('history-empty-msg').innerText = "Error cargando el historial. Intenta nuevamente.";
    }
}

function renderDashboard(historyData, myName, partnerName) {
    const listContainer = document.getElementById('history-list');
    const emptyMsg = document.getElementById('history-empty-msg');
    const totalGamesEl = document.getElementById('history-total-games');
    const avgMatchEl = document.getElementById('history-avg-match');
    const winsBarsEl = document.getElementById('history-wins-bars');
    const winsNamesEl = document.getElementById('history-wins-names');

    // Resetear UI
    listContainer.innerHTML = '';
    winsBarsEl.innerHTML = '';
    winsNamesEl.innerHTML = '';

    if (historyData.length === 0) {
        emptyMsg.classList.remove('hidden');
        totalGamesEl.innerText = "0";
        avgMatchEl.innerText = "0%";
        listContainer.appendChild(emptyMsg);
        return;
    }

    emptyMsg.classList.add('hidden');

    // 1. Estadísticas Globales
    const totalGames = historyData.length;
    const totalMatchSum = historyData.reduce((sum, game) => sum + (game.matchPercent || 0), 0);
    const avgMatch = Math.round(totalMatchSum / totalGames);
    
    totalGamesEl.innerText = totalGames;
    avgMatchEl.innerText = `${avgMatch}%`;

    // Color del promedio basado en el puntaje
    avgMatchEl.className = 'text-3xl font-bold ' + 
        (avgMatch >= 80 ? 'text-green-400' : (avgMatch >= 50 ? 'text-primary' : 'text-red-400'));

    // 2. Victorias
    let myWins = 0;
    let partnerWins = 0;
    let ties = 0;

    historyData.forEach(game => {
        let myScore = game.hostName === myName ? game.hostScore : game.guestScore;
        let pScore = game.hostName === myName ? game.guestScore : game.hostScore;
        
        if (myScore > pScore) myWins++;
        else if (pScore > myScore) partnerWins++;
        else ties++;
    });

    // 3. Render Bar Chart (Max height 6rem / h-24)
    const maxWins = Math.max(myWins, partnerWins, 1); // Evitar división por 0
    const myHeight = Math.max((myWins / maxWins) * 100, 10); // mínimo visual
    const partnerHeight = Math.max((partnerWins / maxWins) * 100, 10);

    const partnerLabel = partnerName || 'Pareja';

    winsBarsEl.innerHTML = `
        <div class="flex flex-col items-center justify-end h-full">
            <span class="text-xs font-bold text-white mb-1">${myWins}</span>
            <div class="w-12 bg-primary rounded-t-md transition-all duration-1000 ease-out" style="height: 0%;" data-target="${myHeight}%"></div>
        </div>
        <div class="flex flex-col items-center justify-end h-full">
            <span class="text-xs font-bold text-white mb-1">${partnerWins}</span>
            <div class="w-12 bg-secondary rounded-t-md transition-all duration-1000 ease-out" style="height: 0%;" data-target="${partnerHeight}%"></div>
        </div>
    `;

    winsNamesEl.innerHTML = `
        <div class="w-12 text-center truncate">${myName || 'Tú'}</div>
        <div class="w-12 text-center truncate">${partnerLabel}</div>
    `;

    // Animar las barras después de un pequeño delay
    setTimeout(() => {
        const bars = winsBarsEl.querySelectorAll('div[data-target]');
        bars.forEach(bar => {
            bar.style.height = bar.getAttribute('data-target');
        });
    }, 100);

    // 4. Render Historial (Últimas partidas)
    historyData.forEach(game => {
        const dateObj = game.date?.toDate ? game.date.toDate() : new Date(game.date);
        const dateStr = dateObj.toLocaleDateString();
        
        const match = game.matchPercent || 0;
        let badgeColor = 'bg-red-500';
        if (match >= 80) badgeColor = 'bg-green-500';
        else if (match >= 50) badgeColor = 'bg-primary';

        const card = document.createElement('div');
        card.className = "bg-surface border border-gray-700 rounded-xl p-4 flex items-center justify-between";
        card.innerHTML = `
            <div class="flex-grow pr-4">
                <p class="text-white font-bold text-sm truncate">${game.topic}</p>
                <p class="text-gray-500 text-xs">${game.category} • ${dateStr}</p>
            </div>
            <div class="${badgeColor} text-white text-sm font-bold py-1 px-3 rounded-full flex-shrink-0">
                ${match}%
            </div>
        `;
        listContainer.appendChild(card);
    });
}
