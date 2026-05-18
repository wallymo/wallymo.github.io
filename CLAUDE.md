# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# wallymo.github.io

Personal portfolio site for Wally Mostafa — AI product strategist. Deployed on GitHub Pages.

## Stack

Pure HTML + CSS, no build step, no JS framework. All styles are embedded `<style>` blocks in each HTML file. Typography via Google Fonts (Syne display, Instrument Sans body). Images live in `assets/`.

## Commands

No build, lint, or test commands. Preview locally with any static server:

```bash
npx serve .          # or python3 -m http.server
```

Push to `main` → GitHub Pages auto-deploys. No CI, no build step. What you commit is what goes live.

## Structure

```
index.html          # Homepage / project index
project-01.html     # Case study: Pharma AI Platform (Hedgehox)
project-02.html     # Case study: The POC Guy (One Block Away)
project-03.html     # Case study: Enterprise Design System (Kinesso)
resume.html         # Resume page with download/share actions
hero-morph.html     # Hero experiment (untracked)
hero-nodes.html     # Hero experiment (untracked)
assets/             # ~59 JPG images supporting case studies
```

## Design System

CSS custom properties defined in `:root` at the top of each file — copy from any existing page when adding new ones:

- Colors: `--ink`, `--surface`, `--accent` (#c45a2d), `--rule`
- Spacing: fluid scale via `clamp()` — `--space-xs` through `--space-3xl`
- Layout: `--max-w: 1140px`
- Fonts: `--font-display` (Syne), `--font-body` (Instrument Sans)

## JavaScript (progressive enhancement only)

The site uses small, targeted JS blocks — no frameworks. All JS is inline, at the bottom of each file.

- **Scroll-reveal** (`index.html`, hero experiments): IntersectionObserver adds `.visible` to `.reveal` elements. Graceful fallback — if JS fails, content stays visible via a 2.5s safety-net timeout.
- **WebGL hero canvas** (`index.html`, `hero-morph.html`, `hero-nodes.html`): Slow noise-field contours rendered via a fullscreen quad shader. Silent fallback if WebGL unavailable.

When adding JS: keep it inline, keep it progressive (page must work without it), and avoid introducing dependencies beyond icon libraries.

## Conventions

- Mobile-first responsive. Breakpoints at 640px and 380px.
- Each project page follows the same template: fixed nav → hero (number + title + role) → stats bar → content sections → next-project nav.
- Images are JPG in `assets/`. No lazy loading currently — add `loading="lazy"` when touching image-heavy sections.

## Key Context

- Site owner: Wally Mostafa (brownzinoart@gmail.com)
- Repo: https://github.com/wallymo/wallymo.github.io
