/* Ask-to-proof hero machine, adapted from concepts/hero-machine.html. */
(function HeroMachine() {
  const stage = document.getElementById('machine');
  const cv = stage.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const pauseBtn = stage.querySelector('.hero-machine-pause');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const MONO = '"SFMono-Regular", "SF Mono", Consolas, monospace';
  const BODY = '"Instrument Sans", sans-serif';

  /* ── Math + easing ── */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ss = (a, b, v) => { const k = seg(v, a, b); return k * k * (3 - 2 * k); };
  const outBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
  const outCubic = k => 1 - (1 - k) ** 3;
  const inQuad = k => k * k;
  const inOut = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  /* ── Palette ── */
  const INK = '#18191b';
  const COL = {
    acc:   { t: '#7093e6', l: '#2454c6', r: '#183d97' },
    ux:    { t: '#f496cd', l: '#e548a5', r: '#b02d7b' },
    ai:    { t: '#6fd6ee', l: '#079fc4', r: '#056f8d' },
    plate: { t: '#fcfcfa', l: '#eef3ff', r: '#d6d8da' },
    belt:  { t: '#ffffff', l: '#e6e8eb', r: '#c3c7cc' },
    table: { t: '#fff0f8', l: '#e548a5', r: '#b02d7b' },
    desk:  { t: '#eef3ff', l: '#2454c6', r: '#183d97' },
    steel: { t: '#6b7078', l: '#43474d', r: '#2a2d31' },
  };
  const DEEP = { ink: INK, acc: '#2454c6', ux: '#a90f68', ai: '#05789a' };

  /* ── Scene layout (iso units) ── */
  const C = 0.8660254;
  const PX = 8.6, PY = 9.6, DESK = 1.6, TABLE = 0.6;
  const SHEET_W = 1.0, SHEET_D = 1.3;
  const DUR = 15;
  const STEPS = 5;
  const stepX = i => 4.6 - i * 0.95;
  const stepH = i => 0.42 * (i + 1);

  let W = 0, H = 0, CH = 0, s = 30, ox = 0, oy = 0;
  let T = 3.2, paused = false;
  const SPEED = 0.75; // 1 = original 15s loop; 0.75 ≈ 20s

  const P = (x, y, z) => [ox + (x - y) * C * s, oy + (x + y) * 0.5 * s - z * s];
  const zAt = x => (x < 3.4 ? DESK : x < 5.4 ? DESK - (x - 3.4) * 0.5 : TABLE);

  function resize() {
    const r = cv.getBoundingClientRect();
    W = r.width; CH = r.height; H = CH;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const minx = -PY * C, maxx = PX * C, miny = -1.7, maxy = (PX + PY) * 0.5 + 0.35;
    // Leave air around the machine: side padding, room above for the chat, room below for controls.
    const padX = Math.max(14, W * 0.05), top = 100, bot = 44;
    s = Math.min((W - 2 * padX) / (maxx - minx), (H - top - bot) / (maxy - miny));
    ox = W / 2 - ((minx + maxx) / 2) * s + W * 0.03;
    oy = top + (H - top - bot - (maxy - miny) * s) / 2 - miny * s;
  }

  /* ── Drawing primitives ── */
  function path(pts) { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); }
  function poly(pts, fill, lw = 1.1, stroke = INK) {
    path(pts);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function box(x, y, z, dx, dy, dz, c, lw = 1.15) {
    const X = x + dx, Y = y + dy, Z = z + dz;
    poly([P(X, y, Z), P(X, Y, Z), P(X, Y, z), P(X, y, z)], c.r, lw);
    poly([P(x, Y, Z), P(X, Y, Z), P(X, Y, z), P(x, Y, z)], c.l, lw);
    poly([P(x, y, Z), P(X, y, Z), P(X, Y, Z), P(x, Y, Z)], c.t, lw);
  }
  function ghostBox(x, y, z, dx, dy, dz) {
    const X = x + dx, Y = y + dy, Z = z + dz;
    ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(24,25,27,.35)'; ctx.lineWidth = 1;
    path([P(x, y, Z), P(X, y, Z), P(X, Y, Z), P(x, Y, Z)]); ctx.fillStyle = 'rgba(7,159,196,.05)'; ctx.fill(); ctx.stroke();
    [[x, Y], [X, Y], [X, y]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(...P(a, b, z)); ctx.lineTo(...P(a, b, Z)); ctx.stroke(); });
    ctx.beginPath(); ctx.moveTo(...P(x, Y, z)); ctx.lineTo(...P(X, Y, z)); ctx.lineTo(...P(X, y, z)); ctx.stroke();
    ctx.restore();
  }
  function cyl(x, y, z, r, h, c) {
    const [bx, by] = P(x, y, z), rx = r * 1.2247 * s, ry = r * 0.7071 * s, ty = by - h * s;
    const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0); g.addColorStop(0, c.l); g.addColorStop(1, c.r);
    ctx.beginPath(); ctx.moveTo(bx - rx, ty); ctx.lineTo(bx - rx, by);
    ctx.ellipse(bx, by, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(bx + rx, ty);
    ctx.ellipse(bx, ty, rx, ry, 0, 0, Math.PI, false); ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.15; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(bx, ty, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = c.t; ctx.fill(); ctx.stroke();
  }
  function star(cx, cy, R, r, rot, fill, lw = 1.2) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r : R; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  }
  function groundShadow(x, y, z, r, a = 0.18) {
    const [cx, cy] = P(x, y, z);
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.2247 * s, r * 0.7071 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(24,25,27,${a})`; ctx.fill();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function pill(x, y, text, key) {
    ctx.font = `700 9.5px ${MONO}`;
    const label = text.toUpperCase(), w = ctx.measureText(label).width + 16, h = 20;
    const bx = clamp(x - w / 2, 4, W - w - 6), by = y - h;
    ctx.fillStyle = key === 'ink' ? 'rgba(24,25,27,.9)' : COL[key].l;
    ctx.fillRect(bx + 2.5, by + 2.5, w, h);
    ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, w, h);
    ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    ctx.fillStyle = DEEP[key]; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(label, bx + 8, by + h / 2 + 0.5);
    // tail
    ctx.beginPath(); ctx.moveTo(clamp(x, bx + 6, bx + w - 6) - 4, by + h); ctx.lineTo(clamp(x, bx + 6, bx + w - 6), by + h + 5); ctx.lineTo(clamp(x, bx + 6, bx + w - 6) + 4, by + h);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
    ctx.textBaseline = 'alphabetic';
  }

  /* ── The traveling sheet ── */
  // Map sheet-local (u,v) to world, following the desk/slide/table surface.
  function sheetMap(st) {
    const c = Math.cos(st.ang), sn = Math.sin(st.ang);
    return (u, v, lift = 0) => {
      const lx = (u - 0.5) * SHEET_W * st.k, ly = (v - 0.5) * SHEET_D * st.k;
      const x = st.x + lx * c - ly * sn, y = st.y + lx * sn + ly * c;
      return P(x, y, (st.onGround ? st.z : zAt(x)) + 0.02 + lift);
    };
  }
  const quadUV = (m, u0, v0, u1, v1, fill, lw = 0.7, stroke = INK) => poly([m(u0, v0), m(u1, v0), m(u1, v1), m(u0, v1)], fill, lw, stroke);

  const WIRE = [
    { pts: [[.08, .07], [.92, .07], [.92, .19], [.08, .19], [.08, .07]] },
    { pts: [[.08, .27], [.92, .27], [.92, .58], [.08, .58], [.08, .27]] },
    { pts: [[.08, .27], [.92, .58]] },
    { pts: [[.92, .27], [.08, .58]] },
    { pts: [[.08, .67], [.72, .67]] },
    { pts: [[.08, .75], [.55, .75]] },
    { pts: [[.52, .84], [.92, .84], [.92, .94], [.52, .94], [.52, .84]] },
  ];
  // Flatten strokes into pen-down / pen-up segments weighted by length.
  const PEN = [];
  (() => {
    let prev = null;
    WIRE.forEach((st, si) => {
      if (prev) PEN.push({ a: prev, b: st.pts[0], down: false, si });
      for (let i = 1; i < st.pts.length; i++) PEN.push({ a: st.pts[i - 1], b: st.pts[i], down: true, si });
      prev = st.pts[st.pts.length - 1];
    });
    let acc = 0;
    PEN.forEach(p => { p.len = Math.hypot(p.b[0] - p.a[0], (p.b[1] - p.a[1]) * 1.3) * (p.down ? 1 : 0.6); p.start = acc; acc += p.len; });
    PEN.total = acc;
  })();

  function sheetState(t) {
    if (t < 2.4 || t >= 9.35) return null;
    const st = { x: 2.3, y: 2.3, ang: 0, k: 1, onGround: false, z: 0 };
    if (t < 3.0) { const k = seg(t, 2.4, 3.0); st.k = outBack(ss(0.15, 1, k)); st.ang = (1 - k) * 1.3; }
    else if (t < 3.7) { /* on the desk */ }
    else if (t < 4.5) { const k = inQuad(seg(t, 3.7, 4.5)); st.x = lerp(2.3, 5.95, k); st.y = lerp(2.3, 2.4, k); st.ang = Math.sin(k * Math.PI) * 0.12; }
    else if (t < 8.0) { const k = outBack(seg(t, 4.5, 4.95)); st.x = lerp(5.95, 6.5, k); st.y = 2.4; }
    else { const k = inOut(seg(t, 8.0, 9.3)); st.x = 6.5; st.y = lerp(2.4, 5.95, k); }
    return st;
  }

  function drawSheet(t, st) {
    const m = sheetMap(st);
    // Hard sticker shadow, then the page.
    const sh = sheetMap({ ...st, x: st.x + 0.07, y: st.y + 0.07 });
    poly([sh(0, 0), sh(1, 0), sh(1, 1), sh(0, 1)], 'rgba(24,25,27,.22)', 0);
    poly([m(0, 0), m(1, 0), m(1, 1), m(0, 1)], '#fff', 1.15);

    // Brief content (fades once UX starts sketching).
    const briefA = 1 - seg(t, 4.95, 5.2);
    if (briefA > 0) {
      ctx.save(); ctx.globalAlpha *= briefA;
      quadUV(m, .08, .08, .56, .18, COL.acc.l, 0.6);
      [[.33, .9], [.43, .82], [.53, .9], [.63, .68], [.73, .78]].forEach(([v, u1]) => quadUV(m, .08, v, u1, v + .035, '#c3c7cc', 0));
      if (t > 3.12) {
        const k = outBack(seg(t, 3.12, 3.4));
        ctx.save();
        const [cx, cy] = m(.79, .15);
        ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
        quadUV(m, .66, .05, .92, .25, 'rgba(36,84,198,.12)', 1.6, COL.acc.l);
        ctx.beginPath(); ctx.moveTo(...m(.71, .15)); ctx.lineTo(...m(.77, .21)); ctx.lineTo(...m(.88, .09));
        ctx.lineWidth = 2; ctx.strokeStyle = COL.acc.l; ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    // Wireframe, sketched by the pencil.
    if (t >= 5.0) {
      const done = t >= 7.0 ? PEN.total : seg(t, 5.0, 7.0) * PEN.total;
      const rollU = t < 7.15 ? 0 : t < 7.95 ? inOut(seg(t, 7.15, 7.95)) * 1.08 - 0.04 : 1.1;
      // Paint (design) under the sketch, clipped to what the roller has passed.
      if (rollU > 0) {
        ctx.save();
        path([m(0, 0), m(clamp(rollU, 0, 1), 0), m(clamp(rollU, 0, 1), 1), m(0, 1)]); ctx.clip();
        quadUV(m, .08, .07, .92, .19, COL.ux.l, 0);
        quadUV(m, .08, .27, .92, .58, '#fde3f1', 0);
        quadUV(m, .08, .655, .72, .685, '#43474d', 0);
        quadUV(m, .08, .735, .55, .765, '#9aa0a8', 0);
        quadUV(m, .52, .84, .92, .94, INK, 0);
        // a little sun + hill in the image block
        const [sx, sy] = m(.75, .36); ctx.beginPath(); ctx.arc(sx, sy, 0.05 * s, 0, Math.PI * 2); ctx.fillStyle = '#e548a5'; ctx.fill();
        poly([m(.12, .56), m(.4, .38), m(.62, .56)], '#f496cd', 0);
        ctx.restore();
      }
      ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.lineCap = 'round';
      PEN.forEach(p => {
        if (!p.down || done <= p.start) return;
        const k = clamp((done - p.start) / p.len, 0, 1);
        const b = [lerp(p.a[0], p.b[0], k), lerp(p.a[1], p.b[1], k)];
        const faded = rollU > 0 && (p.si === 2 || p.si === 3) ? 0.25 : 1;
        ctx.save(); ctx.globalAlpha *= faded;
        ctx.beginPath(); ctx.moveTo(...m(p.a[0], p.a[1])); ctx.lineTo(...m(b[0], b[1])); ctx.stroke();
        ctx.restore();
      });
    }
  }

  function pencilTip(t, st) {
    const rest = P(7.15, 2.05, 1.35 + Math.sin(t * 2.2) * 0.06);
    if (!st || t < 4.75 || t > 7.3) return { p: rest, down: false };
    const m = sheetMap(st);
    const first = m(...WIRE[0].pts[0], 0.25);
    if (t < 5.0) { const k = outCubic(seg(t, 4.75, 5.0)); return { p: [lerp(rest[0], first[0], k), lerp(rest[1], first[1], k)], down: false }; }
    if (t > 7.0) {
      const last = WIRE[WIRE.length - 1].pts.at(-1), lp = m(last[0], last[1], 0.25), k = outCubic(seg(t, 7.0, 7.3));
      return { p: [lerp(lp[0], rest[0], k), lerp(lp[1], rest[1], k)], down: false };
    }
    const done = seg(t, 5.0, 7.0) * PEN.total;
    const p = PEN.find(q => done >= q.start && done <= q.start + q.len) || PEN[PEN.length - 1];
    const k = clamp((done - p.start) / p.len, 0, 1);
    const u = lerp(p.a[0], p.b[0], k), v = lerp(p.a[1], p.b[1], k);
    const lift = p.down ? 0 : Math.sin(k * Math.PI) * 0.3;
    const wob = p.down ? Math.sin(t * 60) * 0.004 : 0;
    return { p: m(u + wob, v, lift), down: p.down };
  }

  function pencilTop(t, st) { const tip = pencilTip(t, st).p; return [tip[0] + 0.42 * s, tip[1] - 0.95 * s]; }
  function rollerGrip(t) {
    const mid = P(lerp(5.9, 7.1, inOut(seg(t, 7.15, 7.95))), 2.4, TABLE + 0.16);
    return [mid[0] + 0.98 * s, mid[1] - 1.85 * s];
  }

  function drawArm(t, st) {
    // Pink column + two-link arm (solved in screen space) + pencil.
    box(7.95, 1.05, 0, 0.4, 0.4, 2.2, COL.ux);
    const S = P(8.15, 1.25, 2.2);
    const tip = pencilTip(t, st).p;
    const top = pencilTop(t, st);
    const L = 1.45 * s, dx = top[0] - S[0], dy = top[1] - S[1], d = Math.min(Math.hypot(dx, dy), 2 * L - 1);
    const mx = S[0] + dx / 2, my = S[1] + dy / 2, h = Math.sqrt(Math.max(0, L * L - (d / 2) ** 2));
    let nx = -dy / (Math.hypot(dx, dy) || 1), ny = dx / (Math.hypot(dx, dy) || 1);
    if (ny > 0) { nx = -nx; ny = -ny; }
    const E = [mx + nx * h, my + ny * h];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [[S, E], [E, top]].forEach(([a, b]) => {
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b);
      ctx.lineWidth = 0.26 * s + 2.4; ctx.strokeStyle = INK; ctx.stroke();
      ctx.lineWidth = 0.26 * s; ctx.strokeStyle = COL.ux.l; ctx.stroke();
    });
    [S, E].forEach(j => { ctx.beginPath(); ctx.arc(j[0], j[1], 0.2 * s, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke(); });
    // Pencil from top (grip) to tip.
    const ang = Math.atan2(tip[1] - top[1], tip[0] - top[0]), len = Math.hypot(tip[0] - top[0], tip[1] - top[1]);
    ctx.save(); ctx.translate(top[0], top[1]); ctx.rotate(ang);
    const wdt = 0.13 * s;
    ctx.beginPath(); ctx.rect(0, -wdt, len * 0.72, wdt * 2); ctx.fillStyle = '#ffd24d'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len * 0.72, -wdt); ctx.lineTo(len, 0); ctx.lineTo(len * 0.72, wdt); ctx.closePath(); ctx.fillStyle = '#f3dcc0'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len * 0.9, -wdt * 0.36); ctx.lineTo(len, 0); ctx.lineTo(len * 0.9, wdt * 0.36); ctx.closePath(); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.rect(-wdt * 0.9, -wdt, wdt * 0.9, wdt * 2); ctx.fillStyle = COL.ux.t; ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.arc(top[0], top[1], 0.13 * s, 0, Math.PI * 2); ctx.fillStyle = COL.ux.r; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
  }

  function drawRoller(t) {
    if (t < 7.0 || t > 8.1) return;
    const pop = outBack(seg(t, 7.0, 7.2)) * (1 - seg(t, 7.9, 8.1));
    if (pop <= 0.01) return;
    const u = inOut(seg(t, 7.15, 7.95));
    const x = lerp(5.9, 7.1, u), zt = TABLE + 0.16 + Math.abs(Math.sin(t * 22)) * 0.02;
    const a = P(x, 1.62, zt), b = P(x, 3.18, zt), mid = P(x, 2.4, zt), grip = [mid[0] + 0.7 * s, mid[1] - 1.35 * s];
    ctx.save(); ctx.translate(mid[0], mid[1]); ctx.scale(pop, pop); ctx.translate(-mid[0], -mid[1]);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...mid); ctx.lineTo(...grip); ctx.lineWidth = 3.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...grip); ctx.lineTo(grip[0] + 0.28 * s, grip[1] - 0.5 * s); ctx.lineWidth = 0.22 * s + 2; ctx.stroke();
    ctx.lineWidth = 0.22 * s; ctx.strokeStyle = COL.ux.r; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineWidth = 0.34 * s + 2.4; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 0.34 * s; ctx.strokeStyle = COL.ux.l; ctx.stroke();
    ctx.lineWidth = 0.1 * s; ctx.strokeStyle = COL.ux.t; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 0.08 * s); ctx.lineTo(b[0], b[1] - 0.08 * s); ctx.stroke();
    ctx.restore();
  }

  /* ── The ask (crumpled ball) ── */
  const BALL0 = [0.9, 3.9, 3.6];
  function ballState(t) {
    if (t < 1.3 || t >= 2.75) return null;
    const D = [2.3, 2.3, DESK + 0.3];
    if (t < 2.05) {
      const k = seg(t, 1.3, 2.05);
      return { x: lerp(BALL0[0], D[0], k), y: lerp(BALL0[1], D[1], k), z: lerp(BALL0[2], D[2], inQuad(k)) + Math.sin(k * Math.PI) * 0.9, sq: 1, rot: k * 5, r: outBack(seg(t, 1.3, 1.5)) };
    }
    const k = seg(t, 2.05, 2.55);
    const bounce = Math.abs(Math.sin(k * Math.PI * 2)) * 0.45 * (1 - k);
    const sq = k < 0.08 ? 0.7 : 1 - Math.max(0, 0.25 - bounce) * 0.6;
    const shrink = 1 - ss(2.45, 2.75, t);
    return { x: D[0], y: D[1], z: D[2] + bounce, sq, rot: 5 + k * 2, r: shrink };
  }
  function drawBall(b) {
    const ground = b.x > 1.2 && b.x < 3.4 && b.y > 1.2 && b.y < 3.4 ? DESK : 0;
    groundShadow(b.x, b.y, ground, 0.28 * b.r, 0.16);
    const [cx, cy] = P(b.x, b.y, b.z), r = 0.3 * s * b.r;
    ctx.save(); ctx.translate(cx, cy + r * (1 - b.sq)); ctx.scale(1 / b.sq, b.sq); ctx.rotate(b.rot);
    ctx.beginPath();
    for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2, rr = r * (0.86 + hash(i) * 0.18); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke();
    ctx.lineWidth = 0.9; ctx.strokeStyle = '#9aa0a8';
    [[-.5, -.3, .1, .1, .4, -.2], [-.3, .4, .1, .05, .5, .35], [-.1, -.6, -.2, -.1, .2, 0]].forEach(q => {
      ctx.beginPath(); ctx.moveTo(q[0] * r, q[1] * r); ctx.lineTo(q[2] * r, q[3] * r); ctx.lineTo(q[4] * r, q[5] * r); ctx.stroke();
    });
    ctx.restore();
  }

  /* ── Account desk + stamp ── */
  function stampState(t) {
    let x = 1.8, zb = 2.62;
    if (t > 2.65 && t < 3.85) {
      x = lerp(1.8, 2.59, outCubic(seg(t, 2.65, 2.95))) - (lerp(1.8, 2.59, 1) - 1.8) * inOut(seg(t, 3.5, 3.85));
      zb = t < 3.0 ? 2.62 : t < 3.12 ? lerp(2.62, DESK + 0.03, inQuad(seg(t, 3.0, 3.12))) : lerp(DESK + 0.03, 2.62, outBack(seg(t, 3.25, 3.5)));
    }
    return { x, zb };
  }
  function drawStamp(t) {
    const { x, zb } = stampState(t), y = 1.86, hs = 0.21;
    const rodTop = 3.3;
    box(x - 0.04, y - 0.04, zb + 0.24, 0.08, 0.08, rodTop - (zb + 0.24), COL.steel, 0.8);
    box(x - hs, y - hs, zb, hs * 2, hs * 2, 0.24, COL.acc);
    if (t > 3.1 && t < 3.45) {
      const [cx, cy] = P(2.59, 1.86, DESK), k = seg(t, 3.1, 3.45);
      ctx.strokeStyle = `rgba(36,84,198,${1 - k})`; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = Math.PI + i * Math.PI / 5, r0 = 0.45 * s + k * 12; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.6); ctx.lineTo(cx + Math.cos(a) * (r0 + 7), cy + Math.sin(a) * (r0 + 7) * 0.6); ctx.stroke(); }
    }
  }

  /* ── AI engine ── */
  function drawEngine(t) {
    const busy = t > 9.2 && t < 10.9;
    const jx = busy ? Math.sin(t * 70) * 1.4 : 0, jy = busy ? Math.cos(t * 55) * 0.8 : 0;
    ctx.save(); ctx.translate(jx, jy);
    box(5.5, 5.8, 0, 2.0, 2.0, 1.8, COL.ai);
    const press = clamp(1 - Math.abs(t - 9.25) / 0.15, 0, 1);
    box(5.72, 7.22, 1.8, 0.34, 0.34, 0.16 - 0.1 * press, { t: '#ffd24d', l: '#e8b62c', r: '#b58b17' });
    // Door on the front face opens when the POC is ready.
    const open = ss(10.55, 10.8, t) * (1 - ss(11.5, 11.8, t));
    const door = [P(6.05, 7.8, 0.08), P(6.95, 7.8, 0.08), P(6.95, 7.8, 1.25), P(6.05, 7.8, 1.25)];
    poly(door, '#0b3945', 1.1);
    // The door panel slides up to open.
    if (open < 1) poly([P(6.05, 7.8, 0.08 + 1.17 * open), P(6.95, 7.8, 0.08 + 1.17 * open), P(6.95, 7.8, 1.25), P(6.05, 7.8, 1.25)], '#bff0fb', 1.1);
    // LEDs above the door: chapter colors, chasing while busy.
    ['#2454c6', '#e548a5', '#079fc4'].forEach((c, i) => {
      const on = busy ? Math.floor(t * 9) % 3 === i : t > 10.9 && t < 12.5 ? true : i === 2;
      const x0 = 6.1 + i * 0.3;
      poly([P(x0, 7.8, 1.6), P(x0 + 0.2, 7.8, 1.6), P(x0 + 0.2, 7.8, 1.38), P(x0, 7.8, 1.38)], on ? c : '#fff', 0.8);
    });
    // Gauge on the right face.
    const gc = [7.5, 6.8, 0.95], gr = 0.36, pts = [];
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push(P(gc[0], gc[1] + Math.cos(a) * gr, gc[2] + Math.sin(a) * gr)); }
    poly(pts, '#fff', 1);
    const na = busy ? Math.sin(t * 9) * 1.1 : t > 10.9 && t < 12.5 ? 1.15 : -1.0;
    ctx.beginPath(); ctx.moveTo(...P(gc[0], gc[1], gc[2])); ctx.lineTo(...P(gc[0], gc[1] + Math.sin(na) * gr * 0.85, gc[2] + Math.cos(na) * gr * 0.85));
    ctx.lineWidth = 1.8; ctx.strokeStyle = COL.ux.l; ctx.stroke();
    // Chimney + steam.
    cyl(7.05, 6.3, 1.8, 0.2, 0.55, COL.steel);
    ctx.restore();
    const [cx, cy] = P(7.05, 6.3, 2.35);
    for (let k = 0; k < 9; k++) {
      const born = 9.2 + k * 0.2, tau = t - born;
      if (tau < 0 || tau > 1.1) continue;
      const r = (3 + tau * 9) * (s / 30), a = 1 - tau / 1.1;
      ctx.beginPath(); ctx.arc(cx + Math.sin(k * 1.7) * 5 + tau * 10, cy - tau * 44, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = `rgba(24,25,27,${a * 0.8})`; ctx.stroke();
    }
    // Spark on the roof.
    const spin = t * (busy ? 7 : 0.9) + (t > 10.9 ? 10.9 * 6 : 0);
    const [bx, by] = P(6.3, 6.55, 1.8), [sx, sy] = P(6.3, 6.55, 2.6 + Math.sin(t * 2.4) * 0.07 + (busy ? 0.1 : 0));
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(sx, sy + 8); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
    const pulse = t > 10.8 && t < 11.4 ? 1 - seg(t, 10.8, 11.4) : 0;
    if (pulse > 0) { ctx.beginPath(); ctx.arc(sx, sy, (0.7 + (1 - pulse) * 1.2) * s, 0, Math.PI * 2); ctx.strokeStyle = `rgba(7,159,196,${pulse})`; ctx.lineWidth = 2.5; ctx.stroke(); }
    star(sx, sy, 0.62 * s, 0.17 * s, spin, '#6fd6ee');
    star(sx, sy, 0.25 * s, 0.08 * s, -spin * 1.4, '#fff', 0.9);
  }

  /* ── The working POC (standing screen) ── */
  function appState(t, n) {
    if (t < 10.8 || t >= 13.15) return null;
    const land = [stepX(n) + 0.45, 8.55, stepH(n)];
    if (t < 11.5) { const k = seg(t, 10.8, 11.25); return { x: 6.5, y: lerp(7.9, 8.4, outCubic(k)), z: 0, k: outBack(k), sq: 1, air: false }; }
    if (t < 12.2) {
      const k = seg(t, 11.5, 12.2);
      const sq = k < 0.12 ? 1 - Math.sin(k / 0.12 * Math.PI) * 0.18 : 1;
      return { x: lerp(6.5, land[0], k), y: lerp(8.4, land[1], k), z: lerp(0, land[2], k) + Math.sin(k * Math.PI) * 1.6, k: 1, sq, air: true };
    }
    const k = seg(t, 12.2, 12.45), land2 = 1 - Math.sin(k * Math.PI) * 0.22;
    const shrink = 1 - ss(12.85, 13.15, t);
    return { x: land[0], y: land[1], z: land[2], k: shrink, sq: land2, air: false };
  }
  function drawApp(a) {
    const w = 0.9 * a.k, h = 1.15 * a.k * a.sq, d = 0.14 * a.k, x0 = a.x - w / 2, y0 = a.y - d / 2, z0 = a.z;
    if (!a.air) groundShadow(a.x, a.y + 0.1, a.z, 0.5 * a.k, 0.14);
    box(x0, y0, z0, w, d, h, COL.ai);
    // Screen on the front (y+) face.
    const yf = y0 + d, f = (u, v) => P(x0 + u * w, yf, z0 + (1 - v) * h);
    const q = (u0, v0, u1, v1, fill, lw = 0.7) => poly([f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)], fill, lw);
    q(.08, .06, .92, .94, '#fff', 0.9);
    q(.08, .06, .92, .2, COL.ai.l, 0.6);
    q(.14, .28, .66, .42, '#eef3ff', 0.6);
    q(.34, .48, .86, .62, '#fde3f1', 0.6);
    q(.14, .68, .56, .8, '#eef3ff', 0.6);
    // Check badge
    const [cx, cy] = f(.8, .78);
    ctx.beginPath(); ctx.arc(cx, cy, 0.13 * s * a.k, 0, Math.PI * 2); ctx.fillStyle = COL.ai.l; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 3.5 * a.k, cy); ctx.lineTo(cx - 1 * a.k, cy + 2.8 * a.k); ctx.lineTo(cx + 4 * a.k, cy - 3 * a.k);
    ctx.lineWidth = 1.8; ctx.strokeStyle = '#fff'; ctx.stroke();
  }

  /* ── Staircase of shipped proof ── */
  function drawStep(i, h) {
    if (h <= 0.001) return;
    const x = stepX(i), y = 8.1, b = h / 3;
    box(x, y, 0, 0.9, 0.9, b, COL.acc);
    box(x, y, b, 0.9, 0.9, b, COL.ux);
    box(x, y, 2 * b, 0.9, 0.9, b, COL.ai);
    // check cap
    const m = (u, v) => P(x + u * 0.9, y + v * 0.9, h);
    ctx.beginPath(); ctx.moveTo(...m(.3, .5)); ctx.lineTo(...m(.45, .65)); ctx.lineTo(...m(.72, .32));
    ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.stroke();
  }

  /* ── Client bubble + paper plane ── */
  function bubbleLayout() {
    const tail = P(BALL0[0], BALL0[1], BALL0[2] - 0.1);
    const cb = { w: 132, h: 60 }; cb.x = tail[0] - cb.w + 26; cb.y = tail[1] - cb.h - 22;
    // Wally answers beside the client, a beat higher, pointing down at the desk.
    const wb = { w: 138, h: 54 }; wb.x = Math.min(W - wb.w - 10, cb.x + cb.w + 16); wb.y = cb.y - 12;
    return { tail, cb, wb, rest: [wb.x + 44, wb.y + wb.h + 18] };
  }
  function bubbles(t, L) {
    const { tail, cb, wb } = L;
    // Client
    const appear = outBack(seg(t, 0.0, 0.5)) * (1 - ss(14.65, 14.95, t));
    if (appear > 0.01) {
      const happy = t > 14.15;
      const wob = happy ? Math.sin((t - 14.15) * 28) * Math.exp(-(t - 14.15) * 5) * 0.08 : 0;
      const { x: bx, y: by, w: bw, h: bh } = cb;
      ctx.save();
      ctx.translate(tail[0], tail[1]); ctx.scale(appear * (1 + wob), appear * (1 - wob)); ctx.translate(-tail[0], -tail[1]);
      ctx.fillStyle = happy ? COL.ai.l : COL.acc.l; roundRect(bx + 4, by + 4, bw, bh, 12); ctx.fill();
      roundRect(bx, by, bw, bh, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + bw - 44, by + bh - 1); ctx.lineTo(tail[0], tail[1]); ctx.lineTo(bx + bw - 24, by + bh - 1);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw - 43, by + bh - 3, 18, 4);
      ctx.font = `700 8.5px ${MONO}`; ctx.fillStyle = '#676c73'; ctx.textAlign = 'left'; ctx.fillText('CLIENT', bx + 12, by + 17);
      if (t < 1.25) {
        for (let i = 0; i < 3; i++) {
          const yb = Math.sin(t * 12 - i * 0.9) * 2.5;
          ctx.beginPath(); ctx.arc(bx + 18 + i * 12, by + 38 + yb, 3.4, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
        }
      } else if (!happy) {
        ctx.font = `600 13px ${BODY}`; ctx.fillStyle = INK; ctx.fillText('We need a way to…', bx + 12, by + 41);
      } else {
        ctx.beginPath(); ctx.arc(bx + 21, by + 37, 8, 0, Math.PI * 2); ctx.fillStyle = COL.ai.l; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx + 17, by + 37); ctx.lineTo(bx + 20, by + 40.5); ctx.lineTo(bx + 25.5, by + 33.5); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
        ctx.font = `600 13px ${BODY}`; ctx.fillStyle = INK; ctx.fillText('That works.', bx + 36, by + 41);
      }
      ctx.restore();
    }
    // Wally
    const wa = outBack(seg(t, 1.4, 1.8)) * (1 - ss(14.65, 14.95, t));
    if (wa > 0.01) {
      const ax = wb.x + 16, ay = wb.y + wb.h + 10;
      const hop = t > 12.95 ? Math.sin((t - 12.95) * 26) * Math.exp(-(t - 12.95) * 6) * 0.07 : 0;
      ctx.save();
      ctx.translate(ax, ay); ctx.scale(wa * (1 + hop), wa * (1 - hop)); ctx.translate(-ax, -ay);
      ctx.fillStyle = COL.ux.l; roundRect(wb.x + 4, wb.y + 4, wb.w, wb.h, 12); ctx.fill();
      roundRect(wb.x, wb.y, wb.w, wb.h, 12); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.moveTo(wb.x + 14, wb.y + wb.h - 1); ctx.lineTo(ax, ay); ctx.lineTo(wb.x + 32, wb.y + wb.h - 1); ctx.closePath(); ctx.fill();
      ctx.font = `700 8.5px ${MONO}`; ctx.fillStyle = '#f7a9d5'; ctx.textAlign = 'left'; ctx.fillText('WALLY', wb.x + 12, wb.y + 17);
      if (t < 1.8) {
        for (let i = 0; i < 3; i++) {
          const yb = Math.sin(t * 12 - i * 0.9) * 2.5;
          ctx.beginPath(); ctx.arc(wb.x + 18 + i * 12, wb.y + 35 + yb, 3.4, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
        }
      } else {
        ctx.font = `600 13px ${BODY}`; ctx.fillStyle = '#fff';
        ctx.fillText(t < 12.95 ? 'I’m on it.' : 'here you go!', wb.x + 12, wb.y + 38);
      }
      ctx.restore();
    }
  }
  function planePath(n, tail) {
    const a = P(stepX(n) + 0.45, 8.55, stepH(n) + 0.5), b = [tail[0] - 30, tail[1] - 42];
    const c = [(a[0] + b[0]) / 2 - 90, Math.min(a[1], b[1]) - 70];
    return kk => [(1 - kk) ** 2 * a[0] + 2 * (1 - kk) * kk * c[0] + kk * kk * b[0], (1 - kk) ** 2 * a[1] + 2 * (1 - kk) * kk * c[1] + kk * kk * b[1]];
  }
  const planeAt = (t, n, tail) => planePath(n, tail)(inOut(seg(t, 13.0, 14.2)));
  function plane(t, n, tail) {
    if (t < 13.0 || t > 14.25) return null;
    const k = inOut(seg(t, 13.0, 14.2));
    const at = planePath(n, tail);
    // dashed trail
    ctx.save(); ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(5,120,154,.6)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 0; i <= 20; i++) { const kk = Math.max(0, k - 0.35) + (k - Math.max(0, k - 0.35)) * i / 20; const p = at(kk); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.stroke(); ctx.restore();
    const p = at(k), q = at(Math.min(1, k + 0.02)), ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    const sc = s / 30 * (1 - ss(0.92, 1, k) * 0.6);
    ctx.save(); ctx.translate(...p); ctx.rotate(ang); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -9); ctx.lineTo(-5, 0); ctx.lineTo(-10, 9); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-10, 9); ctx.lineTo(-5, 0); ctx.lineTo(14, 0); ctx.closePath(); ctx.fillStyle = COL.ai.t; ctx.fill(); ctx.stroke();
    ctx.restore();
    return p;
  }
  function confetti(t, n) {
    const tau = t - 12.2;
    if (tau < 0 || tau > 1.1) return;
    const [ox0, oy0] = P(stepX(n) + 0.45, 8.55, stepH(n) + 0.9);
    const cols = [COL.acc.l, COL.ux.l, COL.ai.l, '#ffd24d'];
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (hash(i) - 0.5) * 2.6, v = (110 + hash(i + 40) * 170) * (s / 30);
      const x = ox0 + Math.cos(a) * v * tau, y = oy0 + Math.sin(a) * v * tau + 0.5 * 560 * tau * tau * (s / 30);
      const sz = 4 + hash(i + 7) * 3.5;
      ctx.save(); ctx.globalAlpha = 1 - ss(0.7, 1.1, tau); ctx.translate(x, y); ctx.rotate(tau * (6 + hash(i + 3) * 10));
      ctx.fillStyle = cols[i % 4]; ctx.fillRect(-sz / 2, -sz / 3, sz, sz * 0.66); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.strokeRect(-sz / 2, -sz / 3, sz, sz * 0.66);
      ctx.restore();
    }
  }

  /* ── Station badges ── */
  function badge(pt, num, name, key, on) {
    ctx.font = `700 9.5px ${MONO}`;
    const label = `${num}  ${name}`, w = ctx.measureText(label).width + 16, h = 21;
    const x = clamp(pt[0] - w / 2, 4, W - w - 4), y = pt[1] - h;
    ctx.fillStyle = on ? COL[key].l : 'rgba(24,25,27,.85)';
    ctx.fillRect(x + (on ? 3 : 2), y + (on ? 3 : 2), w, h);
    ctx.fillStyle = on ? COL[key].l : '#fff'; ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = on ? '#fff' : DEEP[key]; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + 8, y + h / 2 + 0.5);
    ctx.textBaseline = 'alphabetic';
  }

  /* ── Wally's cursor: it operates every station ── */
  const CLICKS = [2.95, 3.68, 9.2, 10.5, 11.42, 12.95];
  function cursorHolds(n, L) {
    return [
      { a: 0, b: 1.9, at: () => L.rest },
      { a: 2.35, b: 3.5, at: t => { const k = stampState(t); return P(k.x, 1.86, k.zb + 0.55); } },
      { a: 3.68, b: 4.3, at: t => { const st = sheetState(t); return P(st.x, st.y, zAt(st.x) + 0.05); } },
      { a: 4.85, b: 7.0, at: t => pencilTop(t, sheetState(t)) },
      { a: 7.15, b: 7.95, at: t => rollerGrip(t) },
      { a: 8.85, b: 10.1, at: t => P(5.89, 7.39, 1.98 - (t > 9.1 && t < 9.4 ? 0.08 : 0)) },
      { a: 10.35, b: 10.62, at: () => P(6.5, 7.8, 1.0) },
      { a: 11.25, b: 12.3, at: t => { const a = appState(t, n); return P(a.x, a.y, a.z + 1.2 * a.k * a.sq); } },
      { a: 12.75, b: 13.35, at: t => (t < 13.0 ? P(stepX(n) + 0.45, 8.55, stepH(n) + 0.3) : planeAt(t, n, L.tail)) },
      { a: 14.35, b: DUR, at: () => L.rest },
    ];
  }
  function cursorAt(t, n, L) {
    const hs = cursorHolds(n, L);
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i], nx = hs[i + 1];
      if (t >= h.a && t <= h.b) return h.at(t);
      if (nx && t > h.b && t < nx.a) {
        const k = inOut((t - h.b) / (nx.a - h.b)), p = h.at(h.b), q = nx.at(nx.a);
        const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        return [lerp(p[0], q[0], k), lerp(p[1], q[1], k) - Math.sin(k * Math.PI) * Math.min(40, d * 0.25)];
      }
    }
    return L.rest;
  }
  function drawCursor(p, label, age) {
    const [x, y] = p;
    if (age >= 0 && age < 0.5) {
      const k = age / 0.5;
      ctx.beginPath(); ctx.arc(x, y, 3 + k * 16, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(229,72,165,${1 - k})`; ctx.lineWidth = 2.2; ctx.stroke();
    }
    const press = age >= 0 && age < 0.14 ? 0.82 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(press, press);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.6, 12.9); ctx.lineTo(7.8, 19.8); ctx.lineTo(10.9, 18.4); ctx.lineTo(7.7, 11.7); ctx.lineTo(13.4, 11.4); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
    ctx.font = `700 9.5px ${MONO}`; const nw = ctx.measureText('WALLY').width;
    ctx.font = `600 11px ${BODY}`; const sw = label ? ctx.measureText(label).width + 9 : 0;
    const w = nw + sw + 14, h = 20, tx = clamp(x + 12, 4, W - w - 6), ty = y + 20;
    ctx.fillStyle = COL.ux.l; ctx.fillRect(tx + 2.5, ty + 2.5, w, h);
    ctx.fillStyle = INK; ctx.fillRect(tx, ty, w, h);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = `700 9.5px ${MONO}`; ctx.fillStyle = '#f7a9d5'; ctx.fillText('WALLY', tx + 7, ty + h / 2 + 0.5);
    if (label) { ctx.font = `600 11px ${BODY}`; ctx.fillStyle = '#fff'; ctx.fillText(label, tx + 7 + nw + 9, ty + h / 2 + 0.5); }
    ctx.textBaseline = 'alphabetic';
  }
  // Figma-style selection while Wally drags the brief onto the slide.
  function selection(t, st) {
    if (!st || t < 3.62 || t > 4.35) return;
    const m = sheetMap(st), pts = [m(0, 0), m(1, 0), m(1, 1), m(0, 1)];
    ctx.save(); ctx.globalAlpha = outCubic(seg(t, 3.62, 3.72)) * (1 - seg(t, 4.25, 4.35));
    poly(pts, null, 1.6, COL.acc.l);
    pts.forEach(q => { ctx.fillStyle = '#fff'; ctx.fillRect(q[0] - 3, q[1] - 3, 6, 6); ctx.lineWidth = 1.2; ctx.strokeStyle = COL.acc.l; ctx.strokeRect(q[0] - 3, q[1] - 3, 6, 6); });
    ctx.restore();
  }

  /* ── Frame ── */
  function draw() {
    const loop = Math.floor(T / DUR), t = T - loop * DUR;
    const n = loop % STEPS;
    ctx.clearRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // Plate + iso grid.
    box(0, 0, -0.35, PX, PY, 0.35, COL.plate, 1.2);
    ctx.strokeStyle = 'rgba(36,84,198,.09)'; ctx.lineWidth = 1;
    for (let i = 1; i < PX; i++) { ctx.beginPath(); ctx.moveTo(...P(i, 0, 0)); ctx.lineTo(...P(i, PY, 0)); ctx.stroke(); }
    for (let j = 1; j < PY; j++) { ctx.beginPath(); ctx.moveTo(...P(0, j, 0)); ctx.lineTo(...P(PX, j, 0)); ctx.stroke(); }

    const list = [];
    const add = (key, fn) => list.push({ key, fn });

    // 01 Account: desk, stamp post + beam, stamp.
    add(4.6, () => {
      box(1.2, 1.2, 0, 2.2, 2.2, DESK, COL.desk);
      // front plate "ACCOUNT" slot detail
      poly([P(1.55, 3.4, 1.05), P(3.05, 3.4, 1.05), P(3.05, 3.4, 0.55), P(1.55, 3.4, 0.55)], '#fff', 0.9);
      [0.2, 0.45, 0.7].forEach((f, i) => poly([P(1.7 + f * 1.1, 3.4, 0.92), P(1.7 + f * 1.1 + 0.22, 3.4, 0.92), P(1.7 + f * 1.1 + 0.22, 3.4, 0.68), P(1.7 + f * 1.1, 3.4, 0.68)], i === 0 ? COL.acc.l : i === 1 ? COL.ux.l : COL.ai.l, 0.7));
    });
    add(4.605, () => { box(1.3, 1.75, DESK, 0.22, 0.22, 1.9, COL.steel); box(1.3, 1.75, 3.5, 1.55, 0.22, 0.18, COL.steel); });
    add(4.62, () => drawStamp(t));

    // Slide from Account down to UX.
    add(6.9, () => {
      const a = P(3.4, 2.3, DESK), b = P(5.4, 2.3, TABLE);
      const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, '#dfe7fb'); g.addColorStop(1, '#fde3f1');
      [4.0, 4.85].forEach(x => box(x - 0.06, 2.24, 0, 0.12, 0.12, zAt(x) - 0.2, COL.steel, 0.8));
      poly([P(3.4, 2.8, DESK), P(5.4, 2.8, TABLE), P(5.4, 2.8, TABLE - 0.2), P(3.4, 2.8, DESK - 0.2)], COL.belt.r, 1.1);
      poly([P(3.4, 1.8, DESK), P(5.4, 1.8, TABLE), P(5.4, 2.8, TABLE), P(3.4, 2.8, DESK)], g, 1.1);
      ctx.lineWidth = 2.5; ctx.strokeStyle = INK;
      [1.82, 2.78].forEach(y => { ctx.beginPath(); ctx.moveTo(...P(3.4, y, DESK + 0.1)); ctx.lineTo(...P(5.4, y, TABLE + 0.1)); ctx.stroke(); });
    });

    // 02 UX: drafting table, conveyor to AI, robot arm, roller.
    add(8.9, () => box(5.4, 1.6, 0, 2.2, 1.6, TABLE, COL.table));
    add(9.2, () => {
      box(6.0, 3.2, 0, 1.0, 2.6, TABLE, COL.belt);
      const off = (T * 1.4) % 0.45;
      ctx.strokeStyle = 'rgba(24,25,27,.2)'; ctx.lineWidth = 1;
      for (let y = 3.2 + off; y < 5.8; y += 0.45) { ctx.beginPath(); ctx.moveTo(...P(6.0, y, TABLE)); ctx.lineTo(...P(7.0, y, TABLE)); ctx.stroke(); }
    });
    const st = sheetState(t);
    add(9.5, () => drawArm(t, st));
    add(9.6, () => drawRoller(t));

    // The traveling object.
    const ball = ballState(t);
    if (ball) add(t < 2.05 ? 30 : 4.615, () => drawBall(ball));
    if (st) add(t < 3.7 ? 4.615 : Math.max(9.3, st.x + st.y + 0.3), () => drawSheet(t, st));

    // 03 AI engine.
    add(13.3, () => drawEngine(t));

    // Staircase: solid steps, the one being built, ghosts for the rest.
    const sink = n === 0 && loop > 0 ? 1 - ss(0, 0.8, t) : 0;
    for (let i = 0; i < STEPS; i++) {
      const key = stepX(i) + 0.45 + 8.55;
      if (i < n) add(key, () => drawStep(i, stepH(i)));
      else if (i === n) add(key, () => { ghostBox(stepX(i), 8.1, 0, 0.9, 0.9, stepH(i)); drawStep(i, stepH(i) * outBack(seg(t, 11.75, 12.15))); });
      else add(key, () => ghostBox(stepX(i), 8.1, 0, 0.9, 0.9, stepH(i)));
      if (sink > 0) add(key + 0.01, () => { ctx.save(); ctx.globalAlpha = sink; drawStep(i, stepH(i) * sink); ctx.restore(); });
    }

    const app = appState(t, n);
    if (app) add(app.air ? 30 : app.z > 0 ? stepX(n) + 9.3 : 15.5, () => drawApp(app));

    list.sort((a, b) => a.key - b.key).forEach(d => { ctx.save(); d.fn(); ctx.restore(); });

    // Overlays: confetti, client bubble, plane, badges, object label.
    confetti(t, n);
    const L = bubbleLayout();
    bubbles(t, L);
    const pl = plane(t, n, L.tail);
    selection(t, st);

    const active = t < 3.7 ? 0 : t < 8.0 ? 1 : t < 12.9 ? 2 : -1;
    badge(P(1.2, 3.4, DESK + 0.1).map((v, i) => v + (i ? -6 : -20)), '01', 'ACCOUNT', 'acc', active === 0);
    badge(P(7.6, 3.2, TABLE).map((v, i) => v + (i ? 34 : 30)), '02', 'UX', 'ux', active === 1);
    badge(P(7.5, 7.8, 0).map((v, i) => v + (i ? 4 : 44)), '03', 'AI', 'ai', active === 2);

    if (ball && t > 1.35) { const [x, y] = P(ball.x, ball.y, ball.z); pill(x, y - 0.4 * s - 8, 'The ask', 'ink'); }
    else if (st && t >= 2.65 && t < 9.2) {
      const [x, y] = P(st.x, st.y, (t < 8.0 ? zAt(st.x) : TABLE) + 0.05);
      const label = t < 4.95 ? ['Brief', 'acc'] : t < 7.15 ? ['Wireframe', 'ux'] : ['Design', 'ux'];
      pill(x, y - 0.95 * s, ...label);
    } else if (t >= 9.2 && t < 10.8) {
      const [x, y] = P(6.5, 6.8, 3.4);
      pill(x + 34, y, 'Building' + '.'.repeat(1 + Math.floor(t * 3) % 3), 'ai');
    } else if (app && t < 12.9) {
      const [x, y] = P(app.x, app.y, app.z + 1.15 * app.k);
      pill(x, y - 10, 'Working POC', 'ai');
    } else if (pl) {
      pill(pl[0], pl[1] - 16, 'Proof → client', 'ai');
    }

    const age = CLICKS.reduce((m, c) => (t >= c && t - c < m ? t - c : m), 1);
    drawCursor(cursorAt(t, n, L), '', age < 0.5 ? age : -1);
  }

  /* ── Loop, pause, seek ── */
  let raf = 0, last = 0, visible = false;
  const tick = ts => { const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; T += dt * SPEED; draw(); raf = requestAnimationFrame(tick); };
  const start = () => { if (raf || motion.matches || paused) return; last = performance.now(); raf = requestAnimationFrame(tick); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const sync = () => (visible && !document.hidden ? start() : stop());
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  new ResizeObserver(() => { resize(); draw(); }).observe(stage);

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.setAttribute('aria-label', paused ? 'Play hero animation' : 'Pause hero animation');
    pauseBtn.querySelector('span').textContent = paused ? 'Play' : 'Pause';
    pauseBtn.querySelector('svg').innerHTML = paused ? '<path d="M2 1 L9 5 L2 9 Z"/>' : '<rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/>';
    paused ? stop() : sync();
  });
  const syncMotionPreference = () => {
    pauseBtn.hidden = motion.matches;
    if (motion.matches) { stop(); T = DUR * 2 + 6.4; draw(); }
    else sync();
  };
  if (motion.addEventListener) motion.addEventListener('change', syncMotionPreference);
  else motion.addListener(syncMotionPreference);
  if (motion.matches) T = DUR * 2 + 6.4;

  // Debug/test hook: window.__heroSeek(seconds) paints that moment.
  window.__heroSeek = sec => { T = sec; draw(); };

  resize(); draw();
  syncMotionPreference();
})();
