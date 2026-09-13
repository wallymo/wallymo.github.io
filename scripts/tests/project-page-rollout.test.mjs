import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildScopedProjectHtml,
  buildWorkGrid,
} from '../build-tailored-package.mjs';
import {
  escapeHtml,
  getArtifactPaths,
  scopedProjectFilename,
} from '../lib/workflow-v2.mjs';
import { PROJECT_CARD_MEDIA } from '../lib/project-card-media.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const canonicalProjects = [
  'project-01.html',
  'project-02.html',
  'project-03.html',
  'project-04.html',
  'project-05.html',
  'project-06.html',
  'project-07.html',
  'project-08.html',
  'project-09.html',
];
const canonicalNumbers = new Map([
  ['project-01.html', '01'],
  ['project-08.html', '02'],
  ['project-02.html', '03'],
  ['project-03.html', '04'],
  ['project-09.html', '05'],
  ['project-04.html', '06'],
  ['project-05.html', '07'],
  ['project-06.html', '08'],
]);
const sharedAssetBases = [
  ['href', 'assets/portfolio-revision/project-page-motion-v1.css'],
  ['src', 'assets/portfolio-revision/project-page-motion-v1.js'],
  ['src', 'assets/portfolio-revision/hero-atmosphere.js'],
];

function readProject(root, project) {
  return readFileSync(path.join(root, project), 'utf8');
}

function classNames(openingTag) {
  return new Set(openingTag.match(/\bclass="([^"]*)"/)?.[1].split(/\s+/) || []);
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sharedAssetUrls(referenceHtml) {
  return sharedAssetBases.map(([attribute, asset]) => {
    const url = referenceHtml.match(
      new RegExp(`${attribute}="(${escapePattern(asset)}(?:\\?[^\"]*)?)"`)
    )?.[1];
    assert.ok(url, `project-01.html must load ${asset}`);
    return [attribute, url];
  });
}

function projectTitle(html, project) {
  const titleHtml = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  assert.ok(titleHtml, `${project} must have an h1`);
  return titleHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&middot;/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeProjectFixture() {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'project-page-rollout-'));
  for (const project of canonicalProjects) {
    cpSync(path.join(repoRoot, project), path.join(tempRoot, project));
  }
  return tempRoot;
}

function withRepoRoot(tempRoot, callback) {
  const previousRepoRoot = process.env.WORKFLOW_REPO_ROOT;
  process.env.WORKFLOW_REPO_ROOT = tempRoot;
  try {
    return callback();
  } finally {
    if (previousRepoRoot === undefined) {
      delete process.env.WORKFLOW_REPO_ROOT;
    } else {
      process.env.WORKFLOW_REPO_ROOT = previousRepoRoot;
    }
  }
}

function scopedConfig(selectedProjects, suffix) {
  return {
    slug: `project-page-${suffix}`,
    artifactStem: `Project-Page-${suffix}`,
    routeMode: 'scoped-projects',
    selectedProjects,
    route: {
      projectAliases: {
        'project-09.html': 'project-10.html',
      },
    },
  };
}

function nextProjectBlock(html) {
  const start = html.lastIndexOf('<!-- NEXT -->');
  assert.notEqual(start, -1, 'scoped page must retain the next-project marker');
  const mainEnd = html.indexOf('</main>', start);
  const bodyEnd = html.indexOf('</body>', start);
  const end = mainEnd === -1 ? bodyEnd : mainEnd;
  assert.notEqual(end, -1, 'scoped page must close after next-project');
  return html.slice(start, end);
}

test('all nine canonical project sources use the shared project-story shell and asset catalogue', () => {
  const referenceAssets = sharedAssetUrls(
    readProject(repoRoot, 'project-01.html')
  );
  assert.deepEqual(
    Object.keys(PROJECT_CARD_MEDIA).sort(),
    canonicalProjects.map((project) => project.replace(/\.html$/, '')).sort()
  );

  for (const project of canonicalProjects) {
    const html = readProject(repoRoot, project);
    const htmlTag = html.match(/<html\b[^>]*>/i)?.[0];
    assert.ok(htmlTag, `${project} must have an html element`);
    const rootClasses = classNames(htmlTag);
    assert.ok(rootClasses.has('project-motion-v1'), `${project} needs project-motion-v1`);
    if (project !== 'project-01.html') {
      assert.ok(rootClasses.has('project-story-v1'), `${project} needs project-story-v1`);
    }

    assert.equal(
      (html.match(/<main\b[^>]*\bid="project-content"[^>]*>/g) || []).length,
      1,
      `${project} must expose one project-content main`
    );
    assert.equal(
      (html.match(/<nav\b(?=[^>]*\bclass="[^"]*\bsite-nav\b[^"]*")[^>]*>/g) || []).length,
      1,
      `${project} must use the shared site-nav hook`
    );
    const numberHooks = html.match(/<div class="project-number">[^<]+<\/div>/g) || [];
    if (project === 'project-07.html') {
      assert.equal(
        numberHooks.length,
        0,
        'project-07.html intentionally uses its Highlights eyebrow instead of a canonical number'
      );
      assert.match(html, /<span class="project-index-label">Highlights<\/span>/);
    } else {
      assert.equal(
        numberHooks.length,
        1,
        `${project} must preserve the exact project-number div hook`
      );
      assert.ok(
        html.includes(
          `<div class="project-number">${canonicalNumbers.get(project)}</div>`
        ),
        `${project} must retain its canonical project number`
      );
    }
    assert.equal(
      (html.match(/<div class="next-project">/g) || []).length,
      1,
      `${project} must preserve the exact next-project div hook`
    );
    assert.match(
      html,
      /<div class="project-hero hero">/,
      `${project} must opt into the shared hero atmosphere`
    );
    const canvasTag = html.match(
      /<canvas\b(?=[^>]*\bclass="[^"]*\bhero-canvas\b[^"]*")[^>]*><\/canvas>/i
    )?.[0];
    assert.ok(canvasTag, `${project} must keep the hero canvas`);
    assert.match(canvasTag, /\bid="hero-canvas"/);
    assert.match(canvasTag, /\baria-hidden="true"/);
    assert.match(canvasTag, /\bdata-state="fallback"/);
    assert.match(
      html,
      /<a\b[^>]*class="next-project-preview"[^>]*>/,
      `${project} must use the richer next-project preview`
    );

    for (const [attribute, asset] of referenceAssets) {
      assert.equal(
        (html.match(new RegExp(`${attribute}="${escapePattern(asset)}"`, 'g')) || []).length,
        1,
        `${project} must load ${asset} once with a root-relative source path`
      );
    }

    const media = PROJECT_CARD_MEDIA[project.replace(/\.html$/, '')];
    assert.ok(media, `${project} must have registered card media`);
    assert.ok(
      existsSync(path.join(repoRoot, media.src)),
      `${project} registered media must exist: ${media.src}`
    );
    assert.doesNotMatch(
      html,
      /if \(params\.get\('from'\) !== 'varonis'\) return;/,
      `${project} must not retain the legacy query-route shim`
    );
  }
});

test('reordered three, four, and five project routes render route-local rich previews, including hidden 09 and 07', () => {
  const tempRoot = makeProjectFixture();
  try {
    withRepoRoot(tempRoot, () => {
      const referenceAssets = sharedAssetUrls(
        readProject(tempRoot, 'project-01.html')
      );
      const titles = new Map(
        canonicalProjects.map((project) => [
          project,
          projectTitle(readProject(tempRoot, project), project),
        ])
      );
      const selections = [
        ['project-09.html', 'project-07.html', 'project-01.html'],
        ['project-05.html', 'project-09.html', 'project-03.html', 'project-07.html'],
        [
          'project-07.html',
          'project-02.html',
          'project-09.html',
          'project-08.html',
          'project-04.html',
        ],
      ];

      for (const selectedProjects of selections) {
        const config = scopedConfig(selectedProjects, String(selectedProjects.length));
        const paths = getArtifactPaths(config);
        for (const [index, project] of selectedProjects.entries()) {
          const previousProject =
            selectedProjects[(index - 1 + selectedProjects.length) % selectedProjects.length];
          const nextProject = selectedProjects[(index + 1) % selectedProjects.length];
          const previousHref = scopedProjectFilename(config, previousProject);
          const nextHref = scopedProjectFilename(config, nextProject);
          const nextTitle = titles.get(nextProject);
          const media = PROJECT_CARD_MEDIA[nextProject.replace(/\.html$/, '')];
          const scoped = buildScopedProjectHtml(
            project,
            config,
            paths,
            index,
            titles
          );
          const nextBlock = nextProjectBlock(scoped);

          assert.ok(
            scoped.includes(
              `<div class="project-number">${String(index + 1).padStart(
                2,
                '0'
              )}</div>`
            ),
            `${project} must use its route-local number`
          );
          if (project === 'project-07.html') {
            const heroCardIndex = scoped.indexOf('class="project-hero-card"');
            const projectIndex = scoped.indexOf('class="project-index"');
            const numberIndex = scoped.indexOf(
              `<div class="project-number">${String(index + 1).padStart(
                2,
                '0'
              )}</div>`
            );
            const titleIndex = scoped.indexOf('<h1', projectIndex);
            assert.ok(heroCardIndex < projectIndex);
            assert.ok(projectIndex < numberIndex);
            assert.ok(numberIndex < titleIndex);
            assert.match(
              scoped.slice(projectIndex, titleIndex),
              /<span class="project-index-label">Highlights<\/span>/
            );
          }
          assert.ok(
            nextBlock.includes(
              `<a class="next-project-preview" href="${escapeHtml(nextHref)}">`
            ),
            `${project} preview must target ${nextHref}`
          );
          assert.ok(
            nextBlock.includes(`<strong>${escapeHtml(nextTitle)}</strong>`),
            `${project} preview must name ${nextTitle}`
          );
          assert.ok(
            nextBlock.includes(`src="../${escapeHtml(media.src)}"`),
            `${project} preview must use ${nextProject} media`
          );
          assert.ok(nextBlock.includes(`alt="${escapeHtml(media.alt)}"`));
          assert.ok(nextBlock.includes(`width="${media.width}"`));
          assert.ok(nextBlock.includes(`height="${media.height}"`));
          assert.ok(
            nextBlock.includes(`href="${escapeHtml(previousHref)}"`),
            `${project} must link back to ${previousHref}`
          );
          assert.equal(
            (nextBlock.match(/class="next-project-preview"/g) || []).length,
            1,
            `${project} must render exactly one rich preview`
          );

          for (const [attribute, asset] of referenceAssets) {
            assert.ok(
              scoped.includes(`${attribute}="../${asset}"`),
              `${project} scoped page must load ../${asset}`
            );
          }
          assert.doesNotMatch(
            scoped,
            /(?:href|src)="assets\/portfolio-revision\/(?:project-page-motion-v1|hero-atmosphere)/,
            `${project} scoped shared assets must be parent-relative`
          );
        }
      }
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('hidden project fallback cards read titles from attributed project-story headings', () => {
  const tempRoot = makeProjectFixture();
  try {
    withRepoRoot(tempRoot, () => {
      const indexShell = [
        '<a class="work-item" href="project-01.html">',
        '  <div class="work-meta"><div class="work-number">01</div><h3>Pharma AI Platform</h3><div class="role">Role</div></div>',
        '  <div class="work-body"><p>Summary</p></div>',
        '</a>',
      ].join('\n');
      const config = scopedConfig(
        ['project-01.html', 'project-09.html', 'project-07.html'],
        'fallback'
      );
      const workGrid = buildWorkGrid(indexShell, config);
      const renderedTitles = [...workGrid.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(
        (match) => match[1].replace(/<[^>]+>/g, '').trim()
      );
      assert.deepEqual(renderedTitles, [
        'Pharma AI Platform',
        projectTitle(readProject(tempRoot, 'project-09.html'), 'project-09.html'),
        projectTitle(readProject(tempRoot, 'project-07.html'), 'project-07.html'),
      ]);
      assert.doesNotMatch(workGrid, /<h3>project-(?:07|09)<\/h3>/);
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('legacy project sources keep the compact route-local previous and next navigation', () => {
  const tempRoot = makeProjectFixture();
  try {
    const legacySource = `<!doctype html>
<html lang="en">
<head><meta property="og:url" content="https://wallymo.github.io/project-01.html"></head>
<body>
<nav><a href="index.html" class="name">Wally</a><a href="index.html#work">All work</a><a href="resume.html">Resume</a></nav>
<div class="project-hero"><div class="project-number">01</div><h1>Legacy project</h1></div>
<!-- NEXT -->
<div class="next-project"><div class="nav-projects"><a href="project-02.html">Next</a></div></div>
</body>
</html>`;
    writeFileSync(path.join(tempRoot, 'project-01.html'), legacySource);
    withRepoRoot(tempRoot, () => {
      const selectedProjects = ['project-01.html', 'project-02.html'];
      const config = scopedConfig(selectedProjects, 'legacy');
      const scoped = buildScopedProjectHtml(
        'project-01.html',
        config,
        getArtifactPaths(config),
        0,
        new Map([
          ['project-01.html', 'Legacy project'],
          ['project-02.html', 'The POC Guy'],
        ])
      );
      const nextBlock = nextProjectBlock(scoped);
      assert.doesNotMatch(nextBlock, /next-project-preview/);
      assert.equal((nextBlock.match(/class="nav-projects"/g) || []).length, 1);
      assert.ok(nextBlock.includes('href="project-02.html"'));
    });
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
