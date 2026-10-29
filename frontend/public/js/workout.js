// Workout tab — renders the active plan and keeps exercise progress on this device.
(function () {
  const ACTIVE_PLAN_KEY = 'vyora_active_plan';
  const COMPLETION_KEY = 'vyora_workout_completion_v1';
  const LOGGED_KEY = 'vyora_workout_logged_v1';
  const dayTabs = document.getElementById('dayTabs');
  const exList = document.getElementById('exList');
  const statusEl = document.getElementById('workoutPlanStatus');
  const progressionEl = document.getElementById('workoutProgression');
  if (!dayTabs || !exList) return;

  const sessionTitleEl = document.getElementById('workoutSessionTitle');
  const sessionMetaEl = document.getElementById('workoutSessionMeta');
  const sessionProgressEl = document.getElementById('workoutSessionProgress');
  const weekCountEl = document.getElementById('workoutWeekCount');
  const weekProgressEl = document.getElementById('workoutWeekProgress');
  const weekLabelEl = document.getElementById('workoutWeekLabel');
  const focusListEl = document.getElementById('workoutFocusList');
  const caloriesEl = document.getElementById('workoutCalories');
  const planBadgeEl = document.getElementById('workoutPlanBadge');
  const logButton = document.getElementById('workoutLogButton');
  const logStatus = document.getElementById('workoutLogStatus');
  const reviewEl = document.getElementById('workoutGeminiReview');
  const reviewBodyEl = document.getElementById('workoutGeminiBody');
  const weekPctEl = document.getElementById('workoutWeekPct');
  const weekWorkoutsEl = document.getElementById('workoutWeekWorkouts');
  const weekDaysEl = document.getElementById('workoutWeekDays');
  const sessionRingEl = document.getElementById('workoutSessionRing');
  const logButton2 = document.getElementById('workoutLogButton2');

  let activeWrapper = null;
  let activePlan = null;
  let selectedDay = null;

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
      if (!wrapper || typeof wrapper !== 'object') return null;
      return { wrapper, plan: wrapper.plan || wrapper };
    } catch {
      return null;
    }
  }

  function localDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function currentWeekKey() {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return localDateKey(monday);
  }

  function planKey() {
    return String(activeWrapper?.id || activePlan?.id || 'active-plan');
  }

  function completionKey() {
    return `${planKey()}:${currentWeekKey()}`;
  }

  function exerciseKey(exercise, index) {
    return `${index}:${exercise.id || exercise.name || 'exercise'}`;
  }

  function readCompletion() {
    try {
      const raw = localStorage.getItem(COMPLETION_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const entry = data && typeof data === 'object' && !Array.isArray(data)
        ? data[completionKey()]
        : null;
      return entry && typeof entry === 'object' ? entry : {};
    } catch {
      return {};
    }
  }

  function writeCompletion(completion) {
    try {
      const raw = localStorage.getItem(COMPLETION_KEY);
      const data = raw ? JSON.parse(raw) : {};
      const current = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
      current[completionKey()] = completion;
      localStorage.setItem(COMPLETION_KEY, JSON.stringify(current));
      return true;
    } catch {
      return false;
    }
  }

  function readLoggedKeys() {
    try {
      const raw = localStorage.getItem(LOGGED_KEY);
      const keys = raw ? JSON.parse(raw) : [];
      return Array.isArray(keys) ? keys : [];
    } catch {
      return [];
    }
  }

  function sessionLogKey(day) {
    return `${planKey()}:${currentWeekKey()}:${day}`;
  }

  function saveLoggedKey(key) {
    try {
      const keys = readLoggedKeys();
      if (!keys.includes(key)) keys.push(key);
      localStorage.setItem(LOGGED_KEY, JSON.stringify(keys));
      return true;
    } catch {
      return false;
    }
  }

  function dayExercises(day) {
    const session = (activePlan?.days || []).find(item => item.day === day);
    return Array.isArray(session?.exercises) ? session.exercises : [];
  }

  function completionFor(day) {
    const saved = readCompletion();
    return Array.isArray(saved[day]) ? saved[day] : [];
  }

  function setReview(text) {
    if (!reviewEl) return;
    if (!text) {
      reviewEl.style.display = 'none';
      if (reviewBodyEl) reviewBodyEl.textContent = '';
      return;
    }
    reviewEl.style.display = '';
    if (reviewBodyEl) reviewBodyEl.textContent = text;
    else {
      reviewEl.replaceChildren();
      const body = el('p', 'wk-gemini-body', text);
      reviewEl.appendChild(body);
    }
  }

  function setPlanBadge(hasPlan) {
    if (!planBadgeEl) return;
    const indicator = document.createElement('span');
    indicator.setAttribute('aria-hidden', 'true');
    planBadgeEl.replaceChildren(indicator, document.createTextNode(hasPlan ? ' ACTIVE PLAN' : ' NO ACTIVE PLAN'));
    planBadgeEl.classList.toggle('is-empty', !hasPlan);
  }

  function focusLabels(session) {
    const groups = (Array.isArray(session?.exercises) ? session.exercises : [])
      .flatMap(exercise => Array.isArray(exercise.muscleGroup)
        ? exercise.muscleGroup
        : [exercise.muscleGroup])
      .filter(group => typeof group === 'string' && group.trim());
    const unique = [...new Set(groups.map(group => group.trim()))];
    if (unique.length) return unique;
    return session?.focus ? [session.focus] : ['Recovery'];
  }

  function renderFocus(session) {
    if (!focusListEl) return;
    focusListEl.replaceChildren();
    const labels = focusLabels(session);
    const all = ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Lower Back', 'Chest', 'Shoulders', 'Back', 'Arms'];
    const activeSet = new Set(labels.map(l => l.toLowerCase()));
    // Highlight anatomy SVG
    document.querySelectorAll('.wk-anat-part').forEach((node) => {
      const key = (node.getAttribute('data-m') || '').toLowerCase();
      const on = [...activeSet].some(l => l.includes(key) || key.includes(l.split(' ')[0]));
      node.classList.toggle('is-active', on);
    });
    const show = labels.length ? labels : ['Recovery'];
    show.forEach((label) => {
      const li = el('li', 'wk-focus-tag');
      li.appendChild(el('span', 'wk-focus-dot', ''));
      li.appendChild(document.createTextNode(label));
      focusListEl.appendChild(li);
    });
    // Dim inactive common groups for visual density like reference
    all.forEach((label) => {
      if (show.some(s => s.toLowerCase() === label.toLowerCase())) return;
      if (show.length >= 4) return;
      const li = el('li', 'wk-focus-tag is-off');
      li.appendChild(el('span', 'wk-focus-dot', ''));
      li.appendChild(document.createTextNode(label));
      focusListEl.appendChild(li);
    });
  }

  function renderEstimate(session) {
    if (!caloriesEl) return;
    const profile = activePlan?.profileSnapshot || activeWrapper?.profileSnapshot || {};
    const weight = Number(profile.weightKg || profile.weight);
    const duration = Number(session?.durationMin);
    if (Number.isFinite(weight) && weight >= 35 && weight <= 220 &&
      Number.isFinite(duration) && duration > 0 && duration <= 180) {
      caloriesEl.textContent = `~${Math.round(5 * weight * duration / 60)} kcal`;
    } else {
      caloriesEl.textContent = 'Estimate unavailable';
    }
  }

  function updateWeekProgress() {
    const days = activePlan?.days || [];
    let totalEx = 0;
    let doneEx = 0;
    let totalSessions = 0;
    let doneSessions = 0;
    days.forEach((session) => {
      const exercises = Array.isArray(session.exercises) ? session.exercises : [];
      if (!exercises.length) return;
      totalSessions += 1;
      const checked = completionFor(session.day);
      totalEx += exercises.length;
      doneEx += Math.min(checked.length, exercises.length);
      if (exercises.length && checked.length >= exercises.length) doneSessions += 1;
    });
    const percent = totalEx ? Math.round((doneEx / totalEx) * 100) : 0;
    if (weekCountEl) weekCountEl.textContent = `${doneEx} / ${totalEx || 12}`;
    if (weekWorkoutsEl) weekWorkoutsEl.textContent = `${doneSessions} / ${totalSessions || 4}`;
    if (weekPctEl) weekPctEl.textContent = `${percent}%`;
    if (weekProgressEl) {
      weekProgressEl.setAttribute('aria-valuenow', String(percent));
      const fill = weekProgressEl.firstElementChild;
      if (fill) fill.style.width = `${percent}%`;
    }
    if (weekLabelEl) {
      weekLabelEl.textContent = totalEx
        ? `${percent}% of this week's exercises complete`
        : 'No exercises scheduled this week';
    }
    // Week day circles Mon-Sun
    if (weekDaysEl) {
      const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const dayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const todayIdx = (new Date().getDay() + 6) % 7;
      weekDaysEl.replaceChildren();
      dayKeys.forEach((key, i) => {
        const node = el('span', 'wk-week-day', labels[i]);
        if (i === todayIdx) node.classList.add('is-today');
        const exercises = dayExercises(key);
        const checked = completionFor(key);
        if (exercises.length && checked.length >= exercises.length) node.classList.add('is-done');
        weekDaysEl.appendChild(node);
      });
    }
    dayTabs.querySelectorAll('[data-day]').forEach((tab) => {
      const day = tab.dataset.day;
      const count = dayExercises(day).length;
      const checked = completionFor(day).length;
      const label = tab.querySelector('.wk-day-count');
      if (label) {
        // Focus subtitle under day name (e.g. Lower Body)
        const session = (activePlan?.days || []).find(s => s.day === day);
        const focus = session?.focus || (count ? 'Train' : 'Rest');
        label.textContent = count ? String(focus).split(/[·|,]/)[0].trim().slice(0, 14) : 'Rest';
      }
    });
  }


  function updateLogButton(session) {
    if (!logButton) return;
    const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
    const done = completionFor(session?.day || '');
    const loggingAvailable = typeof window.VyoraAPI?.listWorkouts === 'function' &&
      typeof window.VyoraAPI?.logWorkout === 'function';
    const canLog = exercises.length > 0 && done.length > 0 && loggingAvailable;
    const alreadyLogged = session?.day && readLoggedKeys().includes(sessionLogKey(session.day));
    logButton.disabled = !canLog || Boolean(alreadyLogged);
    logButton.textContent = alreadyLogged ? 'Workout logged' : 'Log this workout';
    if (logStatus && !alreadyLogged && !loggingAvailable) {
      logStatus.textContent = 'Workout logging is unavailable right now.';
    } else if (logStatus && !alreadyLogged && !canLog) {
      logStatus.textContent = exercises.length
        ? 'Check off at least one exercise before logging this session.'
        : 'Recovery days with no exercises do not need a workout log.';
    } else if (logStatus && alreadyLogged) {
      logStatus.textContent = 'This plan day is already logged for the current week.';
    } else if (logStatus) {
      logStatus.textContent = '';
    }
  }

  function parsePrescription(prescription) {
    const raw = String(prescription || '').trim();
    if (!raw) return { sets: '—', reps: '—', rest: '—' };
    // e.g. "3 × 8-12" or "3 sets of 10" or "4-6 min"
    const setsMatch = raw.match(/(\d+)\s*[x×sets]/i);
    const repsMatch = raw.match(/[x×]\s*([\d]+(?:\s*[-–]\s*[\d]+)?)/i) || raw.match(/(\d+\s*[-–]\s*\d+)\s*(?:reps)?/i);
    const restMatch = raw.match(/rest\s*([\d]+\s*(?:s|sec|m|min)?)/i);
    const durMatch = raw.match(/(\d+\s*[-–]\s*\d+\s*(?:min|m|sec|s))/i);
    if (durMatch && !setsMatch) {
      return { duration: durMatch[1], rpe: null, isTimed: true };
    }
    return {
      sets: setsMatch ? setsMatch[1] : (raw.split(/[x×]/)[0] || '—').trim(),
      reps: repsMatch ? repsMatch[1].replace(/\s/g, '') : '—',
      rest: restMatch ? restMatch[1] : '60s',
      isTimed: false
    };
  }

  function tagForExercise(exercise, index) {
    const name = (exercise.name || '').toLowerCase();
    const groups = [].concat(exercise.muscleGroup || []);
    if (index === 0 || /warm|march|circle|opener/.test(name)) return { label: 'Warm-up', cls: 'is-warmup' };
    if (/cool|stretch|recover|breath/.test(name)) return { label: 'Recovery', cls: 'is-recovery' };
    const g = groups[0] || exercise.focus || 'Train';
    return { label: String(g).replace(/_/g, ' '), cls: '' };
  }

  function thumbEmoji(exercise) {
    const n = (exercise.name || '').toLowerCase();
    if (/squat|lunge|split/.test(n)) return '🦵';
    if (/deadlift|hinge|rdl/.test(n)) return '🏋️';
    if (/press|push|bench/.test(n)) return '💪';
    if (/row|pull|chin/.test(n)) return '🔙';
    if (/plank|core|crunch/.test(n)) return '🧘';
    if (/stretch|cool|yoga/.test(n)) return '✨';
    if (/run|walk|march|cardio/.test(n)) return '🏃';
    return '🤸';
  }

  function renderDay(day) {
    selectedDay = day;
    const activeTab = dayTabs.querySelector('[aria-selected="true"]');
    if (activeTab) exList.setAttribute('aria-labelledby', activeTab.id);
    exList.replaceChildren();
    const session = (activePlan?.days || []).find(item => item.day === day);
    if (!session) {
      exList.appendChild(el('p', 'bottom-note', 'No session scheduled for this day.'));
      return;
    }

    const dayNames = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
    const fullDay = dayNames[day] || day;
    if (sessionTitleEl) {
      sessionTitleEl.textContent = `${fullDay} · ${session.focus || session.title || 'Session'}`;
    }

    // Meta chips: duration, level, equipment
    if (sessionMetaEl) {
      sessionMetaEl.replaceChildren();
      const duration = session.durationMin || session.duration || session.estimatedMinutes;
      if (duration) {
        const chip = el('span', 'wk-meta-chip');
        chip.innerHTML = `<b>⏱</b> ${duration} min`;
        sessionMetaEl.appendChild(chip);
      }
      if (session.level || session.intensity) {
        const chip = el('span', 'wk-meta-chip');
        chip.innerHTML = `<b>▮</b> ${session.level || session.intensity}`;
        sessionMetaEl.appendChild(chip);
      }
      const equip = session.equipment || activePlan?.profileSnapshot?.equipment || activePlan?.equipment;
      if (equip) {
        const label = Array.isArray(equip) ? equip.slice(0, 3).join(' / ') : String(equip);
        const chip = el('span', 'wk-meta-chip');
        chip.innerHTML = `<b>🏋</b> ${label}`;
        sessionMetaEl.appendChild(chip);
      }
    }

    const exercises = Array.isArray(session.exercises) ? session.exercises : [];
    const checked = completionFor(day);
    const done = Math.min(checked.length, exercises.length);
    if (sessionProgressEl) sessionProgressEl.textContent = `${done}/${exercises.length || 0}`;
    if (sessionRingEl) {
      const circ = 2 * Math.PI * 15.5;
      const pct = exercises.length ? done / exercises.length : 0;
      sessionRingEl.setAttribute('stroke-dasharray', String(circ.toFixed(1)));
      sessionRingEl.setAttribute('stroke-dashoffset', String((circ * (1 - pct)).toFixed(1)));
    }

    renderFocus(session);
    renderEstimate(session);
    updateWeekProgress();

    dayTabs.querySelectorAll('[role="tab"]').forEach((tab) => {
      const on = tab.dataset.day === day;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });

    if (exercises.length) {
      exercises.forEach((exercise, index) => {
        const key = exercise.id || exercise.name || `ex-${index}`;
        const row = el('div', 'wk-exercise');
        if (checked.includes(key)) row.classList.add('is-complete');

        row.appendChild(el('span', 'wk-ex-num', String(index + 1)));

        const thumb = el('div', 'wk-ex-thumb');
        if (exercise.imageUrl) {
          const img = document.createElement('img');
          img.src = exercise.imageUrl;
          img.alt = '';
          img.loading = 'lazy';
          thumb.appendChild(img);
        } else {
          thumb.appendChild(el('span', 'wk-ex-thumb-fallback', thumbEmoji(exercise)));
        }
        row.appendChild(thumb);

        const info = el('div', 'wk-exercise-info');
        info.appendChild(el('h4', 'wk-exercise-name', exercise.name || 'Exercise'));
        const tag = tagForExercise(exercise, index);
        const tagEl = el('span', `wk-ex-tag ${tag.cls}`.trim(), tag.label);
        info.appendChild(tagEl);
        if (exercise.formCue) info.appendChild(el('p', 'wk-exercise-cue', exercise.formCue));
        row.appendChild(info);

        const details = el('div', 'wk-exercise-details');
        const parsed = parsePrescription(exercise.prescription || exercise.sets);
        if (parsed.isTimed) {
          const d = el('div', 'wk-stat');
          d.appendChild(el('span', 'wk-stat-label', 'Duration'));
          d.appendChild(el('span', 'wk-stat-value', parsed.duration || '—'));
          details.appendChild(d);
          const r = el('div', 'wk-stat');
          r.appendChild(el('span', 'wk-stat-label', 'RPE'));
          r.appendChild(el('span', 'wk-stat-value', exercise.intensityRpe || exercise.rpe || '2-3'));
          details.appendChild(r);
        } else {
          const s = el('div', 'wk-stat');
          s.appendChild(el('span', 'wk-stat-label', 'Sets'));
          s.appendChild(el('span', 'wk-stat-value', parsed.sets));
          details.appendChild(s);
          const r = el('div', 'wk-stat');
          r.appendChild(el('span', 'wk-stat-label', 'Reps'));
          r.appendChild(el('span', 'wk-stat-value', parsed.reps));
          details.appendChild(r);
          const rest = el('div', 'wk-stat');
          rest.appendChild(el('span', 'wk-stat-label', 'Rest'));
          rest.appendChild(el('span', 'wk-stat-value', exercise.rest || parsed.rest));
          details.appendChild(rest);
        }
        row.appendChild(details);

        const startBtn = document.createElement('button');
        startBtn.type = 'button';
        startBtn.className = 'wk-start-btn';
        startBtn.innerHTML = '<span aria-hidden="true">▶</span> Start';
        const searchQuery = (exercise.videoQuery || `${exercise.name || 'exercise form'} proper form`).trim();
        startBtn.addEventListener('click', () => {
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`, '_blank', 'noopener,noreferrer');
        });
        row.appendChild(startBtn);

        const checkLabel = el('label', 'wk-check-label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked.includes(key);
        checkbox.setAttribute('aria-label', `Mark ${exercise.name || 'exercise'} complete`);
        checkLabel.appendChild(checkbox);
        row.appendChild(checkLabel);

        checkbox.addEventListener('change', () => {
          const current = readCompletion();
          const completed = Array.isArray(current[day]) ? current[day] : [];
          current[day] = checkbox.checked
            ? [...new Set([...completed, key])]
            : completed.filter(value => value !== key);
          if (!writeCompletion(current)) {
            checkbox.checked = !checkbox.checked;
            if (statusEl) statusEl.textContent = 'Progress could not be saved on this device.';
            return;
          }
          if (statusEl) statusEl.textContent = 'Auto-built from your goal, equipment, and recent adherence. Check off sets as you go.';
          row.classList.toggle('is-complete', checkbox.checked);
          const nowChecked = current[day].length;
          if (sessionProgressEl) sessionProgressEl.textContent = `${Math.min(nowChecked, exercises.length)}/${exercises.length}`;
          if (sessionRingEl) {
            const circ = 2 * Math.PI * 15.5;
            const pct = exercises.length ? Math.min(nowChecked, exercises.length) / exercises.length : 0;
            sessionRingEl.setAttribute('stroke-dashoffset', String((circ * (1 - pct)).toFixed(1)));
          }
          updateWeekProgress();
          updateLogButton(session);
        });

        exList.appendChild(row);
      });
    } else {
      exList.appendChild(el('div', 'wk-recovery-card', session.focus || 'Rest and recovery'));
      exList.appendChild(el('p', 'wk-recovery-copy', 'No exercises are prescribed for this day. Take the recovery time your plan calls for.'));
    }

    updateLogButton(session);
  }


  function placeholder() {
    activeWrapper = null;
    activePlan = null;
    selectedDay = null;
    dayTabs.replaceChildren();
    exList.replaceChildren();
    if (progressionEl) progressionEl.textContent = '';
    if (statusEl) statusEl.textContent = 'No active plan found. Head to Home to build your custom plan, then return here.';
    if (weekPctEl) weekPctEl.textContent = '0%';
    if (weekWorkoutsEl) weekWorkoutsEl.textContent = '0 / 4';
    if (weekDaysEl) weekDaysEl.replaceChildren();
    if (sessionRingEl) sessionRingEl.setAttribute('stroke-dashoffset', '97.4');
    if (sessionTitleEl) sessionTitleEl.textContent = 'Build your first plan';
    if (sessionMetaEl) sessionMetaEl.textContent = '';
    if (sessionProgressEl) sessionProgressEl.textContent = '';
    if (weekCountEl) weekCountEl.textContent = '0 / 0';
    if (weekLabelEl) weekLabelEl.textContent = 'Generate a plan to track exercises';
    if (weekProgressEl) {
      weekProgressEl.setAttribute('aria-valuenow', '0');
      if (weekProgressEl.firstElementChild) weekProgressEl.firstElementChild.style.width = '0%';
    }
    if (focusListEl) focusListEl.replaceChildren(el('span', 'wk-focus-tag', 'No plan yet'));
    if (caloriesEl) caloriesEl.textContent = 'Estimate unavailable';
    setPlanBadge(false);
    if (logButton) {
      logButton.disabled = true;
      logButton.textContent = 'Log this workout';
    }
    if (logStatus) logStatus.textContent = '';
    setReview('');
  }

  function renderPlan(wrapper, plan) {
    if (!plan || !Array.isArray(plan.days) || !plan.days.length) {
      placeholder();
      return;
    }
    activeWrapper = wrapper;
    activePlan = plan;
    setPlanBadge(true);
    if (statusEl) statusEl.textContent = '';
    if (progressionEl) progressionEl.textContent = plan.weeklyProgressionNote || '';
    setReview(plan.geminiReviewText || '');

    const days = plan.days.map(day => day.day);
    const today = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];
    selectedDay = days.includes(today) ? today : days[0];
    dayTabs.replaceChildren();

    days.forEach((day, index) => {
      const button = el('button', 'wk-day-tab');
      button.type = 'button';
      button.id = `workout-tab-${index}`;
      button.dataset.day = day;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'exList');
      button.setAttribute('aria-selected', String(day === selectedDay));
      button.tabIndex = day === selectedDay ? 0 : -1;
      button.appendChild(el('span', 'wk-day-name', String(day).toUpperCase().slice(0, 3)));
      button.appendChild(el('span', 'wk-day-count', ''));
      button.addEventListener('click', () => {
        dayTabs.querySelectorAll('[role="tab"]').forEach((tab) => {
          tab.setAttribute('aria-selected', String(tab === button));
          tab.tabIndex = tab === button ? 0 : -1;
        });
        renderDay(day);
      });
      button.addEventListener('keydown', (event) => {
        const tabs = [...dayTabs.querySelectorAll('[role="tab"]')];
        const currentIndex = tabs.indexOf(button);
        let nextIndex = currentIndex;
        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
      });
      dayTabs.appendChild(button);
    });
    renderDay(selectedDay);
    updateWeekProgress();
  }

  function refresh() {
    const state = readActivePlan();
    if (!state) {
      placeholder();
      return;
    }
    renderPlan(state.wrapper, state.plan);
  }

  async function logCurrentWorkout() {
    const session = (activePlan?.days || []).find(day => day.day === selectedDay);
    const exercises = Array.isArray(session?.exercises) ? session.exercises : [];
    const completed = completionFor(selectedDay || '');
    if (!session || !exercises.length || !completed.length) return;
    if (typeof window.VyoraAPI?.logWorkout !== 'function' || typeof window.VyoraAPI?.listWorkouts !== 'function') {
      if (logStatus) logStatus.textContent = 'Workout logging is unavailable right now.';
      return;
    }

    const key = sessionLogKey(session.day);
    if (readLoggedKeys().includes(key)) {
      updateLogButton(session);
      return;
    }
    logButton.disabled = true;
    logButton.textContent = 'Checking log…';
    if (logStatus) logStatus.textContent = 'Checking for an existing log before saving.';
    try {
      const existing = await window.VyoraAPI.listWorkouts();
      const alreadyExists = Array.isArray(existing) && existing.some(item =>
        item?.log?.planId === planKey() &&
        item.log.weekKey === currentWeekKey() &&
        item.log.day === session.day);
      if (alreadyExists) {
        saveLoggedKey(key);
        if (logStatus) logStatus.textContent = 'This plan day was already logged for the current week.';
        updateLogButton(session);
        return;
      }

      await window.VyoraAPI.logWorkout({
        planId: planKey(),
        weekKey: currentWeekKey(),
        day: session.day,
        focus: session.focus || '',
        durationMin: Number(session.durationMin) || null,
        completedExercises: exercises
          .filter((exercise, index) => completed.includes(exerciseKey(exercise, index)))
          .map(exercise => exercise.name || 'Exercise'),
        completedCount: completed.length
      });
      const savedLocally = saveLoggedKey(key);
      updateLogButton(session);
      if (logStatus) {
        logStatus.textContent = savedLocally
          ? 'Workout logged successfully.'
          : 'Workout logged, but this device could not save the duplicate-prevention marker.';
      }
    } catch (error) {
      if (logStatus) logStatus.textContent = `Could not log this workout: ${error.message || 'Please try again.'}`;
      logButton.disabled = false;
      logButton.textContent = 'Log this workout';
    }
  }

  function openPlanAdjustments() {
    window.VyoraCore?.navigate('home');
    window.setTimeout(() => {
      const target = activePlan && document.getElementById('planResults')?.style.display !== 'none'
        ? document.getElementById('planResults')
        : document.getElementById('pGenerate');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target?.focus?.({ preventScroll: true });
    }, 0);
  }

  document.getElementById('workoutAdjustButton')?.addEventListener('click', openPlanAdjustments);
  document.getElementById('workoutExploreButton')?.addEventListener('click', () => {
    window.VyoraCore?.navigate('training');
  });
  logButton?.addEventListener('click', logCurrentWorkout);

  refresh();
  window.addEventListener('vyora:plan-updated', refresh);
  window.addEventListener('storage', (event) => {
    if (event.key === ACTIVE_PLAN_KEY) refresh();
  });
})();

  document.getElementById('workoutSwapButton')?.addEventListener('click', () => {
    if (statusEl) statusEl.textContent = 'Pick an exercise below, then use Start to find an alternate form video — full swap lands in a later release.';
  });
