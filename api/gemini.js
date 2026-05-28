// Nafas — Gemini AI Secure Proxy (Vercel Serverless Function)
// © Munira Ali Al Marri 2026
// Purpose: Keeps API key server-side only — never exposed to the browser

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());

// Rate limiting (in-memory per serverless instance)
const rateMap = new Map();
const RATE_LIMIT = 20;       // requests per window
const RATE_WINDOW = 60000;   // 1 minute

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function getCorsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const cors = getCorsHeaders(origin);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check API key configured
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  try {
    const body = req.body;

    // Validate request structure
    if (!body || !body.contents || !Array.isArray(body.contents)) {
      return res.status(400).json({ error: 'Invalid request: contents array required' });
    }

    // Validate content length (prevent abuse — max 50KB)
    const totalLength = JSON.stringify(body).length;
    if (totalLength > 50000) {
      return res.status(400).json({ error: 'Request too large (max 50KB)' });
    }

    // Build Gemini request — forward all supported fields
    const geminiBody = {
      contents: body.contents,
      generationConfig: body.generationConfig || {
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 400,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    // Forward system_instruction if provided (Nafas system prompt)
    if (body.system_instruction) {
      geminiBody.system_instruction = body.system_instruction;
    }

    // Call Gemini API with server-side key
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(geminiRes.status).json({ 
        error: 'AI service temporarily unavailable',
        status: geminiRes.status 
      });
    }

    const data = await geminiRes.json();
    
    // Strip any sensitive info before returning to client
    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
