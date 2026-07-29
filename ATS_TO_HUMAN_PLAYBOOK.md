# ATS-to-Human Job Application Playbook

**Status:** Workflow v2 revision 6 implemented; legacy packages remain historical
**Assessed:** 2026-07-15; revision 6 implemented 2026-07-29
**Scope:** Wally Mostafa's JD-to-resume-to-portfolio-to-application workflow
**Companion audit:** `WORKFLOW_ENHANCEMENTS.md`

This document expands the technical backlog in `WORKFLOW_ENHANCEMENTS.md` into an end-to-end application system. The original document should remain as the implementation audit. This playbook becomes the strategic source of truth for deciding which roles to pursue, building a truthful ATS-readable package, reaching a person, and learning from outcomes.

Workflow v2 revision 6 applies to new and intentionally rebuilt packages. Build with `node scripts/build-tailored-package.mjs --config scripts/packages/<slug>.json`, publish the scoped route, config, manifest, resume PDF, and any required cover-letter files, then run `node scripts/verify-tailored-route.mjs <slug>`. Complete the private submission gate with `node scripts/application-ledger.mjs ready ...` at the first accessible pre-submission point. Historical package and ledger records remain valid until intentionally reused.

The goal is not to “trick” an ATS. The goal is to make a qualified application:

1. survive hard eligibility rules;
2. parse into the right candidate fields;
3. surface against the recruiter’s actual requirements and searches;
4. make the human case obvious in a fast review;
5. reach the right person through a second, respectful path; and
6. generate outcome data that improves the next application.

## Executive decision

The current workflow is already strong at producing polished, role-specific artifacts. Its primary weakness is that it treats artifact generation as the finish line. The finish line is a human conversation.

The upgraded system should optimize five connected layers:

| Layer | Question | Success condition |
|---|---|---|
| Eligibility | Can this application pass explicit screening rules? | No unsupported hard requirement or disqualifying form answer |
| Discoverability | Can the systems read and retrieve the evidence? | Clean parse, correct fields, truthful requirement language |
| Human proof | Can a recruiter understand the fit quickly? | Role, scope, proof, and gaps are obvious in 15 seconds |
| Human routing | Is there a credible path beyond the inbound queue? | Referral, recruiter, or hiring-manager touch tied to the submitted application |
| Learning | Do we know what converted? | Every submitted application has source, stage, dates, and outcome |

“ATS readiness” is therefore not one percentage. It is a set of separate gates. A resume can parse perfectly and still be a weak fit. A strong fit can still disappear if its evidence is absent from searchable text. A referral can create attention but cannot repair a false or structurally mismatched application.

## What the systems actually do

There is no single ATS behavior and no universal candidate score.

- Greenhouse can parse a resume into candidate fields, perform exact full-text keyword filtering, use Boolean search, and auto-reject based on configured application answers.
- Lever parses resume content into profile fields and gives recruiters a fast resume-review workflow. Its own documentation distinguishes parsing and workflow automation from a mythical all-powerful robot gatekeeper.
- Ashby can auto-reject from application-form conditions and can evaluate and sort resumes against employer-defined AI criteria.
- Workday’s HiredScore product can grade and prioritize candidates against role requirements.
- LinkedIn Recruiter can filter and rank candidates using explicit skills, skills found across profile text, resume skills, titles, location, and contextual or inferred skills.

The practical implication is simple: optimize for explicit eligibility, retrievable evidence, contextual proof, and recruiter comprehension. Do not optimize for a third-party “match score” as if it were the employer’s system.

There is no useful AI-detector bypass. Do not add an AI-writing score, hidden text, keyword stuffing, title inflation, duplicate accounts, identity rotation, or automated submissions. The humanizer is a recruiter-readability check. It does not promise to defeat an employer's opaque model.

## Current-system audit

Snapshot from the repository on 2026-07-15:

| Area | Current state | Consequence |
|---|---|---|
| Tailored package inventory | 72 packages | High production volume exists |
| Fit classification | 42 unclassified, 24 adjacent, 6 strong | Most historical packages cannot be compared by fit quality |
| Evidence mode | Missing on all 72 packages | The system does not record whether the resume, portfolio, or technical proof drove the decision |
| Outcome data | No application status or dates on any package | Screen, interview, and offer conversion cannot be measured |
| Package notes | Present on 23 packages | Important fit and claim constraints are inconsistently retained |
| JD persistence | Raw JDs are not stored in the manifest/config system | Tailoring and keyword checks cannot be reproduced reliably |
| Artifact state | 71 PDFs exist; one referenced PDF is missing; HTML paths are inconsistent by design and history | Inventory shape does not cleanly express recruiter-facing versus temporary artifacts |
| Publishing state | Mix of live-verified, tracked-unverified, uncommitted, and local-only | “Ready to send” is not uniformly trustworthy |
| Full verifier run | Currently reports multiple scoped-route navigation problems plus artifact-shape failures | Package QA is not green at the inventory level |

The central diagnosis: the repository has an artifact ledger, not an application pipeline. Those should be related, but they are not the same record.

## Non-negotiable operating principles

### 1. Fit before keywords

The strongest ATS tactic is applying where the primary evidence directly supports the operating center of the role. Keyword work improves retrieval; it does not manufacture fit.

Every job starts with the evidence mode already defined in `AGENTS.md`:

- `portfolio-primary`
- `balanced`
- `resume-primary`
- `credential-or-technical-primary`

Then assign one fit class:

- `strong`: proceed immediately;
- `adjacent`: proceed with narrow, honest positioning;
- `stretch`: stop until explicitly approved;
- `not-fit`: stop and identify a better target or missing proof.

Then make a separate cover-letter bridge call:

- `not-needed`: the direct `strong` evidence already makes the case;
- `recommended`: all hard gates pass and the broader skill set supports a concrete transfer story for an `adjacent` or `stretch` role;
- `not-credible`: persuasion would require hiding or inventing a hard qualification, structural operating-center gap, credential, clearance, or materially different profession.

When the bridge is credible, say plainly: `We can make the case with a cover letter.` Name the transferable proof and the gap the letter must address. For an adjacent package, create the humanized cover letter with the resume and route. For a stretch, wait for stretch approval and then create the letter in that same build. The letter does not change the fit class or authorize an unapproved stretch.

### 2. Hard gates are different from evidence gaps

A missing keyword is not the same as missing work authorization, a required license, clearance, location commitment, or central professional experience. The first may be a writing issue. The second may be an honest stop.

Never answer an application question strategically when the truthful answer is disqualifying. Record the gate, stop the package, and redirect the effort.

### 3. Exact language plus contextual proof

When the experience is real, use the JD’s recognizable wording and show it in context.

Weak:

> AI, strategy, leadership, RAG, healthcare

Strong:

> Designed retrieval-augmented generation (RAG) and human-review workflows for regulated pharma content, translating MLR criteria into auditable product behavior.

The first is a keyword pile. The second is searchable and gives a recruiter something to believe.

### 4. One source of truth per fact

Dates, titles, employers, education, location, and claims must agree across:

- resume;
- application form;
- LinkedIn;
- tailored portfolio route; and
- outreach note.

Differences in emphasis are acceptable. Contradictions are not.

### 5. The resume must work for a parser and a hurried person

Structural simplicity is not a concession. It is part of the communication design. The resume should have conventional headings, selectable text, chronological experience, recognizable dates, and proof-led bullets that remain clear when styling is removed.

### 6. Human routing is part of the application

Submitting the form creates an application. A targeted message creates a second chance for the right person to notice it. Outreach must add a concrete reason to look, not merely announce that an application was submitted.

### 7. Never optimize from untracked anecdotes

Do not infer that a resume version “worked” because one person replied, or failed because one company rejected it. Track cohorts by role lane, fit class, evidence mode, source, ATS, and outreach status.

## The end-to-end workflow

### Stage 0 — Define the target lanes

Maintain a small number of active role lanes. A lane is a coherent hiring story, not a list of loosely related titles.

Recommended lane structure for the existing evidence:

| Lane | Likely evidence mode | Core proof |
|---|---|---|
| AI product strategy and implementation | Balanced | Regulated AI workflows, POCs, product framing, adoption, investor outcome |
| Product/design leadership | Portfolio-primary or balanced | Enterprise systems, team scale, design systems, data visualization, awards |
| AI-enabled client strategy and implementation | Resume-primary or balanced | Pharma/client leadership, discovery, workflow translation, delivery |
| Product management and innovation | Balanced | Opportunity framing, prototypes, roadmap logic, cross-functional execution |

Add a new lane only when the resume’s primary evidence supports its operating center. Do not let one interesting JD create an entirely new candidate identity.

**Output:** `targetLane` on every future application record.

### Stage 1 — Capture the job before analyzing it

Save the complete source while it is still available.

Required intake fields:

- company;
- exact role title;
- requisition or job ID;
- canonical job URL;
- source channel;
- date posted if visible;
- date captured;
- full raw JD text;
- compensation range if present;
- location and workplace type;
- application deadline if present;
- detected ATS/vendor from the application URL;

Do not rely on a live URL as the only copy. Job pages change or disappear, and reproducible tailoring requires the exact source used at decision time.

**Repository target:** `scripts/packages/<slug>.json` should store the immutable JD snapshot and package strategy.

Named recruiters, hiring managers, referrers, personal eligibility answers, and compensation boundaries are private application data. Store those only in `.private/applications.json`, never in the public package config.

### Stage 2 — Run the hard-screen gate

Evaluate these before doing copy or design work:

- work authorization and sponsorship;
- required location, relocation, or onsite frequency;
- required clearance;
- required license or certification;
- legally required education or professional credential;
- essential travel or schedule requirements;
- required language fluency;
- compensation incompatibility;
- a materially different professional center;
- an explicit minimum that the evidence truly does not meet.

Classify each as:

- `pass`: directly supported;
- `uncertain`: wording or evidence needs clarification;
- `fail`: truthful answer does not meet the requirement;
- `not-applicable`: not present in the JD.

Decision rule:

- any central `fail` stops the application;
- an `uncertain` hard gate must be resolved before submission;
- preferred qualifications do not become hard gates unless the application form treats them that way.

**Output:** `hardGateStatus`, `hardGates[]`, and an explicit stop/proceed decision.

### Stage 3 — Run the weighted fit gate

Use the project’s established Role-Specific Evidence Weighting rules. Record:

- evidence mode;
- primary source;
- supporting source;
- fit class;
- strongest direct overlap;
- unsupported requirements;
- actual mismatches;
- missing evidence;
- cover-letter bridge status and rationale;
- recommended positioning.

Do not merge “unsupported requirement” and “actual mismatch.” A portfolio-primary role without a relevant case study is an evidence failure. A resume-primary client-success role without renewal or adoption ownership may be a structural operating-center gap. The response should differ.

**Proceed rule:** generate the package automatically for `strong` and credible `adjacent`; require approval for `stretch`; stop on `not-fit`. When the bridge is `recommended`, the package includes the cover-letter PDF and Markdown automatically. The letter never overrides the fit controls or a failed hard gate.

### Stage 4 — Build a requirement-to-evidence matrix

Decompose the JD instead of copying its keyword list.

Use this structure:

| JD requirement | Requirement type | Evidence strength | Source proof | Exact/recognized language | Destination |
|---|---|---|---|---|---|
| Work authorization | Hard gate | Direct / none | Application answer | Employer wording | Form only |
| Lead AI product discovery | Core | Direct / adjacent / none | Role + outcome | Product discovery | Summary + bullet |
| RAG | Core or preferred | Direct / adjacent / none | Named workflow | Retrieval-augmented generation (RAG) | Skills + bullet |
| Executive stakeholder work | Core | Direct / adjacent / none | Client/leadership example | Executive stakeholders | Bullet |
| Industry familiarity | Context | Direct / adjacent / none | Pharma/healthcare proof | Employer domain term | Summary/route |

Requirement types:

- `hard-gate`: may reject the application outright;
- `core`: central to the job’s operating center;
- `supporting`: useful but not decisive;
- `preferred`: differentiator, not a truthful requirement to invent;
- `context`: domain or company language that helps comprehension.

Evidence strength:

- `direct`: the source proves the same work;
- `adjacent`: the source proves a credible nearby behavior;
- `none`: do not claim it;
- `unknown`: ask or investigate before using.

This matrix is the real tailoring brief. It prevents both keyword stuffing and under-signaling.

### Stage 5 — Write the one-sentence application strategy

Before editing artifacts, finish this sentence:

> For this **[evidence mode]** role, the application will lead with **[primary operating proof]**, validate it through **[two or three concrete outcomes/projects]**, acknowledge **[important boundary]**, and route the reviewer to **[most relevant proof path]**.

If this sentence cannot be written cleanly, the application is not ready for artifact work.

### Stage 6 — Build the matched package

Follow the existing route and resume rules, with these content priorities.

#### Resume order of operations

1. Target identity: use the role family in the summary without changing historical truth.
2. Summary: role fit, domain, scope, and two proof anchors.
3. Skills: four to six relevant clusters using supported JD language.
4. Experience: keep chronology; surface the most relevant proof early inside each role.
5. Outcomes: retain scale, adoption, awards, revenue/investor, time, or user evidence where supported.
6. Education/credentials: preserve exact facts; do not bury a required credential if it exists.
7. Portfolio link: route exclusively to the matched role package.

#### Title normalization rule

Do not rename an employer-issued historical title into the target title. If a title is obscure and the functional scope is supported, use a transparent qualifier such as:

> Director, Experience & Innovation — Enterprise Product Design

Never convert adjacent work into an official title the person did not hold.

#### Keyword rules

- Mirror exact phrases where they describe real experience.
- Pair acronym and expanded term on first use: `Medical Legal Review (MLR)` or `retrieval-augmented generation (RAG)`.
- Include a term in a bullet or skills line where a recruiter can see its context.
- Prefer nouns recruiters search for: job family, platform, method, domain, credential, and outcome.
- Use natural variants when both matter: `product strategy` and `product roadmap`; `customer adoption` and `implementation`.
- Do not repeat a term merely to raise density.
- Never add hidden text, false tools, false certifications, false years, or copied JD blocks.

#### Portfolio rules

- Keep `canonical-projects` as the default.
- Select three projects by default, ordered as an argument for the role.
- Use the route hero to explain the fit in first person with two or three concrete proofs.
- Make the closing block a concise bookend to the same role story.
- Keep canonical case studies and the public homepage unchanged unless broader edits are explicitly requested.
- Publish and verify every route used by a recruiter-facing PDF before calling the package ready.

#### Humanized copy gate

After the evidence and ATS language are correct, run all authored copy through the `humanizer` skill. This covers the fit explanation, resume, route, cover letter, application answers, recruiter notes, and outreach.

Humanizing is a surface edit unless the human explicitly asks for a rewrite. Keep the content, structure, claims, proof, order, and ending. Remove obvious AI habits such as inflated language, promotional filler, vague attribution, superficial `-ing` clauses, formulaic transitions, forced three-part phrasing, em dashes, curly quotes, and chatbot-style closers. Do not remove truthful JD terms or turn grounded copy into a different story.

Complete the skill's final audit: ask `What makes the below so obviously AI generated?`, identify any remaining tells, then revise once more. For package copy, approve that exact version with `humanizer-check.mjs --approve --semantic-pass-complete`. The last flag attests that the semantic pass happened; the static scan cannot make that judgment. Its checksum makes later copy edits fail the build until the pass is repeated.

### Stage 7 — Run the ATS and human preflight

The application cannot proceed on a structural failure. Keyword coverage remains advisory.

#### A. Structural parse gate — blocking

- PDF text extraction is non-empty.
- No replacement-character or ligature corruption appears.
- Name, email, phone, and `City, ST` appear in the first extracted lines.
- Required standard headings appear in extracted text.
- Experience reads in the intended order after styling is removed.
- File is text-based, not an image.
- No tables, columns, text boxes, graphics-as-text, or contact details in headers/footers.
- Page count is two or fewer for the current resume contract.
- File size stays below conservative parser limits; Greenhouse documents a 2.5 MB parsing ceiling.
- `LinkedIn` and `Portfolio` annotations point to the correct live URLs.
- Portfolio route and resume artifacts return `200` before submission.

#### B. Application consistency gate — blocking

- title, employer, and dates agree with LinkedIn and form fields;
- location is consistent;
- contact information is current;
- required questions have truthful, complete answers;
- compensation response follows the chosen strategy and does not contradict the listing;
- no unsupported claim was introduced while mirroring language.

#### C. Search and criteria coverage — advisory

Report, but do not score-gate:

- core JD phrases present with direct evidence;
- core phrases absent despite supported evidence;
- acronyms missing their expanded form;
- important title, domain, platform, method, or credential variants;
- terms present only in a skills list and not demonstrated in experience;
- repeated terms that look stuffed.

Use three labels:

- `covered-directly`;
- `covered-adjacently`;
- `not-supported`.

Do not reduce this to a single match percentage.

#### D. Fifteen-second human scan — blocking when unclear

Within the first screen/page, a recruiter should be able to answer:

1. What role is this person pursuing?
2. What is the closest directly relevant work?
3. What scale or outcome proves it?
4. What domain or customer context matters?
5. Is there an obvious reason to click the portfolio?

If those answers require inference, tighten the summary, skills, and first bullets.

### Stage 8 — Submit with form discipline

The application form is part of the candidate record, not clerical cleanup.

Submission sequence:

1. Open the canonical company application, not an aggregator copy when avoidable.
2. Record the ATS/vendor and requisition ID.
3. Upload the verified role-specific PDF.
4. Inspect every parsed field.
5. Correct titles, companies, dates, education, location, phone, and links.
6. Complete knockout questions truthfully and consistently.
7. Use the requirement matrix for narrative questions; answer the question with one relevant proof, not a generic mini-cover letter.
8. Confirm the attached filename and document version.
9. Submit once; avoid duplicate applications to the same requisition.
10. Save the confirmation URL/email and exact submission time.
11. Change the application record to `applied` immediately.

Why field review matters: both Greenhouse and Lever document that resume parsing populates candidate fields, and Greenhouse documents formatting cases that can cause partial or failed parsing. A clean PDF is necessary, but the final form still deserves inspection.

### Stage 9 — Create the human route

Treat outreach as an evidence-led follow-on, not a plea to bypass process.

#### Contact priority

1. trusted employee who knows the work;
2. role recruiter or talent partner;
3. likely hiring manager;
4. team leader in the same function;
5. relevant professional connection who can identify the owner.

Do not message an entire department. Choose one primary route and, at most, one secondary route when it adds a different connection.

#### Contact research checklist

- Does the person recruit or lead this role family?
- Is the role or team visible in their recent activity?
- Is there a credible shared context, project, domain, or connection?
- Can the message lead with one direct proof rather than a biography?
- Is the matched portfolio route useful to this recipient?

#### Post-application recruiter note

Subject: `Applied — [Role] | [one proof lane]`

> Hi [Name] — I applied for the [exact role] role ([job ID] if useful). The closest match in my background is [one direct proof], including [one concrete outcome or scale point]. I built a short role-specific proof path here: [portfolio route].
>
> Would love to hop on a call to chat about this opening or any other across your desk you might see fit.

That final sentence is mandatory for every post-application recruiter note under the project rules.

#### Hiring-manager note

> Hi [Name] — I applied for [role] and wanted to share the most relevant part of my background directly: [one sentence connecting their need to a supported result]. The short proof path is here: [route]. If the team is prioritizing [specific requirement], I would be glad to compare notes on how I approached [relevant example].

#### Warm-introduction request

> Hi [Name] — I’m applying for [role] at [company]. The match is strongest around [proof lane], especially [specific result]. Would you be comfortable pointing me to the recruiter or hiring lead, or making an introduction if you know them? Here is the role and the short proof route so you can judge the fit first: [links]. No pressure if it is outside your circle.

#### Outreach cadence

Use this as an operating heuristic to test, not an ATS law:

- initial note: after the application is confirmed, usually the same or next business day;
- one follow-up: four to five business days later if there is no response and the role remains open;
- final close: seven to ten business days after that only when there is new information, a relevant proof update, or a warm connection;
- stop after two unanswered direct touches.

Every message should be short, role-specific, and grounded. “Checking in” without new value is not a strategy.

### Stage 10 — Track outcomes as events

Use a separate application record linked to the package. A package describes what was built; an application record describes what happened.

Recommended application stages:

- `applied`
- `recruiter-screen`
- `hiring-manager`
- `interview`
- `offer`
- `rejected`
- `withdrawn`

Readiness, assessments, and outreach are separate records. They do not change the current application stage. Assessment events use `invited`, `started`, `completed`, and `result-received`; preparation must reference distinct foundation proof IDs.

Record every transition with:

- timestamp;
- source (`application`, `email`, `LinkedIn`, `referral`, `call`);
- person/contact when relevant;
- notes;
- rejection stage/reason when known;
- next action and due date.

Do not overwrite the history with only the current status. Time-to-response and stage conversion require event dates.

## ATS/vendor-specific preflight

These are supported operating notes, not promises about every employer configuration.

| Detected system | Documented behavior | Application emphasis |
|---|---|---|
| Greenhouse | Resume parsing; exact full-text keyword filtering; Boolean search; filters including referrals/location; configurable auto-reject answers | Use exact supported terms, conventional structure, complete form answers, and inspect parsed fields |
| Lever | Resume parsing into candidate fields; fast human resume review; configurable screening/automation capabilities | Text-selectable file, obvious top-page fit, clean fields, concise proof-led bullets |
| Ashby | Auto-reject conditions on application answers; AI evaluation against employer-defined resume criteria; sortable criteria-met results | Treat every core JD requirement as a criterion and show objective, contextual evidence where supported |
| Workday + HiredScore | Candidate grading, prioritization, and rediscovery against job/talent requirements | Lead with qualification fit, explicit scope, and direct evidence; do not rely on being merely early |
| LinkedIn Apply / Recruiter | Skills Match uses profile/resume skills, location, titles, and contextual evidence; recruiter search supports skill/title/keyword filters | Keep LinkedIn headline, About, current role descriptions, skills, location, and resume vocabulary aligned |
| Unknown/custom | Behavior may range from simple storage to rules, search, parsing, or AI review | Use the universal baseline: truthful gates, conventional format, supported language, clear human scan |

## Resume changes implemented at the canonical source

Workflow v2 applies these canonical changes in `resume.html`, and every future package inherits them:

1. `Capabilities` is now `Skills`.
2. The location is `Raleigh, NC`.
3. Team scale uses `2 to 30`.
4. The phone is standardized as `347-420-3558`.
5. Email, LinkedIn, Portfolio, and award links retain visible print underlines.
6. Deterministic `@page` Letter geometry and margins are defined.
7. Preserve single-column, selectable-text, conventional chronological structure.
8. Keep label-style `LinkedIn` and `Portfolio` text while verifying the embedded annotations.

The Google Fonts are not a demonstrated failure in the current PDF path. Verify extraction and embedding instead of replacing them based on generic “system font only” advice.

## Target data architecture

### 1. Package config: `scripts/packages/<slug>.json`

Purpose: preserve the JD, fit decision, content strategy, and artifact intent.

Required groups:

- `job`: company, title, ID, URL, captured date, location, raw JD;
- `classification`: target lane, evidence mode, fit class, hard gates;
- `positioning`: lane, target identity, employer need, bridge type, application strategy, bridge thesis, proof IDs, and remaining gap;
- `requirements`: requirement-to-evidence matrix with source, confidence, proof IDs, destinations, and match mode;
- `package`: route mode, selected projects, resume PDF path;
- `copy`: a 45–65-word summary, four to six foundation skill selections, every mapped experience bullet, hero, and contact copy;
- `constraints`: unsupported claims and important boundaries;
- `privacy`: explicit confirmation that committed JD and evidence fields contain only public or sanitized material;
- `qa`: last render/check results.

Package configs are public. Store the public job description, but keep recruiter details, personal application answers, compensation boundaries, and private eligibility evidence in the ignored application ledger instead.

### 2. Artifact manifest: `scripts/tailored-packages.json`

Purpose: inventory generated and published files.

Keep it focused on:

- slug and role title;
- config path;
- route mode and projects;
- recruiter-facing PDF path;
- temporary HTML policy;
- publish status;
- verification timestamps and URLs.

Do not use this as the primary outcome tracker.

### 3. Private application ledger: `.private/applications.json`

Purpose: one record for each actual submission.

The portfolio repository is public, so the real ledger is ignored by Git. Commit only `scripts/applications.example.json` and `scripts/schemas/applications.schema.json`. Use `scripts/application-ledger.mjs ready` for a private pre-submission snapshot, then `record` only after visible confirmation. Use `event`, `assessment`, `outreach`, and `report` for later outcomes. Revisions 5 and 6 retain their contract revision, require matching readiness, and recompute readiness, duplicate, attachment, and live-package checks before writing. Revision 6 also blocks readiness when a recommended cover letter was not included.

Suggested shape:

```json
{
  "applicationId": "company-job-id-20260715",
  "packageSlug": "company-role",
  "targetLane": "ai-product-implementation",
  "evidenceMode": "balanced",
  "fitClass": "strong",
  "source": "company-careers",
  "atsVendor": "greenhouse",
  "artifactVerification": {
    "verifiedAt": "2026-07-15T14:10:00-04:00",
    "configSha256": "<sha256>",
    "routeSha256": "<sha256>",
    "pdfSha256": "<sha256>",
    "scopedProjectSha256": {}
  },
  "appliedAt": "2026-07-15T14:30:00-04:00",
  "currentStage": "applied",
  "confirmation": "Visible confirmation page or email reference",
  "outreach": [
    {
      "status": "sent",
      "channel": "LinkedIn",
      "threadKey": "linkedin::recruiter name",
      "person": "Recruiter name",
      "at": "2026-07-15T15:10:00-04:00"
    }
  ],
  "events": [
    {
      "stage": "applied",
      "at": "2026-07-15T14:30:00-04:00",
      "source": "application"
    }
  ]
}
```

### 4. Content bank: `scripts/resume-content-bank.json`

Purpose: reuse only grounded variants.

Organize by proof anchor, not by buzzword:

- Claims Detector and investor outcome;
- pharma MLR/FDA/HIPAA workflows;
- agency scoping and operations;
- AI POC discovery and validation;
- enterprise UX and analytics scale;
- team growth from 2 to 30;
- 7,000+ users and 22 white-label brands;
- Indigo and Red Dot recognition;
- client/account leadership.

Every variant should point to its canonical source evidence and list which claims it may not imply.

## Automation roadmap

### P0 — Make the workflow measurable and reproducible — implemented for v2

1. Persist one config and raw JD per package.
2. Add the separate application ledger and event history.
3. Require `targetLane`, `evidenceMode`, `fitClass`, and `hardGateStatus` on new records.
4. Add an explicit `applicationId` after submission; do not count generated packages as applications.
5. Update the quick workflow in `RESUME_CHAT_RULES.md` to include form review, outreach, and outcome capture.

### P1 — Make every submitted artifact structurally reliable — implemented for v2

1. Apply the canonical `resume.html` fixes listed above.
2. Add `scripts/render-resume-pdf.mjs` for deterministic PDF output.
3. Add `scripts/ats-check.mjs` with blocking structural checks and advisory requirement coverage.
4. Make the verifier confirm the matched live route and link annotations.
5. Treat workflow v1 inventory failures as non-blocking legacy diagnostics; require strict green checks for every workflow v2 package.

### P2 — Reduce manual tailoring without flattening judgment — implemented for revision 5

1. Workflow v2 stores the exact tailored summary, selected foundation skills, positioning, and all mapped role bullets in the package config rather than relying on freehand output files.
2. The package builder reads the persisted config directly.
3. The PDF path is derived from the required `artifactStem`; temporary HTML paths are derived from the slug and never enter the manifest.
4. ATS preflight emits advisory requirement coverage beside blocking parser and integrity checks.
5. Bulk live status sweeps remain future work; individual v2 verification is authoritative.

### P3 — Close the learning loop

1. Generate a weekly pipeline report from application events.
2. Break conversion down by target lane, fit class, evidence mode, source, ATS, and outreach status.
3. Track which portfolio route/project order was used.
4. Add optional privacy-conscious route analytics only if they can distinguish real recruiter visits without collecting unnecessary personal data.
5. Connect to the resume-agent pipeline tools if they become available, using the local application ledger as the durable source of truth.

## Measurement framework

### Core metrics

| Metric | Definition | What it diagnoses |
|---|---|---|
| Valid applications | Truthful submissions that passed the hard and fit gates | Real denominator |
| Human response rate | Non-automated replies / valid applications | Whether the package or outreach creates attention |
| Recruiter-screen rate | Recruiter screens / valid applications | Top-of-funnel effectiveness |
| Hiring-manager rate | Hiring-manager interviews / valid applications | Strength of role-specific proof |
| Interview progression | Applications reaching each later stage / prior-stage applications | Where the case weakens |
| Offer rate | Offers / valid applications | End-to-end result |
| Outreach-assisted screen rate | Screens where a human touch preceded the screen / applications with outreach | Whether outreach adds value |
| Median time to first human response | Days from application to first non-automated response | Process speed by source/company |
| No-response rate | Applications with no human event after a chosen observation window | Queue or targeting problem |

### Required cuts

Review every metric by:

- target lane;
- positioning lane and bridge type;
- fit class;
- evidence mode;
- company size or role volume when known;
- application source;
- ATS/vendor;
- direct, adjacent, exact, recognized-equivalent, and contextual requirement coverage;
- cover-letter use;
- referral/outreach status;
- assessment type;
- rejection or advancement stage and outcome category;
- resume/package variant;
- application age at submission when available.

### Learning rules

- Do not compare `unclassified` packages with classified ones.
- Establish internal baselines; do not borrow universal internet benchmarks.
- Wait for a meaningful same-lane cohort before changing strategy. Ten valid applications is a useful review checkpoint, not statistical proof.
- If a lane has ten `strong`/`adjacent` applications and no recruiter screens, audit fit calibration, title/summary clarity, form gates, and search-language coverage before increasing volume.
- If recruiter screens happen but hiring-manager interviews do not, improve the verbal positioning and direct operating-center evidence.
- If hiring-manager interviews happen but later progression stalls, inspect interview stories, depth, and proof—not ATS formatting.
- Change one material variable at a time when testing summaries, proof order, portfolio routes, or outreach.
- Preserve the prior version and cohort assignment so results remain interpretable.

## Quality gates and statuses

| Gate | Blocking condition | Result |
|---|---|---|
| Eligibility | Central hard requirement fails or remains unresolved | Stop |
| Fit | `not-fit`, or unapproved `stretch` | Stop |
| Cover-letter bridge | The argument requires unsupported evidence or must conceal a structural gap | Mark `not-credible`; do not use persuasion to bypass the fit or eligibility gate |
| Humanized copy | Skill pass is missing, obvious AI patterns remain, or reviewed copy changed afterward | Revise and approve again before rendering |
| Claim integrity | Any unsupported title, skill, credential, outcome, or scope | Stop |
| Parse | Text extraction, ordering, contact, heading, or file failure | Fix before submission |
| Package consistency | Resume, route, LinkedIn, identity, or form contradicts another source | Fix before submission |
| Publish | PDF points to a route/artifact that is not live and verified | Fix before submission |
| Coverage | Supported core language is missing | Warn and review |
| Human scan | Role and proof are not obvious | Fix before submission |
| Submission readiness | Form gate, screening answer, parsed field, uploaded file/checksum, duplicate, identity, narrative, notice, assessment, or platform warning is unresolved | Block submission-ready status |
| Application capture | No confirmation or pipeline record after submission | Application incomplete operationally |

Recommended package status progression:

`captured → gated → approved → built → qa-passed → live-verified`

Submission readiness is a separate private snapshot: `blocked` or `ready`. It never means applied.

## Definition of done for one application

- [ ] Raw JD and canonical URL saved.
- [ ] ATS/vendor and job ID recorded.
- [ ] Hard gates evaluated.
- [ ] Evidence mode and fit class recorded.
- [ ] Requirement-to-evidence matrix completed.
- [ ] Unsupported requirements separated from actual mismatches.
- [ ] Resume tailored from the canonical source.
- [ ] Matched portfolio route built with the correct proof order.
- [ ] `build-tailored-package.mjs` completed and removed temporary HTML.
- [ ] PDF rendered deterministically and structural ATS checks passed.
- [ ] Tailored summary and selected skills extract on page one.
- [ ] Every employer, full title, date range, education anchor, and all 23 mapped bullets extract in order.
- [ ] Private submission-readiness snapshot passes at the first accessible pre-submission point.
- [ ] Uploaded filename and checksum match the verified PDF.
- [ ] Parsed fields, screening answers, identity consistency, duplicate status, notices, assessments, and platform warnings were reviewed.
- [ ] Manual submission is visibly confirmed before an application record is created.
- [ ] Requirement coverage warnings reviewed.
- [ ] Fifteen-second human scan passed.
- [ ] Resume and route links verified live.
- [ ] Parsed application fields manually checked.
- [ ] Form answers reviewed for truth and consistency.
- [ ] Confirmation saved.
- [ ] Private application ledger updated with `appliedAt` and visible confirmation evidence.
- [ ] One appropriate human route attempted or explicitly marked unavailable.
- [ ] Follow-up or review date recorded.

## Weekly operating review

Once per week:

1. reconcile every application against email/LinkedIn responses;
2. update stages and event dates;
3. close jobs that are no longer active;
4. identify overdue follow-ups;
5. review conversions by target lane and fit class;
6. inspect the highest-volume failure stage;
7. choose at most one workflow experiment for the next cohort;
8. document the decision before changing templates or rules.

The review should end with three decisions:

- what to continue;
- what to stop;
- what single change to test next.

## Myths and guardrails

- **“An ATS rejects 75% of resumes.”** No credible universal primary source supports this number. Do not use it.
- **“All ATSs score every resume the same way.”** False. Systems and employer configurations differ.
- **“PDF is always unsafe.”** False. Text-based PDFs are supported by major systems including Greenhouse and Lever; parsing still must be tested.
- **“Keywords alone beat the system.”** False. Exact terms can affect search, while configurable gates and AI criteria evaluate answers or context.
- **“The first applicant wins.”** False as a universal rule. Some modern systems explicitly prioritize qualification fit. Applying promptly is still a sound operating heuristic because requisitions can close or accumulate volume.
- **“A referral replaces the application.”** Usually false. Treat referral/outreach as a routing layer linked to a complete application.
- **“More applications always create more interviews.”** Only if fit and execution quality hold. Measure valid, gated applications rather than raw volume.
- **“A high third-party match percentage proves readiness.”** False. Coverage reports are diagnostics, not employer decisions.

## How this changes the original enhancement backlog

| Original recommendation | Decision in this playbook |
|---|---|
| Persist package configs and JD text | Retain and elevate to P0 |
| Automate PDF render and verification | Retain as P1 |
| Bulk publish-status sweep | Retain after individual package correctness |
| Structured resume content bank | Retain as P2 with source-evidence links and claim boundaries |
| ATS keyword coverage | Retain as advisory; replace raw match score with requirement status |
| Outcome feedback loop | Elevate to P0 and store separately from artifact inventory |
| Add pipeline fields directly to package manifest | Replace with linked application/event records |
| Cover-letter automation | Keep optional and lower priority than form/outreach tracking |
| Root cleanup | Useful maintenance, but not a conversion priority |

## Source notes

Primary vendor documentation was preferred because ATS behavior changes and employer configurations differ.

- [Greenhouse: unsuccessful resume parse](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) — parsing populates candidate fields; documents size and formatting failure modes including columns, tables, graphics, headers, footers, and contact information in text boxes.
- [Greenhouse: Talent Filtering](https://support.greenhouse.io/hc/en-us/articles/27104809835291-Talent-Filtering) — recruiter filtering can use exact job-title, skill, location, and other keywords from resumes and notes, with preferred/required logic and additional filters.
- [Greenhouse: Boolean candidate search](https://support.greenhouse.io/hc/en-us/articles/202360199-Search-candidates-using-Boolean-queries) — documents AND, OR, NOT, phrase, and wildcard searching over candidate content.
- [Greenhouse: auto-reject](https://support.greenhouse.io/hc/en-us/articles/360000653472-Auto-reject) — application answers can trigger employer-configured rejection rules.
- [Lever: understanding resume parsing](https://help.lever.co/hc/en-us/articles/20087345054749-Understanding-resume-parsing) — parsing extracts name, organization, contact, work history, and other readable information; text-based PDF is supported.
- [Lever: ATS myths](https://www.lever.co/blog/applicant-tracking-system-myths-debunked) — distinguishes recruiter-configured knockout questions, fast human review, automation, and AI-assisted shortlisting from the idea of one autonomous gatekeeper.
- [Ashby: auto-reject applications](https://docs.ashbyhq.com/auto-reject-applications) — application-form conditions can reject candidates at submission.
- [Ashby: AI-assisted application review](https://docs.ashbyhq.com/ai-assisted-application-review) — employers can define resume criteria, evaluate applications against them, and sort/filter by criteria met.
- [Workday: HiredScore AI for Recruiting](https://www.workday.com/content/dam/web/en-us/documents/datasheets/hiredscore-ai-recruiting1.pdf) — supports candidate review, prioritization, rediscovery, and recruiter/hiring-manager workflows.
- [LinkedIn Recruiter: Skills filter](https://www.linkedin.com/help/recruiter/answer/a593591) — Skills Match can use explicit, profile-text, resume, contextual, and inferred skills plus location.
- [LinkedIn Recruiter: Boolean search](https://www.linkedin.com/help/recruiter/answer/a415295) — recruiters can filter titles, skills, companies, locations, and keywords using AND/OR/NOT and phrase searches.

Secondary resume-optimization sources may still be useful for formatting ideas, but they should not override vendor documentation, repository extraction tests, or the no-overclaiming rules.
