import http from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8090;

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
                const { topic, category, usedQuestions = [] } = JSON.parse(body);
                
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

                const geminiReqBody = JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        responseMimeType: "application/json"
                    }
                });

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
                
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
