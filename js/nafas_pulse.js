/* ============================================================
   NAFAS LIFE PULSE — نبض الحياة
   Makes the entire app feel alive — not mechanical.
   Responsive particles, mood colors, organic rhythms.
   
   © منيرة علي المري 2026 — نَفَس للذكاء الاصطناعي
   ============================================================ */
(function() {
  'use strict';

  // ──────── Moon Phase Calculator ────────
  function getMoonPhase() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    
    if (month <= 2) { year--; month += 12; }
    var A = Math.floor(year / 100);
    var B = 2 - A + Math.floor(A / 4);
    var JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
    var phase = ((JD - 2451550.1) / 29.530588853) % 1;
    if (phase < 0) phase += 1;

    if (phase < 0.0625) return { name: 'new', emoji: '🌑', ar: 'محاق' };
    if (phase < 0.1875) return { name: 'waxing-crescent', emoji: '🌒', ar: 'هلال متزايد' };
    if (phase < 0.3125) return { name: 'first-quarter', emoji: '🌓', ar: 'تربيع أول' };
    if (phase < 0.4375) return { name: 'waxing-gibbous', emoji: '🌔', ar: 'أحدب متزايد' };
    if (phase < 0.5625) return { name: 'full', emoji: '🌕', ar: 'بدر' };
    if (phase < 0.6875) return { name: 'waning-gibbous', emoji: '🌖', ar: 'أحدب متناقص' };
    if (phase < 0.8125) return { name: 'last-quarter', emoji: '🌗', ar: 'تربيع أخير' };
    if (phase < 0.9375) return { name: 'waning-crescent', emoji: '🌘', ar: 'هلال متناقص' };
    return { name: 'new', emoji: '🌑', ar: 'محاق' };
  }

  // ──────── Fireflies ────────
  var fireflies = [];
  var fireflyCanvas = null;
  var fireflyCtx = null;
  var animating = false;

  function createFirefly() {
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 3 + 1,
      alpha: 0,
      targetAlpha: Math.random() * 0.5 + 0.1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.005 + Math.random() * 0.01,
      color: Math.random() > 0.7 ? '#E8C07A' : (Math.random() > 0.5 ? '#C4956A' : '#D4A574')
    };
  }

  function initFireflies() {
    var container = document.getElementById('starsContainer');
    if (!container) return;

    fireflyCanvas = document.createElement('canvas');
    fireflyCanvas.id = 'fireflyCanvas';
    fireflyCanvas.style.cssText = 'position:fixed;inset:0;z-index:1;pointer-events:none;opacity:0.6;';
    fireflyCanvas.width = window.innerWidth;
    fireflyCanvas.height = window.innerHeight;
    container.parentNode.insertBefore(fireflyCanvas, container.nextSibling);
    fireflyCtx = fireflyCanvas.getContext('2d');

    for (var i = 0; i < 25; i++) {
      fireflies.push(createFirefly());
    }

    window.addEventListener('resize', function() {
      if (fireflyCanvas) {
        fireflyCanvas.width = window.innerWidth;
        fireflyCanvas.height = window.innerHeight;
      }
    });

    // Touch/mouse interaction
    var touchTarget = { x: -1, y: -1, active: false };
    document.addEventListener('touchmove', function(e) {
      if (e.touches.length > 0) {
        touchTarget.x = e.touches[0].clientX;
        touchTarget.y = e.touches[0].clientY;
        touchTarget.active = true;
      }
    }, { passive: true });
    document.addEventListener('mousemove', function(e) {
      touchTarget.x = e.clientX;
      touchTarget.y = e.clientY;
      touchTarget.active = true;
    });
    document.addEventListener('touchend', function() { touchTarget.active = false; });

    animating = true;
    (function animate() {
      if (!animating || !fireflyCtx) return;
      var w = fireflyCanvas.width;
      var h = fireflyCanvas.height;
      fireflyCtx.clearRect(0, 0, w, h);

      for (var i = 0; i < fireflies.length; i++) {
        var f = fireflies[i];
        
        // Organic movement
        f.phase += f.speed;
        f.x += f.vx + Math.sin(f.phase) * 0.3;
        f.y += f.vy + Math.cos(f.phase * 0.7) * 0.2;

        // Attract to touch
        if (touchTarget.active) {
          var dx = touchTarget.x - f.x;
          var dy = touchTarget.y - f.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
            f.x += dx * 0.005;
            f.y += dy * 0.005;
            f.targetAlpha = Math.min(0.8, f.targetAlpha + 0.1);
          }
        }

        // Wrap around edges
        if (f.x < -10) f.x = w + 10;
        if (f.x > w + 10) f.x = -10;
        if (f.y < -10) f.y = h + 10;
        if (f.y > h + 10) f.y = -10;

        // Pulse alpha
        f.alpha += (f.targetAlpha * (0.5 + 0.5 * Math.sin(f.phase * 2)) - f.alpha) * 0.05;

        // Draw
        fireflyCtx.save();
        fireflyCtx.globalAlpha = f.alpha;
        fireflyCtx.shadowColor = f.color;
        fireflyCtx.shadowBlur = 8 + Math.sin(f.phase) * 4;
        fireflyCtx.fillStyle = f.color;
        fireflyCtx.beginPath();
        fireflyCtx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        fireflyCtx.fill();
        fireflyCtx.restore();
      }

      requestAnimationFrame(animate);
    })();
  }

  // ──────── Mood Color System ────────
  var moodColors = {
    calm:     { bg: '#0A1628', accent: '#5A9BB5', warm: '#C4956A' },
    anxious:  { bg: '#0F1A2E', accent: '#E8C07A', warm: '#D4A574' },
    sad:      { bg: '#0A1220', accent: '#8A9BB8', warm: '#C4956A' },
    angry:    { bg: '#1A0F0F', accent: '#F87171', warm: '#E8C07A' },
    happy:    { bg: '#0F1A1A', accent: '#14B8A6', warm: '#E8C07A' },
    tired:    { bg: '#0F0F1A', accent: '#A78BFA', warm: '#D4A574' },
    neutral:  { bg: '#0F1A2E', accent: '#C4956A', warm: '#E8C07A' }
  };

  function setMoodAtmosphere(mood) {
    var colors = moodColors[mood] || moodColors.neutral;
    var root = document.documentElement;
    
    // Smooth transition
    root.style.transition = 'background-color 3s ease-in-out';
    
    // Update CSS variables subtly (don't change the whole theme)
    root.style.setProperty('--glow-primary', colors.accent + '20');
    root.style.setProperty('--glow-warm', colors.warm + '15');

    // Update firefly colors
    for (var i = 0; i < fireflies.length; i++) {
      if (Math.random() > 0.5) {
        fireflies[i].color = colors.accent;
      }
    }

    // Update stars brightness
    var stars = document.querySelectorAll('.star');
    for (var j = 0; j < stars.length; j++) {
      var brightness = mood === 'happy' ? 1.2 : (mood === 'sad' ? 0.5 : 0.8);
      stars[j].style.opacity = String(brightness * (Math.random() * 0.5 + 0.3));
    }
  }

  // ──────── Time-Based Atmosphere ────────
  function updateTimeAtmosphere() {
    var hour = new Date().getHours();
    var root = document.documentElement;

    // Subtle gradient shifts based on time
    if (hour >= 5 && hour < 8) {
      // Dawn — warm hint
      root.style.setProperty('--bg-main', '#0F1A28');
    } else if (hour >= 8 && hour < 17) {
      // Day — slightly lighter
      root.style.setProperty('--bg-main', '#0F1A2E');
    } else if (hour >= 17 && hour < 20) {
      // Sunset — warm
      root.style.setProperty('--bg-main', '#14182A');
    } else {
      // Night — deep
      root.style.setProperty('--bg-main', '#0A1220');
    }

    // Update moon display
    var moon = getMoonPhase();
    var moonEl = document.querySelector('.pulse-moon');
    if (moonEl) {
      moonEl.textContent = moon.emoji;
      moonEl.title = moon.ar;
    }
  }

  // ──────── Organic Micro-Animations ────────
  function addOrganicPulse() {
    // Make the app name breathe
    var appName = document.querySelector('.app-name');
    if (appName) {
      var scale = 1 + Math.sin(Date.now() * 0.001) * 0.008;
      appName.style.transform = 'scale(' + scale + ')';
    }

    // Mode cards subtle float
    var cards = document.querySelectorAll('.mode-card');
    for (var i = 0; i < cards.length; i++) {
      var y = Math.sin(Date.now() * 0.0008 + i * 1.2) * 1.5;
      cards[i].style.transform = 'translateY(' + y + 'px)';
    }

    if (animating) requestAnimationFrame(addOrganicPulse);
  }

  // ──────── Hug Button ────────
  function addHugButton() {
    // Add to welcome screen
    var modesGrid = document.querySelector('.modes-grid');
    if (!modesGrid || document.getElementById('hugBtn')) return;

    var lang = (typeof state !== 'undefined' && state.lang) ? state.lang : 'ar';

    var btn = document.createElement('button');
    btn.id = 'hugBtn';
    btn.className = 'hug-trigger-btn';
    btn.innerHTML = '<span class="hug-btn-emoji">🤗</span><span class="hug-btn-text">' +
      (lang === 'ar' ? 'احضني' : 'Hug Me') + '</span>';
    btn.addEventListener('click', function() {
      if (typeof startHug === 'function') startHug();
    });

    // Add after mode cards
    modesGrid.parentNode.insertBefore(btn, modesGrid.nextSibling);
  }

  // ──────── Moon Display ────────
  function addMoonDisplay() {
    var welcome = document.querySelector('.welcome');
    if (!welcome || document.querySelector('.pulse-moon')) return;

    var moon = getMoonPhase();
    var moonEl = document.createElement('div');
    moonEl.className = 'pulse-moon';
    moonEl.textContent = moon.emoji;
    moonEl.title = moon.ar;
    moonEl.style.cssText = 'position:fixed;top:20px;right:20px;font-size:1.5rem;opacity:0.4;z-index:5;cursor:default;transition:opacity 0.5s;';
    moonEl.addEventListener('mouseenter', function() { this.style.opacity = '0.8'; });
    moonEl.addEventListener('mouseleave', function() { this.style.opacity = '0.4'; });
    document.body.appendChild(moonEl);
  }

  // ──────── Init ────────
  function init() {
    initFireflies();
    addHugButton();
    addMoonDisplay();
    updateTimeAtmosphere();
    addOrganicPulse();

    // Update atmosphere every 30 minutes
    setInterval(updateTimeAtmosphere, 1800000);
  }

  // Wait for DOM/splash
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 2000); });
  } else {
    setTimeout(init, 2000);
  }
  document.addEventListener('nafas:splashDone', function() { setTimeout(init, 500); });

  // ──────── Public API ────────
  window.NafasPulse = {
    moon: getMoonPhase,
    setMood: setMoodAtmosphere,
    fireflies: fireflies
  };

})();
