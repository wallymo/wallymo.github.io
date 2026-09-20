# Portfolio concepts

The portfolio has two named visual concepts. They share the same content and
proof architecture; the distinction is presentation.

## Editorial Proof

- Role: control and current public portfolio
- Public route: <https://wallymo.github.io/>
- Stable ID for tailored-package configs: `editorial-proof`
- Preserved source: Git tag `portfolio-concept/editorial-proof-v1`
- Preserved commit: `ddc69d9a01d5bb7a4e949bd23cdf384b7e79ddd7`

The tag captures the entire repository state that was independently verified
as live on September 19, 2026. Restore or branch from that tag to revive this
exact version even if the public homepage changes later.

## Proof Grid

- Role: challenger
- Public root: <https://wallymostafa.github.io/>
- Publish repository: `wallymostafa/wallymostafa.github.io`
- Legacy preview routes: <https://wallymo.github.io/proof-grid/> and <https://wallymo.github.io/concepts/proof-grid/>
- Stable ID for tailored-package configs: `proof-grid`
- Preserved source: Git tag `portfolio-concept/proof-grid-v1`
- Source: `concepts/proof-grid/`

The public concept wrapper skins the canonical homepage, resume, and nine case
studies without altering those source pages. Tailored JD packages do not use
the wrapper: the package builder stamps the selected concept directly into the
generated route and its scoped case studies, then snapshots the concept CSS
inside that package.

## JD workflow

Set `route.designConcept` to `editorial-proof` or `proof-grid`. A tailored
resume still contains one Portfolio link, and that link points to the generated
role route on the selected concept's public root. Editorial Proof packages
publish to `wallymo/wallymo.github.io`; Proof Grid packages publish to
`wallymostafa/wallymostafa.github.io`. If both designs are tested against the
same JD, build two separately named packages so each PDF has its own route.
