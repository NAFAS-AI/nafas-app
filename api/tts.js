/* ============================================================
   NAFAS TTS API — Text-to-Speech Proxy
   POST /api/tts
   
   Pipeline: Clean text → Gemini diacritization → Faseeh TTS (Munsit)
   Voice: Munira — Authentic Emirati Female Arabic
   Security: Server-side API keys, rate limiting, CORS restricted
   © Munira Ali Al Marri 2026 — NAFAS FOR ARTIFICIAL INTELLIGENCE
   ============================================================ */

const DEFAULT_ORIGINS = [
  'https://nafas-app-blush.vercel.app',
  'https://nafas-app.com',
  'https://www.nafas-app.com'
];
const envOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...envOrigins])];

const rateMap = new Map();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60000;

function isRateLimited(ip) {
  const now = Date.now();
  if (rateMap.size > 5000) {
    for (const [key, val] of rateMap) {
      if (now - val.start > RATE_WINDOW) rateMap.delete(key);
    }
  }
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

/* --------------------------------------------------------
   Gemini Diacritization — adds tashkeel for accurate TTS
   -------------------------------------------------------- */
async function addDiacritics(text) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return text; // fallback: use original text

  try {
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `أضف التشكيل الكامل (الفتحة، الضمة، الكسرة، السكون، الشدة، التنوين) على النص العربي التالي. أرجع النص المشكَّل فقط بدون أي شرح أو إضافات. إذا كان النص يحتوي كلمات غير عربية، اتركها كما هي.\n\nالنص:\n${text}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Gemini diacritics error:', response.status);
      return text;
    }

    const data = await response.json();
    const diacritized = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    // Sanity check: result should be similar length (diacritics add ~50-80% chars)
    if (diacritized && diacritized.length >= text.length * 0.8 && diacritized.length <= text.length * 3) {
      return diacritized;
    }
    return text;
  } catch (err) {
    console.error('Diacritization error:', err.message);
    return text;
  }
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-store');

  const origin = req.headers.origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const munsitKey = process.env.MUNSIT_API_KEY;
  const voiceId = process.env.MUNSIT_VOICE_ID || 'dq4b0twyF5F4fJPWjHjjI5Zd'; // Munira

  if (!munsitKey) {
    return res.status(200).json({ 
      fallback: true, 
      message: 'TTS not configured — using browser voice' 
    });
  }

  try {
    const { text, lang } = req.body || {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length > 2000) {
      return res.status(400).json({ error: 'Text too long (max 2000 chars)' });
    }

    const cleanText = text
      .replace(/<[^>]*>/g, '')           // Remove HTML
      .replace(/[*_~`#]/g, '')           // Remove markdown
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2702}-\u{27B0}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '')  // Strip emojis
      .replace(/\.{2,}/g, '\u060C')      // ... to Arabic comma
      .replace(/\s{2,}/g, ' ')           // Collapse whitespace
      .trim();

    if (!cleanText) {
      return res.status(200).json({ fallback: true, message: 'No speakable text' });
    }

    // Step 1: Add diacritics via Gemini (hidden — not shown in UI)
    const diacritizedText = await addDiacritics(cleanText);

    // Step 2: Send diacritized text to Faseeh TTS (Munsit)
    const ttsResponse = await fetch('https://api.fasihtts.com/v1/tts', {
      method: 'POST',
      headers: {
        'x-api-key': munsitKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: diacritizedText,
        voice: voiceId,
        styleInstruction: 'Calm, warm, empathetic therapeutic tone. Speak gently and reassuringly.'
      })
    });

    if (!ttsResponse.ok) {
      const errBody = await ttsResponse.text().catch(() => '');
      console.error('Faseeh TTS error:', ttsResponse.status, errBody);
      return res.status(200).json({ fallback: true, message: 'TTS service error' });
    }

    const data = await ttsResponse.json();

    if (!data.audioContent) {
      console.error('Faseeh TTS: no audioContent in response');
      return res.status(200).json({ fallback: true, message: 'TTS error' });
    }

    // Decode base64 audio and send
    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    const format = data.format || 'mp3';

    res.setHeader('Content-Type', format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    return res.status(200).send(audioBuffer);

  } catch (error) {
    console.error('TTS proxy error:', error.message);
    return res.status(200).json({ fallback: true, message: 'TTS error' });
  }
}
