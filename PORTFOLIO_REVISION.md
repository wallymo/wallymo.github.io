# Wally portfolio revision

Local revision on `codex/wally-portfolio-revision`, based on published commit
`2ecb30cec398c8752ee3d3d2ea0ded3308009f5c`. Publishing is a separate decision.

## What changed

- The published hero, Syne headings, Instrument Sans body, and warm palette remain.
- Four homepage previews use B4's image-and-copy composition: Pharma AI Platform,
  Whitelabel Builder, The POC Guy, and Splash Design System.
- Three career chapters follow Work and precede How I Build. The old Experience
  section is removed, and `#arc` resolves to `#chapters`.
- Chapter copy was checked against the approved resume foundation and case studies,
  then passed through the humanizer review. It distinguishes 2023 founder work from
  the 2024 Hedgehox role, says 7,000+ users without a frequency claim, and uses named
  award recognition without a disputed aggregate.
- The mobile navigation closes after selecting Chapters, supports Escape, and
  exposes its expanded state to assistive technology.

## How selection and motion work

`selectedProjects` remains the authority for each JD's selection and order.
The homepage's four projects are a preview, not a new JD default. The established
three/four/explicit-five selection rules and complete project library remain.

New package configurations explicitly use `route.showcaseSections: ["chapters"]`.
Omitted settings in older configurations keep their prior behavior. Chapter text
and accessible labels participate in humanizer approval and stale-copy detection.
Card extraction, fallback cards, aliased filenames, scoped numbering, previous/next
links, matched resume destinations, and optional statistics are retained.

The project stack measures the selected cards after fonts load. At widths of at
least 1120px it stacks only if the tallest card fits below the fixed navigation and
all preceding card headers. Heights are equalized without shrinking type so mixed
selections leave the stack together. Smaller viewports use flat cards.

Chapters use native sticky positioning with scroll-driven state changes when the
whole panel fits. Otherwise, they use unpinned tabs. Arrow keys, Home, and End change
tabs immediately. Interrupted animations restore every text element. Reduced motion
and no JavaScript show all three chapters as a static sequence.

Presentation lives in `assets/portfolio-revision/revision.css` and `revision.js`.
All nine selectable projects have optimized WebP thumbnails registered in
`scripts/lib/project-card-media.mjs`. The two vendor scripts preserve B4's GSAP
3.12.5 version; no B4 font, palette, logo, or theme-query navigation was imported.

## Verification

- 51 workflow tests passed against the revised homepage, including full temporary
  package builds, chapter-copy approval, old selective-section configurations,
  reordered three/four/five selections, aliases, and fallback imagery.
- Temporary JD fixtures checked 247 local references, including every thumbnail,
  scoped case destination, previous/next sequence, and resume link.
- Browser checks covered desktop, short laptop, tablet, and phones down to 320px;
  complete-card fit; keyboard tabs; forward/backward scroll; interrupted transitions;
  responsive changes; reduced motion; no JavaScript; and the legacy anchor.
- Independent interaction review confirmed the stack and chapter restoration fixes.
- Checksums confirmed 20 original-checkout source files were unchanged. All 566
  protected revision files checked against the baseline were unchanged, including
  employer pages/configurations, resumes, the package manifest, and canonical cases.

Workflow infrastructure was committed separately as `e3c7906` before rendering the
revision fixtures. QA fixtures and diagnostic images stay ignored under `tmp/qa/`.
No existing employer package was rebuilt, and nothing was pushed or deployed.
