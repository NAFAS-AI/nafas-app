/* ============================================================
   NAFAS ADAPTIVE BREATHING — التنفس الذكي
   Chooses breathing pattern based on detected emotional state.
   Enhances the existing breathing exercise with intelligence.
   
   © منيرة علي المري 2026 — نَفَس للذكاء الاصطناعي
   ============================================================ */
(function() {
  'use strict';

  // ──────── Breathing Patterns ────────
  var patterns = {
    // 4-7-8: Classic anxiety relief (existing pattern — enhanced)
    anxiety: {
      name: { ar: 'تنفس الطمأنينة', en: 'Calm Breathing' },
      icon: '🕊️',
      phases: [
        { name: { ar: 'شهيق', en: 'Inhale' }, duration: 4, icon: '🌬️' },
        { name: { ar: 'إمساك', en: 'Hold' }, duration: 7, icon: '🤲' },
        { name: { ar: 'زفير', en: 'Exhale' }, duration: 8, icon: '🍃' }
      ],
      colors: ['#5A9BB5', '#4A8BA5', '#6AABB5'],
      description: { ar: 'للقلق والتوتر — يهدّئ الجهاز العصبي', en: 'For anxiety — calms the nervous system' },
      cycles: 3
    },

    // Box breathing: General stress relief
    stress: {
      name: { ar: 'التنفس المربّع', en: 'Box Breathing' },
      icon: '📦',
      phases: [
        { name: { ar: 'شهيق', en: 'Inhale' }, duration: 4, icon: '🌬️' },
        { name: { ar: 'إمساك', en: 'Hold' }, duration: 4, icon: '🤲' },
        { name: { ar: 'زفير', en: 'Exhale' }, duration: 4, icon: '🍃' },
        { name: { ar: 'انتظار', en: 'Wait' }, duration: 4, icon: '✨' }
      ],
      colors: ['#C4956A', '#D4A574', '#B48560', '#E8C07A'],
      description: { ar: 'للضغط — يُعيد التوازن', en: 'For stress — restores balance' },
      cycles: 4
    },

    // 2-4: Quick panic relief
    panic: {
      name: { ar: 'التنفس السريع', en: 'Quick Relief' },
      icon: '⚡',
      phases: [
        { name: { ar: 'شهيق قصير', en: 'Quick Inhale' }, duration: 2, icon: '🌬️' },
        { name: { ar: 'زفير طويل', en: 'Long Exhale' }, duration: 4, icon: '🍃' }
      ],
      colors: ['#E8C07A', '#C4956A'],
      description: { ar: 'لنوبات الهلع — يُبطّئ القلب', en: 'For panic — slows the heart' },
      cycles: 6
    },

    // Coherent: Sleep preparation
    sleep: {
      name: { ar: 'تنفس النوم', en: 'Sleep Breathing' },
      icon: '🌙',
      phases: [
        { name: { ar: 'شهيق عميق', en: 'Deep Inhale' }, duration: 5, icon: '🌬️' },
        { name: { ar: 'زفير هادئ', en: 'Gentle Exhale' }, duration: 5, icon: '🍃' }
      ],
      colors: ['#2D1B69', '#1E1A2E'],
      description: { ar: 'للنوم — يُهيّئ الجسم للراحة', en: 'For sleep — prepares body for rest' },
      cycles: 5
    },

    // Deep calm: Deep relaxation
    calm: {
      name: { ar: 'السكينة العميقة', en: 'Deep Calm' },
      icon: '🧘',
      phases: [
        { name: { ar: 'شهيق', en: 'Inhale' }, duration: 6, icon: '🌬️' },
        { name: { ar: 'إمساك', en: 'Hold' }, duration: 2, icon: '🤲' },
        { name: { ar: 'زفير', en: 'Exhale' }, duration: 8, icon: '🍃' }
      ],
      colors: ['#14B8A6', '#0F766E', '#2DD4BF'],
      description: { ar: 'للاسترخاء العميق — سكينة شاملة', en: 'For deep relaxation — total serenity' },
      cycles: 3
    },

    // Energize: Morning wake-up
    energy: {
      name: { ar: 'تنفس الطاقة', en: 'Energy Breathing' },
      icon: '☀️',
      phases: [
        { name: { ar: 'شهيق سريع', en: 'Quick Inhale' }, duration: 3, icon: '🌬️' },
        { name: { ar: 'إمساك', en: 'Hold' }, duration: 2, icon: '⚡' },
        { name: { ar: 'زفير قوي', en: 'Strong Exhale' }, duration: 3, icon: '💨' }
      ],
      colors: ['#E8C07A', '#F59E0B', '#D97706'],
      description: { ar: 'للنشاط — يُنعش الجسم والذهن', en: 'For energy — refreshes body and mind' },
      cycles: 4
    }
  };

  // ──────── Smart Pattern Selection ────────
  function detectMood() {
    // Check from state if available
    if (typeof state !== 'undefined') {
      if (state.crisisDetected) return 'panic';
      var score = state.burnoutScore || 0;
      if (score >= 8) return 'panic';
      if (score >= 6) return 'anxiety';
      if (score >= 4) return 'stress';
      if (score >= 2) return 'calm';
    }

    // Check time of day
    var hour = new Date().getHours();
    if (hour >= 22 || hour < 5) return 'sleep';
    if (hour >= 5 && hour < 8) return 'energy';

    return 'stress'; // Default
  }

  function selectPattern(mood) {
    return patterns[mood] || patterns.stress;
  }

  // ──────── Pattern Selector UI ────────
  function showPatternSelector() {
    var lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'ar';
    var recommended = detectMood();

    var existing = document.getElementById('breathPatternSelector');
    if (existing) existing.parentNode.removeChild(existing);

    var selector = document.createElement('div');
    selector.id = 'breathPatternSelector';
    selector.className = 'breath-pattern-selector';
    selector.setAttribute('role', 'dialog');
    selector.setAttribute('aria-label', lang === 'ar' ? 'اختر نمط التنفس' : 'Choose breathing pattern');

    var html = '<div class="bps-content">';
    html += '<h3 class="bps-title">' + (lang === 'ar' ? '🌬️ اختر نمط التنفس' : '🌬️ Choose Pattern') + '</h3>';
    html += '<p class="bps-subtitle">' + (lang === 'ar' ? 'نَفَس اختار لك الأنسب بناءً على حالتك' : 'Nafas chose the best pattern for you') + '</p>';

    var patternKeys = Object.keys(patterns);
    for (var i = 0; i < patternKeys.length; i++) {
      var key = patternKeys[i];
      var p = patterns[key];
      var isRecommended = (key === recommended);
      html += '<button class="bps-option' + (isRecommended ? ' recommended' : '') + '" data-pattern="' + key + '">';
      html += '<span class="bps-icon">' + p.icon + '</span>';
      html += '<span class="bps-info">';
      html += '<span class="bps-name">' + p.name[lang] + (isRecommended ? (lang === 'ar' ? ' ⭐ مُقترح' : ' ⭐ Suggested') : '') + '</span>';
      html += '<span class="bps-desc">' + p.description[lang] + '</span>';
      html += '</span>';
      html += '<span class="bps-timing">' + p.phases.map(function(ph) { return ph.duration; }).join('-') + '</span>';
      html += '</button>';
    }

    html += '<button class="bps-close" id="bpsClose">' + (lang === 'ar' ? 'إلغاء' : 'Cancel') + '</button>';
    html += '</div>';

    selector.innerHTML = html;
    document.body.appendChild(selector);

    requestAnimationFrame(function() { selector.classList.add('active'); });

    // Handle clicks
    selector.addEventListener('click', function(e) {
      var btn = e.target.closest('.bps-option');
      if (btn) {
        var patternKey = btn.getAttribute('data-pattern');
        closeSelector();
        startSmartBreathing(patternKey);
        return;
      }
      if (e.target.id === 'bpsClose' || e.target === selector) {
        closeSelector();
      }
    });

    function closeSelector() {
      selector.classList.remove('active');
      setTimeout(function() {
        if (selector.parentNode) selector.parentNode.removeChild(selector);
      }, 400);
    }
  }

  // ──────── Smart Breathing Exercise ────────
  function startSmartBreathing(patternKey) {
    var pattern = patterns[patternKey] || patterns[detectMood()];
    var lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'ar';

    // Use existing overlay
    var overlay = document.getElementById('breathOverlay');
    if (!overlay) return;
    overlay.classList.add('active');

    var canvas = document.getElementById('breathCanvas');
    var ctx = canvas ? canvas.getContext('2d') : null;
    var phaseEl = document.getElementById('breathPhaseText');
    var timerEl = document.getElementById('breathTimerText');
    var glowRing = overlay.querySelector('.breath-glow-ring');
    var label = document.getElementById('breathLabel');

    var phases = pattern.phases;
    var colors = pattern.colors;
    var totalCycles = pattern.cycles;
    var currentPhase = 0;
    var currentCycle = 0;
    var phaseTime = 0;
    var lastTime = performance.now();
    var waveOffset = 0;
    var breathProgress = 0;
    var animFrame = null;
    var autoStop = null;

    // Calculate total time
    var cycleTime = 0;
    for (var p = 0; p < phases.length; p++) cycleTime += phases[p].duration;
    var totalTime = cycleTime * totalCycles * 1000 + 2000;

    // Show pattern name
    if (label) {
      label.textContent = pattern.icon + ' ' + pattern.name[lang];
      label.style.opacity = '0.8';
    }

    function getPhaseColor(idx) {
      return colors[idx % colors.length];
    }

    function updatePhase() {
      var phase = phases[currentPhase];
      var color = getPhaseColor(currentPhase);
      if (phaseEl) {
        phaseEl.textContent = phase.icon + ' ' + phase.name[lang];
        phaseEl.style.color = color;
      }
      if (glowRing) {
        glowRing.style.borderColor = color + '70';
        glowRing.style.boxShadow = '0 0 40px ' + color + '30, inset 0 0 30px ' + color + '15';
      }
      if (navigator.vibrate) navigator.vibrate(50);
      if (typeof state !== 'undefined' && state.voiceEnabled && typeof speak === 'function') {
        speak(phase.name[lang]);
      }
    }

    function drawWave(progress, phaseIdx) {
      if (!ctx) return;
      var w = canvas.width, h = canvas.height;
      var cx = w / 2, cy = h / 2;
      var radius = 100;
      var color = getPhaseColor(phaseIdx);

      ctx.clearRect(0, 0, w, h);

      // Background glow
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + 40);
      grad.addColorStop(0, color + '30');
      grad.addColorStop(0.7, color + '10');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Organic waves (with slight irregularity — alive, not mechanical)
      for (var layer = 0; layer < 3; layer++) {
        ctx.beginPath();
        var isInhale = phases[phaseIdx].name.en === 'Inhale' || phases[phaseIdx].name.en === 'Deep Inhale' || phases[phaseIdx].name.en === 'Quick Inhale';
        var isExhale = phases[phaseIdx].name.en === 'Exhale' || phases[phaseIdx].name.en === 'Gentle Exhale' || phases[phaseIdx].name.en === 'Long Exhale' || phases[phaseIdx].name.en === 'Strong Exhale';
        var amplitude = isInhale ? progress * 22 : (isExhale ? (1 - progress) * 22 : 14);
        // Add organic irregularity
        amplitude += Math.sin(waveOffset * 3.7 + layer) * 2;
        var freq = 5 + layer * 2;
        var layerAlpha = 0.6 - layer * 0.15;

        for (var angle = 0; angle < Math.PI * 2; angle += 0.02) {
          var wave = Math.sin(angle * freq + waveOffset + layer * 1.5) * amplitude;
          wave += Math.sin(angle * 3 + waveOffset * 0.7) * 3; // organic wobble
          var r = radius + wave;
          var x = cx + Math.cos(angle) * r;
          var y = cy + Math.sin(angle) * r;
          if (angle === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = color + Math.round(layerAlpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 2.5 - layer * 0.6;
        ctx.stroke();

        if (layer === 0) {
          var fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius + amplitude);
          fill.addColorStop(0, color + '20');
          fill.addColorStop(1, color + '05');
          ctx.fillStyle = fill;
          ctx.fill();
        }
      }

      // Center particles — organic movement
      for (var i = 0; i < 10; i++) {
        var pAngle = (Math.PI * 2 / 10) * i + waveOffset * 0.5;
        var pDist = 25 + Math.sin(waveOffset * 2.3 + i * 1.1) * 18;
        var px = cx + Math.cos(pAngle) * pDist;
        var py = cy + Math.sin(pAngle) * pDist;
        ctx.beginPath();
        ctx.arc(px, py, 2 + Math.sin(waveOffset + i) * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = color + '60';
        ctx.fill();
      }

      // Cycle counter
      ctx.fillStyle = color + '80';
      ctx.font = '12px "IBM Plex Sans Arabic", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((currentCycle + 1) + '/' + totalCycles, cx, cy + radius + 35);
    }

    function animate(now) {
      var delta = (now - lastTime) / 1000;
      lastTime = now;

      phaseTime += delta;
      var speed = phases[currentPhase].name.en === 'Hold' || phases[currentPhase].name.en === 'Wait' ? 0.3 : 
                  (phases[currentPhase].name.en.includes('Exhale') ? 0.8 : 1.5);
      waveOffset += delta * speed;

      var phaseDuration = phases[currentPhase].duration;
      breathProgress = Math.min(phaseTime / phaseDuration, 1);

      var remaining = Math.ceil(phaseDuration - phaseTime);
      if (timerEl) timerEl.textContent = remaining > 0 ? remaining : '';

      drawWave(breathProgress, currentPhase);

      if (phaseTime >= phaseDuration) {
        phaseTime = 0;
        currentPhase++;
        if (currentPhase >= phases.length) {
          currentPhase = 0;
          currentCycle++;
          if (currentCycle >= totalCycles) {
            finishBreathing();
            return;
          }
        }
        updatePhase();
      }

      animFrame = requestAnimationFrame(animate);
    }

    function finishBreathing() {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (autoStop) clearTimeout(autoStop);
      var doneMsg = lang === 'ar'
        ? '🌟 أحسنت! ' + totalCycles + ' دورات من ' + pattern.name[lang] + ' — كيف تحس الحين؟'
        : '🌟 Well done! ' + totalCycles + ' cycles of ' + pattern.name[lang] + ' — how do you feel?';
      if (label) label.textContent = lang === 'ar' ? 'أحسنت 💙' : 'Well done 💙';
      if (typeof state !== 'undefined' && state.voiceEnabled && typeof speak === 'function') {
        speak(lang === 'ar' ? 'أحسنت' : 'Well done');
      }
      if (typeof addMessage === 'function') addMessage('bot', doneMsg);
    }

    // Start
    updatePhase();
    animFrame = requestAnimationFrame(animate);

    // Safety auto-stop
    autoStop = setTimeout(function() {
      if (animFrame) cancelAnimationFrame(animFrame);
      finishBreathing();
    }, totalTime + 5000);

    // Store cleanup refs
    overlay._smartBreathCleanup = function() {
      if (animFrame) cancelAnimationFrame(animFrame);
      if (autoStop) clearTimeout(autoStop);
    };
  }

  // ──────── Override existing startBreathing ────────
  var _originalStartBreathing = window.startBreathing;
  window.startBreathing = function() {
    showPatternSelector();
  };
  // Keep original accessible
  window.startBreathingClassic = _originalStartBreathing;

  // ──────── Public API ────────
  window.NafasBreathing = {
    patterns: patterns,
    detectMood: detectMood,
    selectPattern: selectPattern,
    showSelector: showPatternSelector,
    start: startSmartBreathing,
    startClassic: _originalStartBreathing
  };

})();
