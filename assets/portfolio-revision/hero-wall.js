/* Studio-wall hero for UX / product routes: the double diamond, physically.
   User quotes pin onto a team's working wall, Wally sorts them into
   clusters under a "How might we" card, a sheet of thumbnail sketches is
   dot-voted, the winner lifts off the wall and firms up into a paper
   prototype, a test snag flies back onto the wall as a new note, the fix
   lands, and the same components carry into two more screens. */
(function HeroWall() {
  const stage = document.getElementById('machine');
  if (!stage) return;
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
  const ease = k => (k < 0.5 ? 16 * k ** 5 : 1 - (-2 * k + 2) ** 5 / 2); // quint in-out: calm starts and stops
  const inOut = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
  const easeOut = k => 1 - (1 - k) ** 4;
  const bell = k => Math.sin(Math.PI * clamp(k, 0, 1));
  const mix = (a, b, k) => a.map((v, i) => lerp(v, b[i], k));
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixHex = (a, b, k) => `rgb(${mix(rgb(a), rgb(b), k).map(Math.round).join(',')})`;
  function rng(seed) { // mulberry32: the same scribbles every loop
    return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let r = Math.imul(seed ^ (seed >>> 15), 1 | seed); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }

  /* ── Palette (Proof Grid) ── */
  const INK = '#18191b', FAINT = '#9aa0a8', RULE = '#d6d8da';
  const COBALT = '#2454c6', PINK = '#e548a5', CYAN = '#079fc4';
  const ACC = {
    cobalt: { main: COBALT, deep: '#183d97', light: '#dbe4f8' },
    pink: { main: PINK, deep: '#a90f68', light: '#fbdcee' },
    cyan: { main: CYAN, deep: '#05789a', light: '#d3f1f8' },
  };
  const NOTE_FILL = { y: '#fff1a6', p: '#fcd3e8', c: '#cdeff8' };
  const BOARD = '#f4f1ea', PAPER = '#fffdf8', SHEET = '#fbf8f1';

  /* ── Layout (design units) ── */
  const VW = 460, VH = 386, TOP = 8, BOTTOM = 52, MAX_K = 1.12;
  const DUR = 22;
  const BEATS = [
    { name: 'Empathize', at: 0 },
    { name: 'Define', at: 3.2 },
    { name: 'Ideate', at: 6.7 },
    { name: 'Prototype', at: 10.2 },
    { name: 'Test', at: 12.3 },
    { name: 'Scale', at: 17.6 },
  ];
  const WX0 = 14, WY0 = 38, WX1 = 446, WY1 = 370;   // the board
  const CAM = [230, 205];                           // the wall recedes around this point
  const NW = 54, NH = 46;                           // sticky note

  /* ── Sticky notes: scattered as they are pinned, then sorted into clusters ── */
  // [x, y, rot] are top-left corners on the wall. d = [drag start, drag end].
  const NOTES = [
    { c: 'y', from: [58, 250, -0.07], to: [90, 104, 0.04], d: [3.72, 4.42] },
    { c: 'y', from: [206, 64, 0.05], to: [32, 100, -0.03], d: [3.6, 4.2], lines: ['Too many', 'steps.'] },
    { c: 'p', from: [362, 234, 0.06], to: [206, 146, 0.05], d: [4.74, 5.4] },
    { c: 'c', from: [150, 190, -0.05], to: [178, 96, 0.03], d: [4.6, 5.2], lines: ['I lose my', 'place.'] },
    { c: 'p', from: [292, 150, 0.04], to: [34, 150, 0.03], d: [3.82, 4.52], lines: ['I gave up', 'halfway.'] },
    { c: 'c', from: [190, 268, -0.06], to: [326, 100, -0.03], d: [5.6, 6.2] },
    { c: 'y', from: [380, 78, 0.07], to: [92, 154, -0.04], d: [3.92, 4.62] },
    { c: 'c', from: [300, 50, -0.04], to: [236, 100, -0.04], d: [4.84, 5.5] },
    { c: 'p', from: [278, 304, 0.05], to: [382, 108, 0.05], d: [5.72, 6.32] },
  ].map((n, i) => {
    const r = rng(11 + i * 7);
    const scrib = n.lines ? null : [0, 1, 2].map(j => ({ y: 15 + j * 9, w: j === 2 ? 16 + r() * 10 : 30 + r() * 12, ph: r() * 6 }));
    return { ...n, i, at: 0.3 + i * 0.26, scrib };
  });
  const LEADS = [1, 3, 5];                         // the notes Wally's cursor actually holds
  const HMW = { x: 30, y: 56, w: 120, h: 34, at: 6.25 };
  const SNAG = { lines: ['What do I', 'do next?'], c: 'p', land: [44, 212, -0.07], emerge: 14.5, fly: [14.8, 15.6] };

  /* ── The sheet of thumbnails ── */
  const SH = { x: 118, y: 214, w: 224, h: 146, at: 6.85, uh: [7.2, 7.6], uv: [7.6, 8.0] };
  const PW = 44, PH = 57;
  const panelRect = i => ({ x: SH.x + 12 + (i % 4) * 52, y: SH.y + 12 + Math.floor(i / 4) * 65, w: PW, h: PH });
  const WIN = 5;
  const DOTS = [
    { panel: 2, col: CYAN, at: 9.1, off: [0, 0] },
    { panel: WIN, col: PINK, at: 9.4, off: [0, 0] },
    { panel: WIN, col: COBALT, at: 9.75, off: [-8.5, 0.5] },
  ];

  // Screen layouts in unit coordinates (0..1 across the screen).
  const BTN_SMALL = [0.6, 0.84, 0.31, 0.07], BTN_FULL = [0.09, 0.8, 0.82, 0.11];
  const bar = (u, v, u1, th = 0.026, title = false) => ({ k: 'bar', u, v, u1, th, title });
  const box = (k, u, v, w, h) => ({ k, u, v, w, h });
  const circ = (u, v, r) => ({ k: 'circ', u, v, r });
  const LAYOUTS = [
    [bar(0.12, 0.1, 0.6, 0.03, true), box('img', 0.12, 0.2, 0.76, 0.3), bar(0.12, 0.58, 0.82), bar(0.12, 0.66, 0.62), box('btn', 0.12, 0.8, 0.76, 0.09)],
    [circ(0.5, 0.26, 0.15), bar(0.2, 0.52, 0.8, 0.03, true), bar(0.3, 0.6, 0.7), box('btn', 0.25, 0.78, 0.5, 0.09)],
    [bar(0.12, 0.1, 0.55, 0.03, true), box('box', 0.12, 0.2, 0.76, 0.14), box('box', 0.12, 0.4, 0.76, 0.14), box('box', 0.12, 0.6, 0.76, 0.14), box('btn', 0.5, 0.83, 0.38, 0.07)],
    [box('img', 0.12, 0.12, 0.34, 0.26), box('img', 0.54, 0.12, 0.34, 0.26), box('box', 0.12, 0.45, 0.34, 0.26), box('box', 0.54, 0.45, 0.34, 0.26), bar(0.12, 0.83, 0.7)],
    [bar(0.12, 0.1, 0.5, 0.03, true), box('field', 0.12, 0.22, 0.76, 0.1), box('field', 0.12, 0.38, 0.76, 0.1), box('field', 0.12, 0.54, 0.76, 0.1), box('btn', 0.12, 0.76, 0.76, 0.1)],
    [ // the winner, and the prototype it becomes
      bar(0.09, 0.075, 0.5, 0.036, true), box('box', 0.09, 0.16, 0.82, 0.19), box('img', 0.14, 0.195, 0.14, 0.12),
      bar(0.33, 0.225, 0.8), bar(0.33, 0.285, 0.62), bar(0.09, 0.43, 0.36), box('field', 0.09, 0.46, 0.82, 0.09),
      bar(0.09, 0.61, 0.3), box('field', 0.09, 0.64, 0.82, 0.09), { k: 'btn', u: BTN_SMALL[0], v: BTN_SMALL[1], w: BTN_SMALL[2], h: BTN_SMALL[3], main: true },
    ],
    [circ(0.28, 0.2, 0.1), bar(0.45, 0.17, 0.86), bar(0.45, 0.24, 0.7), box('img', 0.12, 0.36, 0.76, 0.34), box('btn', 0.12, 0.8, 0.36, 0.08), box('btn', 0.52, 0.8, 0.36, 0.08)],
    [bar(0.12, 0.1, 0.72, 0.03, true), bar(0.12, 0.19, 0.84), bar(0.12, 0.27, 0.6), box('img', 0.12, 0.37, 0.76, 0.28), box('btn', 0.3, 0.76, 0.4, 0.1)],
  ];
  const SIDE_LAYOUTS = {
    cyan: [
      bar(0.09, 0.075, 0.46, 0.036, true),
      ...[0.18, 0.34, 0.5].flatMap(v => [circ(0.17, v + 0.06, 0.06), bar(0.3, v + 0.035, 0.84), bar(0.3, v + 0.09, 0.62), bar(0.09, v + 0.145, 0.91, 0.004)]),
    ],
    pink: [bar(0.09, 0.075, 0.52, 0.036, true), box('img', 0.09, 0.16, 0.82, 0.28), bar(0.09, 0.5, 0.74), bar(0.09, 0.56, 0.5), box('field', 0.09, 0.64, 0.82, 0.09)],
  };
  // Scribble strokes for every element, with fixed jitter so each sketch keeps its hand.
  function scribbleOf(el, r) {
    const pts = [];
    if (el.k === 'bar') {
      const n = Math.max(3, Math.round((el.u1 - el.u) * 12));
      for (let i = 0; i <= n; i++) pts.push([lerp(el.u, el.u1, i / n), el.v, i % 2 ? 1 : -1]);
      return [pts.map(p => ({ p, j: [r() - 0.5, r() - 0.5], z: p[2] }))];
    }
    if (el.k === 'circ') {
      for (let i = 0; i <= 15; i++) { const a = -1.9 + (i / 14) * Math.PI * 2; pts.push([el.u + Math.cos(a) * el.r, el.v + Math.sin(a) * el.r * 0.75]); }
      return [pts.map(p => ({ p, j: [r() - 0.5, r() - 0.5] }))];
    }
    const { u, v, w, h } = el, c = [[u, v], [u + w, v], [u + w, v + h], [u, v + h], [u + 0.02, v - 0.005]];
    for (let s = 0; s < 4; s++) for (let i = 0; i < 3; i++) pts.push(mix(c[s], c[s + 1] || c[4], i / 3));
    pts.push(c[4]);
    const strokes = [pts.map(p => ({ p, j: [r() - 0.5, r() - 0.5] }))];
    if (el.k === 'img') strokes.push([[u + w * 0.15, v + h * 0.2], [u + w * 0.85, v + h * 0.8]].map(p => ({ p, j: [r() - 0.5, r() - 0.5] })));
    if (el.k === 'btn') strokes.push([[u + w * 0.3, v + h / 2], [u + w * 0.7, v + h / 2]].map(p => ({ p, j: [r() - 0.5, r() - 0.5] })));
    return strokes;
  }
  const SCRIBS = LAYOUTS.map((L, i) => { const r = rng(101 + i * 13); return L.map(el => scribbleOf(el, r)); });

  /* ── Floating screens ── */
  const S_TEST = { x: 155, y: 112, w: 150, h: 200 };
  const S_C = { x: 167, y: 122, w: 126, h: 168 };
  const S_L = { ...S_C, x: S_C.x - 142 }, S_R = { ...S_C, x: S_C.x + 142 };
  const at = (R, u, v) => [R.x + u * R.w, R.y + v * R.h];

  /* ── Timeline helpers ── */
  const LIFT = [10.3, 11.3], FIRM = [11.3, 12.0];
  const FIX = [15.9, 16.5], FILL = [16.5, 16.75], PAY = 17.15;
  const CLEAR = [20.9, 21.6];
  const recede = t => ease(seg(t, LIFT[0], LIFT[1])) * (1 - ease(seg(t, 21.0, 21.8)));
  const dip = t => ease(seg(t, 14.7, 15.4)) * (1 - ease(seg(t, 15.9, 16.6)));  // the wall comes back into focus for the snag
  const wallScale = t => 1 - 0.08 * recede(t) + 0.025 * dip(t);
  const wash = t => Math.max(0, 0.5 * recede(t) - 0.34 * dip(t));
  const wmap = (p, s) => [CAM[0] + (p[0] - CAM[0]) * s, CAM[1] + (p[1] - CAM[1]) * s];
  const wallFade = (t, i = 0) => 1 - seg(t, 20.2 + i * 0.03, 20.8 + i * 0.03);

  function noteState(n, t) {
    if (t < n.at) return null;
    const land = easeOut(seg(t, n.at, n.at + 0.6));
    const m = ease(seg(t, n.d[0], n.d[1]));
    const p = mix(n.from, n.to, m);
    const held = seg(t, n.d[0] - 0.08, n.d[0] + 0.12) * (1 - seg(t, n.d[1] - 0.08, n.d[1] + 0.12));
    const lift = Math.max(1 - land, held * 0.75);
    return {
      x: p[0] + NW / 2 + (1 - land) * 10, y: p[1] + NH / 2 - (1 - land) * 14, rot: p[2] + (1 - land) * 0.1,
      lift, a: seg(t, n.at, n.at + 0.2) * wallFade(t, n.i), moving: held > 0.02 || land < 0.98,
    };
  }
  const buttonRect = t => mix(BTN_SMALL, BTN_FULL, inOut(seg(t, FIX[0], FIX[1])));

  /* ── The tester: a capsule taps through the screen ── */
  const PERSON = [
    { t: 12.4, uv: [1.12, 0.5] }, { t: 12.85, uv: [0.62, 0.505] }, { t: 13.25, uv: [0.58, 0.505] },
    { t: 13.75, uv: [0.46, 0.685] }, { t: 14.05, uv: [0.46, 0.685] }, { t: 14.45, uv: [0.34, 0.86] },
    { t: 14.95, uv: [0.47, 0.835] }, { t: 15.45, uv: [0.38, 0.855] }, { t: 16.6, uv: [0.38, 0.855] },
    { t: 17.05, uv: [0.7, 0.855] }, { t: 17.5, uv: [0.7, 0.855] }, { t: 17.9, uv: [0.9, 1.08] },
  ];
  const TAPS = [{ t: 13.05, uv: [0.58, 0.505] }, { t: 13.85, uv: [0.46, 0.685] }, { t: PAY, uv: [0.7, 0.855] }];
  const STALLS = [14.5, 14.95];
  function personAt(t) {
    if (t < PERSON[0].t || t > PERSON[PERSON.length - 1].t) return null;
    let i = 0;
    while (i < PERSON.length - 2 && t > PERSON[i + 1].t) i++;
    const a = PERSON[i], b = PERSON[i + 1], q = inOut(seg(t, a.t, b.t));
    const alpha = seg(t, 12.4, 12.7) * (1 - seg(t, 17.55, 17.9));
    return { uv: mix(a.uv, b.uv, q), alpha, stuck: seg(t, 14.35, 14.6) * (1 - seg(t, 16.55, 16.8)) };
  }

  /* ── Wally's cursor: sorts the notes, then fixes the button ── */
  const grab = (n, t) => { const s = noteState(n, t); return [s.x + 4, s.y + 2]; };
  const handle = t => { const b = buttonRect(t); return at(S_TEST, b[0], b[1]); };
  const CURSOR = [
    [
      { a: 3.2, b: 3.2, at: () => [VW - 40, 300] },
      { a: 3.6, b: 4.2, at: t => grab(NOTES[1], t) },
      { a: 4.6, b: 5.2, at: t => grab(NOTES[3], t) },
      { a: 5.6, b: 6.2, at: t => grab(NOTES[5], t) },
      { a: 6.65, b: 6.65, at: () => [VW - 36, 330] },
    ],
    [
      { a: 15.35, b: 15.35, at: () => [VW - 36, 350] },
      { a: 15.85, b: FILL[1], at: handle },
      { a: 17.1, b: 17.1, at: () => [VW - 30, 360] },
    ],
  ];
  const CLICKS = [3.6, 4.6, 5.6, 15.85];
  function cursorAt(t) {
    for (const ks of CURSOR) {
      const a0 = ks[0].a, b1 = ks[ks.length - 1].b;
      if (t < a0 || t > b1) continue;
      const alpha = seg(t, a0, a0 + 0.2) * (1 - seg(t, b1 - 0.2, b1));
      for (let i = 0; i < ks.length; i++) {
        const h = ks[i], nx = ks[i + 1];
        if (t >= h.a && t <= h.b) return { p: h.at(t), alpha };
        if (nx && t > h.b && t < nx.a) {
          const q = inOut((t - h.b) / (nx.a - h.b)), p0 = h.at(h.b), p1 = nx.at(nx.a);
          const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
          return { p: [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - Math.sin(q * Math.PI) * Math.min(24, d * 0.18)], alpha };
        }
      }
    }
    return null;
  }

  /* ── Canvas sizing ── */
  let W = 0, H = 0, k = 1, ox = 0, oy = 0, dpr = 1, T = 0, paused = false;
  const SPEED = 1; // 1 = the 22s choreography
  function resize() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    k = Math.min(MAX_K, (W - 16) / VW, (H - BOTTOM) / (VH + TOP));
    ox = (W - VW * k) / 2;
    oy = TOP * k + (H - BOTTOM - (VH + TOP) * k) / 2;
  }

  /* ── Primitives ── */
  function rr(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function text(str, x, y, font, color, align = 'left') {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y);
  }
  function cursor(x, y, age) {
    if (age >= 0 && age < 0.45) {
      const q = age / 0.45;
      ctx.beginPath(); ctx.arc(x, y, 4 + q * 14, 0, Math.PI * 2); ctx.strokeStyle = `rgba(229,72,165,${0.9 * (1 - q)})`; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 16); ctx.lineTo(4.4, 12.2); ctx.lineTo(7.4, 18.8); ctx.lineTo(10.3, 17.5); ctx.lineTo(7.3, 11.1); ctx.lineTo(12.7, 10.8); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 2.6; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
    ctx.font = `700 8.5px ${MONO}`;
    const w = ctx.measureText('WALLY').width + 11;
    ctx.fillStyle = PINK; ctx.fillRect(x + 12, y + 20, w, 16);
    ctx.fillStyle = INK; ctx.fillRect(x + 10, y + 18, w, 16);
    text('WALLY', x + 15.5, y + 26.5, `700 8.5px ${MONO}`, '#f7a9d5');
  }
  function pinHead(x, y, a = 1) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.arc(x + 1.2, y + 1.4, 2.7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(24,25,27,.22)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 2.7, 0, Math.PI * 2); ctx.fillStyle = '#34373c'; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 0.9, y - 0.9, 0.8, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill();
    ctx.restore();
  }
  function tape(x, y, rot, w = 22) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(233,226,206,.86)'; ctx.fillRect(-w / 2, -4, w, 8);
    ctx.strokeStyle = 'rgba(24,25,27,.18)'; ctx.lineWidth = 0.6; ctx.strokeRect(-w / 2, -4, w, 8);
    ctx.restore();
  }

  /* ── The board: a pinboard with a faint grid, a ledge, two markers ── */
  const SPECK = (() => { const r = rng(7); return Array.from({ length: 150 }, () => [WX0 + 4 + r() * (WX1 - WX0 - 8), WY0 + 4 + r() * (WY1 - WY0 - 8), 0.4 + r() * 0.6]); })();
  function drawBoard() {
    ctx.fillStyle = 'rgba(36,84,198,.12)'; ctx.fillRect(WX0 + 5, WY0 + 5, WX1 - WX0, WY1 - WY0 + 8);
    ctx.fillStyle = BOARD; ctx.fillRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
    ctx.fillStyle = 'rgba(24,25,27,.075)';
    for (let x = WX0 + 12; x < WX1 - 4; x += 12) for (let y = WY0 + 12; y < WY1 - 4; y += 12) ctx.fillRect(x - 0.45, y - 0.45, 0.9, 0.9);
    ctx.fillStyle = 'rgba(128,100,62,.12)';
    SPECK.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1; ctx.strokeRect(WX0 + 2.5, WY0 + 2.5, WX1 - WX0 - 5, WY1 - WY0 - 5);
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(WX0, WY0, WX1 - WX0, WY1 - WY0);
    // Ledge with two markers resting on it.
    ctx.fillStyle = '#e6e2d9'; ctx.fillRect(WX0 - 3, WY1, WX1 - WX0 + 6, 8);
    ctx.strokeStyle = INK; ctx.strokeRect(WX0 - 3, WY1, WX1 - WX0 + 6, 8);
    [[352, COBALT], [388, PINK]].forEach(([x, c]) => {
      rr(x, WY1 - 4.5, 28, 5.5, 2.75); ctx.fillStyle = c; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 20, WY1 - 4, 1.2, 4.5);
    });
  }

  /* ── A sticky note, centred at (x, y); lift raises it toward the viewer ── */
  function note(s, fill, lines, scrib, scale = 1) {
    const { x, y, rot, lift, a } = s;
    if (a <= 0.01) return;
    const sc = scale * (1 + 0.1 * lift), d = 2.2 + 7 * lift;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.save(); ctx.translate(x + d * scale, y + d * scale); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.fillStyle = `rgba(24,25,27,${0.16 - 0.05 * lift})`; ctx.fillRect(-NW / 2, -NH / 2, NW, NH);
    ctx.restore();
    ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sc, sc);
    ctx.fillStyle = fill; ctx.fillRect(-NW / 2, -NH / 2, NW, NH);
    ctx.fillStyle = 'rgba(24,25,27,.04)'; ctx.fillRect(-NW / 2, -NH / 2, NW, 7); // adhesive strip
    ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(24,25,27,.62)'; ctx.strokeRect(-NW / 2, -NH / 2, NW, NH);
    if (lines) lines.forEach((l, i) => text(l, -NW / 2 + 5.5, -NH / 2 + 17 + i * 10, `600 7.8px ${BODY}`, INK));
    else if (scrib) {
      ctx.beginPath();
      scrib.forEach(sl => {
        for (let i = 0; i <= 8; i++) {
          const px = -NW / 2 + 6 + (sl.w * i) / 8, py = -NH / 2 + sl.y + Math.sin(i * 1.9 + sl.ph) * 1.1;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
      });
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(24,25,27,.5)'; ctx.stroke();
    }
    pinHead(0, -NH / 2 + 5, 1 - seg(lift, 0.08, 0.3));
    ctx.restore();
  }

  /* ── A layout drawn at rect R: scribbled (f = 0) or clean (f = 1) ── */
  function strokePart(st, R, A, q, wave) {
    const n = st.length - 1, end = q * n;
    if (end <= 0) return;
    const pt = i => pointOf(st[i], R, A, wave), full = Math.floor(end);
    ctx.beginPath(); ctx.moveTo(...pt(0));
    for (let i = 1; i <= full; i++) ctx.lineTo(...pt(i));
    if (full < n && end > full) ctx.lineTo(...mix(pt(full), pt(full + 1), end - full));
    ctx.stroke();
  }
  function pointOf(s, R, A, wave) {
    const [x, y] = at(R, s.p[0], s.p[1]);
    return [x + s.j[0] * A, y + s.j[1] * A + (s.z || 0) * wave];
  }
  function drawSketch(li, R, p, f, A, btnR) {
    const L = LAYOUTS[li], S = SCRIBS[li], z = R.w / PW;
    if (f < 1) {
      const all = S.flat(), n = all.length;
      ctx.save(); ctx.globalAlpha *= 1 - f;
      ctx.lineWidth = 0.75 * Math.sqrt(z); ctx.strokeStyle = 'rgba(24,25,27,.78)';
      all.forEach((st, j) => strokePart(st, R, A * (1 - f), clamp(p * n - j, 0, 1), 0.012 * R.h * (1 - f)));
      ctx.restore();
    }
    if (f > 0) { ctx.save(); ctx.globalAlpha *= f; L.forEach(el => firm(el, R, ACC.cobalt, btnR)); ctx.restore(); }
  }
  function firm(el, R, acc, btnR) {
    const sc = R.w / 150;
    if (el.k === 'bar') {
      const [x0, y] = at(R, el.u, el.v), [x1] = at(R, el.u1, el.v), th = Math.max(0.8, el.th * R.h);
      rr(x0, y - th / 2, x1 - x0, th, th / 2); ctx.fillStyle = el.title ? INK : el.th < 0.01 ? RULE : '#c3c7cd'; ctx.fill();
    } else if (el.k === 'circ') {
      const [x, y] = at(R, el.u, el.v); ctx.beginPath(); ctx.arc(x, y, el.r * R.w * 0.8, 0, Math.PI * 2); ctx.fillStyle = acc.light; ctx.fill();
    } else if (el.k === 'btn') {
      if (el.main && btnR) return; // drawn by the screen with its current state
      const [x, y] = at(R, el.u, el.v); rr(x, y, el.w * R.w, el.h * R.h, 3 * sc); ctx.fillStyle = acc.main; ctx.fill();
    } else {
      const [x, y] = at(R, el.u, el.v), w = el.w * R.w, h = el.h * R.h;
      rr(x, y, w, h, (el.k === 'img' ? 2.5 : 3) * sc);
      if (el.k === 'img') { ctx.fillStyle = acc.light; ctx.fill(); }
      else if (el.k === 'field') { ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 0.9; ctx.strokeStyle = FAINT; ctx.stroke(); }
      else { ctx.lineWidth = 0.9; ctx.strokeStyle = RULE; ctx.stroke(); }
    }
  }
  // The shared button component: ghosted and small before the fix, solid after.
  function mainButton(R, b, solid, acc, label, check = 0) {
    const sc = R.w / 150, [x, y] = at(R, b[0], b[1]), w = b[2] * R.w, h = b[3] * R.h;
    rr(x, y, w, h, 3 * sc);
    if (solid > 0) { ctx.fillStyle = `rgba(${rgb(acc.main).join(',')},${solid})`; ctx.fill(); }
    ctx.lineWidth = 0.9; ctx.strokeStyle = mixHex('#b9bdc4', acc.main, solid); ctx.stroke();
    const col = mixHex(FAINT, '#ffffff', solid);
    if (check < 1) { ctx.save(); ctx.globalAlpha *= 1 - check; text(label, x + w / 2, y + h / 2 + 0.3, `600 ${lerp(6.8, 8, solid) * sc}px ${BODY}`, col, 'center'); ctx.restore(); }
    if (check > 0) {
      ctx.save(); ctx.globalAlpha *= check;
      ctx.beginPath(); ctx.moveTo(x + w / 2 - 4.5 * sc, y + h / 2); ctx.lineTo(x + w / 2 - 1.2 * sc, y + h / 2 + 3.2 * sc); ctx.lineTo(x + w / 2 + 5 * sc, y + h / 2 - 3.4 * sc);
      ctx.lineWidth = 1.6 * sc; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
    }
  }
  function card(R, d, fill = PAPER, rot = 0) {
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2, r = Math.max(2, 6 * R.w / 150);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    rr(-R.w / 2 + d, -R.h / 2 + d, R.w, R.h, r); ctx.fillStyle = 'rgba(36,84,198,.13)'; ctx.fill();
    rr(-R.w / 2, -R.h / 2, R.w, R.h, r); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }

  /* ── The sheet: pinned folded, opens out, eight sketches, dot votes ── */
  function drawSheet(t) {
    if (t < SH.at) return;
    const a = seg(t, SH.at, SH.at + 0.25) * wallFade(t, 4);
    const drop = 1 - easeOut(seg(t, SH.at, SH.at + 0.5));
    const eh = ease(seg(t, SH.uh[0], SH.uh[1])), ev = ease(seg(t, SH.uv[0], SH.uv[1]));
    const w = SH.w * (0.5 + 0.5 * eh), h = SH.h * (0.5 + 0.5 * ev);
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(drop * 6, -drop * 10);
    const d = 2.5 + drop * 6;
    ctx.fillStyle = 'rgba(24,25,27,.13)'; ctx.fillRect(SH.x + d, SH.y + d, w, h);
    ctx.fillStyle = SHEET; ctx.fillRect(SH.x, SH.y, w, h);
    // The flap still turning reads a shade darker.
    if (eh > 0 && eh < 1) { ctx.fillStyle = `rgba(24,25,27,${0.07 * (1 - eh)})`; ctx.fillRect(SH.x + SH.w / 2, SH.y, w - SH.w / 2, h); }
    if (ev > 0 && ev < 1) { ctx.fillStyle = `rgba(24,25,27,${0.07 * (1 - ev)})`; ctx.fillRect(SH.x, SH.y + SH.h / 2, w, h - SH.h / 2); }
    ctx.lineWidth = 0.9; ctx.strokeStyle = INK; ctx.strokeRect(SH.x, SH.y, w, h);
    // Fold creases stay faintly.
    if (eh > 0.98) { ctx.strokeStyle = 'rgba(24,25,27,.07)'; ctx.beginPath(); ctx.moveTo(SH.x + SH.w / 2, SH.y + 1); ctx.lineTo(SH.x + SH.w / 2, SH.y + h - 1); ctx.stroke(); }
    if (ev > 0.98) { ctx.beginPath(); ctx.moveTo(SH.x + 1, SH.y + SH.h / 2); ctx.lineTo(SH.x + SH.w - 1, SH.y + SH.h / 2); ctx.stroke(); }
    // Panels and their sketches.
    const grid = seg(t, 7.95, 8.25);
    if (grid > 0) {
      ctx.save(); ctx.globalAlpha *= grid;
      for (let i = 0; i < 8; i++) {
        const R = panelRect(i);
        const lifted = i === WIN && t >= LIFT[0];
        ctx.fillStyle = lifted ? SHEET : PAPER; ctx.fillRect(R.x, R.y, R.w, R.h);
        if (lifted) { ctx.setLineDash([2, 2]); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(24,25,27,.35)'; ctx.strokeRect(R.x, R.y, R.w, R.h); ctx.setLineDash([]); continue; }
        ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(24,25,27,.3)'; ctx.strokeRect(R.x, R.y, R.w, R.h);
        const p = seg(t, 8.2 + i * 0.1, 8.8 + i * 0.1);
        if (p > 0) drawSketch(i, R, p, 0, 0.8, null);
      }
      ctx.restore();
    }
    // The winner gets a cobalt frame once the third dot lands.
    const win = seg(t, 9.95, 10.25) * (1 - seg(t, LIFT[0], LIFT[0] + 0.15));
    if (win > 0) { const R = panelRect(WIN); ctx.save(); ctx.globalAlpha *= win; ctx.lineWidth = 1.6; ctx.strokeStyle = COBALT; ctx.strokeRect(R.x - 2.5, R.y - 2.5, R.w + 5, R.h + 5); ctx.restore(); }
    DOTS.forEach(dt => {
      if (t < dt.at) return;
      if (dt.panel === WIN && t > LIFT[0]) return; // they ride along on the lifted sketch
      dot(dotPos(dt, panelRect(dt.panel)), dt, t, 1);
    });
    tape(SH.x + 8, SH.y + 1, -0.5);
    if (eh > 0.9) tape(SH.x + SH.w - 8, SH.y + 1, 0.5);
    ctx.restore();
  }
  const dotPos = (dt, R) => [R.x + R.w - 7 + dt.off[0] * R.w / PW, R.y + 7 + dt.off[1] * R.w / PW];
  function dot([x, y], dt, t, s) {
    const q = easeOut(seg(t, dt.at, dt.at + 0.45)), r = 3.6 * s * lerp(1.7, 1, q), off = lerp(4, 1, q) * s;
    ctx.save(); ctx.globalAlpha *= seg(t, dt.at, dt.at + 0.12);
    ctx.beginPath(); ctx.arc(x + off, y + off, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(24,25,27,.2)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = dt.col; ctx.fill(); ctx.lineWidth = 0.8; ctx.strokeStyle = INK; ctx.stroke();
    ctx.restore();
  }

  /* ── The "How might we" card ── */
  function drawHmw(t) {
    if (t < HMW.at) return;
    const land = easeOut(seg(t, HMW.at, HMW.at + 0.6)), lift = 1 - land;
    const a = seg(t, HMW.at, HMW.at + 0.2) * wallFade(t, 2);
    const x = HMW.x + lift * 10, y = HMW.y - lift * 14, d = 2.5 + lift * 7, sc = 1 + 0.1 * lift;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(x + HMW.w / 2, y + HMW.h / 2); ctx.rotate(-0.015 + lift * 0.08);
    ctx.fillStyle = 'rgba(24,25,27,.2)'; ctx.fillRect(-HMW.w / 2 * sc + d, -HMW.h / 2 * sc + d, HMW.w * sc, HMW.h * sc);
    ctx.scale(sc, sc);
    ctx.fillStyle = COBALT; ctx.fillRect(-HMW.w / 2, -HMW.h / 2, HMW.w, HMW.h);
    ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.strokeRect(-HMW.w / 2, -HMW.h / 2, HMW.w, HMW.h);
    text('How might we cut', -HMW.w / 2 + 8, -4.5, `600 8.2px ${BODY}`, '#fff');
    text('the extra steps?', -HMW.w / 2 + 8, 6.5, `600 8.2px ${BODY}`, '#fff');
    pinHead(HMW.w / 2 - 8, -HMW.h / 2 + 6, 1 - seg(lift, 0.08, 0.3));
    ctx.restore();
  }

  /* ── Frame ── */
  function draw() {
    const t = ((T % DUR) + DUR) % DUR;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    /* Step indicator: one quiet line of text, the current step underlined. */
    const bi = BEATS.reduce((cur, b, i) => (t >= b.at ? i : cur), 0);
    const back = ease(seg(t, 21.5, 21.95)); // underline returns to the start as the loop closes
    ctx.font = `700 9px ${MONO}`;
    const sep = ' · ';
    const labels = BEATS.map(b => b.name.toUpperCase());
    const widths = labels.map(l => ctx.measureText(l).width), sepW = ctx.measureText(sep).width;
    const total = widths.reduce((a, b) => a + b, 0) + sepW * (labels.length - 1);
    let x = VW / 2 - total / 2;
    const xs = [];
    const lit = back > 0.5 ? 0 : bi;
    labels.forEach((l, i) => {
      xs.push(x);
      text(l, x, 14, `700 9px ${MONO}`, i === lit ? INK : FAINT);
      x += widths[i];
      if (i < labels.length - 1) { text(sep, x, 14, `700 9px ${MONO}`, RULE); x += sepW; }
    });
    const move = ease(seg(t, BEATS[bi].at, BEATS[bi].at + 0.5));
    const pi = Math.max(0, bi - 1);
    let ux = bi === 0 ? xs[0] : lerp(xs[pi], xs[bi], move), uw = bi === 0 ? widths[0] : lerp(widths[pi], widths[bi], move);
    if (back > 0) { ux = lerp(ux, xs[0], back); uw = lerp(uw, widths[0], back); }
    ctx.fillStyle = COBALT; ctx.fillRect(ux, 24, uw, 2);

    /* ── The wall, which recedes a little once a sketch lifts off it ── */
    const ws = wallScale(t);
    ctx.save();
    ctx.translate(CAM[0], CAM[1]); ctx.scale(ws, ws); ctx.translate(-CAM[0], -CAM[1]);
    drawBoard();
    drawSheet(t);
    const states = NOTES.map(n => ({ n, s: noteState(n, t) })).filter(o => o.s);
    const still = states.filter(o => !o.s.moving), moving = states.filter(o => o.s.moving);
    still.forEach(o => note(o.s, NOTE_FILL[o.n.c], o.n.lines, o.n.scrib));
    drawHmw(t);
    // The snag from testing, once it has landed back on the wall.
    if (t >= SNAG.fly[1]) {
      const settle = easeOut(seg(t, SNAG.fly[1], SNAG.fly[1] + 0.3));
      note({ x: SNAG.land[0] + NW / 2, y: SNAG.land[1] + NH / 2, rot: SNAG.land[2], lift: 0.25 * (1 - settle), a: wallFade(t, 3) }, NOTE_FILL.p, SNAG.lines, null);
    }
    moving.sort((a, b) => a.s.lift - b.s.lift).forEach(o => note(o.s, NOTE_FILL[o.n.c], o.n.lines, o.n.scrib));
    const wa = wash(t);
    if (wa > 0.005) { ctx.fillStyle = `rgba(251,250,247,${wa})`; ctx.fillRect(WX0 - 4, WY0 - 1, WX1 - WX0 + 10, WY1 - WY0 + 12); }
    ctx.restore();

    /* ── In front of the wall ── */
    // Scale: two more screens slide out from behind the first, same components.
    const clr = ease(seg(t, CLEAR[0], CLEAR[1]));
    const sink = R => { const s = 1 - 0.08 * clr; return { x: CAM[0] + (R.x - CAM[0]) * s, y: CAM[1] + (R.y - CAM[1]) * s + 6 * clr, w: R.w * s, h: R.h * s }; };
    const settle = ease(seg(t, 17.7, 18.3));
    [[S_L, 'cyan', 'Review', 17.95], [S_R, 'pink', 'Share', 18.1]].forEach(([R, key, label, go]) => {
      if (t < go || t >= CLEAR[1]) return;
      const e = ease(seg(t, go, go + 0.8)), sr = sink({ x: lerp(S_C.x, R.x, e), y: lerp(S_C.y + 4, R.y, e), w: R.w, h: R.h });
      ctx.save(); ctx.globalAlpha = seg(t, go, go + 0.2) * (1 - clr);
      card(sr, lerp(2, 6, e) * (1 - clr * 0.6));
      SIDE_LAYOUTS[key].forEach(el => firm(el, sr, ACC[key], null));
      mainButton(sr, BTN_FULL, 1, ACC[key], label);
      pulse(sr, t);
      ctx.restore();
    });

    // Prototype: the winning sketch lifts off the sheet toward the viewer and firms up.
    if (t >= LIFT[0] && t < CLEAR[1]) {
      const e = ease(seg(t, LIFT[0], LIFT[1]));
      const P0 = panelRect(WIN), a0 = wmap([P0.x, P0.y], ws);
      const R0 = { x: a0[0], y: a0[1], w: P0.w * ws, h: P0.h * ws };
      let R = { x: lerp(R0.x, S_TEST.x, e), y: lerp(R0.y, S_TEST.y, e) - 16 * bell(e), w: lerp(R0.w, S_TEST.w, e), h: lerp(R0.h, S_TEST.h, e) };
      R = { x: lerp(R.x, S_C.x, settle), y: lerp(R.y, S_C.y, settle), w: lerp(R.w, S_C.w, settle), h: lerp(R.h, S_C.h, settle) };
      R = sink(R);
      const f = ease(seg(t, FIRM[0], FIRM[1])), A = 0.8 * (1 - ease(seg(t, LIFT[1] - 0.3, FIRM[1] - 0.1)));
      ctx.save(); ctx.globalAlpha = 1 - clr;
      card(R, lerp(1.5, 9, e) * (1 - 0.33 * settle) * (1 - clr * 0.6), mixHex('#fffefa', PAPER, e), 0.05 * bell(e));
      ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.rotate(0.05 * bell(e)); ctx.translate(-R.x - R.w / 2, -R.y - R.h / 2);
      drawSketch(WIN, R, 1, f, A, true);
      // Its votes ride along and are peeled off as it firms up.
      const dotsA = 1 - seg(t, FIRM[0] - 0.2, FIRM[0] + 0.2);
      if (dotsA > 0) { ctx.save(); ctx.globalAlpha *= dotsA; DOTS.filter(dt => dt.panel === WIN).forEach(dt => dot(dotPos(dt, R), dt, t, R.w / PW)); ctx.restore(); }
      ctx.restore();
      // The main button: its state carries the test story.
      const bR = buttonRect(t), solid = ease(seg(t, FILL[0], FILL[1])), check = ease(seg(t, PAY + 0.15, PAY + 0.45)) * (1 - ease(seg(t, 17.8, 18.15)));
      ctx.save(); ctx.globalAlpha *= f;
      [[0.505, TAPS[0].t, 0.34], [0.685, TAPS[1].t, 0.22]].forEach(([v, t0, len]) => { // what the tester typed
        const q = ease(seg(t, t0 + 0.1, t0 + 0.6));
        if (q > 0) { const [x0, y0] = at(R, 0.14, v); rr(x0, y0 - R.h * 0.011, len * R.w * q, R.h * 0.022, R.h * 0.011); ctx.fillStyle = '#43474d'; ctx.fill(); }
      });
      mainButton(R, bR, solid, ACC.cobalt, 'Done', check); ctx.restore();
      if (t >= FIX[0] - 0.1 && t < FILL[1] + 0.2) selection(R, bR, seg(t, FIX[0] - 0.1, FIX[0] + 0.05) * (1 - seg(t, FILL[1], FILL[1] + 0.2)));
      pulse(R, t);
      ctx.restore();

      // Test: taps, a stall, and the snag note flying back to the wall.
      TAPS.forEach(tp => ripple(at(R, tp.uv[0], tp.uv[1]), t - tp.t, COBALT));
      STALLS.forEach(s0 => { const sp = personAt(s0); if (sp) ripple(at(R, sp.uv[0], sp.uv[1]), t - s0, PINK); });
      const pp = personAt(t);
      if (pp && pp.alpha > 0) {
        const tapNow = TAPS.reduce((m, tp) => Math.max(m, bell(seg(t, tp.t - 0.12, tp.t + 0.18))), 0);
        person(at(R, pp.uv[0], pp.uv[1]), pp.alpha, mixHex(INK, PINK, pp.stuck), tapNow);
      }
      snagFlight(t, R, ws);
    }

    /* Wally's cursor, only while it is working. */
    const cur = cursorAt(t);
    if (cur && cur.alpha > 0) {
      const age = CLICKS.reduce((m, c) => (t >= c && t - c < m ? t - c : m), 1);
      ctx.save(); ctx.globalAlpha = cur.alpha; cursor(cur.p[0], cur.p[1], age < 0.45 ? age : -1); ctx.restore();
    }
  }

  function selection(R, b, a) {
    if (a <= 0) return;
    const [x, y] = at(R, b[0], b[1]), w = b[2] * R.w, h = b[3] * R.h;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.lineWidth = 1; ctx.strokeStyle = COBALT; ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    [[x - 2, y - 2], [x + w + 2, y - 2], [x + w + 2, y + h + 2], [x - 2, y + h + 2]].forEach(([hx, hy]) => { ctx.fillStyle = '#fff'; ctx.fillRect(hx - 2.5, hy - 2.5, 5, 5); ctx.strokeRect(hx - 2.5, hy - 2.5, 5, 5); });
    ctx.restore();
  }
  // The shared component announces itself once: every button rings together.
  function pulse(R, t) {
    const q = seg(t, 19.05, 19.8);
    if (q <= 0 || q >= 1) return;
    const b = BTN_FULL, [x, y] = at(R, b[0], b[1]), w = b[2] * R.w, h = b[3] * R.h, g = 2 + q * 6;
    rr(x - g, y - g, w + 2 * g, h + 2 * g, 4 + g); ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(24,25,27,${0.55 * (1 - q)})`; ctx.stroke();
  }
  function ripple([x, y], age, col) {
    if (age < 0 || age > 0.6) return;
    const q = age / 0.6;
    ctx.beginPath(); ctx.arc(x, y, 3 + q * 13, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(${rgb(col).join(',')},${0.9 * (1 - q)})`; ctx.stroke();
  }
  function person([x, y], a, col, press) {
    ctx.save(); ctx.globalAlpha *= a;
    y += press * 1.8;
    rr(x - 3.5 + 2.5 - press, y - 15 + 2.5 - press, 7, 15, 3.5); ctx.fillStyle = 'rgba(24,25,27,.2)'; ctx.fill();
    rr(x - 3.5, y - 15, 7, 15, 3.5); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
  function snagFlight(t, R, ws) {
    if (t < SNAG.emerge || t >= SNAG.fly[1]) return;
    const pp = personAt(SNAG.emerge) || { uv: [0.4, 0.85] };
    const src = at(R, pp.uv[0], pp.uv[1] - 0.12);
    const dst = wmap([SNAG.land[0] + NW / 2, SNAG.land[1] + NH / 2], ws);
    const pop = easeOut(seg(t, SNAG.emerge, SNAG.fly[0]));
    const e = inOut(seg(t, SNAG.fly[0], SNAG.fly[1]));
    const x = lerp(src[0] - 40 * pop, dst[0], e), y = lerp(src[1] - 14 * pop, dst[1], e) - 36 * bell(e);
    const scale = lerp(lerp(0.35, 1.2, pop), ws, e);
    note({ x, y, rot: lerp(0.12, SNAG.land[2], e), lift: 1 - e * 0.85, a: seg(t, SNAG.emerge, SNAG.emerge + 0.08) }, NOTE_FILL.p, SNAG.lines, null, scale);
  }

  /* ── Loop, pause, visibility ── */
  let raf = 0, last = 0, visible = false;
  const tick = ts => { const dt = Math.min(0.05, (ts - last) / 1000 || 0); last = ts; T += dt * SPEED; draw(); raf = requestAnimationFrame(tick); };
  const start = () => { if (raf || motion.matches || paused) return; last = performance.now(); raf = requestAnimationFrame(tick); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };
  const sync = () => (visible && !document.hidden ? start() : stop());
  new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.05 }).observe(stage);
  document.addEventListener('visibilitychange', sync);
  new ResizeObserver(() => { resize(); draw(); }).observe(stage);

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.setAttribute('aria-label', paused ? 'Play hero animation' : 'Pause hero animation');
      pauseBtn.querySelector('span').textContent = paused ? 'Play' : 'Pause';
      pauseBtn.querySelector('svg').innerHTML = paused ? '<path d="M2 1 L9 5 L2 9 Z"/>' : '<rect x="1" y="1" width="3" height="8"/><rect x="6" y="1" width="3" height="8"/>';
      paused ? stop() : sync();
    });
  }
  // Reduced motion: the three screens in front of the finished wall.
  const STILL = 19.9;
  const syncMotionPreference = () => {
    if (pauseBtn) pauseBtn.hidden = motion.matches;
    if (motion.matches) { stop(); T = STILL; draw(); }
    else sync();
  };
  if (motion.addEventListener) motion.addEventListener('change', syncMotionPreference);
  else motion.addListener(syncMotionPreference);
  if (motion.matches) T = STILL;

  // Debug/test hook: window.__heroSeek(seconds) paints that moment.
  window.__heroSeek = sec => { T = sec; draw(); };

  resize(); draw();
  syncMotionPreference();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());
})();
