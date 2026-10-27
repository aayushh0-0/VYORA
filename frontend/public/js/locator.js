// Gyms & Cafés — manual save + area search (top listings + Google Maps) + multi-save
(function () {
  const section = document.getElementById('locator');
  const placeList = document.getElementById('placeList');
  if (!placeList || !section) return;

  const LOCAL_KEY = 'vyora_saved_places_local';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeLocal(list) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  }

  const intro = section.querySelector('.sub');
  if (intro) {
    intro.textContent =
      'Search an area for gyms and cafés (OpenStreetMap data), open directions in Google Maps, and save places you care about. Listings are not invented; always verify on the map.';
  }

  const filter = document.getElementById('placeFilter');
  if (filter) filter.style.display = 'none';

  // ---- Search card ----
  const searchCard = el('div', 'card');
  searchCard.style.marginBottom = '14px';
  const searchTitle = el('h3', '', 'Search gyms & cafés by area');
  searchTitle.style.marginTop = '0';
  searchCard.appendChild(searchTitle);
  searchCard.appendChild(
    el(
      'p',
      'bottom-note',
      'Enter a city or neighborhood (e.g. "Koramangala Bangalore"). Up to 10 named places from OpenStreetMap, each with a Google Maps directions link.'
    )
  );

  const searchGrid = el('div', 'grid cols-2');
  const areaField = el('div', 'field');
  const areaLabel = el('label', '', 'Place or area name');
  areaLabel.setAttribute('for', 'discoverPlaceQ');
  const areaInput = el('input');
  areaInput.id = 'discoverPlaceQ';
  areaInput.placeholder = 'e.g. Jaipur, Indiranagar Bengaluru';
  areaInput.autocomplete = 'address-level2';
  areaField.append(areaLabel, areaInput);

  const typeField = el('div', 'field');
  const typeLabel = el('label', '', 'Looking for');
  typeLabel.setAttribute('for', 'discoverPlaceType');
  const typeSelect = el('select');
  typeSelect.id = 'discoverPlaceType';
  [
    ['both', 'Gyms and cafés'],
    ['gym', 'Gyms only'],
    ['cafe', 'Cafés only']
  ].forEach(([val, label]) => {
    const opt = el('option', '', label);
    opt.value = val;
    typeSelect.appendChild(opt);
  });
  typeField.append(typeLabel, typeSelect);
  searchGrid.append(areaField, typeField);
  searchCard.appendChild(searchGrid);

  const searchActions = el('div', 'st-actions');
  searchActions.style.marginTop = '8px';
  const searchBtn = el('button', 'btn', 'Find top places');
  searchBtn.type = 'button';
  searchBtn.id = 'discoverSearchBtn';
  searchActions.appendChild(searchBtn);
  searchCard.appendChild(searchActions);

  const searchStatus = el('p', 'bottom-note', '');
  searchStatus.id = 'discoverStatus';
  searchStatus.setAttribute('aria-live', 'polite');
  searchCard.appendChild(searchStatus);

  const resultsBox = el('div', '');
  resultsBox.id = 'discoverResults';
  resultsBox.style.marginTop = '12px';
  searchCard.appendChild(resultsBox);

  section.insertBefore(searchCard, placeList);

  // ---- Manual save (kept) ----
  const form = el('div', 'card');
  form.style.marginBottom = '14px';
  const h3 = el('h3', '', 'Save a place manually');
  h3.style.marginTop = '0';
  form.appendChild(h3);
  form.appendChild(
    el('p', 'bottom-note', 'Add any gym, café, or stop by name if it was not in search results.')
  );

  const nameField = el('div', 'field');
  const nameLabel = el('label', '', 'Place name');
  nameLabel.setAttribute('for', 'savedPlaceName');
  const nameInput = el('input');
  nameInput.id = 'savedPlaceName';
  nameInput.placeholder = 'Gym, café, water refill or viewpoint';
  nameField.append(nameLabel, nameInput);

  const grid = el('div', 'grid cols-2');
  const catField = el('div', 'field');
  const catLabel = el('label', '', 'Category');
  catLabel.setAttribute('for', 'savedPlaceType');
  const catSelect = el('select');
  catSelect.id = 'savedPlaceType';
  [
    ['gym', 'Gym'],
    ['cafe', 'Café / food'],
    ['hydration', 'Hydration stop'],
    ['viewpoint', 'Viewpoint'],
    ['route', 'Route destination'],
    ['other', 'Other']
  ].forEach(([val, text]) => {
    const opt = el('option', '', text);
    opt.value = val;
    catSelect.appendChild(opt);
  });
  catField.append(catLabel, catSelect);

  const addrField = el('div', 'field');
  const addrLabel = el('label', '', 'Address or notes');
  addrLabel.setAttribute('for', 'savedPlaceAddress');
  const addrInput = el('input');
  addrInput.id = 'savedPlaceAddress';
  addrInput.placeholder = 'Area, address or route note';
  addrField.append(addrLabel, addrInput);
  grid.append(catField, addrField);

  const saveBtn = el('button', 'btn', 'Save place');
  saveBtn.id = 'savePlaceButton';
  saveBtn.type = 'button';
  const placeStatus = el('p', 'bottom-note', '');
  placeStatus.id = 'placeStatus';
  placeStatus.setAttribute('aria-live', 'polite');
  form.append(nameField, grid, saveBtn, placeStatus);
  section.insertBefore(form, placeList);

  // ---- Saved list heading ----
  const savedHead = el('h3', '', 'Your saved locations');
  savedHead.style.margin = '8px 0 12px';
  section.insertBefore(savedHead, placeList);

  let lastResults = [];

  function mapsLink(place) {
    if (place.mapsUrl) return place.mapsUrl;
    if (place.lat != null && place.lng != null) {
      return (
        'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(place.lat + ',' + place.lng)
      );
    }
    const q = [place.name, place.address].filter(Boolean).join(' ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q || 'gym');
  }

  function renderResults(payload) {
    resultsBox.replaceChildren();
    lastResults = Array.isArray(payload?.results) ? payload.results : [];

    if (payload?.message) {
      resultsBox.appendChild(el('p', 'bottom-note', payload.message));
    }

    if (payload?.mapsSearchUrl) {
      const openAll = document.createElement('a');
      openAll.className = 'plan-link';
      openAll.href = payload.mapsSearchUrl;
      openAll.target = '_blank';
      openAll.rel = 'noopener noreferrer';
      openAll.textContent = 'Open Google Maps search for this area ↗';
      resultsBox.appendChild(openAll);
    }

    if (!lastResults.length) return;

    const list = el('div', 'st-list');
    list.style.marginTop = '10px';

    lastResults.forEach((place, index) => {
      const row = el('div', 'st-list-row');
      row.style.alignItems = 'flex-start';

      const left = el('div', '');
      left.style.display = 'flex';
      left.style.gap = '10px';
      left.style.alignItems = 'flex-start';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'discover-check';
      cb.dataset.index = String(index);
      cb.setAttribute('aria-label', 'Select ' + (place.name || 'place'));
      left.appendChild(cb);

      const textWrap = el('div', '');
      textWrap.appendChild(el('b', '', place.name || 'Unnamed place'));
      textWrap.appendChild(
        el(
          'div',
          'st-muted',
          (place.category || 'place') + (place.address ? ' · ' + place.address : '')
        )
      );
      left.appendChild(textWrap);
      row.appendChild(left);

      const actions = el('div', '');
      actions.style.display = 'flex';
      actions.style.flexDirection = 'column';
      actions.style.gap = '6px';
      actions.style.alignItems = 'flex-end';

      const mapA = document.createElement('a');
      mapA.className = 'btn ghost';
      mapA.href = mapsLink(place);
      mapA.target = '_blank';
      mapA.rel = 'noopener noreferrer';
      mapA.textContent = 'Directions ↗';
      mapA.style.fontSize = '12px';
      mapA.style.textDecoration = 'none';

      const saveOne = el('button', 'btn ghost', 'Save');
      saveOne.type = 'button';
      saveOne.style.fontSize = '12px';
      saveOne.addEventListener('click', function () {
        savePlaces([place]);
      });

      actions.append(mapA, saveOne);
      row.appendChild(actions);
      list.appendChild(row);
    });
    resultsBox.appendChild(list);

    const multi = el('div', 'st-actions');
    multi.style.marginTop = '12px';
    const saveSelected = el('button', 'btn', 'Save selected to my locations');
    saveSelected.type = 'button';
    saveSelected.addEventListener('click', function () {
      const selected = [];
      resultsBox.querySelectorAll('.discover-check:checked').forEach(function (cb) {
        const i = Number(cb.dataset.index);
        if (lastResults[i]) selected.push(lastResults[i]);
      });
      if (!selected.length) {
        searchStatus.textContent = 'Select one or more places first.';
        return;
      }
      savePlaces(selected);
    });
    const saveAll = el('button', 'btn ghost', 'Save all results');
    saveAll.type = 'button';
    saveAll.addEventListener('click', function () {
      if (!lastResults.length) return;
      savePlaces(lastResults.slice());
    });
    multi.append(saveSelected, saveAll);
    resultsBox.appendChild(multi);
  }

  async function savePlaces(places) {
    if (!places.length) return;
    let saved = 0;
    let lastErr = '';
    for (const place of places) {
      const payload = {
        name: place.name,
        category: place.category === 'cafe' ? 'cafe' : place.category === 'gym' ? 'gym' : place.category || 'other',
        address: place.address || '',
        lat: place.lat != null ? place.lat : undefined,
        lng: place.lng != null ? place.lng : undefined
      };
      try {
        if (window.VyoraAPI?.savePlace) {
          await window.VyoraAPI.savePlace(payload);
          saved += 1;
        } else {
          throw new Error('no api');
        }
      } catch (e) {
        lastErr = e.message || String(e);
        const local = readLocal();
        local.unshift({
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          ...payload,
          createdAt: new Date().toISOString(),
          localOnly: true
        });
        writeLocal(local);
        saved += 1;
      }
    }
    searchStatus.textContent =
      saved +
      ' place(s) saved.' +
      (lastErr && lastErr !== 'no api' ? ' (Some used on-device storage: ' + lastErr + ')' : '');
    placeStatus.textContent = searchStatus.textContent;
    await loadSaved();
  }

  searchBtn.addEventListener('click', async function () {
    const q = areaInput.value.trim();
    if (q.length < 2) {
      searchStatus.textContent = 'Enter a place or area name.';
      return;
    }
    searchStatus.textContent = 'Searching nearby listings…';
    resultsBox.replaceChildren();
    searchBtn.disabled = true;
    try {
      let payload;
      if (window.VyoraAPI?.discoverPlaces) {
        payload = await window.VyoraAPI.discoverPlaces(q, typeSelect.value);
      } else {
        const res = await fetch(
          '/api/places/discover?q=' +
            encodeURIComponent(q) +
            '&type=' +
            encodeURIComponent(typeSelect.value) +
            '&limit=10'
        );
        payload = await res.json();
        if (!res.ok) throw new Error(payload.error || res.statusText);
      }
      searchStatus.textContent = payload.results?.length
        ? 'Found ' + payload.results.length + ' place(s).'
        : payload.message || 'No results.';
      renderResults(payload);
    } catch (e) {
      searchStatus.textContent = e.message || 'Search failed.';
      const fallbackUrl =
        'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(typeSelect.value === 'cafe' ? 'cafes near ' + q : typeSelect.value === 'gym' ? 'gyms near ' + q : 'gyms and cafes near ' + q);
      resultsBox.replaceChildren();
      const a = document.createElement('a');
      a.className = 'plan-link';
      a.href = fallbackUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Open Google Maps search instead ↗';
      resultsBox.appendChild(a);
    } finally {
      searchBtn.disabled = false;
    }
  });

  areaInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  function card(p) {
    const c = el('article', 'card place-card show');
    c.dataset.type = p.category;
    c.appendChild(el('h3', '', p.name));
    c.appendChild(
      el('p', '', (p.category || '') + (p.address ? ' · ' + p.address : '') + (p.localOnly ? ' · on this device' : ''))
    );
    const row = el('div', 'st-actions');
    const mapA = document.createElement('a');
    mapA.className = 'btn ghost';
    mapA.href = mapsLink(p);
    mapA.target = '_blank';
    mapA.rel = 'noopener noreferrer';
    mapA.textContent = 'Maps ↗';
    const del = el('button', 'btn ghost', 'Remove');
    del.type = 'button';
    del.addEventListener('click', async function () {
      try {
        if (p.localOnly || String(p.id).startsWith('local_')) {
          writeLocal(readLocal().filter((x) => x.id !== p.id));
        } else if (window.VyoraAPI?.deletePlace) {
          await window.VyoraAPI.deletePlace(p.id);
        }
        await loadSaved();
      } catch (e) {
        placeStatus.textContent = e.message;
      }
    });
    row.append(mapA, del);
    c.appendChild(row);
    return c;
  }

  async function loadSaved() {
    placeList.replaceChildren();
    let places = [];
    try {
      if (window.VyoraAPI?.listPlaces) {
        places = await window.VyoraAPI.listPlaces();
      }
    } catch (e) {
      placeStatus.textContent = e.message;
    }
    const local = readLocal();
    const merged = places.concat(local);
    if (!merged.length) {
      placeList.appendChild(el('p', 'bottom-note', 'No saved places yet. Search above or add one manually.'));
      return;
    }
    merged.forEach(function (p) {
      placeList.appendChild(card(p));
    });
  }

  saveBtn.addEventListener('click', async function () {
    const name = nameInput.value.trim();
    const category = catSelect.value;
    const address = addrInput.value.trim();
    if (!name) {
      placeStatus.textContent = 'Enter a place name.';
      return;
    }
    try {
      await savePlaces([{ name, category, address }]);
      nameInput.value = '';
      addrInput.value = '';
      placeStatus.textContent = 'Place saved.';
    } catch (e) {
      placeStatus.textContent = e.message;
    }
  });

  loadSaved();
})();
