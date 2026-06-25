// ============================================================
// NAFAS — Session Summary API (Phase 4: Deep Conversation Memory)
// © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
//
// Called when a session ends. Uses Gemini to summarize the
// conversation, then stores the summary in Supabase for
// future context injection.
// ============================================================

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

// Summarize conversation using Gemini
async function summarizeWithGemini(messages) {
  if (!GEMINI_API_KEY || !messages || messages.length === 0) return null;

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
  "summary": "ملخص المحادثة بجملتين-ثلاث بالعربية الخليجية (ما حصل + كيف كان المستخدم + كيف انتهت)",
  "key_topics": ["قائمة المواضيع الرئيسية بالإنجليزية: work, family, relationship, study, sleep, anxiety, loneliness, burnout, grief, identity, health"],
  "emotional_arc": "وصف بسيط لتطور المشاعر مثل: متوتر ← أهدأ أو حزين ← نفس",
  "techniques_used": ["التقنيات اللي استخدمتها نَفَس: breathing, empathy, reframe, socratic, strength_finding, grounding, visualization, reflection, journaling"],
  "key_moments": ["لحظات مهمة أو اقتباسات من المستخدم تستحق التذكر"],
  "outcome": "improved أو neutral أو worsened أو crisis",
  "follow_up_suggestions": ["اقتراحات لمتابعة في الجلسة القادمة"],
  "detected_vocabulary": [{"word": "كلمة جديدة", "meaning": "معناها", "dialect": "اللهجة", "category": "التصنيف"}]
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error('Gemini summary error:', e.message);
    return null;
  }
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { visitor_id, session_id, messages, mood_rating } = req.body || {};

    if (!visitor_id || !session_id || !messages || messages.length < 2) {
      return res.status(400).json({ error: 'visitor_id, session_id, and messages (min 2) required' });
    }

    // Check if already summarized
    const existing = await supabaseFetch(
      'nafas_session_summaries?session_id=eq.' + encodeURIComponent(session_id) + '&limit=1',
      'GET'
    );
    if (Array.isArray(existing) && existing.length > 0) {
      return res.status(200).json({ ok: true, message: 'Already summarized', summary: existing[0] });
    }

    // 1. Summarize with Gemini
    const analysis = await summarizeWithGemini(messages);

    if (!analysis) {
      // Fallback: save basic summary without AI
      const fallbackSummary = {
        visitor_id,
        session_id,
        summary_text: 'جلسة محادثة مع ' + messages.length + ' رسالة',
        key_topics: [],
        emotional_arc: 'unknown',
        techniques_used: [],
        key_moments: [],
        outcome: 'unknown',
        follow_up_suggestions: [],
        message_count: messages.length,
        mood_rating: mood_rating || null
      };
      await supabaseFetch('nafas_session_summaries', 'POST', fallbackSummary);
      return res.status(200).json({ ok: true, summary: fallbackSummary });
    }

    // 2. Save session summary
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

    // 3. Save conversation log
    const logEntries = messages.map((m, i) => ({
      visitor_id,
      session_id,
      role: m.role || (i % 2 === 0 ? 'user' : 'model'),
      message_text: (m.text || '').slice(0, 2000),
      detected_emotion: '',
      detected_topics: analysis.key_topics || []
    }));

    // Batch insert (up to 50 messages)
    for (let i = 0; i < logEntries.length; i += 10) {
      const batch = logEntries.slice(i, i + 10);
      await supabaseFetch('nafas_conversation_log', 'POST', batch);
    }

    // 4. Save any new vocabulary discovered
    if (analysis.detected_vocabulary && analysis.detected_vocabulary.length > 0) {
      for (const v of analysis.detected_vocabulary.slice(0, 10)) {
        if (v.word && v.word.length >= 2) {
          await supabaseFetch('nafas_learned_vocabulary', 'POST', {
            word: v.word.slice(0, 50),
            meaning: (v.meaning || '').slice(0, 200),
            dialect: v.dialect || 'unknown',
            category: v.category || 'expression',
            example_context: (messages.find(m => m.text && m.text.includes(v.word))?.text || '').slice(0, 200),
            frequency: 1,
            confidence: 0.5
          }).catch(() => {}); // Ignore duplicates
        }
      }
    }

    // 5. Update technique effectiveness based on outcome
    if (analysis.techniques_used && analysis.techniques_used.length > 0) {
      const isSuccess = analysis.outcome === 'improved';
      const topics = analysis.key_topics || ['general'];

      for (const tech of analysis.techniques_used.slice(0, 5)) {
        for (const topic of topics.slice(0, 3)) {
          const existing = await supabaseFetch(
            'nafas_technique_effectiveness?technique=eq.' + encodeURIComponent(tech) +
            '&topic=eq.' + encodeURIComponent(topic) +
            '&gender=eq.all&limit=1',
            'GET'
          );

          if (Array.isArray(existing) && existing.length > 0) {
            const e = existing[0];
            const newTotal = (e.total_count || 0) + 1;
            const newSuccess = (e.success_count || 0) + (isSuccess ? 1 : 0);
            const newFailure = (e.failure_count || 0) + (isSuccess ? 0 : 1);
            await supabaseFetch('nafas_technique_effectiveness', 'POST', {
              id: e.id,
              technique: tech,
              topic: topic,
              gender: 'all',
              success_count: newSuccess,
              failure_count: newFailure,
              total_count: newTotal,
              effectiveness_score: Math.round((newSuccess / newTotal) * 100) / 100,
              avg_mood_after: mood_rating ? Math.round(((e.avg_mood_after || 0) * (newTotal - 1) + mood_rating) / newTotal * 100) / 100 : e.avg_mood_after || 0,
              updated_at: new Date().toISOString()
            });
          } else {
            await supabaseFetch('nafas_technique_effectiveness', 'POST', {
              technique: tech,
              topic: topic,
              gender: 'all',
              success_count: isSuccess ? 1 : 0,
              failure_count: isSuccess ? 0 : 1,
              total_count: 1,
              effectiveness_score: isSuccess ? 1.0 : 0.0,
              avg_mood_after: mood_rating || 0,
              updated_at: new Date().toISOString()
            });
          }
        }
      }
    }

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    console.error('Session summary error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
