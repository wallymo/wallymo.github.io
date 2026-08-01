# Tailored Application Workflow v2

Workflow v2 is forward-only. Existing manifest entries without `workflowVersion: 2` remain legacy records until intentionally reused.

Packages built before the cover-letter bridge rule remain valid records without retroactive edits. They have no `contractRevision` and are treated as the implicit first contract revision. Revision 2 added the cover-letter bridge. Revision 3 added the humanized-copy gate. Revision 4 made the human-supplied resume the content floor.

Revision 5 keeps that floor while making the package more flexible. Each package selects a positioning lane, writes a 45–65-word summary, chooses four to six skills from the evidence-backed foundation bank, and retains all 23 experience bullets exactly once. Bullet wording and order may change within a job, but bullets cannot be deleted, merged, duplicated, or moved to another employer. Supported additions still use `addition:<slug>` IDs.

Revisions 5 and 6 may optionally define `resume.experienceSections` to lead with the most relevant role family and place the remaining roles in one or two clearly named sections. Every foundation role must still appear exactly once, and every role keeps its original employer, dates, and mapped bullets. Omitting the field preserves the standard single chronological `Experience` section. Packages that need to retain supported additions within the two-page limit may set `resume.layoutDensity` to `compact`; the builder keeps the canonical typefaces and hierarchy while tightening print margins, spacing, and body copy to a readable 9pt floor.

An experience section may set `pageBreakBefore: true` when a deliberate page transition is better than leaving its heading orphaned. A package may also provide one to five `resume.awards` entries to select and reorder supported recognition for the target role. Both options affect only the generated PDF; the public resume shell stays unchanged.

The default `resume.compositionMode` is `foundation-complete`. A resume may use `curated-user-authorized` only after the user explicitly authorizes a substantive exception for that package. The config must record who authorized it, the date, scope, and reason. Curated mode may remove or rewrite foundation bullets to change emphasis, but every job must retain at least one mapped foundation bullet, source IDs must stay under their original employer, and additions still require unique `addition:<slug>` IDs. This exception is package-specific and does not relax the default contract for any other resume.

When the foundation's skill text changes after a package is built, the inventory check reports the built package with a "skills text predates the current resume foundation" warning instead of a failure, matching how canonical-resume drift is handled. Building or rebuilding still requires the current foundation text.

In curated mode only, a foundation role may be split into two to eight per-employer sub-entries by replacing its `resume.roles.<roleId>` string array with objects of `{ title, employer, location?, dateRange, bullets }`. The builder renders each sub-entry as its own job block in render order, `resume.sourceBulletIds.<roleId>` stays a single flat array mapping the concatenated bullets, and the role's at-least-one-retained-foundation-bullet rule applies to that flattened list. Sub-entry titles and bullets go through the humanizer and claim gates; employer, location, and date strings are operational metadata. ATS checks anchor each sub-entry's title, employer, and date range in place of the foundation role header.

Revision 5 also separates package QA from submission readiness. A built package can pass locally, but it is not submission-ready until the live form, uploaded file, parsed fields, screening answers, identity consistency, duplicates, and platform notices have been checked.

Revision 6 removes the cover-letter handoff gap. When the fit gate marks the bridge `recommended`, the config must include the evidence-backed letter and the builder creates its PDF and Markdown with the resume package. Every new or intentionally rebuilt letter uses the locked `real-chemistry-21grams-v1` template in `scripts/lib/cover-letter-template.mjs`, based on the approved Real Chemistry/21GRAMS letter. The role changes the words, not the visual system: Syne display type, Instrument Sans body type, a centered identity block, thin black rule, and fixed Letter margins remain constant. The renderer waits for the bundled fonts before printing, and QA rejects visual-template drift. The workflow also inspects the one-page PDF, removes the temporary HTML, records artifact checksums, and includes both files in live verification. A `not-needed` package skips the letter unless the human explicitly asks for one. A `not-credible` package cannot create one. Revision 6 is required for every new or intentionally rebuilt package; Revisions 1–5 remain valid historical records.

Before building a real package, commit the complete scoped workflow implementation that will produce it: builder, checks, schemas, templates, tests, fonts, and contract documentation. Keep that infrastructure commit separate from package routes, configs, PDFs, and manifest entries. A package generated by uncommitted workflow code is not publishable. When local `main` has diverged from `origin/main`, reconcile in a clean worktree rather than forcing history or mixing unrelated dirty files into the workflow commit.

## Build a package

1. Copy `scripts/examples/package-v2.json` to `scripts/packages/<slug>.json`.
2. Replace every placeholder with grounded JD, resume, and portfolio evidence. Choose a foundation positioning lane, write a 45–65-word summary that includes the target identity and bridge thesis, and select four to six matching skill IDs from `scripts/resume-foundation.json`. Edit the text in `resume.roles` for truthful JD alignment while retaining every foundation ID exactly once under its original employer. Reorder bullets only within that employer. Add supported bullets only with a unique `addition:<slug>` ID at the same array position.

   Record each requirement's source, confidence, proof IDs, destinations, and match mode. A supported core requirement must appear in the resume; a cover letter cannot be its only destination. Ambiguous JD language can be recorded, but it cannot create a hard failure until the employer or application form confirms it.

   Record the separate cover-letter bridge verdict in `fitGate.coverLetterBridge`: use `not-needed` for a direct strong fit, `recommended` only when every hard gate passes and an adjacent/stretch application has a credible transferable-skills story, or `not-credible` when persuasion would require unsupported evidence. Put a credible bridge thesis in the resume summary as well as the route hero. When the status is `recommended`, add the complete `coverLetter` object before building. The workflow does not pause for a second request.
3. Run the complete `humanizer` skill over the fit explanation, resume copy, route copy, cover letter, and any other authored application copy. The default is a surface edit: preserve content, structure, claims, proof, order, and ending. Use a broader rewrite only when the human explicitly requests it.
4. Complete the skill's final anti-AI audit, then approve the exact copy:

```bash
node scripts/humanizer-check.mjs --config scripts/packages/<slug>.json --approve --semantic-pass-complete
```

The final flag explicitly attests that the full semantic skill pass is complete; the static scan cannot approve copy by itself. Use `--rewrite-requested` only after an explicit rewrite request. The approval is tied to the exact copy; even leading or trailing whitespace changes make it stale.

`reviewedAt` is an audit timestamp and does not expire by age. Review currentness comes from the required humanizer version and exact-copy checksum; a changed copy or version requires another pass.

The JSON Schema covers the portable package shape. Runtime validation is authoritative for semantic timestamps, checksum parity, filesystem safety, and cross-field workflow rules.

The review boundary is deliberate:

- Reviewed authored copy: fit classification explanations and evidence, requirement evidence, fit-gate rationale, resume copy, route hero copy, contact copy, and the full cover letter when present.
- Excluded source material: the raw JD, requirement text quoted or distilled from it, and ATS terms retained from the posting.
- Excluded operational metadata: company, role title, capture source/date, artifact paths, QA state, privacy notes, and claim-blocking terms.

5. Complete the required privacy review. Configs are committed to a public repository: `job.rawJd` may contain only public posting text, and hard-gate evidence must be sanitized. Never store recruiter contact details, application answers, personal compensation boundaries, or private eligibility details in a package config.
6. Run:

```bash
node scripts/build-tailored-package.mjs --config scripts/packages/<slug>.json
```

The builder enforces the positioning, requirement-evidence, cover-letter, humanizer, and resume-foundation contracts before creating files. It blocks a missing recommended letter, missing or moved source bullets, unsupported skill selections, weak or defensive summaries, unresolved explicit hard gates, or `not-fit`; requires `--allow-stretch` for an approved stretch; generates the role route; renders the resume and cover-letter PDFs; runs ATS and letter checks; captures desktop/mobile QA screenshots; removes passing screenshots and temporary HTML; and writes a `local-only` v2 manifest entry. Failed route QA keeps its screenshots temporarily under ignored `tmp/qa/<slug>/` for diagnosis. Screenshot paths are never persisted in package QA records.

The PDF preflight confirms that the tailored summary and selected skills extract on page one; every employer, full title, date range, education anchor, and mapped bullet extracts in order; the file is two pages or less and under 2.5 MB; contact data and annotations are correct; and no unsupported claim appears. Exact phrase coverage remains advisory and records exact, recognized-equivalent, or contextual matches.

## Publish and verify

Stage only the current package's route, scoped project pages when present, config, resume PDF, conditional cover-letter PDF and Markdown, and manifest entry. After committing and pushing:

```bash
node scripts/verify-tailored-route.mjs <slug>
```

The verifier requires clean scoped files, checks live route, project, resume PDF, config, and conditional cover-letter responses, compares the local and live checksums, and then updates the manifest to `live-verified`.

The verification update intentionally dirties `scripts/tailored-packages.json`. Commit and push that verification-only manifest change as the final publication record.

## Complete the submission gate

Application data is private and ignored by Git:

```bash
node scripts/application-ledger.mjs ready \
  --package <slug> \
  --application-url "https://employer.example/jobs/REQ-123" \
  --job-id "REQ-123" \
  --ats greenhouse \
  --prepared-at "2026-07-16T14:20:00-04:00" \
  --screening-questions reviewed \
  --form-hard-gates pass \
  --parsed-fields pass \
  --identity-parity pass \
  --identity-sha256 "<stable private identity hash>" \
  --narrative-answers not-applicable \
  --attachment "Wally-Mostafa-Company-Role-Resume.pdf" \
  --uploaded-sha256 "<verified PDF checksum>" \
  --ai-notice seen \
  --notice-url "https://employer.example/automated-processing" \
  --opt-out-path available \
  --opt-out-url "https://employer.example/automated-processing/opt-out" \
  --accommodation-path available \
  --accommodation-url "https://employer.example/accommodations" \
  --assessment structured-video \
  --platform-integrity clear \
  --cover-letter used
```

`ready` writes a private readiness snapshot, not an application. If the portal is unavailable before login or upload, record unavailable checks; the snapshot remains blocked until those checks can be completed at the first pre-submission point. Narrative answers marked `passed` also require `--authored-copy-sha256` and `--semantic-pass-complete yes`. A different active role at the same company requires `--related-role-acknowledged yes`. An exact company/requisition duplicate always stops, including a matching readiness snapshot reserved by another package.

After manual submission and visible confirmation:

```bash
node scripts/application-ledger.mjs record \
  --package <slug> \
  --job-id "REQ-123" \
  --confirmation "<visible confirmation reference>" \
  --applied-at "2026-07-16T14:30:00-04:00"
```

The record command requires a current, matching readiness snapshot and fresh live package checksums. It recomputes the readiness predicate and duplicate check while writing. Revisions 5 and 6 retain their contract revision so they cannot be mistaken for legacy data. Revision 6 readiness remains blocked when a recommended cover letter is not included. Record later stages, assessments, and outreach separately:

```bash
node scripts/application-ledger.mjs event --id <application-id> --stage recruiter-screen --at <ISO> --source email
node scripts/application-ledger.mjs assessment --id <application-id> --status invited --assessment-type structured-video --at <ISO> --source email
node scripts/application-ledger.mjs outreach --id <application-id> --status draft --channel LinkedIn --at <ISO>
node scripts/application-ledger.mjs report
```

A generated package is not an application. A readiness snapshot is not a submission. A draft is not a sent message. Assessment events do not change the interview stage. Only visible confirmation authorizes an `applied` record.

Use `assessmentPrepBank` competency IDs and foundation proof IDs to prepare concise STAR or CAR outlines for disclosed assessments. A structured-video start requires at least one competency, two distinct proof IDs, a hash of the prepared copy, and a completed humanizer pass. Humanize written preparation without changing facts. Do not provide real-time help when the employer prohibits it. When an automated-processing notice, opt-out path, or accommodation path appears, show it to the human without choosing for them.

## Validation commands

```bash
node scripts/check-tailored-packages.mjs --all
node --test scripts/tests/*.test.mjs
```

Use `--include-legacy` only for a non-blocking diagnostic summary of historical packages.
