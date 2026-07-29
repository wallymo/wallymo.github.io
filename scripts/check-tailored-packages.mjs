#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import {
  PUBLIC_BASE,
  WORKFLOW_VERSION,
  assertRecruiterFacingClaimsSupported,
  assertValidV2Config,
  configInputSha256,
  getArtifactPaths,
  hasCoverLetterArtifact,
  isMain,
  readManifest,
  readJson,
  relativeRepoPath,
  resolveRepoPath,
  sha256File,
} from './lib/workflow-v2.mjs';
import {
  COVER_LETTER_TEMPLATE_VERSION,
} from './lib/cover-letter-template.mjs';

function usage() {
  console.error(
    'Usage: node scripts/check-tailored-packages.mjs [--all|<route-slug>] [--include-legacy]'
  );
}

function parseArgs(args) {
  const parsed = { includeLegacy: false, slug: null };
  for (const arg of args) {
    if (arg === '--include-legacy') {
      parsed.includeLegacy = true;
    } else if (arg === '--all') {
      parsed.slug = null;
    } else if (arg === '--help') {
      usage();
      process.exit(0);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    } else if (parsed.slug) {
      throw new Error('Only one route slug can be checked at a time');
    } else {
      parsed.slug = arg.replace(/^\/+|\/+$/g, '');
    }
  }
  return parsed;
}

function gitStatus(paths) {
  return execFileSync('git', ['status', '--short', '--', ...paths], {
    cwd: resolveRepoPath('.'),
    encoding: 'utf8',
  }).trim();
}

function extractWorkLinks(html) {
  return [
    ...html.matchAll(
      /<a\b(?=[^>]*\bclass="[^"]*\bwork-item\b[^"]*")[^>]*\bhref="([^"]+)"/g
    ),
  ].map((match) => match[1].split(/[?#]/)[0]);
}

function extractWorkCardNumbers(html) {
  const numbers = new Map();
  const pattern =
    /<a\b(?=[^>]*\bclass="[^"]*\bwork-item\b[^"]*")[^>]*\bhref="(project-\d+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = pattern.exec(html))) {
    const numberMatch = match[2].match(
      /class="work-number"\s*>\s*([^<]+?)\s*<\/div>/
    );
    if (numberMatch) {
      numbers.set(match[1], numberMatch[1].trim());
    }
  }
  return numbers;
}

function sameList(actual, expected) {
  return (
    actual.length === expected.length &&
    actual.every((item, index) => item === expected[index])
  );
}

function collectScopedPaths(config, paths) {
  return [
    paths.routeIndexPath,
    paths.resumePdfPath,
    ...(hasCoverLetterArtifact(config)
      ? [paths.coverLetterPdfPath, paths.coverLetterMarkdownPath]
      : []),
    config.__configRelativePath,
    'scripts/tailored-packages.json',
    ...(config.routeMode === 'scoped-projects'
      ? config.selectedProjects.map((project) => `${paths.slug}/${project}`)
      : []),
  ];
}

function existingScopedProjects(paths) {
  const routeDirectory = resolveRepoPath(paths.slug);
  if (!existsSync(routeDirectory) || !statSync(routeDirectory).isDirectory()) {
    return [];
  }
  return readdirSync(routeDirectory)
    .filter((entry) => /^project-\d+\.html$/.test(entry))
    .sort();
}

function validateLiveVerification(
  pkg,
  config,
  paths,
  failures,
  publicBase
) {
  const verification = pkg.verification;
  if (!verification || typeof verification !== 'object') {
    failures.push(`${pkg.slug} live-verified package is missing verification metadata`);
    return;
  }
  if (
    !verification.verifiedAt ||
    Number.isNaN(Date.parse(verification.verifiedAt))
  ) {
    failures.push(`${pkg.slug} verification timestamp is missing or invalid`);
  }
  const requiredVerificationFields = ['routeUrl', 'resumePdfUrl', 'configUrl'];
  if (hasCoverLetterArtifact(config)) {
    requiredVerificationFields.push(
      'coverLetterPdfUrl',
      'coverLetterMarkdownUrl'
    );
  }
  for (const field of requiredVerificationFields) {
    if (typeof verification[field] !== 'string' || !verification[field]) {
      failures.push(`${pkg.slug} verification ${field} is missing`);
    }
  }
  if (
    !Array.isArray(verification.projectUrls) ||
    verification.projectUrls.length !== config.selectedProjects.length
  ) {
    failures.push(`${pkg.slug} verification project URLs are incomplete`);
  }

  const expectedHashes = {
    configSha256: sha256File(pkg.configPath),
    routeSha256: config.qa.artifactHashes?.routeSha256,
    pdfSha256: config.qa.artifactHashes?.resumePdfSha256,
    ...(hasCoverLetterArtifact(config)
      ? {
          coverLetterPdfSha256:
            config.qa.artifactHashes?.coverLetterPdfSha256,
          coverLetterMarkdownSha256:
            config.qa.artifactHashes?.coverLetterMarkdownSha256,
        }
      : {}),
  };
  for (const [field, expected] of Object.entries(expectedHashes)) {
    if (!expected || verification[field] !== expected) {
      failures.push(
        `${pkg.slug} verification ${field} does not match the current QA artifact`
      );
    }
  }
  if (
    verification.qaBuiltAt !== config.qa.builtAt ||
    verification.configInputSha256 !== config.qa.configInputSha256
  ) {
    failures.push(`${pkg.slug} verification is not tied to the current QA build`);
  }

  const expectedScoped =
    config.routeMode === 'scoped-projects'
      ? config.qa.artifactHashes?.scopedProjectSha256 || {}
      : {};
  const actualScoped = verification.scopedProjectSha256 || {};
  const scopedKeys = new Set([
    ...Object.keys(expectedScoped),
    ...Object.keys(actualScoped),
  ]);
  for (const project of scopedKeys) {
    if (actualScoped[project] !== expectedScoped[project]) {
      failures.push(
        `${pkg.slug} verification checksum is stale for scoped project ${project}`
      );
    }
  }

  const base = publicBase.endsWith('/') ? publicBase : `${publicBase}/`;
  const expectedRouteUrl = `${base}${paths.slug}/`;
  const expectedPdfUrl = `${base}${paths.resumePdfPath}`;
  const expectedConfigUrl = `${base}${pkg.configPath}`;
  const expectedCoverLetterPdfUrl = `${base}${paths.coverLetterPdfPath}`;
  const expectedCoverLetterMarkdownUrl =
    `${base}${paths.coverLetterMarkdownPath}`;
  const expectedProjectUrls = config.selectedProjects.map((project) =>
    config.routeMode === 'canonical-projects'
      ? `${base}${project}`
      : `${base}${paths.slug}/${project}`
  );
  if (verification.routeUrl !== expectedRouteUrl) {
    failures.push(`${pkg.slug} verification route URL is incorrect`);
  }
  if (verification.resumePdfUrl !== expectedPdfUrl) {
    failures.push(`${pkg.slug} verification PDF URL is incorrect`);
  }
  if (verification.configUrl !== expectedConfigUrl) {
    failures.push(`${pkg.slug} verification config URL is incorrect`);
  }
  if (
    hasCoverLetterArtifact(config) &&
    verification.coverLetterPdfUrl !== expectedCoverLetterPdfUrl
  ) {
    failures.push(`${pkg.slug} verification cover-letter PDF URL is incorrect`);
  }
  if (
    hasCoverLetterArtifact(config) &&
    verification.coverLetterMarkdownUrl !== expectedCoverLetterMarkdownUrl
  ) {
    failures.push(
      `${pkg.slug} verification cover-letter Markdown URL is incorrect`
    );
  }
  if (!sameList(verification.projectUrls || [], expectedProjectUrls)) {
    failures.push(`${pkg.slug} verification project URLs are incorrect`);
  }
}

function validateScopedProjects(config, paths, routeHtml, failures) {
  const workNumbers = extractWorkCardNumbers(routeHtml);
  for (const [index, project] of config.selectedProjects.entries()) {
    const projectPath = `${paths.slug}/${project}`;
    if (!existsSync(resolveRepoPath(projectPath))) {
      failures.push(`missing scoped project: ${projectPath}`);
      continue;
    }
    const projectHtml = readFileSync(resolveRepoPath(projectPath), 'utf8');
    const previous =
      config.selectedProjects[
        (index - 1 + config.selectedProjects.length) % config.selectedProjects.length
      ];
    const next =
      config.selectedProjects[(index + 1) % config.selectedProjects.length];
    const projectNumber = projectHtml.match(
      /class="project-number"\s*>\s*([^<]+?)\s*<\/div>/
    )?.[1]?.trim();
    const expectedNumber = workNumbers.get(project);

    if (projectNumber !== expectedNumber) {
      failures.push(
        `${projectPath} number ${projectNumber || '<missing>'} does not match ${expectedNumber}`
      );
    }
    if (!projectHtml.includes(`href="${previous}"`)) {
      failures.push(`${projectPath} is missing previous-project link ${previous}`);
    }
    if (!projectHtml.includes(`href="${next}"`)) {
      failures.push(`${projectPath} is missing next-project link ${next}`);
    }
    if (!projectHtml.includes(`href="../${paths.resumePdfPath}"`)) {
      failures.push(`${projectPath} does not link to the v2 resume PDF`);
    }
    if (!projectHtml.includes('href="index.html#work"')) {
      failures.push(`${projectPath} does not return to the route work section`);
    }
    if (
      /\b(?:href|src)="(?:assets\/|favicon\.ico|apple-touch-icon\.png|site\.webmanifest)/.test(
        projectHtml
      )
    ) {
      failures.push(`${projectPath} contains root-relative resources`);
    }
  }
}

function checkV2Package(pkg, { publicBase = PUBLIC_BASE } = {}) {
  const failures = [];
  const warnings = [];
  if (!pkg.configPath || !existsSync(resolveRepoPath(pkg.configPath))) {
    return { failures: [`${pkg.slug} missing configPath file: ${pkg.configPath}`], warnings };
  }

  const config = readJson(pkg.configPath);
  Object.defineProperty(config, '__configRelativePath', {
    value: pkg.configPath,
    enumerable: false,
  });
  try {
    assertValidV2Config(config);
    assertRecruiterFacingClaimsSupported(config);
  } catch (error) {
    failures.push(error.message);
    return { failures, warnings };
  }
  const paths = getArtifactPaths(config);
  const expectedFields = {
    slug: paths.slug,
    roleTitle: config.roleTitle,
    artifactStem: config.artifactStem,
    fitClass: config.fitClass,
    routeMode: config.routeMode,
    resumePdfPath: paths.resumePdfPath,
    ...(hasCoverLetterArtifact(config)
      ? {
          coverLetterPdfPath: paths.coverLetterPdfPath,
          coverLetterMarkdownPath: paths.coverLetterMarkdownPath,
        }
      : {}),
  };
  for (const [field, expected] of Object.entries(expectedFields)) {
    if (pkg[field] !== expected) {
      failures.push(
        `${pkg.slug} manifest ${field} is ${pkg[field]}, expected ${expected}`
      );
    }
  }
  if (pkg.resumeHtmlPath !== undefined) {
    failures.push(`${pkg.slug} v2 entries must not retain resumeHtmlPath`);
  }
  if (
    !hasCoverLetterArtifact(config) &&
    (pkg.coverLetterPdfPath !== undefined ||
      pkg.coverLetterMarkdownPath !== undefined)
  ) {
    failures.push(
      `${pkg.slug} manifest must not retain cover-letter paths when no letter is in the package contract`
    );
  }
  if (
    !hasCoverLetterArtifact(config) &&
    pkg.verification &&
    (pkg.verification.coverLetterPdfUrl !== undefined ||
      pkg.verification.coverLetterMarkdownUrl !== undefined ||
      pkg.verification.coverLetterPdfSha256 !== undefined ||
      pkg.verification.coverLetterMarkdownSha256 !== undefined)
  ) {
    failures.push(
      `${pkg.slug} verification must not retain cover-letter metadata when no letter is in the package contract`
    );
  }
  if (!sameList(pkg.selectedProjects || [], config.selectedProjects)) {
    failures.push(`${pkg.slug} manifest selectedProjects do not match its config`);
  }
  if (pkg.qaStatus !== 'qa-passed' || config.qa.status !== 'qa-passed') {
    failures.push(`${pkg.slug} QA status is not qa-passed`);
  }
  if (config.qa.configInputSha256 !== configInputSha256(config)) {
    failures.push(`${pkg.slug} config changed after QA`);
  }

  for (const filePath of [
    paths.routeIndexPath,
    paths.resumePdfPath,
    ...(hasCoverLetterArtifact(config)
      ? [paths.coverLetterPdfPath, paths.coverLetterMarkdownPath]
      : []),
  ]) {
    if (!existsSync(resolveRepoPath(filePath))) {
      failures.push(`${pkg.slug} missing file: ${filePath}`);
    }
  }
  if (!existsSync(resolveRepoPath(paths.routeIndexPath))) {
    return { failures, warnings };
  }
  if (
    config.qa.artifactHashes?.routeSha256 !== sha256File(paths.routeIndexPath)
  ) {
    failures.push(`${pkg.slug} route changed after QA`);
  }
  if (
    existsSync(resolveRepoPath(paths.resumePdfPath)) &&
    config.qa.artifactHashes?.resumePdfSha256 !==
      sha256File(paths.resumePdfPath)
  ) {
    failures.push(`${pkg.slug} resume PDF changed after QA`);
  }
  if (
    hasCoverLetterArtifact(config) &&
    existsSync(resolveRepoPath(paths.coverLetterPdfPath)) &&
    config.qa.artifactHashes?.coverLetterPdfSha256 !==
      sha256File(paths.coverLetterPdfPath)
  ) {
    failures.push(`${pkg.slug} cover-letter PDF changed after QA`);
  }
  if (
    hasCoverLetterArtifact(config) &&
    existsSync(resolveRepoPath(paths.coverLetterMarkdownPath)) &&
    config.qa.artifactHashes?.coverLetterMarkdownSha256 !==
      sha256File(paths.coverLetterMarkdownPath)
  ) {
    failures.push(`${pkg.slug} cover-letter Markdown changed after QA`);
  }
  if (
    hasCoverLetterArtifact(config) &&
    (config.qa.coverLetter?.ok !== true ||
      config.qa.coverLetter?.pageCount !== 1 ||
      config.qa.coverLetter?.templateVersion !==
        COVER_LETTER_TEMPLATE_VERSION)
  ) {
    failures.push(
      `${pkg.slug} cover-letter QA is missing, stale, or did not pass the canonical template check`
    );
  }
  if (
    config.qa.sourceResumeSha256 &&
    config.qa.sourceResumeSha256 !== sha256File('resume.html')
  ) {
    warnings.push(
      `${pkg.slug} was built from an older canonical resume; rebuild before reuse`
    );
  }

  const routeHtml = readFileSync(resolveRepoPath(paths.routeIndexPath), 'utf8');
  const expectedWorkLinks = config.selectedProjects.map((project) =>
    config.routeMode === 'canonical-projects' ? `../${project}` : project
  );
  const actualWorkLinks = extractWorkLinks(routeHtml);
  if (!sameList(actualWorkLinks, expectedWorkLinks)) {
    failures.push(
      `${pkg.slug} work-card order mismatch: expected ${expectedWorkLinks.join(
        ', '
      )}; found ${actualWorkLinks.join(', ')}`
    );
  }
  const resumeHref = `href="../${paths.resumePdfPath}"`;
  const resumeLinkCount = routeHtml.split(resumeHref).length - 1;
  if (resumeLinkCount < 3) {
    failures.push(
      `${pkg.slug} expected at least 3 route controls targeting the PDF; found ${resumeLinkCount}`
    );
  }
  if (/href="\.\.\/resume\.html"/.test(routeHtml)) {
    failures.push(`${pkg.slug} still links to the public resume HTML`);
  }
  if (/\?from=/.test(routeHtml)) {
    failures.push(`${pkg.slug} contains a forbidden route query shim`);
  }

  if (config.routeMode === 'canonical-projects') {
    for (const project of config.selectedProjects) {
      if (!existsSync(resolveRepoPath(project))) {
        failures.push(`${pkg.slug} missing canonical project: ${project}`);
      }
    }
  } else {
    validateScopedProjects(config, paths, routeHtml, failures);
    for (const project of config.selectedProjects) {
      const expectedHash =
        config.qa.artifactHashes?.scopedProjectSha256?.[project];
      const projectPath = `${paths.slug}/${project}`;
      if (
        existsSync(resolveRepoPath(projectPath)) &&
        expectedHash !== sha256File(projectPath)
      ) {
        failures.push(`${pkg.slug} scoped project changed after QA: ${project}`);
      }
    }
  }
  const expectedScopedProjects =
    config.routeMode === 'scoped-projects'
      ? [...config.selectedProjects].sort()
      : [];
  const unexpectedScopedProjects = existingScopedProjects(paths).filter(
    (project) => !expectedScopedProjects.includes(project)
  );
  for (const project of unexpectedScopedProjects) {
    failures.push(
      `${pkg.slug} contains retired scoped project: ${paths.slug}/${project}`
    );
  }

  const status = gitStatus(collectScopedPaths(config, paths));
  if (pkg.publishStatus === 'live-verified' && status) {
    failures.push(`${pkg.slug} is live-verified but scoped files are dirty:\n${status}`);
  } else if (pkg.publishStatus === 'local-only' && !status) {
    warnings.push(`${pkg.slug} is local-only but scoped files are clean`);
  }
  if (pkg.publishStatus === 'live-verified') {
    validateLiveVerification(pkg, config, paths, failures, publicBase);
  } else if (pkg.verification !== undefined) {
    failures.push(`${pkg.slug} local-only package must not retain verification metadata`);
  }
  return { failures, warnings };
}

function checkLegacyPackage(pkg) {
  const warnings = [];
  const routePath = `${pkg.slug}/index.html`;
  for (const filePath of [routePath, pkg.resumePdfPath]) {
    if (filePath && !existsSync(resolveRepoPath(filePath))) {
      warnings.push(`${pkg.slug} legacy missing file: ${filePath}`);
    }
  }
  if (pkg.resumeHtmlPath && !existsSync(resolveRepoPath(pkg.resumeHtmlPath))) {
    warnings.push(`${pkg.slug} legacy missing HTML: ${pkg.resumeHtmlPath}`);
  }
  return warnings;
}

export function checkPackages({
  slug = null,
  includeLegacy = false,
  publicBase = PUBLIC_BASE,
} = {}) {
  const manifest = readManifest();
  if (manifest.schemaVersion !== 2) {
    throw new Error('scripts/tailored-packages.json schemaVersion must be 2');
  }
  const selected = slug
    ? manifest.packages.filter((pkg) => pkg.slug === slug)
    : manifest.packages;
  if (slug && selected.length === 0) {
    throw new Error(`No package found for ${slug}`);
  }

  const failures = [];
  const warnings = [];
  let checkedV2 = 0;
  let skippedLegacy = 0;
  for (const pkg of selected) {
    if ((pkg.workflowVersion || 1) !== WORKFLOW_VERSION) {
      skippedLegacy += 1;
      if (includeLegacy) {
        warnings.push(...checkLegacyPackage(pkg));
      }
      continue;
    }
    checkedV2 += 1;
    const result = checkV2Package(pkg, { publicBase });
    failures.push(...result.failures);
    warnings.push(...result.warnings);
  }
  return { failures, warnings, checkedV2, skippedLegacy };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = checkPackages(options);
  for (const warning of result.warnings) {
    console.warn(`WARN: ${warning}`);
  }
  for (const failure of result.failures) {
    console.error(`FAIL: ${failure}`);
  }
  console.log(
    `Checked ${result.checkedV2} v2 package(s); ${
      result.skippedLegacy
    } legacy package(s) ${
      options.includeLegacy ? 'reported as warnings' : 'skipped'
    }.`
  );
  if (result.failures.length) {
    process.exit(1);
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
