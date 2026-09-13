(function () {
  'use strict';

  const root = document.documentElement;
  if (!root.classList.contains('project-motion-v1')) return;

  const EASE_OUT = 'cubic-bezier(.22,1,.36,1)';
  // The approved comparison's half-speed setting, including its fades and delays.
  const HANDOFF_RATE = 0.5;
  const HANDOFF_EASE = window.CSS?.supports('animation-timing-function', 'linear(0, 1)')
    ? 'linear(0, .085 8%, .263 16%, .455 24%, .622 32%, .752 40%, .846 48%, .910 56%, .951 64%, .976 72%, .990 80%, .997 90%, 1)'
    : EASE_OUT;
  const HANDOFF_FADE = 'cubic-bezier(.16,1,.3,1)';
  const INITIATIVES = new Set(['brief', 'scope', 'echo', 'claims', 'route', 'fda']);
  const supportsObserver = typeof window.IntersectionObserver === 'function';
  const supportsWAAPI = typeof Element.prototype.animate === 'function';
  const reducedMotion = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  let initiativeBlocks = [];
  let initiativeNodes = [];
  let initiativeLinks = [];
  let currentInitiative = '';
  let finale = null;
  let finaleVisible = false;
  let finaleStarted = false;
  let userPaused = false;
  let motionToggle = null;
  let motionToggleLabel = null;
  let nav = null;
  let navHeight = 0;
  let navResizeObserver = null;
  let resizeFrame = 0;

  const played = new WeakSet();
  const runningAnimations = new Set();
  const readingEntries = new Map();
  let readingObserver = null;

  function prefersReducedMotion() {
    return Boolean(reducedMotion && reducedMotion.matches);
  }

  function unique(elements) {
    return Array.from(new Set(elements.filter(Boolean)));
  }

  function viewportHeight() {
    return window.innerHeight || root.clientHeight || 0;
  }

  function initiativeKey(element) {
    return element.dataset.initiativeSection || element.dataset.initiative || '';
  }

  function animateAccent(element, delay) {
    if (played.has(element)) return;
    played.add(element);

    if (prefersReducedMotion() || document.hidden || !supportsWAAPI) return;

    try {
      const animation = element.animate([
        { opacity: 0.65, transform: 'translateY(16px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], {
        duration: 600,
        delay: delay || 0,
        easing: EASE_OUT,
        fill: 'backwards'
      });

      runningAnimations.add(animation);
      const forget = () => runningAnimations.delete(animation);
      animation.addEventListener('finish', forget, { once: true });
      animation.addEventListener('cancel', forget, { once: true });
    } catch (error) {
      // WAAPI is enhancement only; the element is already fully visible.
    }
  }

  function finishAccents() {
    runningAnimations.forEach((animation) => {
      try {
        animation.cancel();
      } catch (error) {
        // The natural, visible element state is the fallback.
      }
    });
    runningAnimations.clear();
  }

  function prepareHeroEntry() {
    const entries = Array.from(document.querySelectorAll('[data-motion-entry]'))
      .filter((element) => !element.parentElement?.closest('[data-motion-entry]'));

    if (prefersReducedMotion() || document.hidden || !supportsWAAPI) {
      entries.forEach((element) => played.add(element));
      return;
    }

    entries.forEach((element, index) => {
      animateAccent(element, Math.min(index * 80, 160));
    });
  }

  function finishReading() {
    readingObserver?.disconnect();
    readingEntries.forEach((entry, element) => {
      played.add(element);
      element.dataset.projectHandoff = 'settled';
    });
  }

  function animateReading(entry, elapsed) {
    const { element, type, delay } = entry;
    if (played.has(element)) return;
    played.add(element);
    readingObserver?.unobserve(element);
    element.dataset.projectHandoff = 'settled';
    if (prefersReducedMotion() || document.hidden || !supportsWAAPI) return;

    const wait = Math.max(0, delay / HANDOFF_RATE - elapsed);
    const isMedia = type === 'media';
    const moves = isMedia || type === 'heading' || type === 'body' || type === 'evidence';
    const previousWillChange = element.style.willChange;
    const animations = [];
    const cleanup = () => {
      animations.forEach((animation) => {
        runningAnimations.delete(animation);
        animation.cancel();
      });
      if (previousWillChange) element.style.willChange = previousWillChange;
      else element.style.removeProperty('will-change');
      element.dataset.projectHandoff = 'settled';
    };

    try {
      element.dataset.projectHandoff = 'running';
      element.style.willChange = moves ? 'opacity, transform' : 'opacity';
      animations.push(element.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 200 / HANDOFF_RATE, delay: wait, easing: HANDOFF_FADE, fill: 'backwards'
      }));
      if (moves) {
        animations.push(element.animate([
          { transform: isMedia ? 'translateX(-12px)' : 'translateY(6px)' },
          { transform: 'none' }
        ], {
          duration: (isMedia ? 480 : 360) / HANDOFF_RATE,
          delay: wait, easing: HANDOFF_EASE, fill: 'backwards'
        }));
      }
      animations.forEach((animation) => runningAnimations.add(animation));
      Promise.allSettled(animations.map((animation) => animation.finished)).then(cleanup);
    } catch (error) {
      cleanup();
    }
  }

  function prepareReadingAccents() {
    if (prefersReducedMotion() || !supportsWAAPI || !supportsObserver) return;

    const types = [
      ['media', 0, '.product-image, .poc-media-frame, .video-frame, .next-project-media'],
      ['label', 100, '.section-label, .product-tag, .poc-kicker, .next-project-heading'],
      ['heading', 100, '.section-heading, .product-title, .poc-title, .project-feature-title, .pullquote blockquote, .next-project-copy > strong'],
      ['body', 170, '.product-lede, .poc-lede, .project-feature-copy, .initiative-copy > p, .story-section .inner > p, .content-grid > div > p'],
      ['caption', 120, '.poc-caption, .image-caption, .video-caption, .pullquote cite'],
      ['evidence', 240, '.product-points, .outcomes > li, .poc-detail, .poc-bullets, .poc-link-row, .project-fact, .demo-callout, .next-project-copy > span']
    ];
    const groups = new Map();
    const allSelectors = types.map(([, , selector]) => selector).join(',');
    types.forEach(([type, delay, selector]) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (!element.closest('[data-motion-reveal], .next-project, .pullquote')) return;
        // One entrance per visual surface; never animate a parent and its child.
        if (element.parentElement?.closest(allSelectors)) return;
        const owner = element.closest('.product-inner, .poc-layout, .image-pair, .case-file-body, .initiative-shell, [data-motion-reveal], .pullquote, .next-project');
        if (!groups.has(owner)) groups.set(owner, { entries: [], started: null });
        const group = groups.get(owner);
        const entry = { element, type, delay, group };
        group.entries.push(entry);
        readingEntries.set(element, entry);
        element.dataset.projectHandoff = 'pending';
      });
    });

    function isVisible(element) {
      const r = element.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < viewportHeight() - 72 &&
        r.bottom > 0 && r.left < root.clientWidth && r.right > 0;
    }

    readingObserver = new IntersectionObserver((entries) => {
      const readyGroups = new Set();
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.01) {
          readyGroups.add(readingEntries.get(entry.target).group);
        }
      });
      const now = performance.now();
      readyGroups.forEach((group) => {
        if (group.started === null) group.started = now;
        group.entries.forEach((entry) => {
          // Long lists and stacked mobile columns wait for their own viewport entry.
          if (isVisible(entry.element)) animateReading(entry, now - group.started);
        });
      });
    }, { rootMargin: '0px 0px -72px 0px', threshold: 0.01 });

    readingEntries.forEach((entry, element) => readingObserver.observe(element));
    root.classList.add('handoff-ready');

    document.addEventListener('focusin', (event) => {
      const elements = unique([
        event.target.closest?.('[data-project-handoff]'),
        ...event.target.querySelectorAll('[data-project-handoff]')
      ]);
      elements.forEach((element) => {
        played.add(element);
        readingObserver.unobserve(element);
        element.dataset.projectHandoff = 'settled';
        element.getAnimations().forEach((animation) => animation.cancel());
      });
    });
  }

  function setCurrentInitiative(key) {
    if (!INITIATIVES.has(key) || key === currentInitiative) return;
    currentInitiative = key;

    initiativeBlocks.forEach((element) => {
      element.classList.toggle('is-current', initiativeKey(element) === key);
    });

    initiativeNodes.forEach((element) => {
      element.classList.toggle('is-current', element.dataset.initiative === key);
    });

    initiativeLinks.forEach((link) => {
      const isCurrent = link.dataset.initiativeLink === key;
      link.classList.toggle('is-current', isCurrent);
      if (isCurrent) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  function syncInitiative() {
    if (!initiativeBlocks.length) return;

    const center = viewportHeight() / 2;
    const visible = initiativeBlocks.filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < viewportHeight();
    });
    const pool = visible.length ? visible : initiativeBlocks;

    pool.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const aDistance = Math.abs((aRect.top + aRect.bottom) / 2 - center);
      const bDistance = Math.abs((bRect.top + bRect.bottom) / 2 - center);
      return aDistance - bDistance;
    });

    setCurrentInitiative(initiativeKey(pool[0]));
  }

  function prepareInitiativeTracking() {
    initiativeBlocks = unique([
      ...document.querySelectorAll('[data-initiative-section]'),
      ...document.querySelectorAll('.product-section[data-initiative]')
    ]).filter((element) => INITIATIVES.has(initiativeKey(element)));
    initiativeNodes = Array.from(document.querySelectorAll('.initiative-node[data-initiative]'));
    initiativeLinks = Array.from(document.querySelectorAll('[data-initiative-link]'));

    initiativeLinks.forEach((link) => {
      link.addEventListener('click', () => setCurrentInitiative(link.dataset.initiativeLink));
    });

    syncInitiative();
    if (!supportsObserver || !initiativeBlocks.length) return;

    const observer = new IntersectionObserver(syncInitiative, {
      rootMargin: '-42% 0px -42% 0px',
      threshold: 0
    });
    initiativeBlocks.forEach((element) => observer.observe(element));
  }

  function setToggleLabel(text) {
    if (motionToggleLabel) motionToggleLabel.textContent = text;
    else if (motionToggle && !motionToggle.children.length) motionToggle.textContent = text;
  }

  function updateMotionToggle() {
    if (!motionToggle) return;

    const unavailable = prefersReducedMotion() || !supportsObserver;
    motionToggle.disabled = unavailable;
    motionToggle.setAttribute('aria-pressed', String(!unavailable && userPaused));

    if (unavailable) {
      motionToggle.setAttribute('aria-disabled', 'true');
      setToggleLabel(prefersReducedMotion() ? 'Motion reduced' : 'Motion unavailable');
    } else {
      motionToggle.removeAttribute('aria-disabled');
      setToggleLabel(userPaused ? 'Resume motion' : 'Pause motion');
    }
  }

  function syncFinale() {
    if (!finale) {
      updateMotionToggle();
      return;
    }

    if (prefersReducedMotion() || !supportsObserver) {
      finaleStarted = false;
      finale.classList.remove('is-converging');
      finale.classList.toggle('is-motion-paused', prefersReducedMotion());
      updateMotionToggle();
      return;
    }

    if (finaleVisible && !document.hidden && !userPaused && !finaleStarted) {
      finaleStarted = true;
      finale.classList.add('is-converging');
    }

    finale.classList.toggle(
      'is-motion-paused',
      !finaleVisible || document.hidden || userPaused
    );
    updateMotionToggle();
  }

  function refreshFinale() {
    if (finale) {
      const rect = finale.getBoundingClientRect();
      finaleVisible = rect.bottom > 0 && rect.top < viewportHeight();
    }
    syncFinale();
  }

  function prepareFinale() {
    finale = document.querySelector('.os-orchestration');
    motionToggle = document.querySelector('[data-motion-toggle]');
    motionToggleLabel = motionToggle?.querySelector('[data-motion-toggle-label]') || null;

    motionToggle?.addEventListener('click', () => {
      if (prefersReducedMotion() || !supportsObserver) return;
      userPaused = !userPaused;
      syncFinale();
    });

    if (finale && supportsObserver) {
      const observer = new IntersectionObserver((entries) => {
        const entry = entries.find((candidate) => candidate.target === finale);
        if (!entry) return;
        finaleVisible = entry.isIntersecting;
        syncFinale();
      }, { threshold: 0 });
      observer.observe(finale);
    }

    refreshFinale();
  }

  function measureNav() {
    if (!nav) return;
    const nextHeight = Math.ceil(nav.getBoundingClientRect().height);
    if (!nextHeight || nextHeight === navHeight) return;
    navHeight = nextHeight;
    root.style.setProperty('--project-nav-height', `${navHeight}px`);
  }

  function prepareNavMeasurement() {
    nav = document.querySelector('body > nav');
    if (!nav) return;
    measureNav();

    if (typeof window.ResizeObserver === 'function') {
      navResizeObserver = new ResizeObserver(measureNav);
      navResizeObserver.observe(nav);
      return;
    }

    window.addEventListener('resize', () => {
      if (resizeFrame) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = 0;
        measureNav();
      });
    }, { passive: true });
  }

  function handleMotionPreference() {
    if (prefersReducedMotion()) {
      finishAccents();
      finishReading();
    }
    syncFinale();
  }

  function bindLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) finishAccents();
      syncFinale();
    });

    window.addEventListener('pagehide', () => {
      finishAccents();
      finishReading();
      finale?.classList.add('is-motion-paused');
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted) finishAccents();
      root.classList.add('motion-ready');
      measureNav();
      syncInitiative();
      refreshFinale();
    });

    if (reducedMotion) {
      if (typeof reducedMotion.addEventListener === 'function') {
        reducedMotion.addEventListener('change', handleMotionPreference);
      } else if (typeof reducedMotion.addListener === 'function') {
        reducedMotion.addListener(handleMotionPreference);
      }
    }
  }

  function failOpen() {
    finishAccents();
    finishReading();
    root.classList.remove('handoff-ready');
    root.classList.add('motion-ready');
    document.querySelector('.os-orchestration')?.classList.remove(
      'is-converging',
      'is-motion-paused'
    );
  }

  function init() {
    try {
      prepareNavMeasurement();
      prepareHeroEntry();
      prepareReadingAccents();
      prepareInitiativeTracking();
      prepareFinale();
      bindLifecycle();
      root.classList.add('motion-ready');
    } catch (error) {
      failOpen();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
