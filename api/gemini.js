// Nafas — Gemini AI Secure Proxy with Memory System (Vercel Serverless Function)
// © Munira Ali Al Marri 2026
// Security: Rate limiting, CORS, input validation, safety filters, prompt protection
// Memory: User profiles stored in Supabase for personalization across sessions

import { buildFullPrompt, MODE_INSTRUCTIONS } from './_nafas_prompt.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DEFAULT_ORIGINS = [
  'https://nafas-app-blush.vercel.app',
  'https://nafas-app.com',
  'https://www.nafas-app.com'
];
const envOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...envOrigins])];

// ── Supabase Config ──
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sqpbusodwdjtlgaxrreg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcGJ1c29kd2RqdGxnYXhycmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTQ2MDksImV4cCI6MjA5NTE5MDYwOX0.bglpaNzXgU4ufK7fuu5wMcvE6XYepD318C7mO54ML7I';

async function supabaseFetch(path, method, body) {
  if (!SUPABASE_KEY) return null;
  const opts = {
    method: method || 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation,resolution=merge-duplicates' : 'return=representation'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function getProfile(visitorId) {
  if (!visitorId || !SUPABASE_KEY) return null;
  const data = await supabaseFetch(
    'nafas_user_profiles?visitor_id=eq.' + encodeURIComponent(visitorId) + '&limit=1',
    'GET'
  );
  return (Array.isArray(data) && data.length > 0) ? data[0] : null;
}

async function upsertProfile(profile) {
  if (!profile || !profile.visitor_id || !SUPABASE_KEY) return;
  profile.updated_at = new Date().toISOString();
  await supabaseFetch('nafas_user_profiles', 'POST', profile);
}

// ── Gender Detection ──
function detectGenderFromText(text) {
  if (!text) return null;
  const femaleMarkers = /تعبان[ةه]|محتاج[ةه]|زعلان[ةه]|خايف[ةه]|حاس[ةه]|مقهور[ةه]|ضايق[ةه]|أنا بنت|حامل|أم |أمي أنا|حامل[ةه]|مطلق[ةه]|متزوج[ةه]|عزباء|زوجي |ريلي |يخليني متعب[ةه]|خلين[يى]/;
  const maleMarkers = /تعبان(?!ة)|محتاج(?!ة)|زعلان(?!ة)|خايف(?!ة)|حاس(?!ة)|مقهور(?!ة)|ضايق(?!ة)|أنا ولد|أنا رجال|أبوي|زوجتي|مطلق(?!ة)|متزوج(?!ة)|أعزب/;
  if (femaleMarkers.test(text)) return 'female';
  if (maleMarkers.test(text)) return 'male';
  return null;
}

// ── Rate Limiting ──
const rateMap = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60000;
const MAX_RATE_MAP = 10000;

function isRateLimited(ip) {
  const now = Date.now();
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

function getCorsHeaders(origin) {
  if (!origin || ALLOWED_ORIGINS.length === 0) {
    return {
      'Access-Control-Allow-Origin': '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
  }
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
}

function sanitizeInput(contents) {
  if (!Array.isArray(contents)) return null;
  return contents.map(item => {
    if (!item || typeof item !== 'object') return null;
    const sanitized = {};
    if (item.role && typeof item.role === 'string') {
      if (!['user', 'model'].includes(item.role)) return null;
      sanitized.role = item.role;
    }
    if (item.parts && Array.isArray(item.parts)) {
      sanitized.parts = item.parts.map(part => {
        if (!part || typeof part !== 'object') return null;
        if (typeof part.text === 'string') return { text: part.text };
        return null;
      }).filter(Boolean);
    }
    return sanitized;
  }).filter(Boolean);
}

function buildSystemInstruction(mode, deepStep, typingPattern, typingMood, profileData) {
  // Use buildFullPrompt to inject user profile into the prompt
  let instruction = buildFullPrompt(profileData);

  if (mode === 'quick') {
    instruction += MODE_INSTRUCTIONS.quick;
  } else if (mode === 'deep') {
    const qNum = (deepStep || 0) + 1;
    instruction += qNum > 5 ? MODE_INSTRUCTIONS.deep_final : MODE_INSTRUCTIONS.deep_asking(qNum);
  } else if (mode === 'vent') {
    instruction += MODE_INSTRUCTIONS.vent;
  }
  if (typingPattern && typingMood) {
    instruction += `\n\nUser typing pattern: ${typingPattern}, mood indicator: ${typingMood}`;
  }
  return { parts: [{ text: instruction }] };
}

export default async function handler(req, res) {
  const requestId = `nfs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  res.setHeader('X-Request-Id', requestId);
  setSecurityHeaders(res);

  const origin = req.headers.origin || '';
  const cors = getCorsHeaders(origin);
  Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed', requestId });

  if (origin && ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`[${requestId}] Blocked origin: ${origin}`);
    return res.status(403).json({ error: 'Origin not allowed', requestId });
  }

  if (!GEMINI_API_KEY) {
    console.error(`[${requestId}] GEMINI_API_KEY not configured`);
    return res.status(500).json({ error: 'Service configuration error', requestId });
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.', requestId });
  }

  try {
    const body = req.body;
    if (!body || !body.contents || !Array.isArray(body.contents)) {
      return res.status(400).json({ error: 'Invalid request: contents array required', requestId });
    }
    if (JSON.stringify(body).length > 50000) {
      return res.status(400).json({ error: 'Request too large (max 50KB)', requestId });
    }

    const sanitizedContents = sanitizeInput(body.contents);
    if (!sanitizedContents || sanitizedContents.length === 0) {
      return res.status(400).json({ error: 'Invalid content format', requestId });
    }

    const mode = typeof body.mode === 'string' ? body.mode : '';
    const deepStep = typeof body.deepStep === 'number' ? body.deepStep : 0;
    const typingPattern = typeof body.typingPattern === 'string' ? body.typingPattern.slice(0, 100) : '';
    const typingMood = typeof body.typingMood === 'string' ? body.typingMood.slice(0, 50) : '';
    const visitorId = typeof body.visitorId === 'string' ? body.visitorId.slice(0, 50) : '';

    // ── Fetch user profile from Supabase (non-blocking if fails) ──
    let profileData = null;
    if (visitorId) {
      profileData = await getProfile(visitorId).catch(() => null);
    }

    // ── Auto-detect gender & topics from user messages ──
    let detectedGender = null;
    let detectedTopics = [];
    const topicPatterns = {
      'work': /شغل|عمل|مدير|وظيفة|راتب|مكتب|اجتماع|دوام/,
      'family': /أهل|عائلة|أبوي|أمي|أخوي|أختي|ريلي|زوج/,
      'relationship': /حب|علاقة|صاحب|صاحبة|كراش|خان|غوست/,
      'study': /دراسة|امتحان|جامعة|مدرسة|واجب|منهج/,
      'sleep': /نوم|أرق|سهر|ما أنام|أنام/,
      'anxiety': /قلق|خوف|وسواس|هلع|بانيك/,
      'loneliness': /وحد|محد|وحيد|عزلة/,
      'burnout': /احتراق|منهك|طاقت|بطارية/
    };
    let detectedName = null;
    for (const msg of sanitizedContents) {
      if (msg.role === 'user' && msg.parts) {
        for (const p of msg.parts) {
          if (p.text) {
            const g = detectGenderFromText(p.text);
            if (g) detectedGender = g;
            // Detect topics
            for (const [topic, re] of Object.entries(topicPatterns)) {
              if (re.test(p.text) && !detectedTopics.includes(topic)) {
                detectedTopics.push(topic);
              }
            }
            // Detect name
            const nameMatch = p.text.match(/(?:أنا\s+اسمي|اسمي|أنا)\s+([^\s,،.!؟?]{2,15})/);
            if (nameMatch) {
              const excluded = ['بخير','تمام','تعبان','تعبانة','تعبانه','محتاج','محتاجة','زعلان','هنا','مو','مب','ما','بس','حاسه','حاسة'];
              if (!excluded.includes(nameMatch[1])) detectedName = nameMatch[1];
            }
          }
        }
      }
    }

    // Update profile with detected gender if new
    if (detectedGender && profileData && profileData.gender === 'unknown') {
      profileData.gender = detectedGender;
    }
    // Create profile if not exists
    if (!profileData && visitorId) {
      profileData = {
        visitor_id: visitorId,
        gender: detectedGender || 'unknown',
        session_count: 1,
        dialect: 'khaleeji'
      };
    }

    // ── Phase 2: Inject learning data into profile ──
    if (profileData) {
      // Fetch top collective patterns for user's topics (Phase 3)
      try {
        const topicStr = (profileData.topics || detectedTopics || []).slice(0, 3).join(',');
        if (topicStr) {
          const patterns = await supabaseFetch(
            'nafas_technique_patterns?topic=in.(' + encodeURIComponent(topicStr) + ',general)&avg_rating=gte.3.5&order=avg_rating.desc&limit=5',
            'GET'
          ).catch(() => null);
          if (Array.isArray(patterns) && patterns.length > 0) {
            profileData._collective_insights = patterns.map(p =>
              p.technique + ' (نجاح ' + Math.round(p.avg_rating * 20) + '% في موضوع ' + p.topic + ')'
            );
          }
        }
      } catch(e) {}
    }

    const geminiBody = {
      system_instruction: buildSystemInstruction(mode, deepStep, typingPattern, typingMood, profileData),
      contents: sanitizedContents,
      generationConfig: {
        temperature: 0.85,
        topP: 0.95,
        maxOutputTokens: 400,
        responseMimeType: 'application/json'
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error(`[${requestId}] Gemini error: ${geminiRes.status}`, errText);
      return res.status(502).json({ error: 'AI service temporarily unavailable', requestId });
    }

    const geminiData = await geminiRes.json();

    // ── Update profile asynchronously (non-blocking) ──
    if (visitorId && profileData) {
      try {
        // Extract mood & techniques from response
        let mood = '';
        let techniques = [];
        if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          try {
            const parsed = JSON.parse(geminiData.candidates[0].content.parts[0].text);
            mood = parsed.mood || '';
            // Detect techniques used in response
            const respText = parsed.response || '';
            if (/نفس عميق|تنفس|4-7-8/.test(respText)) techniques.push('breathing');
            if (/تخيّل|تصور|لو صحيت/.test(respText)) techniques.push('visualization');
            if (/صديق|لو صاحب/.test(respText)) techniques.push('reframe');
            if (/أسمع|هنا معا?ك|هنا معاش/.test(respText)) techniques.push('empathy');
            if (/لاحظت|ذكرت/.test(respText)) techniques.push('reflection');
            if (/سؤال|إيش|شلون|ليش/.test(respText)) techniques.push('socratic');
            if (/قوة|شجاعة|بطل/.test(respText)) techniques.push('strength_finding');
          } catch (e) { /* ignore */ }
        }

        // Merge topics (existing + new detected)
        const existingTopics = profileData.topics || [];
        const mergedTopics = [...new Set([...existingTopics, ...detectedTopics])].slice(-15);

        const isFirstMessage = sanitizedContents.filter(m => m.role === 'user').length === 1;
        const updateData = {
          visitor_id: visitorId,
          gender: detectedGender || profileData.gender || 'unknown',
          dialect: profileData.dialect || 'khaleeji',
          session_count: (profileData.session_count || 0) + (isFirstMessage ? 1 : 0),
          total_sessions: (profileData.total_sessions || 0) + (isFirstMessage ? 1 : 0),
          last_mood: mood || profileData.last_mood || '',
          display_name: detectedName || profileData.display_name || '',
          corrections: profileData.corrections || [],
          topics: mergedTopics,
          preferences: profileData.preferences || {},
          personality_notes: profileData.personality_notes || '',
          effective_techniques: profileData.effective_techniques || [],
          avg_rating: profileData.avg_rating || 0
        };

        // Fire-and-forget — don't block response
        upsertProfile(updateData).catch(e => console.warn('Profile update failed:', e.message));
      } catch (e) {
        // Non-critical — don't affect the response
      }
    }

    return res.status(200).json(geminiData);
  } catch (err) {
    console.error(`[${requestId}] Proxy error:`, err.message);
    return res.status(500).json({ error: 'Internal server error', requestId });
  }
}
