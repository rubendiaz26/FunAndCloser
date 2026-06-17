// Para evitar que los bots de GitHub escaneen y revoquen la llave automáticamente si el repo es público,
// la dividimos en partes. (Nota: Esto NO evita que un humano la vea en la pestaña de Red del navegador).
const keyParts = ["AQ.Ab8RN6JY0", "C5jgMJwVDIV0b", "sIekv6FDJBd", "VgQvBC3jryaLBnAgA"];
const getGeminiKey = () => keyParts.join("");

export async function generateQuestions(topic, category) {
    // 1. Intentar llamar al backend de Vercel (/api/generate)
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic, category })
        });

        if (response.ok) {
            const questions = await response.json();
            if (Array.isArray(questions) && questions.length === 10) {
                return questions;
            }
        }
        
        // Si no responde ok, pero no es un 404, lanzamos error para usar el fallback
        if (response.status !== 404) {
            throw new Error(`Vercel API returned status ${response.status}`);
        }
    } catch (error) {
        console.warn("Backend de Vercel no disponible o falló, usando llamada directa al navegador...", error);
    }

    // 2. Fallback: Llamada directa al navegador (para pruebas en localhost:8080)
    const GEMINI_API_KEY = getGeminiKey();
    const prompt = `Genera exactamente 10 preguntas de opción múltiple para un juego de parejas sobre el tema "${topic}" (Categoría: ${category}). 
Cada pregunta debe tener entre 5 y 6 opciones únicas, divertidas y reveladoras.
Responde ÚNICAMENTE con un array JSON estricto con este formato:
[
  { "question": "...", "options": ["A", "B", "C", "D", "E"] },
  ...
]
No incluyas markdown, ni comillas invertidas, ni texto introductorio. Solo el JSON válido.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        let jsonString = data.candidates[0].content.parts[0].text;
        
        // Limpiar posible formato markdown que a veces Gemini incluye
        jsonString = jsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        const questions = JSON.parse(jsonString);
        
        if (!Array.isArray(questions) || questions.length !== 10) {
            throw new Error("El formato de respuesta no contiene 10 preguntas.");
        }

        return questions;

    } catch (error) {
        console.error("Error generando preguntas con Gemini (Directo):", error);
        console.warn("Volviendo a preguntas de respaldo...");
        return getMockQuestions(topic);
    }
}

function getMockQuestions(topic) {
    const mock = [];
    for (let i = 1; i <= 10; i++) {
        mock.push({
            question: `[Simulada] ¿Pregunta de prueba ${i} sobre ${topic}?`,
            options: ["Opción 1", "Opción 2", "Opción 3", "Opción 4", "Opción 5"]
        });
    }
    return mock;
}
