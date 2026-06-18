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

  const prompt = `Genera exactamente 10 preguntas de opción múltiple para un juego de parejas sobre el tema "${topic}" (Categoría: ${category}). ${exclusionText}
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
        return res.status(500).json({ error: data.error.message });
    }

    let jsonString = data.candidates[0].content.parts[0].text;
    jsonString = jsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const questions = JSON.parse(jsonString);
    return res.status(200).json(questions);
  } catch (error) {
    console.error("Error in serverless generate function:", error);
    return res.status(500).json({ error: 'Error generating questions' });
  }
}
