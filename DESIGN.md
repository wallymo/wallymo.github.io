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

The chapter story sits inside a warm digital “Proof file” window with a straight title bar
showing the active chapter and dates. The section intro and chapter navigation stay outside.
Keep evidence rows separated by rules within the panel.
How I Build remains hidden in the revision; Chapters flows directly to Capabilities.
Capabilities keep the open two-column structure and first-person verbs. Recognition
is one ruled strip, with separate title/detail blocks and stacked mobile entries.

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

## Chapter identity

The section heading and introduction sit above the chapter journey. During desktop
pinning, the active chapter identity sits left of the steady Proof file window:
96–112px Syne numbers, a quiet total, 40–44px two-line chapter names, and clay dates.
Names and dates derive from the existing period metadata; static HTML also contains
them for no-JavaScript reading. Exposed labels and focus use #803819, with #4E4742
for supporting text. The window retains its original cream and clay colors.

Connected navigation sits under the desktop identity. Completed circles fill, the
active circle has a ring, and the line fills through the active chapter. A chapter
change moves the incoming identity 16px over 320ms with the existing ease; backward
navigation reverses direction. Evidence has a short reading-content transition,
while the window frame remains fixed. Cancel interrupted animation effects before
presenting the latest selected state.

Measure all identities, the navigation, and the tallest Proof file before enabling
pinning at widths of at least 1120px. Start scroll progression at the journey frame,
not the introductory heading. Preserve the selected chapter when switching layouts.
If the complete arrangement cannot fit, show all three chapter blocks in a single
column with 48px gaps, 64px numbers, and 32px names. Navigation becomes native anchor
links; the active indicator follows each chapter crossing the upper third of the
usable viewport. Reduced motion and no JavaScript retain this readable sequence.

Keep the parchment #F0EBE3 background steady. Bulbs use the shared circular field at
clay core/shoulder .10/.043 and taupe .08/.035, with no chapter-dependent changes.
Chapter identity must remain unmistakable even with decorative backgrounds disabled.
Proof files remain clear of background icons.
