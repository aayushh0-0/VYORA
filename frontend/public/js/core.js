// Shared runtime branch: chat + speech utilities
(function(){
function formatMsgTime(d){
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d || new Date());
  } catch {
    const x = d || new Date();
    let h = x.getHours(), m = x.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }
}

function formatChatText(text){
  const d = document.createElement('div');
  d.textContent = String(text ?? '');
  let h = d.innerHTML;
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/(^|\n)[•\*]\s+/g, '$1• ');
  h = h.replace(/\n/g, '<br>');
  return h;
}
function addMsg(logId, cls, text){
  const log = document.getElementById(logId);
  if (!log) return null;
  const isBot = cls === 'bot';
  const isSystem = cls === 'system';
  if (isSystem) {
    const d = document.createElement('div');
    d.className = 'msg-row system';
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  const row = document.createElement('div');
  row.className = 'msg-row ' + (isBot ? 'bot' : 'user');
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  if (isBot) {
    // Square logo mark (not the wide wordmark icon) so the circle never crops to "VYOF"
    avatar.innerHTML = '<img class="msg-avatar-img" src="/assets/vyora-logo.png" alt="VYORA" width="40" height="40" onerror="this.onerror=null;this.src=\'/assets/vyora-avatar.svg\'" />';
  } else {
    avatar.innerHTML = '<img class="msg-avatar-img" src="/assets/user-avatar.svg" alt="You" width="36" height="36" />';
  }

  const col = document.createElement('div');
  col.className = 'msg-col';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = formatChatText(text);
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = formatMsgTime();
  col.append(bubble, meta);

  if (isBot) row.append(avatar, col);
  else row.append(col, avatar);

  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  return row;
}

/** Compact typing indicator — loader sized like the avatar (~36px). */
function addTypingMsg(logId){
  const log = document.getElementById(logId);
  if (!log) return null;
  const row = document.createElement('div');
  row.className = 'msg-row bot typing';
  row.setAttribute('aria-live', 'polite');
  row.setAttribute('aria-label', 'VYORA is thinking');

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.innerHTML = '<img class="msg-avatar-img" src="/assets/vyora-logo.png" alt="VYORA" width="40" height="40" onerror="this.onerror=null;this.src=\'/assets/vyora-avatar.svg\'" />';

  const col = document.createElement('div');
  col.className = 'msg-col';
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble typing-bubble';
  const loader = document.createElement('div');
  loader.className = 'msg-loader';
  loader.innerHTML = '<img class="msg-loader-icon" src="/assets/loading_animation.svg" alt="" width="28" height="28" decoding="async" onerror="this.style.display=\'none\'" />';
  const text = document.createElement('div');
  text.className = 'msg-typing-text';
  text.hidden = true;
  bubble.append(loader, text);
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = formatMsgTime();
  col.append(bubble, meta);

  row.append(avatar, col);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  return row;
}

function setTypingText(el, value){
  if (!el) return;
  const loader = el.querySelector('.msg-loader');
  const text = el.querySelector('.msg-typing-text');
  const bubble = el.querySelector('.msg-bubble');
  if (text) {
    text.hidden = false;
    text.textContent = value;
  } else if (bubble) {
    bubble.textContent = value;
  }
  if (loader) loader.hidden = true;
  el.classList.remove('typing');
  if (bubble) bubble.classList.remove('typing-bubble');
  const log = el.closest('.chat-log') || el.parentElement;
  if (log) log.scrollTop = log.scrollHeight;
}

function speakWithOrb(text, orb, status){
  if(!orb) return;
  orb.classList.remove("think","listen","lip-open","lip-shut");
  orb.classList.add("talk");
  // Do not show "Speaking…" — the face + equalizer express it
  if(status){ status.dataset.prev = status.textContent; status.textContent = ""; }

  let lipTimer = null;
  const clearLip = () => {
    if(lipTimer){ clearInterval(lipTimer); lipTimer = null; }
    orb.classList.remove("lip-open","lip-shut","talk");
    if(status) status.textContent = "Ready";
  };

  const startFallbackLip = () => {
    // Approximate lip flaps when boundary events are unavailable
    let open = false;
    lipTimer = setInterval(() => {
      open = !open;
      orb.classList.toggle("lip-open", open);
      orb.classList.toggle("lip-shut", !open);
    }, 140);
  };

  try{
    if("speechSynthesis" in window){
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(String(text || ""));
      u.rate = 1.02;
      u.pitch = 1.05;
      // Boundary events drive more natural lip sync when the engine supports them
      let gotBoundary = false;
      u.onboundary = (ev) => {
        if(ev.name === "word" || ev.name === "sentence"){
          gotBoundary = true;
          if(lipTimer){ clearInterval(lipTimer); lipTimer = null; }
          orb.classList.add("lip-open");
          orb.classList.remove("lip-shut");
          setTimeout(() => {
            if(orb.classList.contains("talk")){
              orb.classList.remove("lip-open");
              orb.classList.add("lip-shut");
            }
          }, 90);
        }
      };
      u.onstart = () => {
        setTimeout(() => { if(!gotBoundary && orb.classList.contains("talk")) startFallbackLip(); }, 400);
      };
      u.onend = clearLip;
      u.onerror = clearLip;
      window.speechSynthesis.speak(u);
    } else {
      startFallbackLip();
      setTimeout(clearLip, Math.min(4500, 1200 + String(text||"").length * 35));
    }
  }catch(e){
    startFallbackLip();
    setTimeout(clearLip, 1500);
  }
}
function wireChat(inputId, sendId, logId, orbId, replyFn){
  const input=document.getElementById(inputId), orb=document.getElementById(orbId);
  const status=document.getElementById(orbId+"Status");
  const sendBtn=document.getElementById(sendId);
  let busy=false;
  async function send(){
    const val=input.value.trim();
    if(!val || busy) return;
    busy=true;
    if(sendBtn) sendBtn.disabled=true;
    addMsg(logId,"user",val); input.value="";
    orb.classList.remove("talk","listen");
    orb.classList.add("think");
    if(status) status.textContent="Thinking…";
    const typing=addTypingMsg(logId);
    try {
      const reply=await replyFn(val, {
        onDelta(chunk, full){
          setTypingText(typing, full);
        }
      });
      orb.classList.remove("think");
      if(typing) setTypingText(typing, reply);
      else addMsg(logId,"bot",reply);
      speakWithOrb(reply, orb, status);
    } catch(e) {
      orb.classList.remove("think");
      if(status) status.textContent="Error";
      const reply=e?.message || "I couldn't connect to the AI service right now.";
      if(typing) setTypingText(typing, reply);
      else addMsg(logId,"bot",reply);
    } finally {
      busy=false;
      if(sendBtn) sendBtn.disabled=false;
      if(status && status.textContent==="Thinking…") status.textContent="Ready";
    }
  }
  sendBtn?.addEventListener("click",send);
  input.addEventListener("keydown",e=>{if(e.key==="Enter")send();});
  return {send};
}

function wireMic(btnId, inputId, orbId, onVoice){
  const btn=document.getElementById(btnId), input=document.getElementById(inputId);
  const orb=document.getElementById(orbId), status=document.getElementById(orbId+"Status");
  const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){ btn.addEventListener("click",()=>alert("Voice input isn't supported in this browser — please type instead.")); return; }
  const rec=new SR(); rec.lang="en-US"; rec.interimResults=false; rec.continuous=false;
  let on=false;
  btn.addEventListener("click",()=>{
    if(on){ rec.stop(); return; }
    try{ rec.start(); on=true; btn.classList.add("on"); orb.classList.add("listen"); if(status) status.textContent="Listening…"; }catch(e){}
  });
  rec.onresult=(e)=>{
    const transcript=e.results[0][0].transcript.trim();
    input.value=transcript;
    if(typeof onVoice==='function') onVoice(transcript);
  };
  rec.onend=()=>{ on=false; btn.classList.remove("on"); orb.classList.remove("listen"); if(status) status.textContent="Ready"; };
  rec.onerror=()=>{ on=false; btn.classList.remove("on"); orb.classList.remove("listen"); if(status) status.textContent="Ready"; };
}
function triggerWave(id){
  const el=document.getElementById(id); if(!el) return;
  el.classList.add("show");
  el.addEventListener("animationend",()=>el.classList.remove("show"),{once:true});
}
function navigate(target){
  const b=document.querySelector('[data-target="'+target+'"]');
  if(b) b.click();
  else { const v=document.getElementById(target); if(v) v.classList.add('active'); }
}
window.VyoraCore={addMsg,addTypingMsg,setTypingText,speakWithOrb,wireChat,wireMic,triggerWave,navigate};
})();
