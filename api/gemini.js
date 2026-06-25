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

// ── Phase 4/5/6: Load Enriched Context ──
async function loadEnrichedContext(visitorId, profileData) {
  const ctx = { profile: profileData };

  if (!visitorId || !SUPABASE_KEY) return ctx;

  try {
    // Parallel fetch all enrichment data
    const [summaries, vocabulary, techniques, selfKnowledge, insights] = await Promise.all([
      // Phase 4: Last 5 session summaries for this user
      supabaseFetch(
        'nafas_session_summaries?visitor_id=eq.' + encodeURIComponent(visitorId) +
        '&order=created_at.desc&limit=5',
        'GET'
      ).catch(() => null),

      // Phase 5: Learned vocabulary (most frequent, active only)
      supabaseFetch(
        'nafas_learned_vocabulary?active=eq.true&order=frequency.desc&limit=30',
        'GET'
      ).catch(() => null),

      // Phase 5: Top techniques by effectiveness for user's topics
      supabaseFetch(
        'nafas_technique_effectiveness?effectiveness_score=gte.0.3&order=effectiveness_score.desc&limit=10',
        'GET'
      ).catch(() => null),

      // Phase 6: Active self-knowledge
      supabaseFetch(
        'nafas_self_knowledge?active=eq.true&order=confidence.desc&limit=10',
        'GET'
      ).catch(() => null),

      // Phase 6: Active collective insights
      supabaseFetch(
        'nafas_collective_insights?active=eq.true&order=confidence.desc&limit=5',
        'GET'
      ).catch(() => null)
    ]);

    if (Array.isArray(summaries) && summaries.length > 0) ctx.sessionSummaries = summaries;
    if (Array.isArray(vocabulary) && vocabulary.length > 0) ctx.learnedVocabulary = vocabulary;
    if (Array.isArray(techniques) && techniques.length > 0) ctx.techniqueRecommendations = techniques;
    if (Array.isArray(selfKnowledge) && selfKnowledge.length > 0) ctx.selfKnowledge = selfKnowledge;
    if (Array.isArray(insights) && insights.length > 0) ctx.collectiveInsights = insights;
  } catch (e) {
    console.warn('Enriched context load partial failure:', e.message);
  }

  return ctx;
}

// ── Phase 4: Log Conversation Exchange ──
async function logConversation(visitorId, sessionId, userText, modelText) {
  if (!visitorId || !sessionId || !SUPABASE_KEY) return;
  try {
    const entries = [];
    if (userText) entries.push({ visitor_id: visitorId, session_id: sessionId, role: 'user', message_text: userText.slice(0, 2000) });
    if (modelText) entries.push({ visitor_id: visitorId, session_id: sessionId, role: 'model', message_text: modelText.slice(0, 2000) });
    if (entries.length > 0) {
      await supabaseFetch('nafas_conversation_log', 'POST', entries);
    }
  } catch (e) { /* non-critical */ }
}

function buildSystemInstruction(mode, deepStep, typingPattern, typingMood, enrichedContext) {
  // Phase 4/5/6: Use enriched context for dynamic prompt
  let instruction = buildFullPrompt(enrichedContext);

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
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 50) : '';

    // ── Fetch user profile from Supabase ──
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
      'burnout': /احتراق|منهك|طاقت|بطارية/,
      'grief': /توفى|فقدت|الله يرحم|واحشني|موت/,
      'health': /مرض|عملية|مستشفى|دكتور|علاج/,
      'identity': /مين أنا|ما أعرف نفسي|ضايع|هوية/
    };
    let detectedName = null;
    let latestUserText = '';
    for (const msg of sanitizedContents) {
      if (msg.role === 'user' && msg.parts) {
        for (const p of msg.parts) {
          if (p.text) {
            latestUserText = p.text;
            const g = detectGenderFromText(p.text);
            if (g) detectedGender = g;
            for (const [topic, re] of Object.entries(topicPatterns)) {
              if (re.test(p.text) && !detectedTopics.includes(topic)) {
                detectedTopics.push(topic);
              }
            }
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

    // ── Phase 4/5/6: Load Enriched Context ──
    let enrichedContext = { profile: profileData };
    if (visitorId) {
      enrichedContext = await loadEnrichedContext(visitorId, profileData).catch(() => ({ profile: profileData }));
    }

    const geminiBody = {
      system_instruction: buildSystemInstruction(mode, deepStep, typingPattern, typingMood, enrichedContext),
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

    // ── Update profile + log conversation (non-blocking) ──
    let modelResponseText = '';
    if (visitorId && profileData) {
      try {
        // Extract mood & techniques from response
        let mood = '';
        let techniques = [];
        if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          try {
            const parsed = JSON.parse(geminiData.candidates[0].content.parts[0].text);
            mood = parsed.mood || '';
            modelResponseText = parsed.response || '';
            // Detect techniques used in response
            const respText = modelResponseText;
            if (/نفس عميق|تنفس|4-7-8/.test(respText)) techniques.push('breathing');
            if (/تخيّل|تصور|لو صحيت/.test(respText)) techniques.push('visualization');
            if (/صديق|لو صاحب/.test(respText)) techniques.push('reframe');
            if (/أسمع|هنا معا?ك|هنا معاش/.test(respText)) techniques.push('empathy');
            if (/لاحظت|ذكرت/.test(respText)) techniques.push('reflection');
            if (/سؤال|إيش|شلون|ليش/.test(respText)) techniques.push('socratic');
            if (/قوة|شجاعة|بطل/.test(respText)) techniques.push('strength_finding');
            if (/5 أشياء|تأريض|حولك/.test(respText)) techniques.push('grounding');
            if (/اكتب|سجّل|يوميات/.test(respText)) techniques.push('journaling');
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

        // Phase 4: Log conversation exchange
        if (sessionId && latestUserText) {
          logConversation(visitorId, sessionId, latestUserText, modelResponseText)
            .catch(e => console.warn('Convo log failed:', e.message));
        }
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
