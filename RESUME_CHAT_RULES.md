# Chat-Only Resume Tailoring Rules

No standalone paste/upload UI. Do this in chat from the job description the user provides.

## Quick Workflow

1. Read the JD, `resume.html`, and the current role route rules before writing.
2. Create/update one role route from `index.html`; tailor only metadata, hero copy, nav resume link, and contact resume link.
3. Create the tailored resume from `resume.html` or the current canonical resume shell, never from another role's resume unless updating that same role.
4. Keep `/`, `resume.html`, and `assets/Wally-Mostafa-Resume.pdf` unchanged unless explicitly asked.
5. Link the tailored resume's `Portfolio` contact item to the matching role route, not the homepage.
6. If a cover letter is requested, create matching HTML, PDF, and Markdown under `output/pdf/`; the HTML screen view should look like the PDF page and link back to the role route.
7. Render and verify PDFs: page count, no browser headers/footers, clean text extraction, visible linked text, and correct embedded URLs.
8. Treat a role-specific `Portfolio` link as publish-blocking: if the PDF links to `https://wallymo.github.io/<role>/`, that route and its matching resume HTML/PDF must be committed, pushed, and verified live before reporting the artifact as ready to send.
9. Publish is the default. After local verification, stage, commit, and push the scoped route plus matching resume artifacts unless the user explicitly asks for a local-only artifact.
10. Run `node scripts/verify-tailored-route.mjs <route-slug> <resume-html-path> <resume-pdf-path>` before final delivery for any matched route. This check must pass. Do not end with a local-only caveat unless publishing is blocked by credentials, network, GitHub Pages, or another external failure that you cannot resolve in the current turn.

## Output Contract

- Output a tailored resume in the same visual and structural style as `resume.html` and `assets/Wally-Mostafa-Resume.pdf`.
- Start each new tailored resume from `resume.html` or the current canonical resume shell. Do not use another role-specific tailored resume as the source template unless you are updating that exact same role.
- Keep it recruiter-facing: concise, concrete, chronological, ATS-readable.
- Do not output fit scores, match rates, leverage/missing analysis, proof-link lists, or cover letters unless explicitly requested.
- Default to a matched resume + role route workflow: when the user says "tailor this resume" for a role, create the tailored resume artifacts and a hidden role-specific portfolio route.
- Write every tailored-route hero intro in first person. It may directly explain why I fit the role, but never use third-person candidate-summary copy (`Wally`, `he`, `him`, or `his`).
- End every post-application recruiter note with this exact line: `Would love to hop on a call to chat about this opening or any other across your desk you might see fit.`
- Preserve the resume hierarchy: Summary, Capabilities, Experience, Awards, Education.
- Keep the portfolio link in the contact line. If a role-specific portfolio route exists, link the tailored resume to that route.

## Matched Portfolio Route

Use the Lenovo workflow as the default pattern.

- Create a route at `/<company-or-role-slug>/` using `index.html` as the base. Do not copy a different role route as the starting point; that leaks old role framing and stale artifact links.
- Keep the public homepage `/`, public `resume.html`, and `assets/Wally-Mostafa-Resume.pdf` untouched unless the user explicitly asks to change the global site.
- Only tailor the route where it reduces recruiter confusion:
  - Page title, meta description, and Open Graph URL/title/description.
  - Hero eyebrow, tagline chips, and intro copy.
  - Contact subtitle if needed.
  - Any relative paths required because the route lives in a subfolder.
- Keep the rest of the portfolio stable by default: visual system, work cards, case-study order, awards, experience arc, and capabilities layout should not drift.
- On the role route, the nav `Resume` button must point to the tailored resume HTML source under `output/pdf/`.
- On the role route, the contact `Download Resume` link must point to the tailored resume PDF under `output/pdf/`.
- In the tailored PDF, the contact line should still say `Portfolio`, and that link should point to the matching role route.
- Do not link the tailored PDF to public `resume.html`; that creates a second-resume comparison for recruiters.
- Do not swap the tailored PDF's `Portfolio` link back to the public homepage as a workaround for an unpublished role route. Keep the role-route link, publish the route if possible, and clearly report any publish/auth blocker.
- Stage/commit/push only the scoped role route and its matching tailored resume artifacts. Leave unrelated dirty files alone.
- Never call a tailored PDF "ready" while its role route is untracked, uncommitted, unpushed, or live-404ing. Publish and verify the scoped route/artifacts before final delivery. Only stop with a local-only status when the user explicitly requests it or an external blocker prevents publishing after a real attempt.

## Visual Style

- Letter-size resume, ideally two pages.
- White page, no card frame, no portfolio-site nav.
- Centered uppercase name: `WALLY MOSTAFA`.
- Contact line: `wmostafa12@gmail.com · 347.420.3558 · Raleigh Metro, NC · LinkedIn · Portfolio`.
- Section labels are uppercase, compact, letter-spaced, and separated by thin horizontal rules.
- Body copy is compact, around 9.5-10pt, with strong scan hierarchy.
- Job title on the left; company/location/dates on the right in italic where space allows.
- Capabilities and awards are line items, not decorative cards.
- Hard rule: if text is linked, the linked text must be visibly underlined in the PDF/print output. This especially applies to linked award names.

## Source Of Truth

- Base resume content: `resume.html`.
- PDF styling reference: `assets/Wally-Mostafa-Resume.pdf` or the attached current resume PDF.
- Keep claims grounded in existing portfolio/resume evidence.
- Do not inflate frontend/tooling claims beyond what the resume and project pages support.
- For tailored PDFs with matching portfolio routes, the `Portfolio` link should point to that route. The route's Resume/Download Resume links must use the same tailored resume PDF/source, not the global resume.

## Tailoring Logic

- Read the JD for title, seniority, domain, and repeated requirements.
- Tune Summary toward the target role without changing the core identity: AI product strategist, design leader, enterprise UX, regulated/pharma AI implementation.
- Select 4-5 Capabilities that match the JD language. Prefer:
  - AI Strategy and Implementation
  - Product Strategy and POC Development
  - Regulated and Enterprise Delivery
  - UX Leadership and Design Systems
  - RAG and Knowledge Workflows
  - Governance, Privacy, and Risk
  - Enterprise Delivery
- Reorder emphasis inside bullets, but keep experience chronological.
- Keep strongest supported proof points visible:
  - Claims Detector investor outcome
  - MLR/regulated pharma AI workflows
  - Scope Generator for agency finance/operations
  - ListingPal and WeReady Bailey as AI POCs
  - Kinesso design org scale from 2 to 30
  - 7,000+ users and 22 white-label brands
  - Indigo and Red Dot recognition
- Use the JD's keywords naturally, especially when they overlap with real experience: LLM, RAG, document intelligence, governance, privacy, HIPAA, FDA, MLR, enterprise workflows, dashboards, data visualization, design systems, accessibility, stakeholder leadership, prototype, production handoff.

## Delivery In Chat

- If the user provides a JD and asks to tailor the resume, create and publish the matched resume + role route workflow unless they explicitly ask for resume text only or local-only files.
- Create a local HTML/PDF artifact using the `resume.html` visual style, then verify the rendered PDF before reporting it.
- Verify the role route locally and, if pushed live, verify the live role URL and live resume artifact URLs return `200`.
- Keep the answer tight: mention the artifact path and any important caveat only.
