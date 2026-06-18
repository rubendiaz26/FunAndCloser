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

  const prompt = `Eres un diseñador de juegos especializado en parejas con relaciones a distancia. Tu misión es crear exactamente 10 preguntas de opción múltiple para el tema "${topic}" (Categoría: ${category}). ${exclusionText}

CONTEXTO OBLIGATORIO: Las preguntas deben asumir que la pareja NO vive junta y mantiene la relación a distancia. Cada pregunta debe resonar con situaciones reales de parejas que se comunican por videollamada, mensajes, y que extrañan la presencia física del otro.

REGLAS DE CALIDAD:
- Las preguntas deben ser específicas, íntimas y un poco atrevidas (no genéricas).
- Evita preguntas como "¿Cuál es tu color favorito?" o "¿Qué comida prefieres?" — son demasiado básicas.
- Las opciones deben ser reveladoras, ingeniosas y reflejar personalidades reales (no listas aburridas).
- Usa humor, ternura y situaciones que solo tiene sentido preguntar entre personas que se conocen íntimamente.
- Al menos 2 preguntas deben referirse directamente a la dinámica de la distancia (llamadas, reencuentros, esperas, tiempo libre solo).
- Las preguntas de selección múltiple deben ser para situaciones donde alguien podría hacer VARIAS cosas al mismo tiempo (ej: rutinas, hábitos, formas de extrañar).

EJEMPLOS de buenas preguntas:
- "Cuando llevamos días sin vernos y por fin nos llamamos, lo primero que hago es..."
- "¿Cuál de estas cosas hago cuando extraño a mi pareja y no quiero decirlo?"
- "Si pudiéramos pasar un fin de semana juntos sin planear nada, yo terminaría..."

Aproximadamente el 30-40% deben permitir selección múltiple (campo multiSelect: true) para preguntas donde elegir varias opciones tiene sentido.

Responde ÚNICAMENTE con un array JSON estricto con este formato:
[
  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": false },
  { "question": "...", "options": ["opción A", "opción B", "opción C", "opción D", "opción E"], "multiSelect": true },
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
