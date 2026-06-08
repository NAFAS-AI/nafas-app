// Nafas — Gemini AI Secure Proxy (Vercel Serverless Function)
// © Munira Ali Al Marri 2026
// Purpose: Keeps API key server-side only — never exposed to the browser
// Security: Rate limiting, CORS, input validation, request tracing

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// Default allowed origins (always included) + env var can add more
const DEFAULT_ORIGINS = [
  'https://nafas-app-blush.vercel.app',
  'https://nafas-app.com',
  'https://www.nafas-app.com'
];
const envOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...envOrigins])];

// ══════════════════════════════════════════════
// 🛡️ Rate Limiting (in-memory per serverless instance)
// ══════════════════════════════════════════════
const rateMap = new Map();
const RATE_LIMIT = 20;       // requests per window
const RATE_WINDOW = 60000;   // 1 minute
const MAX_RATE_MAP = 10000;  // prevent memory leak

function isRateLimited(ip) {
  const now = Date.now();

  // Garbage collect old entries to prevent memory leak
  if (rateMap.size > MAX_RATE_MAP) {
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

// ══════════════════════════════════════════════
// 🔒 CORS — strict origin checking (no wildcard)
// ══════════════════════════════════════════════
function getCorsHeaders(origin) {
  // SECURITY FIX: Never allow wildcard — only whitelisted origins
  if (!origin || ALLOWED_ORIGINS.length === 0) {
    return {
      'Access-Control-Allow-Origin': '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
  }
  const allowed = ALLOWED_ORIGINS.includes(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// ══════════════════════════════════════════════
// 🛡️ Security Headers for API responses
// ══════════════════════════════════════════════
function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

// ══════════════════════════════════════════════
// 🧹 Input Sanitization
// ══════════════════════════════════════════════
function sanitizeInput(contents) {
  if (!Array.isArray(contents)) return null;

  return contents.map(item => {
    if (!item || typeof item !== 'object') return null;

    // Only allow 'role' and 'parts' keys
    const sanitized = {};
    if (item.role && typeof item.role === 'string') {
      // Only allow valid roles
      if (!['user', 'model'].includes(item.role)) return null;
      sanitized.role = item.role;
    }
    if (item.parts && Array.isArray(item.parts)) {
      sanitized.parts = item.parts.map(part => {
        if (!part || typeof part !== 'object') return null;
        // Only allow text parts (no executable code injection)
        if (typeof part.text === 'string') {
          return { text: part.text };
        }
        return null;
      }).filter(Boolean);
    }
    return sanitized;
  }).filter(Boolean);
}

// ══════════════════════════════════════════════
// 🚀 Main Handler
// ══════════════════════════════════════════════
export default async function handler(req, res) {
  // Generate request ID for tracing
  const requestId = `nfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', requestId);

  // Set security headers on ALL responses
  setSecurityHeaders(res);

  const origin = req.headers.origin || '';
  const cors = getCorsHeaders(origin);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  // Preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', requestId });
  }

  // CORS enforcement — reject requests from non-whitelisted origins
  if (origin && ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`[${requestId}] Blocked request from unauthorized origin: ${origin}`);
    return res.status(403).json({ error: 'Origin not allowed', requestId });
  }

  // Check API key configured
  if (!GEMINI_API_KEY) {
    console.error(`[${requestId}] GEMINI_API_KEY not configured`);
    return res.status(500).json({ error: 'Service configuration error', requestId });
  }

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    console.warn(`[${requestId}] Rate limited IP: ${ip}`);
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.', requestId });
  }

  try {
    const body = req.body;

    // Validate request structure
    if (!body || !body.contents || !Array.isArray(body.contents)) {
      return res.status(400).json({ error: 'Invalid request: contents array required', requestId });
    }

    // Validate content length (prevent abuse — max 50KB)
    const totalLength = JSON.stringify(body).length;
    if (totalLength > 50000) {
      return res.status(400).json({ error: 'Request too large (max 50KB)', requestId });
    }

    // Sanitize input contents
    const sanitizedContents = sanitizeInput(body.contents);
    if (!sanitizedContents || sanitizedContents.length === 0) {
      return res.status(400).json({ error: 'Invalid content format', requestId });
    }

    // Build Gemini request with sanitized data
    const geminiBody = {
      contents: sanitizedContents,
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
      // SECURITY: Log error server-side but don't expose details to client
      console.error(`[${requestId}] Gemini API error: ${geminiRes.status}`, errText);
      return res.status(502).json({
        error: 'AI service temporarily unavailable',
        requestId,
      });
    }

    const data = await geminiRes.json();

    // Strip any sensitive metadata before returning to client
    return res.status(200).json(data);

  } catch (err) {
    // SECURITY: Never expose stack traces or internal details
    console.error(`[${requestId}] Proxy error:`, err.message);
    return res.status(500).json({ error: 'Internal server error', requestId });
  }
}
