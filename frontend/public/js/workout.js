/**
 * Workout tab — polished weekly plan UI matching VYORA design reference.
 * Reads active plan from localStorage (set after Generate my plan).
 */
(function () {
  const ACTIVE_PLAN_KEY = 'vyora_active_plan';
  const CHECK_KEY = 'vyora_workout_checks';

  const dayTabs = document.getElementById('dayTabs');
  const exList = document.getElementById('exList');
  const statusEl = document.getElementById('workoutPlanStatus');
  const progressionEl = document.getElementById('workoutProgression');
  const chipsEl = document.getElementById('workoutChips');
  const whyEl = document.getElementById('workoutAiWhy');
  const progressCount = document.getElementById('workoutProgressCount');
  const progressDots = document.getElementById('workoutProgressDots');
  const actionStatus = document.getElementById('workoutActionStatus');

  if (!dayTabs || !exList) return;

  const DAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let selectedDay = 'Mon';
  let currentPlan = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function readActivePlan() {
    try {
      const raw = localStorage.getItem(ACTIVE_PLAN_KEY);
      if (!raw) return null;
      const wrapper = JSON.parse(raw);
      return wrapper.plan || wrapper;
    } catch {
      return null;
    }
  }

  function readChecks() {
    try {
      return JSON.parse(localStorage.getItem(CHECK_KEY) || '{}') || {};
    } catch {
      return {};
    }
  }

  function writeChecks(map) {
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
  }

  function goalLabel(g) {
    const map = {
      musclegain: 'Muscle Gain',
      fatloss: 'Fat Loss',
      recomp: 'Recomposition',
      endurance: 'Endurance',
      general: 'General Wellness'
    };
    return map[g] || (g ? String(g) : '—');
  }

  function equipLabel(e) {
    const s = String(e || '').toLowerCase();
    if (s.includes('full') || s.includes('gym')) return 'Gym';
    if (s.includes('dumbbell')) return 'Dumbbells';
    if (s.includes('none') || s.includes('body')) return 'Bodyweight';
    return 'Home / Minimal';
  }

  function isTrainingDay(session) {
    if (!session) return false;
    if (!Array.isArray(session.exercises) || !session.exercises.length) return false;
    return !/rest|recovery/i.test(String(session.focus || ''));
  }

  function placeholder() {
    dayTabs.replaceChildren();
    if (chipsEl) chipsEl.replaceChildren();
    if (statusEl) {
      statusEl.textContent = 'No active plan yet. Open Home → Build my plan → Generate my plan.';
    }
    if (progressionEl) progressionEl.textContent = '';
    if (whyEl) {
      whyEl.textContent = 'Generate a plan on Home to see coaching notes for your goal and schedule.';
    }
    exList.replaceChildren();
    const empty = el('div', 'wp-empty');
    empty.append(
      el('h3', '', 'No workout plan loaded'),
      el('p', '', 'Complete Build my plan on the Home tab, then return here to train day by day.')
    );
    exList.appendChild(empty);
    renderProgress(null);
  }

  function renderChips(plan) {
    if (!chipsEl) return;
    chipsEl.replaceChildren();
    const snap = plan.profileSnapshot || {};
    const trainingDays = (plan.days || []).filter(isTrainingDay).length;
    const items = [
      { icon: '◎', label: 'Goal', value: goalLabel(snap.goal || plan.goal) },
      { icon: '▦', label: 'Training Days', value: `${plan.daysPerWeek || trainingDays || '—'} Days / Week` },
      { icon: '⚒', label: 'Training Mode', value: equipLabel(plan.equipmentLevel || snap.equipment) },
      { icon: '▤', label: 'Experience Level', value: (plan.experience || snap.experience || '—') }
    ];
    items.forEach((item) => {
      const chip = el('div', 'wp-chip');
      const ic = el('span', 'wp-chip-icon', item.icon);
      const body = el('div', '');
      body.append(el('small', '', item.label), el('strong', '', String(item.value)));
      chip.append(ic, body);
      chipsEl.appendChild(chip);
    });
  }

  function renderProgress(plan) {
    if (!progressCount || !progressDots) return;
    progressDots.replaceChildren();
    if (!plan || !Array.isArray(plan.days)) {
      progressCount.textContent = '0/0';
      return;
    }
    const checks = readChecks();
    const trainDays = plan.days.filter(isTrainingDay);
    let completed = 0;
    trainDays.forEach((d) => {
      const key = d.day;
      const total = (d.exercises || []).length;
      const done = (checks[key] || []).filter(Boolean).length;
      if (total && done >= total) completed += 1;
    });
    progressCount.textContent = `${completed}/${trainDays.length || 0}`;

    DAY_ORDER.forEach((day) => {
      const session = (plan.days || []).find((d) => d.day === day);
      const dot = el('span', 'wp-dot');
      dot.title = day;
      if (!isTrainingDay(session)) {
        dot.classList.add('rest');
      } else {
        const total = (session.exercises || []).length;
        const done = (checks[day] || []).filter(Boolean).length;
        if (total && done >= total) dot.classList.add('done');
        else if (done > 0) dot.classList.add('partial');
      }
      progressDots.appendChild(dot);
    });
  }

  function muscleTags(exercise) {
    const tags = [];
    if (exercise.muscleGroup) tags.push(exercise.muscleGroup);
    if (exercise.pattern && exercise.pattern !== exercise.muscleGroup) {
      tags.push(String(exercise.pattern).replace(/_/g, ' '));
    }
    return tags.slice(0, 3);
  }

  function renderDay(day, plan) {
    selectedDay = day;
    const session = (plan.days || []).find((d) => d.day === day);
    exList.replaceChildren();

    if (!session) {
      exList.appendChild(el('p', 'bottom-note', 'No session for this day.'));
      return;
    }

    const head = el('div', 'wp-session-head');
    const left = el('div', '');
    left.append(
      el('h2', 'wp-session-title', `${session.day} · ${session.focus || 'Training'}`),
      el(
        'p',
        'wp-session-desc',
        isTrainingDay(session)
          ? `Build capacity with focused work for ${session.focus || 'this session'}.`
          : 'Recovery day — light movement optional.'
      )
    );
    const right = el('div', 'wp-session-meta');
    right.textContent = [
      session.durationMin ? `${session.durationMin} min` : null,
      session.environment || null
    ]
      .filter(Boolean)
      .join(' · ');
    head.append(left, right);
    exList.appendChild(head);

    if (session.warmUp) {
      const warm = el('div', 'wp-banner warm');
      warm.append(el('strong', '', 'Warm-up'), el('span', '', session.warmUp));
      exList.appendChild(warm);
    }

    const checks = readChecks();
    const dayChecks = Array.isArray(checks[day]) ? checks[day] : [];

    if (!isTrainingDay(session)) {
      exList.appendChild(el('p', 'wp-rest-note', 'Rest or active recovery. Keep walks easy and sleep a priority.'));
    } else {
      (session.exercises || []).forEach((exercise, index) => {
        const row = el('div', 'wp-ex-row');
        if (dayChecks[index]) row.classList.add('done');

        const thumb = el('div', 'wp-ex-thumb', '🏋');
        const info = el('div', 'wp-ex-info');
        info.appendChild(el('div', 'wp-ex-name', exercise.name || 'Exercise'));
        const tags = el('div', 'wp-ex-tags');
        muscleTags(exercise).forEach((t) => tags.appendChild(el('span', 'wp-tag', t)));
        info.appendChild(tags);

        const rx = el('div', 'wp-ex-rx');
        const line1 = exercise.prescription
          || (exercise.sets != null ? `${exercise.sets} sets × ${exercise.reps || '—'}` : (exercise.reps || '—'));
        rx.appendChild(el('div', '', line1));
        const line2 = [exercise.rest ? `Rest ${exercise.rest}` : null, exercise.intensityRpe]
          .filter(Boolean)
          .join(' · ');
        if (line2) rx.appendChild(el('div', 'wp-ex-rx-sub', line2));

        const actions = el('div', 'wp-ex-actions');
        if (exercise.tutorialUrl) {
          const a = document.createElement('a');
          a.className = 'wp-tutorial';
          a.href = exercise.tutorialUrl;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = 'Watch tutorial ↗';
          actions.appendChild(a);
        } else {
          const a = document.createElement('a');
          a.className = 'wp-tutorial muted';
          a.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(exercise.videoQuery || exercise.name || 'exercise form')}`;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = 'Watch demo ↗';
          a.title = 'Tutorial URL not configured yet — opens a search for form cues.';
          actions.appendChild(a);
        }

        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'wp-check';
        check.checked = Boolean(dayChecks[index]);
        check.setAttribute('aria-label', `Mark ${exercise.name || 'exercise'} complete`);
        check.addEventListener('change', () => {
          const map = readChecks();
          const arr = Array.isArray(map[day]) ? map[day].slice() : [];
          while (arr.length < (session.exercises || []).length) arr.push(false);
          arr[index] = check.checked;
          map[day] = arr;
          writeChecks(map);
          row.classList.toggle('done', check.checked);
          renderProgress(plan);
        });

        row.append(thumb, info, rx, actions, check);
        exList.appendChild(row);
      });
    }

    if (session.coolDown) {
      const cool = el('div', 'wp-banner cool');
      cool.append(
        el('strong', '', 'Cool-down · 5 min'),
        el('span', '', typeof session.coolDown === 'string' ? session.coolDown : 'Gentle stretch + breathing')
      );
      exList.appendChild(cool);
    }
  }

  function renderTabs(plan) {
    dayTabs.replaceChildren();
    const byDay = {};
    (plan.days || []).forEach((d) => {
      byDay[d.day] = d;
    });
    const days = DAY_ORDER.filter((d) => byDay[d]) ;
    if (!days.length) {
      DAY_ORDER.forEach((d) => days.push(d));
    }
    if (!days.includes(selectedDay)) selectedDay = days[0];

    days.forEach((day) => {
      const btn = el('button', 'wp-daytab' + (day === selectedDay ? ' active' : ''), day.toUpperCase());
      btn.type = 'button';
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(day === selectedDay));
      if (!isTrainingDay(byDay[day])) btn.classList.add('rest-day');
      btn.addEventListener('click', () => {
        selectedDay = day;
        dayTabs.querySelectorAll('button').forEach((node) => {
          node.classList.toggle('active', node === btn);
          node.setAttribute('aria-selected', String(node === btn));
        });
        renderDay(day, plan);
      });
      dayTabs.appendChild(btn);
    });
  }

  function renderCoach(plan) {
    if (!whyEl) return;
    const snap = plan.profileSnapshot || {};
    const goal = goalLabel(snap.goal || plan.goal);
    const days = plan.daysPerWeek || (plan.days || []).filter(isTrainingDay).length;
    const focus = (plan.days || []).find(isTrainingDay)?.focus || 'strength';
    whyEl.textContent =
      plan.explanation ||
      `This plan targets ${goal.toLowerCase()} across ${days} training day(s). ` +
        `Sessions emphasize ${String(focus).toLowerCase()} with recovery built in. ` +
        (plan.weeklyProgressionNote || 'Progress when sets feel manageable.');
  }

  function renderPlan(plan) {
    currentPlan = plan;
    if (!plan || !Array.isArray(plan.days) || !plan.days.length) {
      placeholder();
      return;
    }
    if (statusEl) statusEl.textContent = '';
    if (progressionEl) progressionEl.textContent = plan.weeklyProgressionNote || '';
    renderChips(plan);
    renderCoach(plan);
    renderTabs(plan);
    renderDay(selectedDay, plan);
    renderProgress(plan);
  }

  function refresh() {
    renderPlan(readActivePlan());
  }

  // Quick actions — soft client-side guidance + optional API patch
  document.getElementById('wpActions')?.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-wp-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-wp-action');
    const messages = {
      swap: 'Tip: use Home → plan adaptations or ask the copilot to swap a movement for an alternative.',
      easier: 'Tip: drop to the substitution listed on each exercise, or reduce a set while form stays crisp.',
      harder: 'Tip: add 1–2 reps or a small load increase when all sets finish under RPE 7.'
    };
    if (actionStatus) actionStatus.textContent = messages[action] || '';

    // If we have a persisted plan id + API, try a real partial edit for easier/harder
    try {
      const raw = localStorage.getItem(ACTIVE_PLAN_KEY);
      const wrapper = raw ? JSON.parse(raw) : null;
      const planId = wrapper?.id;
      if (planId && window.VyoraAPI?.patchPlan && (action === 'easier' || action === 'harder')) {
        const instruction =
          action === 'easier'
            ? `Make ${selectedDay} workout easier with lower impact options`
            : `Increase intensity slightly on ${selectedDay}`;
        if (actionStatus) actionStatus.textContent = 'Updating plan…';
        const updated = await window.VyoraAPI.patchPlan(planId, { instruction, day: selectedDay });
        localStorage.setItem(
          ACTIVE_PLAN_KEY,
          JSON.stringify({ ...wrapper, ...updated, plan: updated.plan || updated, savedAt: new Date().toISOString() })
        );
        renderPlan(updated.plan || updated);
        if (actionStatus) actionStatus.textContent = updated.whatChanged || 'Plan updated.';
        window.dispatchEvent(new CustomEvent('vyora:plan-updated'));
      }
    } catch (err) {
      if (actionStatus) actionStatus.textContent = messages[action] || err.message;
    }
  });

  refresh();
  window.addEventListener('vyora:plan-updated', refresh);
  window.addEventListener('storage', (event) => {
    if (event.key === ACTIVE_PLAN_KEY) refresh();
  });
})();
