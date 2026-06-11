/**
 * Nafas Audio System — نَفَس
 * Web Audio API-based sound library for ambient, UI, and breathing sounds.
 * Self-contained. Does NOT modify app.js.
 *
 * © منيرة علي المري 2026 — بوابة الجود الذكية
 */

(function () {
  'use strict';

  /* ───────── Sound metadata ───────── */
  const SOUND_LABELS = {
    heartbeat: { icon: '💓', name: 'نبض قلب', nameEn: 'Heartbeat' },
    rain:      { icon: '🌧️', name: 'مطر هادئ', nameEn: 'Rain' },
    humming:   { icon: '🎵', name: 'همهمة', nameEn: 'Humming' },
    breeze:    { icon: '🌬️', name: 'نسمة صحراء', nameEn: 'Desert Breeze' },
    ocean:     { icon: '🌊', name: 'أمواج', nameEn: 'Ocean Waves' },
  };

  /* ───────── Internal state ───────── */
  let audioCtx = null;
  let masterGain = null;
  let ambientGain = null;
  let uiGain = null;
  let breathGain = null;

  let _isMuted = false;
  let _masterVolume = 0.5;
  let _ambientVolume = 0.6;
  let _uiVolume = 0.7;

  // Currently playing ambient nodes (to clean up)
  let _ambientNodes = [];
  let _ambientCurrent = null;

  // Breathing nodes
  let _breathNodes = [];

  // Panel state
  let _panelOpen = false;

  /* ───────── Helpers ───────── */
  function now() { return audioCtx ? audioCtx.currentTime : 0; }

  function createNoiseBuffer(type, seconds) {
    // type: 'white' | 'pink'
    seconds = seconds || 2;
    const sr = audioCtx.sampleRate;
    const len = sr * seconds;
    const buf = audioCtx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else {
      // Pink noise (Paul Kellet's algorithm)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    return buf;
  }

  function stopNodes(arr) {
    arr.forEach(function (n) {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
      } catch (_) { /* already stopped */ }
    });
    arr.length = 0;
  }

  /* Musical frequencies */
  const NOTE = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
    A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99,
    A5: 880.00, B5: 987.77, C6: 1046.50,
  };

  /* ═══════════════════════════════════════════
     AMBIENT SOUND GENERATORS
     Each returns an array of nodes to track.
     ═══════════════════════════════════════════ */

  function ambientHeartbeat() {
    var nodes = [];
    var t = now();
    // Double-pulse (lub-dub) repeating every 1.2s
    function pulse(startTime) {
      // "Lub"
      var osc1 = audioCtx.createOscillator();
      var g1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 50;
      g1.gain.setValueAtTime(0, startTime);
      g1.gain.linearRampToValueAtTime(0.35, startTime + 0.04);
      g1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
      osc1.connect(g1).connect(ambientGain);
      osc1.start(startTime);
      osc1.stop(startTime + 0.2);
      nodes.push(osc1, g1);

      // "Dub"
      var osc2 = audioCtx.createOscillator();
      var g2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 42;
      g2.gain.setValueAtTime(0, startTime + 0.22);
      g2.gain.linearRampToValueAtTime(0.25, startTime + 0.26);
      g2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.42);
      osc2.connect(g2).connect(ambientGain);
      osc2.start(startTime + 0.22);
      osc2.stop(startTime + 0.44);
      nodes.push(osc2, g2);
    }

    // Schedule 60 seconds of heartbeats then loop
    var interval = 1.2;
    var count = Math.ceil(60 / interval);
    for (var i = 0; i < count; i++) {
      pulse(t + i * interval);
    }

    // Repeat via setInterval
    var iv = setInterval(function () {
      if (_ambientCurrent !== 'heartbeat') { clearInterval(iv); return; }
      var base = now();
      for (var i = 0; i < count; i++) pulse(base + i * interval);
    }, 58000);

    // Store interval id for cleanup
    nodes._interval = iv;
    return nodes;
  }

  function ambientRain() {
    var nodes = [];
    var noiseBuf = createNoiseBuffer('white', 4);

    // Main rain bed
    var src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 0.7;
    var g = audioCtx.createGain();
    g.gain.value = 0.25;
    src.connect(bp).connect(g).connect(ambientGain);
    src.start();
    nodes.push(src, bp, g);

    // Random drop layer
    var src2 = audioCtx.createBufferSource();
    src2.buffer = noiseBuf;
    src2.loop = true;
    var hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    var g2 = audioCtx.createGain();
    g2.gain.value = 0.08;

    // Slow random modulation via LFO
    var lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    var lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(g2.gain);
    lfo.start();

    src2.connect(hp).connect(g2).connect(ambientGain);
    src2.start();
    nodes.push(src2, hp, g2, lfo, lfoGain);

    return nodes;
  }

  function ambientHumming() {
    var nodes = [];
    // Fundamental ~180Hz with vibrato
    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 180;

    // Vibrato LFO
    var vib = audioCtx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 5;
    var vibGain = audioCtx.createGain();
    vibGain.gain.value = 5; // ±5Hz
    vib.connect(vibGain).connect(osc.frequency);
    vib.start();

    var g = audioCtx.createGain();
    g.gain.value = 0.12;
    osc.connect(g).connect(ambientGain);
    osc.start();
    nodes.push(osc, vib, vibGain, g);

    // 2nd harmonic
    var osc2 = audioCtx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 360;
    var g2 = audioCtx.createGain();
    g2.gain.value = 0.04;
    osc2.connect(g2).connect(ambientGain);
    osc2.start();
    nodes.push(osc2, g2);

    // 3rd harmonic
    var osc3 = audioCtx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.value = 540;
    var g3 = audioCtx.createGain();
    g3.gain.value = 0.015;
    osc3.connect(g3).connect(ambientGain);
    osc3.start();
    nodes.push(osc3, g3);

    return nodes;
  }

  function ambientBreeze() {
    var nodes = [];
    var noiseBuf = createNoiseBuffer('pink', 4);

    var src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    var lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.5;

    var g = audioCtx.createGain();
    g.gain.value = 0.18;

    // Slow amplitude modulation (8-12s cycle → ~0.1Hz)
    var lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.1; // ~10s cycle
    var lfoG = audioCtx.createGain();
    lfoG.gain.value = 0.1;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();

    src.connect(lp).connect(g).connect(ambientGain);
    src.start();
    nodes.push(src, lp, g, lfo, lfoG);

    return nodes;
  }

  function ambientOcean() {
    var nodes = [];
    var noiseBuf = createNoiseBuffer('white', 4);

    var src = audioCtx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;

    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.4;

    var g = audioCtx.createGain();
    g.gain.value = 0.22;

    // Wave rhythm: amplitude modulated with slow sine (10-15s)
    var lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08; // ~12.5s period
    var lfoG = audioCtx.createGain();
    lfoG.gain.value = 0.15;
    lfo.connect(lfoG).connect(g.gain);
    lfo.start();

    src.connect(bp).connect(g).connect(ambientGain);
    src.start();
    nodes.push(src, bp, g, lfo, lfoG);

    // Lighter foam layer
    var src2 = audioCtx.createBufferSource();
    src2.buffer = noiseBuf;
    src2.loop = true;
    var hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    var g2 = audioCtx.createGain();
    g2.gain.value = 0.04;
    var lfo2 = audioCtx.createOscillator();
    lfo2.type = 'sine';
    lfo2.frequency.value = 0.07;
    var lfoG2 = audioCtx.createGain();
    lfoG2.gain.value = 0.03;
    lfo2.connect(lfoG2).connect(g2.gain);
    lfo2.start();
    src2.connect(hp).connect(g2).connect(ambientGain);
    src2.start();
    nodes.push(src2, hp, g2, lfo2, lfoG2);

    return nodes;
  }

  var AMBIENT_GENERATORS = {
    heartbeat: ambientHeartbeat,
    rain: ambientRain,
    humming: ambientHumming,
    breeze: ambientBreeze,
    ocean: ambientOcean,
  };

  /* ═══════════════════════════════════════════
     UI SOUND GENERATORS (one-shot)
     ═══════════════════════════════════════════ */

  function playTone(freq, startTime, duration, gain, type) {
    type = type || 'sine';
    var osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(gain, startTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(g).connect(uiGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  function uiAppOpen() {
    var t = now();
    playTone(NOTE.C5, t, 0.35, 0.15);
    playTone(NOTE.E5, t + 0.12, 0.35, 0.12);
    playTone(NOTE.G5, t + 0.24, 0.45, 0.10);
  }

  function uiSessionStart() {
    var t = now();
    // Descending tones — settle down
    playTone(NOTE.G5, t, 0.5, 0.12);
    playTone(NOTE.E5, t + 0.18, 0.55, 0.10);
    playTone(NOTE.C5, t + 0.36, 0.7, 0.10);
  }

  function uiSessionEnd() {
    var t = now();
    // Ascending warm chord with long sustain
    playTone(NOTE.C4, t, 1.5, 0.10);
    playTone(NOTE.E4, t + 0.1, 1.5, 0.09);
    playTone(NOTE.G4, t + 0.2, 1.4, 0.08);
    playTone(NOTE.C5, t + 0.3, 1.8, 0.07);
  }

  function uiAchievement() {
    var t = now();
    var notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E5, NOTE.G5];
    notes.forEach(function (f, i) {
      // Shimmer via detuned pairs
      playTone(f, t + i * 0.06, 0.3, 0.08);
      playTone(f * 1.005, t + i * 0.06, 0.3, 0.06); // slight detune
    });
  }

  function uiMessage() {
    var t = now();
    playTone(NOTE.A5, t, 0.18, 0.10);
  }

  function uiTransition() {
    // Short filtered noise sweep
    var buf = createNoiseBuffer('white', 0.3);
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(300, now());
    bp.frequency.linearRampToValueAtTime(3000, now() + 0.15);
    bp.Q.value = 1;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.12, now());
    g.gain.exponentialRampToValueAtTime(0.001, now() + 0.25);
    src.connect(bp).connect(g).connect(uiGain);
    src.start();
    src.stop(now() + 0.3);
  }

  var UI_SOUNDS = {
    appOpen: uiAppOpen,
    sessionStart: uiSessionStart,
    sessionEnd: uiSessionEnd,
    achievement: uiAchievement,
    message: uiMessage,
    transition: uiTransition,
  };

  /* ═══════════════════════════════════════════
     BREATHING SYNC
     ═══════════════════════════════════════════ */

  function breathInhale(duration) {
    duration = duration || 4;
    stopNodes(_breathNodes);
    var t = now();

    var buf = createNoiseBuffer('pink', 2);
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.linearRampToValueAtTime(1200, t + duration);
    bp.Q.value = 1;

    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.12, t + duration);

    src.connect(bp).connect(g).connect(breathGain);
    src.start(t);
    src.stop(t + duration + 0.1);
    _breathNodes.push(src, bp, g);
  }

  function breathHold(duration) {
    duration = duration || 7;
    stopNodes(_breathNodes);
    var t = now();

    var osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 220;
    var g = audioCtx.createGain();
    g.gain.value = 0.015; // very faint
    osc.connect(g).connect(breathGain);
    osc.start(t);
    osc.stop(t + duration + 0.1);
    _breathNodes.push(osc, g);
  }

  function breathExhale(duration) {
    duration = duration || 6;
    stopNodes(_breathNodes);
    var t = now();

    var buf = createNoiseBuffer('pink', 2);
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.linearRampToValueAtTime(300, t + duration);
    bp.Q.value = 0.8;

    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.linearRampToValueAtTime(0.001, t + duration);

    src.connect(bp).connect(g).connect(breathGain);
    src.start(t);
    src.stop(t + duration + 0.1);
    _breathNodes.push(src, bp, g);
  }

  /* ═══════════════════════════════════════════
     PANEL UI
     ═══════════════════════════════════════════ */

  function buildSoundOptions() {
    var container = document.getElementById('soundOptions');
    if (!container) return;
    container.innerHTML = '';

    // "No sound" option
    var none = document.createElement('div');
    none.className = 'sound-option sound-option-none' + (_ambientCurrent === null ? ' active' : '');
    none.setAttribute('data-sound', 'none');
    none.innerHTML = '<span class="sound-option-icon">🔇</span><span class="sound-option-name">بدون صوت</span>';
    none.onclick = function () {
      NafasAudio.ambient.stop();
      updateOptionUI();
    };
    container.appendChild(none);

    Object.keys(SOUND_LABELS).forEach(function (key) {
      var info = SOUND_LABELS[key];
      var el = document.createElement('div');
      el.className = 'sound-option' + (_ambientCurrent === key ? ' active' : '');
      el.setAttribute('data-sound', key);
      el.innerHTML =
        '<span class="sound-option-icon">' + info.icon + '</span>' +
        '<span class="sound-option-name">' + info.name + '</span>' +
        '<span class="sound-option-eq">' +
          '<span class="sound-eq-bar"></span>' +
          '<span class="sound-eq-bar"></span>' +
          '<span class="sound-eq-bar"></span>' +
        '</span>';
      el.onclick = function () {
        if (_ambientCurrent === key) {
          NafasAudio.ambient.stop();
        } else {
          NafasAudio.ambient.play(key);
        }
        updateOptionUI();
      };
      container.appendChild(el);
    });
  }

  function updateOptionUI() {
    var opts = document.querySelectorAll('.sound-option');
    opts.forEach(function (el) {
      var s = el.getAttribute('data-sound');
      if (s === 'none') {
        el.classList.toggle('active', _ambientCurrent === null);
      } else {
        el.classList.toggle('active', _ambientCurrent === s);
      }
    });
    // FAB active state
    var fab = document.getElementById('soundFab');
    if (fab) fab.classList.toggle('active', _ambientCurrent !== null);
  }

  function togglePanel() {
    _panelOpen = !_panelOpen;
    var panel = document.getElementById('soundPanel');
    if (panel) {
      panel.classList.toggle('visible', _panelOpen);
    }
    if (_panelOpen) buildSoundOptions();
  }

  /* ═══════════════════════════════════════════
     PUBLIC API: window.NafasAudio
     ═══════════════════════════════════════════ */

  var NafasAudio = {

    /** Initialize AudioContext — must be called after a user gesture */
    init: function () {
      if (audioCtx) return;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.warn('[NafasAudio] Web Audio not supported', e);
        return;
      }

      masterGain = audioCtx.createGain();
      masterGain.gain.value = _masterVolume;
      masterGain.connect(audioCtx.destination);

      ambientGain = audioCtx.createGain();
      ambientGain.gain.value = _ambientVolume;
      ambientGain.connect(masterGain);

      uiGain = audioCtx.createGain();
      uiGain.gain.value = _uiVolume;
      uiGain.connect(masterGain);

      breathGain = audioCtx.createGain();
      breathGain.gain.value = 0.5;
      breathGain.connect(masterGain);
    },

    /* ── Ambient ── */
    ambient: {
      available: ['heartbeat', 'rain', 'humming', 'breeze', 'ocean'],
      get current() { return _ambientCurrent; },

      play: function (soundName) {
        NafasAudio.init();
        if (!audioCtx) return;
        // Resume suspended context
        if (audioCtx.state === 'suspended') audioCtx.resume();
        // Stop previous ambient
        this.stop();
        if (AMBIENT_GENERATORS[soundName]) {
          _ambientNodes = AMBIENT_GENERATORS[soundName]();
          _ambientCurrent = soundName;
          try { localStorage.setItem('nafas_ambient', soundName); } catch (_) {}
        }
        updateOptionUI();
      },

      stop: function () {
        if (_ambientNodes._interval) clearInterval(_ambientNodes._interval);
        stopNodes(_ambientNodes);
        _ambientCurrent = null;
        try { localStorage.removeItem('nafas_ambient'); } catch (_) {}
        updateOptionUI();
      },

      setVolume: function (v) {
        _ambientVolume = Math.max(0, Math.min(1, v));
        if (ambientGain) ambientGain.gain.value = _ambientVolume;
      },
    },

    /* ── UI sounds ── */
    ui: {
      play: function (soundName) {
        NafasAudio.init();
        if (!audioCtx || _isMuted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (UI_SOUNDS[soundName]) UI_SOUNDS[soundName]();
      },
      setVolume: function (v) {
        _uiVolume = Math.max(0, Math.min(1, v));
        if (uiGain) uiGain.gain.value = _uiVolume;
      },
    },

    /* ── Breathing ── */
    breathing: {
      inhale: function (duration) {
        NafasAudio.init();
        if (!audioCtx || _isMuted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        breathInhale(duration);
      },
      hold: function (duration) {
        NafasAudio.init();
        if (!audioCtx || _isMuted) return;
        breathHold(duration);
      },
      exhale: function (duration) {
        NafasAudio.init();
        if (!audioCtx || _isMuted) return;
        breathExhale(duration);
      },
      stop: function () { stopNodes(_breathNodes); },
    },

    /* ── Master controls ── */
    get isMuted() { return _isMuted; },
    get masterVolume() { return _masterVolume; },

    mute: function () {
      _isMuted = true;
      if (masterGain) masterGain.gain.value = 0;
    },
    unmute: function () {
      _isMuted = false;
      if (masterGain) masterGain.gain.value = _masterVolume;
    },
    setMasterVolume: function (v) {
      _masterVolume = Math.max(0, Math.min(1, v));
      if (!_isMuted && masterGain) masterGain.gain.value = _masterVolume;
    },

    /* ── Panel toggle ── */
    togglePanel: togglePanel,
  };

  window.NafasAudio = NafasAudio;

  /* ═══════════════════════════════════════════
     AUTO-INIT ON FIRST USER INTERACTION
     ═══════════════════════════════════════════ */

  var _autoInitDone = false;
  function autoInit() {
    if (_autoInitDone) return;
    _autoInitDone = true;
    NafasAudio.init();

    // Restore previous ambient from localStorage
    try {
      var saved = localStorage.getItem('nafas_ambient');
      if (saved && AMBIENT_GENERATORS[saved]) {
        NafasAudio.ambient.play(saved);
      }
    } catch (_) {}

    // Remove listeners
    document.removeEventListener('click', autoInit, true);
    document.removeEventListener('touchstart', autoInit, true);
    document.removeEventListener('keydown', autoInit, true);
  }

  document.addEventListener('click', autoInit, true);
  document.addEventListener('touchstart', autoInit, true);
  document.addEventListener('keydown', autoInit, true);

})();
