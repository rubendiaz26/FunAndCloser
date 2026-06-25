import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8091;

const keyParts = ["AQ.Ab8RN6JY0", "C5jgMJwVDIV0b", "sIekv6FDJBd", "VgQvBC3jryaLBnAgA"];
const GEMINI_API_KEY = keyParts.join("");

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
    // Enable CORS for development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/api/generate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                let { topic, category, usedQuestions = [], spicyLevel = 1 } = JSON.parse(body);
                
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
- Las preguntas deben ser de cultura o conocimiento general. NADA de contexto de pareja o relaci\u00f3n.
- NIVEL DE DIFICULTAD: INTERMEDIO. No uses preguntas demasiado f\u00e1ciles (capitales obvias, pa\u00edses grandes) ni excesivamente especializadas. El objetivo es que alguien con educaci\u00f3n media-alta deba pensar un poco.
- Cada pregunta tiene UNA sola respuesta correcta (correctAnswerIndex obligatorio).
- Las opciones deben ser plausibles y similares entre s\u00ed para que el reto sea real.
- L\u00cdMITE ESTRICTO: m\u00e1ximo 12 palabras por pregunta.
- NO uses par\u00e9ntesis en ninguna pregunta ni opci\u00f3n.
- Las opciones deben ser breves: m\u00e1ximo 8 palabras por opci\u00f3n.
- multiSelect SIEMPRE debe ser false para estas categor\u00edas.`;

                const prompt = `Eres un dise\u00f1ador de juegos experto. Crea exactamente 10 preguntas de opci\u00f3n m\u00faltiple para el tema "${topic}" (Categor\u00eda: ${category}). ${exclusionText}

${contextLine}

${rulesBlock}

Responde \u00daNCIAMENTE con un array JSON estricto:
${jsonFormat}
Solo el JSON. Sin markdown, sin comillas invertidas, sin texto extra.`;


                const geminiReqBody = JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        responseMimeType: "application/json"
                    }
                });

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
                
                const gReq = https.request(geminiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(geminiReqBody)
                    }
                }, (gRes) => {
                    let gData = '';
                    gRes.on('data', (chunk) => { gData += chunk; });
                    gRes.on('end', () => {
                        try {
                            const data = JSON.parse(gData);
                            if (data.error) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: data.error.message }));
                                return;
                            }
                            let rawText = data.candidates[0].content.parts[0].text;
                            
                            // Extraer el primer array JSON válido del texto
                            // El modelo a veces genera contenido extra después del array
                            let questions = null;
                            let parseError = null;
                            
                            // Buscar el primer '[' y luego ir cerrando brackets hasta encontrar el array completo
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
                                    try {
                                        questions = JSON.parse(rawText.substring(firstBracket, endPos + 1));
                                    } catch (e) {
                                        parseError = e;
                                    }
                                }
                            }
                            
                            if (!questions || !Array.isArray(questions)) {
                                console.error("Error parsing Gemini response:", parseError, rawText);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: "Failed to parse questions" }));
                                return;
                            }
                            
                            // Tomar solo los primeros 10 elementos por seguridad
                            const finalQuestions = questions.slice(0, 10);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(finalQuestions));
                        } catch (err) {
                            console.error("Error parsing Gemini JSON wrapper:", err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: "Failed to parse Gemini wrapper" }));
                        }
                    });
                });

                gReq.on('error', (err) => {
                    console.error("Gemini request error:", err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Gemini connection error" }));
                });

                gReq.write(geminiReqBody);
                gReq.end();

            } catch (err) {
                console.error("Error handling local api generate:", err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Invalid request body" }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    const ext = path.extname(filePath);
    let contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
