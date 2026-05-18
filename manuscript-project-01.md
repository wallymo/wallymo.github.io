# 01 — Pharma AI Platform

**Hedgehox · AI Implementation & Strategy Lead · 2024–Present**

I translate pharma agency problems into working AI tools: claims review, screenshot capture, scoping, brief intake, routing, and regulatory monitoring.

---

## My Role

### From client ask to working product.

- **Client translation** — Translate messy stakeholder requests into scoped product requirements.
- **UX validation** — Map review behavior, prototype the workflow, and test what reviewers actually need.
- **AI execution** — Build the interface, logic, and model workflow so the work survives handoff.

---

## Stats

| Stat | Value |
|------|-------|
| MLR review cycle | 3 wks → 4 days |
| Compliance domain | FDA / HIPAA |
| AI capability | Multimodal (text + image + video) |
| Scope | End-to-end (discovery to production) |

---

## Current Initiatives

### Six AI builds across the pharma workflow.

- **01 — Claims Detector — AI-Powered MLR Review Accelerator**
- **02 — Echo — AI-Assisted Screenshot Routes**
- **03 — Scope Generator — AI-Powered Scope & Resourcing Planner**
- **04 — BriefFlow — AI-Powered Brief Generator**
- **05 — Route Validator — AI-Powered Review Routing Checker**
- **06 — FDA Warning Tool — AI-Powered Regulatory Signal Monitor**

## Initiative Details

### Six initiatives. One operating system. Pharma OS.

From intake and scoping to capture, routing, claims review, and regulatory intelligence.

- **Claims Detector — AI-Powered MLR Review Accelerator** — Finds claims in pharma documents on its own, then pre-annotates submissions using a knowledge base, approved annotations, or prompt-defined criteria depending on the review need.

  - **Claim detection:** Identifies promotional claims without requiring every claim to be manually marked first, then separates likely supportable language from content that needs reviewer attention.
  - **Annotation source:** Can run against a structured claim knowledge base, previously approved annotations, newly approved references, or a pure prompt when the client needs a lighter setup.
  - **Submission prep:** Pre-populates annotations before MLR submission so teams start review with claims, evidence, and gaps already surfaced instead of rebuilding the trail manually.
  - **Stack:** React, Express, SQLite, PyMuPDF, Gemini, and interchangeable Gemini, Claude, and GPT backends on Vercel and Railway.

  **Walkthrough Demo Available On Request**

- **[Echo — AI-Assisted Screenshot Routes for Pharma Submissions](https://echo.hedgehox.com/)** — Uses AI-assisted route setup and browser automation to capture 100+ screenshots in under 5 minutes across desktop, tablet, and mobile for MLR submission review.

  - **Route logic:** Project-wide IF/THEN rules apply clicks, hovers, delays, and element repositioning across every page and viewport.
  - **Submission fit:** Handles sticky ISIs, trailing violators, dynamic content, page ordering, staging, and production environments per project.
  - **Impact:** Moved one pharma route from 8 hours to 10 minutes and helped cut a planned 5-day launch to 2 days.

- **Scope Generator — AI-Powered Scope & Resourcing Planner** — Turns project parameters into an AI-assisted, budget-ready scope with deliverables, timelines, role-level resourcing, and cost breakdowns.

  - **Audience:** Built for pharma agency finance and operations teams managing complex multi-channel work across regions and brands.
  - **Workflow:** Users configure rate cards by region, select brands and sub-brands, then manually build or AI-adjust scopes with natural language.
  - **Stack:** Next.js App Router, Gemini API, Vercel Blob storage, and a rate-card-driven costing engine with spreadsheet export.

- **BriefFlow — AI-Powered Brief Generator** — Turns loose client input into a structured brief, with AI-generated sections and missing-information flags before work starts.

  - **Intake:** Guided forms, uploaded docs, voice inputs, and conditional logic help clients answer the right questions up front.
  - **Approval:** Branded review links support comments, approval, sign-off, PDF export, and project-management integration paths.
  - **Problem fit:** Designed around poor inputs, endless revisions, and budget lost to rework in agency briefing workflows.

- **Route Validator — AI-Powered Review Routing Checker** — Uses AI-assisted rules to catch the wrong review path before work reaches the wrong stakeholder.

  - **Checks:** Validates routing logic against project type, content risk, regulatory needs, and approval requirements.
  - **Outcome:** Gives teams a cleaner handoff before review cycles turn into stalled approvals and late-stage surprises.
  - **Impact:** Cuts routing time by almost 2 full days by catching mismatched review paths earlier.

- **FDA Warning Tool — AI-Powered Regulatory Signal Monitor** — Uses AI to monitor FDA warning-letter patterns and turn regulatory precedent into usable guidance for pharma teams.

  - **Signals:** Helps teams scan emerging risk themes earlier instead of waiting for issues to surface manually.
  - **Review use:** Connects external regulatory precedent back to internal content decisions where a claim, phrase, or pattern may create risk.
  - **Credibility:** Gives agency teams a stronger client-facing position by showing they are tracking FDA news early and getting ahead of regulatory risk.

- **Pharma OS** *(In Development)* — The operational layer connecting these initiatives into a single AI-powered workflow.

---

## Where It's All Going

### Six initiatives. One operating system. Pharma OS.

Each AI initiative solves a real workflow problem now: brief intake, scope planning, screenshot capture, claims review, routing, and regulatory monitoring. Pharma OS connects those pieces into one operating layer from kickoff to approval.

The point is not a shelf of one-off tools. It is a shared system where decisions made upstream can carry through production, review, and compliance.
