/* ============================================================
   NAFAS SPLASH SCREEN — Phase 4
   Non-invasive: runs independently, no app.js modifications
   ============================================================ */
(function() {
  'use strict';

  var SPLASH_DURATION = 2800; // ms — 2.8 seconds (enough for ~1 full pulse cycle)
  var FADE_DURATION = 800;

  function hideSplash() {
    var splash = document.getElementById('splashScreen');
    if (!splash) return;
    
    splash.classList.add('fade-out');
    
    setTimeout(function() {
      splash.classList.add('hidden');
      splash.style.display = 'none';
      // Dispatch event so other modules know splash is done
      document.dispatchEvent(new CustomEvent('nafas:splashDone'));
    }, FADE_DURATION);
  }

  // Wait for DOM + minimum display time
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(hideSplash, SPLASH_DURATION);
    });
  } else {
    setTimeout(hideSplash, SPLASH_DURATION);
  }
})();
