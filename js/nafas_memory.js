/* ============================================================
   NAFAS Memory System — Client-Side Module (js/nafas_memory.js)
   © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
   
   This module:
   1. Loads the user profile at startup
   2. Intercepts API calls to include visitorId
   3. Detects user corrections (dialect fixes)
   4. Saves profile updates asynchronously
   ============================================================ */
(function() {
'use strict';

// ── Config ──
var PROFILE_API = '/api/user-profile';
var SESSION_SUMMARY_API = '/api/session-summary';
var PROFILE_CACHE_KEY = 'nafas_profile_cache';
var profile = null;
var sessionId = null;
var sessionMessages = [];
var sessionStartTime = null;

// ── Get Visitor ID ──
function getVisitorId() {
  try { return localStorage.getItem('nafas_vid') || ''; } catch(e) { return ''; }
}

// ── Load Profile ──
async function loadProfile() {
  var vid = getVisitorId();
  if (!vid) return null;

  // Try cache first
  try {
    var cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      profile = JSON.parse(cached);
      // If cache is less than 5 min old, use it
      if (profile._cachedAt && (Date.now() - profile._cachedAt < 300000)) {
        return profile;
      }
    }
  } catch(e) {}

  // Fetch from server
  try {
    var res = await fetch(PROFILE_API + '?vid=' + encodeURIComponent(vid));
    if (res.ok) {
      var data = await res.json();
      if (data) {
        profile = data;
        profile._cachedAt = Date.now();
        try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)); } catch(e) {}
        return profile;
      }
    }
  } catch(e) {}

  return null;
}

// ── Save Profile ──
async function saveProfile(updates) {
  var vid = getVisitorId();
  if (!vid) return;

  var payload = Object.assign({}, profile || {}, updates, { visitor_id: vid });
  try {
    await fetch(PROFILE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    profile = payload;
    profile._cachedAt = Date.now();
    try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)); } catch(e) {}
  } catch(e) {}
}

// ── Add Correction ──
async function addCorrection(wrong, right) {
  var vid = getVisitorId();
  if (!vid || !wrong || !right) return;

  try {
    await fetch(PROFILE_API, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: vid,
        correction: { wrong: wrong, right: right }
      })
    });
  } catch(e) {}
}

// ── Generate Session ID ──
function generateSessionId() {
  return 'sess_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function getSessionId() {
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStartTime = Date.now();
    sessionMessages = [];
  }
  return sessionId;
}

// ── Track Messages ──
function trackMessage(role, text) {
  if (!text || text.trim().length < 1) return;
  sessionMessages.push({
    role: role,
    text: text.trim(),
    timestamp: Date.now()
  });
}

// ── Intercept fetch to add visitorId + sessionId + track messages ──
var originalFetch = window.fetch;
window.fetch = function(url, opts) {
  // Only intercept calls to /api/gemini
  if (typeof url === 'string' && url.indexOf('/api/gemini') !== -1 && opts && opts.body) {
    try {
      var body = JSON.parse(opts.body);
      var vid = getVisitorId();
      var sid = getSessionId();
      if (vid && !body.visitorId) body.visitorId = vid;
      if (sid && !body.sessionId) body.sessionId = sid;
      opts = Object.assign({}, opts, { body: JSON.stringify(body) });

      // Track user message
      if (body.contents && Array.isArray(body.contents)) {
        var lastUserMsg = body.contents.filter(function(m) { return m.role === 'user'; }).pop();
        if (lastUserMsg && lastUserMsg.parts && lastUserMsg.parts[0]) {
          trackMessage('user', lastUserMsg.parts[0].text);
        }
      }

      // Track model response
      var origCall = originalFetch.apply(this, [url, opts]);
      return origCall.then(function(response) {
        // Clone response to read it without consuming
        var cloned = response.clone();
        cloned.json().then(function(data) {
          try {
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
              var modelText = data.candidates[0].content.parts[0].text;
              // Parse JSON response to get actual text
              try {
                var parsed = JSON.parse(modelText);
                if (parsed.response) trackMessage('model', parsed.response);
              } catch(e) {
                trackMessage('model', modelText);
              }
            }
          } catch(e) {}
        }).catch(function() {});
        return response;
      });
    } catch(e) {}
  }
  return originalFetch.apply(this, arguments);
};

// ── Gender Detection from User Input (supports ة and ه endings) ──
function detectGenderFromInput(text) {
  if (!text) return null;
  var femaleRe = /تعبان[ةه]|محتاج[ةه]|زعلان[ةه]|خايف[ةه]|حاس[ةه]|مقهور[ةه]|ضايق[ةه]|أنا بنت|متعب[ةه]|خلين[يى]/;
  var maleRe = /تعبان(?![ةه])|محتاج(?![ةه])|زعلان(?![ةه])|خايف(?![ةه])|حاس(?![ةه])|مقهور(?![ةه])|ضايق(?![ةه])|أنا ولد|أنا رجال/;
  if (femaleRe.test(text)) return 'female';
  if (maleRe.test(text)) return 'male';
  return null;
}

// ── Monitor chat for gender detection & corrections ──
function startChatMonitor() {
  // Watch for new user messages
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType !== 1) return;
        // Check for user messages
        if (node.classList && (node.classList.contains('user-msg') || node.classList.contains('message-user'))) {
          var text = node.textContent || node.innerText || '';
          var gender = detectGenderFromInput(text);
          if (gender && (!profile || profile.gender === 'unknown')) {
            saveProfile({ gender: gender });
          }
        }
      });
    });
  });

  var messagesEl = document.getElementById('messages') || document.querySelector('.chat-messages');
  if (messagesEl) {
    observer.observe(messagesEl, { childList: true, subtree: true });
  }
}

// ── Name Detection ──
function detectName(text) {
  // Common patterns: "أنا اسمي X" / "اسمي X" / "أنا X"
  var nameMatch = text.match(/(?:أنا\s+اسمي|اسمي|أنا)\s+([^\s,،.!؟?]{2,15})/);
  if (nameMatch) {
    var name = nameMatch[1];
    // Exclude common non-name words
    var excluded = ['بخير','تمام','تعبان','تعبانة','محتاج','محتاجة','زعلان','زعلانة','هنا','مو','مب','ما','بس'];
    if (!excluded.includes(name)) return name;
  }
  return null;
}

// ── Topic Detection ──
function detectTopics(text) {
  var topics = [];
  var topicMap = {
    'work': /شغل|عمل|مدير|وظيفة|راتب|مكتب|اجتماع|deadline/,
    'family': /أهل|عائلة|أبوي|أمي|أخوي|أختي|ريلي|زوج/,
    'relationship': /حب|علاقة|صاحب|صاحبة|كراش|خان|غوست/,
    'study': /دراسة|امتحان|جامعة|مدرسة|واجب|منهج/,
    'sleep': /نوم|أرق|سهر|ما أنام/,
    'anxiety': /قلق|خوف|وسواس|هلع|بانيك/,
    'loneliness': /وحد|محد|وحيد|عزلة/
  };
  for (var key in topicMap) {
    if (topicMap[key].test(text)) topics.push(key);
  }
  return topics;
}

// ── Initialize ──
async function init() {
  await loadProfile();
  startChatMonitor();

  // Listen for user messages to detect name and topics
  var sendBtn = document.getElementById('sendBtn');
  var input = document.getElementById('userInput');
  
  if (input) {
    var origSend = input.form ? input.form.onsubmit : null;
    
    // Hook into the input to capture text before it's cleared
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        processUserText(input.value);
      }
    });
  }
  
  if (sendBtn) {
    sendBtn.addEventListener('click', function() {
      if (input) processUserText(input.value);
    }, true); // capture phase, runs before onclick clears the input
  }
}

function processUserText(text) {
  if (!text || text.trim().length < 2) return;
  text = text.trim();

  // Collect all updates in one object to avoid race conditions
  var updates = {};

  // Detect gender
  var gender = detectGenderFromInput(text);
  if (gender && (!profile || profile.gender === 'unknown')) {
    updates.gender = gender;
  }

  // Detect name
  var name = detectName(text);
  if (name && (!profile || !profile.display_name)) {
    updates.display_name = name;
  }

  // Detect topics
  var topics = detectTopics(text);
  if (topics.length > 0) {
    var existing = (profile && profile.topics) ? profile.topics : [];
    var merged = existing.concat(topics);
    // Keep unique, last 10
    merged = merged.filter(function(v, i, a) { return a.indexOf(v) === i; }).slice(-10);
    updates.topics = merged;
  }

  // Increment session count on first user message of a session
  if (!window._nafasSessionCounted) {
    window._nafasSessionCounted = true;
    var currentCount = (profile && profile.session_count) ? profile.session_count : 0;
    updates.session_count = currentCount + 1;
  }

  // Single save call with all updates
  if (Object.keys(updates).length > 0) {
    saveProfile(updates);
  }
}

// ── Phase 2: Session Feedback (Learning System) ──
async function submitSessionFeedback(rating, topics) {
  var vid = getVisitorId();
  if (!vid || !rating) return;

  // Save feedback to Supabase via API
  try {
    await originalFetch('/api/session-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: vid,
        mood_rating: rating,
        topics: topics || []
      })
    });
  } catch(e) {
    // Fallback: save locally
    try {
      var feedbacks = JSON.parse(localStorage.getItem('nafas_feedbacks') || '[]');
      feedbacks.push({ vid: vid, rating: rating, topics: topics, ts: Date.now() });
      localStorage.setItem('nafas_feedbacks', JSON.stringify(feedbacks.slice(-50)));
    } catch(e2) {}
  }
}

// ── Watch for mood rating clicks ──
function watchFeedbackRating() {
  document.addEventListener('click', function(e) {
    var el = e.target;
    // Detect emoji rating buttons (😫😔😐🙂😊)
    var emojiMap = {'😫': 1, '😔': 2, '😐': 3, '🙂': 4, '😊': 5};
    var text = (el.textContent || el.innerText || '').trim();
    if (emojiMap[text]) {
      var rating = emojiMap[text];
      var currentTopics = [];
      if (profile && profile.topics) currentTopics = profile.topics;
      submitSessionFeedback(rating, currentTopics);
    }
  }, true);
}

// ── Phase 4: Send Session Summary ──
function sendSessionSummary(moodRating) {
  if (sessionMessages.length < 2 || !sessionId) return;

  var vid = getVisitorId();
  if (!vid) return;

  var payload = JSON.stringify({
    visitor_id: vid,
    session_id: sessionId,
    messages: sessionMessages.slice(0, 100),
    mood_rating: moodRating || null
  });

  // Use sendBeacon for reliability on page close
  if (navigator.sendBeacon) {
    var blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(SESSION_SUMMARY_API, blob);
  } else {
    originalFetch(SESSION_SUMMARY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(function() {});
  }

  var completedId = sessionId;
  sessionId = null;
  sessionMessages = [];
  sessionStartTime = null;
  console.log('[NafasMemory] Session summary sent:', completedId);
}

// ── Session End Detection ──
var inactivityTimer = null;
var INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 min inactivity = session end

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (sessionMessages.length >= 2) {
    inactivityTimer = setTimeout(function() {
      console.log('[NafasMemory] Inactivity detected — ending session');
      sendSessionSummary();
    }, INACTIVITY_THRESHOLD);
  }
}

['mousemove', 'keydown', 'touchstart', 'click'].forEach(function(evt) {
  document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

window.addEventListener('beforeunload', function() {
  sendSessionSummary();
});

document.addEventListener('visibilitychange', function() {
  if (document.hidden && sessionMessages.length >= 4) {
    sendSessionSummary();
  }
});

// ── Expose API ──
window.NafasMemory = {
  getProfile: function() { return profile; },
  loadProfile: loadProfile,
  saveProfile: saveProfile,
  addCorrection: addCorrection,
  getVisitorId: getVisitorId,
  getSessionId: getSessionId,
  submitFeedback: submitSessionFeedback,
  endSession: sendSessionSummary,
  getSessionMessages: function() { return sessionMessages; }
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { init(); watchFeedbackRating(); });
} else {
  init();
  watchFeedbackRating();
}

})();
