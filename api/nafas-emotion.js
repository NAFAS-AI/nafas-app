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
      
      // Override based on culturally-aware levels
      if (analysis.child_safety.alert_level >= 4) {
        // إساءة حقيقية أو طوارئ — override كامل
        analysis.emotion = analysis.emotion === 'neutral' ? 'scared' : analysis.emotion;
        analysis.tone = 'urgent';
      } else if (analysis.child_safety.alert_level === 3) {
        // مُقلق — لا override للعاطفة لكن ننبّه بصمت
        analysis.tone = 'careful';
      } else if (analysis.child_safety.alert_level <= 1) {
        // تأديب طبيعي — لا override أبداً. دعم عاطفي فقط.
        // نخلّي emotion كما هو (حزين/زعلان) — هذا صحيح — بس ما نفعّل إنذار
        analysis.tone = analysis.tone || 'gentle';
      }
    }

    // Add recommendations — culturally intelligent
    analysis.recommendations = {
      breathing: suggestBreathing(analysis.emotion),
      color: suggestColor(analysis.emotion),
      action: (product === 'atheer' && analysis.child_safety)
        ? analysis.child_safety.recommended_response.action
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
    atheer: 'This text is from a CHILD (ages 4-14) in an Arab/Gulf culture speaking to a companion AI. IMPORTANT CULTURAL CONTEXT: Parental discipline (spanking for misbehavior) is culturally and religiously normal in this context — it is NOT automatically abuse. Differentiate between: (1) Normal discipline with clear reason → emotional support only, (2) Excessive/repeated hitting with fear → concerning, (3) Injuries/burns/sexual/isolation → real abuse. Focus on the child\'s EMOTIONAL STATE, not just the actions described.',
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

// ──────── Child Safety — Culturally Intelligent ────────
// في ثقافتنا: التأديب حق شرعي للوالدين (حديث: "مروا أولادكم بالصلاة سبع واضربوهم عشر")
// الذكاء = التفريق بين التأديب المقبول والإساءة الحقيقية
// المستويات: 0 = عادي | 1 = تأديب طبيعي | 2 = يحتاج مراقبة | 3 = مُقلق | 4 = خطر | 5 = طوارئ

function checkChildSafety(text) {
  const lower = text.toLowerCase();
  const original = text;
  let level = 0;
  const flags = [];
  let response_type = 'normal';
  let notes = [];

  // ══════════════════════════════════════════════════════════
  // المستوى 5 — طوارئ فورية (لا يتأخر ثانية)
  // ══════════════════════════════════════════════════════════
  const emergency = [
    'أبي أموت','أتمنى الموت','أقتل نفسي','ما أبي أعيش','انتحار',
    'أبي أنتحر','الحياة ما تستاهل','أحسن لو أموت',
    'want to die','kill myself','suicide','end my life','better off dead'
  ];
  for (const w of emergency) {
    if (lower.includes(w)) {
      level = 5;
      flags.push('emergency_crisis:' + w);
      response_type = 'immediate_intervention';
      notes.push('كلام يدل على خطر على النفس — تدخل فوري');
    }
  }

  // ══════════════════════════════════════════════════════════
  // المستوى 5 — تحرش / اعتداء جنسي (طوارئ مطلقة)
  // ══════════════════════════════════════════════════════════
  const sexual = [
    'يتحرش','تحرش','يلمس جسمي','لمس مكان','عورتي','يخلع ملابسي',
    'يبوسني بطريقة','يجبرني أخلع','يدخل غرفتي بالليل',
    'molest','sexual','inappropriate touch','private parts','forces me to undress'
  ];
  for (const w of sexual) {
    if (lower.includes(w)) {
      level = 5;
      flags.push('sexual_abuse:' + w);
      response_type = 'immediate_intervention';
      notes.push('مؤشر اعتداء جنسي — أعلى مستوى حماية');
    }
  }

  // ══════════════════════════════════════════════════════════
  // المستوى 4 — إساءة جسدية حقيقية (إصابات / أدوات / قسوة شديدة)
  // ══════════════════════════════════════════════════════════
  if (level < 4) {
    const severeAbuse = [
      'كسر يدي','كسر رجلي','كسر عظمي','يحرقني','حرقني','يكويني','كواني',
      'يحبسني','حبسني في الغرفة','حبسني في الحمام','ما يعطيني أكل','يجوعني',
      'ضربني بالسلك','ضربني بالخرطوم','ضربني بالعصا على وجهي','ضربني على راسي',
      'ضربني بالحزام على وجهي','ضربني بالشبشب على وجهي',
      'كدمات','جروح','دم','ينزف','طاحت أسناني',
      'broke my arm','broke my bone','burns me','starves me','locks me up',
      'belt on face','bruises','bleeding','stitches','hospital'
    ];
    for (const w of severeAbuse) {
      if (lower.includes(w)) {
        level = 4;
        flags.push('severe_physical:' + w);
        response_type = 'activate_blind_guardian';
        notes.push('إصابات جسدية واضحة / قسوة تتجاوز التأديب');
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // المستوى 4 — عزلة وتهديد (مؤشر إساءة منظمة)
  // ══════════════════════════════════════════════════════════
  if (level < 4) {
    const isolation = [
      'لا تقول لأحد','سر بيني وبينك','إذا قلت لأحد بضربك',
      'إذا قلت لأمك','لا تخبر','ما أحد يعرف','هددني',
      'don\'t tell anyone','our secret','if you tell','threatened me','nobody knows'
    ];
    for (const w of isolation) {
      if (lower.includes(w)) {
        level = Math.max(level, 4);
        flags.push('isolation_threat:' + w);
        response_type = 'activate_blind_guardian';
        notes.push('عزلة + تهديد = مؤشر إساءة منظمة');
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // المستوى 3 — خوف مستمر / ضرب متكرر مُقلق (مراقبة + أخصائية)
  // ══════════════════════════════════════════════════════════
  if (level < 3) {
    const persistentFear = [
      'خايف أرجع البيت','خايف من أبوي','خايف من أمي','ما أبي أرجع',
      'كل يوم يضربني','دايم يضربني','كل مرة يضربني','ما يوقف ضرب',
      'يضربني بدون سبب','يضربني على أي شي','يضربني قدام الناس',
      'أكره البيت','أكره أبوي','أتمنى أهرب','ما أحد يحبني في البيت',
      'afraid to go home','hits me every day','always beating me',
      'hits me for no reason','scared of my dad','scared of my mom','hate my home'
    ];
    for (const w of persistentFear) {
      if (lower.includes(w)) {
        level = 3;
        flags.push('persistent_concern:' + w);
        response_type = 'alert_specialist_soft';
        notes.push('خوف مستمر أو ضرب متكرر بلا سبب — يحتاج متابعة أخصائية');
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // المستوى 2 — تأديب عادي لكن الطفل متأثر (مراقبة)
  // ══════════════════════════════════════════════════════════
  if (level < 2) {
    const disciplineWithDistress = [];
    // "ضربني/يضربني" + مشاعر سلبية = تأديب لكن الطفل متضايق
    const disciplineWords = ['ضربني','يضربني','ضربتني','تضربني','beats me','hits me','spanked me','smacked me'];
    const distressWords = ['حزين','زعلان','أبكي','أبي أبكي','مو عادل','ظلم','ما أستاهل','مو فير','sad','crying','unfair','didn\'t deserve'];
    
    let hasDiscipline = false;
    let hasDistress = false;
    
    for (const w of disciplineWords) { if (lower.includes(w)) hasDiscipline = true; }
    for (const w of distressWords) { if (lower.includes(w)) hasDistress = true; }
    
    if (hasDiscipline && hasDistress) {
      level = 2;
      flags.push('discipline_with_distress');
      response_type = 'emotional_support_monitor';
      notes.push('تأديب + تأثر عاطفي — دعم عاطفي مع مراقبة النمط');
    }
  }

  // ══════════════════════════════════════════════════════════
  // المستوى 1 — تأديب عادي (طبيعي ثقافياً)
  // ══════════════════════════════════════════════════════════
  if (level === 0) {
    const normalDiscipline = ['ضربني','يضربني','ضربتني','تضربني','أدبني','عاقبني',
      'beats me','hits me','spanked me','punished me','grounded me'];
    const disciplineContext = ['لأني','عشان','بسبب','واجب','ما سمعت الكلام','ما سويت','عصيت',
      'because','homework','didn\'t listen','disobeyed','misbehaved'];
    
    let hasDiscipline = false;
    let hasContext = false;
    
    for (const w of normalDiscipline) { if (lower.includes(w)) hasDiscipline = true; }
    for (const w of disciplineContext) { if (lower.includes(w)) hasContext = true; }
    
    if (hasDiscipline) {
      if (hasContext) {
        // "ضربني لأني ما سويت واجبي" = تأديب مفهوم السبب
        level = 1;
        flags.push('normal_discipline_with_reason');
        response_type = 'emotional_support_only';
        notes.push('تأديب طبيعي مع سبب واضح — دعم عاطفي فقط: "كيف حسّيت؟"');
      } else {
        // "ضربني" بدون سياق = نسجّل ونتابع
        level = 1;
        flags.push('discipline_no_context');
        response_type = 'emotional_support_explore';
        notes.push('ذكر ضرب بدون سياق — نسأل عن المشاعر بلطف بدون تحقيق');
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // التنمر المدرسي (منفصل عن الأسرة)
  // ══════════════════════════════════════════════════════════
  if (level < 3) {
    const bullying = [
      'يتنمر علي','يتنمرون','يضربوني في المدرسة','يسخرون مني','يكرهوني',
      'ما أحد يلعب معي','وحيد في المدرسة','يأخذون أغراضي',
      'bullied','bully me','kids hit me','nobody plays with me','they hate me','steal my stuff'
    ];
    for (const w of bullying) {
      if (lower.includes(w)) {
        level = Math.max(level, 2);
        flags.push('school_bullying:' + w);
        if (response_type === 'normal') response_type = 'comfort_and_empower';
        notes.push('تنمر مدرسي — دعم + تمكين + إبلاغ المعلمة إذا استمر');
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // البناء النهائي
  // ══════════════════════════════════════════════════════════
  return {
    alert_level: level,
    flags,
    response_type,
    notes,
    requires_specialist: level >= 3,
    requires_parent_alert: level >= 4,
    is_emergency: level >= 5,
    cultural_context: getCulturalNote(level),
    recommended_response: getRecommendedResponse(level, response_type)
  };
}

function getCulturalNote(level) {
  if (level <= 1) return 'تأديب الوالدين حق شرعي وثقافي — لا تنبيه. الدعم العاطفي فقط.';
  if (level === 2) return 'الطفل متأثر عاطفياً — نراقب النمط دون إثارة قلق.';
  if (level === 3) return 'مؤشرات تتجاوز التأديب الطبيعي — يحتاج متابعة مختص.';
  if (level === 4) return 'إساءة واضحة تتجاوز كل حدود التأديب المقبول.';
  return 'طوارئ — تدخل فوري بلا تأخير.';
}

function getRecommendedResponse(level, type) {
  const responses = {
    'normal': { action: 'continue_conversation', tone: 'normal' },
    'emotional_support_only': {
      action: 'empathize_only',
      tone: 'gentle',
      say: 'كيف حسّيت لما صار هالشي؟',
      dont: 'لا تحقق — لا تسأل "ليش ضربك". الطفل يحتاج أحد يسمعه.'
    },
    'emotional_support_explore': {
      action: 'gentle_explore',
      tone: 'gentle',
      say: 'تبي تحكيلي أكثر عن اللي صار؟',
      dont: 'لا تضغط. إذا ما باغى يكمّل، طنّش بلطف.'
    },
    'emotional_support_monitor': {
      action: 'support_and_log',
      tone: 'warm',
      say: 'أنا معك وأسمعك دايماً.',
      log: 'سجّل الحدث + المشاعر — راقب التكرار خلال أسبوع.'
    },
    'comfort_and_empower': {
      action: 'comfort_then_empower',
      tone: 'warm',
      say: 'إنت ما سويت شي غلط. وأنا دايماً معك.',
      follow_up: 'إذا تكرر → أبلغ المعلمة / الأخصائية.'
    },
    'alert_specialist_soft': {
      action: 'soft_alert',
      tone: 'careful',
      say: 'يدعم الطفل عاطفياً + يسجّل بصمت + ينبّه الأخصائية برسالة خاصة',
      dont: 'لا يقول للطفل "بنبلّغ" — لا يخوّفه.'
    },
    'activate_blind_guardian': {
      action: 'activate_blind_guardian',
      tone: 'urgent',
      protocol: 'الحارس الأعمى — تنبيه صامت للأخصائية + تسجيل + حماية الطفل.'
    },
    'immediate_intervention': {
      action: 'emergency_protocol',
      tone: 'urgent',
      protocol: 'طوارئ — إبلاغ فوري + خط ساخن + لا يُترك الطفل وحده.'
    }
  };
  return responses[type] || responses['normal'];
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
