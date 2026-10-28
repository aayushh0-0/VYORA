/**
 * Notification bell + popup. Prototype seeds (previous + current).
 * Completed / Remind later. Isolated from fancy cursor / spotlight.
 */
(function () {
  const PLAN_KEY = 'vyora_active_plan';
  const COND_KEY = 'vyora_health_conditions';
  const DISMISS_KEY = 'vyora_notif_dismissed';
  const SNOOZE_KEY = 'vyora_notif_snooze';
  const CHECK_MS = 60 * 1000;

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function nowParts() {
    const d = new Date();
    return {
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
      hm: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
      hour: d.getHours(),
      date: d.toISOString().slice(0, 10)
    };
  }

  function readPlan() {
    try {
      const raw = localStorage.getItem(PLAN_KEY);
      if (!raw) return null;
      const w = JSON.parse(raw);
      return w.plan || w;
    } catch {
      return null;
    }
  }

  function readConditions() {
    try {
      const list = JSON.parse(localStorage.getItem(COND_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function dismissedSet() {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]'));
    } catch {
      return new Set();
    }
  }

  function dismiss(id) {
    const s = dismissedSet();
    s.add(id);
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...s]));
    tick();
  }

  function readSnooze() {
    try {
      return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function isSnoozed(id) {
    const until = readSnooze()[id];
    return until && until > Date.now();
  }

  function snoozeItem(id, minutes) {
    const map = readSnooze();
    map[id] = Date.now() + Math.max(1, minutes) * 60000;
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
    tick();
  }

  function withinMinutes(targetHm, windowMin) {
    const parts = String(targetHm).split(':');
    const th = Number(parts[0]);
    const tm = Number(parts[1] || 0);
    if (!Number.isFinite(th)) return false;
    const now = new Date();
    const target = new Date(now);
    target.setHours(th, tm, 0, 0);
    return Math.abs(now - target) / 60000 <= (windowMin || 20);
  }

  function prototypeItems() {
    const { date, hm } = nowParts();
    return [
      {
        id: 'proto-prev-workout-' + date,
        kind: 'workout',
        title: 'Earlier today · Workout window',
        body: 'Morning session was scheduled. Mark Completed if done, or Remind later.',
        priority: 4,
        tag: 'Previous'
      },
      {
        id: 'proto-prev-med-' + date,
        kind: 'medication',
        title: 'Earlier today · Medication check',
        body: 'Morning dose window has passed. Take only as your clinician prescribed.',
        priority: 4,
        tag: 'Previous'
      },
      {
        id: 'proto-now-diet-' + date,
        kind: 'diet',
        title: 'Now · Meal check-in',
        body: 'Time for a planned meal or balanced snack. Estimates only — not medical advice.',
        priority: 1,
        tag: 'Current · ' + hm
      },
      {
        id: 'proto-now-care-' + date,
        kind: 'care',
        title: 'Now · Daily care tip',
        body: 'Hydration and a short walk support consistency. Diabetes/BP: follow your clinician and log in Health Journey.',
        priority: 1,
        tag: 'Current · ' + hm
      }
    ];
  }

  function buildItems(apiMeds) {
    const items = [];
    const { day, hour, date } = nowParts();
    const dismissed = dismissedSet();
    const plan = readPlan();
    const conditions = readConditions();

    prototypeItems().forEach(function (p) {
      if (!dismissed.has(p.id) && !isSnoozed(p.id)) items.push(p);
    });

    if (plan && Array.isArray(plan.days) && plan.days.length) {
      const dayPlan =
        plan.days.find(function (d) {
          return String(d.day || '').indexOf(day) === 0 || d.day === day;
        }) || plan.days[0];
      const meals = dayPlan.meals || [];
      [
        { slot: 'breakfast', at: '08:00', label: 'Breakfast window' },
        { slot: 'lunch', at: '13:00', label: 'Lunch window' },
        { slot: 'snack', at: '16:30', label: 'Snack window' },
        { slot: 'dinner', at: '20:00', label: 'Dinner window' }
      ].forEach(function (hint) {
        if (!withinMinutes(hint.at, 30)) return;
        const id = 'diet-' + hint.slot + '-' + date;
        if (dismissed.has(id) || isSnoozed(id)) return;
        const meal = meals.find(function (m) {
          return String(m.slot || '').toLowerCase() === hint.slot;
        });
        items.push({
          id: id,
          kind: 'diet',
          title: hint.label,
          body: meal
            ? (meal.title || meal.slot) + (meal.approxKcal ? ' · ~' + meal.approxKcal + ' kcal (estimate)' : '')
            : 'Check your active diet plan for today’s meals.',
          priority: 2,
          tag: 'Plan'
        });
      });
    }

    (apiMeds || []).forEach(function (m) {
      if (m.active === false) return;
      const time = String(m.time || m.schedule || '').slice(0, 5);
      if (!time || !withinMinutes(time, 25)) return;
      const id = 'med-' + (m.id || m.label) + '-' + time + '-' + date;
      if (dismissed.has(id) || isSnoozed(id)) return;
      items.push({
        id: id,
        kind: 'medication',
        title: 'Medication reminder',
        body: (m.label || m.name || 'Medication') + ' · ' + time + '. Take only as prescribed.',
        priority: 1,
        tag: 'Medication'
      });
    });

    if (conditions.indexOf('diabetes') !== -1) {
      const id = 'care-diabetes-' + date;
      if (!dismissed.has(id) && !isSnoozed(id)) {
        items.push({
          id: id,
          kind: 'care',
          title: 'Diabetes care tip (general)',
          body: 'Log glucose as advised by your clinician. VYORA never adjusts insulin or tablets.',
          priority: 2,
          tag: 'Care'
        });
      }
    }
    if (conditions.indexOf('bp') !== -1) {
      const id = 'care-bp-' + date;
      if (!dismissed.has(id) && !isSnoozed(id)) {
        items.push({
          id: id,
          kind: 'care',
          title: 'Blood pressure tip (general)',
          body: 'Prefer steady warm-ups. Log BP in Health Journey if you track readings.',
          priority: 2,
          tag: 'Care'
        });
      }
    }

    items.sort(function (a, b) {
      return a.priority - b.priority;
    });
    return items.slice(0, 8);
  }

  function ensureBar() {
    let bar = document.getElementById('vyoraNotifBar');
    if (bar) return bar;
    bar = el('div', 'vyora-notif-bar');
    bar.id = 'vyoraNotifBar';
    bar.hidden = true;
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Reminders');
    document.body.appendChild(bar);
    return bar;
  }

  function updateBell(count) {
    const badge = document.getElementById('vyoraNotifCount');
    const bell = document.getElementById('vyoraNotifBell');
    if (!badge) return;
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = count > 9 ? '9+' : String(count);
      if (bell) bell.classList.add('has-notifs');
    } else {
      badge.hidden = true;
      badge.textContent = '0';
      if (bell) bell.classList.remove('has-notifs');
    }
  }

  function openBar() {
    const bar = ensureBar();
    const bell = document.getElementById('vyoraNotifBell');
    bar.dataset.open = '1';
    bar.hidden = false;
    if (bell) bell.setAttribute('aria-expanded', 'true');
  }

  function closeBar() {
    const bar = document.getElementById('vyoraNotifBar');
    const bell = document.getElementById('vyoraNotifBell');
    if (bar) {
      delete bar.dataset.open;
      bar.hidden = true;
    }
    if (bell) bell.setAttribute('aria-expanded', 'false');
  }

  function render(apiMeds) {
    const bar = ensureBar();
    const items = buildItems(apiMeds);
    updateBell(items.length);
    bar.replaceChildren();

    const head = el('div', 'vyora-notif-head');
    head.appendChild(el('strong', '', 'Reminders'));
    head.appendChild(el('span', 'vyora-notif-sub', 'Prototype'));
    bar.appendChild(head);

    if (!items.length) {
      bar.appendChild(el('p', 'vyora-notif-empty', 'No active reminders right now.'));
    } else {
      items.forEach(function (item) {
        const row = el('div', 'vyora-notif-item kind-' + item.kind);
        const text = el('div', 'vyora-notif-text');
        if (item.tag) text.appendChild(el('span', 'vyora-notif-tag', item.tag));
        text.appendChild(el('b', '', item.title));
        text.appendChild(el('p', '', item.body));
        row.appendChild(text);

        const actions = el('div', 'vyora-notif-actions');
        const doneBtn = el('button', 'is-done', 'Completed');
        doneBtn.type = 'button';
        doneBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          dismiss(item.id);
        });
        const laterBtn = el('button', 'is-later', 'Remind later');
        laterBtn.type = 'button';
        laterBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          let panel = row.querySelector('.vyora-notif-snooze');
          if (panel) {
            panel.remove();
            return;
          }
          panel = el('div', 'vyora-notif-snooze');
          [
            [15, '15 min'],
            [30, '30 min'],
            [60, '1 hour'],
            [120, '2 hours']
          ].forEach(function (pair) {
            const b = el('button', '', pair[1]);
            b.type = 'button';
            b.addEventListener('click', function (ev) {
              ev.preventDefault();
              ev.stopPropagation();
              snoozeItem(item.id, pair[0]);
            });
            panel.appendChild(b);
          });
          const custom = el('button', '', 'Custom…');
          custom.type = 'button';
          custom.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            const raw = window.prompt('Remind again in how many minutes? (1–720)', '45');
            if (raw == null) return;
            const n = parseInt(raw, 10);
            if (!Number.isFinite(n) || n < 1 || n > 720) {
              window.alert('Enter a number between 1 and 720.');
              return;
            }
            snoozeItem(item.id, n);
          });
          panel.appendChild(custom);
          actions.appendChild(panel);
        });
        actions.append(doneBtn, laterBtn);
        row.appendChild(actions);
        bar.appendChild(row);
      });
    }

    if (bar.dataset.open === '1') bar.hidden = false;
  }

  async function tick() {
    let meds = [];
    try {
      if (window.VyoraAPI && VyoraAPI.listMeds) meds = await VyoraAPI.listMeds();
    } catch (_) {}
    render(meds);
  }

  function wireBell() {
    const bell = document.getElementById('vyoraNotifBell');
    if (!bell) return;
    if (bell.dataset.wired === '1') return;
    bell.dataset.wired = '1';
    ensureBar();

    // Capture phase so nothing else swallows the click
    bell.addEventListener(
      'click',
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        const bar = ensureBar();
        if (bar.dataset.open === '1') {
          closeBar();
        } else {
          openBar();
          tick();
        }
      },
      true
    );

    document.addEventListener(
      'click',
      function (e) {
        const bar = document.getElementById('vyoraNotifBar');
        if (!bar || bar.dataset.open !== '1') return;
        if (bar.contains(e.target) || bell.contains(e.target)) return;
        closeBar();
      },
      true
    );

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeBar();
    });
  }

  window.VyoraNotifications = {
    refresh: tick,
    open: function () {
      openBar();
      tick();
    },
    close: closeBar
  };

  function boot() {
    wireBell();
    tick();
    setInterval(tick, CHECK_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
