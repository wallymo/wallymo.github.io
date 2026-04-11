# misterpavano.github.io

Personal portfolio site for Wally Mostafa — AI product strategist. Deployed on GitHub Pages.

## Stack

Pure HTML + CSS, no build step, no JS framework. All styles are embedded `<style>` blocks in each HTML file. Typography via Google Fonts (Syne display, Instrument Sans body). Images live in `assets/`.

## Structure

```
index.html          # Homepage / project index
project-01.html     # Case study: Enterprise Design System (Wix)
project-02.html     # Case study: Pharma AI Platform (Hedgehox)
project-03.html     # Case study: AI Product Studio (One Block Away)
resume.html         # Resume page with download/share actions
assets/             # ~59 JPG images supporting case studies
```

## Design System

CSS custom properties defined in `:root` at the top of each file — copy from any existing page when adding new ones:

- Colors: `--ink`, `--surface`, `--accent` (#c45a2d), `--rule`
- Spacing: fluid scale via `clamp()` — `--space-xs` through `--space-3xl`
- Layout: `--max-w: 1140px`
- Fonts: `--font-display` (Syne), `--font-body` (Instrument Sans)

## Conventions

- Mobile-first responsive. Breakpoints at 640px and 380px.
- Each project page follows the same template: fixed nav → hero (number + title + role) → stats bar → content sections → next-project nav.
- No JavaScript. Keep it that way unless there's a strong reason.
- Images are JPG in `assets/`. No lazy loading currently — add `loading="lazy"` when touching image-heavy sections.

## Deployment

Push to `main` → GitHub Pages auto-deploys. No CI, no build step. What you commit is what goes live.

## Key Context

- Site owner: Wally Mostafa (brownzinoart@gmail.com)
- Bootstrapping MVP as solo founder
- Repo: https://github.com/MisterPavano/misterpavano.github.io
