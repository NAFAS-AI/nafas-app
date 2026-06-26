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

// ── Gender Detection (Fixed: female checked FIRST, negative lookahead for male) ──
function detectGenderFromText(text) {
  if (!text) return null;
  // Female markers MUST be checked FIRST — they contain ة/ه suffix
  const femaleMarkers = /تعبان[ةه]|محتاج[ةه]|زعلان[ةه]|خايف[ةه]|حاس[ةه]|مقهور[ةه]|ضايق[ةه]|مطفوق[ةه]|أنا بنت|أنا أم\b|أم ال|أمي أنا|حامل[ةه]|مطلق[ةه]|متزوج[ةه]|عزباء|زوجي\b|ريلي\b|يخليني متعب[ةه]|خلين[يى]/;
  // Male markers use negative lookahead (?![ةه]) to avoid matching inside feminine forms
  const maleMarkers = /تعبان(?![ةه])|محتاج(?![ةه])|زعلان(?![ةه])|خايف(?![ةه])|حاس(?![ةه])|مقهور(?![ةه])|ضايق(?![ةه])|مطفوق(?![ةه])|أنا ولد|أنا رجال|أبوي\b|زوجتي\b|حرمتي\b|مطلق(?![ةه])|متزوج(?![ةه])|أعزب/;
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
// ── Emotion Detection (code-level, not prompt-dependent) ──
const EMOTION_PATTERNS = {
  'sadness':     /حزين|حزن|أبكي|بكيت|دموع|كئيب|مكتئب|اكتئاب|ما أقدر أفرح/,
  'anxiety':     /قلق|خايف|خوف|هلع|بانيك|وسواس|توتر|متوتر|عصبي|أعصاب/,
  'anger':       /معصب|زعلان|مقهور|ظلم|ظالم|طفشت|طفش|مطفوق|كرهت|أكره/,
  'exhaustion':  /تعبان|منهك|طاقت|ما فيني|مب قادر|خلاص|احتراق|بطارية|مب طايق/,
  'loneliness':  /وحيد|وحدي|محد|عزلة|مفقود|ما أحد يهتم|ما أحد يسأل/,
  'confusion':   /ضايع|محتار|مب عارف|ما أعرف|مشوش|ما أدري/,
  'grief':       /فقدت|توفى|الله يرحم|واحشني|موت|مات|رحل/,
  'hope':        /أمل|إن شاء الله|بتحسن|أحسن|ارتحت|حمدلله|الحمدلله/,
  'gratitude':   /شكراً|مشكور|الله يعطيك|يزاك|حلو كلامك|ساعدتني/,
  'shame':       /خجل|عيب|حرام علي|ما أقدر أقول|سري|لو يدرون/
};

// ── Dialect Word Detection (new/slang words) ──
const KNOWN_DIALECT_WORDS = new Set([
  'مب','ابي','أبي','وايد','يعني','خلاص','شي','حيل','عاد','يالله',
  'هالشي','هالموضوع','حسيت','يعور','القلب','الخاطر','وياك','وياش'
]);

function extractNewWords(text) {
  if (!text || text.length < 5) return [];
  const words = [];
  // Detect potential new dialect/slang patterns
  const dialectPatterns = [
    { re: /(?:^|\s)([\u0600-\u06FF]{3,12})(?:\s|$)/g, type: 'arabic' },
  ];
  // Look for words with distinctive dialect markers
  const dialectMarkers = /ش$|چ|گ|ڤ|tion|ment|بيب[يى]|فايب|مود|فري|ديل|تريند|سيف|فايف|لايف|هايب|كيوت|ريلاكس|فلكس|كرنج|بايسك|تكسك|تروما/g;
  let match;
  while ((match = dialectMarkers.exec(text)) !== null) {
    const word = match[0].trim();
    if (word.length >= 2 && !KNOWN_DIALECT_WORDS.has(word)) {
      words.push(word);
    }
  }
  return [...new Set(words)].slice(0, 5);
}

function detectEmotions(text) {
  if (!text) return [];
  const detected = [];
  for (const [emotion, pattern] of Object.entries(EMOTION_PATTERNS)) {
    if (pattern.test(text)) detected.push(emotion);
  }
  return detected;
}

// ── Privacy-First Conversation Logging ──
// Saves ONLY classified features — NEVER raw text (Noor's decision: 26 June 2026)
async function logConversation(visitorId, sessionId, userText, modelText, techniqueUsed) {
  if (!visitorId || !SUPABASE_KEY) {
    console.warn('[LOG] Skipped — missing:', { visitorId: !!visitorId, key: !!SUPABASE_KEY });
    return;
  }
  const logSessionId = sessionId || ('auto_' + Date.now().toString(36));
  try {
    // Extract features from user text (NO raw text saved)
    const emotions = detectEmotions(userText);
    const topics = [];
    const topicPats = {
      'work': /شغل|عمل|مدير|وظيفة|راتب|مكتب|دوام/,
      'family': /أهل|عائلة|أبوي|أمي|أخوي|أختي|ريلي|زوج/,
      'relationship': /حب|علاقة|صاحب|صاحبة|كراش|خان|غوست/,
      'study': /دراسة|امتحان|جامعة|مدرسة|واجب/,
      'sleep': /نوم|أرق|سهر|ما أنام/,
      'health': /مرض|عملية|مستشفى|دكتور|علاج/,
      'identity': /مين أنا|ما أعرف نفسي|ضايع|هوية/,
      'grief': /توفى|فقدت|الله يرحم|واحشني/,
      'burnout': /احتراق|منهك|طاقت|بطارية/
    };
    for (const [topic, re] of Object.entries(topicPats)) {
      if (re.test(userText || '')) topics.push(topic);
    }

    // Detect new dialect/slang words
    const newWords = extractNewWords(userText);

    // Determine interaction quality
    const userLen = (userText || '').length;
    const interactionType = userLen < 10 ? 'short' : userLen < 80 ? 'medium' : 'detailed';

    // Save classified entry — NO message_text
    const entry = {
      visitor_id: visitorId,
      session_id: logSessionId,
      role: 'exchange',
      message_text: null,  // 🔐 Privacy: raw text NEVER saved
      detected_emotion: emotions.join(',') || null,
      detected_topics: topics
    };
    const result = await supabaseFetch('nafas_conversation_log', 'POST', [entry]);
    console.log('[LOG] Saved classified exchange for', visitorId, '→ emotions:', emotions, 'topics:', topics, result ? '✅' : '❌');

    // Save new dialect words to vocabulary table for learn.js
    if (newWords.length > 0) {
      for (const word of newWords) {
        await supabaseFetch('nafas_learned_vocabulary', 'POST', {
          word: word.slice(0, 50),
          meaning: '',
          dialect: 'auto_detected',
          category: 'pending_review',
          example_context: `Detected in session ${logSessionId}`,
          frequency: 1,
          confidence: 0.3
        }).catch(() => {});
      }
      console.log('[LOG] Saved', newWords.length, 'new words:', newWords);
    }

    return { emotions, topics, newWords, interactionType };
  } catch (e) {
    console.error('[LOG] Error:', e.message);
    return null;
  }
}

// ── PROGRAMMATIC SAFETY LAYER ──
// These run AFTER Gemini responds — they override any bad behavior

const CRISIS_KEYWORDS = [
  /ما فيها? فايدة/,
  /مب (طايق|طايقة|طايقه) روحي/,
  /مب قادر أكمل/,
  /مب قادر$/,
  /خلاص مب قادر/,
  /تعبت من الحياة/,
  /أبي (أرتاح|ارتاح) للأبد/,
  /أحسن لو ما كنت موجود/,
  /محد بيفتقدني/,
  /ودي أختفي/,
  /ما عندي سبب أعيش/,
  /أفكر أ[اأ]ذي نفسي/,
  /كل شي أسود/,
  /ما بقى شي فيني/,
  /الدنيا ما فيها فايدة/,
  /ما يهمني شي خلاص/,
  /ما يهمني شي$/,
  /حاس[ةه]? إني? غلطة/,
  /أبي أموت/,
  /أبي أنتحر/,
  /بس خلاص$/
];

const BANNED_PHRASES = [
  'عادي جداً',
  'فاهم المصطلح',
  'أشوف إنك تستخدم مصطلحات هالجيل',
  'مصطلحات هالجيل',
  'هذا موسم وبيعدي',
  'ليش جيت لنَفَس',
  'ليش جيت لنفس',
];

const BANNED_CRISIS_EMOJIS = ['😄', '😊', '😂', '🤣', '😁', '😆', '😀', '😃', '🙂'];

const CRISIS_HELPLINES = '\n\n💙 أنا وياك. وإذا حسيت إنك تحتاج أحد متخصص الحين:\n🇦🇪 خط نجدة الإمارات: 800-4673 (HOPE)\n🇦🇪 شرطة أبوظبي: 999\n🇸🇦 خط مساندة (السعودية): 920033360\n🌍 أو روح أقرب طوارئ — حياتك أهم شي 💙';

function detectCrisis(text) {
  if (!text) return false;
  return CRISIS_KEYWORDS.some(re => re.test(text));
}

function postProcessResponse(responseText, userText, profileData, detectedName) {
  let text = responseText;
  const isCrisis = detectCrisis(userText);
  const gender = profileData?.gender || 'unknown';
  const name = detectedName || profileData?.display_name || '';

  // 1. Remove banned phrases
  for (const phrase of BANNED_PHRASES) {
    if (text.includes(phrase)) {
      text = text.replace(phrase, '');
    }
  }

  // 2. Crisis: Remove happy emojis and append helplines
  if (isCrisis) {
    for (const emoji of BANNED_CRISIS_EMOJIS) {
      text = text.replaceAll(emoji, '💙');
    }
    // If helplines not already present, append them
    if (!text.includes('800') && !text.includes('920033360')) {
      text = text.trimEnd() + CRISIS_HELPLINES;
    }
  }

  // 3. Even without crisis — remove happy emojis from sad content
  const sadIndicators = /تعب|حزن|أصيح|بكاء|ألم|مكسور|مقهور|ضايق|خنق/;
  if (sadIndicators.test(userText)) {
    for (const emoji of ['😄', '😂', '🤣']) {
      text = text.replaceAll(emoji, '💙');
    }
  }

  // 4. Fix gender in response if known
  if (gender === 'female') {
    // Fix common masculine→feminine issues
    text = text
      .replace(/\bأنت\b(?!\s*[بت])/g, 'أنتِ')
      .replace(/\bتحمل\b/g, 'تحملين')
      .replace(/\bتقول\b(?!ي)/g, 'تقولين')
      .replace(/\bتستاهل\b/g, 'تستاهلين')
      .replace(/\bتقدر\b/g, 'تقدرين')
      .replace(/\bتبي\b(?!ن)/g, 'تبين')
      .replace(/\bعندك\b/g, 'عندش')
      .replace(/\bقلّي\b/g, 'قوليلي')
      .replace(/\bيا صديقي\b/g, 'يا صديقتي')
      .replace(/\bيا غالي\b(?!ة|ت)/g, 'يا غاليتي')
      .replace(/\bيا بطل\b(?!ة)/g, 'يا بطلة');
  } else if (gender === 'male') {
    // Fix common feminine→masculine issues  
    text = text
      .replace(/\bقولي\b/g, 'قلّي')
      .replace(/\bيا غاليتي\b/g, 'يا غالي')
      .replace(/\bيا صديقتي\b/g, 'يا صديقي');
  }

  // 5. Inject name if known but not present in response
  if (name && name.length >= 2 && !text.includes(name)) {
    // Add name at a natural point — beginning or after first sentence
    const firstPeriod = text.indexOf('💙');
    if (firstPeriod > 10 && firstPeriod < text.length - 5) {
      text = text.slice(0, firstPeriod) + ' يا ' + name + ' 💙' + text.slice(firstPeriod + 2);
    } else {
      // Prepend with name
      text = 'يا ' + name + '، ' + text;
    }
  }

  return text.trim();
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

    const sysInstruction = buildSystemInstruction(mode, deepStep, typingPattern, typingMood, enrichedContext);
    
    // Safety: limit system instruction length to avoid Gemini token overflow
    let sysText = sysInstruction.parts[0].text;
    if (sysText.length > 15000) {
      console.warn(`[${requestId}] System instruction too long (${sysText.length}), truncating`);
      sysText = sysText.slice(0, 15000) + '\n\n[نهاية التعليمات — التزم بالقواعد أعلاه]';
      sysInstruction.parts[0].text = sysText;
    }

    const geminiBody = {
      system_instruction: sysInstruction,
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
    
    // Retry logic for transient Gemini errors
    let geminiRes = null;
    let lastErrText = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      geminiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });
      if (geminiRes.ok) break;
      lastErrText = await geminiRes.text();
      console.error(`[${requestId}] Gemini error attempt ${attempt+1}: ${geminiRes.status}`, lastErrText);
      if (geminiRes.status === 429 || geminiRes.status >= 500) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        break; // Non-retryable error
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      console.error(`[${requestId}] Gemini final error: ${geminiRes?.status}`, lastErrText);
      // Instead of raw error, return a warm fallback response
      const isCrisisMsg = CRISIS_KEYWORDS.some(re => re.test(latestUserText));
      const fallbackResponses = [
        'أسمعك... وأنا هني وياك. قولي أكثر عن اللي تحس فيه 💙',
        'شكراً إنك شاركتني... هذا شي شجاع. إيش أكثر شي يثقل عليك الحين؟',
        'كلامك وصلني... ما أنت لحالك في هذا. خذ نفس عميق وقولي أكثر 💙',
        'أحس فيك... وأبي أفهم أكثر. إيش أول شي يجيك في بالك لما تفكر في هذا الموضوع؟'
      ];
      let fallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
      if (isCrisisMsg) {
        fallback = 'اللي تحس فيه حقيقي ومهم... وأنا هني وياك. ما أنت لحالك في هذا أبداً.' + CRISIS_HELPLINES;
      }
      return res.status(200).json({
        candidates: [{ content: { parts: [{ text: JSON.stringify({ response: fallback, mood: 'support', vak: 'mixed', score: 3, crisis: isCrisisMsg }) }] } }],
        _fallback: true, requestId
      });
    }

    const geminiData = await geminiRes.json();

    // ── SAFETY POST-PROCESSING ──
    let modelResponseText = '';
    let crisisForced = false;
    if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      try {
        const parsed = JSON.parse(geminiData.candidates[0].content.parts[0].text);
        modelResponseText = parsed.response || '';
        
        // Apply programmatic safety layer
        const processedText = postProcessResponse(modelResponseText, latestUserText, profileData, detectedName);
        parsed.response = processedText;
        
        // Force crisis flag if keywords detected
        if (detectCrisis(latestUserText)) {
          parsed.crisis = true;
          crisisForced = true;
        }
        
        // Write back the processed response
        geminiData.candidates[0].content.parts[0].text = JSON.stringify(parsed);
        modelResponseText = processedText;
      } catch (e) {
        // If JSON parsing fails, still try to clean up raw text
        let rawText = geminiData.candidates[0].content.parts[0].text;
        if (detectCrisis(latestUserText)) {
          for (const emoji of BANNED_CRISIS_EMOJIS) {
            rawText = rawText.replaceAll(emoji, '💙');
          }
        }
        geminiData.candidates[0].content.parts[0].text = rawText;
      }
    }

    // ── Update profile + log conversation (non-blocking) ──
    if (visitorId) {
      try {
        // Extract mood & techniques from response
        let mood = '';
        let techniques = [];
        if (modelResponseText) {
          try {
            const reparsed = JSON.parse(geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
            mood = reparsed.mood || '';
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
        const existingTopics = (profileData && profileData.topics) ? profileData.topics : [];
        const mergedTopics = [...new Set([...existingTopics, ...detectedTopics])].slice(-15);

        const isFirstMessage = sanitizedContents.filter(m => m.role === 'user').length === 1;
        const updateData = {
          visitor_id: visitorId,
          gender: detectedGender || (profileData && profileData.gender) || 'unknown',
          dialect: (profileData && profileData.dialect) || 'khaleeji',
          session_count: ((profileData && profileData.session_count) || 0) + (isFirstMessage ? 1 : 0),
          total_sessions: ((profileData && profileData.total_sessions) || 0) + (isFirstMessage ? 1 : 0),
          last_mood: mood || (profileData && profileData.last_mood) || '',
          display_name: detectedName || (profileData && profileData.display_name) || '',
          corrections: (profileData && profileData.corrections) || [],
          topics: mergedTopics,
          preferences: (profileData && profileData.preferences) || {},
          personality_notes: (profileData && profileData.personality_notes) || '',
          effective_techniques: (profileData && profileData.effective_techniques) || [],
          avg_rating: (profileData && profileData.avg_rating) || 0
        };

        // MUST await in Vercel serverless — fire-and-forget gets killed when response is sent
        await Promise.all([
          upsertProfile(updateData).catch(e => console.warn('Profile update failed:', e.message)),
          latestUserText
            ? logConversation(visitorId, sessionId, latestUserText, modelResponseText, techniques.length > 0 ? techniques[0] : '')
                .catch(e => console.warn('Convo log failed:', e.message))
            : Promise.resolve()
        ]);
      } catch (e) {
        // Non-critical — don't affect the response
        console.warn('Profile/log update error:', e.message);
      }
    }

    return res.status(200).json(geminiData);
  } catch (err) {
    console.error(`[${requestId}] Proxy error:`, err.message, err.stack);
    return res.status(500).json({ error: 'Internal server error', requestId });
  }
}
