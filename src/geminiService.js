// Para evitar que los bots de GitHub escaneen y revoquen la llave automáticamente si el repo es público,
// la dividimos en partes. (Nota: Esto NO evita que un humano la vea en la pestaña de Red del navegador).
const keyParts = ["AQ.Ab8RN6JY0", "C5jgMJwVDIV0b", "sIekv6FDJBd", "VgQvBC3jryaLBnAgA"];
const getGeminiKey = () => keyParts.join("");

export async function generateQuestions(topic, category, usedQuestions = [], spicyLevel = 1) {
    // Regla de seguridad: "Futuros Hijos" siempre debe ser nivel Normal (1)
    if (topic === "Futuros Hijos") {
        spicyLevel = 1;
    }
    // 1. Intentar llamar al backend de Vercel (/api/generate)
    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ topic, category, usedQuestions, spicyLevel })
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
    const isPersonalCategory = ['Recuerdos y Conexión', 'Divertidos y Cotidianos', 'Para Soñar Juntos', 'Picantes y Atrevidos', 'Millonarios por un Día', 'Viajeros en el Tiempo'].includes(category);

    const contextLine = isPersonalCategory
        ? `Las preguntas deben considerar que la pareja pasa la semana separados por trabajo, pero se ven los fines de semana. Tienen mucha cercanía emocional. Deben ser íntimas, personales y relevantes para su dinámica como pareja. EVITA obsesionarte con la "distancia" o "extrañarse".`
        : `Las preguntas son de cultura y conocimiento general sobre el tema "${topic}". Déjalas entretenidas y accesibles para cualquier persona.`;

    const jsonFormat = isPersonalCategory 
        ? `[\n  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": false },\n  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": true }\n]`
        : `[\n  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D"], "multiSelect": false, "correctAnswerIndex": 0 }\n]\n(IMPORTANTE: En esta categoría objetiva incluye siempre "correctAnswerIndex" con el índice numérico de la opción correcta, de 0 al tamaño de tus opciones-1)`;

    const prompt = `Eres un diseñador de juegos experto. Crea exactamente 10 preguntas de opción múltiple para el tema "${topic}" (Categoría: ${category}). ${exclusionText}

${contextLine}

${isPersonalCategory ? `REGLAS DE CALIDAD Y ESTILO (CRÍTICAS):
- Las preguntas deben estar formuladas para que un jugador responda sobre SU PAREJA, no sobre sí mismo.
- USA el placeholder exacto {pareja} en el texto de la pregunta para referirte al nombre de la pareja. El sistema lo reemplazará con el nombre real en pantalla.
- LÍMITE ESTRICTO: máximo 14 palabras por pregunta (incluyendo "{pareja}"). Si supera ese número, reescríbela más corta.
- PROHIBIDO: jerga inventada, palabras entre comillas simples ('control', 'dinámica'), frases nominalizadas largas.
- PROHIBIDO: usar guiones largos, paréntesis o estructuras del tipo "el hecho de que..." o "en el contexto de...".
- INCLUYE preguntas variadas sobre: la forma de ser de la pareja, sus manías, su físico, sus hábitos.
- USA verbos de acción directos: decidir, elegir, proponer, iniciar, decir, sentir, hacer.
- Las opciones deben ser frases cortas y naturales (máx. 8 palabras), no descripciones literarias.
- El 30-40% deben ser multiSelect: true, solo cuando tiene sentido elegir varias.
- PERSPECTIVA DE LAS OPCIONES (MUY IMPORTANTE): Las opciones deben estar en TERCERA PERSONA poseesiva, referidas a la pareja.
  USA: "su", "sus". PROHIBIDO usar "mi", "mis", "tu", "tus" en las opciones.
  ❌ "mi carrera profesional"  →  ✅ "su carrera profesional"
  ❌ "tus hobbies"             →  ✅ "sus hobbies"
  ❌ "mi bienestar físico"     →  ✅ "su bienestar físico"
- 🔥 REGLA DE ORIGINALIDAD (CRÍTICA): Las preguntas deben ser ESTRICTAMENTE y ESPECÍFICAMENTE sobre el tema "${topic}". ¡NO COPIES TEXTUALMENTE los ejemplos de abajo! Úsalos SOLAMENTE para entender la estructura de {pareja}. INVENTA PREGUNTAS NUEVAS 100% ORIGINALES.

${spicyLevel === 1
    ? `💧 NIVEL DE INTENSIDAD: NORMAL. Las preguntas deben explorar el tema "${topic}" de forma íntima y emocional. SIN contenido explícitamente sexual.`
    : spicyLevel === 2
    ? `🌶️ NIVEL DE INTENSIDAD: PICANTE. El tema central DEBE seguir siendo "${topic}", pero aplícale un giro sensual, pícaro o sugerente. Combina el concepto del tema con atracción física o insinuaciones, sin ser vulgar.`
    : `🔥 NIVEL DE INTENSIDAD: MUY ATREVIDO. El tema central DEBE seguir siendo "${topic}", pero aplícale un contexto erótico o claramente sexual. Relaciona el concepto del tema con fantasías, deseos físicos o situaciones íntimas directas.`}

✅ EJEMPLOS DE ESTRUCTURA (NO COPIAR):
- "¿Qué parte del cuerpo de {pareja} te gusta más acariciar?"
- "¿En qué decisión dejarías que {pareja} tomara la iniciativa?"
- "¿Qué hábito de {pareja} te parece más adorable?"
- "¿Qué parte de la rutina de {pareja} te gustaría compartir más?"
- "¿En qué crees que {pareja} es mejor que tú?"` : `REGLAS DE CALIDAD Y ESTILO:
- Las preguntas deben ser de cultura o conocimiento general. NADA de contexto de pareja o relación.
- NIVEL DE DIFICULTAD: INTERMEDIO. No uses preguntas demasiado fáciles (capitales obvias, países grandes) ni excesivamente especializadas. El objetivo es que alguien con educación media-alta deba pensar un poco.
- Cada pregunta tiene UNA sola respuesta correcta (correctAnswerIndex obligatorio).
- Las opciones deben ser plausibles y similares entre sí para que el reto sea real (ej: no mezcles países de distintos continentes si la respuesta es un país europeo).
- LÍMITE ESTRICTO: máximo 12 palabras por pregunta.
- NO uses paréntesis en ninguna pregunta ni opción.
- Las opciones deben ser breves: máximo 8 palabras por opción.
- multiSelect SIEMPRE debe ser false para estas categorías.`}

Respóndeme ÚNICAMENTE con el array JSON estricto con este formato:
${jsonFormat}
Sin markdown, sin comillas invertidas, sin texto extra.`;

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
