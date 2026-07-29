# Resume Tailoring Breadth Audit

**Snapshot:** July 22, 2026

**Scope:** Every experience section in `resume.html`, the 24 current workflow-v2 package configs with tailored role copy, the package builder, validation, humanizer review, ATS checks, and existing QA results. One Block Away is the primary case study, not the boundary of the repair.

**Status:** Diagnostic only. No resume, package config, route, manifest, PDF, or workflow code was changed during this audit.

## Executive finding

The concern is real.

The workflow does not edit a canonical job section. It accepts a new array of bullets for every job and replaces the canonical section with that array. The validator accepts any non-empty array, including one generic bullet. The humanizer checks the final authored copy for style and review freshness, but it does not compare that copy with the canonical experience. The ATS check validates the PDF as a document, not the semantic breadth of each job.

Across 144 job transformations in 24 packages, 137 are either emphasis-only or compressed without losing the job's operating center. The seven destructive transformations are all in One Block Away:

- 5 are `over-narrowed`: the AI-product operating center survives, but every named initiative is removed.
- 2 are `dismantled`: the section becomes generic JD-shaped client-delivery copy and loses the AI-product operating center, named work, and technical ownership.

That concentration describes the current sample, not the scope of the workflow defect. Every experience section uses the same unrestricted replacement mechanism. Hedgehox, Kinesso, Omnicom, Heartbeat, and Account Management are exposed to the same failure even though the 24 audited packages generally preserved them. The repair must protect every job on the resume.

This is not primarily a PDF-rendering problem. It begins when the package copy is authored without a preservation contract, passes validation, and is then applied as a whole-section replacement.

## Classification standard

Bullet count is evidence, not the verdict. The classifications below are based on semantic coverage:

- `E` / `emphasis-only`: the role keeps its operating center, responsibilities, concrete proof, outcomes, and breadth. Wording and order may change.
- `C` / `compressed-but-intact`: one or more lower-priority lanes are omitted or combined, but the role still reads like the same job and keeps concrete proof.
- `N` / `over-narrowed`: the role's basic identity survives, but named work, outcomes, or breadth are stripped away enough to weaken credibility.
- `D` / `dismantled`: the role is reduced to generic target-role responsibilities and no longer communicates the actual operating center or distinctive work.

## Canonical proof-lane map

| Role | Canonical bullets | Operating center | Responsibilities | Named work | Measurable outcomes | Breadth |
|---|---:|---|---|---|---|---|
| Hedgehox | 6 | Regulated pharma AI implementation | POC building, workflow design, product framing, demo iteration | Claims Detector, Xenagos Bio, Scope Generator, FDA Warning Tool | Investor secured | Claims review, brief intake, scoping, routing, submission capture, FDA monitoring, startup web, finance and operations |
| One Block Away | 5 | Client-led AI product and POC work | Discovery through product strategy, UX, AI workflows, front end, backend, demo, and iteration | ListingPal, WeReady Bailey, Tunisia youth soccer program | ListingPal output in under 90 seconds | Real estate marketing, startup-readiness intelligence, product development, web and sponsor strategy |
| Kinesso | 4 | Enterprise UX, analytics, and design systems | Team scaling, product-system leadership, data visualization, audit workflow | MIE, Digital Experience Audit | Team 2 to 30, 7,000+ users, 22 brands, Indigo and Red Dot recognition | Distributed leadership, white-label systems, analytics, components, client outputs |
| Omnicom | 2 | Oncology UX in a regulated agency setting | UX advocacy and translation across account, strategy, creative, and delivery | No named initiative in the canonical section | No quantified outcome | User flows, content structure, digital recommendations, healthcare account context |
| Heartbeat | 3 | Pharma and healthcare UX research and experience strategy | Research, journey and interaction design, cross-functional handoff | No named initiative in the canonical section | No quantified outcome | Patient, HCP, internal brand teams, strategy, creative, account, and engineering |
| Account Management | 3 | Fortune 500 pharma account and client strategy | Portfolio ownership, account leadership, briefs, feedback, timelines, production, and MLR delivery | FCB Health's largest pharma account; NUVIGIL, Namenda XR, Lipitor, and Zoloft | 7+ years and $2M-$50M+ budgets | CNS, psychiatry, cardiovascular, metabolic, sleep, TV, radio, digital, gaming, and out-of-home |

### One Block Away lane IDs used in this audit

- `P`: client-led AI POCs as the operating center
- `L`: ListingPal
- `W`: WeReady Bailey
- `E`: end-to-end product and technical ownership
- `T`: Tunisia website and sponsor strategy

## What the pipeline actually does

1. `resume.html` provides the canonical bullet arrays through stable `data-resume-role` attributes.
2. A package author writes a complete replacement array at `resume.roles.<roleId>`.
3. `validateResume()` checks only that each role is a non-empty string array. There is no source-lane mapping, minimum semantic coverage, or omission reason.
4. Humanizer approval hashes and approves the authored package copy. It checks style, mode, and review freshness, but not whether canonical proof survived.
5. `buildResume()` loops through every role ID and replaces the entire canonical `<ul>` with `renderBulletItems(config.resume.roles[roleId])`.
6. ATS preflight checks extraction, page count, headings, contact information, annotations, file size, unsafe symbols, prohibited claims, and advisory term coverage. It does not compare canonical and tailored experience.

The written guidance says to reorder emphasis and keep the strongest proof visible. The executable contract does not enforce either instruction.

## Controlled fixture

The fixture ran entirely in memory and did not create or modify files.

The One Block Away section was reduced to:

> Own client discovery and delivery from first ask through working prototype.

| Stage | Result |
|---|---|
| Config validation before required copy approval | Failed only because copy approval was absent |
| Humanizer approval | Passed |
| Config validation after approval | Passed with no errors |
| Unsupported-claim gate | Passed |
| Whole-section replacement | Produced exactly one bullet |

This isolates the failure before PDF rendering. The authoring contract permits the loss, validation accepts it, the humanizer correctly evaluates only the supplied copy, and the builder faithfully replaces the whole section.

## Quantified findings

### Bullet-count profile

| Role | Canonical | Tailored minimum | Tailored maximum | Tailored average | Current distribution |
|---|---:|---:|---:|---:|---|
| Hedgehox | 6 | 3 | 5 | 3.92 | 7×3, 12×4, 5×5 |
| One Block Away | 5 | 2 | 5 | 3.33 | 4×2, 10×3, 8×4, 2×5 |
| Kinesso | 4 | 3 | 6 | 4.04 | 6×3, 13×4, 3×5, 2×6 |
| Omnicom | 2 | 1 | 2 | 1.96 | 1×1, 23×2 |
| Heartbeat | 3 | 2 | 3 | 2.96 | 1×2, 23×3 |
| Account Management | 3 | 2 | 4 | 3.17 | 4×2, 12×3, 8×4 |

### Semantic result by role

| Role | Emphasis-only | Compressed but intact | Over-narrowed | Dismantled | Severity |
|---|---:|---:|---:|---:|---|
| Hedgehox | 0 | 24 | 0 | 0 | Low. Every package keeps regulated AI as the operating center and multiple concrete proofs. |
| One Block Away | 1 | 16 | 5 | 2 | High. All destructive loss in the sample occurs here. |
| Kinesso | 3 | 21 | 0 | 0 | Low. Scale, enterprise-system ownership, and at least one concrete workflow or outcome survive. |
| Omnicom | 23 | 1 | 0 | 0 | Low. The one compressed version combines both canonical lanes. |
| Heartbeat | 23 | 1 | 0 | 0 | Low. The one compressed version combines research/craft and cross-functional handoff. |
| Account Management | 20 | 4 | 0 | 0 | Low to medium. Four versions omit the named FCB proof, but retain portfolio scale and delivery responsibilities. |
| **Total** | **70** | **67** | **5** | **2** | **Seven material losses out of 144 transformations, all in One Block Away.** |

## All-package, all-role matrix

`H` = Hedgehox, `OBA` = One Block Away, `K` = Kinesso, `O` = Omnicom, `HB` = Heartbeat, and `AM` = Account Management.

| Package | H | OBA | K | O | HB | AM |
|---|---|---|---|---|---|---|
| Abaxx Senior Brand Designer | C | N | C | C | E | C |
| Accela Senior Consultant | C | C | C | E | E | E |
| AEC Senior UX Researcher | C | C | C | E | E | C |
| Airbnb Trust & Safety Product Manager | C | C | C | E | E | E |
| Applied Systems Senior Product Manager, AI Automation | C | C | C | E | E | E |
| CBIZ AI Consultant | C | C | E | E | E | E |
| Conceptra Biosciences Brand Marketing | C | C | C | E | E | E |
| Cotton Incorporated Manager, Trade Marketing | C | C | C | E | E | E |
| Fieldguide Executive Assistant | C | C | C | E | C | E |
| FINN Partners Senior Project Manager | C | N | C | E | E | E |
| FINN Partners Senior Strategist | C | C | C | E | E | E |
| Forma Life Science Marketing General Interest | C | E | E | E | E | E |
| HMH Senior UX Designer | C | N | C | E | E | C |
| MedSpa AI Product Manager | C | C | C | E | E | E |
| Motive Product Manager, Compliance | C | C | C | E | E | E |
| Playlist Senior Product Manager, Consumer Platform | C | C | C | E | E | E |
| Power Entry-Level Sales Representative | C | C | C | E | E | E |
| Precision AQ Project Coordinator | C | D | C | E | E | E |
| Predictive Sales AI Customer Success Consultant | C | N | C | E | E | E |
| Principal UX/HCD Lead | C | C | E | E | E | C |
| Sharecare Client Success Manager | C | N | C | E | E | E |
| Socure Product Lead, Workforce Solutions | C | C | C | E | E | E |
| Thriveworks Account Manager | C | D | C | E | E | E |
| Vanguard PSCA Product Owner | C | C | C | E | E | E |

## One Block Away deep dive

### Totals

- ListingPal appears in 14 of 24 packages.
- WeReady appears in 13 of 24.
- Tunisia appears in 2 of 24.
- Both ListingPal and WeReady appear in 10 of 24.
- Seven packages contain no named One Block Away initiative.
- Six compressed packages keep only one named initiative. Those sections still preserve the POC operating center and end-to-end ownership, but they are more fragile because one project carries all concrete proof.
- No package records a page-pressure exception or a measured reason for dropping a lane.

### Package-level assessment

| Package | Bullets | Retained lanes | Removed lanes | Named initiative treatment | JD relevance and omission judgment | Class |
|---|---:|---|---|---|---|---|
| Abaxx | 3 | P, E | L, W, T | None retained | Brand/UI and interface translation are relevant, but all concrete One Block Away work is replaced by generic capability language. Unsupported narrowing. | N |
| Accela | 3 | P, W, E | L, T | WeReady only | Discovery, workflow definition, and evidence-heavy dashboards support consulting. Useful compression, with single-project concentration. | C |
| AEC | 3 | P, W, E | L, T | WeReady only | Discovery, usability iteration, and explainable evidence support research. Useful compression, with single-project concentration. | C |
| Airbnb | 5 | P, L, W, E | T | ListingPal and WeReady retained | Product discovery, prioritization, working software, and evidence workflows are directly relevant. Useful compression. | C |
| Applied Systems | 4 | P, L, W, E | T | ListingPal and WeReady retained | AI automation, requirements, and production handoff are supported with both named examples. Useful compression. | C |
| CBIZ | 4 | P, L, W, E | T | ListingPal and WeReady retained | Client-led AI POCs and implementation are central to the target. Useful compression. | C |
| Conceptra | 3 | P, L, E | W, T | ListingPal only | ListingPal is relevant to brand and marketing work. Useful compression, with single-project concentration. | C |
| Cotton | 4 | P, L, E, T | W | ListingPal and Tunisia retained | ListingPal proves campaign generation; Tunisia proves sponsor and donor positioning. Useful, role-specific compression. | C |
| Fieldguide | 3 | P, L, W, E | T | ListingPal and WeReady combined in one bullet | Coordination, brief structure, demos, and decision workflows support the target while preserving both named products. Useful compression. | C |
| FINN Project Manager | 3 | P, E | L, W, T | None retained | Client discovery, scope, and alignment match project management, but all concrete evidence disappears. Unsupported narrowing. | N |
| FINN Strategist | 3 | P, L, E | W, T | ListingPal only | Problem framing, messaging, and ListingPal support strategy. Useful compression, with single-project concentration. | C |
| Forma | 5 | P, L, W, E, T | None | All three named initiatives retained | The full role is preserved. The general-interest target does not require narrowing. | E |
| HMH | 3 | P, E | L, W, T | None retained | Product strategy and UX match the JD, but the section becomes ungrounded capability language without a named product. Unsupported narrowing. | N |
| MedSpa | 4 | P, L, W, E | T | ListingPal and WeReady retained | AI product strategy and client-to-product translation are directly relevant. Useful compression. | C |
| Motive | 4 | P, L, W, E | T | ListingPal and WeReady retained | Product requirements, implementation tradeoffs, and evidence workflows support product management. Useful compression. | C |
| Playlist | 4 | P, L, W, E | T | ListingPal and WeReady retained | Product prioritization, consumer-facing output, and startup workflows support the target. Useful compression. | C |
| Power | 3 | P, L, E | W, T | ListingPal only | Demonstrations, client conversations, and a fast tangible outcome support sales. Useful compression, with single-project concentration. | C |
| Precision AQ | 2 | Partial P and E only | L, W, T, explicit AI-product center | None retained | Coordination language matches the JD, but the actual AI-product consultancy is reduced to generic briefs, presentations, and next steps. Destructive and not supported by a recorded page constraint. | D |
| Predictive Sales AI | 2 | P, E | L, W, T | None retained | Discovery and end-to-end ownership support customer success, but no named client product or outcome remains. Unsupported narrowing. | N |
| Principal | 3 | P, W, E | L, T | WeReady only | Discovery, workshops, prototypes, and WeReady support HCD. Useful compression, with single-project concentration. | C |
| Sharecare | 2 | P, E | L, W, T | None retained | Client discovery and ownership are relevant, but no named product or client result supports the claims. Unsupported narrowing. | N |
| Socure | 4 | P, L, W, E | T | ListingPal and WeReady retained | Zero-to-one product work, customer feedback, and explainable evidence workflows support the stretch case without changing the fit class. Useful compression. | C |
| Thriveworks | 2 | Partial P and E only | L, W, T, explicit AI-product center | None retained | Client and account language matches the JD, but it replaces rather than reframes the AI-product experience. Destructive and not supported by a recorded page constraint. | D |
| Vanguard | 4 | P, L, W, E | T | ListingPal and WeReady retained | Discovery, prioritized requirements, product decisions, and both named examples support product ownership. Useful compression. | C |

## Representative before-and-after findings

### Dismantled: Precision AQ

The canonical section establishes a client-led AI-product consultancy, two named products, full technical ownership, and a separate sponsor-strategy engagement. The tailored section has two bullets:

> Lead client discovery, prioritization, scope definition, presentations, and iteration from first ask through working deliverable.

> Turn unclear client requests into organized briefs, testable concepts, demo narratives, and next-step decisions while keeping stakeholders aligned.

Both bullets are relevant to a Project Coordinator JD. Together, however, they remove the fact that the role is an AI-product business, remove every named initiative, and remove the front-end/backend ownership that makes the coordination credible. This is target-language substitution, not tailoring.

### Over-narrowed: HMH

HMH keeps product strategy, UX, end-to-end delivery, and AI-assisted workflows in three bullets. That preserves the role family, but ListingPal, WeReady, Tunisia, and every concrete One Block Away outcome are gone. The result says what the candidate can do without showing what he did.

### Compressed but intact: Socure

Socure uses four bullets to retain zero-to-one ownership, customer discovery, requirements, implementation tradeoffs, ListingPal, and WeReady. Tunisia is omitted because it adds less to a product-lead case. The section is clearly tailored, but it still reads as the same job and keeps two concrete examples.

### Emphasis-only: Forma

Forma retains all five canonical One Block Away lanes. The language shifts toward life-science marketing and client work, but the operating center, both AI products, technical ownership, and sponsor strategy remain visible.

## Page-pressure assessment

The current data does not support page length as the reason for the destructive sections:

- Precision AQ, Predictive Sales AI, Sharecare, and Thriveworks each use 2 One Block Away bullets, 17 total experience bullets, and pass ATS at 2 pages.
- Airbnb uses 5 One Block Away bullets and 21 total experience bullets at 2 pages.
- Forma uses 5 One Block Away bullets and 24 total experience bullets at 2 pages.
- Applied Systems, CBIZ, and Conceptra use 21 total experience bullets at 2 pages.

Exact line length affects pagination, so raw bullet count cannot prove that every omitted sentence would fit unchanged. It does show that the workflow had no documented, measured need to collapse the four 17-bullet packages. None of the configs records a failed three-page render, a lane-combination attempt, or an approved compression exception. On the available evidence:

- Omitting Tunisia from most role-specific packages is useful prioritization.
- Combining related responsibilities or combining ListingPal and WeReady into one bullet is useful compression.
- Dropping all named One Block Away work is unsupported narrowing.
- Replacing the AI-product operating center with generic JD-shaped responsibilities is destructive, not necessary compression.

## Root cause and responsibility

### Primary root cause: no preservation contract

The package contract asks for exact final bullet arrays but does not identify what each canonical job must continue to prove. The author can unintentionally optimize each line for the JD without seeing the cumulative loss.

### Direct enabler: full-section replacement

The builder does not edit or merge canonical bullets. It replaces every role section with the package array. That behavior is deterministic and technically correct, but unsafe without a preservation gate.

### Validation gap

One non-empty string is enough for a role. Validation does not require:

- an operating-center lane,
- named or quantified proof,
- breadth across multiple initiatives,
- a mapping back to canonical evidence,
- or a reason for omissions.

### Humanizer is not the cause

The humanizer reviews the copy it receives. It correctly preserves and hashes that final copy, but it has no source comparison and no mandate to restore deleted proof. A clean, natural, generic bullet can pass.

### ATS and PDF QA are not the cause

ATS checks run after the semantic decision has already been made. They can reject a corrupt or oversized PDF, unsupported claims, missing contact information, or bad links. They cannot detect that a valid, two-page PDF understates a job.

## Decision-ready repair specification

This is a proposed contract, not an implemented change.

### 1. Keep workflow v2 and introduce contract revision 4

Existing revision 2 and 3 configs remain historical records. Every new or intentionally reused package must use `workflowVersion: 2` and `contractRevision: 4`.

### 2. Store canonical lanes in one registry

Add a versioned, reviewable lane registry keyed by the existing stable role IDs. Each lane should include:

- `id`
- `category`: `operating-center`, `responsibility`, `named-work`, `outcome`, or `breadth`
- canonical source text
- whether it is required, preferred, or optional
- whether another lane may absorb it through honest compression

The canonical map in this report is the starting inventory.

### 3. Change role configs from replacement arrays to mapped tailoring objects

Proposed shape:

```json
{
  "tailoringMode": "compressed",
  "bullets": [
    {
      "text": "Final tailored bullet",
      "sourceLaneIds": ["oba-poc", "oba-end-to-end"],
      "targetRequirementIds": ["product-discovery"]
    }
  ],
  "omittedLaneIds": ["oba-tunisia"],
  "omissionReasons": {
    "oba-tunisia": "Lower relevance to this product-management role"
  }
}
```

The exact copy remains persisted and humanized. The difference is that every bullet declares what source proof it carries, and every omission becomes visible.

### 4. Enforce a preservation floor for every experience section

Universal rules for all six roles:

- retain the operating-center lane,
- retain the responsibilities that explain what the work actually involved,
- retain concrete named, quantified, domain, or delivery proof where the canonical role contains it,
- retain enough breadth to keep the tailored section recognizably the same job,
- reject a section made only of target-role responsibilities.
- block both `over-narrowed` and `dismantled` classifications before rendering,
- allow several source lanes to be combined into one bullet, but never treat a shorter bullet count as proof that the lanes survived.

Role-specific protected cores:

#### Hedgehox

- retain regulated pharma AI implementation as the operating center,
- retain the broader workflow suite across claims review, intake, scoping, routing, submission, or FDA monitoring,
- retain at least two concrete proofs from Claims Detector, the investor outcome, Scope Generator, Xenagos Bio, and FDA Warning Tool,
- allow the selected proofs to change with the JD, but do not reduce the role to generic AI strategy or implementation language.

#### One Block Away

- retain the client-led AI POC operating center, ListingPal, WeReady, and end-to-end ownership by default,
- allow ListingPal and WeReady to share one bullet,
- treat Tunisia as optional when it is not relevant,
- do not allow a single-product section unless a measured page-pressure exception is approved,
- never allow all named initiatives to disappear.

#### Kinesso

- retain the enterprise UX, analytics, and design-system operating center,
- retain the 2-to-30 team scale and the 7,000-user/22-brand product scale,
- retain at least one concrete system or workflow from MIE and the Digital Experience Audit,
- keep Indigo and Red Dot recognition by default; permit omission when a stronger role-relevant outcome occupies the same proof lane and the omission is declared.

#### Omnicom

- retain oncology and regulated healthcare as the operating center,
- retain the combination of UX and account-management experience,
- retain cross-functional UX advocacy and translation into flows, content structure, or digital recommendations,
- allow the two canonical lanes to share one bullet only when both remain explicit.

#### Heartbeat

- retain pharma and healthcare UX research and experience strategy,
- retain concrete UX outputs such as journeys, flows, wireframes, or prototypes,
- retain the cross-functional move from findings to build-ready work,
- allow those lanes to be combined, but do not reduce the role to generic research, design, or collaboration language.

#### Account Management

- retain Fortune 500 pharma and healthcare client leadership as the operating center,
- retain the 7+ years and $2M-$50M+ portfolio scale,
- retain at least one named account, brand, or channel-breadth proof from the FCB work and listed brands,
- retain briefs, production requirements, timelines, cross-functional delivery, and MLR responsibility,
- do not replace the section with generic account-management, stakeholder, or client-service language.

### 5. Validate before the humanizer and before artifact creation

Add a breadth preflight that:

- evaluates all six role sections on every package,
- rejects missing required lane IDs,
- rejects undeclared omissions,
- rejects stale lane mappings when bullet copy changes,
- prints a canonical-to-tailored coverage diff,
- assigns `emphasis-only`, `compressed-but-intact`, `over-narrowed`, or `dismantled`,
- blocks the last two classes,
- creates no route, temporary HTML, PDF, or manifest update on failure.

The humanizer should run after this gate. Its surface-only rule should preserve the approved lane mapping, claims, order, structure, and ending.

### 6. Keep exact replacement only behind the gate

The builder may continue to replace the final HTML `<ul>` after the mapped config passes. The unsafe behavior is not replacement by itself; it is replacement without a verified relationship to the canonical source.

### 7. Make page-pressure exceptions measured

Compression should not be justified by intuition.

1. Render the required-lane version first.
2. If it exceeds two pages, store its page count and copy checksum in a temporary QA result.
3. Combine lanes before deleting them.
4. Require an explicit compression exception that names the affected lanes and the measured overflow.
5. Continue to prohibit removal of the operating center or all named proof.
6. Permit the final build only with an explicit `--allow-compression` flag when a valid measured exception exists.

### 8. Preserve legacy packages

- Do not retroactively fail, rebuild, or relabel the 24 audited packages.
- Treat them as historical evidence.
- Apply revision 4 only to new packages and packages intentionally reused for a new application.
- A reused legacy package must be upgraded and pass the new breadth gate before rebuilding.

## Proposed acceptance tests

1. A generic one-bullet replacement for any of the six roles fails before any file is created.
2. Every package is checked against all six canonical role maps, even when the target JD centers on only one role.
3. A Hedgehox section with generic pharma AI language but no broader workflow lane or concrete named work fails.
4. A Hedgehox section can choose JD-relevant proofs, but it must keep the regulated operating center, workflow breadth, and at least two concrete proofs.
5. A One Block Away section with POC and end-to-end wording but no named initiative fails.
6. A single-product One Block Away section fails without a measured page-pressure exception.
7. A section that maps one concise bullet to both ListingPal and WeReady can pass when the text genuinely names and proves both.
8. A Kinesso section that keeps design-system language but drops the team scale, product scale, and all named workflow proof fails.
9. An Omnicom section may use one bullet only when oncology/regulated healthcare, UX/account context, and cross-functional translation all survive.
10. A Heartbeat section that keeps research language but loses concrete UX outputs or build-ready handoff fails.
11. An Account Management section that becomes generic client leadership and loses pharma, budget scale, named account/brand/channel proof, or MLR delivery fails.
12. A Socure-style One Block Away section with operating center, end-to-end ownership, ListingPal, and WeReady passes as `compressed-but-intact`.
13. A Forma-style One Block Away section retaining all five lanes passes as `emphasis-only`.
14. Omitting Tunisia with a role-relevance reason passes without a compression exception.
15. A page-pressure exception fails unless the required-lane render exceeded two pages and its checksum matches the reviewed copy.
16. Even with a page-pressure exception, removing any role's operating center or all of its concrete proof fails.
17. Every role bullet must reference valid canonical lane IDs and target requirement IDs.
18. Changing bullet text invalidates both the breadth review and humanizer approval.
19. Contract revision 2 and 3 packages remain readable as legacy records and do not block v2 builds.
20. A failed breadth gate leaves no tailored HTML, PDF, route, screenshot, or manifest entry.
21. ATS, route QA, live verification, and ledger behavior remain unchanged after a successful breadth gate.

## Recommended decision

Approve the repair contract with one central rule:

> Tailoring may change emphasis, wording, order, and compression. It may not replace a job's operating center or erase the concrete proof that makes the job credible.

Apply that rule independently to Hedgehox, One Block Away, Kinesso, Omnicom, Heartbeat, and Account Management on every new or reused package. One Block Away remains the strongest current example, but it should not receive a special-only guardrail. Each role needs its own protected core and must pass the same canonical-to-tailored breadth review before the builder can replace its section.

The goal is not to freeze every canonical bullet. It is to make sure tailoring changes the emphasis of the whole resume without rewriting any job into a different, thinner experience.
