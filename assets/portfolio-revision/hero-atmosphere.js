/* The original Wally bulbs, rendered only while the hero can be seen. */
(() => {
  const canvas = document.getElementById('hero-canvas');
  const hero = document.querySelector('.hero');
  if (!canvas || !hero) return;

  let context;
  try { context = canvas.getContext('2d'); } catch { /* CSS supplies the still atmosphere. */ }
  if (!context || !window.requestAnimationFrame || !window.matchMedia) {
    canvas.dataset.state = 'fallback';
    canvas.style.visibility = 'hidden';
    return;
  }

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nav = document.querySelector('nav');
  const bulbs = [
    { x: -0.05, y: 0.1, r: 0.6, sx: 0.12, sy: 0.08, drift: 0.3, color: [196, 90, 45] },
    { x: 1.05, y: 0.2, r: 0.55, sx: 0.09, sy: 0.13, drift: 0.28, color: [92, 85, 80] },
    { x: 0.5, y: 0.45, r: 0.55, sx: 0.1, sy: 0.1, drift: 0.25, color: [212, 204, 194] },
    { x: 0.1, y: 0.85, r: 0.55, sx: 0.13, sy: 0.1, drift: 0.32, color: [196, 90, 45] },
    { x: 0.95, y: 0.7, r: 0.5, sx: 0.1, sy: 0.14, drift: 0.28, color: [168, 144, 128] },
    { x: 0.35, y: -0.05, r: 0.5, sx: 0.14, sy: 0.07, drift: 0.26, color: [230, 223, 213] },
    { x: 0.7, y: 0.5, r: 0.45, sx: 0.11, sy: 0.09, drift: 0.3, color: [196, 90, 45] },
  ];
  let width = 0;
  let height = 0;
  let frame = 0;
  let elapsed = 0;
  let lastTimestamp = null;
  let pageHidden = false;

  function stop(state) {
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    lastTimestamp = null;
    canvas.dataset.state = state;
    canvas.style.visibility = 'hidden';
  }

  function visibleHeroBounds() {
    const bounds = hero.getBoundingClientRect();
    const navBottom = Math.max(0, nav?.getBoundingClientRect().bottom || 0);
    return bounds.bottom > navBottom && bounds.top < window.innerHeight ? bounds : null;
  }

  function updateGeometry(bounds) {
    const nextWidth = Math.max(1, window.innerWidth);
    const nextHeight = Math.max(1, window.innerHeight);
    if (nextWidth !== width || nextHeight !== height) {
      width = canvas.width = nextWidth;
      height = canvas.height = nextHeight;
    }
    // Keep the original viewport-sized composition without painting past the hero.
    const top = Math.max(0, Math.min(height, bounds.top));
    const bottom = Math.max(0, height - Math.min(height, bounds.bottom));
    canvas.style.clipPath = `inset(${top}px 0px ${bottom}px 0px)`;
  }

  function draw(time) {
    context.clearRect(0, 0, width, height);
    bulbs.forEach((bulb, index) => {
      const drift = bulb.drift;
      const x = (bulb.x + Math.sin(time * bulb.sx + index * 2.1) * drift
        + Math.cos(time * bulb.sx * 0.7 + index) * drift * 0.5) * width;
      const y = (bulb.y + Math.cos(time * bulb.sy + index * 1.7) * drift
        + Math.sin(time * bulb.sy * 0.6 + index * 3.1) * drift * 0.4) * height;
      const radius = bulb.r * Math.min(width, height) * (1 + Math.sin(time * 0.04 + index) * 0.12);
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      const color = bulb.color.join(',');
      gradient.addColorStop(0, `rgba(${color}, 0.28)`);
      gradient.addColorStop(0.35, `rgba(${color}, 0.12)`);
      gradient.addColorStop(1, `rgba(${color}, 0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    });
  }

  function renderFrame(timestamp) {
    frame = 0;
    if (pageHidden || document.hidden || motion.matches || !visibleHeroBounds()) {
      reconcile();
      return;
    }
    if (lastTimestamp !== null) elapsed += timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    draw(elapsed / 1000);
    frame = window.requestAnimationFrame(renderFrame);
  }

  function reconcile() {
    if (pageHidden || document.hidden) return stop('hidden');
    if (motion.matches) return stop('static');
    const bounds = visibleHeroBounds();
    if (!bounds) return stop('offscreen');
    updateGeometry(bounds);
    canvas.dataset.state = 'running';
    canvas.style.visibility = 'visible';
    canvas.classList.add('loaded');
    if (!frame) frame = window.requestAnimationFrame(renderFrame);
  }

  // Scroll handles partial-hero clipping immediately; no idle animation loop remains.
  window.addEventListener('scroll', reconcile, { passive: true });
  window.addEventListener('resize', reconcile, { passive: true });
  document.addEventListener('visibilitychange', reconcile);
  window.addEventListener('pagehide', () => { pageHidden = true; stop('hidden'); });
  window.addEventListener('pageshow', () => { pageHidden = false; reconcile(); });
  if (motion.addEventListener) motion.addEventListener('change', reconcile);
  else motion.addListener(reconcile);

  if ('IntersectionObserver' in window) new IntersectionObserver(reconcile).observe(hero);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(reconcile);
    observer.observe(hero);
    if (nav) observer.observe(nav);
  }
  document.fonts?.ready.then(reconcile);
  document.fonts?.addEventListener?.('loadingdone', reconcile);
  reconcile();
})();
