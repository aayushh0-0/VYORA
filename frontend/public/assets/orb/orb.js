/*! VYORA orb — WebGL2 port of the React Bits <Orb />, dependency-free (no React).
 *  API (unchanged): VyoraOrb.create(el, opts) -> { setState, getState, setAudioLevel, setReducedMotion, destroy }
 *  States: idle | listening | thinking | responding. Extra opts: any Orb prop (colors, hue, glow, trail, ...). */
(function (root) {
  'use strict';
  var INTRO_SECONDS = 1.1, FOCAL = 3.2, uid = 0;
  var VERTEX = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;
  var FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uRotation;
uniform vec2 uReach;
uniform float uNear;
uniform float uAwake;
uniform vec3 uBackground;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform float uScale;
uniform float uWobble;
uniform float uGlow;
uniform float uBleed;
uniform float uHighlight;
uniform float uSwirl;
uniform float uOrbit;
uniform vec2 uEcho;
uniform float uReveal;
uniform float uOpacity;
uniform float uTrail;
uniform vec2 uTilt;
out vec4 outColor;

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(p3.x + p3.y, p3.x + p3.z, p3.y + p3.z) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)), 0.0);
  vec4 n = h * h * h * h * vec4(dot(d0, hash33(i)), dot(d1, hash33(i + i1)), dot(d2, hash33(i + i2)), dot(d3, hash33(i + 1.0)));
  return dot(vec4(31.316), n);
}

float light1(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * attenuation);
}

float light2(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * dist * attenuation);
}

vec4 draw(vec2 uv) {
  float rawLen = length(uv);
  vec2 dir = rawLen > 0.0001 ? uv / rawLen : vec2(1.0, 0.0);
  float reachAmount = length(uReach);
  vec2 reachDir = reachAmount > 0.00001 ? uReach / reachAmount : vec2(1.0, 0.0);
  float facing = exp((dot(dir, reachDir) - 1.0) * 3.2);
  float len = max(rawLen - reachAmount * facing * smoothstep(0.25, 0.65, rawLen), 0.0);
  uv = dir * len;
  float ang = atan(dir.y, dir.x);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;
  float near = facing * uNear;
  float bgLuminance = dot(uBackground, vec3(0.299, 0.587, 0.114));

  float n0 = snoise3(vec3(uv * 0.65, uTime * 0.5)) * 0.5 + 0.5;
  float r0 = mix(0.8 - 0.04 * uWobble, 0.8 + 0.04 * uWobble, n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0 / uGlow, d0);
  v0 *= smoothstep(r0 * 1.05, r0, len);
  float reach = max(uBleed, 0.04);
  float innerFade = smoothstep(r0 * (1.0 - 0.2 * reach), r0 * (1.0 - 0.05 * reach), len);
  v0 *= mix(innerFade, 1.0, bgLuminance * 0.7 * min(uBleed, 1.0));
  float body = smoothstep(0.8 - 0.2 * reach, 0.8, len);
  float cl = cos(ang + uSwirl) * 0.5 + 0.5;

  vec2 pos = vec2(cos(uOrbit), sin(uOrbit)) * r0;
  float d = distance(uv, pos);
  vec2 head = vec2(cos(uOrbit), sin(uOrbit));
  float lag = atan(head.x * dir.y - head.y * dir.x, dot(dir, head));
  float trail = uTrail > 0.0 ? smoothstep(0.0, 0.35, lag) * exp(-max(lag, 0.0) * 2.6 / uTrail) : 0.0;
  float v1 = (light2(1.5, 5.0, d) + trail * 0.6) * uHighlight;
  v1 *= light1(1.0, 50.0, d0);
  float band = v0 * smoothstep(1.0, mix(0.6, 1.0, n0 * 0.5), len) * body;
  float heat = pow(clamp(band / 0.82, 0.0, 1.0), 3.0);
  float bloom = light2(1.0, 160.0 / uGlow, max(len - r0, 0.0)) * smoothstep(0.4, 0.0, len - r0) * step(r0, len);

  float v2 = smoothstep(1.0, mix(0.6, 1.0, n0 * 0.5), len);
  float v3 = body;

  vec3 colBase = mix(uColor1, uColor2, cl);
  float fadeAmount = mix(1.0, 0.1, bgLuminance);

  float echoD = abs(len - r0 - uEcho.x);
  float echo = light1(1.0, 60.0, echoD) * smoothstep(0.12, 0.0, echoD) * uEcho.y;

  vec3 darkCol = mix(uColor3, colBase, v0);
  darkCol = (darkCol + v1) * v2 * v3 * (1.0 + uAwake + near * 0.35) + mix(colBase, vec3(1.0), 0.25) * heat * (0.28 + near * 0.3);
  darkCol = clamp(darkCol + colBase * (bloom * 0.1 + echo), 0.0, 1.0);

  vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
  lightCol = mix(uBackground, lightCol, clamp(v0 + echo, 0.0, 1.0));
  lightCol = mix(lightCol, colBase, clamp(v0, 0.0, 1.0) * clamp(near * 0.4 + uAwake, 0.0, 0.6));
  lightCol = clamp(mix(lightCol, vec3(1.0), clamp(v1 * 0.35, 0.0, 0.6)), 0.0, 1.0);

  vec3 finalCol = mix(darkCol, lightCol, bgLuminance);
  float alpha = max(max(finalCol.r, finalCol.g), finalCol.b);
  return vec4(finalCol / (alpha + 1e-5), alpha);
}

vec2 toPlane(vec2 p, out float hit) {
  float cx = cos(uTilt.x);
  float sx = sin(uTilt.x);
  float cy = cos(uTilt.y);
  float sy = sin(uTilt.y);
  vec3 ex = vec3(cy, 0.0, -sy);
  vec3 ey = vec3(sy * sx, cx, cy * sx);
  vec3 normal = vec3(sy * cx, -sx, cy * cx);
  vec3 origin = vec3(0.0, 0.0, 3.2);
  vec3 ray = vec3(p, -3.2);
  float denom = dot(normal, ray);
  float t = -dot(normal, origin) / (abs(denom) > 0.00001 ? denom : -0.00001);
  hit = t > 0.0 ? 1.0 : 0.0;
  vec3 q = origin + ray * t;
  return vec2(dot(q, ex), dot(q, ey));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - uResolution * 0.5) / min(uResolution.x, uResolution.y) * 2.0;
  uv *= uScale;
  float hit = 1.0;
  if (abs(uTilt.x) + abs(uTilt.y) > 0.0001) uv = toPlane(uv, hit);

  float s = sin(uRotation);
  float c = cos(uRotation);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  vec4 col = draw(uv);
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  float alpha = clamp(col.a * hit * uReveal * uOpacity + dither, 0.0, 1.0);
  outColor = vec4(col.rgb * alpha * alpha, alpha);
}`;

  var DEFAULTS = {
    colors: ['#f10808', '#f43f5e', '#e71010'], hue: 0, backgroundColor: '#000000', size: 1, glow: 1, bleed: 1,
    wobble: 1, highlight: 1, trail: 1, tiltX: 0, tiltY: 0, speed: 1, hoverIntensity: 1, rotateOnHover: true,
    forceHoverState: false, followCursor: true, clickPulse: true, intro: true, opacity: 1, paused: false, dpr: 0
  };
  // Per-state tuning layered on top of the base props (smoothly eased).
  var STATES = {
    idle:       { speed: 1,   highlight: 1,   glow: 1,    hover: 0 },
    listening:  { speed: 1.2, highlight: 1.3, glow: 1.25, hover: .6 },
    thinking:   { speed: 2.2, highlight: 1.5, glow: 1.15, hover: .3 },
    responding: { speed: 1.6, highlight: 1.8, glow: 1.5,  hover: 1 }
  };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function compile(gl, type, source) {
    var s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source); gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    if (root.console) console.warn('VyoraOrb shader:', gl.getShaderInfoLog(s));
    gl.deleteShader(s); return null;
  }
  function link(gl) {
    var v = compile(gl, gl.VERTEX_SHADER, VERTEX), f = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT), p = gl.createProgram();
    if (!v || !f || !p) return null;
    gl.attachShader(p, v); gl.attachShader(p, f); gl.bindAttribLocation(p, 0, 'aPosition'); gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
    var uniforms = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), i, info;
    for (i = 0; i < n; i++) { info = gl.getActiveUniform(p, i); if (info) uniforms[info.name] = gl.getUniformLocation(p, info.name); }
    return { program: p, uniforms: uniforms };
  }

  function create(el, opts) {
    opts = opts || {};
    var id = 'vo' + (++uid);
    var base = {}, k;
    for (k in DEFAULTS) base[k] = opts[k] != null ? opts[k] : DEFAULTS[k];
    var mq = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
    var reduce = opts.reducedMotion != null ? !!opts.reducedMotion : !!(mq && mq.matches);

    el.innerHTML = '';
    var canvas = document.createElement('canvas');
    canvas.className = 'orb-canvas'; canvas.setAttribute('aria-hidden', 'true');
    el.classList.add('vyora-orb'); el.setAttribute('data-orb', id);
    el.appendChild(canvas);

    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
    var prog = gl && link(gl);
    if (!gl || !prog) { // WebGL2 unavailable: leave an empty, harmless host
      return { setState: function () { return false; }, getState: function () { return 'idle'; }, setAudioLevel: function () {}, setReducedMotion: function () {}, destroy: function () {} };
    }
    var u = prog.uniforms;
    var buffer = gl.createBuffer(), vao = gl.createVertexArray();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    var cache = {};
    function parse(value) {
      if (cache[value]) return cache[value];
      var rgb = [0, 0, 0];
      if (probe) {
        probe.clearRect(0, 0, 1, 1); probe.fillStyle = '#000000'; probe.fillStyle = value; probe.fillRect(0, 0, 1, 1);
        var d = probe.getImageData(0, 0, 1, 1).data;
        rgb = d[3] ? [d[0] / 255, d[1] / 255, d[2] / 255] : [0, 0, 0];
      }
      return (cache[value] = rgb);
    }
    function shiftHue(rgb, deg) {
      if (!deg) return rgb;
      var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), r = rgb[0], g = rgb[1], b = rgb[2];
      var y = .299 * r + .587 * g + .114 * b, i = .596 * r - .274 * g - .322 * b, q = .211 * r - .523 * g + .312 * b;
      var ni = i * c - q * s, nq = i * s + q * c;
      return [y + .956 * ni + .621 * nq, y - .272 * ni - .647 * nq, y - 1.106 * ni + 1.703 * nq];
    }

    var view = { width: 1, height: 1 };
    var pointer = { x: 0, y: 0, inside: false };
    var cur = { speed: 1, highlight: 1, glow: 1, hover: 0 }; // eased state values
    var stateName = 'idle', tgt = STATES.idle, audio = 0, audioStamp = -1e9, audioS = 0;
    var st = {
      time: 0, swirl: 0, orbit: 0, echo: 1, rotation: 0, hover: 0, near: 0, reachX: 0, reachY: 0, reachSpeedX: 0, reachSpeedY: 0,
      pulse: 0, pulseSpeed: 0, kick: base.intro && !reduce ? 2.5 : 0, reveal: base.intro && !reduce ? 0 : 1
    };
    var raf = 0, last = 0, visible = true, dead = false, ro = null, io = null;

    function settings() {
      var colors = Array.isArray(base.colors) ? base.colors : [];
      return {
        colors: [colors[0] || DEFAULTS.colors[0], colors[1] || colors[0] || DEFAULTS.colors[1], colors[2] || DEFAULTS.colors[2]],
        hue: base.hue, backgroundColor: String(base.backgroundColor), size: clamp(base.size, .1, 3), glow: clamp(base.glow * cur.glow, .1, 5),
        bleed: clamp(base.bleed, 0, 4), wobble: Math.max(0, base.wobble), highlight: Math.max(0, base.highlight * cur.highlight * (1 + audioS * .6)),
        trail: Math.max(0, base.trail), tiltX: clamp(base.tiltX, -70, 70), tiltY: clamp(base.tiltY, -70, 70), speed: base.speed * cur.speed,
        hoverIntensity: Math.max(0, base.hoverIntensity), rotateOnHover: base.rotateOnHover, forceHoverState: base.forceHoverState,
        followCursor: base.followCursor, clickPulse: base.clickPulse, intro: base.intro, opacity: clamp(base.opacity, 0, 1), paused: base.paused, dpr: base.dpr
      };
    }

    function toOrb(x, y, s) {
      var side = Math.min(view.width, view.height), scale = 1 / (s.size * (1 + st.pulse));
      var ux = ((x - view.width / 2) / side) * 2 * scale, uy = ((view.height / 2 - y) / side) * 2 * scale;
      if (s.tiltX || s.tiltY) {
        var ax = -s.tiltX * Math.PI / 180, ay = s.tiltY * Math.PI / 180;
        var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
        var normal = [sy * cx, -sx, cy * cx], ray = [ux, uy, -FOCAL];
        var denom = normal[0] * ray[0] + normal[1] * ray[1] + normal[2] * ray[2];
        var t = -(normal[2] * FOCAL) / (Math.abs(denom) > .00001 ? denom : -.00001);
        if (t <= 0) return [99, 99];
        var q = [ray[0] * t, ray[1] * t, FOCAL + ray[2] * t];
        ux = q[0] * cy - q[2] * sy; uy = q[0] * sy * sx + q[1] * cx + q[2] * cy * sx;
      }
      var sn = Math.sin(st.rotation), cs = Math.cos(st.rotation);
      return [cs * ux - sn * uy, sn * ux + cs * uy];
    }

    function render(s) {
      s = s || settings();
      var cols = s.colors.map(function (v) { return shiftHue(parse(v), s.hue); });
      var reveal = st.reveal, back = reveal - 1, grow = 1 + 2.2 * back * back * back + 1.2 * back * back;
      var rv = Math.min(1, reveal / .55);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(prog.program); gl.bindVertexArray(vao);
      gl.uniform2f(u.uResolution, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, st.time);
      gl.uniform2f(u.uReach, st.reachX, st.reachY);
      gl.uniform1f(u.uNear, st.near);
      gl.uniform1f(u.uAwake, Math.max(st.hover, cur.hover) * s.hoverIntensity * .18);
      gl.uniform1f(u.uRotation, st.rotation);
      gl.uniform3fv(u.uBackground, parse(s.backgroundColor));
      gl.uniform3fv(u.uColor1, cols[0]); gl.uniform3fv(u.uColor2, cols[1]); gl.uniform3fv(u.uColor3, cols[2]);
      gl.uniform1f(u.uScale, 1 / (s.size * (1 + st.pulse) * (.62 + .38 * grow)));
      gl.uniform1f(u.uWobble, s.wobble); gl.uniform1f(u.uGlow, s.glow); gl.uniform1f(u.uBleed, s.bleed); gl.uniform1f(u.uHighlight, s.highlight);
      gl.uniform2f(u.uEcho, st.echo * .55, st.echo < 1 ? (1 - st.echo) * (1 - st.echo) : 0);
      gl.uniform1f(u.uSwirl, st.swirl); gl.uniform1f(u.uOrbit, st.orbit);
      gl.uniform1f(u.uReveal, rv * rv * (3 - 2 * rv));
      gl.uniform1f(u.uOpacity, s.opacity); gl.uniform1f(u.uTrail, s.trail);
      gl.uniform2f(u.uTilt, -s.tiltX * Math.PI / 180, s.tiltY * Math.PI / 180);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      raf = 0;
      if (dead || !visible || document.hidden) return;
      var dt = last ? clamp((now - last) / 1000, .0005, .05) : 1 / 60; last = now;
      // ease per-state values
      var ek = 1 - Math.exp(-dt / .5), key;
      for (key in cur) cur[key] += (tgt[key] - cur[key]) * ek;
      var at = now - audioStamp < 500 ? audio : 0;
      audioS += (at - audioS) * (1 - Math.exp(-dt / (at > audioS ? .08 : .4)));
      var s = settings();
      if (s.paused) { st.reveal = 1; render(s); last = 0; return; }
      var motion = reduce ? 0 : 1;
      var p = toOrb(pointer.x, pointer.y, s), px = p[0], py = p[1], distance = Math.hypot(px, py);
      var region = pointer.inside && motion ? clamp((1.45 - distance) / .4, 0, 1) : 0;
      var zone = region * region * (3 - 2 * region), aimed = zone * clamp((distance - .15) / .45, 0, 1), near = zone > .5;
      var target = s.forceHoverState ? 1 : zone;
      st.hover += (target - st.hover) * (1 - Math.exp(-dt / .16));
      var reach = .075 * s.hoverIntensity * aimed;
      var gx = distance > .0001 ? px / distance * reach : 0, gy = distance > .0001 ? py / distance * reach : 0;
      st.reachSpeedX += (70 * (gx - st.reachX) - 7 * st.reachSpeedX) * dt;
      st.reachSpeedY += (70 * (gy - st.reachY) - 7 * st.reachSpeedY) * dt;
      st.reachX += st.reachSpeedX * dt; st.reachY += st.reachSpeedY * dt;
      st.near += (aimed * s.hoverIntensity - st.near) * (1 - Math.exp(-dt / .12));
      var step = dt * s.speed * motion;
      st.time += step; st.swirl += step * 2 * (1 + st.kick); st.echo = Math.min(1, st.echo + dt / 1.2);
      if (s.rotateOnHover) st.rotation += dt * .3 * Math.max(st.hover, cur.hover * .5) * motion;
      var aim = Math.atan2(py, px);
      if (s.followCursor && near && motion) {
        var delta = Math.atan2(Math.sin(aim - st.orbit), Math.cos(aim - st.orbit));
        st.orbit += delta * (1 - Math.exp(-dt * 6));
      } else st.orbit -= step;
      st.orbit = Math.atan2(Math.sin(st.orbit), Math.cos(st.orbit));
      st.pulseSpeed += (-170 * st.pulse - 11 * st.pulseSpeed) * dt; st.pulse += st.pulseSpeed * dt;
      st.kick *= Math.exp(-dt * 2.5);
      if (!s.intro || reduce) st.reveal = 1; else if (st.reveal < 1) st.reveal = Math.min(1, st.reveal + dt / INTRO_SECONDS);
      render(s);
      raf = requestAnimationFrame(frame);
    }
    function wake() { if (!raf && visible && !dead && !document.hidden) raf = requestAnimationFrame(frame); }

    function resize() {
      var w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
      var ratio = Math.min(base.dpr || root.devicePixelRatio || 1, 2);
      view.width = w; view.height = h;
      canvas.width = Math.max(1, Math.round(w * ratio)); canvas.height = Math.max(1, Math.round(h * ratio));
      render(); wake();
    }
    function locate(e) {
      var r = el.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= r.width && pointer.y <= r.height;
    }
    function onMove(e) { locate(e); if (!base.paused) wake(); }
    function onDown(e) {
      locate(e);
      if (!pointer.inside || !base.clickPulse || base.paused || reduce) return;
      var p = toOrb(pointer.x, pointer.y, settings());
      if (Math.hypot(p[0], p[1]) > 1) return;
      st.pulseSpeed += .9; st.kick = 2.2; st.echo = 0; wake();
    }
    function onUp(e) { if (e.pointerType !== 'mouse') pointer.inside = false; }
    function onLeave() { pointer.inside = false; }
    function onVis() { last = 0; wake(); }
    function onMq(e) { if (opts.reducedMotion == null) reduce = e.matches; }

    if (root.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(el); }
    if (root.IntersectionObserver) {
      io = new IntersectionObserver(function (entries) {
        visible = entries.some(function (x) { return x.isIntersecting; });
        if (visible) { last = 0; wake(); }
      });
      io.observe(el);
    }
    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerdown', onDown, { passive: true });
    root.addEventListener('pointerup', onUp, { passive: true });
    root.addEventListener('pointercancel', onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVis);
    if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
    resize();

    return {
      setState: function (name) {
        if (dead || !STATES[name]) { if (!dead && root.console) console.warn('VyoraOrb: unknown state "' + name + '"'); return false; }
        if (name === stateName) return true;
        stateName = name; tgt = STATES[name];
        if (!reduce && (name === 'responding' || name === 'listening')) { st.pulseSpeed += name === 'responding' ? .7 : .4; st.kick = Math.max(st.kick, 1.4); st.echo = 0; }
        if (opts.onState) opts.onState(name);
        wake(); return true;
      },
      getState: function () { return stateName; },
      setAudioLevel: function (v) { if (dead) return; v = +v; if (isNaN(v)) return; audio = clamp(v, 0, 1); audioStamp = performance.now(); wake(); },
      setReducedMotion: function (b) { opts.reducedMotion = !!b; reduce = !!b; },
      setProps: function (o) { for (var k2 in o) if (k2 in DEFAULTS) base[k2] = o[k2]; wake(); },
      destroy: function () {
        if (dead) return; dead = true; cancelAnimationFrame(raf);
        if (ro) ro.disconnect(); if (io) io.disconnect();
        root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerdown', onDown);
        root.removeEventListener('pointerup', onUp); root.removeEventListener('pointercancel', onUp);
        document.documentElement.removeEventListener('pointerleave', onLeave);
        document.removeEventListener('visibilitychange', onVis);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
        gl.deleteProgram(prog.program); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao);
        var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
  }

  var api = { create: create, states: Object.keys(STATES) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.VyoraOrb = api;
})(typeof window !== 'undefined' ? window : globalThis);
