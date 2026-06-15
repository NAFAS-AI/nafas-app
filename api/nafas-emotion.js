/* ============================================================
   NAFAS EMOTION API — B2B Endpoint
   POST /api/nafas-emotion
   
   Input:  { text, product?, lang?, context? }
   Output: { emotion, intensity, vak, crisis, recommendations, ... }
   
   Used by: Atheer, AlJood, Midad, UMQ
   © منيرة علي المري 2026 — نَفَس للذكاء الاصطناعي
   ============================================================ */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Nafas-Product');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, product, lang, context } = req.body || {};
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long (max 5000 chars)' });
    }

    const inputLang = lang || (isArabic(text) ? 'ar' : 'en');
    const apiKey = process.env.GEMINI_KEY;

    let analysis;

    if (apiKey) {
      // Use Gemini for deep analysis
      analysis = await geminiAnalysis(text, product, inputLang, context, apiKey);
    } else {
      // Fallback to local analysis
      analysis = localAnalysis(text, inputLang);
    }

    // Add product-specific enrichment
    if (product === 'atheer') {
      analysis.child_safety = checkChildSafety(text);
      // Override action if safety flags are critical
      if (analysis.child_safety.alert_level >= 4) {
        analysis.emotion = analysis.emotion === 'neutral' ? 'scared' : analysis.emotion;
        analysis.tone = 'urgent';
      }
    }

    // Add recommendations
    analysis.recommendations = {
      breathing: suggestBreathing(analysis.emotion),
      color: suggestColor(analysis.emotion),
      action: (product === 'atheer' && analysis.child_safety && analysis.child_safety.alert_level >= 3)
        ? 'activate_blind_guardian'
        : suggestAction(analysis.emotion, product)
    };

    analysis.meta = {
      api_version: '2.0.0',
      product: product || 'direct',
      lang: inputLang,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(analysis);

  } catch (error) {
    console.error('Nafas Emotion API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ──────── Gemini Analysis ────────
async function geminiAnalysis(text, product, lang, context, apiKey) {
  const productContext = {
    atheer: 'This text is from a CHILD (ages 4-14) speaking to a companion AI. Pay special attention to signs of abuse, bullying, or emotional distress.',
    aljood: 'This text is from a SCHOOL CONTEXT — could be a student or teacher. Detect burnout, academic stress, or social issues.',
    midad: 'This text is from a STUDENT using an educational platform. Detect frustration, confusion, or disengagement.',
    umq: 'This text is from a CLIENT in a consultation session. Detect emotional state for consultant matching.'
  };

  const prompt = `You are Nafas, an emotional analysis engine. Analyze the following text and return ONLY valid JSON.
${product && productContext[product] ? productContext[product] : ''}
${context ? 'Additional context: ' + context : ''}

Text to analyze: "${text}"

Return JSON with exactly these fields:
{
  "emotion": "one of: happy, sad, anxious, angry, stressed, tired, lonely, scared, hopeful, grateful, confused, neutral",
  "intensity": "1-10 scale",
  "vak": "visual, auditory, or kinesthetic (based on the person's communication style)",
  "sub_emotions": ["array of secondary emotions detected"],
  "crisis": false,
  "crisis_type": null,
  "body_signals": ["any physical symptoms mentioned"],
  "needs": ["what this person needs right now"],
  "tone": "gentle/urgent/supportive/grounding"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 500 }
      })
    }
  );

  if (!response.ok) {
    console.error('Gemini API error:', response.status);
    return localAnalysis(text, lang);
  }

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Extract JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return localAnalysis(text, lang);

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    return localAnalysis(text, lang);
  }
}

// ──────── Local Fallback Analysis ────────
function localAnalysis(text, lang) {
  const lower = text.toLowerCase();
  let emotion = 'neutral';
  let intensity = 5;
  let crisis = false;

  const emotionMap = {
    sad: { ar: ['حزين','حزينة','زعلان','مكتئب','أبكي','كئيب','وحيد','وحيدة'], en: ['sad','depressed','crying','lonely','hopeless','miserable'] },
    anxious: { ar: ['قلق','خايف','متوتر','هلع','رعب','وسواس'], en: ['anxious','worried','scared','panic','nervous','fear'] },
    angry: { ar: ['مقهور','غضبان','طفشان','مظلوم','ظلم'], en: ['angry','furious','frustrated','mad','unfair'] },
    tired: { ar: ['تعبان','مرهق','منهك','طاقتي صفر','ما أقدر'], en: ['tired','exhausted','drained','burned out'] },
    happy: { ar: ['مبسوط','فرحان','سعيد','الحمدلله','بخير'], en: ['happy','great','wonderful','grateful','blessed'] },
    stressed: { ar: ['ضغط','مضغوط','كثير علي','مسؤوليات'], en: ['stressed','overwhelmed','pressure','too much'] }
  };

  // Check crisis words
  const crisisAr = ['انتحار','أبي أموت','أتمنى الموت','أقتل نفسي','ما أبي أعيش'];
  const crisisEn = ['suicide','want to die','kill myself','end my life','end it all'];
  for (const w of crisisAr.concat(crisisEn)) {
    if (lower.includes(w)) { crisis = true; emotion = 'crisis'; intensity = 10; break; }
  }

  if (!crisis) {
    for (const [emo, words] of Object.entries(emotionMap)) {
      const allWords = words.ar.concat(words.en);
      for (const w of allWords) {
        if (lower.includes(w)) {
          emotion = emo;
          intensity = emo === 'happy' ? 7 : (emo === 'sad' || emo === 'anxious' ? 3 : 4);
          break;
        }
      }
      if (emotion !== 'neutral') break;
    }
  }

  // VAK
  let vak = 'mixed';
  if (/أشوف|شايف|صورة|لون|see|look|picture|color/i.test(lower)) vak = 'visual';
  else if (/أسمع|صوت|هدوء|hear|sound|quiet/i.test(lower)) vak = 'auditory';
  else if (/أحس|ثقل|ألم|feel|heavy|pain/i.test(lower)) vak = 'kinesthetic';

  return { emotion, intensity, vak, crisis, sub_emotions: [], body_signals: [], needs: [], tone: crisis ? 'urgent' : 'supportive' };
}

// ──────── Child Safety ────────
function checkChildSafety(text) {
  const lower = text.toLowerCase();
  let level = 0;
  const flags = [];

  const danger = ['ضربني','يضربني','يأذيني','يتحرش','تحرش','سر ما تقول','لا تقول لأحد','خايف من أبوي','beats me','hits me','hurts me','abuse','don\'t tell','secret'];
  const body = ['جسمي','لمسني','يلمسني','touched me','don\'t touch'];
  
  for (const w of danger) { if (lower.includes(w)) { level = Math.max(level, 4); flags.push('danger:' + w); } }
  for (const w of body) { if (lower.includes(w)) { level = Math.max(level, 3); flags.push('body:' + w); } }

  return { alert_level: level, flags, requires_specialist: level >= 3, requires_parent_alert: level >= 4 };
}

// ──────── Helpers ────────
function isArabic(text) { return /[\u0600-\u06FF]/.test(text); }

function suggestBreathing(emotion) {
  const map = { anxious: '4-7-8', stressed: 'box', angry: 'box', sad: '6-2-8', tired: 'coherent', happy: 'energize', crisis: '2-4' };
  return map[emotion] || 'box';
}

function suggestColor(emotion) {
  const map = { anxious: '#5A9BB5', stressed: '#C4956A', angry: '#E8C07A', sad: '#8A9BB8', tired: '#A78BFA', happy: '#14B8A6', crisis: '#F87171' };
  return map[emotion] || '#C4956A';
}

function suggestAction(emotion, product) {
  if (product === 'atheer') {
    if (emotion === 'crisis') return 'activate_blind_guardian';
    if (emotion === 'sad') return 'comfort_mode';
    if (emotion === 'anxious') return 'grounding_exercise';
    return 'continue_conversation';
  }
  if (product === 'aljood') {
    if (emotion === 'tired') return 'reduce_workload';
    if (emotion === 'anxious') return 'private_check_in';
    return 'monitor';
  }
  if (product === 'midad') {
    if (emotion === 'stressed' || emotion === 'tired') return 'slow_pace';
    if (emotion === 'confused') return 'simplify';
    return 'normal_pace';
  }
  return 'supportive_response';
}
