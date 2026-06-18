/**
 * Nafas Audio System v2 — نَفَس
 * Enhanced Web Audio API ambient sounds:
 *   💓 Calm Heartbeat | 🌊 Ocean Waves | 🌧️ Rain Drops
 * Auto-plays on first interaction. Self-contained.
 *
 * © منيرة علي المري 2026 — NAFAS FOR ARTIFICIAL INTELLIGENCE
 */

(function () {
  'use strict';

  var SOUND_LABELS = {
    heartbeat: { icon: '💓', name: 'نبض قلب', nameEn: 'Heartbeat' },
    ocean:     { icon: '🌊', name: 'أمواج', nameEn: 'Ocean Waves' },
    rain:      { icon: '🌧️', name: 'قطرات مطر', nameEn: 'Rain' },
  };

  var audioCtx = null;
  var masterGain = null;
  var ambientGain = null;
  var uiGain = null;
  var breathGain = null;

  var _isMuted = false;
  var _masterVolume = 0.35;
  var _ambientVolume = 0.5;
  var _uiVolume = 0.6;

  var _ambientNodes = [];
  var _ambientCurrent = null;
  var _breathNodes = [];
  var _panelOpen = false;
  var _timers = [];

  function now() { return audioCtx ? audioCtx.currentTime : 0; }

  /* ─── Noise Buffers ─── */
  function createNoiseBuffer(type, seconds) {
    seconds = seconds || 4;
    var sr = audioCtx.sampleRate;
    var len = sr * seconds;
    var buf = audioCtx.createBuffer(2, len, sr);
    
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      if (type === 'white') {
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      } else if (type === 'brown') {
        var last = 0;
        for (var i = 0; i < len; i++) {
          var w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          data[i] = last * 3.5;
        }
      } else {
        // Pink noise
        var b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
        for (var i = 0; i < len; i++) {
          var w = Math.random() * 2 - 1;
          b0 = 0.99886*b0 + w*0.0555179;
          b1 = 0.99332*b1 + w*0.0750759;
          b2 = 0.96900*b2 + w*0.1538520;
          b3 = 0.86650*b3 + w*0.3104856;
          b4 = 0.55000*b4 + w*0.5329522;
          b5 = -0.7616*b5 - w*0.0168980;
          data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;
          b6 = w*0.115926;
        }
      }
    }
    return buf;
  }

  function stopNodes(arr) {
    arr.forEach(function(n) {
      try { if(n.stop) n.stop(); } catch(_) {}
      try { if(n.disconnect) n.disconnect(); } catch(_) {}
    });
    arr.length = 0;
  }

  function clearTimers() {
    _timers.forEach(function(t) { clearInterval(t); clearTimeout(t); });
    _timers.length = 0;
  }

  /* ═══════════════════════════════════════
     💓 HEARTBEAT — Deep, calm, 56 BPM
     ═══════════════════════════════════════ */
  function ambientHeartbeat() {
    var nodes = [];
    var interval = 1.07; // ~56 BPM — resting heart rate
    var batchSize = 60;
    
    function scheduleBatch(baseTime) {
      for (var i = 0; i < batchSize; i++) {
        var t = baseTime + i * interval;
        
        // === LUB (first heart sound — deeper, louder) ===
        var osc1 = audioCtx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(45, t);
        osc1.frequency.exponentialRampToValueAtTime(30, t + 0.12);
        var g1 = audioCtx.createGain();
        g1.gain.setValueAtTime(0, t);
        g1.gain.linearRampToValueAtTime(0.30, t + 0.025);
        g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc1.connect(g1).connect(ambientGain);
        osc1.start(t);
        osc1.stop(t + 0.16);
        nodes.push(osc1, g1);
        
        // Sub-bass layer for warmth
        var sub1 = audioCtx.createOscillator();
        sub1.type = 'sine';
        sub1.frequency.value = 28;
        var sg1 = audioCtx.createGain();
        sg1.gain.setValueAtTime(0, t);
        sg1.gain.linearRampToValueAtTime(0.15, t + 0.03);
        sg1.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        sub1.connect(sg1).connect(ambientGain);
        sub1.start(t);
        sub1.stop(t + 0.19);
        nodes.push(sub1, sg1);
        
        // === DUB (second heart sound — lighter, higher) ===
        var dt = t + 0.28;
        var osc2 = audioCtx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(55, dt);
        osc2.frequency.exponentialRampToValueAtTime(35, dt + 0.08);
        var g2 = audioCtx.createGain();
        g2.gain.setValueAtTime(0, dt);
        g2.gain.linearRampToValueAtTime(0.18, dt + 0.02);
        g2.gain.exponentialRampToValueAtTime(0.001, dt + 0.12);
        osc2.connect(g2).connect(ambientGain);
        osc2.start(dt);
        osc2.stop(dt + 0.13);
        nodes.push(osc2, g2);
      }
    }
    
    scheduleBatch(now() + 0.1);
    
    var iv = setInterval(function() {
      if (_ambientCurrent !== 'heartbeat') { clearInterval(iv); return; }
      scheduleBatch(now() + 0.05);
    }, batchSize * interval * 900);
    _timers.push(iv);
    
    return nodes;
  }

  /* ═══════════════════════════════════════
     🌊 OCEAN — Layered waves with foam
     ═══════════════════════════════════════ */
  function ambientOcean() {
    var nodes = [];
    
    // --- Layer 1: Deep wave bed (brown noise, low-passed) ---
    var deepBuf = createNoiseBuffer('brown', 6);
    var deep = audioCtx.createBufferSource();
    deep.buffer = deepBuf;
    deep.loop = true;
    
    var deepLP = audioCtx.createBiquadFilter();
    deepLP.type = 'lowpass';
    deepLP.frequency.value = 400;
    deepLP.Q.value = 0.5;
    
    var deepGain = audioCtx.createGain();
    deepGain.gain.value = 0.22;
    
    // Slow breathing wave (12s cycle)
    var waveLFO = audioCtx.createOscillator();
    waveLFO.type = 'sine';
    waveLFO.frequency.value = 0.083; // ~12s
    var waveLFOGain = audioCtx.createGain();
    waveLFOGain.gain.value = 0.14;
    waveLFO.connect(waveLFOGain).connect(deepGain.gain);
    waveLFO.start();
    
    deep.connect(deepLP).connect(deepGain).connect(ambientGain);
    deep.start();
    nodes.push(deep, deepLP, deepGain, waveLFO, waveLFOGain);
    
    // --- Layer 2: Mid-range wash (pink noise, band-passed) ---
    var midBuf = createNoiseBuffer('pink', 5);
    var mid = audioCtx.createBufferSource();
    mid.buffer = midBuf;
    mid.loop = true;
    
    var midBP = audioCtx.createBiquadFilter();
    midBP.type = 'bandpass';
    midBP.frequency.value = 600;
    midBP.Q.value = 0.3;
    
    var midGain = audioCtx.createGain();
    midGain.gain.value = 0.12;
    
    // Offset wave cycle (15s)
    var midLFO = audioCtx.createOscillator();
    midLFO.type = 'sine';
    midLFO.frequency.value = 0.067; // ~15s
    var midLFOG = audioCtx.createGain();
    midLFOG.gain.value = 0.08;
    midLFO.connect(midLFOG).connect(midGain.gain);
    midLFO.start();
    
    mid.connect(midBP).connect(midGain).connect(ambientGain);
    mid.start();
    nodes.push(mid, midBP, midGain, midLFO, midLFOG);
    
    // --- Layer 3: Foam / fizz (white noise, high-passed) ---
    var foamBuf = createNoiseBuffer('white', 3);
    var foam = audioCtx.createBufferSource();
    foam.buffer = foamBuf;
    foam.loop = true;
    
    var foamHP = audioCtx.createBiquadFilter();
    foamHP.type = 'highpass';
    foamHP.frequency.value = 3000;
    
    var foamGain = audioCtx.createGain();
    foamGain.gain.value = 0.025;
    
    // Foam follows the deep wave but delayed
    var foamLFO = audioCtx.createOscillator();
    foamLFO.type = 'sine';
    foamLFO.frequency.value = 0.083;
    var foamLFOG = audioCtx.createGain();
    foamLFOG.gain.value = 0.02;
    foamLFO.connect(foamLFOG).connect(foamGain.gain);
    foamLFO.start();
    
    foam.connect(foamHP).connect(foamGain).connect(ambientGain);
    foam.start();
    nodes.push(foam, foamHP, foamGain, foamLFO, foamLFOG);
    
    // --- Layer 4: Distant rumble ---
    var rumble = audioCtx.createOscillator();
    rumble.type = 'sine';
    rumble.frequency.value = 55;
    var rumbleG = audioCtx.createGain();
    rumbleG.gain.value = 0.03;
    var rumbleLFO = audioCtx.createOscillator();
    rumbleLFO.type = 'sine';
    rumbleLFO.frequency.value = 0.05;
    var rumbleLFOG = audioCtx.createGain();
    rumbleLFOG.gain.value = 0.025;
    rumbleLFO.connect(rumbleLFOG).connect(rumbleG.gain);
    rumbleLFO.start();
    rumble.connect(rumbleG).connect(ambientGain);
    rumble.start();
    nodes.push(rumble, rumbleG, rumbleLFO, rumbleLFOG);
    
    return nodes;
  }

  /* ═══════════════════════════════════════
     🌧️ RAIN — Individual drops + bed
     ═══════════════════════════════════════ */
  function ambientRain() {
    var nodes = [];
    
    // --- Layer 1: Gentle rain bed (filtered white noise) ---
    var rainBuf = createNoiseBuffer('white', 4);
    var rainSrc = audioCtx.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;
    
    var rainBP = audioCtx.createBiquadFilter();
    rainBP.type = 'bandpass';
    rainBP.frequency.value = 1200;
    rainBP.Q.value = 0.5;
    
    var rainGain = audioCtx.createGain();
    rainGain.gain.value = 0.13;
    
    // Gentle variation
    var rainLFO = audioCtx.createOscillator();
    rainLFO.type = 'sine';
    rainLFO.frequency.value = 0.15;
    var rainLFOG = audioCtx.createGain();
    rainLFOG.gain.value = 0.04;
    rainLFO.connect(rainLFOG).connect(rainGain.gain);
    rainLFO.start();
    
    rainSrc.connect(rainBP).connect(rainGain).connect(ambientGain);
    rainSrc.start();
    nodes.push(rainSrc, rainBP, rainGain, rainLFO, rainLFOG);
    
    // --- Layer 2: Higher frequency rain texture ---
    var texBuf = createNoiseBuffer('white', 3);
    var texSrc = audioCtx.createBufferSource();
    texSrc.buffer = texBuf;
    texSrc.loop = true;
    
    var texHP = audioCtx.createBiquadFilter();
    texHP.type = 'highpass';
    texHP.frequency.value = 4000;
    
    var texGain = audioCtx.createGain();
    texGain.gain.value = 0.04;
    
    texSrc.connect(texHP).connect(texGain).connect(ambientGain);
    texSrc.start();
    nodes.push(texSrc, texHP, texGain);
    
    // --- Layer 3: Individual drop plinks ---
    function spawnDrop() {
      if (_ambientCurrent !== 'rain') return;
      
      var t = now();
      var freq = 2000 + Math.random() * 4000; // Random pitch
      var pan = Math.random() * 2 - 1; // Stereo position
      
      var osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.08);
      
      var dropGain = audioCtx.createGain();
      dropGain.gain.setValueAtTime(0, t);
      dropGain.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.04, t + 0.003);
      dropGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06 + Math.random() * 0.06);
      
      // Stereo panning
      var panner = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = pan;
        osc.connect(dropGain).connect(panner).connect(ambientGain);
      } else {
        osc.connect(dropGain).connect(ambientGain);
      }
      
      osc.start(t);
      osc.stop(t + 0.15);
      
      // Schedule next drop (random interval 80-300ms)
      var nextDelay = 80 + Math.random() * 220;
      var tid = setTimeout(spawnDrop, nextDelay);
      _timers.push(tid);
    }
    
    // Start multiple drop streams for density
    for (var s = 0; s < 3; s++) {
      var startDelay = s * 100 + Math.random() * 200;
      var tid = setTimeout(spawnDrop, startDelay);
      _timers.push(tid);
    }
    
    // --- Layer 4: Low rumble (distant thunder ambience) ---
    var thunderBuf = createNoiseBuffer('brown', 6);
    var thunderSrc = audioCtx.createBufferSource();
    thunderSrc.buffer = thunderBuf;
    thunderSrc.loop = true;
    
    var thunderLP = audioCtx.createBiquadFilter();
    thunderLP.type = 'lowpass';
    thunderLP.frequency.value = 200;
    
    var thunderGain = audioCtx.createGain();
    thunderGain.gain.value = 0.04;
    
    thunderSrc.connect(thunderLP).connect(thunderGain).connect(ambientGain);
    thunderSrc.start();
    nodes.push(thunderSrc, thunderLP, thunderGain);
    
    return nodes;
  }

  var AMBIENT_GENERATORS = {
    heartbeat: ambientHeartbeat,
    ocean: ambientOcean,
    rain: ambientRain,
  };

  /* ═══════════════════════════════════════
     UI SOUNDS (one-shot)
     ═══════════════════════════════════════ */
  function playTone(freq, startTime, dur, gain, type) {
    type = type || 'sine';
    var osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(gain, startTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.connect(g).connect(uiGain);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.05);
  }

  var UI_SOUNDS = {
    appOpen: function() {
      var t = now();
      playTone(523.25, t, 0.35, 0.12);
      playTone(659.25, t+0.12, 0.35, 0.10);
      playTone(783.99, t+0.24, 0.45, 0.08);
    },
    sessionStart: function() {
      var t = now();
      playTone(783.99, t, 0.5, 0.10);
      playTone(659.25, t+0.18, 0.55, 0.08);
      playTone(523.25, t+0.36, 0.7, 0.08);
    },
    sessionEnd: function() {
      var t = now();
      playTone(261.63, t, 1.5, 0.08);
      playTone(329.63, t+0.1, 1.5, 0.07);
      playTone(392.00, t+0.2, 1.4, 0.06);
      playTone(523.25, t+0.3, 1.8, 0.05);
    },
    achievement: function() {
      var t = now();
      [523.25,659.25,783.99,1046.50,659.25,783.99].forEach(function(f,i) {
        playTone(f, t+i*0.06, 0.3, 0.06);
      });
    },
    message: function() { playTone(880, now(), 0.18, 0.08); },
    transition: function() {
      var buf = createNoiseBuffer('white', 0.3);
      var src = audioCtx.createBufferSource();
      src.buffer = buf;
      var bp = audioCtx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(300, now());
      bp.frequency.linearRampToValueAtTime(3000, now()+0.15);
      bp.Q.value = 1;
      var g = audioCtx.createGain();
      g.gain.setValueAtTime(0.10, now());
      g.gain.exponentialRampToValueAtTime(0.001, now()+0.25);
      src.connect(bp).connect(g).connect(uiGain);
      src.start();
      src.stop(now()+0.3);
    },
  };

  /* ═══════════════════════════════════════
     BREATHING SYNC
     ═══════════════════════════════════════ */
  function breathInhale(dur) {
    dur = dur || 4;
    stopNodes(_breathNodes);
    var t = now();
    var buf = createNoiseBuffer('pink', 2);
    var src = audioCtx.createBufferSource();
    src.buffer = buf; src.loop = true;
    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.linearRampToValueAtTime(1200, t+dur);
    bp.Q.value = 1;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.01, t);
    g.gain.linearRampToValueAtTime(0.10, t+dur);
    src.connect(bp).connect(g).connect(breathGain);
    src.start(t); src.stop(t+dur+0.1);
    _breathNodes.push(src, bp, g);
  }
  function breathHold(dur) {
    dur = dur || 7;
    stopNodes(_breathNodes);
    var t = now();
    var osc = audioCtx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 220;
    var g = audioCtx.createGain(); g.gain.value = 0.012;
    osc.connect(g).connect(breathGain);
    osc.start(t); osc.stop(t+dur+0.1);
    _breathNodes.push(osc, g);
  }
  function breathExhale(dur) {
    dur = dur || 6;
    stopNodes(_breathNodes);
    var t = now();
    var buf = createNoiseBuffer('pink', 2);
    var src = audioCtx.createBufferSource();
    src.buffer = buf; src.loop = true;
    var bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1200, t);
    bp.frequency.linearRampToValueAtTime(300, t+dur);
    bp.Q.value = 0.8;
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0.10, t);
    g.gain.linearRampToValueAtTime(0.001, t+dur);
    src.connect(bp).connect(g).connect(breathGain);
    src.start(t); src.stop(t+dur+0.1);
    _breathNodes.push(src, bp, g);
  }

  /* ═══════════════════════════════════════
     PANEL UI
     ═══════════════════════════════════════ */
  function buildSoundOptions() {
    var container = document.getElementById('soundOptions');
    if (!container) return;
    container.innerHTML = '';
    
    // "No sound" option
    var none = document.createElement('div');
    none.className = 'sound-option sound-option-none' + (_ambientCurrent === null ? ' active' : '');
    none.setAttribute('data-sound', 'none');
    none.innerHTML = '<span class="sound-option-icon">🔇</span><span class="sound-option-name">بدون صوت</span>';
    none.onclick = function() {
      NafasAudio.ambient.stop();
      updateOptionUI();
    };
    container.appendChild(none);
    
    Object.keys(SOUND_LABELS).forEach(function(key) {
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
      el.onclick = function() {
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
    opts.forEach(function(el) {
      var s = el.getAttribute('data-sound');
      if (s === 'none') {
        el.classList.toggle('active', _ambientCurrent === null);
      } else {
        el.classList.toggle('active', _ambientCurrent === s);
      }
    });
    var fab = document.getElementById('soundFab');
    if (fab) {
      fab.classList.toggle('active', _ambientCurrent !== null);
      // Update FAB icon to current sound
      if (_ambientCurrent && SOUND_LABELS[_ambientCurrent]) {
        fab.textContent = SOUND_LABELS[_ambientCurrent].icon;
      } else {
        fab.textContent = '🎵';
      }
    }
  }

  function togglePanel() {
    _panelOpen = !_panelOpen;
    var panel = document.getElementById('soundPanel');
    if (panel) panel.classList.toggle('visible', _panelOpen);
    if (_panelOpen) buildSoundOptions();
  }

  /* ═══════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════ */
  var NafasAudio = {
    init: function() {
      if (audioCtx) return;
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch(e) {
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
      breathGain.gain.value = 0.4;
      breathGain.connect(masterGain);
    },

    ambient: {
      available: ['heartbeat', 'ocean', 'rain'],
      get current() { return _ambientCurrent; },

      play: function(soundName) {
        NafasAudio.init();
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        this.stop();
        if (AMBIENT_GENERATORS[soundName]) {
          _ambientNodes = AMBIENT_GENERATORS[soundName]();
          _ambientCurrent = soundName;
          try { localStorage.setItem('nafas_ambient', soundName); } catch(_) {}
        }
        updateOptionUI();
      },

      stop: function() {
        clearTimers();
        stopNodes(_ambientNodes);
        _ambientCurrent = null;
        try { localStorage.setItem('nafas_ambient', 'off'); } catch(_) {}
        updateOptionUI();
      },

      setVolume: function(v) {
        _ambientVolume = Math.max(0, Math.min(1, v));
        if (ambientGain) ambientGain.gain.value = _ambientVolume;
      },
    },

    ui: {
      play: function(soundName) {
        NafasAudio.init();
        if (!audioCtx || _isMuted) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (UI_SOUNDS[soundName]) UI_SOUNDS[soundName]();
      },
      setVolume: function(v) {
        _uiVolume = Math.max(0, Math.min(1, v));
        if (uiGain) uiGain.gain.value = _uiVolume;
      },
    },

    breathing: {
      inhale: function(d) { NafasAudio.init(); if(!audioCtx||_isMuted)return; if(audioCtx.state==='suspended')audioCtx.resume(); breathInhale(d); },
      hold: function(d) { NafasAudio.init(); if(!audioCtx||_isMuted)return; breathHold(d); },
      exhale: function(d) { NafasAudio.init(); if(!audioCtx||_isMuted)return; breathExhale(d); },
      stop: function() { stopNodes(_breathNodes); },
    },

    get isMuted() { return _isMuted; },
    get masterVolume() { return _masterVolume; },

    mute: function() { _isMuted = true; if(masterGain) masterGain.gain.value = 0; },
    unmute: function() { _isMuted = false; if(masterGain) masterGain.gain.value = _masterVolume; },
    setMasterVolume: function(v) {
      _masterVolume = Math.max(0, Math.min(1, v));
      if (!_isMuted && masterGain) masterGain.gain.value = _masterVolume;
    },

    togglePanel: togglePanel,
  };

  window.NafasAudio = NafasAudio;

  /* ═══════════════════════════════════════
     AUTO-INIT: Play ambient on first touch
     Default = ocean if no saved preference
     ═══════════════════════════════════════ */
  var _autoInitDone = false;
  function autoInit() {
    if (_autoInitDone) return;
    _autoInitDone = true;
    NafasAudio.init();

    try {
      var saved = localStorage.getItem('nafas_ambient');
      if (saved === 'off') {
        // User explicitly turned off — respect that
      } else if (saved && AMBIENT_GENERATORS[saved]) {
        NafasAudio.ambient.play(saved);
      } else {
        // First time — default to ocean waves 🌊
        NafasAudio.ambient.play('ocean');
      }
    } catch(_) {
      NafasAudio.ambient.play('ocean');
    }

    document.removeEventListener('click', autoInit, true);
    document.removeEventListener('touchstart', autoInit, true);
    document.removeEventListener('keydown', autoInit, true);
  }

  document.addEventListener('click', autoInit, true);
  document.addEventListener('touchstart', autoInit, true);
  document.addEventListener('keydown', autoInit, true);

})();
