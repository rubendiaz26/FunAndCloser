export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { topic, category, usedQuestions = [] } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not defined.' });
  }

  let exclusionText = '';
  if (usedQuestions.length > 0) {
      exclusionText = `\nNO repitas ninguna de estas preguntas que ya se hicieron anteriormente:\n- ${usedQuestions.join('\n- ')}\n`;
  }

  const isPersonalCategory = ['Recuerdos y Conexión', 'Divertidos y Cotidianos', 'Para Soñar Juntos', 'Picantes y Atrevidos'].includes(category);

  const contextLine = isPersonalCategory
      ? `Las preguntas deben considerar que la pareja pasa la semana separados por trabajo, pero se ven los fines de semana. Tienen mucha cercanía emocional. Deben ser íntimas, personales y relevantes para su dinámica como pareja. EVITA obsesionarte con la "distancia" o "extrañarse".`
      : `Las preguntas son de cultura y conocimiento general sobre el tema "${topic}". Déjalas entretenidas y accesibles para cualquier persona. NUNCA personalices las preguntas para una pareja específica.`;

  const jsonFormat = isPersonalCategory
      ? `[
  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": false },
  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": true }
]`
      : `[
  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D"], "multiSelect": false, "correctAnswerIndex": 0 }
]
(IMPORTANTE: En esta categoría objetiva incluye siempre "correctAnswerIndex" con el índice numérico de la opción correcta, de 0 al tamaño de tus opciones-1)`;

  const qualityRules = isPersonalCategory
      ? `REGLAS DE CALIDAD Y ESTILO (CRÍTICAS):
- Las preguntas deben sonar como algo que una persona le preguntaría a su pareja en una conversación real y casual.
- LÍMITE ESTRICTO: máximo 12 palabras por pregunta. Si supera ese número, reescríbela más corta.
- PROHIBIDO: jerga inventada, palabras entre comillas simples ('control', 'dinámica'), frases nominalizadas largas.
- PROHIBIDO: usar guiones largos, paréntesis o estructuras del tipo "el hecho de que..." o "en el contexto de...".
- USA verbos de acción directos: decidir, elegir, proponer, iniciar, decir, sentir, hacer.
- Las opciones deben ser frases cortas y naturales (máx. 8 palabras), no descripciones literarias.
- El 30-40% deben ser multiSelect: true, solo cuando tiene sentido elegir varias.

✅ EJEMPLOS CORRECTOS (cortos, naturales, directos):
- "¿en qué decisión prefieres que yo tome la iniciativa?"
- "¿Qué parte de mi rutina te gustaría conocer mejor?"
- "Si pudiera cambiar algo de mis hábitos, ¿qué elegirías?"
- "¿En qué soy mejor: planear salidas o improvisar?"
- "¿Cómo me demuestras que me extrañas sin decirlo?"

❌ EJEMPLOS INCORRECTOS (complejos, artificiales, largos):
- "¿Qué parte de la logística del 'control' me cedes voluntariamente?"
- "Cuando la dinámica de nuestra relación requiere decisiones espontáneas..."
- "¿En qué aspecto de nuestra convivencia emocional prefieres que yo lidere?"`
      : `REGLAS DE CALIDAD:
- Las preguntas deben ser de cultura o conocimiento general. NADA de contexto de pareja o relación.
- Cada pregunta tiene UNA sola respuesta correcta (correctAnswerIndex obligatorio).
- Las opciones deben ser plausibles pero solo una correcta.
- Las preguntas deben ser CORTAS y DIRECTAS: máximo 12 palabras.
- NO uses paréntesis en ninguna pregunta ni opción.
- Las opciones deben ser breves: máximo 8 palabras por opción.
- multiSelect SIEMPRE debe ser false para estas categorías.`;

  const prompt = `Eres un diseñador de juegos experto. Crea exactamente 10 preguntas de opción múltiple para el tema "${topic}" (Categoría: ${category}). ${exclusionText}

${contextLine}

${qualityRules}

Responde ÚNICAMENTE con un array JSON estricto con este formato:
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
        return res.status(500).json({ error: data.error.message });
    }

    let jsonString = data.candidates[0].content.parts[0].text;
    const startIndex = jsonString.indexOf('[');
    const endIndex = jsonString.lastIndexOf(']');
    if (startIndex !== -1 && endIndex !== -1) {
        jsonString = jsonString.substring(startIndex, endIndex + 1);
    }
    
    const questions = JSON.parse(jsonString);
    return res.status(200).json(questions);
  } catch (error) {
    console.error("Error in serverless generate function:", error);
    return res.status(500).json({ error: 'Error generating questions' });
  }
}
