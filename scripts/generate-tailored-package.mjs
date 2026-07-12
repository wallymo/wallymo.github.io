#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const manifestPath = 'scripts/tailored-packages.json';
const publicBase = 'https://wallymo.github.io/';
const args = process.argv.slice(2);

function usage() {
  console.error(
    [
      'Usage: node scripts/generate-tailored-package.mjs --config <package.json> [--allow-stretch] [--overwrite] [--dry-run]',
      '',
      'Config must include:',
      '  slug, roleTitle, fitClass, routeMode, selectedProjects, resumeHtmlPath, resumePdfPath,',
      '  fitGate.supportedOverlap, fitGate.unsupportedRequirements, fitGate.recommendation,',
      '  hero.eyebrow, hero.tags, hero.intro, contact.prompt, contact.signoff',
    ].join('\n')
  );
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function parseArgs() {
  const parsed = {
    allowStretch: false,
    overwrite: false,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--config') {
      parsed.configPath = args[index + 1];
      index += 1;
    } else if (arg === '--allow-stretch') {
      parsed.allowStretch = true;
    } else if (arg === '--overwrite') {
      parsed.overwrite = true;
    } else if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--help') {
      usage();
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  if (!parsed.configPath) {
    usage();
    process.exit(2);
  }

  return parsed;
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function writeText(filePath, value, dryRun) {
  if (dryRun) {
    console.log(`DRY write ${filePath}`);
    return;
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, value);
  console.log(`Wrote ${filePath}`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function assertString(config, field) {
  if (typeof config[field] !== 'string' || config[field].trim() === '') {
    fail(`Config must include ${field}`);
  }
}

function assertArray(config, field) {
  if (!Array.isArray(config[field]) || config[field].length === 0) {
    fail(`Config must include non-empty ${field}`);
  }
}

function assertFitGate(config, options) {
  const allowedFitClasses = new Set(['strong', 'adjacent', 'stretch', 'not-fit']);

  assertString(config, 'slug');
  assertString(config, 'roleTitle');
  assertString(config, 'fitClass');
  assertString(config, 'routeMode');
  assertString(config, 'resumeHtmlPath');
  assertString(config, 'resumePdfPath');
  assertArray(config, 'selectedProjects');

  if (!allowedFitClasses.has(config.fitClass)) {
    fail(`fitClass must be one of ${[...allowedFitClasses].join(', ')}`);
  }

  if (!['canonical-projects', 'scoped-projects'].includes(config.routeMode)) {
    fail('routeMode must be canonical-projects or scoped-projects');
  }

  if (!config.fitGate || typeof config.fitGate !== 'object') {
    fail('Config must include fitGate');
  }

  for (const field of ['supportedOverlap', 'unsupportedRequirements']) {
    if (!Array.isArray(config.fitGate[field])) {
      fail(`fitGate.${field} must be an array`);
    }
  }

  if (typeof config.fitGate.recommendation !== 'string' || config.fitGate.recommendation.trim() === '') {
    fail('fitGate.recommendation is required');
  }

  if (config.fitClass === 'not-fit') {
    const suggestion = config.fitGate.makeItFit || config.fitGate.recommendation;
    fail(`Fit gate is not-fit. Do not generate files. Suggested path: ${suggestion}`);
  }

  if (config.fitClass === 'stretch' && !options.allowStretch) {
    fail('Fit gate is stretch. Re-run with --allow-stretch only after explicit human approval.');
  }
}

function assertHero(config) {
  if (!config.hero || typeof config.hero !== 'object') {
    fail('Config must include hero');
  }

  for (const field of ['eyebrow', 'intro']) {
    if (typeof config.hero[field] !== 'string' || config.hero[field].trim() === '') {
      fail(`hero.${field} is required`);
    }
  }

  if (!Array.isArray(config.hero.tags) || config.hero.tags.length < 2) {
    fail('hero.tags must include at least two tags');
  }

  if (/\b(?:Wally|he|him|his)\b/i.test(config.hero.intro)) {
    fail('hero.intro may explain fit directly, but it must use first person instead of third-person candidate-summary copy');
  }
}

function assertContact(config) {
  if (!config.contact || typeof config.contact !== 'object') {
    fail('Config must include contact');
  }

  for (const field of ['prompt', 'signoff']) {
    if (typeof config.contact[field] !== 'string' || config.contact[field].trim() === '') {
      fail(`contact.${field} is required`);
    }
  }

  if (!/email/i.test(config.contact.prompt)) {
    fail('contact.prompt must make email the clear next step');
  }
}

function rewriteRootRefsForRoute(html) {
  return html
    .replace(/\b(href|src)="assets\//g, '$1="../assets/')
    .replace(/\b(href|src)="(favicon\.ico|apple-touch-icon\.png|site\.webmanifest)"/g, '$1="../$2"')
    .replace(/\bhref="resume\.html"/g, 'href="../resume.html"');
}

function replaceFirst(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    fail(`Could not replace ${label}`);
  }

  return html.replace(pattern, replacement);
}

function replaceDivByExactClass(html, className, replacement, label) {
  const openPattern = new RegExp(`<div\\b[^>]*class="${className}"[^>]*>`);
  const openMatch = html.match(openPattern);

  if (!openMatch || openMatch.index === undefined) {
    fail(`Could not find ${label}`);
  }

  const start = openMatch.index;
  const tagPattern = /<\/?div\b[^>]*>/g;
  tagPattern.lastIndex = start;
  let depth = 0;
  let end = -1;
  let match;

  while ((match = tagPattern.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;

    if (depth === 0) {
      end = tagPattern.lastIndex;
      break;
    }
  }

  if (end === -1) {
    fail(`Could not close ${label}`);
  }

  return `${html.slice(0, start)}${replacement}${html.slice(end)}`;
}

function extractWorkCards(indexHtml) {
  const cards = new Map();
  const cardPattern = /<a\b(?=[^>]*\bclass="[^"]*\bwork-item\b[^"]*")[^>]*\bhref="(project-\d+\.html)"[^>]*>[\s\S]*?<\/a>/g;
  let match;

  while ((match = cardPattern.exec(indexHtml))) {
    const [card, projectPath] = match;
    if (!cards.has(projectPath)) {
      cards.set(projectPath, card);
    }
  }

  return cards;
}

function extractWorkCardTitles(indexHtml) {
  const titles = new Map();
  const cards = extractWorkCards(indexHtml);

  for (const [projectPath, card] of cards) {
    const titleMatch = card.match(/<h3>\s*([\s\S]*?)\s*<\/h3>/);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      : projectPath.replace(/\.html$/, '');
    titles.set(projectPath, title);
  }

  return titles;
}

function buildWorkGrid(indexHtml, config) {
  const cardsByProject = extractWorkCards(indexHtml);

  return config.selectedProjects
    .map((project, index) => {
      const card = cardsByProject.get(project);
      if (!card) {
        fail(`Cannot find canonical work card for ${project}`);
      }

      const href = config.routeMode === 'canonical-projects' ? `../${project}` : project;
      return card
        .replace(/href="project-\d+\.html"/, `href="${href}"`)
        .replace(/<div class="work-number">\s*[^<]+?\s*<\/div>/, `<div class="work-number">${String(index + 1).padStart(2, '0')}</div>`)
        .replace(/\b(src|href)="assets\//g, '$1="../assets/');
    })
    .join('\n\n      ');
}

function replaceWorkGrid(routeHtml, workGridHtml) {
  return replaceDivByExactClass(
    routeHtml,
    'work-grid',
    `<div class="work-grid">\n\n      ${workGridHtml}\n\n    </div>`,
    'work grid'
  );
}

function buildRouteLocalNextProject(project, config, titlesByProject) {
  const index = config.selectedProjects.indexOf(project);
  const previousProject = config.selectedProjects[(index - 1 + config.selectedProjects.length) % config.selectedProjects.length];
  const nextProject = config.selectedProjects[(index + 1) % config.selectedProjects.length];
  const previousTitle = titlesByProject.get(previousProject) || previousProject.replace(/\.html$/, '');
  const nextTitle = titlesByProject.get(nextProject) || nextProject.replace(/\.html$/, '');

  return [
    '<!-- NEXT -->',
    '<div class="next-project">',
    '  <div class="nav-projects">',
    `    <a href="${previousProject}">&larr; ${escapeHtml(previousTitle)}</a>`,
    `    <a href="${nextProject}">${escapeHtml(nextTitle)} &rarr;</a>`,
    '  </div>',
    '  <div style="margin-top: var(--space-xl);">',
    '    <div class="label">Next Project</div>',
    `    <a href="${nextProject}">${escapeHtml(nextTitle)} &rarr;</a>`,
    '  </div>',
    '</div>',
  ].join('\n');
}

function buildScopedProjectHtml(project, config, index, titlesByProject) {
  const routeLocalNumber = String(index + 1).padStart(2, '0');
  const nextProjectHtml = buildRouteLocalNextProject(project, config, titlesByProject);

  return readFileSync(project, 'utf8')
    .replace(/\b(href|src)="assets\//g, '$1="../assets/')
    .replace(/\bhref="resume\.html"/g, `href="../${config.resumeHtmlPath}"`)
    .replace(/\bhref="index\.html"\s+class="name"/g, 'href="index.html" class="name"')
    .replace(/\bhref="index\.html#work"/g, 'href="index.html#work"')
    .replace(/<div class="project-number">\s*[^<]+?\s*<\/div>/, `<div class="project-number">${routeLocalNumber}</div>`)
    .replace(/<!-- NEXT -->[\s\S]*?<footer/, `${nextProjectHtml}\n\n<footer`);
}

function buildRoute(config) {
  const indexHtml = readFileSync('index.html', 'utf8');
  let routeHtml = rewriteRootRefsForRoute(indexHtml);
  const routeUrl = `${publicBase}${config.slug}/`;
  const description = `Role-specific portfolio and resume for ${config.roleTitle}.`;
  const tags = config.hero.tags.map((tag) => `    <span>${escapeHtml(tag)}</span>`).join('\n');
  const workGrid = buildWorkGrid(indexHtml, config);

  routeHtml = replaceFirst(routeHtml, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(config.roleTitle)} | Wally Mostafa</title>`, 'title');
  routeHtml = routeHtml.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`);
  routeHtml = routeHtml.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(config.roleTitle)} | Wally Mostafa">`);
  routeHtml = routeHtml.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`);
  routeHtml = routeHtml.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${routeUrl}">`);
  routeHtml = replaceFirst(routeHtml, /<div class="hero-eyebrow">[\s\S]*?<\/div>/, `<div class="hero-eyebrow">${escapeHtml(config.hero.eyebrow)}</div>`, 'hero eyebrow');
  routeHtml = replaceFirst(routeHtml, /<div class="hero-tagline">[\s\S]*?<\/div>/, `<div class="hero-tagline">\n${tags}\n  </div>`, 'hero tags');
  routeHtml = replaceFirst(routeHtml, /<p class="hero-intro">[\s\S]*?<\/p>/, `<p class="hero-intro">\n    ${escapeHtml(config.hero.intro)}\n  </p>`, 'hero intro');
  routeHtml = replaceFirst(routeHtml, /<p class="contact-subtitle reveal">[\s\S]*?<\/p>/, `<p class="contact-subtitle reveal">\n            ${escapeHtml(config.contact.prompt)}\n          </p>`, 'contact prompt');
  routeHtml = replaceFirst(routeHtml, /<span class="footer-sign-off">[\s\S]*?<\/span>/, `<span class="footer-sign-off">${escapeHtml(config.contact.signoff)}</span>`, 'footer sign-off');
  routeHtml = routeHtml.replace(/href="\.\.\/resume\.html" class="nav-cta"/g, `href="../${config.resumeHtmlPath}" class="nav-cta"`);
  routeHtml = routeHtml.replace(/href="\.\.\/resume\.html" class="btn-ghost"/g, `href="../${config.resumeHtmlPath}" class="btn-ghost"`);
  routeHtml = routeHtml.replace(/href="\.\.\/assets\/Wally-Mostafa-Resume\.pdf"[^>]*>Download Resume/g, `href="../${config.resumePdfPath}" download="${path.basename(config.resumePdfPath)}">Download Resume`);
  routeHtml = replaceWorkGrid(routeHtml, workGrid);

  return routeHtml;
}

function buildResume(config) {
  const resumeHtml = readFileSync('resume.html', 'utf8');
  const routeUrl = `${publicBase}${config.slug}/`;
  const description = `Wally Mostafa - tailored resume for ${config.roleTitle}.`;

  return resumeHtml
    .replace(/<title>[\s\S]*?<\/title>/, `<title>Wally Mostafa - ${escapeHtml(config.roleTitle)} Resume</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${publicBase}${config.resumeHtmlPath}">`)
    .replace(/href="https:\/\/wallymo\.github\.io\/(?:[^"]*)?">Portfolio<\/a>/, `href="${routeUrl}" target="_blank" rel="noopener">Portfolio</a>`);
}

function updateManifest(config, dryRun) {
  const manifest = readJson(manifestPath);
  const packageEntry = {
    slug: config.slug,
    roleTitle: config.roleTitle,
    fitClass: config.fitClass,
    routeMode: config.routeMode,
    selectedProjects: config.selectedProjects,
    resumeHtmlPath: config.resumeHtmlPath,
    resumePdfPath: config.resumePdfPath,
    publishStatus: 'local-only',
  };
  const index = manifest.packages.findIndex((pkg) => pkg.slug === config.slug);

  if (index >= 0) {
    manifest.packages[index] = { ...manifest.packages[index], ...packageEntry };
  } else {
    manifest.packages.push(packageEntry);
    manifest.packages.sort((a, b) => a.slug.localeCompare(b.slug));
  }

  if (dryRun) {
    console.log(`DRY update ${manifestPath}`);
    return;
  }

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Updated ${manifestPath}`);
}

const options = parseArgs();
const config = readJson(options.configPath);
config.slug = slugify(config.slug);

assertFitGate(config, options);
assertHero(config);
assertContact(config);

const routeIndexPath = path.join(config.slug, 'index.html');

for (const filePath of [routeIndexPath, config.resumeHtmlPath]) {
  if (existsSync(filePath) && !options.overwrite) {
    fail(`${filePath} already exists. Re-run with --overwrite if this is an intentional update.`);
  }
}

const routeHtml = buildRoute(config);
const resumeHtml = buildResume(config);

writeText(routeIndexPath, routeHtml, options.dryRun);
writeText(config.resumeHtmlPath, resumeHtml, options.dryRun);

if (config.routeMode === 'scoped-projects') {
  const titlesByProject = extractWorkCardTitles(readFileSync('index.html', 'utf8'));

  for (const [index, project] of config.selectedProjects.entries()) {
    const source = project;
    const destination = path.join(config.slug, project);
    if (existsSync(destination) && !options.overwrite) {
      fail(`${destination} already exists. Re-run with --overwrite if this is an intentional update.`);
    }

    const projectHtml = buildScopedProjectHtml(source, config, index, titlesByProject);
    writeText(destination, projectHtml, options.dryRun);
  }
}

updateManifest(config, options.dryRun);

console.log('Next: tailor the resume copy, render the PDF, then run scripts/check-tailored-packages.mjs and scripts/verify-tailored-route.mjs.');
