/* Progressive enhancement for the revision's selected work and career chapters. */
(() => {
  'use strict';
  const work = document.getElementById('work');
  const chapters = document.getElementById('chapters');
  const cards = [...(work?.querySelectorAll('.work-grid > .work-item') || [])];
  const grid = work?.querySelector('.work-grid');
  const panels = [...(chapters?.querySelectorAll('.chapter-state') || [])];
  const tabs = [...(chapters?.querySelectorAll('.chapter-tab') || [])];
  const chapterMarks = [...(chapters?.querySelectorAll('[data-chapter-mark]') || [])];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap;
  const canAnimate = Boolean(gsap);
  let chaptersPinned = false;
  let chapterAnimation;
  let choosingChapter = false;
  let selected = 0;
  let chapterTop = 0;
  let chapterTravel = 0;
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

  let wallpaperVisible = false;
  let wallpaperIndex = -1;
  let wallpaperAnimations = [];
  function revealChapterWallpaper(replay = false) {
    if (motion.matches || document.hidden || !wallpaperVisible) return;
    if (!replay && wallpaperIndex === selected) return;
    wallpaperAnimations.forEach(animation => animation.cancel());
    wallpaperAnimations = [];
    wallpaperIndex = selected;
    chapterMarks.forEach((mark, index) => {
      mark.style.opacity = index === selected ? '1' : index < selected ? '.22' : '0';
      [...mark.children].forEach((stroke, i) => {
        stroke.style.removeProperty('stroke-dashoffset');
        if (index === selected && stroke.animate) {
          wallpaperAnimations.push(stroke.animate(
            [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }],
            { duration: 1300, delay: i * 140, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }
          ));
        }
      });
    });
  }

  function activate(index, animate = false) {
    chapterAnimation?.kill();
    chapterAnimation = undefined;
    selected = Math.max(0, Math.min(panels.length - 1, index));
    revealChapterWallpaper();
    const period = panels[selected].querySelector('.chapter-period');
    const label = chapters.querySelector('.chapter-window-label');
    if (label && period) {
      const name = period.querySelector('span').textContent;
      const years = document.createElement('span');
      years.className = 'chapter-years';
      years.textContent = period.textContent.slice(name.length).trim();
      label.replaceChildren(document.createTextNode(`${name} · `), years);
    }
    panels.forEach((panel, i) => {
      const active = i === selected;
      // Always restore the full state before starting another transition.
      // This keeps rapid clicks, reverse scroll, and resize from stranding faded text.
      gsap?.killTweensOf(panel.children);
      for (const child of panel.children) {
        child.style.removeProperty('opacity');
        child.style.removeProperty('transform');
      }
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', String(!active));
      panel.inert = !active;
      panel.tabIndex = active ? 0 : -1;
      tabs[i].setAttribute('aria-selected', String(active));
      tabs[i].tabIndex = active ? 0 : -1;
    });
    if (animate && canAnimate && !motion.matches) {
      // Set + to avoids a delayed fromTo start-state restoring hidden content
      // after a keyboard action has already interrupted the animation.
      gsap.set(panels[selected].children, { opacity: 0, y: 12 });
      chapterAnimation = gsap.to(panels[selected].children,
        { opacity: 1, y: 0, duration: .34, stagger: .045, ease: 'power2.out', clearProps: 'opacity,transform' });
    }
  }

  function setupChapters() {
    if (!chapters || !panels.length) return;
    chapterAnimation?.kill();
    chapterAnimation = undefined;
    chaptersPinned = false;
    chapters.classList.remove('chapters-pinned', 'chapters-enhanced');
    wallpaperAnimations.forEach(animation => animation.cancel());
    wallpaperAnimations = [];
    wallpaperIndex = -1;
    chapterMarks.forEach(mark => {
      mark.style.removeProperty('opacity');
      [...mark.children].forEach(stroke => stroke.style.removeProperty('stroke-dashoffset'));
    });
    panels.forEach((panel) => {
      gsap?.killTweensOf(panel.children);
      for (const child of panel.children) {
        child.style.removeProperty('opacity');
        child.style.removeProperty('transform');
      }
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
      panel.removeAttribute('tabindex');
      panel.removeAttribute('role');
      panel.removeAttribute('aria-labelledby');
    });
    if (motion.matches) return;
    chapters.querySelector('.chapter-tabs').setAttribute('aria-orientation', window.innerWidth >= 1120 ? 'vertical' : 'horizontal');
    chapters.classList.add('chapters-enhanced');
    panels.forEach((panel, i) => {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', tabs[i].id);
    });
    activate(selected);
    chapterTop = navOffset();
    const frame = window.innerHeight - chapterTop - 24;
    const panelHeight = chapters.querySelector('.chapter-stage').getBoundingClientRect().height;
    const introHeight = chapters.querySelector('.chapter-intro').getBoundingClientRect().height;
    if (window.innerWidth < 1120 || Math.max(panelHeight, introHeight) + 96 > frame) return;
    chapterTravel = Math.round(window.innerHeight * 1.25);
    chapters.style.setProperty('--chapter-top', `${chapterTop}px`);
    chapters.style.setProperty('--chapter-frame-height', `${frame}px`);
    chapters.style.setProperty('--chapter-travel', `${chapterTravel}px`);
    chapters.classList.add('chapters-pinned');
    chaptersPinned = true;
    syncChapterScroll(false);
  }

  function syncChapterScroll(animate = true) {
    if (!chapters || motion.matches || choosingChapter) return;
    if (!chaptersPinned) { resetBeforeChapterEntry(); return; }
    // Read the native sticky section itself. A cached animation trigger start can
    // become stale during refresh, restoration, or changes to the projects above.
    const progress = Math.max(0, Math.min(1, (chapterTop - chapters.getBoundingClientRect().top) / chapterTravel));
    const next = Math.min(panels.length - 1, Math.floor(progress * panels.length));
    if (next !== selected) activate(next, animate);
  }

  function chooseChapter(index, animate) {
    if (motion.matches) return;
    if (chaptersPinned) {
      const start = chapters.getBoundingClientRect().top + window.scrollY - chapterTop;
      const position = start + chapterTravel * ((index + .3) / panels.length);
      choosingChapter = true;
      instantScroll(position);
      choosingChapter = false;
    }
    activate(index, animate);
    if (chaptersPinned) syncChapterScroll(false);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => chooseChapter(index, true));
    tab.addEventListener('keydown', (event) => {
      let next;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      chooseChapter(next, false);
      tabs[next].focus({ preventScroll: true });
    });
  });

  function followAnchor() {
    if (!chapters || !['#arc', '#chapters'].includes(window.location.hash)) return;
    if (window.location.hash === '#arc') history.replaceState(null, '', `${location.pathname}${location.search}#chapters`);
    if (!anchorHandled) {
      if (!motion.matches) activate(0);
      instantScroll(chapters.getBoundingClientRect().top + window.scrollY - navOffset());
      anchorHandled = true;
    }
  }

  function resetBeforeChapterEntry() {
    // Unpinned tabs have no scroll trigger to rewind their selected state.
    // Reset while the section is below the viewport, before it enters again.
    if (!chapters || motion.matches || chaptersPinned || selected === 0) return;
    if (chapters.getBoundingClientRect().top >= window.innerHeight) activate(0);
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
    resetBeforeChapterEntry();
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
    if (entryFrame || motion.matches) return;
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
  if (chapters && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      wallpaperVisible = entry.isIntersecting;
      if (wallpaperVisible) revealChapterWallpaper(true);
      else wallpaperAnimations.forEach(animation => animation.pause());
    }, { threshold: 0, rootMargin: '-12% 0px -12% 0px' }).observe(chapters.querySelector('.chapter-shell'));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) wallpaperAnimations.forEach(animation => animation.pause());
    else if (wallpaperVisible) {
      syncChapterScroll(false);
      revealChapterWallpaper();
      wallpaperAnimations.filter(animation => animation.playState === 'paused').forEach(animation => animation.play());
    }
  });
})();
