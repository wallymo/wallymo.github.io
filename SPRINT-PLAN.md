# Portfolio Sprint Plan — AI Job Market Optimization

Target: misterpavano.github.io
Goal: Maximize portfolio effectiveness for landing AI product roles
Approach: Priority-ordered (highest-impact changes first across all pages)

---

## Sprint 1: Signal Boost
*Estimated scope: ~2 hours of implementation*

The fastest wins. These changes affect first impressions and whether a hiring manager keeps scrolling or bounces.

### 1.1 — Fix the invisible content bug (CRITICAL)
- **File:** `index.html`
- **Issue:** Everything below the hero is `opacity: 0` behind a `.reveal-ready .reveal` CSS class + IntersectionObserver JS. If JS fails, stalls, or is blocked, the entire portfolio below the fold is a blank page. This was reproducible in Chrome during testing.
- **Fix:** Add a CSS-only fallback so content is visible by default, and only hide it when JS has loaded and the observer is running. Swap the logic: elements start visible, JS adds the hidden state, then the observer reveals them. Or add a `<noscript>` style override plus a timeout fallback.

### 1.2 — Real metrics in stats bars
- **Files:** `project-02.html`, `project-03.html`
- **Issue:** Stats bars show qualitative labels ("Multimodal", "End-to-end", "Solo") instead of quantifiable impact. Hiring managers in AI want proof of outcomes.
- **Fix:** Replace with placeholder metrics using `[REPLACE]` markers:
  - Project 02: "3 weeks → 4 days" (review cycle), "6 enterprise clients" (scale), "FDA + HIPAA" (keep, this one works)
  - Project 03: "3 shipped products" (keep), "60+ data signals" (from WalleOS copy — better than "Solo"), "90-second generation" (from ListingPal)

### 1.3 — Hero AI signal amplification
- **File:** `index.html`
- **Issue:** Hero tagline ("End to end. Brief to build. Problem to product.") doesn't mention AI. The eyebrow says "AI Product Strategist & Design Leader" but it's small and appears with a delayed animation.
- **Fix:** Strengthen the hero intro paragraph to lead with AI. Current copy buries "built AI products" at the end of the sentence. Move AI to the front: "Built AI products for regulated industries..." Also consider making the eyebrow text larger or more prominent.

### 1.4 — Add contact CTA to nav on all project pages
- **Files:** `project-01.html`, `project-02.html`, `project-03.html`
- **Issue:** Project pages have minimal nav (name + "← All Work"). No way to contact you without going back to index. Hiring managers who are impressed by a case study have no direct path to reach out.
- **Fix:** Add email link or "Let's talk" button to project page navs, matching the index.html nav pattern.

### 1.5 — Consolidate portfolio links in resume
- **File:** `resume.html`
- **Issue:** Resume links to `walle-os.vercel.app` as "AI Portfolio" — but the GitHub Pages site IS your AI portfolio now. Having two separate portfolio links is confusing and splits traffic.
- **Fix:** Update the portfolio link to point to `misterpavano.github.io`, or add both with clear labels ("Case Studies" vs "Interactive Portfolio").

---

## Sprint 2: Content Depth
*Estimated scope: ~3 hours of implementation*

These changes add substance and close gaps in the narrative.

### 2.1 — Reframe or deprioritize Project 01 (Design System)
- **Files:** `index.html`, project page ordering
- **Issue:** The Wix design system case study is a UX/design story, not an AI story. For AI job targeting, it should either be reframed or moved to the end.
- **Options:**
  - **Option A (reframe):** Add a section about how the design system thinking applies to AI — scalable component architectures, design tokens as structured data, systematic thinking that translates to ML pipeline design. Light touch.
  - **Option B (deprioritize):** Reorder projects so Pharma AI (02) leads, AI Product Studio (03) is second, Design System (01) is third. Update all next-project navigation links accordingly.
- **Recommendation:** Option B. Reframing feels forced. Lead with the AI work.

### 2.2 — Surface the infrastructure work from Project 03
- **File:** `project-03.html`
- **Issue:** The "Beyond Products" section mentions a trading system, a newsletter system, and multi-agent orchestration — these are impressive and highly relevant to AI roles. But they're buried in body paragraphs with no names, no details, no visuals.
- **Fix:** Promote these into their own cards or a dedicated "Infrastructure" section with the same visual treatment as the product cards. Pull the better copy from WalleOS (e.g., WeReady described as "AI agent orchestration using Claude Code + Codex CLI + Qwen Code" processing "60+ data signals").

### 2.3 — Add skill tags / tech tags to project cards on index
- **File:** `index.html`
- **Issue:** The WalleOS site tags projects with skills ("AI Orchestration", "Multi-Agent Systems", "Startup Intelligence"). The GitHub Pages site has none. Tags help recruiters and ATS systems match keywords.
- **Fix:** Add small tag pills below each project card on the homepage work section, matching the design system's existing style. Use terms like: `Multi-Agent Systems`, `RAG`, `LLM/VLM`, `FDA/HIPAA`, `Gemini`, `Prompt Engineering`.

### 2.4 — Add a "What I Do" or capabilities section to index
- **File:** `index.html`
- **Issue:** The homepage currently goes hero → trust strip → work → experience → awards → contact. There's no explicit section that says "here's what I actually do" in AI terms. The Wix site has this ("User Research" / "Design System" cards), but framed for UX. The GitHub Pages site needs one framed for AI.
- **Fix:** Check if index.html already has a capabilities section that might be hidden by the reveal bug. If so, update its content. If not, add a concise 3-4 card section: "AI Strategy & Implementation", "Product Design & Architecture", "Regulated Industries", "Full-Stack Delivery".

### 2.5 — Cross-link to WalleOS as interactive demo
- **Files:** `index.html`, `project-03.html`
- **Issue:** WalleOS (the ChatGPT-style portfolio) is itself a shipped AI product — and a compelling one. It should be featured on the GitHub Pages site, not hidden behind a resume link.
- **Fix:** Add a callout or card on the homepage or Project 03 page: "Talk to WallyGPT — an AI-powered version of this portfolio" with a link to walle-os.vercel.app. This is both a portfolio piece and a conversion tool.

---

## Sprint 3: Polish & SEO
*Estimated scope: ~2 hours of implementation*

The details that affect discoverability and professionalism.

### 3.1 — Update meta description on all pages
- **Files:** All HTML files
- **Issue:** Only `index.html` has a meta description. Project pages have none. This affects how the site appears in Google results and when shared on LinkedIn/Slack.
- **Fix:** Add unique `<meta name="description">` to each page:
  - Project 02: "How I built production AI for pharma compliance — claims detection, multimodal analysis, and FDA/HIPAA workflows at Hedgehox."
  - Project 03: "Three shipped AI products built solo — multi-agent orchestration, real estate AI, and workflow automation."
  - Project 01: "Scaling an enterprise design system from 2 to 30 designers across 22 brands at Kinesso/IPG."
  - Resume: "Wally Mostafa — AI product strategist with 15 years in product, design, and regulated industry AI."

### 3.2 — Add Open Graph tags for link previews
- **Files:** All HTML files
- **Issue:** No `og:title`, `og:description`, `og:image` tags. When someone shares your portfolio link on LinkedIn, Slack, or Twitter, it shows a generic preview with no image.
- **Fix:** Add OG tags to each page. Use a screenshot of the hero section or a project image as the og:image. This requires creating a 1200x630 preview image and adding it to assets.

### 3.3 — Add `loading="lazy"` to remaining images
- **Files:** `project-01.html`, `index.html`
- **Issue:** Project 02 and 03 already have lazy loading on images. Project 01 and index may not. With ~59 images in assets, this matters for performance.
- **Fix:** Audit all `<img>` tags and add `loading="lazy"` to any below the fold.

### 3.4 — Mobile QA pass
- **Files:** All HTML files
- **Issue:** Haven't verified mobile rendering with the reveal bug present. Also need to check that the new metrics, tags, and CTAs added in Sprints 1-2 work at 640px and 380px breakpoints.
- **Fix:** Resize browser to mobile widths and screenshot each page. Fix any layout breaks.

### 3.5 — Retire the Wix portfolio or redirect
- **External**
- **Issue:** The Wix site (brownzinoart.wixstudio.com/wallymo) positions you as a "user experience designer" — which directly conflicts with the AI product strategist positioning on the GitHub Pages site. Having both live creates a confused identity.
- **Recommendation:** Either take the Wix site down, add a redirect to the GitHub Pages site, or at minimum update its hero to match the AI positioning. This isn't a code change on the repo — it's a strategic decision.

---

## Priority summary

| Priority | Task | Impact |
|----------|------|--------|
| P0 | Fix invisible content bug (1.1) | Site is literally broken below the fold |
| P0 | Real metrics in stats bars (1.2) | Proof > narrative for AI hiring |
| P1 | Hero AI signal (1.3) | First 6 seconds matter |
| P1 | Contact CTA on project pages (1.4) | Don't lose warm leads |
| P1 | Reorder projects — AI first (2.1) | Lead with your strongest hand |
| P2 | Surface infrastructure work (2.2) | Shows depth beyond products |
| P2 | Skill tags on index (2.3) | Keyword matching for recruiters |
| P2 | Cross-link WalleOS (2.5) | It's a shipped AI product, show it |
| P3 | Meta descriptions + OG tags (3.1, 3.2) | Discoverability and shareability |
| P3 | Retire/update Wix site (3.5) | Conflicting identity |
