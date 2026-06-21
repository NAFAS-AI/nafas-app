/* ============================================================
   NAFAS TTS API — Text-to-Speech Proxy
   POST /api/tts
   
   Security: Server-side API key, rate limiting, CORS restricted
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

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'rUaPbzcZIu8df8iNL9WZ';

  if (!apiKey) {
    return res.status(200).json({ 
      fallback: true, 
      message: 'TTS not configured — using browser voice' 
    });
  }

  // Debug endpoint — GET /api/tts?debug=1 to check config
  if (req.method === 'GET' && req.query?.debug === '1') {
    return res.status(200).json({
      voiceId,
      hasKey: !!apiKey,
      keyPrefix: apiKey ? apiKey.substring(0, 4) + '...' : null
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
      .replace(/<[^>]*>/g, '')
      .replace(/[*_~`#]/g, '')
      .trim();

    if (!cleanText) {
      return res.status(200).json({ fallback: true, message: 'No speakable text' });
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.65,
            similarity_boost: 0.80,
            style: 0.35,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('ElevenLabs error:', response.status, errBody);
      return res.status(200).json({ 
        fallback: true, 
        message: 'TTS service error',
        debug_status: response.status,
        debug_error: errBody.substring(0, 200)
      });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    const buffer = Buffer.from(await response.arrayBuffer());
    return res.status(200).send(buffer);

  } catch (error) {
    console.error('TTS proxy error:', error.message);
    return res.status(200).json({ fallback: true, message: 'TTS error' });
  }
}
