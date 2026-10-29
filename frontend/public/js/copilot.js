// VYORA Copilot branch — Stage 8: chat, voice routing, stop-speech control, visible/clearable memory & report-answer safety control
(function(){
const {addMsg,wireChat,wireMic,triggerWave,navigate,speakWithOrb}=window.VyoraCore;
let persona = "calm";

// Live VYORA energy orb (WebGL2 — assets/orb/orb.js)
let vyoraOrbEmpty = null;
let vyoraOrbChat = null;
function initVyoraOrbs(){
  ["vyoraOrbEmpty", "vyoraOrbChat"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.tagName === "VIDEO") {
      try { el.play?.().catch(() => {}); } catch (_) {}
    }
  });
  if(!window.VyoraOrb || typeof window.VyoraOrb.create !== "function") return;
  const emptyHost = document.getElementById("vyoraOrbEmpty");
  const chatHost = document.getElementById("vyoraOrbChat");
  try {
    if(emptyHost && emptyHost.tagName !== "VIDEO" && !vyoraOrbEmpty){
      vyoraOrbEmpty = window.VyoraOrb.create(emptyHost, {
        colors: ['#ef233c', '#ff6b4a', '#7a1020'],
        size: 0.72, glow: 1.55, wobble: 1.35, bleed: 1.3, highlight: 1.3,
        speed: 1.75, trail: 1.25, hoverIntensity: 1.25,
        followCursor: true, clickPulse: true, intro: true, rotateOnHover: true
      });
      vyoraOrbEmpty.setState("idle");
    }
    if(chatHost && chatHost.tagName !== "VIDEO" && !vyoraOrbChat){
      vyoraOrbChat = window.VyoraOrb.create(chatHost, {
        colors: ['#ef233c', '#ff6b4a', '#7a1020'],
        size: 0.9, glow: 1.35, wobble: 1.4, speed: 1.7, trail: 1.2,
        followCursor: true, clickPulse: true, rotateOnHover: true
      });
      vyoraOrbChat.setState("idle");
    }
  } catch(e) { console.warn("VyoraOrb init:", e); }
}
function setVyoraOrbState(state){
  try {
    vyoraOrbEmpty?.setState?.(state);
    vyoraOrbChat?.setState?.(state);
  } catch(_){}
}
initVyoraOrbs();
function ensureOrbFallbackPlaying(){
  const v = document.getElementById("vyoraOrbFallback");
  if (v && v.tagName === "VIDEO") {
    try { v.play?.().catch(() => {}); } catch (_) {}
  }
}
window.addEventListener("vyora:view-active", () => {
  try { vyoraOrbEmpty?.destroy?.(); } catch (_) {}
  try { vyoraOrbChat?.destroy?.(); } catch (_) {}
  vyoraOrbEmpty = null;
  vyoraOrbChat = null;
  initVyoraOrbs();
  ensureOrbFallbackPlaying();
});
ensureOrbFallbackPlaying();

let lastUserMsg = "";
let lastBotReply = "";

document.querySelectorAll("#personaRow button").forEach(b=>{
  b.addEventListener("click",()=>{
    document.querySelectorAll("#personaRow button").forEach(x=>x.classList.remove("active"));
    b.classList.add("active"); persona=b.dataset.p;
    addMsg("vyoraLog","system","Personality set to "+b.textContent+".");
  });
});

// Add visible Copilot Memory & Safety Controls bar below chat
(function attachCopilotControls(){
  const log = document.getElementById("vyoraLog");
  const chatWrap = log?.closest(".chat");
  if (!chatWrap || document.getElementById("copilotSafetyBar")) return;

  const bar = document.createElement("div");
  bar.id = "copilotSafetyBar";
  bar.className = "chat-row";
  bar.style.marginTop = "8px";
  bar.style.flexWrap = "wrap";

  const stopAudioBtn = document.createElement("button");
  stopAudioBtn.type = "button";
  stopAudioBtn.className = "btn ghost";
  stopAudioBtn.textContent = "Stop Audio ⏹";
  stopAudioBtn.addEventListener("click", () => {
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch {}
    const status = document.getElementById("orbChatStatus");
    if (status) status.textContent = "Stopped";
  });

  const viewMemBtn = document.createElement("button");
  viewMemBtn.type = "button";
  viewMemBtn.className = "btn ghost";
  viewMemBtn.textContent = "Memory Notes";
  viewMemBtn.addEventListener("click", async () => {
    if (!window.VyoraAPI?.getChatMemory) return;
    try {
      const mem = await window.VyoraAPI.getChatMemory();
      const text = mem.items?.length ? "Saved Copilot preferences: " + mem.items.join(" · ") : "No saved Copilot memory notes.";
      addMsg("vyoraLog", "system", text);
    } catch (e) {
      addMsg("vyoraLog", "system", "Could not load memory: " + e.message);
    }
  });

  const clearMemBtn = document.createElement("button");
  clearMemBtn.type = "button";
  clearMemBtn.className = "btn ghost";
  clearMemBtn.textContent = "Clear Memory";
  clearMemBtn.addEventListener("click", async () => {
    if (!window.VyoraAPI?.clearChatMemory) return;
    try {
      await window.VyoraAPI.clearChatMemory();
      addMsg("vyoraLog", "system", "Cleared Copilot conversation memory.");
    } catch (e) {
      addMsg("vyoraLog", "system", "Could not clear memory: " + e.message);
    }
  });

  const reportBtn = document.createElement("button");
  reportBtn.type = "button";
  reportBtn.className = "btn ghost";
  reportBtn.textContent = "Report AI Answer ⚑";
  reportBtn.addEventListener("click", async () => {
    const reason = prompt("Why are you reporting the last AI response? (e.g. unsafe advice, inaccurate estimate)");
    if (!reason?.trim() || !window.VyoraAPI?.reportAiAnswer) return;
    try {
      const res = await window.VyoraAPI.reportAiAnswer({
        mode: "vyora",
        userMessage: lastUserMsg,
        aiResponse: lastBotReply,
        reason: reason.trim()
      });
      addMsg("vyoraLog", "system", res.message || "Safety report submitted.");
    } catch (e) {
      addMsg("vyoraLog", "system", "Could not submit report: " + e.message);
    }
  });

  bar.append(stopAudioBtn, viewMemBtn, clearMemBtn, reportBtn);
  chatWrap.appendChild(bar);
})();

const tones = {
  calm:{pre:"",post:" Take it one step at a time."},
  drill:{pre:"Alright. ",post:" Stay consistent today."},
  bro:{pre:"Yo. ",post:" Let's keep moving safely."},
  nerd:{pre:"Estimate check: ",post:" Note: all macro and load figures carry ±15% uncertainty."}
};

let chatHistory = [];
async function vyoraReply(msg, opts){
  lastUserMsg = msg;
  const onDelta = opts && opts.onDelta;
  try {
    if(window.VyoraAPI) {
      let reply;
      if (typeof window.VyoraAPI.chatStream === "function") {
        try {
          reply = await window.VyoraAPI.chatStream(msg, "vyora", chatHistory, typeof persona !== "undefined" ? persona : "calm", onDelta);
        } catch (streamErr) {
          console.warn("Stream failed, using standard chat:", streamErr.message);
          reply = await window.VyoraAPI.chat(msg, "vyora", chatHistory, typeof persona !== "undefined" ? persona : "calm");
        }
      } else {
        reply = await window.VyoraAPI.chat(msg, "vyora", chatHistory, typeof persona !== "undefined" ? persona : "calm");
      }
      lastBotReply = reply;
      chatHistory.push({ role: "user", text: msg });
      chatHistory.push({ role: "model", text: reply });
      if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);
      return reply;
    }
  } catch(e) {
    console.warn("Copilot API error:", e.message);
    const m = String(e.message || "");
    if (/not configured|GEMINI_API_KEY/i.test(m) && /not configured|set GEMINI|project root \.env/i.test(m)) {
      throw new Error("Gemini is not configured on the server. Add GEMINI_API_KEY to the project root .env and restart npm run dev.");
    }
    if (/quota|rate limit|RESOURCE_EXHAUSTED|429/i.test(m)) {
      throw new Error("Gemini rate limit or quota reached. Wait a minute, then try a shorter question.");
    }
    if (/API[_ ]?key|API_KEY_INVALID|invalid.*key|PERMISSION_DENIED/i.test(m)) {
      throw new Error("Gemini rejected the API key. Check GEMINI_API_KEY in the project root .env and restart the server.");
    }
    if (/not found|NOT_FOUND|model unavailable/i.test(m)) {
      throw new Error("Gemini model unavailable. Set GEMINI_MODEL=gemini-3.5-flash-lite in .env and restart.");
    }
    if (/too long|timeout|timed out/i.test(m)) {
      throw new Error("Gemini took too long. Try a shorter question.");
    }
    if (/401|unauthorized|session expired|invalid or expired/i.test(m)) {
      throw new Error("Session expired. Refresh the page or sign in again, then retry.");
    }
    throw new Error(m || "Could not reach the VYORA chat service.");
  }
  const m = msg.toLowerCase();
  let body;
  if(m.includes("no egg")||m.includes("egg-free")) body="Updated: I can swap egg meals for high-protein Moong Dal & Paneer Chilla or Tofu Bhurji while keeping the rest of your plan unchanged.";
  else if(m.includes("tired")||m.includes("sore")||m.includes("knee")||m.includes("pain")) body="I hear you. Stop any movement that causes sharp or worsening pain. I'll switch lower-body impact to conservative glute bridges and mobility, and recommend checking with a qualified clinician if pain persists.";
  else if(m.includes("performance")||m.includes("predict")||m.includes("5k")||m.includes("10k")) body="Opening Performance Predictions in Special Training. Estimates require sufficient logged sessions and carry uncertainty.";
  else if(m.includes("compare")||m.includes("progress")) body="Opening Progress Comparison to compare your recent workload against your baseline.";
  else if(m.includes("intelligence")||m.includes("insight")||m.includes("athlete")) body="Opening Athlete Intelligence for advisory consistency and recovery trends.";
  else if(m.includes("route")||m.includes("map")) body="Opening route planning. Live turn-by-turn routing requires a licensed maps provider.";
  else if(m.includes("layer")||m.includes("elevation")||m.includes("terrain")) body="Opening route layers.";
  else if(m.includes("destination")||m.includes("stop")||m.includes("cafe stop")||m.includes("café")) body="Opening destination mode to save a café, hydration stop, or viewpoint.";
  else if(m.includes("leaderboard")||m.includes("ranking")) body="Opening the opt-in leaderboard.";
  else if(m.includes("challenge")||m.includes("friends")) body="Opening Group Challenge.";
  else if(m.includes("local legend")||m.includes("segment")) body="Opening Local Legend.";
  else if(m.includes("workout")||m.includes("exercise")||m.includes("training")) body="I can help you plan or adapt a workout (e.g. indoor/outdoor, 20-min express, quiet apartment, or knee-friendly).";
  else if(m.includes("diet")||m.includes("eat")||m.includes("food")||m.includes("meal")) body="I can generate Indian or international meal suggestions with approximate macros (±15% uncertainty) and quick exclusions like 'no eggs today'.";
  else if(m.includes("gym")||m.includes("cafe")||m.includes("nearby")||m.includes("near me")) body="Opening Gyms & Cafés.";
  else if(m.includes("community")||m.includes("blog")||m.includes("vlog")||m.includes("reel")) body="Opening Community Hub.";
  else if(m.includes("ovula")||m.includes("cycle")||m.includes("cramp")) body="Opening OVULA, your private menstrual wellness and comfort companion.";
  else if(m.includes("business")||m.includes("campaign")||m.includes("partner")) body="Opening Business for gym partners and aggregate campaign analytics.";
  else if(m.includes("medication")||m.includes("medicine")||m.includes("reminder")) body="Before I schedule a medication reminder, please confirm the exact medication label, time, timezone, verified email/phone destination, and channel in Health Journey. VYORA never changes prescribed dosages.";
  else if(m.includes("health")||m.includes("condition")||m.includes("diabetes")||m.includes("blood pressure")||m.includes("thyroid")) body="Opening Health Journey. Track conditions, reminders, and vitals alongside your doctor's care.";
  else if(m.includes("vital")||m.includes("blood sugar")||m.includes("bp")) body="Opening Health Journey vitals tracking.";
  else if(m.includes("pro")||m.includes("trainer")||m.includes("book trainer")) body="Opening VYORA Pro for verified human trainer sessions.";
  else if(m.includes("plan")||m.includes("build my plan")) body="Use the Plan Builder above to generate a schema-validated diet and workout plan, then use the quick swap buttons to regenerate individual meals or sessions.";
  else body="Got it. Ask me to adapt your meal or workout plan (e.g., 'no eggs today', 'shorter workout', 'knee hurts'), check your progress, or navigate any VYORA module.";
  const t=tones[persona] || tones.calm;
  lastBotReply = t.pre+body+t.post;
  return lastBotReply;
}

function commandAction(msg){
  const m=msg.toLowerCase();
  if(m.includes('performance')||m.includes('predict')||m.includes('5k')||m.includes('10k')){navigate('training'); window.VyoraTraining?.showTab('train'); window.VyoraTraining?.runAction('predict'); return 'Opening Performance Predictions.';}
  if(m.includes('compare')||m.includes('progress')){navigate('training'); window.VyoraTraining?.showTab('train'); window.VyoraTraining?.runAction('compare'); return 'Opening Progress Comparison.';}
  if(m.includes('intelligence')||m.includes('insight')){navigate('training'); window.VyoraTraining?.showTab('train'); window.VyoraTraining?.runAction('intelligence'); return 'Opening Athlete Intelligence.';}
  if(m.includes('route')||m.includes('map')){navigate('training'); window.VyoraTraining?.showTab('explore'); window.VyoraTraining?.runAction('routes'); return 'Opening personalized route planning.';}
  if(m.includes('terrain')||m.includes('trail')){navigate('training'); window.VyoraTraining?.showTab('explore'); window.VyoraTraining?.runAction('terrain'); return 'Opening terrain exploration.';}
  if(m.includes('poi')||m.includes('point of interest')){navigate('training'); window.VyoraTraining?.showTab('explore'); window.VyoraTraining?.runAction('poi'); return 'Opening points of interest.';}
  if(m.includes('destination')||m.includes('stop')||m.includes('café')||m.includes('cafe')){navigate('training'); window.VyoraTraining?.showTab('explore'); window.VyoraTraining?.runAction('destination'); return 'Opening destination and stop planning.';}
  if(m.includes('leaderboard')||m.includes('ranking')){navigate('training'); window.VyoraTraining?.showTab('compete'); window.VyoraTraining?.runAction('leaderboard'); return 'Opening the leaderboard.';}
  if(m.includes('challenge')||m.includes('friends')){navigate('training'); window.VyoraTraining?.showTab('compete'); window.VyoraTraining?.runAction('challenge'); return 'Opening Group Challenge.';}
  if(m.includes('local legend')||m.includes('segment')){navigate('training'); window.VyoraTraining?.showTab('compete'); window.VyoraTraining?.runAction('legend'); return 'Opening Local Legend.';}
  const sections=[
    ['workout',['workout','exercise']],['training',['special training','training intelligence','special workout']],['diet',['diet','nutrition','meal']],['locator',['gym','gyms','cafe','nearby','near me']],
    ['community',['community','blog','vlog','reel']],['ovula',['ovula','cycle','cramp']],['business',['business','partner','campaign']],
    ['health',['health','condition','diabetes','thyroid','blood pressure','medication','medicine','vital','blood sugar']],['pro',['pro','trainer','book trainer']],['vyora',['copilot','talk to vyora']],['home',['home','dashboard','plan']]
  ];
  for(const [id,words] of sections){if(words.some(w=>m.includes(w))){navigate(id); return 'Opening '+id.replace('locator','Gyms and Cafés').replace('pro','VYORA Pro').replace('vyora','VYORA Chat')+'.';}}
  return null;
}

function showVyoraEmpty(){
  document.getElementById("vyora")?.classList.remove("is-chatting");
  document.getElementById("vyoraEmpty")?.removeAttribute("hidden");
  document.getElementById("vyoraChatPanel")?.setAttribute("hidden","");
  document.getElementById("vyoraBottomComposer")?.setAttribute("hidden","");
  document.getElementById("vyoraJumpLatest")?.classList.remove("is-visible");
  requestAnimationFrame(() => {
    initVyoraOrbs();
    setVyoraOrbState("idle");
  });
}
function showVyoraChat(){
  const empty = document.getElementById("vyoraEmpty");
  const chat = document.getElementById("vyoraChatPanel");
  const bar = document.getElementById("vyoraBottomComposer");
  const page = document.getElementById("vyora");
  page?.classList.add("is-chatting");
  if(empty) empty.setAttribute("hidden","");
  if(chat) chat.removeAttribute("hidden");
  if(bar) bar.removeAttribute("hidden");
  requestAnimationFrame(() => {
    initVyoraOrbs();
    setVyoraOrbState("idle");
    scrollVyoraLogToBottom(false);
    updateVyoraJumpBtn();
  });
}
function resetVyoraChat(){
  chatHistory = [];
  lastUserMsg = "";
  lastBotReply = "";
  const log = document.getElementById("vyoraLog");
  if(log) log.innerHTML = "";
  showVyoraEmpty();
  const emptyInput = document.getElementById("vyoraInputEmpty");
  if(emptyInput) emptyInput.value = "";
  const input = document.getElementById("vyoraInput");
  if(input) input.value = "";
}

function sendVyoraMessage(raw){
  const msg = String(raw || "").trim();
  if(!msg) return;
  showVyoraChat();
  // Prefer the wired send path via input
  const input = document.getElementById("vyoraInput");
  if(input){
    input.value = msg;
    document.getElementById("vyoraSend")?.click();
  }
}

// Primary chat composer (bottom bar)
wireChat("vyoraInput","vyoraSend","vyoraLog","orbChat",vyoraReply);
// Ensure chat panel visible when sending from bottom bar
document.getElementById("vyoraSend")?.addEventListener("click", () => {
  if(document.getElementById("vyoraInput")?.value.trim()) showVyoraChat();
}, true);


// Empty-state composer → first message
(function wireEmptyComposer(){
  const input = document.getElementById("vyoraInputEmpty");
  const send = document.getElementById("vyoraSendEmpty");
  if(!input || !send) return;
  const go = () => {
    const v = input.value.trim();
    if(!v) return;
    input.value = "";
    sendVyoraMessage(v);
  };
  send.addEventListener("click", go);
  input.addEventListener("keydown", e => { if(e.key === "Enter") go(); });
})();

// Mic on empty state
wireMic("vyoraMicEmpty","vyoraInputEmpty","orbChat", async (transcript) => {
  sendVyoraMessage(transcript);
});

// Mic on chat bar
wireMic("vyoraMic","vyoraInput","orbChat", async (transcript) => {
  showVyoraChat();
  addMsg("vyoraLog","user",transcript);
  try {
    const reply = await vyoraReply(transcript);
    addMsg("vyoraLog","bot",reply);
    speakWithOrb(reply, document.getElementById("orbChat"), document.getElementById("orbChatStatus"));
  } catch(e) {
    addMsg("vyoraLog","bot", e?.message || "Could not reach VYORA.");
  }
  const input = document.getElementById("vyoraInput");
  if(input) input.value = "";
});

// Suggestion cards
document.getElementById("vyoraSuggestions")?.addEventListener("click", e => {
  const btn = e.target.closest("[data-prompt]");
  if(!btn) return;
  sendVyoraMessage(btn.getAttribute("data-prompt"));
});

// Persona select → legacy personaRow + variable
const personaSelect = document.getElementById("vyoraPersonaSelect");
personaSelect?.addEventListener("change", () => {
  persona = personaSelect.value || "calm";
  document.querySelectorAll("#personaRow button").forEach(b => {
    b.classList.toggle("active", b.dataset.p === persona);
  });
});

// New chat
document.getElementById("vyoraNewChat")?.addEventListener("click", resetVyoraChat);


// Sync energy orb states with chat activity
(function syncOrbStates(){
  const legacy = document.getElementById("orbChat");
  if(!legacy || !window.MutationObserver) return;
  const mo = new MutationObserver(() => {
    if(legacy.classList.contains("talk")) setVyoraOrbState("responding");
    else if(legacy.classList.contains("think")) setVyoraOrbState("thinking");
    else if(legacy.classList.contains("listen")) setVyoraOrbState("listening");
    else setVyoraOrbState("idle");
  });
  mo.observe(legacy, { attributes:true, attributeFilter:["class"] });
})();


function scrollVyoraLogToBottom(smooth){
  const log = document.getElementById("vyoraLog");
  if(!log) return;
  log.scrollTo({ top: log.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}
function updateVyoraJumpBtn(){
  const log = document.getElementById("vyoraLog");
  const btn = document.getElementById("vyoraJumpLatest");
  if(!log || !btn) return;
  const dist = log.scrollHeight - log.scrollTop - log.clientHeight;
  btn.classList.toggle("is-visible", dist > 80);
}
(function wireVyoraScroll(){
  const log = document.getElementById("vyoraLog");
  const btn = document.getElementById("vyoraJumpLatest");
  if(log){
    log.addEventListener("scroll", updateVyoraJumpBtn, { passive: true });
  }
  btn?.addEventListener("click", () => {
    scrollVyoraLogToBottom(true);
    btn.classList.remove("is-visible");
  });
  // After messages append, stay at bottom if already near end
  const mo = log && new MutationObserver(() => {
    const dist = log.scrollHeight - log.scrollTop - log.clientHeight;
    if(dist < 120) scrollVyoraLogToBottom(false);
    updateVyoraJumpBtn();
  });
  if(mo && log) mo.observe(log, { childList: true, subtree: true });
})();

// Start on empty state (no auto welcome bubble)
showVyoraEmpty();
initVyoraOrbs();

})();
