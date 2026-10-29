/*! Pace athlete platform — embedded in #training (vanilla port of branchwise React prototype) */
(function () {
  'use strict';
  const root = document.getElementById('training');
  if (!root) return;

  const SEED_ACTIVITIES = [
    { id: 1, type: 'Run', title: 'Morning tempo run', date: '2026-10-27', distance: 6.42, duration: 1880, elevation: 48, pace: '4:52', kudos: 18, notes: 'Strong finish on the final kilometre.' },
    { id: 2, type: 'Ride', title: 'City loop', date: '2026-10-25', distance: 24.8, duration: 3610, elevation: 210, pace: '24.7 km/h', kudos: 32, notes: 'Easy endurance ride.' },
    { id: 3, type: 'Run', title: 'Recovery miles', date: '2026-10-23', distance: 4.1, duration: 1510, elevation: 22, pace: '6:08', kudos: 9, notes: 'Kept the effort relaxed.' },
    { id: 4, type: 'Hike', title: 'Weekend trail', date: '2026-10-20', distance: 8.7, duration: 6840, elevation: 380, pace: '13:06', kudos: 24, notes: 'Beautiful trail and great views.' }
  ];
  const SEED_CHALLENGES = [
    { id: 1, name: 'October 50K', desc: 'Run 50 km this month', progress: 31.2, target: 50, unit: 'km', joined: true, ends: 'Oct 31' },
    { id: 2, name: 'Climb Higher', desc: 'Gain 1,000 m elevation', progress: 620, target: 1000, unit: 'm', joined: false, ends: 'Nov 08' },
    { id: 3, name: 'Consistency Club', desc: 'Complete 12 activities', progress: 8, target: 12, unit: 'activities', joined: true, ends: 'Nov 15' }
  ];
  const SEED_POSTS = [
    { id: 1, name: 'Maya Chen', handle: '@mayaruns', time: '18 min ago', text: 'First 10K without checking my watch every 30 seconds. The work is working. 🏃', likes: 24, liked: false, tag: 'Run' },
    { id: 2, name: 'Jordan Lee', handle: '@jordanrides', time: '1 hr ago', text: 'Found a quiet loop along the river this morning. Sharing the route with anyone who needs an easy recovery spin.', likes: 17, liked: false, tag: 'Ride' },
    { id: 3, name: 'Sam Rivera', handle: '@samonthetrail', time: '3 hrs ago', text: 'Reminder: easy days should actually feel easy. Your future self will thank you.', likes: 41, liked: false, tag: 'Training tip' }
  ];
  const SEED_PROFILE = { name: 'Alex Morgan', handle: '@alexmoves', location: 'New Delhi, India', bio: 'Run, ride, explore. Chasing consistency over perfection.', goal: 'Build endurance', weeklyGoal: 25 };

  function read(key, seed) {
    try {
      const raw = localStorage.getItem('pace_' + key);
      if (raw == null) return seed;
      const parsed = JSON.parse(raw);
      if (Array.isArray(seed) && Array.isArray(parsed) && parsed.length === 0) return seed;
      return parsed ?? seed;
    } catch { return seed; }
  }
  function persist(key, value) {
    try { localStorage.setItem('pace_' + key, JSON.stringify(value)); } catch (_) {}
  }
  function duration(s) {
    s = Math.floor(s || 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  let activities = read('activities', SEED_ACTIVITIES);
  let challenges = read('challenges', SEED_CHALLENGES);
  let posts = read('posts', SEED_POSTS);
  let profile = read('profile', SEED_PROFILE);

  // Recorder state
  let recType = 'Run', recStatus = 'ready', recSeconds = 0, recKm = 0, recTimer = null;

  const pages = {};
  const app = root.querySelector('.pace-app');
  if (!app) return;

  function totalKm() {
    return activities.reduce((s, a) => s + (Number(a.distance) || 0), 0);
  }
  function totalHours() {
    return activities.reduce((s, a) => s + (Number(a.duration) || 0), 0) / 3600;
  }
  function switchPage(id) {
    app.querySelectorAll('.pace-page').forEach((p) => p.classList.toggle('active', p.dataset.page === id));
    app.querySelectorAll('.pace-nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === id));
    renderPage(id);
  }

  function activityIcon(type) {
    return type === 'Ride' ? '🚴' : type === 'Hike' ? '⛰' : '↗';
  }

  function renderActivityRows(list, container) {
    container.replaceChildren();
    if (!list.length) {
      container.appendChild(el('p', 'muted', 'No activities yet. Record one to get started.'));
      return;
    }
    list.forEach((a) => {
      const row = el('button', 'activity-row');
      row.type = 'button';
      row.innerHTML = `<span class="activity-icon">${activityIcon(a.type)}</span>
        <span class="activity-name"><b></b><small></small></span>
        <span class="activity-value"><b></b><small></small></span>
        <span class="kudos"></span>`;
      row.querySelector('.activity-name b').textContent = a.title;
      row.querySelector('.activity-name small').textContent = `${a.type} · ${a.date}`;
      row.querySelector('.activity-value b').innerHTML = `${Number(a.distance).toFixed(2)} <small>km</small>`;
      row.querySelector('.activity-value small').textContent = a.pace || '—';
      row.querySelector('.kudos').textContent = `♡ ${a.kudos || 0}`;
      row.addEventListener('click', () => openModal(a));
      container.appendChild(row);
    });
  }

  function renderDashboard() {
    const page = app.querySelector('[data-page="dashboard"]');
    if (!page) return;
    const km = totalKm();
    const hours = totalHours();
    const pct = Math.min(100, Math.round((km / (profile.weeklyGoal || 25)) * 100));
    page.querySelector('[data-stat="km"]').innerHTML = `${km.toFixed(1)}<small>km</small>`;
    page.querySelector('[data-stat="hours"]').innerHTML = `${hours.toFixed(1)}<small>hrs</small>`;
    page.querySelector('[data-stat="count"]').innerHTML = `${activities.length}<small>sessions</small>`;
    page.querySelector('[data-stat="goal"]').innerHTML = `${pct}%<small>complete</small>`;
    page.querySelector('[data-orbit]').innerHTML = `${km.toFixed(1)}<small>KM LOGGED</small>`;
    page.querySelector('[data-goal-bar]').style.width = pct + '%';
    page.querySelector('[data-goal-left]').textContent = `${Math.max(0, (profile.weeklyGoal || 25) - km).toFixed(1)} km to go`;
    page.querySelector('[data-goal-done]').textContent = `${km.toFixed(1)} km completed`;
    page.querySelector('[data-goal-target]').textContent = `${profile.weeklyGoal || 25} km goal`;
    renderActivityRows(activities.slice(0, 4), page.querySelector('[data-recent]'));
  }

  function renderActivities() {
    const page = app.querySelector('[data-page="activities"]');
    if (!page) return;
    const q = (page.querySelector('[data-search]')?.value || '').toLowerCase();
    const filter = page.querySelector('.filters button.active')?.dataset.filter || 'All';
    let list = activities.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (filter !== 'All') list = list.filter((a) => a.type === filter);
    if (q) list = list.filter((a) => (a.title + a.type + a.notes).toLowerCase().includes(q));
    renderActivityRows(list, page.querySelector('[data-list]'));
  }

  function renderRecord() {
    const page = app.querySelector('[data-page="record"]');
    if (!page) return;
    page.querySelector('[data-rec-status]').textContent = '● ' + (recStatus === 'ready' ? 'Ready' : recStatus === 'paused' ? 'Paused' : 'Recording');
    page.querySelector('[data-rec-status]').className = 'status ' + recStatus;
    page.querySelector('[data-rec-km]').innerHTML = `${recKm.toFixed(2)} <i>km</i>`;
    page.querySelector('[data-rec-time]').textContent = duration(recSeconds);
    const pace = recKm ? `${Math.floor(recSeconds / recKm / 60)}:${String(Math.round(recSeconds / recKm) % 60).padStart(2, '0')}` : '—';
    page.querySelector('[data-rec-pace]').textContent = pace;
    page.querySelectorAll('.types button').forEach((b) => {
      b.classList.toggle('chosen', b.dataset.type === recType);
      b.disabled = recStatus !== 'ready';
    });
    const startBtn = page.querySelector('[data-rec-start]');
    const finishBtn = page.querySelector('[data-rec-finish]');
    const resetBtn = page.querySelector('[data-rec-reset]');
    startBtn.innerHTML = recStatus === 'recording' ? '⏸ Pause' : (recStatus === 'paused' ? '▶ Resume' : '▶ Start recording');
    finishBtn.hidden = recStatus === 'ready';
    resetBtn.hidden = recStatus === 'ready';
  }

  function renderChallenges() {
    const page = app.querySelector('[data-page="challenges"]');
    if (!page) return;
    const grid = page.querySelector('[data-challenges]');
    grid.replaceChildren();
    challenges.forEach((c) => {
      const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
      const card = el('div', 'challenge');
      card.innerHTML = `<h3></h3><p></p><div class="between"><span></span><b class="lime-text"></b></div><div class="progress"><span></span></div><div class="between muted"><small></small><small></small></div><button type="button" class="outline full" style="margin-top:10px"></button>`;
      card.querySelector('h3').textContent = c.name;
      card.querySelector('p').textContent = c.desc;
      card.querySelector('.between span').textContent = 'Progress';
      card.querySelector('.lime-text').textContent = pct + '%';
      card.querySelector('.progress > span').style.width = pct + '%';
      card.querySelectorAll('small')[0].textContent = `${c.progress} / ${c.target} ${c.unit}`;
      card.querySelectorAll('small')[1].textContent = 'Ends ' + c.ends;
      const btn = card.querySelector('button');
      btn.textContent = c.joined ? 'Leave challenge' : 'Join challenge';
      btn.addEventListener('click', () => {
        c.joined = !c.joined;
        persist('challenges', challenges);
        renderChallenges();
      });
      grid.appendChild(card);
    });
  }

  function renderLeaderboard() {
    const page = app.querySelector('[data-page="leaderboard"]');
    if (!page) return;
    const board = [
      { name: 'Maya Chen', dist: 42.6 },
      { name: profile.name || 'You', dist: totalKm() },
      { name: 'Jordan Lee', dist: 38.1 },
      { name: 'Sam Rivera', dist: 29.4 },
      { name: 'Riley Park', dist: 21.0 }
    ].sort((a, b) => b.dist - a.dist);
    const list = page.querySelector('[data-leaders]');
    list.replaceChildren();
    board.forEach((r, i) => {
      const row = el('div', 'leader-row');
      row.innerHTML = `<b style="width:28px">#${i + 1}</b><span style="flex:1"></span><strong></strong>`;
      row.querySelector('span').textContent = r.name;
      row.querySelector('strong').textContent = r.dist.toFixed(1) + ' km';
      list.appendChild(row);
    });
  }

  function renderSegments() {
    const page = app.querySelector('[data-page="segments"]');
    if (!page) return;
    const list = page.querySelector('[data-segments]');
    const segs = [
      { name: 'Riverside Climb', dist: '1.2 km', elev: '+64 m', rank: '3rd' },
      { name: 'Park Loop PR', dist: '3.0 km', elev: '+12 m', rank: '1st' },
      { name: 'Bridge Sprint', dist: '0.6 km', elev: '+4 m', rank: '7th' }
    ];
    list.replaceChildren();
    segs.forEach((s) => {
      const row = el('div', 'leader-row');
      row.innerHTML = `<div style="flex:1"><b></b><small class="muted" style="display:block"></small></div><strong class="lime-text"></strong>`;
      row.querySelector('b').textContent = s.name;
      row.querySelector('small').textContent = `${s.dist} · ${s.elev}`;
      row.querySelector('strong').textContent = s.rank;
      list.appendChild(row);
    });
  }

  function renderCommunity() {
    const page = app.querySelector('[data-page="community"]');
    if (!page) return;
    const feed = page.querySelector('[data-feed]');
    feed.replaceChildren();
    posts.forEach((p) => {
      const item = el('div', 'feed-item');
      item.style.flexDirection = 'column';
      item.style.alignItems = 'stretch';
      item.innerHTML = `<div class="between"><div><b></b> <small class="muted"></small></div><span class="pill"></span></div><p style="margin:8px 0;font-size:14px"></p><button type="button" class="quiet"></button>`;
      item.querySelector('b').textContent = p.name;
      item.querySelector('small').textContent = `${p.handle} · ${p.time}`;
      item.querySelector('.pill').textContent = p.tag;
      item.querySelector('p').textContent = p.text;
      const likeBtn = item.querySelector('button');
      likeBtn.textContent = `${p.liked ? '♥' : '♡'} ${p.likes}`;
      likeBtn.addEventListener('click', () => {
        p.liked = !p.liked;
        p.likes += p.liked ? 1 : -1;
        persist('posts', posts);
        renderCommunity();
      });
      feed.appendChild(item);
    });
  }

  function renderProfile() {
    const page = app.querySelector('[data-page="profile"]');
    if (!page) return;
    page.querySelector('[name="name"]').value = profile.name || '';
    page.querySelector('[name="handle"]').value = profile.handle || '';
    page.querySelector('[name="location"]').value = profile.location || '';
    page.querySelector('[name="bio"]').value = profile.bio || '';
    page.querySelector('[name="goal"]').value = profile.goal || '';
    page.querySelector('[name="weeklyGoal"]').value = profile.weeklyGoal || 25;
  }

  function renderPage(id) {
    if (id === 'dashboard') renderDashboard();
    else if (id === 'activities') renderActivities();
    else if (id === 'record') renderRecord();
    else if (id === 'challenges') renderChallenges();
    else if (id === 'leaderboard') renderLeaderboard();
    else if (id === 'segments') renderSegments();
    else if (id === 'community') renderCommunity();
    else if (id === 'profile') renderProfile();
  }

  function openModal(a) {
    const bd = app.querySelector('.pace-modal-backdrop');
    const body = app.querySelector('[data-modal-body]');
    body.innerHTML = `<h3 style="margin:0 0 8px"></h3>
      <p class="muted" style="margin:0 0 12px"></p>
      <div class="modal-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div class="panel"><small class="muted">Distance</small><b></b></div>
        <div class="panel"><small class="muted">Duration</small><b></b></div>
        <div class="panel"><small class="muted">Pace</small><b></b></div>
        <div class="panel"><small class="muted">Elevation</small><b></b></div>
      </div>
      <p style="margin:0 0 8px;font-size:13px"></p>
      <button type="button" class="outline full" data-close-modal>Close</button>`;
    body.querySelector('h3').textContent = a.title;
    body.querySelector('p.muted').textContent = `${a.type} · ${a.date}`;
    const vals = body.querySelectorAll('.panel b');
    vals[0].textContent = Number(a.distance).toFixed(2) + ' km';
    vals[1].textContent = duration(a.duration);
    vals[2].textContent = a.pace || '—';
    vals[3].textContent = (a.elevation || 0) + ' m';
    body.querySelectorAll('p')[1].textContent = a.notes || 'No notes added.';
    bd.classList.add('open');
  }

  function tickRecord() {
    if (recStatus !== 'recording') return;
    recSeconds += 1;
    recKm += 0.0027;
    renderRecord();
  }

  // Events
  app.querySelectorAll('.pace-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  app.addEventListener('click', (e) => {
    const t = e.target.closest('[data-page-jump]');
    if (t) switchPage(t.dataset.pageJump);
    if (e.target.closest('[data-close-modal]')) {
      app.querySelector('.pace-modal-backdrop')?.classList.remove('open');
    }
    if (e.target.closest('.pace-modal-backdrop') === e.target) {
      e.target.classList.remove('open');
    }
  });

  // Record controls
  const recPage = app.querySelector('[data-page="record"]');
  if (recPage) {
    recPage.querySelectorAll('.types button').forEach((b) => {
      b.addEventListener('click', () => {
        if (recStatus !== 'ready') return;
        recType = b.dataset.type;
        renderRecord();
      });
    });
    recPage.querySelector('[data-rec-start]')?.addEventListener('click', () => {
      if (recStatus === 'recording') {
        recStatus = 'paused';
        clearInterval(recTimer);
        recTimer = null;
      } else {
        recStatus = 'recording';
        clearInterval(recTimer);
        recTimer = setInterval(tickRecord, 1000);
      }
      renderRecord();
    });
    recPage.querySelector('[data-rec-finish]')?.addEventListener('click', () => {
      if (recKm < 0.01) {
        recStatus = 'ready'; recSeconds = 0; recKm = 0;
        clearInterval(recTimer); recTimer = null;
        renderRecord();
        return;
      }
      const a = {
        id: Date.now(),
        type: recType,
        title: `${recType} · ${new Date().toLocaleDateString()}`,
        date: new Date().toISOString().slice(0, 10),
        distance: +recKm.toFixed(2),
        duration: recSeconds,
        elevation: Math.round(recKm * 9),
        pace: recType === 'Ride'
          ? `${(recKm / (recSeconds / 3600 || 1)).toFixed(1)} km/h`
          : `${Math.floor(recSeconds / (recKm || 1) / 60)}:${String(Math.round(recSeconds / (recKm || 1)) % 60).padStart(2, '0')}`,
        kudos: 0,
        notes: 'Recorded in frontend demo.'
      };
      activities = [a, ...activities];
      persist('activities', activities);
      recStatus = 'ready'; recSeconds = 0; recKm = 0;
      clearInterval(recTimer); recTimer = null;
      renderRecord();
      switchPage('activities');
    });
    recPage.querySelector('[data-rec-reset]')?.addEventListener('click', () => {
      recStatus = 'ready'; recSeconds = 0; recKm = 0;
      clearInterval(recTimer); recTimer = null;
      renderRecord();
    });
  }

  // Activities filters
  const actPage = app.querySelector('[data-page="activities"]');
  if (actPage) {
    actPage.querySelector('[data-search]')?.addEventListener('input', renderActivities);
    actPage.querySelectorAll('.filters button').forEach((b) => {
      b.addEventListener('click', () => {
        actPage.querySelectorAll('.filters button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        renderActivities();
      });
    });
    actPage.querySelector('[data-export]')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(activities, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'pace-activities.json'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Community post
  const comPage = app.querySelector('[data-page="community"]');
  if (comPage) {
    comPage.querySelector('[data-post]')?.addEventListener('click', () => {
      const ta = comPage.querySelector('[data-composer]');
      const text = (ta?.value || '').trim();
      if (!text) return;
      posts = [{
        id: Date.now(),
        name: profile.name || 'You',
        handle: profile.handle || '@you',
        time: 'Just now',
        text,
        likes: 0,
        liked: false,
        tag: 'Update'
      }, ...posts];
      persist('posts', posts);
      ta.value = '';
      renderCommunity();
    });
  }

  // Profile save + reset
  const profPage = app.querySelector('[data-page="profile"]');
  if (profPage) {
    profPage.querySelector('[data-save-profile]')?.addEventListener('click', () => {
      profile = {
        name: profPage.querySelector('[name="name"]').value.trim() || profile.name,
        handle: profPage.querySelector('[name="handle"]').value.trim() || profile.handle,
        location: profPage.querySelector('[name="location"]').value.trim(),
        bio: profPage.querySelector('[name="bio"]').value.trim(),
        goal: profPage.querySelector('[name="goal"]').value.trim(),
        weeklyGoal: Number(profPage.querySelector('[name="weeklyGoal"]').value) || 25
      };
      persist('profile', profile);
      alert('Profile saved on this device.');
      renderDashboard();
    });
    profPage.querySelector('[data-reset-demo]')?.addEventListener('click', () => {
      if (!confirm('Reset Pace demo data on this device?')) return;
      activities = SEED_ACTIVITIES.map((x) => ({ ...x }));
      challenges = SEED_CHALLENGES.map((x) => ({ ...x }));
      posts = SEED_POSTS.map((x) => ({ ...x }));
      profile = { ...SEED_PROFILE };
      persist('activities', activities);
      persist('challenges', challenges);
      persist('posts', posts);
      persist('profile', profile);
      switchPage('dashboard');
    });
  }

  switchPage('dashboard');
})();
