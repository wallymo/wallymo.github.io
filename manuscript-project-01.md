# 03 — Enterprise Design System

**Kinesso (IPG) · Director, Experience & Innovation · 2020–2023**

Joined as the second design hire on IPG Data Visualization. Left three years later with a 30-person global UX/UI team, an award-winning design system & software, and a working process that scaled across 22 brands and 7,000+ daily users.

---

## Stats

| Stat | Value |
|------|-------|
| Daily active users | 7,000+ |
| Data managed | 12 terabytes |
| Queries per month | 3 million |
| White-label brands | 22 |
| Team scale | 2→30 |
| International awards | 7 |
| Remote Locations | 4 |

---

## The Challenge

No design function, no shared language, 22 brands doing their own thing. Every analytics product in the IPG portfolio was built separately: different patterns, different components, different visual logic. Built by developers, no research or roadmap to speak of. Users bouncing between tools felt like they'd switched companies.

## The Solution

A token-based design system built from scratch: 500 components, 140 styles, 300 custom icons, 50 research-derived personas. One codebase serving 22 brand identities without forking, supporting 12 terabytes of data and 3 million queries per month. Adopted across engineering teams, not just handed off to them. Built by a team of 4 (myself, 2 UI designers, and lead director)

### Awards — Indigo 2023

- Gold — UX Interface & Navigation
- Gold — Digital Tools & Utilities
- Gold — Graphic Design
- Silver — Interaction
- Silver — Interactive Design

### System Scale

| Metric | Count | Note |
|--------|-------|------|
| Components | 500 | all created from scratch |
| Styles | 140 | tokens & theming |
| Icons | 300 | custom iconography |
| Personas | 50 | research-driven |

---

## Key Challenges

### Engineering owned every product decision

30+ products, all built by developers making design calls. Not because they wanted to, but because there was no one else to make those decisions at the pace required to push work. Users paid for it. Usability was an afterthought, if it appeared at all. 

### 22 brands, zero shared patterns

Each product had grown independently. Getting them to use the same system meant winning buy-in from separate engineering teams, product owners, and clients. None of whom had asked for this. It became a challenge to explain the why, how, and when to each team.

### No user feedback in the existing system

The previous consistency attempt was built in a vacuum. Nobody had asked users what was broken. Real data showed navigation alone was costing people hours every week.

### The system had to outlast the project

A design system that needs a dedicated maintenance team is already failing. The goal was adoption so thorough that teams would contribute back, which meant governance and documentation had to be built in from the start, not bolted on later. Design had to be forward-trend setting — we couldn't build something for now. Had to be for now and later.

---

## Solutions Overview

### How we actually built it.

Four things drove our decisions. Not principles — specific choices that worked or didn't.

**Atomic structure**
Built from the smallest units up: atoms into molecules into organisms. This made 22-brand theming tractable — change a token, not 500 components. Engineers could use the system without waiting on design for every variation. White labeling became a breeze. 

**One shared language**
Shared components meant a button was a button everywhere. Sounds obvious. In practice, it required negotiating with engineering teams who'd built their own versions and didn't want to throw them out. The argument that won: consistency reduced their support burden, not just ours.

**Research before pixels**
We ran interviews before drawing anything. Found navigation was costing users real time every session. Found color customization was being done manually in PowerPoint after export. Both became features, not just design decisions. I conducted all user research and interviews across 22 branded teams.

**Documentation that teams actually used**
Most design system docs get written once, then ignored. We kept ours close to the engineering workflow — versioned, linked from tickets, updated when things changed. When teams started filing requests against it rather than building around it, we knew it was working.

---

## The Approach

### Build the team, then build the system. Not the other way around.

Most design system projects start by building components. I started by hiring people. Brought in the first UX researchers, the first interaction designers, the first people who knew how to think about visual systems. We understood what was broken before we drew anything.

Then we went through every product in the portfolio. Mapped out what patterns existed, where things overlapped, and built a token system that could handle 22 different brands without forking the whole codebase.

The system included governance, contribution models, and adoption playbooks. We worked directly with engineering teams to integrate it rather than just handing it off. For the first time, developers felt heard in a collaborative setting.

---

> "This wasn't a component library exercise. It was organizational transformation."
>
> — The framing that got stakeholder buy-in

---

## Research Impact

### What users actually told us — and what we built because of it.

While the UI team was building components, I ran interviews across product teams and end users. Six findings shaped the first release.

### System-Wide Navigation

**Research Finding:** Users saw the full product menu every time, but most only needed 3 or 4 tools. The rest was noise.

**Design Impact:** Navigation now shows only products each user can access. Users pin and reorder their tools. Nobody explained this with a tooltip — they just noticed things were easier.

### Global Color Picker

**Research Finding:** Users exported charts, then manually recolored them in PowerPoint to match client branding. A known workaround everyone had accepted as normal.

**Design Impact:** Built a global color picker into the platform with unique, proprietary color formulas — choose one color, our formula creates a whole palette. Users apply client colors to an entire data page in one step, save presets, and never open PowerPoint to fix a chart.

### Accessibility Standards

**Research Finding:** Accessibility issues showed up fast once we tested across brands, chart types, and real usage. The pattern was clear: use accessible color combinations, shades are more important than colors, and color shouldn't be the only indicator for interactive elements.

**Design Impact:** We pushed extensive UI testing across patterns, separation, labels, charts rendered as tables, and font sizes from 90%-110%. Accessibility stopped being a cleanup pass and became part of the system rules.

### Design Excellence

**Research Finding:** As the team grew and more people contributed designs, stakeholders asked how we'd know when something drifted from the system. Good question — we didn't have an answer.

**Design Impact:** Built the **Design Bot** — a Chrome extension that audits designs against system components and templates, then generates a report with specific flags and fixes. Compliance became checkable, not aspirational.

### Create Your Own Dashboard

**Research Finding:** Users wanted control over data display — not just what appeared, but how. The platform had one default view. That worked for nobody.

**Design Impact:** Built **Create Your Own Dashboard**. Users configure widgets as Bar Chart, Line Chart, Pie Chart, or Table, then tune Data Sets, Dimensions, and Measures to match the view they actually need. Profiles save those dashboards and configurations per client. Beta users got productivity shortcuts first — signal for what to make permanent.

### White Label Automation

**Research Finding:** Every new enterprise client wanted a branded platform version. The delivery process was manual, slow, and relied on designers who knew the system well enough to not break it.

**Design Impact:** Built the **White Label Automation Builder** — a tool that walks product leads and client teams through creating a custom-branded instance. The system applies tokens automatically. No designer needed.

---

## Growth Metrics

| Metric | Value |
|--------|-------|
| +68% | avg. users YoY |
| ~7k+ | avg. monthly users |
| +79% | avg. usage rate YoY |

---

## Scaling

### From 2 designers in New York to 30 across four remote locations.

The team grew from two designers to 30 people across New York, Chicago, Los Angeles, and Warsaw. I built the hiring process, defined career levels, set up design reviews, and created the operational rhythm.

Every hire was deliberate. We filled gaps in research, interaction design, visual systems, and accessibility. By year two, design had a voice in product decisions for the first time.

The real lesson: hire designers to shift how the organization thinks about product quality, not to fill open slots.

### Leadership responsibilities grew.

As the team grew, our leadership responsibilities grew. It wasn't just the four of us original members anymore. I took to heart growing the team not just in headcount but in capability. I sat with each designer for 1:1s every month to highlight their job growth and trajectory, whether at Kinesso or not. I never had a true mentor to guide me through my career. With a team of young talented designers, I felt obligated to give back the direction I never received.

**Growth timeline:**

| Year | Count | Note |
|------|-------|------|
| 2020 | 2 | New York. Starting from zero. |
| 2021 | 10 | Research, interaction, visual systems. Red Dot. |
| 2022 | 20 | US + Poland. 5 Indigo Awards. |
| 2023 | 30 | 4 countries. Design at the product table. |

---

## The Results

### What shipped, what stuck, what won.

- **7,000+ daily active users** — The entire IPG analytics portfolio on one system. Users moving between brands felt the same product, not 22 different ones.

- **22 white-label brands from one codebase** — Token-based theming meant each client got their brand without forking the repository.

- **3 Gold, 2 Silver — Indigo 2023** — UX Interface & Navigation, Digital Tools & Utilities, Graphic Design, Interaction, Interactive Design.

- **Red Dot Communication Design 2021** — The analytics platform's interface recognized internationally. First award the company had won for design.

- **30-person design practice built from nothing** — Hiring pipeline, career levels, review process, operational rhythm — all of it created in three years.

- **Engineering teams filing requests against the design system** — Not building around it. That's how you know it worked.

---

## Reflection

### What I'd tell someone doing this for the first time.

Building a design system is easy. Getting engineers to believe it's worth the investment is hard. That meant showing up to every sprint, every architecture call, every planning session, whether design was supposed to be there or not.

The system succeeded because adoption was easier than the alternative. We didn't mandate it — we made the default path the best one.

If I did it again, I'd push harder on contribution models earlier. The system worked best when teams owned their components, not when they were just using ours.

The awards were nice. But the real win: watching engineering teams file feature requests against the design system instead of building their own patterns. That's how you know it's working.
