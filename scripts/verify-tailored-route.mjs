#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const args = process.argv.slice(2);

function usage() {
  console.error(
    'Usage: node scripts/verify-tailored-route.mjs <route-slug> <resume-html-path> <resume-pdf-path>'
  );
  console.error(
    'Example: node scripts/verify-tailored-route.mjs yotta-labs output/pdf/wally-mostafa-yotta-labs-ai-systems-research-engineer-resume.html output/pdf/Wally-Mostafa-Yotta-Labs-AI-Systems-Research-Engineer-Resume.pdf'
  );
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function runPublicCopyAudit() {
  try {
    execFileSync(process.execPath, ['scripts/audit-public-copy.mjs'], {
      stdio: 'inherit',
    });
  } catch {
    fail('Visible public-copy audit failed');
  }
}

function normalizeRouteSlug(slug) {
  return slug.replace(/^\/+|\/+$/g, '');
}

function stripHashAndQuery(url) {
  return url.split('#')[0].split('?')[0];
}

function extractLocalRefs(html) {
  const refs = [];
  const attrPattern = /\b(?:href|src)="([^"]+)"/g;
  let match;
  while ((match = attrPattern.exec(html))) {
    refs.push(match[1]);
  }
  return refs;
}

function assertRoleRouteNavigation(routeSlug, routeIndexPath, resumeHtmlPath) {
  const routeHtml = readFileSync(routeIndexPath, 'utf8');
  const routeRefs = extractLocalRefs(routeHtml);
  const localProjectPages = new Set(
    routeRefs
      .map(stripHashAndQuery)
      .filter((ref) => /^project-\d+\.html$/.test(ref))
  );

  const publicProjectRefs = routeRefs.filter((ref) =>
    /^\.\.\/project-\d+\.html(?:[#?].*)?$/.test(ref)
  );

  if (publicProjectRefs.length) {
    fail(
      `Route links to public project pages instead of scoped route pages:\n${[
        ...new Set(publicProjectRefs),
      ].join('\n')}`
    );
  }

  if (routeHtml.includes('class="work-item') && !localProjectPages.size) {
    fail('Route has featured project cards but no scoped project page links');
  }

  const projectPaths = [...localProjectPages].map((page) =>
    path.join(routeSlug, page)
  );

  for (const projectPath of projectPaths) {
    if (!existsSync(projectPath)) {
      fail(`Missing scoped project page: ${projectPath}`);
      continue;
    }

    const projectHtml = readFileSync(projectPath, 'utf8');
    const projectRefs = extractLocalRefs(projectHtml);
    const missingLocalAssets = projectRefs.filter((ref) =>
      /^(assets\/|favicon\.ico|apple-touch-icon\.png|site\.webmanifest)/.test(ref)
    );
    const publicProjectLinks = projectRefs.filter((ref) =>
      /^\.\.\/project-\d+\.html(?:[#?].*)?$/.test(ref)
    );
    const outOfBatchProjectLinks = projectRefs
      .map(stripHashAndQuery)
      .filter((ref) => /^project-\d+\.html$/.test(ref))
      .filter((ref) => !localProjectPages.has(ref));

    if (missingLocalAssets.length) {
      fail(
        `${projectPath} has root-relative local assets that will break inside ${routeSlug}:\n${[
          ...new Set(missingLocalAssets),
        ].join('\n')}`
      );
    }

    if (publicProjectLinks.length) {
      fail(
        `${projectPath} links back to public project pages:\n${[
          ...new Set(publicProjectLinks),
        ].join('\n')}`
      );
    }

    if (outOfBatchProjectLinks.length) {
      fail(
        `${projectPath} links to project pages outside the scoped batch:\n${[
          ...new Set(outOfBatchProjectLinks),
        ].join('\n')}`
      );
    }

    if (!/href="index\.html"\s+class="name"/.test(projectHtml)) {
      fail(`${projectPath} logo link does not return to ${routeSlug}/index.html`);
    }

    if (!projectHtml.includes('href="index.html#work"')) {
      fail(`${projectPath} back link does not return to ${routeSlug}/index.html#work`);
    }

    if (!projectHtml.includes(`href="../${resumeHtmlPath}"`)) {
      fail(`${projectPath} resume link does not point to ../${resumeHtmlPath}`);
    }

    if (projectHtml.includes('href="resume.html"')) {
      fail(`${projectPath} still links to the public resume`);
    }
  }

  return projectPaths;
}

async function assertLive200(label, url) {
  const cacheBusted = `${url}${url.includes('?') ? '&' : '?'}verify=${Date.now()}`;
  const response = await fetch(cacheBusted, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (response.status !== 200) {
    fail(`${label} returned ${response.status}: ${url}`);
  } else {
    console.log(`OK live ${label}: ${url}`);
  }
}

if (args.length !== 3) {
  usage();
  process.exit(2);
}

const [rawSlug, resumeHtmlPath, resumePdfPath] = args;
const routeSlug = normalizeRouteSlug(rawSlug);
const routeIndexPath = path.join(routeSlug, 'index.html');
const roleProjectPaths = existsSync(routeIndexPath)
  ? assertRoleRouteNavigation(routeSlug, routeIndexPath, resumeHtmlPath)
  : [];
const scopedPaths = [routeIndexPath, ...roleProjectPaths, resumeHtmlPath, resumePdfPath];

for (const filePath of scopedPaths) {
  if (!existsSync(filePath)) {
    fail(`Missing file: ${filePath}`);
  }
}

const routeHtml = readFileSync(routeIndexPath, 'utf8');
const resumeHtml = readFileSync(resumeHtmlPath, 'utf8');
const publicBase = 'https://wallymo.github.io/';
const liveRouteUrl = `${publicBase}${routeSlug}/`;
const liveResumeHtmlUrl = `${publicBase}${resumeHtmlPath}`;
const liveResumePdfUrl = `${publicBase}${resumePdfPath}`;

if (!resumeHtml.includes(`href="${liveRouteUrl}"`)) {
  fail(`Resume Portfolio link does not point to ${liveRouteUrl}`);
}

if (!routeHtml.includes(`href="../${resumeHtmlPath}"`)) {
  fail(`Route Resume link does not point to ../${resumeHtmlPath}`);
}

if (!routeHtml.includes(`href="../${resumePdfPath}"`)) {
  fail(`Route Download Resume link does not point to ../${resumePdfPath}`);
}

runPublicCopyAudit();

const status = git(['status', '--short', '--', ...scopedPaths]);
if (status) {
  fail(`Scoped files are not committed cleanly:\n${status}`);
} else {
  console.log('OK scoped files are committed cleanly');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

await assertLive200('route', liveRouteUrl);
for (const projectPath of roleProjectPaths) {
  await assertLive200(`project ${path.basename(projectPath)}`, `${publicBase}${projectPath}`);
}
await assertLive200('resume HTML', liveResumeHtmlUrl);
await assertLive200('resume PDF', liveResumePdfUrl);

if (!process.exitCode) {
  console.log('OK tailored route is publish-ready');
}
