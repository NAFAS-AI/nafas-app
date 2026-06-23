/* ============================================================
   NAFAS — Munsit Faseeh TTS endpoint (api/tts.js)
   Voice: Munira (cloned) — dq4b0twyF5F4fJPWjHjjI5Zd
   Docs: https://docs.munsit.com/api-reference/text-to-speech-post
   NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
   ============================================================ */

// ── Rate Limiting ──
const rateLimitMap = new Map();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 1000;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now - record.start > RATE_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return true;
  }
  record.count++;
  return record.count <= RATE_LIMIT;
}

// ── Allowed Origins ──
const ALLOWED_ORIGINS = [
  'https://nafas-app.com',
  'https://www.nafas-app.com',
  'https://nafas-app-blush.vercel.app'
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (!origin) return ALLOWED_ORIGINS[0];
  return '';
}

const MAX_TEXT_LENGTH = 1000;

module.exports = async (req, res) => {
  // ── CORS ──
  const allowedOrigin = getCorsOrigin(req);
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Rate Limit ──
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const MUNSIT_KEY = process.env.MUNSIT_API_KEY;
  const VOICE_ID = process.env.MUNSIT_VOICE_ID || 'dq4b0twyF5F4fJPWjHjjI5Zd'; // Munira

  if (!MUNSIT_KEY) return res.status(500).json({ error: 'Service unavailable' });

  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Missing text' });

    // Keep tashkeel (diacritics) intact — do NOT strip them
    const sanitizedText = String(text).slice(0, MAX_TEXT_LENGTH);
    if (sanitizedText.length === 0) {
      return res.status(400).json({ error: 'Empty text' });
    }

    // ── Munsit Faseeh TTS API ──
    const ttsRes = await fetch('https://api.munsit.com/api/v1/text-to-speech/faseeh-v1-preview', {
      method: 'POST',
      headers: {
        'x-api-key': MUNSIT_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        voice_id: VOICE_ID,
        text: sanitizedText,
        stability: 0.5,
        speed: 1.0,
        streaming: false
      })
    });

    if (!ttsRes.ok) {
      const errBody = await ttsRes.text().catch(() => '');
      console.error('Munsit TTS error:', ttsRes.status, errBody);
      return res.status(500).json({ error: 'Speech service unavailable' });
    }

    // Response is WAV audio directly
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(audioBuffer);

  } catch (err) {
    console.error('TTS API error:', err.message);
    return res.status(500).json({ error: 'Speech service error' });
  }
};
