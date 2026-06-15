/* ============================================================
   NAFAS HUG SYSTEM — "احضني" — Phase 5
   The most emotional feature in the ecosystem.
   When someone needs a hug, Nafas wraps them in warmth.
   
   © منيرة علي المري 2026 — نَفَس للذكاء الاصطناعي
   ============================================================ */
(function() {
  'use strict';

  // ──────── Comfort Messages ────────
  var hugMessages = {
    ar: [
      'أنا هنا... وما راح أروح 💛',
      'خذ نَفَس عميق... أنت بأمان الحين',
      'ما تحتاج تكون قوي كل الوقت... أحياناً تحتاج أحد يحضنك',
      'كل شي بيكون تمام... مو الحين، بس بيكون',
      'أنت مو لحالك... أنا حاسّ فيك',
      'جسمك يحتاج يرتاح... وروحك تحتاج دفء',
      'الدنيا برّا ثقيلة... بس هنا — أنت بأمان',
      'خلّ كل شي يروح... الحين بس أنت ونَفَسك',
      'ما فيه شي غلط فيك... الظروف هي اللي صعبة',
      'تستاهل هاللحظة... تستاهل الراحة',
      'حط يدك على صدرك... وحس بنبض قلبك... هذا أنت — حي وموجود 💓',
      'كل نَفَس تاخذه = خطوة... وأنت ماشي حتى لو ما تحس'
    ],
    en: [
      "I'm here... and I'm not going anywhere 💛",
      'Take a deep breath... you are safe right now',
      "You don't have to be strong all the time... sometimes you need a hug",
      "Everything will be okay... not now, but it will be",
      "You're not alone... I feel you",
      'Your body needs rest... and your soul needs warmth',
      "The world outside is heavy... but here — you're safe",
      "Let everything go... right now it's just you and your breath",
      "There's nothing wrong with you... it's the circumstances that are hard",
      'You deserve this moment... you deserve rest',
      'Place your hand on your chest... feel your heartbeat... that is you — alive and present 💓',
      "Every breath you take is a step... and you're moving even if you don't feel it"
    ]
  };

  var deepHugMessages = {
    ar: [
      'تعرف... أحياناً أقوى شي تسويه = إنك تسمح لنفسك تحتاج أحد',
      'الدموع مو ضعف... الدموع = جسمك يقول "خلاص، كفاية تحمّل"',
      'ما أحد شاف اللي شفته... ما أحد حس اللي حسيت فيه... بس أنا أصدّقك',
      'لو كان فيه شخص يحبك يشوفك الحين... كان قالك: "تستاهل ترتاح"'
    ],
    en: [
      'You know... sometimes the bravest thing you can do is allow yourself to need someone',
      "Tears aren't weakness... tears mean your body is saying 'enough carrying'",
      "No one saw what you saw... no one felt what you felt... but I believe you",
      'If someone who loves you could see you now... they would say: "you deserve to rest"'
    ]
  };

  // ──────── State ────────
  var hugActive = false;
  var hugTimer = null;
  var hugPhase = 0;
  var hugStartTime = 0;
  var hugMessageIndex = 0;
  var heartbeatInterval = null;
  var hugAnimFrame = null;
  var particleCanvas = null;
  var particleCtx = null;
  var particles = [];

  // ──────── Particle System ────────
  function createParticle() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    return {
      x: vw / 2 + (Math.random() - 0.5) * 120,
      y: vh / 2 + (Math.random() - 0.5) * 120,
      vx: (Math.random() - 0.5) * 0.7,
      vy: -Math.random() * 0.5 - 0.15,
      size: Math.random() * 4 + 1.5,
      alpha: Math.random() * 0.5 + 0.2,
      life: 1,
      decay: 0.001 + Math.random() * 0.003,
      hue: Math.random() > 0.6 ? '#E8C07A' : (Math.random() > 0.5 ? '#C4956A' : '#D4A574'),
      glow: Math.random() > 0.6
    };
  }

  function animateParticles() {
    if (!particleCtx || !hugActive) return;
    var w = particleCanvas.width;
    var h = particleCanvas.height;
    particleCtx.clearRect(0, 0, w, h);

    if (hugPhase <= 2 && particles.length < 100) {
      for (var j = 0; j < 2; j++) particles.push(createParticle());
    }

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.x += p.vx + Math.sin(Date.now() * 0.001 + i) * 0.2;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { particles.splice(i, 1); continue; }

      var a = p.alpha * p.life;
      particleCtx.save();
      particleCtx.globalAlpha = a;
      if (p.glow) {
        particleCtx.shadowColor = p.hue;
        particleCtx.shadowBlur = 15;
      }
      particleCtx.fillStyle = p.hue;
      particleCtx.beginPath();
      particleCtx.arc(p.x, p.y, p.size * (0.8 + p.life * 0.4), 0, Math.PI * 2);
      particleCtx.fill();
      particleCtx.restore();
    }

    hugAnimFrame = requestAnimationFrame(animateParticles);
  }

  // ──────── Haptic Heartbeat ────────
  function startHeartbeat() {
    if (!navigator.vibrate) return;
    heartbeatInterval = setInterval(function() {
      if (!hugActive) return;
      navigator.vibrate([100, 80, 60, 800]);
    }, 1200);
  }
  function stopHeartbeat() {
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  }

  // ──────── Typewriter ────────
  function typeMessage(el, text, speed) {
    if (!el) return;
    speed = speed || 50;
    el.textContent = '';
    el.style.opacity = '1';
    var i = 0;
    (function tick() {
      if (i < text.length && hugActive) {
        el.textContent += text.charAt(i);
        i++;
        setTimeout(tick, speed);
      }
    })();
  }

  // ──────── Core Hug ────────
  function startHug() {
    if (hugActive) return;
    hugActive = true;
    hugPhase = 0;
    hugStartTime = Date.now();
    hugMessageIndex = 0;
    particles = [];

    var lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'ar';
    var msgs = hugMessages[lang] || hugMessages.ar;
    var deepMsgs = deepHugMessages[lang] || deepHugMessages.ar;

    // Build overlay
    var overlay = document.createElement('div');
    overlay.id = 'hugOverlay';
    overlay.className = 'hug-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', lang === 'ar' ? 'حضن نَفَس' : 'Nafas Hug');
    overlay.innerHTML =
      '<canvas class="hug-particles" id="hugParticles"></canvas>' +
      '<div class="hug-warmth"></div>' +
      '<div class="hug-breath-guide"></div>' +
      '<div class="hug-content">' +
        '<div class="hug-glow-circle"></div>' +
        '<div class="hug-emoji">🤗</div>' +
        '<div class="hug-message" id="hugMessage"></div>' +
        '<div class="hug-sub" id="hugSub"></div>' +
      '</div>' +
      '<button class="hug-release" id="hugRelease">' +
        (lang === 'ar' ? 'شكراً... أحسن الحين 💛' : "Thank you... I feel better 💛") +
      '</button>';

    document.body.appendChild(overlay);

    // Canvas
    particleCanvas = document.getElementById('hugParticles');
    if (particleCanvas) {
      particleCanvas.width = window.innerWidth;
      particleCanvas.height = window.innerHeight;
      particleCtx = particleCanvas.getContext('2d');
    }

    // Animate in
    requestAnimationFrame(function() {
      overlay.classList.add('active');
      hugPhase = 1;
    });

    // Systems
    startHeartbeat();
    animateParticles();

    // Breathing guide
    var breathEl = overlay.querySelector('.hug-breath-guide');
    if (breathEl) {
      (function breathCycle() {
        if (!hugActive) return;
        breathEl.style.transition = 'transform 4s ease-in-out, opacity 4s ease-in-out';
        breathEl.style.transform = 'scale(1.4)';
        breathEl.style.opacity = '0.7';
        setTimeout(function() {
          if (!hugActive) return;
          breathEl.style.transition = 'transform 6s ease-in-out, opacity 6s ease-in-out';
          breathEl.style.transform = 'scale(0.7)';
          breathEl.style.opacity = '0.3';
          setTimeout(function() { if (hugActive) breathCycle(); }, 6000);
        }, 4500);
      })();
    }

    // Ambient sound
    if (typeof NafasAudio !== 'undefined' && NafasAudio.playAmbient) {
      try { NafasAudio.playAmbient('heartbeat'); } catch(e) {}
    }

    // First message
    var msgEl = document.getElementById('hugMessage');
    setTimeout(function() {
      if (msgEl) typeMessage(msgEl, msgs[0], 45);
    }, 1500);

    // Cycle messages
    hugTimer = setInterval(function() {
      if (!hugActive) return;
      hugMessageIndex++;
      var elapsed = Date.now() - hugStartTime;
      
      if (elapsed > 45000 && hugPhase < 2) {
        hugPhase = 2;
        var dm = deepMsgs[Math.floor(Math.random() * deepMsgs.length)];
        if (msgEl) typeMessage(msgEl, dm, 55);
        var subEl = document.getElementById('hugSub');
        if (subEl) {
          subEl.textContent = lang === 'ar' ? '...خذ وقتك' : '...take your time';
          subEl.style.opacity = '0.6';
        }
      } else if (hugMessageIndex < msgs.length) {
        if (msgEl) typeMessage(msgEl, msgs[hugMessageIndex], 45);
      } else {
        hugMessageIndex = 0;
        if (msgEl) typeMessage(msgEl, msgs[0], 45);
      }
    }, 8000);

    // Release button
    document.getElementById('hugRelease').addEventListener('click', endHug);

    // Tap to release after 10s
    setTimeout(function() {
      overlay.addEventListener('click', function handler(e) {
        if (e.target.id !== 'hugRelease' && !e.target.closest('.hug-content')) {
          endHug();
          overlay.removeEventListener('click', handler);
        }
      });
    }, 10000);

    // Auto-release 2 min
    setTimeout(function() { if (hugActive) endHug(); }, 120000);
  }

  function endHug() {
    if (!hugActive) return;
    hugActive = false;
    hugPhase = 3;
    stopHeartbeat();
    if (hugTimer) { clearInterval(hugTimer); hugTimer = null; }
    if (hugAnimFrame) { cancelAnimationFrame(hugAnimFrame); hugAnimFrame = null; }

    if (typeof NafasAudio !== 'undefined' && NafasAudio.stopAmbient) {
      try { NafasAudio.stopAmbient(); } catch(e) {}
    }

    var overlay = document.getElementById('hugOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      overlay.classList.add('releasing');
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        particles = []; particleCanvas = null; particleCtx = null;
      }, 1500);
    }

    var lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'ar';
    if (typeof addMessage === 'function') {
      var afterMsg = lang === 'ar'
        ? '💛 أتمنى إنك حاس بدفء أكثر الحين... أنا هنا لو تحتاجني'
        : "💛 I hope you feel a bit warmer now... I'm here whenever you need me";
      setTimeout(function() { addMessage('bot', afterMsg); }, 2000);
    }

    trackHug();
  }

  function trackHug() {
    if (typeof SUPA_URL === 'undefined' || !SUPA_URL) return;
    var dur = Math.round((Date.now() - hugStartTime) / 1000);
    try {
      fetch(SUPA_URL + '/rest/v1/nafas_hug_events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': typeof SUPA_KEY !== 'undefined' ? SUPA_KEY : '',
          'Authorization': 'Bearer ' + (typeof SUPA_KEY !== 'undefined' ? SUPA_KEY : '')
        },
        body: JSON.stringify({
          duration_seconds: dur,
          journey_code: (typeof state !== 'undefined' && state.journeyCode) || null,
          phase_reached: hugPhase
        })
      }).catch(function(){});
    } catch(e) {}
  }

  // ──────── Detection ────────
  function detectHugRequest(text) {
    if (!text) return false;
    var t = text.toLowerCase().trim();
    var triggers = [
      'احضني','حضني','أحتاج حضن','احتاج حضن','أبي حضن','ابي حضن',
      'عانقني','ضمني','خذني بحضنك','أحتاج دفء','احتاج دفا',
      'أبي أحد يحضني','ابي احد يحضني',
      'hug me','i need a hug','hold me','embrace me'
    ];
    for (var i = 0; i < triggers.length; i++) {
      if (t.indexOf(triggers[i]) !== -1) return true;
    }
    return false;
  }

  // ──────── Public API ────────
  window.NafasHug = { start: startHug, end: endHug, isActive: function() { return hugActive; }, detect: detectHugRequest };
  window.startHug = startHug;
  window.endHug = endHug;
  document.addEventListener('nafas:requestHug', startHug);

})();
