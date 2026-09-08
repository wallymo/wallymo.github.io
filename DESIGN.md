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

The chapter evidence is open: no outer panel box, with rules separating the facts.
How I Build emphasizes the numbered process; tools remain quiet supporting groups.
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
Do not introduce boxes around open content. Use rules and type to group evidence.
Maintain native project stacking at eligible desktop sizes, adaptive header spacing,
flat layouts when a complete card cannot fit, and correct final-card release.
Chapters retain tabs, keyboard selected states, direct anchors, interrupted-transition
restoration, and a static full sequence for reduced motion/no JavaScript. Reading
sections remain visible from first paint; do not hide their content behind entrance
fade observers or timers.

## Compatibility and review

Preserve all IDs, extraction hooks, route order, scoped links, and matched resume
destinations. New JD routes inherit the visual shell; existing packages are not
rebuilt. Review the whole page in Chrome and Safari and test repeated loads,
resizing, reduced motion, contrast, and three/four/five-project fixtures before
making a local revision commit. Publishing remains a separate decision.
