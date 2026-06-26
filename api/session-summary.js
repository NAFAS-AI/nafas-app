// NAFAS — Session Summary API — DEBUG VERSION
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sqpbusodwdjtlgaxrreg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcGJ1c29kd2RqdGxnYXhycmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTQ2MDksImV4cCI6MjA5NTE5MDYwOX0.bglpaNzXgU4ufK7fuu5wMcvE6XYepD318C7mO54ML7I';

const ALLOWED_ORIGINS = [
  'https://nafas-app-blush.vercel.app',
  'https://nafas-app.com',
  'https://www.nafas-app.com'
];

async function supabaseFetch(path, method, body) {
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
  } catch (e) { return null; }
}

async function summarizeWithGemini(messages) {
  const debug = {
    hasApiKey: !!GEMINI_API_KEY,
    keyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
    keyPrefix: GEMINI_API_KEY ? GEMINI_API_KEY.slice(0, 6) + '...' : 'NONE',
    model: GEMINI_MODEL,
    messagesCount: messages?.length || 0
  };

  if (!GEMINI_API_KEY || !messages || messages.length === 0) {
    return { _debug: { ...debug, stage: 'pre-check', error: 'missing key or messages' }, analysis: null };
  }

  const conversationText = messages.map(m => {
    const role = m.role === 'user' ? 'المستخدم' : 'نَفَس';
    return `${role}: ${m.text}`;
  }).join('\n');

  const prompt = `أنتِ محرّك تحليل لمحادثات تطبيق "نَفَس" للدعم النفسي.
حللي المحادثة التالية واستخرجي:

المحادثة:
${conversationText}

أجيبي بـ JSON فقط بالشكل التالي:
{
  "summary": "ملخص المحادثة بجملتين-ثلاث",
  "key_topics": ["work", "anxiety"],
  "emotional_arc": "متوتر ← أهدأ",
  "techniques_used": ["breathing", "empathy"],
  "key_moments": ["لحظة مهمة"],
  "outcome": "improved",
  "follow_up_suggestions": ["اقتراح"],
  "detected_vocabulary": []
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
        responseMimeType: 'application/json'
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    debug.httpStatus = res.status;

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      debug.stage = 'http-error';
      debug.errorBody = errBody.slice(0, 300);
      return { _debug: debug, analysis: null };
    }

    const data = await res.json();
    debug.stage = 'response-received';
    debug.hasCandidates = !!(data.candidates && data.candidates.length > 0);
    debug.finishReason = data.candidates?.[0]?.finishReason;

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      debug.stage = 'no-text';
      debug.rawResponse = JSON.stringify(data).slice(0, 300);
      return { _debug: debug, analysis: null };
    }

    debug.stage = 'success';
    debug.textLength = text.length;
    const parsed = JSON.parse(text);
    return { _debug: debug, analysis: parsed };
  } catch (e) {
    debug.stage = 'exception';
    debug.error = e.message;
    return { _debug: debug, analysis: null };
  }
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { visitor_id, session_id, messages, mood_rating } = req.body || {};

    if (!visitor_id || !session_id || !messages || messages.length < 2) {
      return res.status(400).json({ error: 'visitor_id, session_id, and messages (min 2) required' });
    }

    // Skip duplicate check for debug
    const { _debug, analysis } = await summarizeWithGemini(messages);

    if (!analysis) {
      return res.status(200).json({ ok: false, fallback: true, _debug });
    }

    // Save and return
    const summary = {
      visitor_id,
      session_id,
      summary_text: analysis.summary || '',
      key_topics: analysis.key_topics || [],
      emotional_arc: analysis.emotional_arc || '',
      techniques_used: analysis.techniques_used || [],
      key_moments: (analysis.key_moments || []).slice(0, 5),
      outcome: analysis.outcome || 'unknown',
      follow_up_suggestions: (analysis.follow_up_suggestions || []).slice(0, 3),
      message_count: messages.length,
      mood_rating: mood_rating || null
    };

    await supabaseFetch('nafas_session_summaries', 'POST', summary);

    return res.status(200).json({ ok: true, _debug, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 300) });
  }
}
