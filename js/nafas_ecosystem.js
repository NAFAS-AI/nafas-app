/* ============================================================
   NAFAS ECOSYSTEM — المنظومة المتكاملة
   Connects Nafas with Atheer, AlJood, Midad, and UMQ.
   Nafas = القلب العاطفي للمنظومة
   
   © منيرة علي المري 2026 — نَفَس للذكاء الاصطناعي
   ============================================================ */
(function() {
  'use strict';

  // ──────── Product Registry ────────
  var products = {
    nafas: {
      name: { ar: 'نَفَس', en: 'Nafas' },
      icon: '🌬️',
      role: 'emotional-engine',
      color: '#C4956A',
      domain: 'nafas-app.com'
    },
    atheer: {
      name: { ar: 'أثير', en: 'Atheer' },
      icon: '🔮',
      role: 'child-companion',
      color: '#A78BFA',
      domain: 'atheer.ae',
      needsFromNafas: ['emotion-analysis', 'voice-tone', 'safety-flags', 'breathing-guide']
    },
    aljood: {
      name: { ar: 'الجود', en: 'AlJood' },
      icon: '🏫',
      role: 'school-os',
      color: '#14B8A6',
      domain: 'aljood.eduos.ae',
      needsFromNafas: ['student-mood', 'teacher-burnout', 'class-atmosphere']
    },
    midad: {
      name: { ar: 'مِداد', en: 'Midad' },
      icon: '✒️',
      role: 'education-os',
      color: '#E8C07A',
      domain: 'midad.ae',
      needsFromNafas: ['learner-state', 'adaptive-pacing', 'focus-detection']
    },
    umq: {
      name: { ar: 'عُمق', en: 'UMQ' },
      icon: '🔬',
      role: 'deep-analysis',
      color: '#5A9BB5',
      domain: 'umq.ae',
      needsFromNafas: ['client-emotion', 'session-mood', 'consultant-match']
    }
  };

  // ──────── Nafas API Interface ────────
  // This defines how other products call Nafas
  var NafasAPI = {

    // Core: Analyze emotion from text
    analyzeEmotion: function(text, options) {
      options = options || {};
      return new Promise(function(resolve) {
        var result = {
          timestamp: new Date().toISOString(),
          source: options.product || 'direct',
          input_lang: detectLanguage(text),
          analysis: localEmotionAnalysis(text),
          recommendations: {}
        };

        // Add product-specific data
        if (options.product === 'atheer') {
          result.child_safety = checkChildSafety(text);
          result.recommendations.parent_alert = result.child_safety.alert_level > 2;
          result.recommendations.specialist_flag = result.child_safety.alert_level > 3;
        }

        if (options.product === 'aljood') {
          result.recommendations.class_action = suggestClassAction(result.analysis);
        }

        if (options.product === 'midad') {
          result.recommendations.pacing = suggestPacing(result.analysis);
        }

        result.recommendations.breathing = suggestBreathing(result.analysis);
        result.recommendations.color = suggestColor(result.analysis);

        resolve(result);
      });
    },

    // Breathing recommendation based on mood
    getBreathingPattern: function(mood) {
      var patterns = {
        anxious: 'anxiety',
        stressed: 'stress',
        panic: 'panic',
        tired: 'sleep',
        sad: 'calm',
        angry: 'stress',
        happy: 'energy',
        neutral: 'calm'
      };
      return patterns[mood] || 'stress';
    },

    // Mood tracking
    logMood: function(mood, intensity, source) {
      var entry = {
        mood: mood,
        intensity: intensity || 5,
        source: source || 'nafas',
        timestamp: new Date().toISOString()
      };

      // Store locally
      var history = JSON.parse(localStorage.getItem('nafas_mood_history') || '[]');
      history.push(entry);
      if (history.length > 500) history = history.slice(-500);
      localStorage.setItem('nafas_mood_history', JSON.stringify(history));

      // Emit event
      document.dispatchEvent(new CustomEvent('nafas:moodLogged', { detail: entry }));

      return entry;
    },

    // Get mood history
    getMoodHistory: function(days) {
      days = days || 7;
      var history = JSON.parse(localStorage.getItem('nafas_mood_history') || '[]');
      var cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
      return history.filter(function(h) { return new Date(h.timestamp).getTime() > cutoff; });
    },

    // Get mood trend
    getMoodTrend: function(days) {
      var history = this.getMoodHistory(days);
      if (history.length < 2) return { trend: 'insufficient_data' };

      var half = Math.floor(history.length / 2);
      var firstHalf = history.slice(0, half);
      var secondHalf = history.slice(half);

      var avg = function(arr) {
        var sum = 0;
        for (var i = 0; i < arr.length; i++) sum += arr[i].intensity;
        return sum / arr.length;
      };

      var firstAvg = avg(firstHalf);
      var secondAvg = avg(secondHalf);
      var diff = secondAvg - firstAvg;

      return {
        trend: diff > 0.5 ? 'improving' : (diff < -0.5 ? 'declining' : 'stable'),
        first_period_avg: Math.round(firstAvg * 10) / 10,
        second_period_avg: Math.round(secondAvg * 10) / 10,
        total_entries: history.length,
        dominant_mood: getDominantMood(history)
      };
    },

    // Product registration
    products: products,

    // Version
    version: '2.0.0'
  };

  // ──────── Local Emotion Analysis ────────
  function localEmotionAnalysis(text) {
    if (!text) return { mood: 'neutral', intensity: 3, vak: 'mixed' };

    var lower = text.toLowerCase();
    var mood = 'neutral';
    var intensity = 5;

    // Arabic emotion keywords
    var emotions = {
      sad: ['حزين','حزينة','زعلان','زعلانة','مكتئب','مكتئبة','أبكي','ابكي','دموع','كئيب','وحيد','وحيدة','ما أحد','مالي أحد'],
      anxious: ['قلق','قلقة','خايف','خايفة','متوتر','متوترة','مرعوب','مقلق','وسواس','هلع','رعب'],
      angry: ['زعلان','مقهور','مقهورة','غضبان','غضبانة','طفشان','طفشانة','مظلوم','مظلومة','ظلم'],
      tired: ['تعبان','تعبانة','مرهق','مرهقة','منهك','منهكة','ما أقدر','ما اقدر','طاقتي صفر'],
      happy: ['مبسوط','مبسوطة','فرحان','فرحانة','سعيد','سعيدة','ممتاز','الحمدلله','شكرا','بخير'],
      stressed: ['ضغط','ضاغط','مضغوط','مضغوطة','مسؤوليات','كثير علي','مو قادر'],
      lonely: ['وحيد','وحيدة','لحالي','ما أحد','ما احد يفهمني','ما فيه أحد']
    };

    var emotionKeys = Object.keys(emotions);
    for (var i = 0; i < emotionKeys.length; i++) {
      var key = emotionKeys[i];
      var words = emotions[key];
      for (var j = 0; j < words.length; j++) {
        if (lower.indexOf(words[j]) !== -1) {
          mood = key;
          intensity = (key === 'happy') ? 7 : (key === 'sad' || key === 'anxious') ? 3 : 4;
          break;
        }
      }
      if (mood !== 'neutral') break;
    }

    // English emotion keywords
    if (mood === 'neutral') {
      var enEmotions = {
        sad: ['sad','depressed','crying','lonely','hopeless','miserable'],
        anxious: ['anxious','worried','scared','panic','nervous','fear'],
        angry: ['angry','furious','frustrated','mad','unfair'],
        tired: ['tired','exhausted','drained','burned out','can\'t cope'],
        happy: ['happy','great','wonderful','grateful','blessed','good'],
        stressed: ['stressed','overwhelmed','pressure','too much']
      };
      var enKeys = Object.keys(enEmotions);
      for (var ei = 0; ei < enKeys.length; ei++) {
        var eKey = enKeys[ei];
        var eWords = enEmotions[eKey];
        for (var ej = 0; ej < eWords.length; ej++) {
          if (lower.indexOf(eWords[ej]) !== -1) {
            mood = eKey; break;
          }
        }
        if (mood !== 'neutral') break;
      }
    }

    // VAK detection (simplified)
    var vak = 'mixed';
    if (/أشوف|شايف|صورة|لون|ظلام|نور|see|look|picture|color|dark|bright/i.test(lower)) vak = 'visual';
    else if (/أسمع|صوت|هدوء|ضجة|hear|sound|quiet|loud/i.test(lower)) vak = 'auditory';
    else if (/أحس|ثقل|ألم|تعب|feel|heavy|pain|tired|pressure/i.test(lower)) vak = 'kinesthetic';

    return {
      mood: mood,
      intensity: intensity,
      vak: vak,
      confidence: mood === 'neutral' ? 0.3 : 0.7
    };
  }

  function detectLanguage(text) {
    if (!text) return 'ar';
    return /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';
  }

  // ──────── Child Safety (for Atheer) ────────
  function checkChildSafety(text) {
    if (!text) return { alert_level: 0, flags: [] };
    var lower = text.toLowerCase();
    var flags = [];
    var level = 0;

    var dangerWords = ['ضربني','يضربني','بضربني','أبوي يضربني','أمي تضربني','يأذيني','يتحرش','تحرش','سر ما تقول','لا تقول لأحد','خايف من أبوي','خايفة من','عمي','خالي','beat me','hits me','hurts me','secret','don\'t tell','abuse','touch me','scared of'];
    var sadWords = ['ما أحد يحبني','ما احد يحبني','كلهم يكرهوني','ما لي صديق','ما لي صديقة','nobody likes me','everyone hates me','no friends'];
    var bodyWords = ['جسمي','لمسني','يلمسني','لا تلمسني','وجعني هنا','body','touched me','don\'t touch','hurts here'];

    for (var i = 0; i < dangerWords.length; i++) {
      if (lower.indexOf(dangerWords[i]) !== -1) { level = Math.max(level, 4); flags.push('danger:' + dangerWords[i]); }
    }
    for (var j = 0; j < sadWords.length; j++) {
      if (lower.indexOf(sadWords[j]) !== -1) { level = Math.max(level, 2); flags.push('emotional:' + sadWords[j]); }
    }
    for (var k = 0; k < bodyWords.length; k++) {
      if (lower.indexOf(bodyWords[k]) !== -1) { level = Math.max(level, 3); flags.push('body:' + bodyWords[k]); }
    }

    return {
      alert_level: level,
      flags: flags,
      requires_specialist: level >= 3,
      requires_parent_alert: level >= 4
    };
  }

  // ──────── Suggestions ────────
  function suggestBreathing(analysis) {
    var map = { anxious: 'anxiety', stressed: 'stress', angry: 'stress', sad: 'calm', tired: 'sleep', happy: 'energy', lonely: 'calm' };
    return map[analysis.mood] || 'stress';
  }

  function suggestColor(analysis) {
    var map = { anxious: '#5A9BB5', stressed: '#C4956A', angry: '#E8C07A', sad: '#8A9BB8', tired: '#A78BFA', happy: '#14B8A6', lonely: '#D4A574' };
    return map[analysis.mood] || '#C4956A';
  }

  function suggestPacing(analysis) {
    // For Midad: slow down if student is stressed
    if (analysis.mood === 'anxious' || analysis.mood === 'stressed') return 'slower';
    if (analysis.mood === 'tired') return 'pause';
    if (analysis.mood === 'happy') return 'normal';
    return 'gentle';
  }

  function suggestClassAction(analysis) {
    // For AlJood: suggest teacher actions
    if (analysis.mood === 'anxious') return 'check_in_privately';
    if (analysis.mood === 'sad') return 'gentle_attention';
    if (analysis.mood === 'angry') return 'give_space_then_talk';
    if (analysis.mood === 'tired') return 'reduce_workload';
    return 'monitor';
  }

  function getDominantMood(history) {
    var counts = {};
    for (var i = 0; i < history.length; i++) {
      var m = history[i].mood;
      counts[m] = (counts[m] || 0) + 1;
    }
    var max = 0, dominant = 'neutral';
    var keys = Object.keys(counts);
    for (var j = 0; j < keys.length; j++) {
      if (counts[keys[j]] > max) { max = counts[keys[j]]; dominant = keys[j]; }
    }
    return dominant;
  }

  // ──────── Cross-Product Events ────────
  // Listen for mood changes and update atmosphere
  document.addEventListener('nafas:moodDetected', function(e) {
    var mood = e.detail && e.detail.mood;
    if (mood && typeof NafasPulse !== 'undefined') {
      NafasPulse.setMood(mood);
    }
    // Log automatically
    NafasAPI.logMood(mood, e.detail && e.detail.intensity, 'auto');
  });

  // ──────── Connection Info Panel ────────
  function showEcosystemInfo() {
    var lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'ar';
    var existing = document.getElementById('ecosystemPanel');
    if (existing) { existing.parentNode.removeChild(existing); return; }

    var panel = document.createElement('div');
    panel.id = 'ecosystemPanel';
    panel.className = 'ecosystem-panel';

    var html = '<div class="eco-content">';
    html += '<h3>' + (lang === 'ar' ? '🔗 المنظومة المتكاملة' : '🔗 Integrated Ecosystem') + '</h3>';
    html += '<p class="eco-subtitle">' + (lang === 'ar' ? 'نَفَس = القلب العاطفي للمنظومة' : 'Nafas = The Emotional Heart') + '</p>';

    var keys = Object.keys(products);
    for (var i = 0; i < keys.length; i++) {
      var p = products[keys[i]];
      var isNafas = keys[i] === 'nafas';
      html += '<div class="eco-product' + (isNafas ? ' eco-nafas' : '') + '">';
      html += '<span class="eco-icon">' + p.icon + '</span>';
      html += '<span class="eco-info">';
      html += '<strong>' + p.name[lang] + '</strong>';
      if (!isNafas && p.needsFromNafas) {
        html += '<br><small style="opacity:0.6">' + (lang === 'ar' ? 'يستخدم: ' : 'Uses: ') + p.needsFromNafas.length + (lang === 'ar' ? ' خدمات من نَفَس' : ' Nafas services') + '</small>';
      }
      if (isNafas) {
        html += '<br><small style="opacity:0.6">' + (lang === 'ar' ? 'يخدم ٤ منتجات' : 'Serves 4 products') + '</small>';
      }
      html += '</span>';
      html += '</div>';
    }

    // Mood trend
    var trend = NafasAPI.getMoodTrend(7);
    if (trend.trend !== 'insufficient_data') {
      html += '<div class="eco-trend">';
      var trendIcon = trend.trend === 'improving' ? '📈' : (trend.trend === 'declining' ? '📉' : '📊');
      html += trendIcon + ' ' + (lang === 'ar' ? 'اتجاه المزاج: ' : 'Mood trend: ');
      var trendText = { improving: { ar: 'تحسّن', en: 'Improving' }, declining: { ar: 'تراجع', en: 'Declining' }, stable: { ar: 'مستقر', en: 'Stable' } };
      html += (trendText[trend.trend] || trendText.stable)[lang];
      html += ' <small>(' + trend.total_entries + (lang === 'ar' ? ' إدخال' : ' entries') + ')</small>';
      html += '</div>';
    }

    html += '<button class="eco-close" onclick="document.getElementById(\'ecosystemPanel\').remove()">' + (lang === 'ar' ? 'إغلاق' : 'Close') + '</button>';
    html += '</div>';

    panel.innerHTML = html;
    document.body.appendChild(panel);
    requestAnimationFrame(function() { panel.classList.add('active'); });
  }

  // ──────── Public API ────────
  window.NafasEcosystem = NafasAPI;
  window.showEcosystemInfo = showEcosystemInfo;

})();
