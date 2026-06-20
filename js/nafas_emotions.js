/* ============================================================
   NAFAS EMOTIONAL MESSAGES — Phase 4
   Time-aware, context-aware, streak-aware greetings
   Non-invasive: attaches to #welcomeText element
   ============================================================ */
(function() {
  'use strict';

  // ---- Greeting Banks ----

  var morningGreetings = [
    'صباح النور ☀️ يوم جديد… فرصة جديدة تتنفس فيها',
    'صباحك دفء 🌤️ خذ لحظة هدوء قبل ما يبدأ اليوم',
    'صباح الخير 🌅 الصبح يبدأ من نَفَس هادئ',
    'أهلاً بالنور ☀️ جسمك يستاهل يبدأ يومه بسكينة',
    'صباحك سلام 🕊️ قبل أي شي… تنفّس',
    'يا هلا بأول نَفَس في يومك 🌿 خليه عميق',
    'صباح الأمان 💛 اليوم ما يحتاج يكون مثالي — يكفي إنك هنا'
  ];

  var afternoonGreetings = [
    'أهلاً 🌤️ كيف ماشي يومك لحد الحين؟',
    'نص اليوم ⏳ وقت مناسب تاخذ نَفَس عميق',
    'هلا فيك 💛 إذا اليوم كان طويل — هنا مكان تستريح فيه',
    'مرحباً 🌿 تحتاج وقفة بسيطة؟ أنا هنا',
    'يا هلا 🧡 أحياناً نص اليوم هو أكثر وقت نحتاج فيه لحظة',
    'أهلاً فيك 💛 خذ دقيقة — الباقي يقدر ينتظر',
    'الحين وقت حلو تسمعين نفسك 🎧'
  ];

  var eveningGreetings = [
    'مساء السكينة 🌙 اليوم وشك يخلص — كيف تحسين؟',
    'مساء الخير 🌆 خذ لحظة تراجع فيها يومك بهدوء',
    'أهلاً بالمساء 🌙 الليل وقت الصراحة مع النفس',
    'مساءك دفء 🕯️ حان وقت تتنفسين بعمق وتتركين اليوم يمشي',
    'يا هلا في هالوقت الهادي 🌙 أنا هنا لك',
    'مساء الطمأنينة 🧡 يومك خلص — بس راحتك تبدأ الحين',
    'مساء الأمان 💛 قبل ما تنامين… فضفضي لي'
  ];

  var nightGreetings = [
    'ليلة هادية 🌙 لسّه صاحي/ة؟ أنا هنا',
    'السهر أحياناً يكون ثقيل 🌙 تبين تحكي عنه؟',
    'أهلاً في هدوء الليل 🌌 أحياناً أحسن الكلام يطلع متأخر',
    'ليلتك سلام 🕊️ إذا الأفكار كثيرة — فرّغيها هنا',
    'الليل عميق… مثل نَفَس حقيقي 🌙 خذ وقتك',
    'هلا فيك 🌙 ما تحتاج سبب عشان تفضفض',
    'في هالساعة 🌌 كل شي يكون أصدق — أنا أسمعك'
  ];

  var returningMessages = [
    'أهلاً بعودتك 💛 وحشتني…',
    'رجعتِ! 🌿 هنا مكانك الآمن دايماً',
    'يا هلا بالغالي/ة 💛 مستعد/ة نكمّل؟',
    'أهلاً فيك من جديد 🧡 أنا فرحان/ة إنك هنا',
    'حياك 💛 كل مرة ترجع فيها = خطوة حلوة'
  ];

  var streakMessages = [
    'يوم {n} على التوالي 🔥 ما شاء الله عليك!',
    '{n} أيام متواصلة ✨ الاستمرارية = قوة',
    'سلسلة {n} أيام 💪 تبنين عادة رائعة!',
    '{n} أيام! 🌟 هذا اللي يسمّونه التزام حقيقي',
    'يوم {n} معنا 🌿 وكل يوم تتحسنين أكثر'
  ];

  // ---- Time Detection ----
  function getTimeSlot() {
    var hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---- Build Greeting ----
  function buildGreeting() {
    var slot = getTimeSlot();
    var greetingBanks = {
      morning: morningGreetings,
      afternoon: afternoonGreetings,
      evening: eveningGreetings,
      night: nightGreetings
    };
    
    var mainGreeting = pickRandom(greetingBanks[slot]);
    var extraLine = '';

    // Check returning user
    var lastVisit = null;
    try { lastVisit = sessionStorage.getItem('nafas_last_visit'); } catch(e) {}
    
    if (lastVisit) {
      extraLine = pickRandom(returningMessages);
    }

    // Check streak
    var streak = 0;
    try { streak = parseInt(sessionStorage.getItem('nafas_streak') || '0'); } catch(e) {}
    
    if (streak >= 2) {
      var streakText = pickRandom(streakMessages).replace('{n}', streak);
      extraLine = extraLine ? extraLine + '\n' + streakText : streakText;
    }

    return { main: mainGreeting, extra: extraLine };
  }

  // ---- Render ----
  function renderEmotionalGreeting() {
    var greeting = buildGreeting();
    
    // Target: the tagline element or create a new emotional-greeting element
    var taglineEl = document.querySelector('.tagline');
    if (taglineEl) {
      taglineEl.textContent = greeting.main;
      taglineEl.style.fontSize = '1rem';
      taglineEl.style.fontWeight = '400';
      taglineEl.style.opacity = '0.9';
      taglineEl.style.lineHeight = '1.6';
      taglineEl.style.letterSpacing = '0';
      taglineEl.style.marginBottom = '16px';
      taglineEl.style.maxWidth = '320px';
    }

    // Extra line (returning/streak) goes into returningWelcome
    if (greeting.extra) {
      var returnEl = document.getElementById('returningWelcome');
      if (returnEl) {
        returnEl.textContent = greeting.extra;
        returnEl.style.display = 'block';
        returnEl.style.fontSize = '0.88rem';
        returnEl.style.opacity = '0.7';
        returnEl.style.marginBottom = '8px';
      }
    }
  }

  // ---- Init after splash done ----
  document.addEventListener('nafas:splashDone', function() {
    setTimeout(renderEmotionalGreeting, 200);
  });

  // Fallback: if splash doesn't fire event (e.g., returning visit)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(function() {
        if (!document.querySelector('.splash-screen.hidden')) return;
        renderEmotionalGreeting();
      }, 3500);
    });
  }

})();
