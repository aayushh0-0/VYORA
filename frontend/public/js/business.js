/**
 * For Business — campaigns + gyms directory + leaderboard + supplements + merch.
 * Safe DOM only. Demo catalogs labeled. No health PII shared with partners.
 */
(function () {
  const section = document.getElementById('business');
  if (!section) return;

  const catalog = window.VyoraBusinessCatalog || { gyms: [], supplementPicks: [], brands: [], merch: [] };
  const LOCAL_PLACES = 'vyora_saved_places_local';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function externalLink(href, label, cls) {
    const a = document.createElement('a');
    a.className = cls || 'btn ghost';
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = label;
    return a;
  }

  function mapsUrl(place) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.mapsQuery || place.name + ' ' + (place.city || ''));
  }

  function searchUrl(q) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }

  function imageUrl(seed) {
    return 'https://picsum.photos/seed/vyora' + seed + '/480/280';
  }

  /* ---------- Tabs ---------- */
  function showBizTab(name) {
    section.querySelectorAll('[data-biz-tab]').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-biz-tab') === name);
    });
    section.querySelectorAll('[data-biz-panel]').forEach(function (panel) {
      panel.classList.toggle('active', panel.getAttribute('data-biz-panel') === name);
    });
  }

  section.querySelectorAll('[data-biz-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showBizTab(btn.getAttribute('data-biz-tab'));
    });
  });

  /* ---------- Campaigns (existing behaviour) ---------- */
  const campList = document.getElementById('campList');
  const cAdd = document.getElementById('cAdd');
  let campStatus = document.getElementById('bizCampStatus');
  if (campList && !campStatus) {
    campStatus = el('p', 'bottom-note', '');
    campStatus.id = 'bizCampStatus';
    campStatus.setAttribute('aria-live', 'polite');
    campList.after(campStatus);
  }

  function addCampRow(c) {
    const row = el('div', 'camp-item');
    const info = el('div', '');
    const b = el('b', '', (c.name || '') + ' [Sponsored]');
    const a = c.analytics || { impressions: 0, clicks: 0, optIns: 0, redemptions: 0 };
    const meta = el(
      'span',
      '',
      (c.offer || '') +
        (c.date ? ' · until ' + c.date : '') +
        ' · ' +
        (c.status || '') +
        ' · Aggregate: ' +
        a.impressions +
        ' views, ' +
        a.clicks +
        ' clicks, ' +
        a.optIns +
        ' opt-ins, ' +
        a.redemptions +
        ' redemptions'
    );
    info.append(b, document.createElement('br'), meta);
    row.append(info);
    if (c.status !== 'completed') {
      const toggle = el('button', 'btn ghost', c.status === 'active' ? 'Pause' : 'Activate');
      toggle.type = 'button';
      toggle.addEventListener('click', async function () {
        try {
          await VyoraAPI.updateCampaign(c.id, { status: c.status === 'active' ? 'paused' : 'active' });
          await loadCampaigns();
        } catch (e) {
          if (campStatus) campStatus.textContent = e.message;
        }
      });
      row.append(toggle);
    }
    campList.append(row);
  }

  async function loadCampaigns() {
    if (!campList) return [];
    campList.replaceChildren();
    try {
      const list = await VyoraAPI.listCampaigns();
      if (!list.length) {
        campList.textContent = 'No campaigns yet — create your first campaign.';
        return [];
      }
      list.forEach(addCampRow);
      return list;
    } catch (e) {
      campList.textContent = 'Campaigns unavailable: ' + e.message;
      return [];
    }
  }

  if (cAdd) {
    cAdd.addEventListener('click', async function () {
      const name = document.getElementById('cName').value.trim();
      const offer = document.getElementById('cOffer').value.trim();
      const date = document.getElementById('cDate').value;
      if (!name || !offer) {
        if (campStatus) campStatus.textContent = 'Add a business/campaign name and offer.';
        return;
      }
      try {
        await VyoraAPI.createCampaign({ name, offer, date });
        document.getElementById('cName').value = '';
        document.getElementById('cOffer').value = '';
        document.getElementById('cDate').value = '';
        if (campStatus) {
          campStatus.textContent =
            'Campaign saved as draft (Aggregate analytics only; personal health records are never shared with partners).';
        }
        await loadCampaigns();
        renderLeaderboard();
      } catch (e) {
        if (campStatus) campStatus.textContent = e.message;
      }
    });
  }

  /* ---------- Gyms ---------- */
  let gymFilter = 'all';
  let detailGym = null;

  function userLocationHints() {
    const hints = [];
    try {
      const local = JSON.parse(localStorage.getItem(LOCAL_PLACES) || '[]');
      local.forEach(function (p) {
        if (p.address) hints.push(String(p.address).toLowerCase());
        if (p.name) hints.push(String(p.name).toLowerCase());
      });
    } catch (_) {}
    try {
      const planWrap = JSON.parse(localStorage.getItem('vyora_active_plan') || 'null');
      const plan = planWrap && (planWrap.plan || planWrap);
      if (plan && plan.location) hints.push(String(plan.location).toLowerCase());
    } catch (_) {}
    try {
      const loc = localStorage.getItem('vyora_last_place_query');
      if (loc) hints.push(loc.toLowerCase());
    } catch (_) {}
    return hints;
  }

  function scoreGym(g, hints) {
    let s = g.demoRating || 0;
    const blob = (g.city + ' ' + g.area + ' ' + g.name + ' ' + (g.tags || []).join(' ')).toLowerCase();
    hints.forEach(function (h) {
      if (!h) return;
      if (blob.indexOf(h) !== -1) s += 3;
      h.split(/[\s,]+/).forEach(function (tok) {
        if (tok.length > 3 && blob.indexOf(tok) !== -1) s += 1.2;
      });
    });
    return s;
  }

  async function saveGymPlace(g) {
    const payload = {
      name: g.name,
      category: 'gym',
      address: [g.area, g.city].filter(Boolean).join(', ')
    };
    try {
      if (window.VyoraAPI && VyoraAPI.savePlace) {
        await VyoraAPI.savePlace(payload);
        return 'Saved to your account locations.';
      }
    } catch (e) {
      /* fall through to local */
    }
    try {
      const list = JSON.parse(localStorage.getItem(LOCAL_PLACES) || '[]');
      list.unshift({
        id: 'local_' + Date.now(),
        name: payload.name,
        category: 'gym',
        address: payload.address,
        localOnly: true,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem(LOCAL_PLACES, JSON.stringify(list));
      return 'Saved on this device (sign in to sync to account).';
    } catch (_) {
      return 'Could not save place.';
    }
  }

  function gymCard(g, opts) {
    opts = opts || {};
    const card = el('article', 'biz-card');
    const media = el('div', 'biz-card-media');
    const img = document.createElement('img');
    img.src = imageUrl(g.imageSeed || 1);
    img.alt = '';
    img.loading = 'lazy';
    media.appendChild(img);
    card.appendChild(media);

    const body = el('div', 'biz-card-body');
    if (opts.badge) body.appendChild(el('span', 'biz-badge', opts.badge));
    body.appendChild(el('h3', '', g.name));
    body.appendChild(el('p', 'biz-meta', g.area + ', ' + g.city));
    body.appendChild(
      el('p', 'biz-meta', '★ ' + g.demoRating + ' · ' + g.demoReviewCount + ' reviews (demo rating)')
    );
    const tags = el('div', 'biz-tags');
    (g.tags || []).forEach(function (t) {
      tags.appendChild(el('span', 'biz-tag', t));
    });
    body.appendChild(tags);

    const actions = el('div', 'biz-actions');
    const openBtn = el('button', 'btn ghost', 'View profile');
    openBtn.type = 'button';
    openBtn.addEventListener('click', function () {
      openGymDetail(g);
    });
    actions.appendChild(openBtn);
    actions.appendChild(externalLink(mapsUrl(g), 'Directions ↗', 'btn ghost'));
    const saveBtn = el('button', 'btn', 'Save');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', async function () {
      const msg = await saveGymPlace(g);
      const status = document.getElementById('bizGymStatus');
      if (status) status.textContent = msg;
    });
    actions.appendChild(saveBtn);
    body.appendChild(actions);
    card.appendChild(body);
    return card;
  }

  function renderGyms() {
    const root = document.getElementById('bizGyms');
    if (!root) return;
    root.replaceChildren();
    root.appendChild(
      el(
        'p',
        'bottom-note',
        'Sample partner-style listings for UI demo — not live Google rankings. Always verify on Maps or the gym’s site.'
      )
    );

    const hints = userLocationHints();
    const ranked = catalog.gyms
      .slice()
      .map(function (g) {
        return { g: g, score: scoreGym(g, hints) };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    const suggest = el('div', 'biz-block');
    suggest.appendChild(el('h3', 'biz-heading', 'VYORA suggested for you'));
    if (!hints.length) {
      suggest.appendChild(
        el(
          'p',
          'bottom-note',
          'Add a city in Gyms & Cafés search or save a place to improve suggestions. Showing highly rated demo gyms for now.'
        )
      );
    }
    const suggestGrid = el('div', 'biz-grid');
    ranked.slice(0, 3).forEach(function (row, i) {
      suggestGrid.appendChild(gymCard(row.g, { badge: i === 0 ? 'Top match (demo)' : 'Suggested' }));
    });
    suggest.appendChild(suggestGrid);
    root.appendChild(suggest);

    const all = el('div', 'biz-block');
    all.appendChild(el('h3', 'biz-heading', 'Top gyms directory'));
    const chips = el('div', 'biz-chips');
    const cities = ['all'].concat(
      Array.from(
        new Set(
          catalog.gyms.map(function (g) {
            return g.city;
          })
        )
      )
    );
    cities.forEach(function (city) {
      const chip = el('button', city === gymFilter ? 'biz-chip active' : 'biz-chip', city === 'all' ? 'All cities' : city);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        gymFilter = city;
        renderGyms();
      });
      chips.appendChild(chip);
    });
    all.appendChild(chips);

    const grid = el('div', 'biz-grid');
    const filtered =
      gymFilter === 'all'
        ? catalog.gyms
        : catalog.gyms.filter(function (g) {
            return g.city === gymFilter;
          });
    if (!filtered.length) {
      grid.appendChild(el('p', 'bottom-note', 'No gyms in this filter.'));
    } else {
      filtered.forEach(function (g) {
        grid.appendChild(gymCard(g));
      });
    }
    all.appendChild(grid);
    const st = el('p', 'bottom-note', '');
    st.id = 'bizGymStatus';
    all.appendChild(st);
    root.appendChild(all);

    renderGymDetailHost();
  }

  function renderGymDetailHost() {
    let host = document.getElementById('bizGymDetail');
    if (!host) {
      host = el('div', 'biz-detail-host');
      host.id = 'bizGymDetail';
      host.hidden = true;
      const gyms = document.getElementById('bizGyms');
      if (gyms) gyms.appendChild(host);
    }
    if (!detailGym) {
      host.hidden = true;
      host.replaceChildren();
      return;
    }
    host.hidden = false;
    host.replaceChildren();
    const panel = el('div', 'biz-detail');
    const g = detailGym;
    const img = document.createElement('img');
    img.src = imageUrl(g.imageSeed || 1);
    img.alt = '';
    img.className = 'biz-detail-cover';
    panel.appendChild(img);
    panel.appendChild(el('h3', '', g.name));
    panel.appendChild(el('p', 'biz-meta', g.area + ', ' + g.city + ' · ★ ' + g.demoRating + ' (demo)'));
    panel.appendChild(el('p', '', g.about || ''));
    panel.appendChild(el('p', 'biz-meta', 'Hours: ' + (g.hours || '—')));
    if (g.amenities && g.amenities.length) {
      panel.appendChild(el('p', 'biz-meta', 'Amenities: ' + g.amenities.join(' · ')));
    }
    const actions = el('div', 'biz-actions');
    actions.appendChild(externalLink(mapsUrl(g), 'Get directions ↗', 'btn'));
    if (g.websiteUrl) actions.appendChild(externalLink(g.websiteUrl, 'Open website / search ↗', 'btn ghost'));
    const saveBtn = el('button', 'btn ghost', 'Save to my locations');
    saveBtn.type = 'button';
    saveBtn.addEventListener('click', async function () {
      const msg = await saveGymPlace(g);
      const note = el('p', 'bottom-note', msg);
      panel.appendChild(note);
    });
    const closeBtn = el('button', 'btn ghost', 'Close');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', function () {
      detailGym = null;
      renderGymDetailHost();
    });
    actions.append(saveBtn, closeBtn);
    panel.appendChild(actions);
    host.appendChild(panel);
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function openGymDetail(g) {
    detailGym = g;
    showBizTab('gyms');
    renderGymDetailHost();
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && detailGym) {
      detailGym = null;
      renderGymDetailHost();
    }
  });

  /* ---------- Leaderboard ---------- */
  let boardMode = 'rating';
  let campaignCache = [];

  async function renderLeaderboard() {
    const root = document.getElementById('bizLeaderboard');
    if (!root) return;
    root.replaceChildren();
    root.appendChild(
      el(
        'p',
        'bottom-note',
        'Marketing leaderboard for partner-style UI — not a public consumer ranking. Demo metrics unless a campaign is live on your account.'
      )
    );

    const chips = el('div', 'biz-chips');
    [
      ['rating', 'By demo rating'],
      ['campaign', 'By campaign activity']
    ].forEach(function (pair) {
      const chip = el('button', pair[0] === boardMode ? 'biz-chip active' : 'biz-chip', pair[1]);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        boardMode = pair[0];
        renderLeaderboard();
      });
      chips.appendChild(chip);
    });
    root.appendChild(chips);

    campaignCache = await loadCampaignsQuiet();

    const rows = catalog.gyms.map(function (g) {
      const camp = campaignCache.find(function (c) {
        return String(c.name || '').toLowerCase().indexOf(String(g.name).split(' ')[0].toLowerCase()) !== -1;
      });
      const engagement = camp && camp.analytics
        ? (camp.analytics.impressions || 0) + (camp.analytics.clicks || 0) * 3
        : Math.round((g.demoRating - 4) * 40 + (g.demoReviewCount || 0) * 0.2);
      return {
        name: g.name,
        category: (g.tags && g.tags[0]) || 'Gym',
        rating: g.demoRating,
        reviews: g.demoReviewCount,
        status: camp ? camp.status : 'None',
        engagement: engagement,
        gym: g
      };
    });

    rows.sort(function (a, b) {
      if (boardMode === 'campaign') return b.engagement - a.engagement;
      return b.rating - a.rating || b.reviews - a.reviews;
    });

    const podium = el('div', 'biz-podium');
    rows.slice(0, 3).forEach(function (r, i) {
      const card = el('div', 'biz-podium-card p' + i);
      card.appendChild(el('small', '', '0' + (i + 1)));
      card.appendChild(el('b', '', r.name));
      card.appendChild(
        el(
          'span',
          '',
          boardMode === 'campaign'
            ? 'Engagement score ' + r.engagement + ' (demo/account mix)'
            : '★ ' + r.rating + ' · ' + r.reviews + ' reviews (demo)'
        )
      );
      card.addEventListener('click', function () {
        openGymDetail(r.gym);
      });
      podium.appendChild(card);
    });
    root.appendChild(podium);

    const table = el('div', 'biz-table');
    const head = el('div', 'biz-table-row head');
    ['Rank', 'Business', 'Category', 'Demo ★', 'Campaign', 'Engagement'].forEach(function (h) {
      head.appendChild(el('div', '', h));
    });
    table.appendChild(head);
    rows.forEach(function (r, i) {
      const row = el('div', 'biz-table-row');
      row.appendChild(el('div', '', String(i + 1)));
      const nameCell = el('div', '');
      const nameBtn = el('button', 'biz-linkish', r.name);
      nameBtn.type = 'button';
      nameBtn.addEventListener('click', function () {
        openGymDetail(r.gym);
      });
      nameCell.appendChild(nameBtn);
      row.appendChild(nameCell);
      row.appendChild(el('div', '', r.category));
      row.appendChild(el('div', '', String(r.rating)));
      row.appendChild(el('div', '', r.status));
      row.appendChild(el('div', '', String(r.engagement)));
      table.appendChild(row);
    });
    root.appendChild(table);
  }

  async function loadCampaignsQuiet() {
    try {
      if (window.VyoraAPI && VyoraAPI.listCampaigns) return await VyoraAPI.listCampaigns();
    } catch (_) {}
    return [];
  }

  /* ---------- Supplements ---------- */
  function renderSupplements() {
    const root = document.getElementById('bizSupplements');
    if (!root) return;
    root.replaceChildren();

    const safety = el('div', 'biz-safety');
    safety.appendChild(
      el(
        'p',
        '',
        'Suggestions only — not prescriptions. Check with a doctor or qualified professional before using supplements, especially if pregnant, under 18, or on medication.'
      )
    );
    root.appendChild(safety);

    root.appendChild(el('h3', 'biz-heading', 'VYORA suggested (general)'));
    const pickGrid = el('div', 'biz-grid');
    catalog.supplementPicks.forEach(function (s) {
      const card = el('article', 'biz-card compact');
      const body = el('div', 'biz-card-body');
      body.appendChild(el('h3', '', s.name));
      body.appendChild(el('p', '', s.why));
      body.appendChild(externalLink(searchUrl(s.search), 'Search info ↗', 'btn ghost'));
      card.appendChild(body);
      pickGrid.appendChild(card);
    });
    root.appendChild(pickGrid);

    root.appendChild(el('h3', 'biz-heading', 'Popular premium brands (demo list)'));
    root.appendChild(
      el(
        'p',
        'bottom-note',
        'Marketing-style brand board — not a lab-measured “top 1%” ranking. Links open a web search so you can verify the official site.'
      )
    );

    let brandFilter = 'All';
    const cats = ['All'].concat(
      Array.from(
        new Set(
          catalog.brands.map(function (b) {
            return b.category;
          })
        )
      )
    );
    const chips = el('div', 'biz-chips');
    function paintBrands() {
      brandGrid.replaceChildren();
      catalog.brands
        .filter(function (b) {
          return brandFilter === 'All' || b.category === brandFilter;
        })
        .forEach(function (b) {
          const card = el('article', 'biz-card compact');
          const body = el('div', 'biz-card-body');
          body.appendChild(el('span', 'biz-badge', b.category));
          body.appendChild(el('h3', '', b.name));
          body.appendChild(el('p', 'biz-meta', b.note));
          body.appendChild(externalLink(searchUrl(b.search), 'Find official site ↗', 'btn ghost'));
          card.appendChild(body);
          brandGrid.appendChild(card);
        });
    }
    cats.forEach(function (c) {
      const chip = el('button', 'biz-chip', c);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        brandFilter = c;
        chips.querySelectorAll('.biz-chip').forEach(function (x) {
          x.classList.remove('active');
        });
        chip.classList.add('active');
        paintBrands();
      });
      if (c === 'All') chip.classList.add('active');
      chips.appendChild(chip);
    });
    root.appendChild(chips);
    const brandGrid = el('div', 'biz-grid');
    root.appendChild(brandGrid);
    paintBrands();
  }

  /* ---------- Merch ---------- */
  function renderMerch() {
    const root = document.getElementById('bizMerch');
    if (!root) return;
    root.replaceChildren();
    root.appendChild(
      el(
        'p',
        'bottom-note',
        'Independent product ideas — VYORA does not process payments for these items in this prototype. Search retailers to compare.'
      )
    );

    let filter = 'All';
    const cats = ['All'].concat(
      Array.from(
        new Set(
          catalog.merch.map(function (m) {
            return m.category;
          })
        )
      )
    );
    const chips = el('div', 'biz-chips');
    const grid = el('div', 'biz-grid');

    function paint() {
      grid.replaceChildren();
      catalog.merch
        .filter(function (m) {
          return filter === 'All' || m.category === filter;
        })
        .forEach(function (m) {
          const card = el('article', 'biz-card compact');
          const body = el('div', 'biz-card-body');
          body.appendChild(el('span', 'biz-badge', m.category));
          body.appendChild(el('h3', '', m.name));
          body.appendChild(el('p', '', m.blurb));
          body.appendChild(externalLink(searchUrl(m.search), 'Search retailers ↗', 'btn ghost'));
          card.appendChild(body);
          grid.appendChild(card);
        });
    }

    cats.forEach(function (c) {
      const chip = el('button', c === 'All' ? 'biz-chip active' : 'biz-chip', c);
      chip.type = 'button';
      chip.addEventListener('click', function () {
        filter = c;
        chips.querySelectorAll('.biz-chip').forEach(function (x) {
          x.classList.remove('active');
        });
        chip.classList.add('active');
        paint();
      });
      chips.appendChild(chip);
    });
    root.appendChild(chips);
    root.appendChild(grid);
    paint();
  }

  /* ---------- Boot ---------- */
  loadCampaigns();
  renderGyms();
  renderLeaderboard();
  renderSupplements();
  renderMerch();
  showBizTab('campaigns');

  window.VyoraBusiness = { showBizTab: showBizTab, renderGyms: renderGyms, renderLeaderboard: renderLeaderboard };
})();
