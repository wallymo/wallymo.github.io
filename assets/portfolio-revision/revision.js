/* Progressive enhancement for the revision's work, chapters, and award links. */
(() => {
  'use strict';
  const work = document.getElementById('work');
  const chapters = document.getElementById('chapters');
  const cards = [...(work?.querySelectorAll('.work-grid > .work-item') || [])];
  const grid = work?.querySelector('.work-grid');
  const panels = [...(chapters?.querySelectorAll('.chapter-state') || [])];
  const tabs = [...(chapters?.querySelectorAll('.chapter-tab') || [])];
  const journey = chapters?.querySelector('.chapter-journey');
  const chapterFrame = chapters?.querySelector('.chapter-frame');
  const chapterShell = chapters?.querySelector('.chapter-shell');
  const chapterNav = chapters?.querySelector('.chapter-tabs');
  const identities = panels.map(panel => panel.querySelector('.chapter-identity'));
  const proofs = panels.map(panel => panel.querySelector('.chapter-proof'));
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap;
  let chaptersPinned = false;
  let chapterAnimations = [];
  let chapterLayoutReady = false;
  let chapterReading = false;
  let chapterLayoutSize = '';
  let chapterLayoutMotion = motion.matches;
  let choosingChapter = false;
  let selected = 0;
  let chapterTop = 0;
  let chapterTravel = 0;
  let chapterStartOffset = 0;
  let stackOffsets = [];
  let resizeFrame;
  let entryFrame;
  let lastSize = '';
  let anchorHandled = false;
  const instantScroll = (top) => window.scrollTo({ top, behavior: 'instant' });
  const navOffset = () => Math.ceil(document.querySelector('nav')?.getBoundingClientRect().height || 54) + 24;

  // Keep the new Chapters destination reachable from the existing mobile menu.
  const nav = document.getElementById('nav');
  const menuButton = nav?.querySelector('.mobile-menu-btn');
  const menuLinks = [...(nav?.querySelectorAll('.links a') || [])];
  function setMenu(open, restoreFocus = false) {
    nav.classList.toggle('menu-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) menuLinks[0]?.focus();
    if (restoreFocus) menuButton.focus();
  }
  menuButton?.addEventListener('click', () => setMenu(!nav.classList.contains('menu-open')));
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1120 && nav?.classList.contains('menu-open')) setMenu(false);
  }, { passive: true });
  menuLinks.forEach((link) => link.addEventListener('click', () => {
    if (nav.classList.contains('menu-open')) setMenu(false);
  }));
  nav?.addEventListener('keydown', (event) => {
    if (!nav.classList.contains('menu-open')) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false, true); }
    if (event.key !== 'Tab') return;
    if (event.shiftKey && document.activeElement === menuButton) {
      event.preventDefault(); menuLinks.at(-1)?.focus();
    } else if (!event.shiftKey && document.activeElement === menuLinks.at(-1)) {
      event.preventDefault(); menuButton.focus();
    }
  });

  cards.forEach((card) => {
    // The section's existing reveal animation must not compete with its stack.
    card.classList.remove('reveal', 'reveal-pending');
    const label = document.createElement('span');
    label.className = 'work-stack-label';
    label.setAttribute('aria-hidden', 'true');
    const title = document.createElement('span');
    title.textContent = card.querySelector('h3')?.textContent || '';
    const number = document.createElement('span');
    number.textContent = card.querySelector('.work-number')?.textContent || '';
    label.append(title, number);
    card.append(label);
    card.addEventListener('focus', () => {
      if (!work.classList.contains('work-stack-active')) return;
      const index = cards.indexOf(card);
      instantScroll(grid.getBoundingClientRect().top + window.scrollY + stackOffsets[index]);
    });
  });

  function clearStack() {
    stackOffsets = [];
    work?.classList.remove('work-stack-active', 'work-stack-compact');
    cards.forEach((card) => {
      card.classList.remove('is-covered');
      gsap?.killTweensOf(card);
      card.style.removeProperty('transform');
      card.style.removeProperty('will-change');
      card.style.removeProperty('min-height');
      card.style.removeProperty('--stack-top');
      card.style.removeProperty('--stack-index');
    });
  }

  function setupStack() {
    clearStack();
    if (!grid || motion.matches || window.innerWidth < 1120 || cards.length < 2) return;
    const top = navOffset();
    // Keep the active card complete. Browser chrome and zoom can change usable
    // height, so compress the preceding headers before falling back to flat cards.
    const heights = cards.map((card) => card.getBoundingClientRect().height);
    const cardHeight = Math.max(...heights);
    const available = window.innerHeight - top - cardHeight - 24;
    if (available < 0) return;
    const headerStep = Math.min(46, available / (cards.length - 1));
    const step = headerStep >= 32 ? headerStep : 0;
    // Equal heights keep mixed JD selections aligned as they leave the stack.
    // This only adds room; it never reduces type or clips a taller card.
    cards.forEach((card) => { card.style.minHeight = `${cardHeight}px`; });
    const gridTop = grid.getBoundingClientRect().top;
    stackOffsets = cards.map((card, i) => card.getBoundingClientRect().top - gridTop - top - i * step);
    cards.forEach((card, i) => {
      card.style.setProperty('--stack-top', `${top + i * step}px`);
      card.style.setProperty('--stack-index', String(i + 1));
    });
    work.style.setProperty('--stack-tail', `${Math.min(140, window.innerHeight * .15)}px`);
    work.classList.add('work-stack-active');
    work.classList.toggle('work-stack-compact', step === 0);
    syncStack();
  }

  function syncStack() {
    if (!stackOffsets.length) return;
    // Native sticky owns positioning. Read the grid's current position instead
    // of caching document-level animation starts that can drift after a refresh.
    const position = -grid.getBoundingClientRect().top;
    const end = stackOffsets.at(-1);
    cards.slice(0, -1).forEach((card, i) => {
      const progress = Math.max(0, Math.min(1, (position - stackOffsets[i]) / (end - stackOffsets[i])));
      const scale = 1 - .12 * ((cards.length - 1 - i) / (cards.length - 1)) * progress;
      card.style.transform = `scale(${scale})`;
      card.classList.toggle('is-covered', position >= stackOffsets[i + 1] - 8);
    });
  }

  // The existing period remains the source for names, numbering, and dates.
  // Matching static markup keeps the same identities readable without JavaScript.
  panels.forEach((panel, index) => {
    const period = panel.querySelector('.chapter-period');
    const match = period?.firstElementChild?.textContent.match(/^(\d+) \/ (.+)$/);
    if (!match) return;
    const identity = identities[index];
    identity.querySelector('.chapter-number').textContent = match[1];
    identity.querySelector('.chapter-total').textContent = `/ ${String(panels.length).padStart(2, '0')}`;
    const words = match[2].split(' ');
    const first = document.createElement('span');
    const second = document.createElement('span');
    first.textContent = words.shift();
    second.textContent = words.join(' ');
    identity.querySelector('.chapter-name').replaceChildren(first, document.createTextNode(' '), second);
    identity.querySelector('.chapter-dates').textContent = period.querySelector('.chapter-years').textContent;
  });

  function clearChapterAnimations() {
    chapterAnimations.forEach(animation => animation.cancel());
    chapterAnimations = [];
  }

  function activate(index, animate = false) {
    const previous = selected;
    clearChapterAnimations();
    selected = Math.max(0, Math.min(panels.length - 1, index));
    chapters.dataset.activeChapter = ['account', 'ux', 'ai'][selected];
    chapters.style.setProperty('--chapter-progress', String(selected / Math.max(1, panels.length - 1)));
    panels.forEach((panel, i) => {
      const active = i === selected;
      panel.classList.toggle('is-active', active);
      panel.inert = chaptersPinned && !active;
      if (chaptersPinned) {
        panel.setAttribute('aria-hidden', String(!active));
        panel.tabIndex = active ? 0 : -1;
      } else {
        panel.removeAttribute('aria-hidden');
        panel.removeAttribute('tabindex');
      }
      tabs[i].classList.toggle('is-current', active);
      tabs[i].classList.toggle('is-complete', i < selected);
      if (chaptersPinned) {
        tabs[i].setAttribute('aria-selected', String(active));
        tabs[i].removeAttribute('aria-current');
        tabs[i].tabIndex = active ? 0 : -1;
      } else {
        tabs[i].removeAttribute('aria-selected');
        tabs[i].removeAttribute('tabindex');
        if (active) tabs[i].setAttribute('aria-current', 'step');
        else tabs[i].removeAttribute('aria-current');
      }
    });
    if (animate && previous !== selected && chaptersPinned && !motion.matches && identities[selected].animate) {
      const direction = selected > previous ? 1 : -1;
      chapterAnimations.push(identities[selected].animate([
        { opacity: .25, transform: `translateY(${direction * 16}px)` },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' }));
      chapterAnimations.push(panels[selected].querySelector('.chapter-copy').animate([
        { opacity: .35, transform: 'translateY(8px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 340, easing: 'cubic-bezier(.22,1,.36,1)' }));
    }
  }

  function setupChapters() {
    if (!chapters || !journey || !chapterFrame || !panels.length) return;
    // Keep the last reading position: responsive CSS can move the old layout
    // above the viewport before its resize event reaches this measurement pass.
    const wasInside = chapterLayoutReady && chapterReading;
    const previouslyPinned = chaptersPinned;
    clearChapterAnimations();
    chaptersPinned = false;
    chapters.classList.remove('chapters-pinned', 'chapters-measuring', 'chapters-compact', 'chapters-tight', 'chapters-short');
    for (const property of ['--chapter-identity-height', '--chapter-proof-height',
      '--chapter-content-height', '--chapter-nav-top', '--chapter-stage-height', '--chapter-travel', '--chapter-light-anchor', '--chapter-intro-height']) {
      chapters.style.removeProperty(property);
    }
    chapterStartOffset = 0;
    chapterTop = navOffset();
    chapters.style.setProperty('--chapter-top', `${chapterTop}px`);
    chapterNav.setAttribute('role', 'navigation');
    chapterNav.removeAttribute('aria-orientation');
    panels.forEach((panel, i) => {
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
      panel.removeAttribute('tabindex');
      panel.removeAttribute('role');
      panel.setAttribute('aria-labelledby', identities[i].querySelector('.chapter-name').id);
      tabs[i].removeAttribute('role');
      tabs[i].removeAttribute('aria-controls');
    });

    if (!motion.matches && window.innerWidth >= 1120) {
      // Dock the complete stage at the navigation edge. Its own reading inset
      // preserves the established content position inside that full screen.
      const readingInset = parseFloat(getComputedStyle(chapters).getPropertyValue('--chapter-reading-inset'));
      chapterTop = navOffset() - readingInset;
      chapters.style.setProperty('--chapter-top', `${chapterTop}px`);
      chapters.classList.add('chapters-measuring');
      function measureFrame() {
        for (const property of ['--chapter-identity-height', '--chapter-proof-height', '--chapter-content-height']) {
          chapters.style.removeProperty(property);
        }
        const identityHeight = Math.max(...identities.map(el => el.getBoundingClientRect().height));
        const proofHeight = Math.max(...proofs.map(el => el.getBoundingClientRect().height));
        const navigationGap = parseFloat(getComputedStyle(chapters).getPropertyValue('--chapter-navigation-gap'));
        const contentHeight = Math.max(proofHeight, identityHeight + navigationGap + chapterNav.getBoundingClientRect().height);
        chapters.style.setProperty('--chapter-identity-height', `${identityHeight}px`);
        chapters.style.setProperty('--chapter-proof-height', `${proofHeight}px`);
        chapters.style.setProperty('--chapter-content-height', `${contentHeight}px`);
        chapters.style.setProperty('--chapter-nav-top', `${identityHeight + navigationGap}px`);
        return chapterFrame.getBoundingClientRect().height;
      }
      // The sticky stage already begins below the fixed navigation. Measure
      // against that real stage instead of reserving a second safety gap that
      // can incorrectly disable the sequence on standard laptop viewports.
      const available = window.innerHeight - chapterTop;
      let frame = measureFrame();
      if (frame > available) {
        chapters.classList.add('chapters-compact');
        frame = measureFrame();
      }
      if (frame > available) {
        chapters.classList.add('chapters-tight');
        frame = measureFrame();
      }
      // Desktop width always keeps the chapter transition. If the complete
      // composition is taller than the viewport, the introduction stays in
      // normal flow and the smaller chapter stage pins immediately after it.
      // This avoids the previous intermittent static fallback.
      if (frame > available) {
        chapters.classList.add('chapters-short');
        chapterStartOffset = chapterShell.getBoundingClientRect().top - chapterFrame.getBoundingClientRect().top;
        chapters.style.setProperty('--chapter-intro-height', `${chapterStartOffset}px`);
      }
      chaptersPinned = true;
      chapterTravel = Math.round(window.innerHeight * 1.25);
      // Resolve the settled light position once per layout. It must not ride
      // with the frame while the section enters or leaves the viewport.
      const shellOffset = chapterShell.getBoundingClientRect().top - chapterFrame.getBoundingClientRect().top;
      chapters.style.setProperty('--chapter-light-anchor', `${chapterTop + (chapterStartOffset ? 0 : shellOffset)}px`);
      chapters.style.setProperty('--chapter-stage-height', `${window.innerHeight - chapterTop}px`);
      chapters.style.setProperty('--chapter-travel', `${chapterTravel}px`);
      chapters.classList.add('chapters-pinned');
      chapterNav.setAttribute('role', 'tablist');
      chapterNav.setAttribute('aria-orientation', 'vertical');
      panels.forEach((panel, i) => {
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tabs[i].id);
        tabs[i].setAttribute('role', 'tab');
        tabs[i].setAttribute('aria-controls', panel.id);
      });
      chapters.classList.remove('chapters-measuring');
    }
    chapterLayoutSize = `${window.innerWidth}:${window.innerHeight}`;
    chapterLayoutMotion = motion.matches;
    activate(selected);
    if (wasInside && chaptersPinned) chooseChapter(selected, false);
    else if (wasInside && previouslyPinned) {
      instantScroll(panels[selected].getBoundingClientRect().top + window.scrollY - chapterTop);
    } else syncChapterScroll(false);
    chapterLayoutReady = true;
  }

  function syncChapterScroll(animate = true) {
    if (!chapters || !journey || choosingChapter) return;
    if (chapterLayoutSize !== `${window.innerWidth}:${window.innerHeight}` || chapterLayoutMotion !== motion.matches) return;
    const readingLine = navOffset() + (window.innerHeight - navOffset()) / 3;
    const bounds = journey.getBoundingClientRect();
    chapterReading = bounds.top <= readingLine && bounds.bottom > navOffset();
    let next = 0;
    if (chaptersPinned) {
      // The complete frame, including the introduction, stays in view together.
      const progress = Math.max(0, Math.min(1, (chapterTop - journey.getBoundingClientRect().top - chapterStartOffset) / chapterTravel));
      next = Math.min(panels.length - 1, Math.floor(progress * panels.length));
    } else {
      panels.forEach((panel, i) => {
        if (panel.getBoundingClientRect().top <= readingLine) next = i;
      });
    }
    if (next !== selected) activate(next, animate);
  }

  function chooseChapter(index, animate) {
    if (!chaptersPinned) return;
    const start = journey.getBoundingClientRect().top + window.scrollY + chapterStartOffset - chapterTop;
    choosingChapter = true;
    instantScroll(start + chapterTravel * ((index + .3) / panels.length));
    activate(index, animate);
    choosingChapter = false;
    chapterReading = true;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', event => {
      if (!chaptersPinned) return; // Ordinary anchors reveal the static sequence.
      event.preventDefault();
      chooseChapter(index, true);
    });
    tab.addEventListener('keydown', event => {
      if (!chaptersPinned) return;
      let next;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (event.key === ' ') next = index;
      if (next === undefined) return;
      event.preventDefault();
      chooseChapter(next, true);
      tabs[next].focus({ preventScroll: true });
    });
  });

  function followAnchor() {
    if (!chapters || anchorHandled) return;
    const chapterIndex = panels.findIndex(panel => `#${panel.id}` === window.location.hash);
    if (['#arc', '#chapters'].includes(window.location.hash)) {
      if (window.location.hash === '#arc') history.replaceState(null, '', `${location.pathname}${location.search}#chapters`);
      activate(0);
      instantScroll(journey.getBoundingClientRect().top + window.scrollY - chapterTop);
    } else if (chapterIndex >= 0) {
      if (chaptersPinned) chooseChapter(chapterIndex, false);
      else {
        instantScroll(panels[chapterIndex].getBoundingClientRect().top + window.scrollY - navOffset());
        activate(chapterIndex);
      }
    } else return;
    anchorHandled = true;
  }

  document.querySelectorAll('a[href="#chapters"], a[href="#arc"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (!chapters) return;
      event.preventDefault();
      if (location.hash !== '#chapters') history.pushState(null, '', `${location.pathname}${location.search}#chapters`);
      anchorHandled = false;
      followAnchor();
    });
  });
  function setup() {
    setupStack();
    setupChapters();
  }
  setup();
  // Fonts can change the fit decision; images have explicit intrinsic dimensions.
  (document.fonts?.ready || Promise.resolve()).then(() => { setup(); followAnchor(); });
  document.fonts?.addEventListener('loadingdone', setup);
  // On reload/back navigation, the browser can restore its old scroll position
  // after the first font/layout pass. Resolve chapter bookmarks after restoration.
  window.addEventListener('pageshow', () => {
    (document.fonts?.ready || Promise.resolve()).then(() => requestAnimationFrame(() => {
      setup();
      anchorHandled = false;
      followAnchor();
    }));
  });
  window.addEventListener('hashchange', () => { anchorHandled = false; followAnchor(); });
  window.addEventListener('scroll', () => {
    if (entryFrame) return;
    entryFrame = requestAnimationFrame(() => {
      entryFrame = undefined;
      syncStack();
      syncChapterScroll();
    });
  }, { passive: true });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 640 && nav?.classList.contains('menu-open')) setMenu(false);
    const size = `${window.innerWidth}:${window.innerHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(setup);
  });
  motion.addEventListener('change', setup);
})();

// Decorative logo follower; the award names remain ordinary accessible links.
(() => {
  'use strict';
  const cursor = document.querySelector('.award-cursor');
  const targets = [...document.querySelectorAll('#awards [data-award-cursor]')];
  if (!cursor || !targets.length) return;

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let controller;

  function hide() {
    cursor.classList.remove('is-visible');
  }

  function follow(event) {
    if (event.pointerType === 'touch') return;
    cursor.dataset.award = event.currentTarget.dataset.awardCursor;
    // Track the pointer directly: easing made the gap vary with movement speed.
    const gap = 4;
    const size = cursor.offsetWidth;
    const x = event.clientX + size + gap > innerWidth
      ? event.clientX - size - gap : event.clientX + gap;
    const y = Math.max(gap, Math.min(event.clientY - size / 2, innerHeight - size - gap));
    cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    cursor.classList.add('is-visible');
  }

  function setup() {
    controller?.abort();
    hide();
    document.documentElement.classList.remove('award-cursor-enabled');
    if (!finePointer.matches || reducedMotion.matches) return;

    controller = new AbortController();
    const options = { signal: controller.signal };
    document.documentElement.classList.add('award-cursor-enabled');
    targets.forEach(target => {
      target.addEventListener('pointerenter', follow, options);
      target.addEventListener('pointermove', follow, options);
      target.addEventListener('pointerleave', hide, options);
      target.addEventListener('pointercancel', hide, options);
      target.addEventListener('click', hide, options);
    });
    window.addEventListener('scroll', hide, { ...options, passive: true });
    window.addEventListener('resize', hide, options);
    window.addEventListener('blur', hide, options);
    document.addEventListener('keydown', hide, options);
    document.addEventListener('visibilitychange', hide, options);
  }
  finePointer.addEventListener('change', setup);
  reducedMotion.addEventListener('change', setup);
  setup();
})();
