/* Switchboard hero for account-management routes, adapted from
   concepts/account/switchboard.html: the wood-and-brass board, cut down to
   the hero slot. A client line rings, Wally answers and patches in the
   teams the ask needs, and the finished work comes back up the cord.
   The lines and calls come from a pharma board, a general board, or a
   board tailored to the job description (see route.heroBoard). */
(function HeroSwitchboard() {
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
  const outBack = k => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2; };
  const inOut = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

  /* ── Palette ── */
  const INK = '#1d1a16';
  const AMBER = '#f5a524';
  const CORD = {
    cobalt: ['#2454c6', '#183d97', '#8fa9ec'],
    pink:   ['#e548a5', '#a90f68', '#f7b3da'],
    cyan:   ['#079fc4', '#05789a', '#8fe0f2'],
    ink:    ['#2b2620', '#0f0d0b', '#7a7064'],
  };

  /* ── Board layout (design units) ── */
  const VW = 520, VH = 480, TOP = 86, BOTTOM = 52, MAX_K = 0.9;
  const CROWN = [8, 8, 504, 34], CAB = [18, 38, 484, 376], PANEL = [44, 62, 432, 336], RAIL = [44, 168, 432, 20];
  const LEDGE = { x0: 34, x1: 486, y0: 404, y1: 420, h: 16 };
  // Boards. The builder picks one with data-board="pharma|general|custom";
  // a custom board (tailored to a JD) arrives as JSON inside the stage.
  // Every board has 4 client lines, 6 teams, and 4 calls; each client line
  // makes one call and every team is patched at least once.
  const BOARDS = {
    pharma: {
      client: ['Brand team', 'Vendors', 'Med/Legal', 'Sales team'],
      teams: ['Creative', 'UX/UI', 'Production', 'Media', 'Digital', 'Finance'],
      calls: [
        { from: 'Brand team', to: ['Production', 'Media'], ask: 'Can the TV spot air in May?', done: 'On air in May.' },
        { from: 'Med/Legal', to: ['Creative', 'Digital'], ask: 'Add fair balance to the banner.', done: 'Banner cleared review.' },
        { from: 'Sales team', to: ['UX/UI', 'Digital'], ask: 'Reps need the sales aid on iPads.', done: 'iPad sales aid is live.' },
        { from: 'Vendors', to: ['Media', 'Finance'], ask: 'Streaming ad slots just opened up.', done: 'Booked, within budget.' },
      ],
    },
    general: {
      client: ['Client lead', 'Exec sponsor', 'End users', 'Procurement'],
      teams: ['Product', 'Design', 'Engineering', 'Analytics', 'Support', 'Finance'],
      calls: [
        { from: 'Client lead', to: ['Product', 'Engineering'], ask: 'Can we launch before Q4?', done: 'Live before Q4.' },
        { from: 'Exec sponsor', to: ['Analytics', 'Finance'], ask: 'What did we get for the spend?', done: 'ROI report sent.' },
        { from: 'End users', to: ['Design', 'Engineering'], ask: 'The new dashboard is confusing.', done: 'Fixed in this release.' },
        { from: 'Procurement', to: ['Support', 'Finance'], ask: 'Renewal terms are due Friday.', done: 'Renewal signed.' },
      ],
    },
  };
  const isBoard = b => b && Array.isArray(b.client) && b.client.length === 4 && Array.isArray(b.teams) && b.teams.length === 6 &&
    Array.isArray(b.calls) && b.calls.length === 4 &&
    b.calls.every(c => b.client.includes(c.from) && Array.isArray(c.to) && c.to.length >= 1 && c.to.length <= 2 &&
      c.to.every(x => b.teams.includes(x)) && typeof c.ask === 'string' && typeof c.done === 'string');
  function readBoard() {
    const key = stage.dataset.board;
    if (key === 'custom') {
      try {
        const b = JSON.parse(stage.querySelector('script.hero-switchboard-board').textContent);
        if (isBoard(b)) return b;
      } catch (e) { /* fall back to the general board */ }
      return BOARDS.general;
    }
    return BOARDS[key] || BOARDS.general;
  }
  const BOARD = readBoard();

  const CLIENT_X = [98, 206, 314, 422];
  const TEAM_XY = [[140, 262], [260, 262], [380, 262], [140, 356], [260, 356], [380, 356]];
  const JACKS = {};
  BOARD.client.forEach((label, i) => { JACKS['c' + i] = { x: CLIENT_X[i], y: 132, label, client: true }; });
  BOARD.teams.forEach((label, i) => { JACKS['t' + i] = { x: TEAM_XY[i][0], y: TEAM_XY[i][1], label }; });
  const REST = [446, 386];

  const PAIRS = [['cobalt', 'pink'], ['cyan', 'ink'], ['pink', 'cobalt'], ['ink', 'cyan']];
  const CALLS = BOARD.calls.map((c, i) => ({
    from: 'c' + BOARD.client.indexOf(c.from),
    to: c.to.map(x => 't' + BOARD.teams.indexOf(x)),
    colors: PAIRS[i % PAIRS.length],
    ask: c.ask,
    done: c.done,
  }));

  /* ── Timeline ── */
  const SLOT = 5.0, START = 0.4;
  const TL = [];
  CALLS.forEach((c, i) => {
    c.ring = START + i * SLOT;
    c.answer = c.ring + 0.8;
    c.cords = [];
    let grab = c.answer + 0.15;
    c.to.forEach((dest, j) => {
      const cd = { k: TL.length, from: c.from, to: dest, color: c.colors[j], grab, seat: grab + 0.8 };
      TL.push(cd); c.cords.push(cd);
      grab = cd.seat + 0.45;
    });
    c.lastSeat = c.cords[c.cords.length - 1].seat;
    c.pk0 = c.lastSeat + 0.25; c.pk1 = c.pk0 + 0.7;
    c.delivered = c.pk1 + 0.05;
    c.out = c.delivered + 0.85;
  });
  // Fan cords that share a jack so every plug stays visible.
  (() => {
    const count = {}, seen = {};
    TL.forEach(cd => { count[cd.from] = (count[cd.from] || 0) + 1; count[cd.to] = (count[cd.to] || 0) + 1; });
    const slot = id => { const i = seen[id] = (seen[id] || 0) + 1; return (i - 1 - (count[id] - 1) / 2) * 6; };
    TL.forEach(cd => { cd.dxA = slot(cd.from); cd.dxB = slot(cd.to); });
  })();
  const LAST = CALLS[CALLS.length - 1].out;
  const UNPLUG = LAST + 1.4;
  TL.forEach((cd, i) => { cd.unplug = UNPLUG + i * 0.14; });
  const DUR = UNPLUG + TL.length * 0.14 + 1.1;
  const STILL = LAST + 0.6; // reduced motion: every line patched and delivered
  const CLICKS = [];
  CALLS.forEach(c => CLICKS.push(c.answer));
  TL.forEach(cd => CLICKS.push(cd.seat));

  /* ── Cursor path: holds on jacks, glides between them ── */
  const J = id => [JACKS[id].x, JACKS[id].y];
  const A_ = cd => [JACKS[cd.from].x + cd.dxA, JACKS[cd.from].y];
  const B_ = cd => [JACKS[cd.to].x + cd.dxB, JACKS[cd.to].y];
  function plugB(cd, t) {
    const A = A_(cd), B = B_(cd), k = inOut(seg(t, cd.grab + 0.05, cd.seat));
    const d = Math.hypot(B[0] - A[0], B[1] - A[1]);
    return [lerp(A[0], B[0], k), lerp(A[1], B[1], k) - Math.sin(k * Math.PI) * Math.min(50, d * 0.22)];
  }
  const restAt = t => [REST[0] + Math.sin(t * 1.3) * 3, REST[1] + Math.cos(t * 1.1) * 2];
  const HOLDS = [{ a: -1, b: CALLS[0].ring + 0.15, at: restAt }];
  CALLS.forEach(c => {
    HOLDS.push({ a: c.answer - 0.2, b: c.answer + 0.15, at: () => J(c.from) });
    c.cords.forEach((cd, j) => {
      if (j > 0) HOLDS.push({ a: cd.grab - 0.15, b: cd.grab + 0.05, at: () => A_(cd) });
      HOLDS.push({ a: cd.grab + 0.05, b: cd.seat, at: t => plugB(cd, t) });
      HOLDS.push({ a: cd.seat, b: cd.seat + 0.12, at: () => B_(cd) });
    });
    HOLDS.push({ a: c.lastSeat + 0.8, b: c.out, at: restAt });
  });
  HOLDS.push({ a: DUR - 0.3, b: DUR + 1, at: restAt });
  function cursorAt(t) {
    for (let i = 0; i < HOLDS.length; i++) {
      const h = HOLDS[i], nx = HOLDS[i + 1];
      if (t >= h.a && t <= h.b) return h.at(t);
      if (nx && t > h.b && t < nx.a) {
        const q = inOut((t - h.b) / (nx.a - h.b)), p0 = h.at(h.b), p1 = nx.at(nx.a);
        const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        return [lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q) - Math.sin(q * Math.PI) * Math.min(32, d * 0.2)];
      }
    }
    return restAt(t);
  }

  /* ── Canvas sizing; the static board is painted once per resize ── */
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  let W = 0, H = 0, k = 1, ox = 0, oy = 0, dpr = 1, T = 4.9, paused = false;
  const SPEED = 0.85;
  function resize() {
    const r = stage.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = base.width = Math.round(W * dpr);
    cv.height = base.height = Math.round(H * dpr);
    k = Math.min(MAX_K, (W - 16) / VW, (H - BOTTOM) / (VH + TOP));
    ox = (W - VW * k) / 2;
    oy = TOP * k + (H - BOTTOM - (VH + TOP) * k) / 2;
    bctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);
    paintBase(bctx);
  }
  const toBoard = c => c.setTransform(dpr * k, 0, 0, dpr * k, dpr * ox, dpr * oy);

  /* ── Primitives ── */
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function vgrad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }
  function brassRing(c, x, y, r) {
    const g = c.createRadialGradient(x - r * 0.24, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#f6dc9a'); g.addColorStop(0.55, '#c99a45'); g.addColorStop(1, '#7f5a1c');
    return g;
  }
  function text(c, str, x, y, font, color, align = 'left') {
    c.font = font; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(str, x, y);
  }

  function paintBase(c) {
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, base.width, base.height); c.restore();
    const [kx, ky, kw, kh] = CROWN, [cx, cy, cw, ch] = CAB, [px, py, pw, ph] = PANEL, [rx, ry, rw, rh] = RAIL;
    const { x0, x1, y0, y1, h } = LEDGE;
    c.lineJoin = 'round';
    // Floor shadow + feet.
    const floor = y1 + h + 22;
    c.beginPath(); c.ellipse(VW / 2, floor + 2, VW * 0.44, 9, 0, 0, Math.PI * 2); c.fillStyle = 'rgba(74,44,20,.16)'; c.fill();
    [cx + 26, cx + cw - 50].forEach(x => { rr(c, x, y1 + h - 2, 24, floor - (y1 + h) + 2, 3); c.fillStyle = '#4e2c17'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke(); });
    // Cabinet with a little grain on the stiles.
    rr(c, cx, cy, cw, ch, 12); c.fillStyle = vgrad(c, cy, cy + ch, [[0, '#8d5732'], [0.55, '#76451f'], [1, '#5e3517']]); c.fill();
    c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.strokeStyle = 'rgba(40,20,5,.28)'; c.lineWidth = 1;
    [cx + 6, cx + 12, cx + 18, cx + cw - 18, cx + cw - 12, cx + cw - 6].forEach((x, i) => {
      const a = cy + 14, b = cy + ch - 14, w = i % 2 ? 2.5 : -2.5;
      c.beginPath(); c.moveTo(x, a); c.bezierCurveTo(x + w, a + (b - a) * 0.3, x - w, a + (b - a) * 0.65, x + w * 0.4, b); c.stroke();
    });
    // Crown + brass nameplate.
    rr(c, kx, ky, kw, kh, 9); c.fillStyle = vgrad(c, ky, ky + kh, [[0, '#6a3c1e'], [1, '#43240f']]); c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(kx + 12, ky + 5); c.lineTo(kx + kw - 12, ky + 5); c.strokeStyle = 'rgba(255,220,180,.25)'; c.lineWidth = 2; c.lineCap = 'round'; c.stroke();
    c.font = `700 10px ${MONO}`;
    const plate = 'ACCOUNT LINES', plw = c.measureText(plate).width + 26;
    rr(c, VW / 2 - plw / 2, ky + 8, plw, 19, 3); c.fillStyle = vgrad(c, ky + 8, ky + 27, [[0, '#efd08a'], [0.55, '#d2a551'], [1, '#b98a36']]); c.fill();
    c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
    text(c, plate, VW / 2, ky + 18, `700 10px ${MONO}`, '#2e1a09', 'center');
    // Jack panel with the client side tinted.
    rr(c, px, py, pw, ph, 6); c.fillStyle = vgrad(c, py, py + ph, [[0, '#fbf5e6'], [1, '#f0e4c8']]); c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.fillStyle = 'rgba(36,84,198,.07)'; c.fillRect(px + 1, py + 1, pw - 2, ry - py - 1);
    rr(c, px + 6, py + 6, pw - 12, ph - 12, 4); c.lineWidth = 1; c.strokeStyle = 'rgba(118,69,31,.18)'; c.stroke();
    [[px + 12, py + 12], [px + pw - 12, py + 12], [px + 12, py + ph - 12], [px + pw - 12, py + ph - 12]].forEach(([x, y], i) => {
      c.beginPath(); c.arc(x, y, 3.6, 0, Math.PI * 2); c.fillStyle = brassRing(c, x, y, 3.6); c.fill(); c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.moveTo(x - 2.2, y + (i % 2 ? 1.3 : -1.3)); c.lineTo(x + 2.2, y + (i % 2 ? -1.3 : 1.3)); c.stroke();
    });
    // Brass rail between the client side and the teams.
    c.fillStyle = vgrad(c, ry, ry + rh, [[0, '#efd08a'], [0.5, '#d2a551'], [1, '#a77a2e']]); c.fillRect(rx, ry, rw, rh);
    c.lineWidth = 1.4; c.strokeStyle = INK; c.strokeRect(rx, ry, rw, rh);
    c.beginPath(); c.moveTo(rx + 2, ry + 3); c.lineTo(rx + rw - 2, ry + 3); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.1; c.stroke();
    text(c, '▲ CLIENT     TEAMS ▼', VW / 2, ry + rh / 2 + 0.5, `700 8.5px ${MONO}`, '#2e1a09', 'center');
    // Jacks.
    for (const id in JACKS) {
      const { x, y } = JACKS[id];
      c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.fillStyle = brassRing(c, x, y, 14); c.fill(); c.lineWidth = 1.3; c.strokeStyle = INK; c.stroke();
      c.beginPath(); c.arc(x, y, 9.5, 0, Math.PI * 2); c.lineWidth = 1; c.strokeStyle = 'rgba(60,40,10,.45)'; c.stroke();
      c.beginPath(); c.arc(x, y, 5.6, 0, Math.PI * 2); c.fillStyle = '#15110d'; c.fill();
      c.beginPath(); c.arc(x - 5.2, y - 6, 1.9, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.55)'; c.fill();
      // Lamp bezel (the glass is drawn live).
      c.beginPath(); c.arc(x, y - 26, 8, 0, Math.PI * 2); c.fillStyle = brassRing(c, x, y - 26, 8); c.fill(); c.lineWidth = 1.1; c.strokeStyle = INK; c.stroke();
    }
    // Operator's ledge: notepad and desk bell.
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1 + 12, y1); c.lineTo(x0 - 12, y1); c.closePath();
    c.fillStyle = vgrad(c, y0, y1, [[0, '#b0764a'], [1, '#8a5530']]); c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke();
    rr(c, x0 - 12, y1, x1 - x0 + 24, h, 3); c.fillStyle = '#5b3316'; c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x0 - 8, y1 + 4); c.lineTo(x1 + 8, y1 + 4); c.strokeStyle = 'rgba(255,210,160,.22)'; c.lineWidth = 2; c.stroke();
    c.save(); c.translate(58, 406); c.transform(1, 0, -0.45, 1, 0, 0);
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 64, 12); c.lineWidth = 1; c.strokeStyle = INK; c.strokeRect(0, 0, 64, 12);
    c.strokeStyle = 'rgba(36,84,198,.45)'; [4, 8].forEach((yy, i) => { c.beginPath(); c.moveTo(10, yy); c.lineTo(56 - i * 10, yy); c.stroke(); });
    c.strokeStyle = 'rgba(229,72,165,.55)'; c.beginPath(); c.moveTo(7, 0); c.lineTo(7, 12); c.stroke();
    c.restore();
    c.save(); c.translate(104, 404); c.rotate(-0.12);
    c.fillStyle = '#ffd24d'; c.fillRect(0, -1.8, 24, 3.6); c.lineWidth = 0.9; c.strokeStyle = INK; c.strokeRect(0, -1.8, 24, 3.6);
    c.beginPath(); c.moveTo(24, -1.8); c.lineTo(29, 0); c.lineTo(24, 1.8); c.closePath(); c.fillStyle = '#f3dcc0'; c.fill(); c.stroke();
    c.restore();
    const bx = 170, by = 414;
    rr(c, bx - 12, by, 24, 3.2, 1.4); c.fillStyle = '#43240f'; c.fill(); c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(bx - 9.5, by); c.arc(bx, by, 9.5, Math.PI, 0); c.closePath(); c.fillStyle = brassRing(c, bx, by - 4, 10); c.fill(); c.stroke();
    c.beginPath(); c.arc(bx, by - 10.5, 2.2, 0, Math.PI * 2); c.fillStyle = brassRing(c, bx, by - 10.5, 2.2); c.fill(); c.stroke();
  }

  /* ── Live pieces ── */
  function lamp(x, y, color, halo) {
    if (color && halo > 0) {
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.globalAlpha = halo; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fillStyle = brassRing(ctx, x, y, 8); ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, 5.2, 0, Math.PI * 2);
    if (color) ctx.fillStyle = color;
    else { const g = ctx.createRadialGradient(x - 1.5, y - 1.8, 0.5, x, y, 5.2); g.addColorStop(0, '#f4ead2'); g.addColorStop(1, '#c7b58f'); ctx.fillStyle = g; }
    ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(29,26,22,.6)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 1.8, y - 2.1, 1.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  }
  function labelCard(j, ringing) {
    ctx.font = `700 9px ${MONO}`;
    const str = j.label.toUpperCase(), w = ctx.measureText(str).width + 12, x = j.x - w / 2, y = j.y - 58;
    ctx.fillStyle = j.client ? 'rgba(36,84,198,.4)' : 'rgba(29,26,22,.24)'; ctx.fillRect(x + 2, y + 2, w, 16);
    ctx.fillStyle = ringing ? '#ffe3a3' : '#fffaf0'; ctx.fillRect(x, y, w, 16);
    ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 15);
    text(ctx, str, j.x, y + 8.5, `700 9px ${MONO}`, j.client ? '#2454c6' : INK, 'center');
  }
  function plug(x, y, col, sc) {
    if (sc <= 0.01) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    ctx.beginPath(); ctx.ellipse(2.2, 4.5, 9.5, 8.5, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(40,24,10,.22)'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.fillStyle = col[0]; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 4.3, 0, Math.PI * 2); ctx.fillStyle = col[1]; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI * 1.05, Math.PI * 1.45); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }
  const sagFor = (A, B) => Math.min(110, 28 + Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.25);
  function cordPath(A, B, o) {
    ctx.beginPath(); ctx.moveTo(A[0], A[1]);
    ctx.bezierCurveTo(A[0] + o.sw1, A[1] + o.sag, B[0] + o.sw2, B[1] + o.sag, B[0], B[1]);
  }
  function cordAt(A, B, o, u) {
    const p = [A, [A[0] + o.sw1, A[1] + o.sag], [B[0] + o.sw2, B[1] + o.sag], B], v = 1 - u;
    return [0, 1].map(i => v * v * v * p[0][i] + 3 * v * v * u * p[1][i] + 3 * v * u * u * p[2][i] + u * u * u * p[3][i]);
  }
  function drawCursor(p, age) {
    const [x, y] = p;
    if (age >= 0 && age < 0.45) {
      const q = age / 0.45;
      ctx.beginPath(); ctx.arc(x, y, 3 + q * 15, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(229,72,165,${1 - q})`; ctx.lineWidth = 2; ctx.stroke();
    }
    const press = age >= 0 && age < 0.12 ? 0.84 : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(press, press);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 17); ctx.lineTo(4.6, 12.9); ctx.lineTo(7.8, 19.8); ctx.lineTo(10.9, 18.4);
    ctx.lineTo(7.7, 11.7); ctx.lineTo(13.4, 11.4); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = INK; ctx.fill();
    ctx.restore();
    ctx.font = `700 9.5px ${MONO}`;
    const w = ctx.measureText('WALLY').width + 13;
    const tx = x + 13 + w > VW + 30 ? x - w - 6 : x + 12, ty = y + 20;
    ctx.fillStyle = '#e548a5'; ctx.fillRect(tx + 2.5, ty + 2.5, w, 18);
    ctx.fillStyle = INK; ctx.fillRect(tx, ty, w, 18);
    text(ctx, 'WALLY', tx + 6.5, ty + 9.5, `700 9.5px ${MONO}`, '#f7a9d5');
  }
  function bubble(c, t) {
    const j = JACKS[c.from];
    const pop = outBack(seg(t, c.ring, c.ring + 0.35)) * (1 - seg(t, c.out - 0.3, c.out));
    if (pop <= 0.01) return;
    const answered = t >= c.answer + 0.05, done = t >= c.delivered;
    ctx.font = `600 13px ${BODY}`;
    const bw = Math.max(ctx.measureText(c.ask).width, ctx.measureText(c.done).width + 22) + 26;
    const bh = answered && !done ? 70 : 46;
    const minX = -ox / k + 4, maxX = (W - ox) / k - bw - 10;
    const tipX = j.x, tipY = CROWN[1] - 4;
    const bx = clamp(tipX - bw / 2, minX, maxX), by = tipY - 12 - bh;
    ctx.save(); ctx.translate(tipX, tipY); ctx.scale(pop, pop); ctx.translate(-tipX, -tipY);
    ctx.fillStyle = done ? '#079fc4' : '#2454c6'; rr(ctx, bx + 4, by + 4, bw, bh, 12); ctx.fill();
    rr(ctx, bx, by, bw, bh, 12); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = INK; ctx.stroke();
    const tx = clamp(tipX, bx + 18, bx + bw - 18);
    ctx.beginPath(); ctx.moveTo(tx - 7, by + bh - 1); ctx.lineTo(tipX, tipY); ctx.lineTo(tx + 7, by + bh - 1); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); ctx.fillRect(tx - 6, by + bh - 3, 12, 4);
    text(ctx, j.label.toUpperCase(), bx + 13, by + 14, `700 8.5px ${MONO}`, '#5f5547');
    if (done) {
      ctx.beginPath(); ctx.arc(bx + 21, by + 30, 7.5, 0, Math.PI * 2); ctx.fillStyle = '#079fc4'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = INK; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + 17.5, by + 30); ctx.lineTo(bx + 20.2, by + 33); ctx.lineTo(bx + 25, by + 26.8); ctx.lineWidth = 1.9; ctx.strokeStyle = '#fff'; ctx.stroke();
      text(ctx, c.done, bx + 34, by + 30.5, `600 13px ${BODY}`, INK);
    } else {
      text(ctx, c.ask, bx + 13, by + 30.5, `600 13px ${BODY}`, INK);
      if (answered) {
        // Wally's reply, inside the same thread.
        const q = outBack(seg(t, c.answer + 0.05, c.answer + 0.35));
        ctx.save(); ctx.translate(bx + 13, by + 56); ctx.scale(q, q);
        ctx.font = `700 9px ${MONO}`;
        const nw = ctx.measureText('WALLY').width;
        ctx.font = `600 12px ${BODY}`;
        const rw = nw + ctx.measureText('On it.').width + 22;
        ctx.fillStyle = '#e548a5'; ctx.fillRect(2, -8, rw, 18);
        ctx.fillStyle = INK; ctx.fillRect(0, -10, rw, 18);
        text(ctx, 'WALLY', 7, -0.5, `700 9px ${MONO}`, '#f7a9d5');
        text(ctx, 'On it.', 15 + nw, -0.5, `600 12px ${BODY}`, '#fff');
        ctx.restore();
      }
    }
    ctx.restore();
  }

  /* ── Frame ── */
  function draw() {
    const t = ((T % DUR) + DUR) % DUR;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(base, 0, 0);
    toBoard(ctx);
    ctx.lineJoin = 'round';

    // Lamps: client lines glow amber once answered; teams glow in their cord's color.
    const lampsOn = {};
    TL.forEach(cd => {
      if (t >= cd.grab && t < cd.unplug) lampsOn[cd.from] = AMBER;
      if (t >= cd.seat && t < cd.unplug) lampsOn[cd.to] = CORD[cd.color][0];
    });
    CALLS.forEach(c => { if (t >= c.ring && t < c.answer) lampsOn[c.from] = Math.floor((t - c.ring) * 5) % 2 === 0 ? AMBER : null; });
    const working = {};
    CALLS.forEach(c => { if (t >= c.pk0 && t < c.pk1) c.to.forEach(id => { working[id] = 0.5 + 0.4 * Math.sin((t - c.pk0) * 18); }); });
    for (const id in JACKS) {
      const j = JACKS[id], col = lampsOn[id];
      const wave = Math.exp(-((t - (LAST + 0.2) - (j.x / VW) * 0.8) ** 2) / 0.02);
      lamp(j.x, j.y - 26, col, col ? (working[id] || 0.28) + 0.4 * wave : 0);
    }

    // Spare plugs on the ledge; one leaves each time a cord goes up.
    TL.forEach((cd, i) => {
      const back = t >= cd.unplug + 0.5, on = t < cd.grab || back;
      if (!on) return;
      const sc = back ? Math.max(0, outBack(seg(t, cd.unplug + 0.5, cd.unplug + 0.8))) : 1;
      const x = 324 + i * 18, y = 412, col = CORD[cd.color];
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
      rr(ctx, -5.5, -13, 11, 13, 2.5); ctx.fillStyle = col[0]; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = INK; ctx.stroke();
      rr(ctx, -6.8, -16, 13.6, 3.6, 1); ctx.fillStyle = '#3a332b'; ctx.fill(); ctx.stroke();
      rr(ctx, -2.3, -25, 4.6, 10, 2.3); ctx.fillStyle = brassRing(ctx, 0, -20, 5); ctx.fill(); ctx.stroke();
      ctx.restore();
    });

    // Cords: shadow, ink, color, highlight; plugs on both ends.
    const cur = cursorAt(t);
    TL.forEach(cd => {
      if (t < cd.grab || t >= cd.unplug + 0.62) return;
      const A = A_(cd), held = t < cd.seat, tau = t - cd.seat;
      let B = held ? plugB(cd, t) : B_(cd);
      let sag = sagFor(A, B) + (held ? 10 : 0), sw1 = 0, sw2 = 0, scB = held ? 1.15 : 1;
      if (held) {
        const prev = plugB(cd, t - 0.04);
        sw2 = clamp(-(B[0] - prev[0]) / 0.04 * 0.1, -50, 50); sw1 = sw2 * 0.35;
      } else {
        sw2 = 22 * Math.exp(-2.4 * tau) * Math.sin(tau * 6.5) + 2.5 * Math.sin(t * 1.1 + cd.k * 1.9);
        sw1 = sw2 * 0.4 + 1.6 * Math.sin(t * 0.9 + cd.k);
        sag *= 1 + 0.18 * Math.sin(tau * 9) * Math.exp(-4 * tau);
        scB = 1 + 0.3 * (1 - outBack(seg(tau, 0, 0.32)));
      }
      // A cord that drops almost straight down bows left so it clears the label cards.
      const bow = Math.abs(B_(cd)[0] - A[0]) < 40 ? -46 : 0;
      sw1 += bow; sw2 += bow;
      const scA = Math.max(0, outBack(seg(t, cd.grab, cd.grab + 0.28)));
      let dy = 0, op = 1;
      if (t >= cd.unplug) { const u = t - cd.unplug; dy = 480 * u * u; op = 1 - seg(u, 0.12, 0.6); }
      const A2 = [A[0], A[1] + dy], B2 = [B[0], B[1] + dy], o = { sag, sw1, sw2 };
      const col = CORD[cd.color];
      ctx.save(); ctx.globalAlpha = op; ctx.lineCap = 'round';
      ctx.save(); ctx.translate(3, 7); cordPath(A2, B2, o); ctx.strokeStyle = 'rgba(60,34,12,.16)'; ctx.lineWidth = 5.5; ctx.stroke(); ctx.restore();
      cordPath(A2, B2, o); ctx.strokeStyle = INK; ctx.lineWidth = 6.8; ctx.stroke();
      ctx.strokeStyle = col[0]; ctx.lineWidth = 4.2; ctx.stroke();
      ctx.save(); ctx.translate(-1, -1.1); cordPath(A2, B2, o); ctx.strokeStyle = col[2]; ctx.globalAlpha = op * 0.8; ctx.lineWidth = 1.2; ctx.stroke(); ctx.restore();
      plug(A2[0], A2[1], col, scA);
      plug(B2[0], B2[1], col, scB);
      // The finished work travels back up the cord to the client.
      const c = CALLS.find(cc => cc.cords.includes(cd));
      if (t >= c.pk0 && t < c.pk1) {
        const [px, py] = cordAt(A2, B2, o, 1 - seg(t, c.pk0, c.pk1));
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
        ctx.fillRect(px - 4.5, py - 4.5, 9, 9); ctx.strokeRect(px - 4.5, py - 4.5, 9, 9);
      }
      ctx.restore();
    });

    // Line names sit above the cords so the web never hides who is on it.
    for (const id in JACKS) labelCard(JACKS[id], CALLS.some(c => c.from === id && t >= c.ring && t < c.answer));

    // Wally's cursor, then the caller's bubble above the crown.
    const age = CLICKS.reduce((m, c) => (t >= c && t - c < m ? t - c : m), 1);
    drawCursor(cur, age < 0.45 ? age : -1);
    const active = CALLS.find(c => t >= c.ring && t < c.out);
    if (active) bubble(active, t);
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
})();
