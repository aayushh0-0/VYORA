// Workout tab — renders active plan from localStorage (guest or saved)
(function () {
  const ACTIVE_PLAN_KEY = 'vyora_active_plan';
  const dayTabs = document.getElementById('dayTabs');
  const exList = document.getElementById('exList');
  const statusEl = document.getElementById('workoutPlanStatus');
  const progressionEl = document.getElementById('workoutProgression');
  if (!dayTabs || !exList) return;

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

  const reviewEl = document.getElementById('workoutGeminiReview');

  function setReview(text) {
    if (!reviewEl) return;
    if (!text) {
      reviewEl.style.display = 'none';
      reviewEl.replaceChildren();
      return;
    }
    reviewEl.style.display = '';
    reviewEl.replaceChildren();
    const title = document.createElement('h3');
    title.style.marginTop = '0';
    title.textContent = 'Gemini AI Plan Review';
    const body = document.createElement('p');
    body.style.margin = '0';
    body.style.whiteSpace = 'pre-wrap';
    body.textContent = text;
    reviewEl.append(title, body);
  }

  function placeholder() {
    dayTabs.replaceChildren();
    exList.replaceChildren();
    if (progressionEl) progressionEl.textContent = '';
    if (statusEl) {
      statusEl.textContent = 'No active plan found. Head to the Home page to build your custom plan.';
    }
    setReview('');
  }

  function renderDay(day, plan) {
    exList.replaceChildren();
    const session = (plan.days || []).find(d => d.day === day);
    if (!session) {
      exList.appendChild(el('p', 'bottom-note', 'No session scheduled for this day.'));
      return;
    }

    const dayBlock = el('div', 'wk-day');
    const dayTitle = el('div', 'wk-day-title', `${session.day} · ${session.focus || ''} (${session.durationMin || 30}m · ${session.environment || 'flexible'})`);
    dayBlock.appendChild(dayTitle);
    if (session.warmUp) {
      dayBlock.appendChild(el('div', 'wk-warm', `Warm-up: ${session.warmUp}`));
    }
    exList.appendChild(dayBlock);

    const exercises = Array.isArray(session.exercises) ? session.exercises : [];
    if (exercises.length) {
      const head = el('div', 'wk-head');
      ['Exercise', 'Sets x Reps', 'Rest', 'RPE', 'Demo'].forEach((label) => {
        head.appendChild(el('div', '', label));
      });
      exList.appendChild(head);

      exercises.forEach((exercise) => {
        const row = el('div', 'wk-row');

        const nameCell = el('div', 'wk-name');
        nameCell.appendChild(document.createTextNode(exercise.name || 'Exercise'));
        if (exercise.formCue) {
          nameCell.appendChild(el('div', 'wk-cue', exercise.formCue));
        }
        row.appendChild(nameCell);

        const setsCell = el('div', 'wk-sets');
        setsCell.textContent = exercise.prescription || '';
        row.appendChild(setsCell);

        const restCell = el('div', 'wk-rest');
        restCell.textContent = exercise.rest ? (String(exercise.rest).toLowerCase().startsWith('rest') ? String(exercise.rest) : `Rest ${exercise.rest}`) : '';
        row.appendChild(restCell);

        const rpeCell = el('div', 'wk-rpe');
        rpeCell.textContent = exercise.intensityRpe || '';
        row.appendChild(rpeCell);

        const linkCell = el('div', 'wk-link');
        const searchQuery = (exercise.videoQuery || `${exercise.name || 'exercise form'} proper form`).trim();
        const demo = document.createElement('a');
        demo.className = 'yt-link';
        demo.textContent = 'Search on YouTube ↗';
        demo.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        demo.target = '_blank';
        demo.rel = 'noopener noreferrer';
        demo.title = `Search YouTube for "${exercise.name || 'exercise form'}"`;
        linkCell.appendChild(demo);
        row.appendChild(linkCell);

        exList.appendChild(row);
      });
    } else {
      exList.appendChild(el('p', 'bottom-note', 'Rest / recovery focus — no prescribed exercises for this day.'));
    }

    if (session.coolDown) {
      exList.appendChild(el('div', 'wk-cool', `Cool-down: ${session.coolDown}`));
    }
  }

  function renderPlan(plan) {
    if (!plan || !Array.isArray(plan.days) || !plan.days.length) {
      placeholder();
      return;
    }
    if (statusEl) statusEl.textContent = '';
    if (progressionEl) progressionEl.textContent = plan.weeklyProgressionNote || '';
    setReview(plan.geminiReviewText || '');

    const days = plan.days.map(d => d.day);
    dayTabs.replaceChildren();
    let selected = days[0];

    days.forEach((day, index) => {
      const button = el('button', index === 0 ? 'active' : '', day);
      button.type = 'button';
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => {
        selected = day;
        dayTabs.querySelectorAll('button').forEach(node => node.classList.remove('active'));
        button.classList.add('active');
        renderDay(day, plan);
      });
      dayTabs.appendChild(button);
    });
    renderDay(selected, plan);
  }

  function refresh() {
    renderPlan(readActivePlan());
  }

  refresh();
  window.addEventListener('vyora:plan-updated', refresh);
  window.addEventListener('storage', (event) => {
    if (event.key === ACTIVE_PLAN_KEY) refresh();
  });
})();
