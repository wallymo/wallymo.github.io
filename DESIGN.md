# Wally homepage visual system

Approved direction: dark Work and dark Contact/footer, with warm bulbs throughout
at different strengths. This extends the existing Wally identity.

## Typography

Syne is the display family; Instrument Sans handles body copy, metadata, metrics,
and controls. Preserve the hero and closing display scale. Ordinary section headings
share a fluid 32px to 44.8px scale and 1.1 line-height, including Selected Work and
Chapters. Keep body copy at readable sizes rather than reducing type to fit motion.

## Layout

The narrative and section-heading rail is 1140px maximum, with shared responsive
gutters. Only project cards extend to a 1280px gallery rail. Preserve the hero's
established composition. Mobile gutters are 24px, reducing to 16px below 360px.
Use the compact navigation menu below 1120px, before desktop links begin to wrap.

The client logo strip stays static, with centered rows of six on desktop, four on tablet, and three on phones. Balance each existing mark by visible size and optical center; preserve the original artwork. Keep the shared monochrome tone at rest and reveal original brand colors on hover, without moving or resizing the marks. Kinesso uses its artwork's pink on hover so its white lettering stays visible on the light surface.

The chapter story sits inside a warm digital “Proof file” window with a straight title bar
showing the active chapter and dates. The section intro and chapter navigation stay outside.
Keep evidence rows separated by rules within the panel.
How I Build remains hidden in the revision; Chapters flows directly to Capabilities.
Capabilities use the approved Fields layout: four illustrated columns on desktop, two columns on tablet, and a single stack on mobile. Use the lowercase headings discover, design, build, and lead. Follow each heading with one short, semibold takeaway and a quieter supporting sentence. Keep the illustrations compact, all nine proof points, and one project link per capability. Emphasize meaningful proof figures; align desktop evidence and work links. Keep AI-assisted development explicit. Use one structural divider between fields; work links have no bottom rule. Recognition
is one ruled strip, with separate title/detail blocks and stacked mobile entries.
The heading leads directly into the awards. Hovering the Red Dot and either Indigo
link brings back the earlier concept's circular logo badge beside the pointer.
Track movement directly with a 4px gap and vertical centering; no trailing or
scale animation that changes the perceived distance. Flip sides only at an edge.
Keep native link behavior and keyboard focus; omit the decorative follower for
touch and reduced motion, and clear it on pointer exit, scrolling, or window blur.

## Color and surface roles

Use the existing warm paper, cream, ink, and clay palette from index.html. Dark
surfaces use shared --dark-* tokens in revision.css for the base, raised cards,
primary/secondary/muted text, borders, and accent states. Never add a new accent hue
to distinguish a section. Small light-surface accent text uses --accent-text;
primary button hover uses --accent-hover to meet normal-text contrast.

## Atmosphere

Hero retains the expressive animated clay/taupe bulbs. Other sections use static
radial gradients in their background layers, without tinting foreground content.
Use the same circular radius, clay/taupe pair, and 0/35/100 percent falloff as the
hero. The shared radius scales from 240px to 560px; each layer repeats over twice
its radius, with left/right bulbs offset by half a tile. This keeps long project
and chapter sections lit without clipping a bulb at a repeat boundary. Change
intensity by surface, never invent separate ellipse shapes or isolated edge washes.
Trust is quieter, reading sections retain visible round bulbs, and Work uses a
stronger field behind opaque cards. Contact and footer share both intensity and
aligned background phases so the warm light continues across their join.
Background layers do not create scroll containers or transform sticky ancestors.
The renderer stops when the hero is offscreen, the document is hidden, or reduced
motion is requested. Reduced motion/no JavaScript retain a static hero atmosphere.

## Components and motion

Controls and project cards use the existing 4px radius; project images use 12px.
The chapter window is the intentional container for career evidence. Keep other
open content unboxed; use rules and type to group it.
Maintain native project stacking at eligible desktop sizes, adaptive header spacing,
flat layouts when a complete card cannot fit, and correct final-card release.
Chapters retain desktop tabs, keyboard selected states, direct anchors, interrupted-transition
restoration, and a full scrolling sequence on compact screens or with reduced motion/no JavaScript. Reading
sections remain visible from first paint; do not hide their content behind entrance
fade observers or timers.

## Compatibility and review

Preserve all IDs, extraction hooks, route order, scoped links, and matched resume
destinations. New JD routes inherit the visual shell; existing packages are not
rebuilt. Review the whole page in Chrome and Safari and test repeated loads,
resizing, reduced motion, contrast, and three/four/five-project fixtures before
making a local revision commit. Publishing remains a separate decision.

## Project-page shell and future JD packages

All nine canonical `project-01.html` through `project-09.html` sources use
`assets/portfolio-revision/project-page-motion-v1.css` and its companion script.
Project 01 is the approved control. The other eight opt into `project-story-v1`
for their existing case-study content; do not force them into the pharma-specific
initiative map or Pharma OS story. Keep their original claims and evidence.

Use the homepage hero atmosphere renderer unchanged. The shared shell pairs a
Syne title and role summary with actual project imagery on a dark surface. Open
intro sections use a heading on the left and ruled evidence rows on the right;
stack these on mobile. Preserve the shared warm paper, clay, image radii, and
1140px reading rail. Long display titles use container-relative sizing so whole
words remain readable at narrow widths without a JavaScript text-fit dependency.

Project content uses the approved Editorial Handoff at 0.5 speed: media enters
with 12px of horizontal movement over 960ms; copy rises 6px over 720ms with
200ms, 340ms, and 480ms offsets. Fades finish in 400ms, and the complete handoff
finishes within 1200ms. Entries play once as content comes into view; media stays
in normal document flow with no sticky image columns. Native scrolling, the hero
entrance, and the existing bulb atmosphere remain unchanged. Lifecycle changes,
reduced motion, disabled JavaScript, and keyboard focus must retain fully visible
content. No extra preloaders, cursor effects, or scroll-jacking. The Pharma OS
loop remains specific to Project 01, with its existing pause, offscreen, and
reduced-motion handling.
Product images declare width, height, and matching `--media-ratio` metadata so
lazy loading reserves their actual space before the image arrives.

Preserve `main#project-content`, `.site-nav`, the exact `.project-number` div
hook on numbered canonical pages, and the outer `.next-project` div. Other
Highlights remains unnumbered on the public source, but receives a route-local
number inside its existing index row when included in a tailored selection.
The scoped renderer must retain the rich next-project preview and derive its
image, title, destination, and sequence from that package's selected projects.
All shared asset references, resume links, logo/back links, and in-body project
links must resolve inside the scoped package correctly, including project aliases.

Run `node --test scripts/tests/*.test.mjs` after changing the shell or renderer.
The rollout regression covers all nine sources plus reordered three-, four-, and
five-project selections, including unfeatured work. Existing employer packages
remain snapshots; do not rebuild them automatically. Commit workflow changes
before using them to generate a real JD package, and keep package artifact commits
separate. A local QA pass is not a pushed release, live verification, or submission.

## Chapter identity

The section introduction is a compact opening band on the 1140px content rail.
At desktop widths, the heading occupies one line with the three-sentence summary
on one line beneath it. Keep the existing type sizes; allow natural wrapping on
smaller screens. Bold only the summary sentence matching `data-active-chapter`,
so scroll, tabs, and keyboard navigation share the existing chapter state. Reserve
each sentence's bold width to prevent movement when emphasis changes.
Include the opening band in the sticky frame, so the intro, identity, navigation,
and entire Proof file remain together in one desktop viewport. Dock the stage at
the navigation's bottom edge and fill the remaining viewport height. Keep a 24px
reading inset inside its top edge, then use 24px frame padding and a 24px gap below
the intro where the complete composition fits. A second measured layout uses
12px frame padding and intro gap, 20px Proof file padding, and tighter evidence
spacing. A third spacing-only fit for short desktop windows uses 8px frame and
intro gaps with 16px Proof file padding. Font sizes and all evidence remain unchanged.
During desktop pinning, the active chapter identity sits left of the steady Proof file window:
96–112px Syne numbers, a quiet total, 40–44px two-line chapter names, and clay dates.
Names and dates derive from the existing period metadata; static HTML also contains
them for no-JavaScript reading. Exposed labels and focus use #803819, with #4E4742
for supporting text. The window retains its original cream and clay colors.

Connected navigation sits under the desktop identity. Completed circles fill, the
active circle has a ring, and the line fills through the active chapter. The active
circle also has a visible clay halo that breathes over 3.8 seconds, moving from
20% to 78% opacity and .9 to 1.5 scale with a soft glow. Keep the center dot steady;
do not pulse the line or labels. Reduced motion retains
the static ring and removes the halo. A chapter change moves the incoming identity
16px over 320ms with the existing ease; backward
navigation reverses direction. Evidence has a short reading-content transition,
while the window frame remains fixed. Cancel interrupted animation effects before
presenting the latest selected state.

Measure the entire frame, including the introduction, all identities, navigation,
and the tallest Proof file at widths of at least 1120px. Try normal spacing first,
then compact and short-desktop spacing. Measure against the actual sticky stage
below the fixed navigation; never scale text or clip evidence to pass the fit check.
Desktop width always enables the chapter transition. When the full composition is
taller than the viewport, keep the introduction in normal flow and pin the chapter
stage immediately after it; do not fall back to the static mobile sequence.
Start scroll progression when the stage docks below the navigation. Size the
journey to the full stage height plus chapter travel, not the shorter content
height. The following section must remain below the viewport throughout pinning;
after the last chapter, the whole stage moves out as the next section moves in
at their shared edge. Do not resize the stage during scrolling. Preserve the
selected chapter when switching layouts.
Below desktop width, show all three chapter blocks in a single column with 48px gaps,
64px numbers, and 32px names. Navigation becomes native anchor links; the active
indicator follows each chapter crossing the upper third of the usable viewport.
Reduced motion and no JavaScript retain this readable sequence.

Keep the parchment #F0EBE3 background steady. Bulbs use the shared circular field at
clay core/shoulder .22/.094 and taupe .18/.077, with no chapter-dependent changes.
For pinned desktop layouts, keep the field fixed to the viewport and clip it to
the Chapters section. Measure its settled position beside the number and window
once per layout, including the navigation and intro offsets. The light must stay
stationary during section entry, pinning, and release; do not attach it to the
moving content or add scroll-driven background transforms.
On compact screens, each chapter block owns the same field. Let the light extend
up behind the intro; clip decorative spill at the section boundary with overflow:
clip, which does not create a scrolling ancestor. A section clip-path also confines
the fixed desktop field. Keep desktop light below the whole section's content and
static fields below the shell content; never tint the cream Proof file or copy.
Chapter identity must remain unmistakable even with decorative backgrounds disabled.
Proof files remain clear of background icons.
