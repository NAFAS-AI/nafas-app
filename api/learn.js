// ============================================================
// NAFAS — Learning Engine API (Phase 5: Self-Learning System)
// © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
//
// The brain of Nafas. Analyzes recent sessions, discovers
// vocabulary, refines technique effectiveness, extracts
// collective insights, and builds self-knowledge.
//
// Triggered: Vercel Cron (daily) OR POST /api/learn
// ============================================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sqpbusodwdjtlgaxrreg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcGJ1c29kd2RqdGxnYXhycmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTQ2MDksImV4cCI6MjA5NTE5MDYwOX0.bglpaNzXgU4ufK7fuu5wMcvE6XYepD318C7mO54ML7I';

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

async function analyzeWithGemini(prompt) {
  if (!GEMINI_API_KEY) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1500,
          responseMimeType: 'application/json'
        }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('Gemini learn error:', e.message);
    return null;
  }
}

// ── Learning Module 1: Vocabulary Discovery ──
async function learnVocabulary(conversations) {
  if (!conversations || conversations.length === 0) return { added: 0 };

  // Get existing vocabulary
  const existingVocab = await supabaseFetch(
    'nafas_learned_vocabulary?select=word&limit=500',
    'GET'
  );
  const knownWords = new Set((existingVocab || []).map(v => v.word));

  // Extract user messages
  const userTexts = conversations
    .filter(c => c.role === 'user')
    .map(c => c.message_text)
    .join('\n');

  if (userTexts.length < 20) return { added: 0 };

  const prompt = `أنتِ محلل لغوي لتطبيق "نَفَس" (تطبيق دعم نفسي عربي خليجي).

حللي النصوص التالية من المستخدمين واستخرجي:
1. كلمات أو تعبيرات عربية (لهجية) غير شائعة أو تعبيرات شبابية جديدة
2. كلمات إنجليزية معرّبة أو مصطلحات إنترنت
3. تعبيرات عاطفية فريدة تصف حالات نفسية
4. أي كلمة أو تعبير يمكن أن يكون مفيداً لفهم المستخدمين أفضل

الكلمات المعروفة مسبقاً (لا تكرريها): ${Array.from(knownWords).slice(0, 100).join(', ')}

نصوص المستخدمين:
${userTexts.slice(0, 3000)}

أجيبي بـ JSON:
{
  "vocabulary": [
    {
      "word": "الكلمة",
      "meaning": "معناها بالعربية الفصيحة",
      "dialect": "khaleeji/egyptian/shami/maghrebi/gen_z/internet",
      "category": "emotion/slang/greeting/expression/borrowed/gen_z",
      "usage_tip": "كيف يستخدمها المتحدث وكيف يجب أن أتعامل معها"
    }
  ]
}

ملاحظة: ركّزي على الكلمات اللي فعلاً تحتاج تعلّم — لا تضيفي كلمات عربية أساسية معروفة.`;

  const result = await analyzeWithGemini(prompt);
  if (!result?.vocabulary) return { added: 0 };

  let added = 0;
  for (const v of result.vocabulary) {
    if (!v.word || knownWords.has(v.word)) continue;
    await supabaseFetch('nafas_learned_vocabulary', 'POST', {
      word: v.word.slice(0, 50),
      meaning: (v.meaning || '').slice(0, 200),
      dialect: v.dialect || 'unknown',
      category: v.category || 'expression',
      example_context: (v.usage_tip || '').slice(0, 200),
      frequency: 1,
      confidence: 0.6
    }).catch(() => {});
    added++;
  }

  return { added };
}

// ── Learning Module 2: Pattern Discovery ──
async function learnPatterns(summaries) {
  if (!summaries || summaries.length < 3) return { discovered: 0 };

  const summaryTexts = summaries.map(s =>
    `الجلسة (${s.created_at}): ${s.summary_text} | المواضيع: ${(s.key_topics || []).join(',')} | النتيجة: ${s.outcome} | التقنيات: ${(s.techniques_used || []).join(',')}`
  ).join('\n');

  const prompt = `أنتِ محلل أنماط لتطبيق "نَفَس" للدعم النفسي.

حللي ملخصات الجلسات التالية واستخرجي أنماط وملاحظات:

${summaryTexts.slice(0, 4000)}

استخرجي:
1. أنماط زمنية (مثل: معظم جلسات القلق تحصل بالليل)
2. ارتباطات بين المواضيع (مثل: ضغط العمل غالباً يصاحبه أرق)
3. ملاحظات ثقافية (مثل: المستخدمين من الخليج يستخدمون التعابير الدينية للتعبير عن الألم)
4. ما ينجح وما لا ينجح (مثل: تقنية التنفس تنجح مع القلق أكثر من الحزن)
5. أفكار لتحسين نَفَس (مثل: نحتاج نضيف تقنية جديدة لموضوع معين)

أجيبي بـ JSON:
{
  "patterns": [
    {
      "type": "timing/correlation/cultural/effectiveness/improvement",
      "title": "عنوان قصير",
      "description": "وصف تفصيلي",
      "confidence": 0.5-1.0,
      "actionable": true/false
    }
  ],
  "self_improvements": [
    {
      "category": "style_rule/effective_approach/cultural_note/mistake_learned/vocabulary_rule",
      "insight": "ما تعلمته",
      "evidence": "الدليل",
      "applies_to": "all/female/male/teen/adult"
    }
  ]
}`;

  const result = await analyzeWithGemini(prompt);
  if (!result) return { discovered: 0 };

  let discovered = 0;

  // Save patterns as collective insights
  if (result.patterns) {
    for (const p of result.patterns) {
      if (!p.title) continue;
      // Check if similar insight exists
      const existing = await supabaseFetch(
        'nafas_collective_insights?title=eq.' + encodeURIComponent(p.title) + '&limit=1',
        'GET'
      );
      if (Array.isArray(existing) && existing.length > 0) {
        // Reinforce existing insight
        const e = existing[0];
        await supabaseFetch('nafas_collective_insights', 'POST', {
          id: e.id,
          insight_type: p.type || e.insight_type,
          title: e.title,
          description: p.description || e.description,
          confidence: Math.min(1.0, (e.confidence || 0.5) + 0.05),
          times_confirmed: (e.times_confirmed || 1) + 1,
          last_confirmed: new Date().toISOString(),
          active: true
        });
      } else {
        await supabaseFetch('nafas_collective_insights', 'POST', {
          insight_type: p.type || 'pattern',
          title: p.title.slice(0, 100),
          description: (p.description || '').slice(0, 500),
          confidence: p.confidence || 0.5,
          times_confirmed: 1,
          active: true
        });
        discovered++;
      }
    }
  }

  // Save self-improvements
  if (result.self_improvements) {
    for (const si of result.self_improvements) {
      if (!si.insight) continue;
      await supabaseFetch('nafas_self_knowledge', 'POST', {
        category: si.category || 'effective_approach',
        insight: si.insight.slice(0, 300),
        evidence: (si.evidence || '').slice(0, 300),
        applies_to: si.applies_to || 'all',
        confidence: 0.5,
        times_validated: 1
      }).catch(() => {});
      discovered++;
    }
  }

  return { discovered };
}

// ── Learning Module 3: Technique Optimization ──
async function optimizeTechniques(summaries) {
  if (!summaries || summaries.length < 2) return { updated: 0 };

  let updated = 0;
  // Aggregate technique results from summaries
  const techMap = {};

  for (const s of summaries) {
    const techniques = s.techniques_used || [];
    const topics = s.key_topics || ['general'];
    const isSuccess = s.outcome === 'improved';
    const rating = s.mood_rating || 3;

    for (const tech of techniques) {
      for (const topic of topics) {
        const key = `${tech}|${topic}`;
        if (!techMap[key]) {
          techMap[key] = { technique: tech, topic, successes: 0, failures: 0, total: 0, ratings: [] };
        }
        techMap[key].total++;
        if (isSuccess) techMap[key].successes++;
        else techMap[key].failures++;
        techMap[key].ratings.push(rating);
      }
    }
  }

  // Update database
  for (const [key, data] of Object.entries(techMap)) {
    const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
    const existing = await supabaseFetch(
      'nafas_technique_effectiveness?technique=eq.' + encodeURIComponent(data.technique) +
      '&topic=eq.' + encodeURIComponent(data.topic) +
      '&gender=eq.all&limit=1',
      'GET'
    );

    if (Array.isArray(existing) && existing.length > 0) {
      const e = existing[0];
      const newTotal = (e.total_count || 0) + data.total;
      const newSuccess = (e.success_count || 0) + data.successes;
      await supabaseFetch('nafas_technique_effectiveness', 'POST', {
        id: e.id,
        technique: data.technique,
        topic: data.topic,
        gender: 'all',
        success_count: newSuccess,
        failure_count: (e.failure_count || 0) + data.failures,
        total_count: newTotal,
        effectiveness_score: Math.round((newSuccess / newTotal) * 100) / 100,
        avg_mood_after: Math.round(((e.avg_mood_after || 0) * (e.total_count || 1) + avgRating * data.total) / newTotal * 100) / 100,
        updated_at: new Date().toISOString()
      });
    } else {
      await supabaseFetch('nafas_technique_effectiveness', 'POST', {
        technique: data.technique,
        topic: data.topic,
        gender: 'all',
        success_count: data.successes,
        failure_count: data.failures,
        total_count: data.total,
        effectiveness_score: Math.round((data.successes / data.total) * 100) / 100,
        avg_mood_after: Math.round(avgRating * 100) / 100,
        updated_at: new Date().toISOString()
      });
    }
    updated++;
  }

  return { updated };
}

// ── Main Handler ──
export default async function handler(req, res) {
  // Allow GET for Vercel Cron
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'POST or GET only' });
  }

  // Verify cron secret for GET requests (Vercel Cron)
  if (req.method === 'GET') {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    console.log('[LEARN] Starting learning cycle...');

    // 1. Fetch recent session summaries (last 24 hours for cron, or all unprocessed)
    const summaries = await supabaseFetch(
      'nafas_session_summaries?order=created_at.desc&limit=50',
      'GET'
    );

    // 2. Fetch recent conversations
    const conversations = await supabaseFetch(
      'nafas_conversation_log?order=created_at.desc&limit=200',
      'GET'
    );

    // 3. Run learning modules
    const vocabResult = await learnVocabulary(conversations || []);
    console.log('[LEARN] Vocabulary:', vocabResult);

    const patternResult = await learnPatterns(summaries || []);
    console.log('[LEARN] Patterns:', patternResult);

    const techResult = await optimizeTechniques(summaries || []);
    console.log('[LEARN] Techniques:', techResult);

    // 4. Return results
    const result = {
      ok: true,
      timestamp: new Date().toISOString(),
      sessions_analyzed: (summaries || []).length,
      conversations_analyzed: (conversations || []).length,
      vocabulary_added: vocabResult.added,
      patterns_discovered: patternResult.discovered,
      techniques_updated: techResult.updated
    };

    console.log('[LEARN] Complete:', result);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[LEARN] Error:', err.message);
    return res.status(500).json({ error: 'Learning engine error' });
  }
}
