/**
 * Stage 8 — Adaptive Plan Builder & Partial Regeneration UI
 * Calls `POST /api/plans/generate` and `PATCH /api/plans/:id` for conversational/quick swaps
 * ("No eggs today", "Make this an outdoor workout", "Shorter 20m session", "My knee hurts").
 * Renders all content using safe DOM nodes (no untrusted innerHTML).
 */
(function () {
  const videoBank = {
    fatloss: [
      ['Beginner Fat-Loss Workout (No Equipment)', 'fat loss workout no equipment'],
      ['HIIT Cardio for Beginners', 'beginner HIIT cardio'],
      ['How to Read Food Labels', 'how to read nutrition labels']
    ],
    musclegain: [
      ['Perfect Push-Pull-Legs Split', 'push pull legs split for beginners'],
      ['Bench Press Form Tutorial', 'bench press proper form'],
      ['High Protein Meal Prep', 'high protein meal prep for muscle gain']
    ],
    recomp: [
      ['Beginner Full Body Strength Routine', 'beginner full body strength workout'],
      ['Body Recomposition Explained', 'body recomposition explained'],
      ['Simple Meal Prep for Recomp', 'simple healthy meal prep']
    ],
    endurance: [
      ['Zone 2 Cardio Explained', 'zone 2 cardio training explained'],
      ['Beginner Interval Running Guide', 'beginner interval running workout'],
      ['Fueling for Endurance Training', 'nutrition for endurance athletes']
    ],
    general: [
      ['Full Body Strength for Beginners', 'beginner full body strength workout'],
      ['Daily Mobility Routine', 'daily mobility routine'],
      ['Balanced Meal Planning Basics', 'balanced healthy meal planning']
    ]
  };

  const suppBank = {
    fatloss: ['Whey/plant protein', 'Multivitamin', 'Omega-3'],
    musclegain: ['Whey protein', 'Creatine monohydrate', 'Multivitamin'],
    recomp: ['Whey/plant protein', 'Creatine monohydrate', 'Omega-3'],
    endurance: ['Electrolyte mix', 'Multivitamin', 'Omega-3'],
    general: ['Multivitamin', 'Omega-3', 'Electrolyte mix']
  };

  let currentPlanId = null;
  let selectedDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()];

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }


  const ACTIVE_PLAN_KEY = 'vyora_active_plan';

  function showGuestBanner(isGuest) {
    const results = document.getElementById('planResults');
    if (!results) return;
    let banner = document.getElementById('guestPlanBanner');
    if (!isGuest) {
      if (banner) banner.remove();
      return;
    }
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'guestPlanBanner';
      banner.className = 'card';
      banner.setAttribute('role', 'status');
      banner.style.marginBottom = '14px';
      banner.style.border = '1px solid #e8b86d';
      banner.style.background = 'rgba(232,184,109,0.12)';
      results.insertBefore(banner, results.firstChild);
    }
    banner.replaceChildren();
    const p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = 'You are using guest mode. Your data is not stored anywhere and might be lost at any time. Log in to save your progress and access premium features.';
    banner.appendChild(p);
  }

  function clearPlanResults() {
    ['rDietSummary', 'rMeals', 'rWorkoutSummary', 'rWorkoutDays', 'rSupps', 'rVideos', 'rGyms', 'aiPlanText', 'weeklyPlanSummary', 'weeklyAiNotes', 'planModStatus']
      .forEach(id => document.getElementById(id)?.replaceChildren());
  }

  function renderStructuredPlan(planWrapper) {
    const plan = planWrapper.plan || planWrapper;
    currentPlanId = planWrapper.id || currentPlanId;

    const dietSummary = document.getElementById('rDietSummary');
    const mealsBox = document.getElementById('rMeals');
    const workoutSummary = document.getElementById('rWorkoutSummary');
    const workoutDaysBox = document.getElementById('rWorkoutDays');

    mealsBox.replaceChildren();
    const metadata = plan.estimateMetadata || {};
    if (Array.isArray(plan.generationDiagnostics) && plan.generationDiagnostics.length) {
      console.debug('Plan generation diagnostics:', plan.generationDiagnostics);
    }
    const summary = el('div', 'plan-summary');
    [
      ['BMI', metadata.bmi],
      ['BMR', metadata.bmr ? `${metadata.bmr} kcal` : undefined],
      ['TDEE', metadata.tdee ? `${metadata.tdee} kcal` : undefined],
      ['Daily target', metadata.estimatedDailyKcal ? `${metadata.estimatedDailyKcal} kcal` : undefined],
      ['Protein', metadata.estimatedProteinG ? `${metadata.estimatedProteinG} g` : undefined],
      ['Carbs', metadata.estimatedCarbsG ? `${metadata.estimatedCarbsG} g` : undefined],
      ['Fat', metadata.estimatedFatG ? `${metadata.estimatedFatG} g` : undefined]
    ].forEach(([label, value]) => {
      if (value !== undefined) {
        const stat = el('div', 'plan-summary-stat');
        stat.append(el('small', '', label), el('strong', '', String(value)));
        summary.appendChild(stat);
      }
    });
    dietSummary.replaceChildren(summary);
    if (plan.explanation) dietSummary.appendChild(el('p', 'bottom-note', plan.explanation));
    const targetKcal = Number(metadata.estimatedDailyKcal);
    const targetProtein = Number(metadata.estimatedProteinG);
    const maxDeviation = (plan.dailyTotals || []).reduce((maximum, total) => {
      const kcalDeviation = targetKcal ? Math.abs(Number(total.kcal) - targetKcal) / targetKcal * 100 : 0;
      const proteinDeviation = targetProtein ? Math.abs(Number(total.proteinG) - targetProtein) / targetProtein * 100 : 0;
      return Math.max(
        maximum,
        kcalDeviation > 5 ? kcalDeviation : 0,
        proteinDeviation > 10 ? proteinDeviation : 0
      );
    }, 0);
    if (maxDeviation > 5) {
      dietSummary.appendChild(el('p', 'bottom-note', `Daily totals may differ from your target by up to ${Math.ceil(maxDeviation)}%.`));
    }

    const tabs = el('div', 'day-tabs');
    const dayMealsBox = el('div', 'day-meals');
    const dayTotal = el('p', 'day-total');
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const renderDay = day => {
      selectedDay = days.includes(day) ? day : days[0];
      tabs.querySelectorAll('button').forEach(button => {
        button.classList.toggle('active', button.dataset.day === selectedDay);
        button.setAttribute('aria-selected', String(button.dataset.day === selectedDay));
      });
      dayMealsBox.replaceChildren();
      const dailyMeals = (plan.meals || []).filter(meal => meal.day === selectedDay);
      dailyMeals.forEach((m, idx) => {
        const mealDiv = el('div', 'meal');
        if (idx === dailyMeals.length - 1) mealDiv.style.border = 'none';
        const title = el('b', '', `${m.slot}: ${m.title || ''}`);
        const itemsP = el('p', '', Array.isArray(m.items) ? m.items.join(' · ') : String(m));
        itemsP.style.margin = '2px 0';
        const metaSmall = el('small', '', `${m.approxKcal || 0} kcal · ${m.approxProteinG || 0} g protein`);
        metaSmall.style.opacity = '0.8';
        mealDiv.append(title, itemsP, metaSmall);
        dayMealsBox.appendChild(mealDiv);
      });
      const total = (plan.dailyTotals || []).find(entry => entry.day === selectedDay);
      dayTotal.textContent = total
        ? `Total: ${total.kcal} kcal | ${total.proteinG} g protein | ${total.carbsG} g carbs | ${total.fatG} g fat`
        : 'Total unavailable';
    };
    days.forEach(day => {
      const button = el('button', 'day-tab', day);
      button.type = 'button';
      button.dataset.day = day;
      button.setAttribute('role', 'tab');
      button.addEventListener('click', () => renderDay(day));
      tabs.appendChild(button);
    });
    mealsBox.append(tabs, dayMealsBox, dayTotal);
    renderDay(selectedDay);
    const flags = (Array.isArray(plan.safetyFlags) ? plan.safetyFlags : [])
      .filter(flag => typeof flag === 'string' && !/fallback|tolerance|library|diagnostic/i.test(flag));
    if (flags.length) mealsBox.appendChild(el('p', 'plan-safety', `Safety notes: ${flags.join(' ')}`));
    mealsBox.appendChild(el('p', 'bottom-note', plan.estimateMetadata?.disclaimer || 'Calorie and macro estimates are approximate.'));

    workoutSummary.textContent = [
      flags.join(' '),
      plan.weeklyProgressionNote || ''
    ].filter(Boolean).join(' ');

    // Weekly plan summary chips from actual plan/profile
    const snap = plan.profileSnapshot || {};
    const weeklySummary = document.getElementById('weeklyPlanSummary');
    const weeklyIntro = document.getElementById('weeklyPlanIntro');
    if (weeklyIntro) {
      weeklyIntro.textContent = 'Based on your goals, experience, equipment, and schedule — not a medical prescription.';
    }
    if (weeklySummary) {
      weeklySummary.replaceChildren();
      const chips = [
        ['Primary goal', snap.goal || plan.goal || '—'],
        ['Days / week', String(plan.daysPerWeek || snap.daysPerWeek || (plan.days || []).filter(d => !/rest|recovery/i.test(d.focus || '')).length || '—')],
        ['Experience', plan.experience || snap.experience || '—'],
        ['Equipment', plan.equipmentLevel || snap.equipment || '—'],
        ['Session', (plan.sessionMinutes || snap.sessionMinutes) ? `${plan.sessionMinutes || snap.sessionMinutes} min` : '—']
      ];
      chips.forEach(([label, value]) => {
        const stat = el('div', 'plan-summary-stat');
        stat.append(el('small', '', label), el('strong', '', String(value)));
        weeklySummary.appendChild(stat);
      });
    }

    const notesEl = document.getElementById('weeklyAiNotes');
    if (notesEl) {
      const trainingDays = (plan.days || []).filter(d => !/rest|recovery/i.test(String(d.focus || ''))).length;
      notesEl.textContent = [
        plan.explanation || '',
        plan.weeklyProgressionNote || '',
        trainingDays
          ? `This week schedules about ${trainingDays} training session(s) to match your availability.`
          : '',
        'Rest and technique matter — stop if you feel sharp pain and seek professional care when needed.'
      ].filter(Boolean).join(' ');
    }

    workoutDaysBox.replaceChildren();
    const scheduleDays = Array.isArray(plan.days) ? plan.days : [];
    if (!scheduleDays.length) {
      workoutDaysBox.appendChild(el('p', 'bottom-note', 'No workout sessions were generated for this plan.'));
    }
    scheduleDays.forEach((d) => {
      const card = el('div', 'weekly-day-card');
      const title = el('h4', '', `${d.day || 'Session'} — ${d.focus || 'Training'}`);
      const muscles = Array.isArray(d.exercises)
        ? [...new Set(d.exercises.map(e => e.muscleGroup).filter(Boolean))].join(', ')
        : '';
      const meta = el(
        'div',
        'weekly-day-meta',
        [
          d.durationMin ? `${d.durationMin} min` : null,
          d.environment || null,
          muscles ? `Focus: ${muscles}` : null
        ].filter(Boolean).join(' · ')
      );
      card.append(title, meta);
      if (d.warmUp) card.appendChild(el('div', 'ex-muted', `Warm-up: ${d.warmUp}`));

      if (Array.isArray(d.exercises) && d.exercises.length) {
        d.exercises.forEach((exercise) => {
          const row = el('div', 'ex-row');
          const nameCell = document.createElement('div');
          nameCell.className = 'ex-name';
          nameCell.textContent = exercise.name || 'Exercise';
          if (exercise.formCue) {
            const cue = document.createElement('div');
            cue.className = 'ex-muted';
            cue.textContent = exercise.formCue;
            nameCell.appendChild(cue);
          }
          const sets = document.createElement('div');
          sets.textContent = exercise.sets != null ? `Sets: ${exercise.sets}` : (exercise.prescription || '—');
          const reps = document.createElement('div');
          reps.textContent = exercise.reps != null ? `Reps: ${exercise.reps}` : (exercise.intensityRpe || '');
          const rest = document.createElement('div');
          rest.className = 'ex-muted';
          rest.textContent = exercise.rest ? `Rest ${exercise.rest}` : '';

          const action = document.createElement('div');
          const searchQuery = (exercise.videoQuery || `${exercise.name || 'exercise form'} proper form`).trim();
          const yt = document.createElement('a');
          yt.className = 'btn ghost btn-tutorial';
          yt.textContent = 'Watch Tutorial ↗';
          yt.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
          yt.target = '_blank';
          yt.rel = 'noopener noreferrer';
          yt.title = `Watch Tutorial for "${exercise.name || 'exercise form'}"`;
          action.appendChild(yt);
          if (exercise.tutorialUrl) {
            const a = document.createElement('a');
            a.className = 'btn ghost btn-tutorial';
            a.textContent = 'Watch Tutorial';
            a.href = exercise.tutorialUrl;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.style.marginLeft = '8px';
            action.appendChild(a);
          }
          row.append(nameCell, sets, reps, rest, action);
          card.appendChild(row);
        });
      } else {
        card.appendChild(el('div', 'ex-muted', 'Rest / recovery focus'));
      }
      if (d.coolDown) card.appendChild(el('div', 'ex-muted', `Cool-down: ${d.coolDown}`));
      workoutDaysBox.appendChild(card);
    });

    const aiStatus = document.getElementById('aiPlanStatus');
    const aiText = document.getElementById('aiPlanText');
    if (aiStatus && aiText) {
      if (plan.geminiReviewText) {
        aiStatus.textContent = 'Prototype Gemini-style review (rule-based — not a live model call).';
        aiText.textContent = plan.geminiReviewText;
      } else {
        aiStatus.textContent = 'Generate a plan to request an AI review tailored to your goal and preferences.';
        aiText.textContent = '';
      }
    }

    ensurePartialAdaptationBar();
    wireWeeklyPlanActions();
  }

  function wireWeeklyPlanActions() {
    if (window.__vyoraWeeklyPlanWired) return;
    window.__vyoraWeeklyPlanWired = true;

    document.getElementById('btnEditPreferences')?.addEventListener('click', () => {
      document.getElementById('pHeight')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('pHeight')?.focus();
    });

    document.getElementById('btnRegeneratePlan')?.addEventListener('click', () => {
      document.getElementById('pGenerate')?.click();
    });

    document.getElementById('btnAskVyoraPlan')?.addEventListener('click', () => {
      const chat = document.getElementById('orbChat') || document.getElementById('chatInput');
      chat?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      chat?.focus?.();
    });

    document.getElementById('btnPlanModify')?.addEventListener('click', async () => {
      const status = document.getElementById('planModStatus');
      const input = document.getElementById('planModInput');
      const instruction = (input?.value || '').trim();
      if (!instruction) {
        if (status) status.textContent = 'Describe the change you want (e.g. make Monday easier).';
        return;
      }
      if (!currentPlanId || !window.VyoraAPI?.patchPlan) {
        if (status) status.textContent = 'Generate and save a plan first, then try again.';
        return;
      }
      try {
        if (status) status.textContent = 'Applying change…';
        const updated = await window.VyoraAPI.patchPlan(currentPlanId, { instruction });
        renderStructuredPlan(updated);
        if (status) {
          status.textContent = updated.whatChanged
            ? `Updated (v${updated.version}): ${updated.whatChanged}`
            : `Plan updated (v${updated.version || '—'}).`;
        }
        if (input) input.value = '';
      } catch (err) {
        if (status) status.textContent = 'Could not modify plan: ' + (err.message || 'Unknown error');
      }
    });
  }

  function ensurePartialAdaptationBar() {
    const resultsBox = document.getElementById('planResults');
    if (!resultsBox || document.getElementById('partialSwapCard')) return;

    const card = el('div', 'card');
    card.id = 'partialSwapCard';
    card.style.marginTop = '14px';

    const h = el('h3', '', 'Quick Conversational Plan Adaptations (Partial Regeneration)');
    h.style.marginTop = '0';
    const desc = el('p', 'bottom-note', 'Modify only the affected meal or workout segment while preserving the rest of your plan:');

    const btnRow = el('div', 'chat-row');
    btnRow.style.flexWrap = 'wrap';

    const swaps = [
      ['No eggs today', { instruction: 'No eggs today', mealSlot: 'Breakfast' }],
      ['No dairy snack', { instruction: 'No dairy today', mealSlot: 'Snack' }],
      ['Make Mon outdoor', { instruction: 'Make this an outdoor workout', day: 'Mon' }],
      ['Shorter 20m session', { instruction: 'Shorter 20 min workout today', day: 'Mon' }],
      ['My knee hurts', { instruction: 'My knee hurts today, give low-impact alternatives', day: 'Mon' }]
    ];

    const status = el('p', 'bottom-note', '');
    status.id = 'partialSwapStatus';
    status.setAttribute('aria-live', 'polite');

    swaps.forEach(([label, payload]) => {
      const b = el('button', 'btn ghost', label);
      b.addEventListener('click', async () => {
        if (!currentPlanId || !window.VyoraAPI?.patchPlan) {
          status.textContent = 'Generate a plan first before applying partial adaptations.';
          return;
        }
        try {
          status.textContent = `Applying "${label}"…`;
          const updated = await window.VyoraAPI.patchPlan(currentPlanId, { ...payload, day: selectedDay });
          renderStructuredPlan(updated);
          status.textContent = `v${updated.version}: ${updated.whatChanged} (${updated.why})`;
        } catch (err) {
          status.textContent = 'Could not apply adaptation: ' + err.message;
        }
      });
      btnRow.appendChild(b);
    });

    card.append(h, desc, btnRow, status);
    resultsBox.prepend(card);
  }


  /** Offline / API-down fallback so Generate always returns a usable weekly plan from form values. */
  function buildClientFallbackPlan(input) {
    const goal = input.goal || 'general';
    const daysPerWeek = Math.max(2, Math.min(6, Number(input.daysPerWeek) || 4));
    const sessionMinutes = Math.max(15, Math.min(90, Number(input.sessionMinutes) || 35));
    const experience = input.experience || 'beginner';
    const equipment = String(input.equipment || 'minimal').toLowerCase();
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const templates = {
      2: ['Full Body A', 'Full Body B'],
      3: ['Full Body A', 'Conditioning', 'Full Body B'],
      4: ['Lower Body', 'Upper Body', 'Conditioning', 'Full Body'],
      5: ['Lower', 'Upper Push', 'Conditioning', 'Upper Pull', 'Full Body'],
      6: ['Lower A', 'Upper A', 'Conditioning', 'Lower B', 'Upper B', 'Mobility']
    };
    const focuses = templates[daysPerWeek] || templates[4];
    // Spread training days across the week
    const trainIdx = [];
    const step = Math.max(1, Math.floor(7 / focuses.length));
    let cursor = 0;
    focuses.forEach(() => {
      trainIdx.push(cursor % 7);
      cursor += step;
    });
    const catalog = {
      lower: [
        { id: 'bw-squat', name: 'Bodyweight Squat', sets: 3, reps: '10–12', rest: '60s', muscleGroup: 'legs' },
        { id: 'glute-bridge', name: 'Glute Bridge', sets: 3, reps: '12', rest: '45s', muscleGroup: 'glutes' },
        { id: 'reverse-lunge', name: 'Reverse Lunge', sets: 3, reps: '8/side', rest: '60s', muscleGroup: 'legs' }
      ],
      upper: [
        { id: 'push-up', name: 'Push-Up (or incline)', sets: 3, reps: '8–12', rest: '60s', muscleGroup: 'chest' },
        { id: 'bw-row', name: 'Backpack / Band Row', sets: 3, reps: '10/side', rest: '60s', muscleGroup: 'back' },
        { id: 'overhead-press', name: 'Overhead Press (band/DB)', sets: 3, reps: '8–10', rest: '60s', muscleGroup: 'shoulders' }
      ],
      full: [
        { id: 'bw-squat', name: 'Bodyweight Squat', sets: 3, reps: '10', rest: '60s', muscleGroup: 'legs' },
        { id: 'push-up', name: 'Push-Up', sets: 3, reps: '8–12', rest: '60s', muscleGroup: 'chest' },
        { id: 'dead-bug', name: 'Dead Bug', sets: 3, reps: '8/side', rest: '45s', muscleGroup: 'core' }
      ],
      conditioning: [
        { id: 'brisk-walk', name: 'Brisk Walk or March in Place', sets: null, reps: '12–15 min', rest: '—', muscleGroup: 'conditioning' },
        { id: 'side-plank', name: 'Side Plank', sets: 3, reps: '20–30s/side', rest: '45s', muscleGroup: 'core' }
      ],
      mobility: [
        { id: 'cat-cow', name: 'Cat-Cow Mobility', sets: 2, reps: '8 breaths', rest: '20s', muscleGroup: 'mobility' },
        { id: 'hip-openers', name: 'Hip Openers', sets: 2, reps: '45s', rest: '20s', muscleGroup: 'mobility' }
      ]
    };
    function pickBucket(focus) {
      const f = focus.toLowerCase();
      if (f.includes('lower')) return catalog.lower;
      if (f.includes('upper') || f.includes('push') || f.includes('pull')) return catalog.upper;
      if (f.includes('condition')) return catalog.conditioning;
      if (f.includes('mobil')) return catalog.mobility;
      return catalog.full;
    }
    const trainSet = new Set(trainIdx);
    const days = dayNames.map((day, i) => {
      if (!trainSet.has(i)) {
        return {
          day,
          focus: 'Rest / Recovery',
          durationMin: 15,
          environment: equipment.includes('gym') ? 'gym' : 'home',
          warmUp: 'Optional easy walk',
          exercises: [],
          coolDown: 'Light stretching'
        };
      }
      const focus = focuses[trainIdx.indexOf(i)] || 'Full Body';
      const exercises = pickBucket(focus).map((ex) => ({
        ...ex,
        prescription: ex.sets != null ? `${ex.sets} sets × ${ex.reps}` : ex.reps,
        intensityRpe: 'RPE 6–7',
        formCue: 'Move with control; stop if you feel sharp pain.',
        tutorialUrl: null,
        tutorialAvailable: false
      }));
      return {
        day,
        focus,
        durationMin: sessionMinutes,
        environment: equipment.includes('gym') ? 'gym' : (equipment.includes('none') ? 'home' : 'flexible'),
        warmUp: '5 min easy cardio + joint circles',
        exercises,
        coolDown: '2–3 min breathing and stretch'
      };
    });
    return {
      id: 'local-plan-' + Date.now(),
      kind: 'combined',
      planType: 'combined',
      version: 1,
      goal,
      daysPerWeek,
      sessionMinutes,
      experience,
      equipmentLevel: equipment,
      weeklyProgressionNote: 'Progress by adding 1–2 reps when sets feel easy before increasing difficulty.',
      explanation: 'Client-side plan built from your form inputs (API was unavailable). Not medical advice.',
      profileSnapshot: { ...input, goal, experience, daysPerWeek, sessionMinutes, equipment },
      estimateMetadata: {
        bmi: input.heightCm && input.weightKg
          ? (input.weightKg / ((input.heightCm / 100) ** 2)).toFixed(1)
          : undefined,
        disclaimer: 'Estimates are approximate. Consult a professional for health conditions.'
      },
      days,
      meals: [],
      dailyTotals: [],
      safetyFlags: [],
      guest: true,
      persisted: false
    };
  }

  document.getElementById('pGenerate')?.addEventListener('click', async () => {
    const h = parseFloat(document.getElementById('pHeight').value);
    const w = parseFloat(document.getElementById('pWeight').value);
    const gender = document.getElementById('pGender').value;
    const age = Number(document.getElementById('pAge')?.value);
    const diet = document.getElementById('pDiet').value;
    const goal = document.getElementById('pGoal').value;
    const formError = document.getElementById('pFormError');
    const validationError = !Number.isFinite(h) || h < 120 || h > 230
      ? 'Height must be between 120 and 230 cm.'
      : !Number.isFinite(w) || w < 35 || w > 220
        ? 'Weight must be between 35 and 220 kg.'
        : !Number.isInteger(age) || age < 16 || age > 90
          ? 'Age must be between 16 and 90.'
          : '';
    formError.textContent = validationError;
    if (validationError) {
      clearPlanResults();
      document.getElementById('planResults').style.display = 'block';
      document.getElementById('rDietSummary').textContent = validationError;
      return;
    }
    formError.textContent = '';
    const activityLevel = document.getElementById('pActivity').value;
    const experience = document.getElementById('pExperience')?.value || 'beginner';
    const daysPerWeek = Number(document.getElementById('pDaysPerWeek')?.value || 4);
    const equipment = document.getElementById('pEquipment')?.value || 'minimal';
    const sessionMinutes = Number(document.getElementById('pSessionMinutes')?.value || 35);
    const location = (document.getElementById('pLocation')?.value || '').trim();
    const cuisine = document.getElementById('pCuisine').value;
    const allergies = [...document.querySelectorAll('#pAllergies input:checked')].map(input => input.value);
    const generateButton = document.getElementById('pGenerate');
    const planResults = document.getElementById('planResults');
    clearPlanResults();
    planResults.style.display = 'block';
    generateButton.disabled = true;
    generateButton.textContent = 'Generating...';

    // Render supplements & demo videos using safe DOM APIs
    const suppsBox = document.getElementById('rSupps');
    suppsBox.replaceChildren();
    const prototypeSupplements = [
      { label: 'Whey/plant protein', query: 'whey or plant protein powder supplement' },
      { label: 'Creatine monohydrate', query: 'Creatine monohydrate supplement' },
      { label: 'Omega-3', query: 'Omega-3 fish oil supplement' }
    ];
    prototypeSupplements.forEach(({ label, query }) => {
      const link = document.createElement('a');
      link.className = 'tag';
      link.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = label;
      link.style.display = 'inline-block';
      link.style.margin = '0 6px 6px 0';
      link.style.textDecoration = 'none';
      suppsBox.appendChild(link);
    });
    const suppNote = el('p', 'bottom-note', 'Suggestions, not prescriptions — check with a professional first.');
    suppsBox.appendChild(suppNote);

    const videosBox = document.getElementById('rVideos');
    videosBox.replaceChildren();
    (videoBank[goal] || videoBank.recomp).forEach(([title, q]) => {
      const vc = el('div', 'video-card');
      vc.appendChild(el('b', '', title));
      const a = document.createElement('a');
      a.textContent = 'Watch demo ↗';
      a.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      vc.appendChild(a);
      videosBox.appendChild(vc);
    });

    const gymBox = document.getElementById('rGyms');
    gymBox.replaceChildren();
    const mapsQuery = location
      ? `gyms in ${location}`
      : 'gyms near me';
    const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
    const gymIntro = el('p', '', location
      ? `Open Google Maps for gyms in ${location}:`
      : 'Add a city or neighborhood above for a local search, or open a general maps search:');
    const gymLink = document.createElement('a');
    gymLink.href = mapsHref;
    gymLink.target = '_blank';
    gymLink.rel = 'noopener noreferrer';
    gymLink.textContent = location ? `Gyms in ${location} on Google Maps ↗` : 'Gyms near me on Google Maps ↗';
    gymLink.style.display = 'inline-block';
    gymLink.style.marginTop = '6px';
    const gymNote = el('p', 'bottom-note', 'Prototype link only — not live listings. Save verified places under Gyms & Cafés when a maps provider is configured.');
    gymBox.append(gymIntro, gymLink, gymNote);

    const formPayload = {
      heightCm: h,
      weightKg: w,
      age,
      gender,
      diet,
      goal,
      activityLevel,
      experience,
      daysPerWeek,
      equipment,
      sessionMinutes,
      allergies,
      cuisine,
      planType: 'combined'
    };

    const applyGenerated = (generated, note) => {
      const planPayload = generated.plan || generated;
      try {
        localStorage.setItem('vyora_active_plan', JSON.stringify({
          ...generated,
          plan: planPayload,
          guest: generated.guest === true || generated.persisted === false,
          savedAt: new Date().toISOString()
        }));
      } catch (storageError) {
        console.warn('Could not cache plan locally', storageError);
      }
      renderStructuredPlan(generated);
      showGuestBanner(generated.guest === true || generated.persisted === false);
      if (note) {
        const status = document.getElementById('planModStatus');
        if (status) status.textContent = note;
      }
      window.dispatchEvent(new CustomEvent('vyora:plan-updated'));
    };

    try {
      if (window.VyoraAPI?.generatePlan) {
        try {
          const generated = await window.VyoraAPI.generatePlan(formPayload);
          applyGenerated(generated);
        } catch (e) {
          console.warn('API plan generate failed, using offline plan', e);
          const local = buildClientFallbackPlan(formPayload);
          applyGenerated({ id: local.id, plan: local, guest: true, persisted: false },
            'Server unavailable — showing an offline plan from your form inputs.');
        }
      } else {
        const local = buildClientFallbackPlan(formPayload);
        applyGenerated({ id: local.id, plan: local, guest: true, persisted: false },
          'Offline plan generated from your form inputs.');
      }
    } catch (e) {
      clearPlanResults();
      document.getElementById('rDietSummary').textContent =
        'Could not generate your plan: ' + (e.message || 'Unknown error');
    } finally {
      generateButton.disabled = false;
      generateButton.textContent = 'Generate my plan';
    }

    document.getElementById('planResults').scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Prototype uses plan.geminiReviewText (rule-based). Optional live chat only enhances if available.
    const aiStatus = document.getElementById('aiPlanStatus');
    const aiText = document.getElementById('aiPlanText');
    if (window.VyoraAPI?.chat && aiStatus && aiText) {
      const prompt = `Create a practical, safe starter fitness plan review. Profile: height ${h} cm, weight ${w} kg, age ${age}, gender ${gender}, goal ${goal}, diet preference ${diet}. Mention uncertainty on calorie estimates and advise clinician consultation for health conditions.`;
      window.VyoraAPI.chat(prompt, 'vyora')
        .then((answer) => {
          if (answer) {
            aiStatus.textContent = 'Gemini plan review (AI-generated general wellness guidance)';
            aiText.textContent = answer;
          }
        })
        .catch(() => {
          /* keep prototype rule-based review already shown */
        });
    }
  });
})();
