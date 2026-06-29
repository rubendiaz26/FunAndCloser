export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let { topic, category, usedQuestions = [], spicyLevel = 1 } = req.body;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: GEMINI_API_KEY is not defined.' });
  }

  // Regla de seguridad: "Futuros Hijos" siempre debe ser nivel Normal (1)
  if (topic === "Futuros Hijos") {
    spicyLevel = 1;
  }

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

  const rulesBlock = isPersonalCategory
    ? `REGLAS DE CALIDAD Y ESTILO (CRÍTICAS):
- Las preguntas deben estar formuladas para que un jugador responda sobre SU PAREJA, no sobre sí mismo.
- USA el placeholder exacto {pareja} en el texto de la pregunta para referirte al nombre de la pareja. El sistema lo reemplazará con el nombre real en pantalla.
- PERSPECTIVA DE LA PREGUNTA (ABSOLUTA): Cada jugador lee su pregunta en su propia pantalla de forma individual y silenciosa. La pregunta NO es un diálogo, NO habla desde la primera persona.
  PROHIBIDO en el texto de la pregunta: "mío", "mía", "mi", "mis", "tuyo", "tuya", "tu", "tus", "yo", "me", "nuestro".
  ✅ CORRECTO: "¿Qué hábito de {pareja} te parece más tierno?"
  ✅ CORRECTO: "¿En qué decisión dejarías que {pareja} tomara la iniciativa?"
  ❌ INCORRECTO: "¿Qué hábito mío te parece más tierno?"
  ❌ INCORRECTO: "¿Qué parte de mi rutina te gustaría conocer mejor?"
- LÍMITE ESTRICTO: máximo 14 palabras por pregunta (incluyendo "{pareja}"). Si supera ese número, reescríbela más corta.
- PROHIBIDO: jerga inventada, palabras entre comillas simples, frases nominalizadas largas.
- PROHIBIDO: usar guiones largos, paréntesis o estructuras del tipo "el hecho de que..." o "en el contexto de...".
- EVITA abusar de menciones sobre "videollamadas", "mensajes", "lejanía" o "distancia".
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
- "¿En qué crees que {pareja} es mejor que tú?"`
    : `REGLAS DE CALIDAD Y ESTILO:
- Las preguntas deben ser de cultura o conocimiento general. NADA de contexto de pareja o relación.
- AUDIENCIA OBJETIVO: Las preguntas deben ser respondibles por cualquier adulto promedio sin estudios universitarios especializados en el tema. Si alguien necesitaría haber tomado una clase universitaria para responder, la pregunta es demasiado difícil.
- ESCALA DE DIFICULTAD (síguela con exactitud):
  ❌ DEMASIADO FÁCIL (evitar): "¿Cuál es la capital de Francia?", "¿Cuántos jugadores tiene un equipo de fútbol?"
  ✅ NIVEL CORRECTO (apuntar a esto): "¿En qué continente está Egipto?", "¿Quién inventó el teléfono?", "¿Qué país tiene la bandera con la hoja de maple?"
  ❌ DEMASIADO DIFÍCIL (prohibido): "¿Qué filósofo defendió la separación de poderes?", "¿Cuál es la capital de Burkina Faso?", "¿Qué poeta escribió El paraíso perdido?"
- TEMAS PROHIBIDOS POR SER DEMASIADO ESPECIALIZADOS:
  - Filósofos, pensadores y corrientes filosóficas o políticas específicas
  - Autores literarios poco conocidos o títulos exactos de obras
  - Capitales de países pequeños o poco conocidos
  - Historia política muy específica (tratados, artículos de constituciones, batallas menores)
  - Fechas exactas de eventos históricos
  - Términos científicos avanzados
- TEMAS RECOMENDADOS (accesibles y entretenidos):
  - Datos curiosos, récords y hechos sorprendentes del mundo
  - Inventores famosos y sus inventos más conocidos
  - Geografía mayor: países, continentes, océanos, montañas famosas
  - Animales, naturaleza y ciencia básica y visual
  - Cultura pop: películas conocidas, música, deportes, celebridades globales
  - Cocina, tradiciones y costumbres de distintas culturas
- Cada pregunta tiene UNA sola respuesta correcta (correctAnswerIndex obligatorio).
- Las opciones deben ser plausibles y similares entre sí para que el reto sea real.
- LÍMITE ESTRICTO: máximo 12 palabras por pregunta.
- NO uses paréntesis en ninguna pregunta ni opción.
- Las opciones deben ser breves: máximo 8 palabras por opción.
- multiSelect SIEMPRE debe ser false para estas categorías.`;

  const prompt = `Eres un diseñador de juegos experto. Crea exactamente 10 preguntas de opción múltiple para el tema "${topic}" (Categoría: ${category}). ${exclusionText}

${contextLine}

${rulesBlock}

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
      return res.status(500).json({ error: data.error.message });
    }

    let rawText = data.candidates[0].content.parts[0].text;

    // Extraer el primer array JSON válido del texto usando conteo de brackets
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
      return res.status(500).json({ error: 'Failed to parse questions from Gemini response' });
    }

    return res.status(200).json(questions.slice(0, 10));
  } catch (error) {
    console.error("Error in serverless generate function:", error);
    return res.status(500).json({ error: 'Error generating questions' });
  }
}
