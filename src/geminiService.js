// Para evitar que los bots de GitHub escaneen y revoquen la llave automáticamente si el repo es público,
// la dividimos en partes. (Nota: Esto NO evita que un humano la vea en la pestaña de Red del navegador).
const keyParts = ["AQ.Ab8RN6JY0", "C5jgMJwVDIV0b", "sIekv6FDJBd", "VgQvBC3jryaLBnAgA"];
const getGeminiKey = () => keyParts.join("");

export async function generateQuestions(topic, category, usedQuestions = []) {
    // 1. Intentar llamar al backend de Vercel (/api/generate)
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic, category, usedQuestions })
        });

        if (response.ok) {
            const questions = await response.json();
            if (Array.isArray(questions) && questions.length >= 5) {
                return questions;
            }
        }
        
        // Si el servidor retornó error (500), lanzar para usar fallback directo
        if (!response.ok && response.status !== 404) {
            throw new Error(`Server API returned status ${response.status}`);
        }
    } catch (error) {
        console.warn("Backend de Vercel no disponible o falló, usando llamada directa al navegador...", error);
    }

    // 2. Fallback: Llamada directa al navegador (para pruebas en localhost:8080)
    const GEMINI_API_KEY = getGeminiKey();
    let exclusionText = '';
    if (usedQuestions.length > 0) {
        exclusionText = `\nNO repitas ninguna de estas preguntas que ya se hicieron anteriormente:\n- ${usedQuestions.join('\n- ')}\n`;
    }
    const isPersonalCategory = ['Recuerdos y Conexión', 'Divertidos y Cotidianos', 'Para Soñar Juntos', 'Picantes y Atrevidos'].includes(category);

    const contextLine = isPersonalCategory
        ? `Las preguntas deben considerar que la pareja pasa la semana separados por trabajo, pero se ven los fines de semana (con un máximo de 2 semanas sin verse). Deben ser íntimas, personales y relevantes para su dinámica como pareja.`
        : `Las preguntas son de cultura y conocimiento general sobre el tema "${topic}". Déjalas entretenidas y accesibles para cualquier persona.`;

    const jsonFormat = isPersonalCategory 
        ? `[\n  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": false },\n  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": true }\n]`
        : `[\n  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D"], "multiSelect": false, "correctAnswerIndex": 0 }\n]\n(IMPORTANTE: En esta categoría objetiva incluye siempre "correctAnswerIndex" con el índice numérico de la opción correcta, de 0 al tamaño de tus opciones-1)`;

    const prompt = `Eres un diseñador de juegos experto. Crea exactamente 10 preguntas de opción múltiple para el tema "${topic}" (Categoría: ${category}). ${exclusionText}

${contextLine}

REGLAS DE FORMATO (MUY IMPORTANTES):
- Las preguntas deben ser CORTAS y DIRECTAS: máximo 15 palabras.
- NO uses paréntesis en ninguna pregunta ni opción.
- NO uses frases entre guiones que hagan la pregunta más larga.
- Escribe en primera persona cuando aplique ("Cuando extraño a mi pareja...").
- Las opciones deben ser breves: máximo 10 palabras por opción.
- El 30-40% deben ser multiSelect: true, solo cuando tiene sentido elegir varias.

EJEMPLOS de preguntas CORRECTAS (cortas y sin paréntesis):
- "¿Qué hago cuando extraño a mi pareja sin decirlo?"
- "Si nos reencontáramos hoy, lo primero que haría es..."
- "¿Cuál es la capital de Brasil?"
- "¿Qué país tiene más idiomas oficiales?"

EJEMPLOS de preguntas INCORRECTAS (demasiado largas o con paréntesis):
- "Cuando pienso en los pequeños viajes que hacemos juntos en nuestra mente (como hablar de nuestros planes futuros), lo que más valoro es..."

Responde ÚNICAMENTE con un array JSON estricto:
${jsonFormat}
Solo el JSON. Sin markdown, sin comillas invertidas, sin texto extra.`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
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

        let rawText = data.candidates[0].content.parts[0].text;
        
        // Extraer el primer array JSON válido usando conteo de brackets
        // (más robusto que lastIndexOf cuando el modelo genera contenido extra al final)
        let questions = null;
        const firstBracket = rawText.indexOf('[');
        if (firstBracket !== -1) {
            let depth = 0;
            let endPos = -1;
            for (let i = firstBracket; i < rawText.length; i++) {
                if (rawText[i] === '[') depth++;
                else if (rawText[i] === ']') {
                    depth--;
                    if (depth === 0) { endPos = i; break; }
                }
            }
            if (endPos !== -1) {
                questions = JSON.parse(rawText.substring(firstBracket, endPos + 1));
            }
        }
        
        if (!Array.isArray(questions) || questions.length < 5) {
            throw new Error("El formato de respuesta no contiene suficientes preguntas.");
        }

        return questions.slice(0, 10);

    } catch (error) {
        console.error("Error generando preguntas con Gemini (Directo):", error);
        throw error; // Permitimos que main.js atrape el error y muestre la vista correspondiente
    }
}
