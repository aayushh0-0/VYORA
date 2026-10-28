/**
 * Community — VYORA LinkedIn-style feed (scoped to #community).
 * Hubs, composer, seeded posts, light local campaigns. Safe DOM.
 */
(function () {
  const section = document.getElementById('community');
  const list = document.getElementById('postList');
  if (!section || !list) return;

  const LOCAL_KEY = 'vyora_community_local_posts';
  const VOTES_KEY = 'vyora_community_votes';
  const CAMP_KEY = 'vyora_community_campaigns_local';
  const status = document.getElementById('postStatus');
  const createStatus = document.getElementById('postCreateStatus');
  let activeHub = 'all';
  let me = { id: null, name: 'You' };

  const AUTHORS = [
    'IronJunkie99', 'PriyaLifts', 'MilesOnMiles', 'FormFirst', 'SanaStrength',
    'KettleBellKay', 'RestDayRex', 'MacroMaven', 'HyroxHari', 'ZenLift'
  ];
  const HUBS = ['Powerlifting', 'NutritionHacks', 'MarathonPrep', 'Hypertrophy', 'Mobility'];
  const TITLES = [
    'Finally hit the 405lb deadlift!',
    'Easy 10k at conversational pace',
    'Protein idea: dal + eggs + rice',
    'Mobility block that unlocked my squat',
    'PR on bench — paused reps paid off',
    'Week 3 of marathon base done',
    'Sleep debt is real — took a deload',
    'Hypertrophy: slow eccentrics today',
    'Skipped the junk volume, kept the quality',
    'First double bodyweight deadlift attempt'
  ];
  const BODIES = [
    'Been grinding for months to break this plateau. Form broke a bit at the top, but we take those.',
    'Kept HR in zone 2 the whole time. Consistency beats hero sessions.',
    'Simple meals beat perfect macros I never cook.',
    '10 minutes before lifting changed everything.',
    'Logged every set. Progressive overload is boring until it is not.',
    'Long run felt smooth. Fueling with banana + electrolytes at mile 6.',
    'Ego wanted to push; recovery said no. Listening early is a win.',
    '3×12 controlled. Pump without joint noise — that is the goal.',
    'Cut the random accessories. Main lifts moved better.',
    'Not there yet, but the attempt taught me bracing under fatigue.'
  ];
  const IMAGES = [
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=900&q=80',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=900&q=80',
    'https://images.unsplash.com/photo-1434682881908-b43d0467b798?w=900&q=80',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=80',
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=900&q=80',
    'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=900&q=80'
  ];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedPosts() {
    const rand = mulberry32(20261028);
    const posts = [];
    for (let i = 0; i < 12; i++) {
      const hub = HUBS[Math.floor(rand() * HUBS.length)];
      posts.push({
        id: 'proto_' + i,
        userId: 'proto_u_' + i,
        authorName: AUTHORS[Math.floor(rand() * AUTHORS.length)],
        type: 'workout',
        hub: hub,
        title: TITLES[Math.floor(rand() * TITLES.length)],
        body: BODIES[Math.floor(rand() * BODIES.length)],
        mediaUrl: rand() > 0.3 ? IMAGES[Math.floor(rand() * IMAGES.length)] : '',
        likes: Math.floor(rand() * 400) + 12,
        comments: Math.floor(rand() * 60) + 1,
        createdAt: new Date(Date.now() - Math.floor(rand() * 72) * 3600e3).toISOString(),
        demo: true
      });
    }
    return posts;
  }

  function votesMap() {
    try {
      return JSON.parse(localStorage.getItem(VOTES_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function setVote(id, dir) {
    const m = votesMap();
    if (m[id] === dir) delete m[id];
    else m[id] = dir;
    localStorage.setItem(VOTES_KEY, JSON.stringify(m));
  }

  function localPosts() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveLocal(p) {
    const all = localPosts();
    all.unshift(p);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(all.slice(0, 40)));
  }

  function timeAgo(iso) {
    const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' minutes ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const d = Math.floor(h / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }

  function postCard(p) {
    const card = el('article', 'com-post');
    const head = el('div', 'com-post-head');
    head.appendChild(el('div', 'com-av', (p.authorName || '?').charAt(0).toUpperCase()));
    const meta = el('div', 'com-post-meta');
    meta.appendChild(el('strong', '', p.authorName || 'Member'));
    const sub = el('div', 'com-post-sub');
    sub.appendChild(document.createTextNode(timeAgo(p.createdAt) + ' · '));
    sub.appendChild(el('span', 'com-tag', '#' + (p.hub || p.type || 'General')));
    meta.appendChild(sub);
    head.appendChild(meta);
    card.appendChild(head);

    card.appendChild(el('h3', 'com-post-title', p.title || 'Update'));
    card.appendChild(el('p', 'com-post-body', p.body || ''));

    if (p.mediaUrl) {
      const fig = el('div', 'com-post-media');
      const img = document.createElement('img');
      img.src = p.mediaUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      fig.appendChild(img);
      card.appendChild(fig);
    }

    const votes = votesMap();
    let score = p.likes || 0;
    if (votes[p.id] === 'up') score += 1;
    if (votes[p.id] === 'down') score = Math.max(0, score - 1);

    const foot = el('div', 'com-post-foot');
    const vote = el('div', 'com-vote');
    const up = el('button', 'com-icon-btn', '↑');
    up.type = 'button';
    if (votes[p.id] === 'up') up.classList.add('on');
    const scoreEl = el('span', '', String(score));
    const down = el('button', 'com-icon-btn', '↓');
    down.type = 'button';
    if (votes[p.id] === 'down') down.classList.add('on');
    up.addEventListener('click', function () {
      setVote(p.id, 'up');
      loadFeed();
    });
    down.addEventListener('click', function () {
      setVote(p.id, 'down');
      loadFeed();
    });
    vote.append(up, scoreEl, down);
    foot.appendChild(vote);

    const cbtn = el('button', 'com-text-btn', '💬 ' + (p.comments || 0) + ' Comments');
    cbtn.type = 'button';
    const commentPanel = el('div', 'com-comment-panel');
    commentPanel.hidden = true;
    cbtn.addEventListener('click', function () {
      commentPanel.hidden = !commentPanel.hidden;
    });
    foot.appendChild(cbtn);

    const share = el('button', 'com-icon-btn', '↗');
    share.type = 'button';
    share.title = 'Share';
    share.addEventListener('click', async function () {
      const text = (p.title || '') + ' — via VYORA Community';
      try {
        if (navigator.share) await navigator.share({ title: p.title, text: text });
        else {
          await navigator.clipboard.writeText(text);
          if (status) status.textContent = 'Copied to clipboard.';
        }
      } catch (_) {}
    });
    foot.appendChild(share);
    card.appendChild(foot);

    const form = el('div', 'com-comment-form');
    const input = document.createElement('input');
    input.placeholder = 'Add a comment…';
    input.maxLength = 400;
    const send = el('button', 'com-text-btn', 'Post');
    send.type = 'button';
    send.addEventListener('click', async function () {
      const body = input.value.trim();
      if (!body) return;
      try {
        if (p.demo || String(p.id).indexOf('local_') === 0 || String(p.id).indexOf('proto_') === 0) {
          p.comments = (p.comments || 0) + 1;
          input.value = '';
          cbtn.textContent = '💬 ' + p.comments + ' Comments';
          const row = el('div', 'com-comment-row');
          row.appendChild(el('strong', '', me.name || 'You'));
          row.appendChild(el('span', '', body));
          commentPanel.insertBefore(row, form);
          return;
        }
        await VyoraAPI.commentPost(p.id, body);
        input.value = '';
        await loadFeed();
      } catch (e) {
        if (status) status.textContent = e.message;
      }
    });
    form.append(input, send);
    commentPanel.appendChild(form);
    card.appendChild(commentPanel);
    return card;
  }

  async function loadFeed() {
    list.replaceChildren();
    let apiPosts = [];
    try {
      me = await VyoraAPI.me();
    } catch (_) {
      me = { id: null, name: 'You' };
    }
    try {
      apiPosts = await VyoraAPI.listPosts();
    } catch (_) {
      apiPosts = [];
    }
    let posts = [].concat(localPosts(), apiPosts, seedPosts());
    const seen = new Set();
    posts = posts.filter(function (p) {
      if (!p || !p.id || seen.has(p.id)) return false;
      seen.add(p.id);
      if (activeHub !== 'all' && (p.hub || '') !== activeHub) return false;
      return true;
    });
    posts.sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    if (!posts.length) {
      list.appendChild(el('p', 'bottom-note', 'No posts in this hub yet.'));
      return;
    }
    posts.forEach(function (p) {
      list.appendChild(postCard(p));
    });
  }

  section.querySelectorAll('[data-hub]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeHub = btn.getAttribute('data-hub') || 'all';
      section.querySelectorAll('[data-hub]').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      loadFeed();
    });
  });

  function publish(title, body, type, hub, mediaUrl) {
    return (async function () {
      try {
        await VyoraAPI.createPost({ title: title, body: body, type: type || 'workout', mediaUrl: mediaUrl || '' });
        if (createStatus) createStatus.textContent = 'Published.';
        if (status) status.textContent = 'Published.';
      } catch (e) {
        saveLocal({
          id: 'local_' + Date.now(),
          userId: me.id || 'local',
          authorName: me.name || me.displayName || 'You',
          type: type || 'workout',
          hub: hub || 'Hypertrophy',
          title: title,
          body: body,
          mediaUrl: mediaUrl || '',
          likes: 1,
          comments: 0,
          createdAt: new Date().toISOString()
        });
        if (createStatus) createStatus.textContent = 'Saved on this device.';
        if (status) status.textContent = 'Saved on this device.';
      }
      await loadFeed();
    })();
  }

  document.getElementById('comQuickPost')?.addEventListener('click', function () {
    const input = document.getElementById('comQuickInput');
    const text = (input && input.value.trim()) || '';
    if (!text) {
      if (status) status.textContent = 'Write something to share.';
      return;
    }
    const title = text.length > 60 ? text.slice(0, 57) + '…' : text;
    publish(title, text, 'workout', activeHub === 'all' ? 'Hypertrophy' : activeHub, '');
    if (input) input.value = '';
  });

  document.getElementById('comQuickInput')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('comQuickPost')?.click();
  });

  document.getElementById('postPublish')?.addEventListener('click', function () {
    const title = document.getElementById('postTitle').value.trim();
    const body = document.getElementById('postBody').value.trim();
    const type = document.getElementById('postType').value;
    const hub = document.getElementById('postHub').value;
    const mediaUrl = document.getElementById('postMedia').value.trim();
    if (!title || !body) {
      if (createStatus) createStatus.textContent = 'Title and body required.';
      return;
    }
    publish(title, body, type, hub, mediaUrl).then(function () {
      document.getElementById('postTitle').value = '';
      document.getElementById('postBody').value = '';
      document.getElementById('postMedia').value = '';
    });
  });

  function loadCamps() {
    const root = document.getElementById('comCampList');
    if (!root) return;
    root.replaceChildren();
    let camps = [];
    try {
      camps = JSON.parse(localStorage.getItem(CAMP_KEY) || '[]');
    } catch (_) {}
    if (!camps.length) {
      root.appendChild(el('p', 'bottom-note', 'No personal campaigns yet.'));
      return;
    }
    camps.forEach(function (c) {
      const row = el('div', 'com-camp-row');
      row.appendChild(el('b', '', c.title));
      if (c.goal) row.appendChild(el('span', '', c.goal));
      const del = el('button', 'btn ghost', 'Remove');
      del.type = 'button';
      del.addEventListener('click', function () {
        const next = camps.filter(function (x) {
          return x.id !== c.id;
        });
        localStorage.setItem(CAMP_KEY, JSON.stringify(next));
        loadCamps();
      });
      row.appendChild(del);
      root.appendChild(row);
    });
  }

  document.getElementById('comCampLaunch')?.addEventListener('click', function () {
    const title = (document.getElementById('comCampTitle') || {}).value || '';
    const goal = (document.getElementById('comCampGoal') || {}).value || '';
    const st = document.getElementById('comCampStatus');
    if (!title.trim()) {
      if (st) st.textContent = 'Add a campaign title.';
      return;
    }
    let camps = [];
    try {
      camps = JSON.parse(localStorage.getItem(CAMP_KEY) || '[]');
    } catch (_) {}
    camps.unshift({
      id: 'camp_' + Date.now(),
      title: title.trim(),
      goal: goal.trim(),
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(CAMP_KEY, JSON.stringify(camps.slice(0, 10)));
    document.getElementById('comCampTitle').value = '';
    document.getElementById('comCampGoal').value = '';
    if (st) st.textContent = 'Campaign saved on this device (prototype).';
    loadCamps();
  });

  loadCamps();
  loadFeed();
})();
