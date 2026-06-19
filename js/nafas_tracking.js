/* ============================================================
   NAFAS Tracking & Analytics v1.0
   © 2026 NAFAS FOR ARTIFICIAL INTELLIGENCE — CN-6573712
   
   Self-contained module. No modifications to existing code.
   Tracks: visitors, sessions, mood, optional registration.
   ============================================================ */
(function(){
'use strict';

var S_URL='https://sqpbusodwdjtlgaxrreg.supabase.co';
var S_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcGJ1c29kd2RqdGxnYXhycmVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2MTQ2MDksImV4cCI6MjA5NTE5MDYwOX0.bglpaNzXgU4ufK7fuu5wMcvE6XYepD318C7mO54ML7I';

var T={vid:null,start:null,moodB:null,moodA:null,dev:'desktop',tz:'',reg:false,uname:'',msgCount:0};

// ── Utils ──
function gid(){return 'v_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function sf(path,method,body){
  var o={method:method||'GET',headers:{'apikey':S_KEY,'Authorization':'Bearer '+S_KEY}};
  if(body){o.headers['Content-Type']='application/json';o.headers['Prefer']='return=minimal';o.body=JSON.stringify(body)}
  return fetch(S_URL+'/rest/v1/'+path,o).catch(function(){return null})
}
function dv(){var u=navigator.userAgent||'';if(/iPad|Tablet/i.test(u))return'tablet';if(/Mobile|Android|iPhone/i.test(u))return'mobile';return'desktop'}
function getLang(){try{return(typeof state!=='undefined'&&state.lang)||document.documentElement.lang||'ar'}catch(e){return'ar'}}

// ── Styles ──
function injectCSS(){
  var s=document.createElement('style');
  s.textContent='\
.nft-card{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:99998;\
background:rgba(15,26,46,0.97);backdrop-filter:blur(20px);\
border:1px solid rgba(108,61,214,0.3);border-radius:20px;\
padding:24px 28px;text-align:center;font-family:"IBM Plex Sans Arabic","Tajawal",sans-serif;\
box-shadow:0 20px 60px rgba(0,0,0,0.5);max-width:380px;width:90%;\
animation:nftSlide 0.5s cubic-bezier(0.16,1,0.3,1);direction:rtl}\
@keyframes nftSlide{from{opacity:0;transform:translateX(-50%) translateY(30px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}\
.nft-card h3{color:#22D3EE;font-size:1.1em;margin:0 0 6px;font-weight:600}\
.nft-card .nft-sub{color:rgba(255,255,255,0.5);font-size:0.8em;margin-bottom:16px}\
.nft-emojis{display:flex;justify-content:center;gap:8px;margin:12px 0}\
.nft-emojis button{background:rgba(255,255,255,0.05);border:2px solid rgba(255,255,255,0.1);\
border-radius:14px;padding:10px 12px;font-size:1.6em;cursor:pointer;\
transition:all 0.2s ease;min-width:48px}\
.nft-emojis button:hover{background:rgba(108,61,214,0.2);border-color:rgba(108,61,214,0.5);transform:scale(1.15)}\
.nft-emojis button.sel{background:rgba(108,61,214,0.3);border-color:#6C3DD6;transform:scale(1.15)}\
.nft-skip{background:none;border:none;color:rgba(255,255,255,0.3);font-size:0.8em;\
cursor:pointer;margin-top:10px;font-family:inherit;padding:6px 16px}\
.nft-skip:hover{color:rgba(255,255,255,0.6)}\
.nft-reg{margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08)}\
.nft-reg input{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);\
border-radius:10px;padding:8px 14px;color:#fff;font-family:inherit;font-size:0.9em;\
width:100%;margin:5px 0;direction:rtl;outline:none}\
.nft-reg input:focus{border-color:rgba(108,61,214,0.5)}\
.nft-reg input::placeholder{color:rgba(255,255,255,0.25)}\
.nft-btn{background:linear-gradient(135deg,#6C3DD6,#22D3EE);border:none;border-radius:12px;\
padding:10px 24px;color:#fff;font-family:inherit;font-weight:600;font-size:0.9em;\
cursor:pointer;margin-top:8px;width:100%;transition:opacity 0.2s}\
.nft-btn:hover{opacity:0.85}\
.nft-btn:disabled{opacity:0.4;cursor:default}\
.nft-thanks{color:#22C55E;font-size:0.9em;margin-top:8px}\
.nft-progress-btn{position:fixed;top:12px;left:12px;z-index:9990;background:rgba(15,26,46,0.85);\
backdrop-filter:blur(10px);border:1px solid rgba(108,61,214,0.3);border-radius:12px;\
padding:6px 14px;color:#22D3EE;font-family:"IBM Plex Sans Arabic",sans-serif;font-size:0.75em;\
cursor:pointer;display:flex;align-items:center;gap:5px;transition:all 0.2s}\
.nft-progress-btn:hover{border-color:#6C3DD6;background:rgba(108,61,214,0.15)}\
.nft-dash{position:fixed;top:0;left:0;right:0;bottom:0;z-index:99997;\
background:rgba(5,10,20,0.95);backdrop-filter:blur(20px);\
display:flex;align-items:center;justify-content:center;\
font-family:"IBM Plex Sans Arabic","Tajawal",sans-serif;direction:rtl;\
animation:nftFade 0.3s ease}\
@keyframes nftFade{from{opacity:0}to{opacity:1}}\
.nft-dash-inner{background:rgba(15,26,46,0.98);border:1px solid rgba(108,61,214,0.25);\
border-radius:24px;padding:32px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto}\
.nft-dash h2{color:#22D3EE;margin:0 0 20px;font-size:1.3em;text-align:center}\
.nft-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}\
.nft-stat{background:rgba(108,61,214,0.08);border:1px solid rgba(108,61,214,0.15);\
border-radius:14px;padding:16px;text-align:center}\
.nft-stat .num{font-size:2em;font-weight:700;color:#22D3EE;display:block}\
.nft-stat .lbl{color:rgba(255,255,255,0.5);font-size:0.8em;margin-top:4px}\
.nft-close{position:absolute;top:16px;left:16px;background:none;border:none;\
color:rgba(255,255,255,0.4);font-size:1.5em;cursor:pointer;padding:4px 8px}\
.nft-close:hover{color:#fff}\
.nft-history{margin-top:16px}\
.nft-history h3{color:rgba(255,255,255,0.6);font-size:0.9em;margin-bottom:10px}\
.nft-hist-item{display:flex;justify-content:space-between;align-items:center;\
padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.85em;\
color:rgba(255,255,255,0.6)}\
';
  document.head.appendChild(s);
}

// ── Init ──
function init(){
  try{
    T.vid=localStorage.getItem('nafas_vid');
    if(!T.vid){T.vid=gid();localStorage.setItem('nafas_vid',T.vid)}
    T.reg=localStorage.getItem('nafas_reg')==='1';
    T.uname=localStorage.getItem('nafas_uname')||'';
  }catch(e){T.vid=gid()}
  
  T.dev=dv();
  T.tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';
  T.start=Date.now();
  
  injectCSS();
  trackVisit();
  hookSave();
  watchConsent();
  watchMessages();
  window.addEventListener('beforeunload',onUnload);
  setTimeout(addProgressBtn,2000);
}

// ── Track Visit ──
async function trackVisit(){
  try{
    var r=await sf('nafas_visitors?visitor_id=eq.'+T.vid+'&select=visit_count,total_sessions');
    if(!r)return;
    var d=await r.json();
    if(!Array.isArray(d)||d.length===0){
      await sf('nafas_visitors','POST',{
        visitor_id:T.vid,device:T.dev,country:T.tz,
        preferred_language:getLang()
      });
    }else{
      await sf('nafas_visitors?visitor_id=eq.'+T.vid,'PATCH',{
        last_visit:new Date().toISOString(),
        visit_count:(d[0].visit_count||0)+1
      });
    }
    trackEvent('page_visit',{device:T.dev,timezone:T.tz,language:getLang()});
  }catch(e){}
}

// ── Track Event ──
async function trackEvent(type,meta){
  try{
    var sid=null;try{sid=state.sessionId}catch(e){}
    await sf('nafas_analytics','POST',{
      event_type:type,visitor_id:T.vid,session_id:sid,metadata:meta||{}
    });
  }catch(e){}
}

// ── Watch Consent ──
function watchConsent(){
  var el=document.getElementById('consentOverlay');
  if(!el)return;
  var obs=new MutationObserver(function(){
    if(el.style.display==='none'||el.classList.contains('hidden')){
      obs.disconnect();
      trackEvent('consent_accepted');
      setTimeout(function(){showMood('before')},1200);
    }
  });
  obs.observe(el,{attributes:true,attributeFilter:['style','class']});
}

// ── Watch Messages (count) ──
function watchMessages(){
  var chatEl=document.getElementById('chatMessages')||document.querySelector('.chat-messages');
  if(!chatEl){
    setTimeout(watchMessages,2000);
    return;
  }
  var obs=new MutationObserver(function(){
    var msgs=chatEl.querySelectorAll('.message,.chat-message,.msg');
    T.msgCount=msgs.length;
  });
  obs.observe(chatEl,{childList:true,subtree:true});
}

// ── Hook Save Session ──
function hookSave(){
  var iv=setInterval(function(){
    if(typeof window.saveSession==='function'&&!window._nftHooked){
      window._nftHooked=true;
      var orig=window.saveSession;
      window.saveSession=async function(){
        await orig.apply(this,arguments);
        try{
          var sid=state.sessionId;
          if(sid){
            await sf('nafas_sessions?session_id=eq.'+sid,'PATCH',{
              visitor_id:T.vid,
              duration_seconds:Math.floor((Date.now()-T.start)/1000),
              mood_before:T.moodB,mood_after:T.moodA,
              device:T.dev,country:T.tz
            });
            // Update visitor total_sessions
            var vr=await sf('nafas_visitors?visitor_id=eq.'+T.vid+'&select=total_sessions');
            if(vr){var vd=await vr.json();
              if(Array.isArray(vd)&&vd.length>0){
                await sf('nafas_visitors?visitor_id=eq.'+T.vid,'PATCH',{
                  total_sessions:(vd[0].total_sessions||0)+1
                });
              }
            }
          }
        }catch(e){}
        trackEvent('session_saved',{duration:Math.floor((Date.now()-T.start)/1000),messages:T.msgCount});
        if(!T.moodA)setTimeout(function(){showMood('after')},600);
      };
      clearInterval(iv);
    }
  },500);
  setTimeout(function(){clearInterval(iv)},30000);
}

// ── Page Unload ──
function onUnload(){
  var dur=Math.floor((Date.now()-T.start)/1000);
  try{
    localStorage.setItem('nafas_last_dur',dur);
    localStorage.setItem('nafas_last_dt',new Date().toISOString());
  }catch(e){}
  try{
    fetch(S_URL+'/rest/v1/nafas_analytics',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':S_KEY,'Authorization':'Bearer '+S_KEY,'Prefer':'return=minimal'},
      body:JSON.stringify({event_type:'page_unload',visitor_id:T.vid,metadata:{duration_seconds:dur,messages:T.msgCount}}),
      keepalive:true
    });
  }catch(e){}
}

// ── Mood Rating UI ──
function showMood(type){
  if(document.querySelector('.nft-card'))return;
  var isAr=getLang()==='ar';
  var card=document.createElement('div');
  card.className='nft-card';
  
  var title=type==='before'
    ?(isAr?'كيف تشعر/ين الآن؟':'How are you feeling right now?')
    :(isAr?'كيف تشعر/ين بعد الجلسة؟':'How do you feel after the session?');
  var sub=type==='before'
    ?(isAr?'اختر/ي ما يعبّر عن حالتك':'Choose what represents your current state')
    :(isAr?'رأيك يساعدنا نتحسّن':'Your feedback helps us improve');
  
  var emojis=['😫','😔','😐','🙂','😊'];
  var labels=isAr?['مُنهك/ة','حزين/ة','عادي','بخير','ممتاز']:['Exhausted','Sad','Okay','Good','Great'];
  
  var emojiHTML='';
  for(var i=0;i<emojis.length;i++){
    emojiHTML+='<button data-v="'+(i+1)+'" title="'+labels[i]+'">'+emojis[i]+'</button>';
  }
  
  var regHTML='';
  if(type==='after'&&!T.reg){
    regHTML='<div class="nft-reg">\
      <div style="color:rgba(255,255,255,0.4);font-size:0.8em;margin-bottom:8px">'
      +(isAr?'💾 احفظ/ي تقدمك (اختياري)':'💾 Save your progress (optional)')+'</div>\
      <input type="text" id="nftName" placeholder="'+(isAr?'الاسم':'Name')+'">\
      <input type="email" id="nftEmail" placeholder="'+(isAr?'البريد الإلكتروني':'Email')+'">\
      <button class="nft-btn" id="nftRegBtn">'+(isAr?'حفظ':'Save')+'</button>\
    </div>';
  }
  
  card.innerHTML='<h3>'+title+'</h3>\
    <div class="nft-sub">'+sub+'</div>\
    <div class="nft-emojis">'+emojiHTML+'</div>'+regHTML+'\
    <button class="nft-skip">'+(isAr?'تخطي ←':'Skip →')+'</button>';
  
  document.body.appendChild(card);
  
  // Emoji click handlers
  var btns=card.querySelectorAll('.nft-emojis button');
  btns.forEach(function(btn){
    btn.addEventListener('click',function(){
      btns.forEach(function(b){b.classList.remove('sel')});
      btn.classList.add('sel');
      var val=parseInt(btn.getAttribute('data-v'));
      if(type==='before'){T.moodB=val;trackEvent('mood_before',{value:val})}
      else{T.moodA=val;trackEvent('mood_after',{value:val})}
      try{localStorage.setItem('nafas_mood_'+type,val)}catch(e){}
      
      // Auto-close after selection (unless registration form shown)
      if(type==='before'||T.reg){
        setTimeout(function(){closeCard(card)},800);
      }
    });
  });
  
  // Registration handler
  var regBtn=card.querySelector('#nftRegBtn');
  if(regBtn){
    regBtn.addEventListener('click',async function(){
      var name=(document.getElementById('nftName')||{}).value||'';
      var email=(document.getElementById('nftEmail')||{}).value||'';
      if(!name&&!email){return}
      regBtn.disabled=true;
      regBtn.textContent=isAr?'جارٍ الحفظ...':'Saving...';
      try{
        await sf('nafas_visitors?visitor_id=eq.'+T.vid,'PATCH',{
          email:email||null,display_name:name||null,registered:true
        });
        T.reg=true;T.uname=name;
        localStorage.setItem('nafas_reg','1');
        localStorage.setItem('nafas_uname',name);
        trackEvent('user_registered',{has_email:!!email});
        regBtn.textContent=isAr?'✅ تم الحفظ!':'✅ Saved!';
        regBtn.style.background='#22C55E';
        setTimeout(function(){closeCard(card)},1200);
      }catch(e){
        regBtn.disabled=false;
        regBtn.textContent=isAr?'حاول مرة أخرى':'Try again';
      }
    });
  }
  
  // Skip handler
  card.querySelector('.nft-skip').addEventListener('click',function(){
    trackEvent('mood_skipped',{type:type});
    closeCard(card);
  });
  
  // Auto-close after 20 seconds if not interacted
  setTimeout(function(){if(card.parentNode)closeCard(card)},20000);
}

function closeCard(card){
  card.style.animation='nftSlide 0.3s ease reverse';
  card.style.opacity='0';
  setTimeout(function(){if(card.parentNode)card.parentNode.removeChild(card)},300);
}

// ── Progress Button ──
function addProgressBtn(){
  if(document.querySelector('.nft-progress-btn'))return;
  var btn=document.createElement('button');
  btn.className='nft-progress-btn';
  btn.innerHTML='📊 '+(getLang()==='ar'?'تقدّمي':'My Progress');
  btn.addEventListener('click',showDashboard);
  document.body.appendChild(btn);
}

// ── Dashboard ──
async function showDashboard(){
  if(document.querySelector('.nft-dash'))return;
  var isAr=getLang()==='ar';
  
  // Fetch data
  var visitorData=null,sessionsData=[];
  try{
    var vr=await sf('nafas_visitors?visitor_id=eq.'+T.vid+'&select=*');
    if(vr){var vd=await vr.json();if(Array.isArray(vd)&&vd.length>0)visitorData=vd[0]}
    
    var sr=await sf('nafas_sessions?visitor_id=eq.'+T.vid+'&select=created_at,duration_seconds,mood_before,mood_after,burnout_level,language&order=created_at.desc&limit=20');
    if(sr){var sd=await sr.json();if(Array.isArray(sd))sessionsData=sd}
  }catch(e){}
  
  var visits=visitorData?visitorData.visit_count||1:1;
  var totalSessions=visitorData?visitorData.total_sessions||0:0;
  var dur=Math.floor((Date.now()-T.start)/1000);
  var durStr=dur>60?Math.floor(dur/60)+(isAr?' دقيقة':' min'):dur+(isAr?' ثانية':' sec');
  
  // Calculate mood improvement
  var moodImprove='—';
  var moodsWithBoth=sessionsData.filter(function(s){return s.mood_before&&s.mood_after});
  if(moodsWithBoth.length>0){
    var avgBefore=moodsWithBoth.reduce(function(a,s){return a+s.mood_before},0)/moodsWithBoth.length;
    var avgAfter=moodsWithBoth.reduce(function(a,s){return a+s.mood_after},0)/moodsWithBoth.length;
    var diff=((avgAfter-avgBefore)/avgBefore*100).toFixed(0);
    moodImprove=(diff>0?'+':'')+diff+'%';
  }
  
  // Sessions history HTML
  var histHTML='';
  if(sessionsData.length>0){
    sessionsData.forEach(function(s){
      var dt=new Date(s.created_at);
      var dateStr=dt.toLocaleDateString(isAr?'ar-AE':'en-US',{month:'short',day:'numeric'});
      var moods=(s.mood_before?['😫','😔','😐','🙂','😊'][s.mood_before-1]:'')+'→'+(s.mood_after?['😫','😔','😐','🙂','😊'][s.mood_after-1]:'');
      var durS=s.duration_seconds?(s.duration_seconds>60?Math.floor(s.duration_seconds/60)+'m':s.duration_seconds+'s'):'—';
      histHTML+='<div class="nft-hist-item"><span>'+dateStr+'</span><span>'+moods+'</span><span>'+durS+'</span></div>';
    });
  }else{
    histHTML='<div style="text-align:center;color:rgba(255,255,255,0.3);padding:20px;font-size:0.9em">'
      +(isAr?'لا توجد جلسات محفوظة بعد':'No saved sessions yet')+'</div>';
  }
  
  var dash=document.createElement('div');
  dash.className='nft-dash';
  dash.innerHTML='<div class="nft-dash-inner" style="position:relative">\
    <button class="nft-close" id="nftClose">✕</button>\
    <h2>'+(isAr?'📊 رحلتي مع نَفَس':'📊 My Journey with Nafas')+'</h2>\
    '+(T.uname?'<div style="text-align:center;color:rgba(255,255,255,0.5);margin-bottom:16px;font-size:0.9em">'+(isAr?'مرحباً':'Hello')+' '+T.uname+' 💙</div>':'')+'\
    <div class="nft-stats">\
      <div class="nft-stat"><span class="num">'+visits+'</span><span class="lbl">'+(isAr?'زيارة':'Visits')+'</span></div>\
      <div class="nft-stat"><span class="num">'+totalSessions+'</span><span class="lbl">'+(isAr?'جلسة':'Sessions')+'</span></div>\
      <div class="nft-stat"><span class="num">'+durStr+'</span><span class="lbl">'+(isAr?'هذه الجلسة':'This Session')+'</span></div>\
      <div class="nft-stat"><span class="num">'+moodImprove+'</span><span class="lbl">'+(isAr?'تحسّن المزاج':'Mood Change')+'</span></div>\
    </div>\
    '+((!T.reg)?'<div class="nft-reg" style="border-top:none;margin-top:0">\
      <div style="color:rgba(255,255,255,0.4);font-size:0.8em;margin-bottom:8px">'+(isAr?'💾 سجّل/ي لحفظ تقدمك':'💾 Register to save progress')+'</div>\
      <input type="text" id="nftDashName" placeholder="'+(isAr?'الاسم':'Name')+'">\
      <input type="email" id="nftDashEmail" placeholder="'+(isAr?'البريد الإلكتروني':'Email')+'">\
      <button class="nft-btn" id="nftDashReg">'+(isAr?'حفظ':'Save')+'</button>\
    </div>':'')+'\
    <div class="nft-history">\
      <h3>'+(isAr?'📅 سجل الجلسات':'📅 Session History')+'</h3>\
      '+histHTML+'\
    </div>\
  </div>';
  
  document.body.appendChild(dash);
  
  // Close
  dash.querySelector('#nftClose').addEventListener('click',function(){
    dash.style.opacity='0';
    setTimeout(function(){if(dash.parentNode)dash.parentNode.removeChild(dash)},300);
  });
  dash.addEventListener('click',function(e){
    if(e.target===dash){
      dash.style.opacity='0';
      setTimeout(function(){if(dash.parentNode)dash.parentNode.removeChild(dash)},300);
    }
  });
  
  // Registration from dashboard
  var dRegBtn=dash.querySelector('#nftDashReg');
  if(dRegBtn){
    dRegBtn.addEventListener('click',async function(){
      var name=(document.getElementById('nftDashName')||{}).value||'';
      var email=(document.getElementById('nftDashEmail')||{}).value||'';
      if(!name&&!email)return;
      dRegBtn.disabled=true;
      try{
        await sf('nafas_visitors?visitor_id=eq.'+T.vid,'PATCH',{
          email:email||null,display_name:name||null,registered:true
        });
        T.reg=true;T.uname=name;
        localStorage.setItem('nafas_reg','1');
        localStorage.setItem('nafas_uname',name);
        dRegBtn.textContent=isAr?'✅ تم!':'✅ Done!';
        dRegBtn.style.background='#22C55E';
        trackEvent('user_registered',{source:'dashboard',has_email:!!email});
      }catch(e){dRegBtn.disabled=false}
    });
  }
}

// ── Start ──
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',init)}
else{init()}

window.NafasTracker=T;
})();
