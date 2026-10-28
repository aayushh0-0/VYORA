/*! VYORA orb — dependency-free. API: VyoraOrb.create(el,opts) -> {setState,getState,setAudioLevel,setReducedMotion,destroy}
 *  The ribbon is ~47 thin strokes along a twisting 3D band, projected to 2D each frame (real 3D maths, SVG output). */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2, N = 22, M = 120, C = 500, R = 330, uid = 0;
  var HL = [11, 8, 6]; // strand counts: pink, orange, gold
  var STATES = {
    idle:       { glow: .85, spd: 2.6, rot: 2.8, orbit: .35, breath: .25 },
    listening:  { glow: .9,  spd: 2.8, rot: 2.6, orbit: .4, breath: .55 },
    thinking:   { glow: .95, spd: 3.0, rot: 2.9, orbit: .6, breath: .35 },
    responding: { glow: 1,   spd: 3.4, rot: 3.2, orbit: .45, breath: .8 }
  };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function g(a, c, s) { var d = Math.atan2(Math.sin(a - c), Math.cos(a - c)); return Math.exp(-d * d / (s * s)); }

  // Point on the ribbon: th = angle round the ring, u = 0..1 across the band.
  function geo(th, u, t) {
    /* Stable circular ring — avoids collapsing into a thin oval edge-on */
    var a1 = -1.0 + .2 * Math.sin(t * .4);
    var a2 = 1.6 + .18 * Math.sin(t * .33 + 1.5);
    var w = .07 + .03 * g(th, a1, .6) + .04 * g(th, a2, .55);
    w *= 1 + .04 * Math.sin(th * 2 + t * .6);
    var r = 1 + .02 * Math.sin(2 * th + t * .5);
    var ph = .55 + .08 * Math.sin(th + t * .35); /* keep band facing camera-ish */
    var s = (u - .5) * w;
    var rr = r + s * Math.cos(ph) * .35;
    var z = s * Math.sin(ph) * .55 + .02 * Math.sin(2 * th + t * .3);
    return [rr * Math.cos(th), rr * Math.sin(th), z];
  }

  // Build every path 'd' plus the 3 highlight gradient axes for time t and params P.
  function build(t, P) {
    var cy = Math.cos(P.yaw), sy = Math.sin(P.yaw), cp = Math.cos(P.pitch), sp = Math.sin(P.pitch), cr = Math.cos(P.roll), sr = Math.sin(P.roll);
    function T(th, u) {
      var p = geo(th, u, t), x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
      var y2 = p[1] * cp - z * sp, z2 = p[1] * sp + z * cp, k = 1 / (1 - z2 * .45) * R * P.sc;
      return [C + P.ox + (x * cr - y2 * sr) * k, C + P.oy + (x * sr + y2 * cr) * k];
    }
    function line(u, a, b, n) {
      var s = '', i, q, f, l;
      for (i = 0; i <= n; i++) { q = T(a + (b - a) * i / n, u); if (!i) f = q; l = q; s += (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
      return { d: s, f: f, l: l };
    }
    var d = [], gr = [], i, j, L, mid;
    for (j = 0; j < N; j++) d.push(line(j / (N - 1), 0, TAU, M).d);
    [[P.pk, P.pks], [P.og, P.ogs], [P.gd, P.gds]].forEach(function (h, n) {
      var cnt = HL[n];
      for (i = 0; i < cnt; i++) {
        L = line(.1 + .8 * i / (cnt - 1), h[0] - h[1] / 2, h[0] + h[1] / 2, 40); d.push(L.d);
        if (i === cnt >> 1) mid = L;
      }
      gr.push([mid.f[0], mid.f[1], mid.l[0], mid.l[1]]);
    });
    return { d: d, gr: gr };
  }

  var DEF = { yaw: .2, pitch: .08, roll: -.1, sc: 1, ox: 0, oy: 0, pk: -1.6, pks: 1.5, og: 1.55, ogs: 1.6, gd: 1.5, gds: .8 };
  function lg(id, c, p) {
    return '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">' +
      '<stop offset="0" stop-color="' + c[0] + '" stop-opacity="0"/><stop offset=".5" stop-color="' + c[1] + '"/><stop offset="1" stop-color="' + c[0] + '" stop-opacity="0"/></linearGradient>';
  }
  // Full SVG markup (static frame). Used by create() and by export-svg.js.
  function svg(t, P, id) {
    P = P || DEF; id = id || 'vo'; var b = build(t, P), k = 0, out = [];
    function grp(name, n, stroke, w, op) {
      var s = '<g id="' + id + '-' + name + '" stroke="' + stroke + '" stroke-width="' + w + '" opacity="' + op + '">';
      for (var i = 0; i < n; i++) s += '<path d="' + b.d[k++] + '"/>';
      return s + '</g>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" role="img" aria-label="VYORA orb"><defs>' +
      '<linearGradient id="' + id + '-gb" gradientUnits="userSpaceOnUse" x1="150" y1="150" x2="850" y2="850"><stop offset="0" stop-color="#FF1738"/><stop offset=".5" stop-color="#D00F31"/><stop offset="1" stop-color="#FF1738"/></linearGradient>' +
      lg(id + '-gp', ['#FF167F', '#FF5A8F']) + lg(id + '-go', ['#FF5A24', '#FF7A30']) + lg(id + '-gg', ['#FF5A24', '#FFC04A']) +
      '<filter id="' + id + '-bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter></defs>' +
      '<g id="' + id + '-glow" filter="url(#' + id + '-bloom)" opacity=".75"><use href="#' + id + '-ribbon"/></g>' +
      '<g id="' + id + '-ribbon" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9">' +
      grp('base', N, 'url(#' + id + '-gb)', 1.1, .9) + grp('pink', HL[0], 'url(#' + id + '-gp)', 1.2, .8) +
      grp('orange', HL[1], 'url(#' + id + '-go)', 1.2, .7) + grp('gold', HL[2], 'url(#' + id + '-gg)', 1.1, .8) + '</g></svg>';
  }

  function create(el, opts) {
    opts = opts || {};
    var id = 'vo' + (++uid), mq = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = opts.reducedMotion != null ? !!opts.reducedMotion : !!(mq && mq.matches);
    var state = 'idle', tgt = STATES.idle, S = { glow: .5, spd: 1, rot: 1, orbit: 0, breath: 0 };
    var t = Math.random() * 40, bph = 0, spin = 0, pulse = 0, pv = 0, aIn = 0, aS = 0, aStamp = -1e9;
    var raf = 0, last = 0, dead = false, ro = null;
    el.innerHTML = svg(0, DEF, id);
    var $ = function (n) { return el.querySelector('#' + id + '-' + n); };
    var paths = el.querySelectorAll('#' + id + '-ribbon path'), ribbon = $('ribbon'), glow = $('glow');
    var grp = { pink: $('pink'), orange: $('orange'), gold: $('gold'), base: $('base') };
    var grads = ['gp', 'go', 'gg'].map($);

    function size() {
      var s = el.clientWidth || 512, sw = Math.max(1, 900 / s);
      grp.base.setAttribute('stroke-width', (1.1 * sw).toFixed(2));
      ['pink', 'orange', 'gold'].forEach(function (n) { grp[n].setAttribute('stroke-width', (1.2 * sw).toFixed(2)); });
      glow.style.display = s < 140 ? 'none' : ''; // drop bloom at tiny sizes
    }
    function tick(now) {
      raf = requestAnimationFrame(tick);
      var dt = Math.min(.05, (now - last) / 1000 || .016), k = 1 - Math.exp(-dt / .8), key, rm = reduced ? .15 : 1;
      last = now;
      for (key in S) S[key] += (tgt[key] - S[key]) * k;
      t += dt * S.spd * rm; spin += dt * S.orbit * .9 * rm; bph += dt * (.45 + .5 * S.breath) * rm;
      pulse *= Math.exp(-dt / .9); pv += (pulse - pv) * (1 - Math.exp(-dt / .25));
      var aT = now - aStamp < 500 ? aIn : state === 'responding' ? .3 + .2 * Math.sin(t * 2.3) * Math.sin(t * .9) : state === 'listening' ? .2 * (.5 + .5 * Math.sin(t * 1.7)) : 0;
      aS += (aT - aS) * (1 - Math.exp(-dt / (aT > aS ? .08 : .4)));
      var rot = S.rot * (reduced ? .2 : 1), br = Math.sin(bph);
      var P = {
        yaw: .25 * rot * Math.sin(t * .14) + .12 * rot * Math.sin(t * .09 + 1), pitch: .08 * rot * Math.sin(t * .11 + .5) + .04, roll: .12 * rot * Math.sin(t * .08 + 2),
        sc: 1 + (.012 + .014 * S.breath) * br + aS * .035 + pv * .05, ox: 14 * rm * Math.sin(t * .05), oy: 10 * rm * Math.sin(t * .043 + 1),
        pk: -1.9 + 1.3 * (.5 + .5 * Math.sin(t * .35)) + spin, pks: 1.3 + .5 * S.orbit,
        og: 1.45 + .28 * Math.sin(t * .17 + 2) + .3 * Math.sin(t * .4), ogs: 1.5, gd: 1.5 + .4 * Math.sin(t * .31), gds: .8
      };
      var b = build(t, P), i;
      for (i = 0; i < paths.length; i++) paths[i].setAttribute('d', b.d[i]);
      grads.forEach(function (gd, n) { gd.setAttribute('x1', b.gr[n][0].toFixed(1)); gd.setAttribute('y1', b.gr[n][1].toFixed(1)); gd.setAttribute('x2', b.gr[n][2].toFixed(1)); gd.setAttribute('y2', b.gr[n][3].toFixed(1)); });
      grp.pink.setAttribute('opacity', clamp(.35 + .45 * (.5 + .5 * Math.sin(t * .22)) + .2 * S.glow + .3 * S.orbit, 0, 1).toFixed(2));
      grp.orange.setAttribute('opacity', clamp(.45 + .3 * Math.sin(t * .3 + 1) + .25 * S.glow, 0, 1).toFixed(2));
      grp.gold.setAttribute('opacity', clamp(.3 + .4 * (.5 + .5 * Math.sin(t * .41)) + .3 * S.glow, 0, 1).toFixed(2));
      ribbon.setAttribute('opacity', (.78 + .22 * S.glow).toFixed(2));
      glow.setAttribute('opacity', clamp(.12 + .5 * S.glow * (1 + aS * .3) + .06 * br, 0, 1).toFixed(2));
    }
    function start() { if (!raf && !dead) { last = 0; raf = requestAnimationFrame(tick); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    function vis() { document.hidden ? stop() : start(); }
    function onMq(e) { if (opts.reducedMotion == null) reduced = e.matches; }
    document.addEventListener('visibilitychange', vis);
    if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
    if (root.ResizeObserver) { ro = new ResizeObserver(size); ro.observe(el); } size();
    start();

    return {
      setState: function (s) {
        if (dead || !STATES[s]) { if (!dead && root.console) console.warn('VyoraOrb: unknown state "' + s + '"'); return false; }
        if (s === state) return true;
        state = s; tgt = STATES[s];
        if (!reduced && (s === 'responding' || s === 'listening')) pulse = s === 'responding' ? 1 : .6;
        if (opts.onState) opts.onState(s);
        return true;
      },
      getState: function () { return state; },
      setAudioLevel: function (v) { if (dead) return; v = +v; if (isNaN(v)) return; aIn = clamp(v, 0, 1); aStamp = performance.now(); },
      setReducedMotion: function (b) { opts.reducedMotion = !!b; reduced = !!b; },
      destroy: function () {
        if (dead) return; dead = true; stop();
        document.removeEventListener('visibilitychange', vis);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
        if (ro) ro.disconnect();
      }
    };
  }

  var api = { create: create, svgMarkup: function (t) { return svg(t == null ? 3 : t, DEF, 'vo'); }, states: Object.keys(STATES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VyoraOrb = api;
})(typeof window !== 'undefined' ? window : globalThis);
