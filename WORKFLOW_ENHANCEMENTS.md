# Workflow Enhancements + ATS Best Practices

Historical audit of the JD-tailored resume/portfolio pipeline, assessed 2026-07-15. Workflow v2 was implemented on 2026-07-16, hardened as revision 5 on 2026-07-27, and advanced to revision 6 on 2026-07-29 for new and intentionally rebuilt packages. The existing package inventory remains legacy unless a package is reused.

Implemented v2 commands:

- `node scripts/build-tailored-package.mjs --config scripts/packages/<slug>.json`
- `node scripts/ats-check.mjs --config scripts/packages/<slug>.json --pdf output/pdf/<resume>.pdf`
- `node scripts/route-ui-check.mjs --config scripts/packages/<slug>.json`
- `node scripts/verify-tailored-route.mjs <slug>`
- `node scripts/application-ledger.mjs ready|record|event|assessment|outreach|report`

The current source of truth is `ATS_TO_HUMAN_PLAYBOOK.md`; the findings below remain useful as the evidence and rationale behind the implemented workflow.

Recorded decisions (2026-07-15):

- ATS content fixes apply to canonical `resume.html` when implemented, so every future tailored resume inherits them. Do not build per-package transforms.
- Keep label-style links (`LinkedIn`, `Portfolio`) in the PDF contact line. Verify the embedded link annotations instead of switching to visible URLs.
- Keyword-coverage checking is warn/report only. Never hard-fail on coverage; thresholds invite keyword stuffing, which conflicts with the no-overclaiming rules in `AGENTS.md` and `RESUME_CHAT_RULES.md`.

## Part 1 — Workflow Enhancements (Prioritized)

### 1. Persist package configs + JD text

The generator requires a rich config (fit gate rationale, hero copy, contact copy) but discards it after running; only a skeleton lands in the manifest. The JD itself is never saved. Evidence: 42/69 packages have `fitClass: "unclassified"`; only 18 have `notes`.

- Store the full generator config per slug at `scripts/packages/<slug>.json`, including the raw JD text.
- Have `generate-tailored-package.mjs` read from that location instead of a throwaway `--config` path.
- This unlocks `regenerate --all` after base-template changes. Drift is real: the Boulevard tailored HTML (generated Jul 1) is missing the print-CSS refinements added to `resume.html:345-364` on Jul 3, so per-role PDFs pageinate differently depending on when they were generated.

### 2. Automate PDF render + PDF verification

Workflow v1 had no render script. Workflow v2 now renders deterministically and runs the structural ATS preflight before writing a `qa-passed` manifest entry.

- Add `scripts/render-resume-pdf.mjs` (spec in Part 3). Headless chromium and playwright 1.57 are already installed on this machine.
- Add `scripts/ats-check.mjs` (spec in Part 3) so the manual QA list becomes automated assertions.

### 3. Bulk publish-status sweep

Current manifest statuses: 35 `tracked-unverified`, 25 `live-verified`, 5 `uncommitted`, 4 `local-only`. Half the inventory is in limbo, and the rules treat unverified routes as publish-blocking.

- Add an `--all` mode that hits every live route/PDF URL and promotes or demotes `publishStatus` in the manifest. Reuse `assertLive200` (`scripts/verify-tailored-route.mjs:342`).

### 4. Structured resume content

Workflow v1 only rewrote title/meta/Portfolio link. Workflow v2 revision 5 stores the exact 45–65-word summary, four to six selected foundation skills, positioning, and all 23 mapped role bullets in each package config and applies them to stable identifiers in `resume.html`.

- Move summary variants, capability line items, and bullet variants into a JSON bank keyed to the proof points already listed in `RESUME_CHAT_RULES.md:123-131`.
- Package configs select variants; freehand editing remains for the last 10%. Tailoring becomes faster, consistent across packages, and diff-able.

### 5. ATS keyword-coverage check

Covered by the `ats-check.mjs` spec in Part 3 and the keyword-mirroring rule in Part 2.

### 6. Outcome feedback loop

69 packages shipped, zero records of applied/screen/interview/offer. There is no way to learn whether `strong` vs `adjacent` positioning or 3 vs 4 projects converts better.

- Implemented: keep the artifact manifest public and store readiness snapshots, confirmed applications, assessments, outreach, and outcomes in ignored `.private/applications.json` through `scripts/application-ledger.mjs`.

### 7. Smaller items

- Derive `resumeHtmlPath`/`resumePdfPath` from the slug inside the generator instead of hand-specifying them (`resumeHtmlPath` exists on only 49/69 packages, and means different things depending on whether the temporary HTML was deleted).
- Cover letters are in the rules (`RESUME_CHAT_RULES.md:17`) but have no generator or verifier support.
- Root debris cleanup + `.gitignore` pass: `manuscript-*.md`, `humanizer-review-*.md`, stray PNGs, `.playwright-cli/`, `tmp/`.

## Part 2 — ATS Best Practices Audit

### Already ATS-safe (keep as-is)

- Single-column layout, no tables (`resume.html:156-159`); flexbox is used only for inline rows like the job header (`:262-268`), never to split body content into side-by-side columns.
- Contact info is plain selectable text in the first lines of the body (`:415-425`), not in a header/footer.
- Reverse-chronological experience with `Mon YYYY – Mon YYYY` dates.
- No text-as-image; the only SVGs are screen-only action icons hidden by print CSS (`:146-150`).
- Bullets via CSS `list-style: disc` — standard glyphs, not custom symbols.
- File naming `Wally-Mostafa-<Role>-Resume.pdf` (name + role + "Resume" is exactly what a recruiter inbox wants).
- PDFs are text-selectable; fonts embed at render.

### Gaps → recommended fixes

Apply to canonical `resume.html` when implemented. Items marked **[visible]** change recruiter-facing content and also appear on the public resume page.

- **[visible]** Rename section `Capabilities` → `Skills` (`resume.html:436`). ATS parsers segment resumes by standard heading names (Summary / Skills / Experience / Education); custom headings can drop the whole section from the parsed profile. Requires the same rename in the hierarchy list at `RESUME_CHAT_RULES.md:33` and its Tailoring Logic references.
- **[visible]** `Raleigh Metro, NC` → `Raleigh, NC` (`:421`). Parsers extract a `City, ST` pair; "Raleigh Metro" is not a city and can fail location matching for location-filtered searches.
- **[visible]** `2→30` → `2 to 30` (`:452`). The U+2192 arrow is a custom symbol; it can garble text extraction and never matches keyword search.
- Phone `347.420.3558` → `347-420-3558` (optional, low risk — dot-separated usually parses, dash-separated always does).
- Email link underline in print: award links and `.print-link` (LinkedIn/Portfolio) are underlined in the PDF (`:371-381`) but the email link lacks the `print-link` class — conflicting with `RESUME_CHAT_RULES.md:94`, which requires all linked text visibly underlined. One-class fix.
- Add an `@page` rule (Letter, 0.5in margins) to the print CSS (`:330-383` currently sets neither). Today page geometry depends on whoever renders the PDF; pair with the render script's `preferCSSPageSize` so output is deterministic.
- Keyword mirroring rule for Tailoring Logic: use the JD's exact phrasing, and include both acronym and spelled-out forms where real experience supports them — e.g. `Medical Legal Review (MLR)`, `retrieval-augmented generation (RAG)`. Keyword-search-based ATS (notably Workday's recruiter search) match literally; "container orchestration" does not surface for a "Kubernetes" search.
- No change needed: Google Fonts Syne/Instrument Sans embed into the PDF and extract cleanly — the "system fonts only" advice targets DOCX fallback rendering, not embedded-font PDFs. En/em dashes are acceptable; extraction is verified by ats-check rather than banning the characters.

## Part 3 — Implemented Automation Specs

Zero npm deps for both scripts — the repo has no `package.json` and should stay that way. Shell out to installed binaries (`pdftotext`, `pdfinfo`, `chromium`, `python3` + pypdf 6.10.2, all verified present at `/opt/homebrew/bin` or system python).

### `scripts/render-resume-pdf.mjs <resume-html> <resume-pdf>`

- Headless chromium `--headless=new --print-to-pdf`.
- Letter size, print-background on, no header/footer, prefer CSS page size (picks up the `@page` rule from Part 2).
- Replaces the ad-hoc manual render step named at `generate-tailored-package.mjs:431`.

### `scripts/ats-check.mjs <resume-pdf> [--jd <file>]`

Structural assertions (non-zero exit on failure):

- Text extraction via `pdftotext` is non-empty and free of U+FFFD replacement characters.
- Page count ≤ 2 (via `pdfinfo`).
- Name, email, and phone appear in the first ~6 extracted lines.
- Required headings present in extracted text: `SUMMARY`, `SKILLS`, `EXPERIENCE`, `AWARDS`, `EDUCATION` (uppercase — the source is title-case but `text-transform: uppercase` renders/extracts uppercase).
- No suspicious characters: U+2192 arrows, ligature artifacts.
- Link annotations (read via `python3` + pypdf, since `pdftotext` ignores annotations): the `Portfolio` annotation points to the matching role route, `LinkedIn` to the profile URL.

Advisory output (never affects exit code):

- With `--jd <file>`: normalized keyword/phrase report — which JD terms appear in the extracted resume text, which are missing. Warn-only by decision above.

Wire-in: call from `scripts/verify-tailored-route.mjs`, or add as a numbered step in the `RESUME_CHAT_RULES.md` Quick Workflow so step 12's manual QA becomes scripted.

### JD persistence for repeatable checks

- Store JDs at `scripts/jd/<slug>.txt` (or inside `scripts/packages/<slug>.json` per Part 1) and add an optional `jdPath` manifest field.
- `check-tailored-packages.mjs:93` shape validation must tolerate the new optional field.

## Sources

- [Jobscan — Anatomy of an ATS-Friendly Resume Format (2026 checklist)](https://www.jobscan.co/blog/20-ats-friendly-resume-templates/) — single column; standard section headings; web-safe fonts at 10–12pt body; text-based PDF or DOCX; no contact info in headers/footers; standard bullets, no arrows or custom symbols; 0.5–1in margins. Content verified by direct fetch 2026-07-15.
- Platform-behavior overviews (secondary sources — practitioner blogs, not vendor documentation; treat as directional): [How Workday, Greenhouse & Taleo read your resume](https://www.shashiworks.com/ats-workday-greenhouse-taleo.html), [ApplyMate on Workday/Taleo/Greenhouse](https://apply-mate.com/blog/workday-taleo-greenhouse-ats), [Hireflow parsing comparison](https://www.hireflow.net/blog/workday-vs-greenhouse-vs-lever-which-parses-best). Consistent claims across them: Workday recruiter search is literal keyword matching; Greenhouse routes every application to a human with structured scorecards rather than auto-rejecting; Lever parses PDFs reliably.
- Deliberately excluded: "75% of resumes are rejected by ATS"-style statistics. No primary source exists for these figures; they are vendor folklore and do not meet this repo's data-sourcing rules.
