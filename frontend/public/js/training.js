/**
 * Special Training — tabs + athlete hub (vanilla port of Pace demo modules).
 * Safe DOM only. Does not touch diet/workout plan engines.
 */
(function () {
  const store = window.VyoraTrainingStore;
  if (!store) {
    console.warn('VyoraTrainingStore missing');
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function showTab(name) {
    document.querySelectorAll('[data-training-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-training-tab') === name);
    });
    document.querySelectorAll('[data-training-panel]').forEach((panel) => {
      panel.classList.toggle('active', panel.getAttribute('data-training-panel') === name);
    });
  }

  document.querySelectorAll('[data-training-tab]').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.getAttribute('data-training-tab')));
  });

  const resultBox = document.getElementById('trainingResult');

  function showResult(title, lines) {
    if (!resultBox) return;
    resultBox.hidden = false;
    resultBox.replaceChildren();
    resultBox.appendChild(el('h3', '', title));
    (lines || []).forEach((line) => resultBox.appendChild(el('p', 'bottom-note', line)));
  }

  async function fetchJson(path) {
    const token = localStorage.getItem('vyoraSessionToken');
    const res = await fetch(path, {
      headers: token ? { authorization: 'Bearer ' + token } : {}
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText);
    return data;
  }

  async function runAction(action) {
    try {
      if (action === 'predict') {
        const data = await fetchJson('/api/training/predictions');
        if (data && data.sufficientData === false) {
          showResult('Not enough history', [data.disclaimer || 'Log more workouts first.']);
          return;
        }
        const p = data && data.predictions ? data.predictions : {};
        showResult('Performance predictions (advisory)', [
          p.fiveKm ? '5K: ' + p.fiveKm.estimate + ' (' + p.fiveKm.range + ')' : '5K: —',
          p.tenKm ? '10K: ' + p.tenKm.estimate : '10K: —',
          p.halfMarathon ? 'Half: ' + p.halfMarathon.estimate : 'Half: —',
          data.confidenceLabel || '',
          data.disclaimer || 'Estimates only — not medical advice.'
        ].filter(Boolean));
        return;
      }
      if (action === 'compare') {
        let data = null;
        try { data = await fetchJson('/api/training/compare'); } catch (_) {}
        showResult('Progress comparison', [
          (data && data.summary) || 'Comparison uses your logged sessions when available.',
          (data && data.disclaimer) || 'Prototype summary only.'
        ]);
        return;
      }
      if (action === 'intelligence') {
        showResult('Athlete intelligence', [
          'Prioritize consistency over peak intensity this week.',
          'Keep at least one easy recovery session after hard efforts.',
          'General wellness guidance — not a diagnosis or prescription.'
        ]);
        return;
      }
      if (action === 'routes' || action === 'destination') {
        showResult('Maps prototype', [
          'Live routing needs a configured maps provider.',
          'VYORA does not invent GPS tracks or street data.'
        ]);
        return;
      }
      showResult('Action', ['"' + action + '" is a prototype control.']);
    } catch (err) {
      showResult('Could not complete action', [err.message || 'Try again after signing in. Athlete demo modules above still work offline.']);
    }
  }

  document.querySelectorAll('.training-action').forEach((btn) => {
    btn.addEventListener('click', () => runAction(btn.getAttribute('data-action')));
  });

  let recordTimer = null;
  let recordSeconds = 0;
  let recordRunning = false;
  let recordType = 'Run';
  let activitiesFilter = 'All';
  let leaderTab = 'Distance';

  function weekDistanceKm(activities) {
    return activities.reduce((sum, a) => sum + (Number(a.distance) || 0), 0);
  }

  function renderTrainHub() {
    const root = document.getElementById('stTrainHub');
    if (!root || !store) return;
    root.replaceChildren();

    const profile = store.getProfile();
    const activities = store.getActivities();
    const weekKm = weekDistanceKm(activities);
    const goal = Number(profile.weeklyGoal) || 25;

    root.appendChild(el('p', 'bottom-note st-disclaimer', 'Athlete modules use on-device demo data (vyora_pace_*). Recording is simulated — not live GPS.'));

    const dash = el('div', 'st-panel');
    dash.appendChild(el('h3', 'st-heading', 'Athlete dashboard'));
    const stats = el('div', 'st-stats');
    [
      ['This week', weekKm.toFixed(1) + ' km'],
      ['Weekly goal', goal + ' km'],
      ['Activities', String(activities.length)],
      ['Focus', profile.goal || 'Endurance']
    ].forEach(function (pair) {
      const card = el('div', 'st-stat');
      card.appendChild(el('small', '', pair[0]));
      card.appendChild(el('strong', '', pair[1]));
      stats.appendChild(card);
    });
    dash.appendChild(stats);

    const goalBar = el('div', 'st-progress');
    const fill = el('i', '');
    fill.style.width = Math.min(100, (weekKm / goal) * 100) + '%';
    goalBar.appendChild(fill);
    dash.appendChild(el('p', 'bottom-note', 'Weekly distance progress toward ' + goal + ' km'));
    dash.appendChild(goalBar);

    dash.appendChild(el('h4', 'st-subhead', 'Recent activities'));
    const list = el('div', 'st-list');
    activities.slice(0, 4).forEach(function (act) {
      const row = el('div', 'st-list-row');
      const left = el('div', '');
      left.appendChild(el('b', '', act.title || act.type));
      left.appendChild(el('div', 'st-muted', act.type + ' · ' + act.date + ' · ' + act.distance + ' km · ' + store.formatDuration(act.duration)));
      row.appendChild(left);
      list.appendChild(row);
    });
    if (!activities.length) list.appendChild(el('p', 'bottom-note', 'No activities yet — record a simulated session below.'));
    dash.appendChild(list);
    root.appendChild(dash);

    const rec = el('div', 'st-panel');
    rec.appendChild(el('h3', 'st-heading', 'Record (simulated)'));
    rec.appendChild(el('p', 'bottom-note', 'Timer-only demo. Does not collect location or connect to sensors.'));
    const types = el('div', 'st-pills');
    ['Run', 'Ride', 'Walk', 'Hike'].forEach(function (type) {
      const pill = el('button', type === recordType ? 'st-pill selected' : 'st-pill', type);
      pill.type = 'button';
      pill.addEventListener('click', function () {
        recordType = type;
        renderTrainHub();
      });
      types.appendChild(pill);
    });
    rec.appendChild(types);

    const timer = el('div', 'st-timer', store.formatDuration(recordSeconds));
    timer.id = 'stRecordTimer';
    rec.appendChild(timer);

    const controls = el('div', 'st-actions');
    const startBtn = el('button', 'btn', recordRunning ? 'Pause' : 'Start');
    startBtn.type = 'button';
    startBtn.addEventListener('click', function () {
      if (recordRunning) {
        clearInterval(recordTimer);
        recordTimer = null;
        recordRunning = false;
        startBtn.textContent = 'Start';
        return;
      }
      recordRunning = true;
      startBtn.textContent = 'Pause';
      recordTimer = setInterval(function () {
        recordSeconds += 1;
        const t = document.getElementById('stRecordTimer');
        if (t) t.textContent = store.formatDuration(recordSeconds);
      }, 1000);
    });
    const finishBtn = el('button', 'btn ghost', 'Finish & save');
    finishBtn.type = 'button';
    finishBtn.addEventListener('click', function () {
      if (recordSeconds < 5) {
        alert('Record at least a few seconds before saving this demo session.');
        return;
      }
      clearInterval(recordTimer);
      recordTimer = null;
      recordRunning = false;
      const hours = recordSeconds / 3600;
      const km = recordType === 'Ride' ? Number((hours * 18).toFixed(2)) : Number((hours * 9).toFixed(2));
      store.addActivity({
        type: recordType,
        title: 'Simulated ' + recordType.toLowerCase(),
        date: new Date().toISOString().slice(0, 10),
        distance: km,
        duration: recordSeconds,
        elevation: Math.round(km * 8),
        pace: recordType === 'Ride' ? ((km / hours) || 0).toFixed(1) + ' km/h' : '—'
      });
      recordSeconds = 0;
      renderTrainHub();
      renderCompeteHub();
    });
    const resetBtn = el('button', 'btn ghost', 'Reset timer');
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', function () {
      clearInterval(recordTimer);
      recordTimer = null;
      recordRunning = false;
      recordSeconds = 0;
      renderTrainHub();
    });
    controls.append(startBtn, finishBtn, resetBtn);
    rec.appendChild(controls);
    root.appendChild(rec);

    const actPanel = el('div', 'st-panel');
    actPanel.appendChild(el('h3', 'st-heading', 'Activity history'));
    const filters = el('div', 'st-pills');
    ['All', 'Run', 'Ride', 'Walk', 'Hike'].forEach(function (f) {
      const pill = el('button', f === activitiesFilter ? 'st-pill selected' : 'st-pill', f);
      pill.type = 'button';
      pill.addEventListener('click', function () {
        activitiesFilter = f;
        renderTrainHub();
      });
      filters.appendChild(pill);
    });
    actPanel.appendChild(filters);

    const filtered = activitiesFilter === 'All' ? activities : activities.filter(function (a) { return a.type === activitiesFilter; });
    const actList = el('div', 'st-list');
    filtered.forEach(function (act) {
      const row = el('div', 'st-list-row');
      const left = el('div', '');
      left.appendChild(el('b', '', act.title || act.type));
      left.appendChild(el('div', 'st-muted', act.type + ' · ' + act.date + ' · ' + act.distance + ' km · ' + store.formatDuration(act.duration) + ' · ' + (act.pace || '')));
      if (act.notes) left.appendChild(el('div', 'st-muted', act.notes));
      row.appendChild(left);
      actList.appendChild(row);
    });
    if (!filtered.length) actList.appendChild(el('p', 'bottom-note', 'No matching activities.'));
    actPanel.appendChild(actList);

    const exportBtn = el('button', 'btn ghost', 'Export JSON');
    exportBtn.type = 'button';
    exportBtn.addEventListener('click', function () {
      const blob = new Blob([JSON.stringify(store.getActivities(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vyora-training-activities.json';
      a.click();
      URL.revokeObjectURL(url);
    });
    const resetDemoBtn = el('button', 'btn ghost', 'Reset demo athlete data');
    resetDemoBtn.type = 'button';
    resetDemoBtn.addEventListener('click', function () {
      if (!confirm('Reset Special Training demo activities, challenges, and profile on this device?')) return;
      store.resetDemo();
      renderAllHubs();
    });
    const actActions = el('div', 'st-actions');
    actActions.append(exportBtn, resetDemoBtn);
    actPanel.appendChild(actActions);
    root.appendChild(actPanel);
  }

  function renderExploreHub() {
    const root = document.getElementById('stExploreHub');
    if (!root || !store) return;
    root.replaceChildren();
    root.appendChild(el('p', 'bottom-note st-disclaimer', 'Segments are demo content for UI integration — not live map-matched efforts.'));

    const panel = el('div', 'st-panel');
    panel.appendChild(el('h3', 'st-heading', 'Featured segment'));
    panel.appendChild(el('b', '', 'Riverfront Sprint'));
    panel.appendChild(el('p', 'bottom-note', '0.92 km · avg grade 0.4% · flat stretch for speed work (demo).'));
    const stats = el('div', 'st-stats');
    [['Distance', '0.92 km'], ['Avg grade', '0.4%'], ['Your PR (demo)', '03:56']].forEach(function (pair) {
      const c = el('div', 'st-stat');
      c.appendChild(el('small', '', pair[0]));
      c.appendChild(el('strong', '', pair[1]));
      stats.appendChild(c);
    });
    panel.appendChild(stats);

    panel.appendChild(el('h4', 'st-subhead', 'Local efforts (demo)'));
    const list = el('div', 'st-list');
    store.segmentEfforts.forEach(function (row, index) {
      const item = el('div', 'st-list-row');
      const left = el('div', '');
      left.appendChild(el('b', '', (index + 1) + '. ' + row[0]));
      left.appendChild(el('div', 'st-muted', row[2]));
      item.appendChild(left);
      item.appendChild(el('strong', '', row[1]));
      list.appendChild(item);
    });
    panel.appendChild(list);
    root.appendChild(panel);
  }

  function renderCompeteHub() {
    const root = document.getElementById('stCompeteHub');
    if (!root || !store) return;
    root.replaceChildren();
    root.appendChild(el('p', 'bottom-note st-disclaimer', 'Leaderboards and challenge progress below are on-device demo data.'));

    const board = el('div', 'st-panel');
    board.appendChild(el('h3', 'st-heading', 'Community standings (demo)'));
    const pills = el('div', 'st-pills');
    ['Distance', 'Activities'].forEach(function (tab) {
      const pill = el('button', tab === leaderTab ? 'st-pill selected' : 'st-pill', tab);
      pill.type = 'button';
      pill.addEventListener('click', function () {
        leaderTab = tab;
        renderCompeteHub();
      });
      pills.appendChild(pill);
    });
    board.appendChild(pills);
    const list = el('div', 'st-list');
    const rows = store.leaderboard.slice().sort(function (a, b) {
      return leaderTab === 'Distance' ? b[2] - a[2] : b[3] - a[3];
    });
    rows.forEach(function (row, index) {
      const item = el('div', 'st-list-row');
      const left = el('div', '');
      left.appendChild(el('b', '', (index + 1) + '. ' + row[0]));
      left.appendChild(el('div', 'st-muted', 'Community athlete (demo)'));
      item.appendChild(left);
      item.appendChild(el('strong', '', leaderTab === 'Distance' ? row[2] + ' km' : row[3] + ' sessions'));
      list.appendChild(item);
    });
    board.appendChild(list);
    root.appendChild(board);

    const chal = el('div', 'st-panel');
    chal.appendChild(el('h3', 'st-heading', 'Demo challenges'));
    store.getChallenges().forEach(function (c) {
      const card = el('div', 'st-challenge');
      card.appendChild(el('b', '', c.name));
      card.appendChild(el('div', 'st-muted', c.desc + ' · ends ' + c.ends));
      const bar = el('div', 'st-progress');
      const fill = el('i', '');
      fill.style.width = Math.min(100, (c.progress / c.target) * 100) + '%';
      bar.appendChild(fill);
      card.appendChild(bar);
      card.appendChild(el('div', 'st-muted', c.progress + ' / ' + c.target + ' ' + c.unit));
      const join = el('button', 'btn ghost', c.joined ? 'Leave challenge' : 'Join challenge');
      join.type = 'button';
      join.addEventListener('click', function () {
        const listCh = store.getChallenges().map(function (item) {
          return item.id === c.id ? Object.assign({}, item, { joined: !item.joined }) : item;
        });
        store.saveChallenges(listCh);
        renderCompeteHub();
      });
      card.appendChild(join);
      chal.appendChild(card);
    });
    root.appendChild(chal);
  }

  function renderAllHubs() {
    renderTrainHub();
    renderExploreHub();
    renderCompeteHub();
  }

  const title = document.getElementById('challengeTitle');
  if (title && window.VyoraAPI) {
    const status = document.getElementById('challengeStatus');
    const list = document.getElementById('challengeList');
    const today = new Date().toISOString().slice(0, 10);
    const startInput = document.getElementById('challengeStart');
    const endInput = document.getElementById('challengeEnd');
    if (startInput) startInput.value = today;
    if (endInput) endInput.value = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10);

    async function loadChallenges() {
      if (!list) return;
      list.replaceChildren();
      try {
        const items = await VyoraAPI.listChallenges();
        if (!items.length) {
          list.textContent = 'No account challenges yet.';
          return;
        }
        items.forEach(function (c) {
          const row = document.createElement('div');
          row.className = 'camp-item';
          const info = document.createElement('div');
          const b = document.createElement('b');
          const p = document.createElement('span');
          b.textContent = c.title;
          p.textContent = c.goal + ' · ' + c.progress + '/' + c.target + ' ' + c.unit + ' · ' + c.startDate + ' to ' + c.endDate;
          info.append(b, document.createElement('br'), p);
          row.append(info);
          const add = document.createElement('button');
          add.className = 'btn ghost';
          add.type = 'button';
          add.textContent = '+ Progress';
          add.addEventListener('click', async function () {
            const raw = prompt('New total progress in ' + c.unit, String(c.progress));
            if (raw === null) return;
            try {
              await VyoraAPI.updateChallenge(c.id, Number(raw));
              await loadChallenges();
            } catch (e) {
              if (status) status.textContent = e.message;
            }
          });
          row.append(add);
          list.append(row);
        });
      } catch (e) {
        if (status) status.textContent = e.message;
      }
    }

    const createBtn = document.getElementById('challengeCreate');
    if (createBtn) {
      createBtn.addEventListener('click', async function () {
        const data = {
          title: title.value.trim(),
          goal: document.getElementById('challengeGoal').value.trim(),
          target: Number(document.getElementById('challengeTarget').value),
          unit: document.getElementById('challengeUnit').value,
          startDate: document.getElementById('challengeStart').value,
          endDate: document.getElementById('challengeEnd').value
        };
        try {
          await VyoraAPI.createChallenge(data);
          title.value = '';
          document.getElementById('challengeGoal').value = '';
          document.getElementById('challengeTarget').value = '';
          if (status) status.textContent = 'Challenge created.';
          await loadChallenges();
        } catch (e) {
          if (status) status.textContent = e.message;
        }
      });
    }
    loadChallenges();
  }

  renderAllHubs();
  window.VyoraTraining = { showTab: showTab, runAction: runAction, renderAllHubs: renderAllHubs };
})();
