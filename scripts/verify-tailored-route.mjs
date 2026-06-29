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

function normalizeRouteSlug(slug) {
  return slug.replace(/^\/+|\/+$/g, '');
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
const scopedPaths = [routeIndexPath, resumeHtmlPath, resumePdfPath];

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
await assertLive200('resume HTML', liveResumeHtmlUrl);
await assertLive200('resume PDF', liveResumePdfUrl);

if (!process.exitCode) {
  console.log('OK tailored route is publish-ready');
}
