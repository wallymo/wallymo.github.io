/* Progressive enhancement for the revision's selected work and career chapters. */
(() => {
  'use strict';
  const work = document.getElementById('work');
  const chapters = document.getElementById('chapters');
  const cards = [...(work?.querySelectorAll('.work-grid > .work-item') || [])];
  const panels = [...(chapters?.querySelectorAll('.chapter-state') || [])];
  const tabs = [...(chapters?.querySelectorAll('.chapter-tab') || [])];
  const shell = chapters?.querySelector('.chapter-shell');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
  const canAnimate = Boolean(gsap && ScrollTrigger);
  let triggers = [];
  let chapterTrigger;
  let chapterAnimation;
  let choosingChapter = false;
  let selected = 0;
  let chapterTop = 0;
  let chapterTravel = 0;
  let stackPositions = [];
  let resizeFrame;
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
      instantScroll(stackPositions[index]);
    });
  });

  function clearStack() {
    triggers.forEach((trigger) => trigger.kill());
    triggers = [];
    work?.classList.remove('work-stack-active');
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
    if (!work || !canAnimate || motion.matches || window.innerWidth < 1120 || cards.length < 2) return;
    const top = navOffset();
    const step = 46;
    // Measure the real selected cards. A short viewport gets the complete flat layout.
    const heights = cards.map((card) => card.getBoundingClientRect().height);
    const cardHeight = Math.max(...heights);
    if (cardHeight + top + (cards.length - 1) * step + 24 > window.innerHeight) return;
    // Equal heights keep mixed JD selections aligned as they leave the stack.
    // This only adds room; it never reduces type or clips a taller card.
    cards.forEach((card) => { card.style.minHeight = `${cardHeight}px`; });
    stackPositions = cards.map((card, i) => card.getBoundingClientRect().top + window.scrollY - top - i * step);
    cards.forEach((card, i) => {
      card.style.setProperty('--stack-top', `${top + i * step}px`);
      card.style.setProperty('--stack-index', String(i + 1));
    });
    work.style.setProperty('--stack-tail', `${Math.min(140, window.innerHeight * .15)}px`);
    work.classList.add('work-stack-active');
    cards.slice(0, -1).forEach((card, i) => {
      const start = stackPositions[i];
      const end = stackPositions[cards.length - 1];
      triggers.push(ScrollTrigger.create({
        start, end,
        onUpdate: (self) => {
          const scale = 1 - .12 * ((cards.length - 1 - i) / (cards.length - 1)) * self.progress;
          gsap.set(card, { scale });
          card.classList.toggle('is-covered', window.scrollY >= stackPositions[i + 1] - 8);
        },
      }));
    });
  }

  function activate(index, animate = false) {
    chapterAnimation?.kill();
    chapterAnimation = undefined;
    selected = Math.max(0, Math.min(panels.length - 1, index));
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
    chapterTrigger?.kill();
    chapterAnimation?.kill();
    chapterAnimation = undefined;
    chapterTrigger = undefined;
    chapters.classList.remove('chapters-pinned', 'chapters-enhanced');
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
    if (!canAnimate || window.innerWidth < 1120 || Math.max(panelHeight, introHeight) + 96 > frame) return;
    chapterTravel = Math.round(window.innerHeight * 1.25);
    chapters.style.setProperty('--chapter-top', `${chapterTop}px`);
    chapters.style.setProperty('--chapter-frame-height', `${frame}px`);
    chapters.style.setProperty('--chapter-travel', `${chapterTravel}px`);
    chapters.classList.add('chapters-pinned');
    chapterTrigger = ScrollTrigger.create({
      trigger: chapters,
      start: `top ${chapterTop}`,
      end: `+=${chapterTravel}`,
      onUpdate: (self) => {
        if (choosingChapter) return;
        const next = Math.min(panels.length - 1, Math.floor(self.progress * panels.length));
        if (next !== selected) activate(next, true);
      },
    });
    const progress = Math.max(0, Math.min(1, (window.scrollY - chapterTrigger.start) / chapterTravel));
    activate(Math.min(panels.length - 1, Math.floor(progress * panels.length)));
  }

  function chooseChapter(index, animate) {
    if (motion.matches) return;
    if (chapterTrigger) {
      const position = chapterTrigger.start + chapterTravel * ((index + .3) / panels.length);
      choosingChapter = true;
      instantScroll(position);
      ScrollTrigger.update();
      choosingChapter = false;
    }
    activate(index, animate);
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
      instantScroll(chapters.getBoundingClientRect().top + window.scrollY - navOffset());
      anchorHandled = true;
    }
  }
  function setup() {
    setupStack();
    setupChapters();
    ScrollTrigger?.refresh();
  }
  setup();
  // Fonts can change the fit decision; images have explicit intrinsic dimensions.
  (document.fonts?.ready || Promise.resolve()).then(() => { setup(); followAnchor(); });
  window.addEventListener('hashchange', () => { anchorHandled = false; followAnchor(); });
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
