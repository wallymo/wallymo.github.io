# Chat-Only Resume Tailoring Rules

No standalone paste/upload UI. Do this in chat from the job description the user provides.

## Quick Workflow

1. Read the JD, `resume.html`, the case studies, and the current role route rules before writing.
2. Identify the role's evidence mode before scoring fit: `portfolio-primary`, `balanced`, `resume-primary`, or `credential-or-technical-primary`.
3. Run the fit gate before creating artifacts: evaluate the primary evidence first, use the other source as supporting proof, identify the strongest supported overlap and biggest unsupported requirements, and classify the role as `strong`, `adjacent`, `stretch`, or `not-fit`.
4. Make a separate cover-letter bridge call: `not-needed` for a direct strong fit, `recommended` when all hard gates pass and the overall skill set supports a credible transfer story, or `not-credible` when persuasion would require hiding or inventing a structural gap. When recommended, say plainly, `We can make the case with a cover letter`, and identify the evidence-backed bridge.
5. Stop if the role is `not-fit`. Do not create route, resume, PDF, or cover-letter files. Instead, explain the blocker and suggest the narrowest honest way to make the opportunity fit, such as a different title target, a narrower positioning angle, or missing proof the human would need to supply.
6. Stop on `stretch` unless the human explicitly asks to proceed after seeing the risk. A recommended cover-letter bridge does not replace this approval. If approved, proceed only with narrow honest positioning.
7. Select the Revision 7 resume base from the JD's operating center: `account-leadership`, `ai-product-implementation`, or `hybrid-selective`. Industry does not decide the base. Use hybrid only when both disciplines are direct core responsibilities, then record the lead profile, account presentation, `tailor-to-jd` action, and rationale.
8. Persist a v2 Revision 7 package config at `scripts/packages/<slug>.json` using `scripts/examples/package-v2.json` as the contract. Use the self-contained showcase pattern by default: `routeMode: "scoped-projects"`, `route.presentation: "showcase"`, and `route.heroIntent: "resume-support"`. Use `full` or `canonical-projects` only as an explicit, intentional opt-out when the public portfolio narrative is part of the role's proof. Write a concise summary that fits the page-one layout, choose four to six supported skills, preserve evidence attribution and role metadata, and use unique `addition:<slug>` IDs only for new supported bullets.
9. Run the complete `humanizer` skill over all authored copy. Unless the human explicitly requested a rewrite, make surface-only changes and preserve the content, structure, claims, proof, order, and ending. Complete the skill's final anti-AI audit before approval.
10. Run `node scripts/humanizer-check.mjs --config scripts/packages/<slug>.json --approve --semantic-pass-complete`. This attests that the full semantic skill pass is complete; the static scan cannot approve copy by itself. Use `--rewrite-requested` only when the human explicitly requested a rewrite. Any later copy change invalidates this approval.
11. Run `node scripts/build-tailored-package.mjs --config scripts/packages/<slug>.json`. Use `--allow-stretch` only after explicit approval and `--overwrite` only when intentionally rebuilding the same package.
12. Treat builder success as `qa-passed`, not published. Review its advisory requirement-coverage warnings. Desktop/mobile screenshots are temporary diagnostics: a passing build deletes them automatically, while a failing build leaves them under ignored `tmp/qa/<slug>/` for inspection.
13. Keep `/`, canonical project pages, and the public resume untouched unless explicitly authorized. The v2 builder uses the canonical resume shell plus the versioned evidence profiles; it never treats an arbitrary tailored resume as a new source.
14. Keep the tailored resume PDF as the only recruiter-facing resume artifact. Temporary HTML lives under ignored `tmp/tailored-resumes/` and must be removed after successful rendering.
15. If the bridge verdict is `recommended`, apply the same humanizer process and create the matching cover-letter PDF and Markdown under `output/pdf/` in the same build. Do not wait for another request. A strong `not-needed` package skips the letter unless the human asks for one; a `not-credible` package never creates one. Any render HTML remains temporary and private. Every new or rebuilt letter uses the locked `real-chemistry-21grams-v1` visual template; only the role-specific content changes.
16. Treat the role-specific `Portfolio` annotation as publish-blocking. The route, selected scoped files, config, manifest entry, and PDF must be committed and pushed before live verification.
17. Re-check the staged diff and publish only the current package's scoped files. Leave unrelated dirty worktree changes alone.
18. Run `node scripts/verify-tailored-route.mjs <route-slug>` after publication. It must verify live `200` responses and local/live config, route, scoped-project, and PDF checksum parity before changing `publishStatus` to `live-verified`. Commit and push the resulting verification-only manifest update.
19. Before submission, inspect the live form and write a private readiness snapshot with `node scripts/application-ledger.mjs ready ...`. Review screening questions, form hard gates, the uploaded filename and checksum, parsed identity and work-history fields, LinkedIn consistency, narrative answers, duplicate roles, automated-processing notices, assessments, and platform warnings. A blocked or unavailable check means the application is not submission-ready.
20. Submit manually. Only after visible submission confirmation, run `node scripts/application-ledger.mjs record ...`. Revisions 5, 6, and 7 require the matching readiness snapshot. Revision 6 or 7 readiness must show that a recommended cover letter was included. Log assessment events, outreach drafts, sent messages, replies, and later stages as distinct dated events.

## Output Contract

- Output a tailored resume in the same visual and structural style as `resume.html` and `assets/Wally-Mostafa-Resume.pdf`.
- Start each new tailored resume from `resume.html` or the current canonical resume shell. Do not use another role-specific tailored resume as the source template unless you are updating that exact same role.
- Treat `scripts/resume-foundation.json` as the shared evidence catalog and `scripts/resume-base-profiles.json` as the versioned Account Leadership and AI/Product evidence registry. Tailor the summary, choose four to six supported skills, and edit experience-bullet wording without changing source attribution, employers, titles, dates, awards, or education.
- Keep the fixed ATS-safe shell normalization (`Skills`, `Raleigh, NC`, `347-420-3558`, and `2 to 30`) unchanged across packages.
- In a pure base mode, retain that profile's required evidence. In `hybrid-selective`, choose the strongest JD-matched evidence from both profiles; do not concatenate both complete resumes or require all combined evidence items. Every selected source ID stays exactly once under its original employer, and additions use unique `addition:<slug>` IDs.
- Preserve the complete One Block Away section in every mode unless the human separately authorizes an exception. Keep the output to two readable pages; hybrid access to both pools is not permission to shrink the type or overwhelm the reader.
- Keep it recruiter-facing: concise, concrete, chronological, ATS-readable.
- Every authored line must pass the `humanizer` skill. The default is surface-only cleanup; keep content, structure, claims, and endings intact unless the human asks for a rewrite.
- Do not output fit scores, match rates, leverage/missing analysis, or proof-link lists unless explicitly requested. The cover-letter bridge verdict is always part of the fit gate. A recommended letter is part of the built package and is not held for a second request.
- A supplied JD that clears as `strong` or `adjacent` is authorization to build and publish the matched resume + role route workflow; do not stop after the gate to request a separate confirmation. Treat the human's plain-language `good` fit as `adjacent`. A `stretch` still requires explicit approval.
- Treat the route as a focused proof path, not a full portfolio dump: use 3 projects by default, 4 only when the JD genuinely needs breadth, and 5 only when the human explicitly asks for a deeper version.
- Write every tailored-route hero intro in first person. A showcase hero supports the resume by introducing recent work that may be relevant; it does not sell the fit or repeat the resume case. An explicitly full route may explain fit directly. Never use third-person candidate-summary copy (`Wally`, `he`, `him`, or `his`).
- End every post-application recruiter note with this exact line: `Would love to hop on a call to chat about this opening or any other across your desk you might see fit.`
- Preserve the resume hierarchy: Summary, Skills, Experience, Awards, Education.
- Keep the portfolio link in the contact line. If a role-specific portfolio route exists, link the tailored resume to that route.
- The generated resume is JD-specific. Its `Portfolio` link must point exclusively to the matching JD route, never the homepage or another role route.

## Fit Gate Contract

- Fit gate comes before all artifact work.
- Required gate output: evidence mode, primary source, fit class, cover-letter bridge verdict and rationale, resume-base mode/action/rationale, supported overlap, unsupported requirements, actual mismatches, and the recommended path.
- Select `account-leadership` when client relationships, account planning, budgets, delivery, retention, or adoption form the primary operating center. This applies across industries, not only healthcare.
- Select `ai-product-implementation` when AI delivery, product ownership, workflow design, UX, research, or implementation form the primary operating center. A healthcare employer does not make an AI/product role account-led.
- Select `hybrid-selective` only when both disciplines appear as direct core responsibilities. Generic client language in an AI role or generic technology language in an account role is not enough. `leadProfileId` determines the summary emphasis and section order without limiting truthful evidence selection.
- Use `accountPresentation: agency-progression` when account tenure, seniority, or title progression is a central screen. Use `consolidated` when account leadership supports an AI/product-led role but is not the primary tenure screen.
- Every employer JD requires `action: tailor-to-jd`. `use-existing` is limited to general networking without an employer JD.
- `portfolio-primary`: UX/UI, product design, visual design, design systems, service design, and portfolio-led research. Case studies drive the fit call; the resume supports seniority, scope, and continuity.
- `balanced`: product management, AI product strategy/implementation, innovation, experience strategy, design leadership, and consultative solution design. Resume ownership/outcomes and portfolio execution evidence both matter.
- `resume-primary`: account/client/customer success, program or project management, operations, partnerships, strategy, sales, and most solutions consulting or pre-sales. The resume drives the fit call through direct ownership and outcomes; the portfolio is a credibility layer and should not be treated as a required UX-style book.
- `credential-or-technical-primary`: engineering, architecture, cybersecurity, finance, clinical, and certification-dependent work. Direct experience, credentials, repositories, or technical artifacts drive fit; the visual portfolio cannot replace them.
- Let explicit JD proof requirements override these defaults.
- Supporting evidence can strengthen an adjacent case, but cannot erase a structural gap in the primary hiring signal.
- Do not downgrade a resume-primary role solely because the portfolio lacks a matching case study. Do not upgrade it solely because a case study shows transferable communication or problem-solving skill when the resume lacks required commercial, operational, technical, or credential ownership.
- `strong`: immediately proceed with the direct role-specific package.
- `adjacent` (or the human's plain-language `good`): immediately proceed, but keep the positioning narrow and honest.
- `stretch`: stop until the human explicitly approves the risk; then proceed only with supported adjacency.
- `not-fit`: stop and do not create files. Suggest how to make it fit honestly, such as a better target title, a narrower role lane, or specific proof the human would need to add.
- `not-needed`: the direct `strong` evidence already makes the case; a cover letter may still be requested, but it is not the bridge that makes the application credible.
- `recommended`: all hard gates pass, the role is `adjacent` or `stretch`, and the combined resume/portfolio evidence supports a specific transferable-skills argument. State: `We can make the case with a cover letter`, then explain the bridge and the remaining gap.
- `not-credible`: a cover letter cannot bridge the blocker without hiding or inventing evidence. Use this for failed or unresolved hard gates, required credentials or clearance, materially different professions, or missing central operating-center experience.
- The cover-letter bridge does not change the fit class. `stretch` still needs approval and `not-fit` still stops. Once an adjacent package or approved stretch is cleared to build, a recommended cover letter is generated automatically.
- For an adjacent or approved stretch role with a credible bridge, put the same evidence-backed bridge thesis in the resume summary. The cover letter strengthens the human case; it cannot be the only destination for a supported core requirement.
- Record requirement source and confidence. Ambiguous or contradictory JD language cannot independently create `not-fit` or fail a hard gate until the employer or application form confirms it.
- The fit gate is not a sales pitch. It should protect the human from wasted tailoring when the JD requires a different profession, certification, location, security clearance, domain ownership, or technical depth that the source materials do not support.

## Matched Portfolio Route

Use the self-contained employer-specific showcase as the default route pattern.

- Create a route at `/<company-or-role-slug>/` using `index.html` as the base. Do not copy a different role route as the starting point; that leaks old role framing and stale artifact links.
- Keep the public homepage `/`, public `resume.html`, and `assets/Wally-Mostafa-Resume.pdf` untouched unless the user explicitly asks to change the global site.
- Use `scoped-projects` with `route.presentation: "showcase"` and `route.heroIntent: "resume-support"` by default. The route, selected case studies, and all return paths must stay inside the employer-specific package.
- Use `canonical-projects` or `route.presentation: "full"` only as an explicit opt-out when the canonical public portfolio or fuller homepage narrative is intentionally part of the recruiter path.
- Tailor only the route areas that support the JD-specific proof path:
  - Hidden metadata: page title, meta description, and Open Graph URL/title/description.
  - Hero space: eyebrow, tagline chips, and a first-person intro. In showcase mode, frame the page as a closer look at recent work that may be relevant to the role; reserve direct fit arguments and stacked proof for full mode.
  - Featured project cards: selected projects, order, and role-relevant card copy when needed.
  - Link plumbing: nav `Resume`, hero `Resume`, and contact `Download Resume` targets.
  - Relative paths required because the page lives in a subfolder.
- Do not tailor the rest of the portfolio route. Keep capabilities, trust strip, awards, experience arc, visual system, and non-project sections unchanged unless the human explicitly asks for a broader portfolio edit. The JD-specific closing contact prompt and footer sign-off remain the default exception.
- In `scoped-projects` mode, update every project card, back link, breadcrumb, previous link, and next-project link so the recruiter stays inside the selected role-specific project path.
- In `scoped-projects` mode, the selected-work cards are the source of truth:
  - The visible project number on the route card must match the visible project number on the scoped project page.
  - Previous/next project links must follow that JD route's selected-project order, not the public portfolio order.
  - The Wally/logo link and all-work/back links must return to the JD-specific portfolio route.
- In `canonical-projects` mode, do not add query-param shims such as `?from=<role>` to public project links. Keep the public project pages canonical and accept their public navigation.
- Keep the rest of the portfolio stable by default: only hero and featured project selection/order should visibly change for each JD.
- On the role route, every `Resume` and `Download Resume` control must point directly to the tailored resume PDF under `output/pdf/`.
- In the tailored PDF, the contact line should still say `Portfolio`, and that link should point to the matching role route.
- Do not link the tailored PDF to public `resume.html`; that creates a second-resume comparison for recruiters.
- Do not swap the tailored PDF's `Portfolio` link back to the public homepage as a workaround for an unpublished role route. Keep the role-route link, publish the route if possible, and clearly report any publish/auth blocker.
- Stage/commit/push only the scoped role route and its matching tailored resume artifacts. Leave unrelated dirty files alone.
- Never call a tailored PDF "ready" while its role route is untracked, uncommitted, unpushed, or live-404ing. Publish and verify the scoped route/artifacts before final delivery. Only stop with a local-only status when the user explicitly requests it or an external blocker prevents publishing after a real attempt.

## Visual Style

- Letter-size resume, two readable pages.
- White page, no card frame, no portfolio-site nav.
- Centered uppercase name: `WALLY MOSTAFA`.
- Contact line: `wmostafa12@gmail.com · 347-420-3558 · Raleigh, NC · LinkedIn · Portfolio`.
- Section labels are uppercase, compact, letter-spaced, and separated by thin horizontal rules.
- Body copy is compact, around 9.5-10pt, with strong scan hierarchy.
- Job title on the left; company/location/dates on the right in italic where space allows.
- Skills and awards are line items, not decorative cards.
- Hard rule: if text is linked, the linked text must be visibly underlined in the PDF/print output. This especially applies to linked award names.

## Source Of Truth

- Base resume content: `scripts/resume-foundation.json`, imported from the attached `Wally-Mostafa-Resume.pdf`.
- Versioned resume-base decisions and evidence pools: `scripts/resume-base-profiles.json`.
- Resume shell and PDF styling reference: `resume.html` and `assets/Wally-Mostafa-Resume.pdf`.
- Keep claims grounded in existing portfolio/resume evidence.
- Do not inflate frontend/tooling claims beyond what the resume and project pages support.
- For tailored PDFs with matching portfolio routes, the `Portfolio` link should point to that route. The route's Resume/Download Resume links must use the same tailored resume PDF/source, not the global resume.
- Store the complete v2 intent in `scripts/packages/<slug>.json`; keep `scripts/tailored-packages.json` limited to artifact inventory, QA state, and live-verification metadata.
- Treat package configs as public. `privacy.publicSafe` must be true, raw JD text must come only from the public posting, and hard-gate evidence must be sanitized. Private application answers, recruiter details, compensation boundaries, and eligibility details belong only in the ignored ledger.

## Tailoring Logic

- Read the JD for title, seniority, domain, and repeated requirements.
- Do not skip the fit gate. First decide whether the role is `strong`, `adjacent`, `stretch`, or `not-fit`, then choose the resume base from the role's primary operating center. Make both calls from evidence in the resume profiles, the full public project pool (`project-01.html` through `project-07.html`), and existing artifacts.
- Select the role route's projects as an argument: put the strongest matching case study first, keep the set to 3 by default, and include a fourth only when it adds distinct proof the first three do not cover.
- If the fit is `not-fit`, do not generate artifacts. Return the blocker and the honest make-it-fit path instead.
- For stretch roles, keep the artifact honest: emphasize supported adjacency and explicitly avoid unsupported claims such as certifications, hands-on domain operations, platform ownership, or direct tool/framework experience that the source materials do not prove.
- After the human accepts the risk, do not keep arguing the fit. Continue the workflow, but interrupt if the requested positioning would require fabrication, fake confidence, or disproportionate work for a low-fit role.
- Write the summary around the selected lead profile and a compatible positioning lane. Open with the target identity and make the honest bridge clear without defensive language. There is no hard word-count limit; page-one placement, readable type, and the two-page contract determine whether it is too long.
- Select four to six foundation skills that best support the target identity. Do not invent or rewrite skill-bank claims.
- Edit selected bullets to surface supported JD terminology and ATS matches while preserving each bullet's underlying experience, proof, and scope.
- Keep every selected source bullet in its original role. Reorder only within that role when it improves the argument. Pure modes preserve the complete selected profile; hybrid mode selects against the JD from both profiles while retaining the complete One Block Away section. Never duplicate or move evidence.
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

- If the user provides a JD and asks to tailor the resume, set `action: tailor-to-jd` and create and publish the matched resume + role route workflow unless they explicitly ask for resume text only or local-only files. Use an existing healthcare or AI networking resume without changes only when no employer JD is being evaluated.
- Build through the v2 package command so the render, ATS preflight, link checks, and desktop/mobile route QA run consistently.
- Verify the role route locally and, after pushing, run the live verifier for config/route/project/PDF `200` responses and checksum parity.
- Keep the answer tight: mention the artifact path and any important caveat only.
