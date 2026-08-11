#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  PUBLIC_BASE,
  RESUME_ROLE_IDS,
  assertBuildAllowed,
  assertHumanizerReviewCurrent,
  assertRecruiterFacingClaimsSupported,
  assertValidV2Config,
  configInputSha256,
  escapeHtml,
  getArtifactPaths,
  getResumeExperienceSections,
  getRoutePresentation,
  hasCoverLetterArtifact,
  isMain,
  readJson,
  readManifest,
  readResumeBaseProfiles,
  readResumeFoundation,
  relativeRepoPath,
  renderBulletItems,
  renderSkillItems,
  replaceElementContent,
  replacePortfolioLink,
  resolveRepoPath,
  resumeRoleSubEntries,
  scopedProjectReplacementAssets,
  sha256File,
  slugify,
  upsertV2ManifestEntry,
  usesFlexiblePositioningContract,
  writeJson,
} from './lib/workflow-v2.mjs';
import {
  buildCoverLetterHtml,
  buildCoverLetterMarkdown,
} from './lib/cover-letter-template.mjs';
import { renderResumePdf } from './render-resume-pdf.mjs';
import { runAtsCheck } from './ats-check.mjs';
import { runCoverLetterCheck } from './cover-letter-check.mjs';
import { runRouteUiCheck } from './route-ui-check.mjs';

function usage() {
  console.error(
    'Usage: node scripts/build-tailored-package.mjs --config scripts/packages/<slug>.json [--allow-stretch] [--overwrite]'
  );
}

function parseArgs(args) {
  const parsed = { allowStretch: false, overwrite: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') {
      parsed.configPath = args[index + 1];
      index += 1;
    } else if (arg === '--allow-stretch') {
      parsed.allowStretch = true;
    } else if (arg === '--overwrite') {
      parsed.overwrite = true;
    } else if (arg === '--help') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!parsed.configPath) {
    usage();
    throw new Error('--config is required');
  }
  return parsed;
}

function writeText(filePath, value) {
  const absolutePath = resolveRepoPath(filePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, value);
}

function snapshotFiles(filePaths) {
  return new Map(
    filePaths.map((filePath) => {
      const absolutePath = resolveRepoPath(filePath);
      return [
        absolutePath,
        existsSync(absolutePath) ? readFileSync(absolutePath) : null,
      ];
    })
  );
}

function restoreFiles(snapshot) {
  for (const [absolutePath, previousContent] of snapshot) {
    if (previousContent === null) {
      rmSync(absolutePath, { force: true });
      continue;
    }
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, previousContent);
  }
}

function existingScopedOutputs(slug) {
  const routeDirectory = resolveRepoPath(slug);
  if (!existsSync(routeDirectory) || !statSync(routeDirectory).isDirectory()) {
    return [];
  }
  return readdirSync(routeDirectory)
    .filter((entry) => /^project-\d+\.html$/.test(entry))
    .map((entry) => `${slug}/${entry}`);
}

function manifestPackageOutputs(pkg) {
  if (!pkg) {
    return [];
  }
  return [
    `${pkg.slug}/index.html`,
    pkg.resumePdfPath,
    pkg.resumeHtmlPath,
    pkg.coverLetterPdfPath,
    pkg.coverLetterMarkdownPath,
    ...(pkg.routeMode === 'scoped-projects'
      ? (pkg.selectedProjects || []).map(
          (project) => `${pkg.slug}/${project}`
        )
      : []),
  ].filter(Boolean);
}

function replaceFirst(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    throw new Error(`Could not replace ${label}`);
  }
  return html.replace(pattern, replacement);
}

function replaceDivByExactClass(html, className, replacement, label) {
  const openPattern = new RegExp(`<div\\b[^>]*class="${className}"[^>]*>`);
  const openMatch = html.match(openPattern);
  if (!openMatch || openMatch.index === undefined) {
    throw new Error(`Could not find ${label}`);
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
    throw new Error(`Could not close ${label}`);
  }
  return `${html.slice(0, start)}${replacement}${html.slice(end)}`;
}

function rewriteRootRefsForRoute(html) {
  return html
    .replace(/\b(href|src)="assets\//g, '$1="../assets/')
    .replace(
      /\b(href|src)="(favicon\.ico|apple-touch-icon\.png|site\.webmanifest)(\?[^"]*)?"/g,
      '$1="../$2$3"'
    )
    .replace(
      /\bhref="(project-\d+\.html)([?#][^"]*)?"/g,
      'href="../$1$2"'
    )
    .replace(/\bhref="resume\.html"/g, 'href="../resume.html"');
}

function extractWorkCards(indexHtml) {
  const cards = new Map();
  const cardPattern =
    /<a\b(?=[^>]*\bclass="[^"]*\bwork-item\b[^"]*")[^>]*\bhref="(project-\d+\.html)"[^>]*>[\s\S]*?<\/a>/g;
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
  for (const [projectPath, card] of extractWorkCards(indexHtml)) {
    const titleMatch = card.match(/<h3>\s*([\s\S]*?)\s*<\/h3>/);
    const title = titleMatch
      ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      : projectPath.replace(/\.html$/, '');
    titles.set(projectPath, title);
  }
  return titles;
}

function canonicalProjectDetails(project) {
  const projectHtml = readFileSync(resolveRepoPath(project), 'utf8');
  const text = (pattern, fallback) => {
    const value = projectHtml.match(pattern)?.[1] || fallback;
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&middot;/g, '·')
      .replace(/&larr;|&rarr;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const tags = [
    ...projectHtml.matchAll(
      /<span class="hero-pill(?:\s+hero-pill--accent)?">([\s\S]*?)<\/span>/g
    ),
  ]
    .map((match) =>
      match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    )
    .filter(Boolean)
    .slice(0, 4);
  return {
    title: text(/<h1>([\s\S]*?)<\/h1>/, project.replace(/\.html$/, '')),
    role: text(
      /<div class="project-role">([\s\S]*?)<\/div>/,
      'Selected portfolio work'
    ),
    summary: text(
      /<p class="project-summary">([\s\S]*?)<\/p>/,
      'A selected proof point for this role.'
    ),
    tags,
  };
}

function buildFallbackWorkCard(project) {
  const details = canonicalProjectDetails(project);
  const tags = details.tags
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join('\n            ');
  return [
    `<a href="${project}" class="work-item reveal" style="text-decoration: none; color: inherit;">`,
    '  <div class="work-meta">',
    '    <div class="work-number">00</div>',
    `    <h3>${escapeHtml(details.title)}</h3>`,
    `    <div class="role">${escapeHtml(details.role)}</div>`,
    '  </div>',
    '  <div class="work-body">',
    `    <p>${escapeHtml(details.summary)}</p>`,
    tags
      ? `    <div class="work-tags">\n            ${tags}\n          </div>`
      : '',
    '    <span class="work-link">View case study <span class="arrow">→</span></span>',
    '  </div>',
    '</a>',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildWorkGrid(indexHtml, config) {
  const cardsByProject = extractWorkCards(indexHtml);
  return config.selectedProjects
    .map((project, index) => {
      let card =
        cardsByProject.get(project) || buildFallbackWorkCard(project);
      if (
        config.route?.projectCardStats === 'hidden' &&
        /<div\b[^>]*class="work-stats"[^>]*>/.test(card)
      ) {
        card = replaceDivByExactClass(
          card,
          'work-stats',
          '',
          `${project} work stats`
        ).replace(/^[ \t]+$/gm, '');
      }
      const href =
        config.routeMode === 'canonical-projects' ? `../${project}` : project;
      return card
        .replace(/href="project-\d+\.html"/, `href="${href}"`)
        .replace(
          /<div class="work-number">\s*[^<]+?\s*<\/div>/,
          `<div class="work-number">${String(index + 1).padStart(2, '0')}</div>`
        )
        .replace(/\b(src|href)="assets\//g, '$1="../assets/');
    })
    .join('\n\n      ');
}

function buildRouteLocalNextProject(project, config, titlesByProject) {
  const index = config.selectedProjects.indexOf(project);
  const previousProject =
    config.selectedProjects[
      (index - 1 + config.selectedProjects.length) % config.selectedProjects.length
    ];
  const nextProject =
    config.selectedProjects[(index + 1) % config.selectedProjects.length];
  const previousTitle =
    titlesByProject.get(previousProject) || previousProject.replace(/\.html$/, '');
  const nextTitle =
    titlesByProject.get(nextProject) || nextProject.replace(/\.html$/, '');

  return [
    '<!-- NEXT -->',
    '<div class="next-project">',
    '  <div class="nav-projects">',
    `    <a href="${previousProject}">&larr; ${escapeHtml(previousTitle)}</a>`,
    `    <a href="${nextProject}">${escapeHtml(nextTitle)} &rarr;</a>`,
    '  </div>',
    '</div>',
  ].join('\n');
}

function applyScopedProjectAssetOverrides(html, project, config) {
  const overrides = config.route?.projectAssetOverrides?.[project];
  if (!overrides) return html;

  const referenceBoundary = "(?=$|[\"'?#\\s),>])";
  const escapePattern = (reference) =>
    reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const replacements = new Map(
    Object.entries(overrides).map(([sourceAsset, replacementAsset]) => [
      `../${sourceAsset}`,
      `../${replacementAsset}`,
    ])
  );
  for (const sourceReference of replacements.keys()) {
    const sourcePattern = new RegExp(
      `${escapePattern(sourceReference)}${referenceBoundary}`
    );
    if (!sourcePattern.test(html)) {
      throw new Error(
        `Could not find scoped asset override source in ${project}: ${sourceReference.slice(3)}`
      );
    }
  }
  const referencePattern = new RegExp(
    [...replacements.keys()]
      .sort((left, right) => right.length - left.length)
      .map(escapePattern)
      .join('|') + referenceBoundary,
    'g'
  );
  return html.replace(referencePattern, (reference) =>
    replacements.get(reference)
  );
}

function setRouteLocalProjectNumber(html, routeLocalNumber, project) {
  const numberPattern =
    /<div class="project-number">\s*[^<]+?\s*<\/div>/;
  if (numberPattern.test(html)) {
    return html.replace(
      numberPattern,
      `<div class="project-number">${routeLocalNumber}</div>`
    );
  }
  return replaceFirst(
    html,
    /(<div\b[^>]*class="[^"]*\bproject-hero\b[^"]*"[^>]*>)/,
    `$1\n  <div class="project-number">${routeLocalNumber}</div>`,
    `project hero for route-local number in ${project}`
  );
}

function stripLegacyRouteQueryShim(html, project) {
  const legacyGuard = "if (params.get('from') !== 'varonis') return;";
  const guardIndex = html.indexOf(legacyGuard);
  if (guardIndex === -1) return html;

  const shimStart = html.lastIndexOf('(() => {', guardIndex);
  const shimClose = html.indexOf('})();', guardIndex);
  if (shimStart === -1 || shimClose === -1) {
    throw new Error(`Could not remove legacy Varonis query shim from ${project}`);
  }

  const shimLineStart = html.lastIndexOf('\n', shimStart) + 1;
  const removalStart =
    html.slice(shimLineStart, shimStart).trim() === ''
      ? shimLineStart
      : shimStart;
  const strippedHtml = `${html.slice(0, removalStart)}${html.slice(
    shimClose + 5
  )}`;
  if (strippedHtml.includes(legacyGuard)) {
    throw new Error(
      `Legacy Varonis query shim remains in scoped project ${project}`
    );
  }
  return strippedHtml;
}

function buildScopedProjectHtml(project, config, paths, index, titlesByProject) {
  const routeLocalNumber = String(index + 1).padStart(2, '0');
  const nextProjectHtml = buildRouteLocalNextProject(
    project,
    config,
    titlesByProject
  );
  const sourceHtml = readFileSync(resolveRepoPath(project), 'utf8');

  const scopedHtmlWithRefs = sourceHtml
    .replace(/\b(href|src)="assets\//g, '$1="../assets/')
    .replace(
      /\b(href|src)="(favicon\.ico|apple-touch-icon\.png|site\.webmanifest)(\?[^"]*)?"/g,
      '$1="../$2$3"'
    )
    .replace(
      /\bhref="resume\.html"/g,
      `href="../${paths.resumePdfPath}"`
    )
    .replace(
      /\bhref="index\.html"\s+class="name"/g,
      'href="index.html" class="name"'
    )
    .replace(/\bhref="index\.html#work"/g, 'href="index.html#work"');
  const scopedHtml = setRouteLocalProjectNumber(
    applyScopedProjectAssetOverrides(
      stripLegacyRouteQueryShim(scopedHtmlWithRefs, project),
      project,
      config
    ),
    routeLocalNumber,
    project
  );
  return replaceDivByExactClass(
    scopedHtml,
    'next-project',
    nextProjectHtml,
    `next-project navigation for ${project}`
  );
}

function buildRoute(config, paths) {
  const indexHtml = readFileSync(resolveRepoPath('index.html'), 'utf8');
  let routeHtml = rewriteRootRefsForRoute(indexHtml);
  const routeUrl = `${PUBLIC_BASE}${paths.slug}/`;
  const description = `Wally Mostafa's work for ${config.roleTitle}.`;
  const tags = config.hero.tags
    .map((tag) => `    <span>${escapeHtml(tag)}</span>`)
    .join('\n');
  const workGrid = buildWorkGrid(indexHtml, config);

  routeHtml = replaceFirst(
    routeHtml,
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtml(config.roleTitle)} | Wally Mostafa</title>`,
    'title'
  );
  routeHtml = routeHtml.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(description)}">`
  );
  routeHtml = routeHtml.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${escapeHtml(
      config.roleTitle
    )} | Wally Mostafa">`
  );
  routeHtml = routeHtml.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${escapeHtml(description)}">`
  );
  routeHtml = routeHtml.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${routeUrl}">`
  );
  routeHtml = replaceFirst(
    routeHtml,
    /<div class="hero-eyebrow">[\s\S]*?<\/div>/,
    `<div class="hero-eyebrow">${escapeHtml(config.hero.eyebrow)}</div>`,
    'hero eyebrow'
  );
  routeHtml = replaceFirst(
    routeHtml,
    /<div class="hero-tagline">[\s\S]*?<\/div>/,
    `<div class="hero-tagline">\n${tags}\n  </div>`,
    'hero tags'
  );
  routeHtml = replaceFirst(
    routeHtml,
    /<p class="hero-intro">[\s\S]*?<\/p>/,
    `<p class="hero-intro">\n    ${escapeHtml(config.hero.intro)}\n  </p>`,
    'hero intro'
  );
  routeHtml = replaceFirst(
    routeHtml,
    /<p class="contact-subtitle reveal">[\s\S]*?<\/p>/,
    `<p class="contact-subtitle reveal">\n            ${escapeHtml(
      config.contact.prompt
    )}\n          </p>`,
    'contact prompt'
  );
  routeHtml = replaceFirst(
    routeHtml,
    /<span class="footer-sign-off">[\s\S]*?<\/span>/,
    `<span class="footer-sign-off">${escapeHtml(
      config.contact.signoff
    )}</span>`,
    'footer sign-off'
  );
  routeHtml = routeHtml.replace(
    /href="\.\.\/resume\.html" class="nav-cta"/g,
    `href="../${paths.resumePdfPath}" class="nav-cta"`
  );
  routeHtml = routeHtml.replace(
    /href="\.\.\/resume\.html" class="btn-ghost"/g,
    `href="../${paths.resumePdfPath}" class="btn-ghost"`
  );
  routeHtml = routeHtml.replace(
    /href="\.\.\/assets\/Wally-Mostafa-Resume\.pdf"[^>]*>Download Resume/g,
    `href="../${paths.resumePdfPath}" download="${path.basename(
      paths.resumePdfPath
    )}">Download Resume`
  );
  routeHtml = replaceDivByExactClass(
    routeHtml,
    'work-grid',
    `<div class="work-grid">\n\n      ${workGrid}\n\n    </div>`,
    'work grid'
  );
  if (config.routeMode === 'scoped-projects') {
    for (const project of config.selectedProjects) {
      routeHtml = routeHtml
        .split(`href="../${project}"`)
        .join(`href="${project}"`);
    }
  }
  if (getRoutePresentation(config) === 'showcase') {
    if (config.routeMode !== 'scoped-projects') {
      console.warn(
        'WARN: showcase presentation with canonical-projects lets case studies link back to the homepage; pair it with routeMode "scoped-projects"'
      );
    }
    for (const sectionId of ['how-i-build', 'capabilities', 'arc']) {
      routeHtml = replaceFirst(
        routeHtml,
        new RegExp(
          `\\s*<section\\b[^>]*\\bid="${sectionId}"[\\s\\S]*?<\\/section>`
        ),
        '',
        `${sectionId} section`
      );
      routeHtml = routeHtml.replace(
        new RegExp(`\\s*<li><a href="#${sectionId}">[^<]*<\\/a><\\/li>`),
        ''
      );
    }
    routeHtml = routeHtml.replace(
      /\s*<p class="work-more reveal">[\s\S]*?<\/p>/,
      ''
    );
    routeHtml = routeHtml.replace(
      /<a href="\.\.\/project-\d+\.html">([\s\S]*?)<\/a>/g,
      '$1'
    );
    routeHtml = routeHtml.replace(
      /\s*<div class="section-label reveal">Get in touch<\/div>/,
      ''
    );
    routeHtml = routeHtml.replace(
      /\s*<p class="contact-subtitle reveal">[\s\S]*?<\/p>/,
      ''
    );
  }
  if (config.route?.workHeading) {
    routeHtml = replaceFirst(
      routeHtml,
      /(<section id="work">[\s\S]*?<h2 class="section-title reveal">)[\s\S]*?(<\/h2>)/,
      (_match, openingHtml, closingTag) =>
        `${openingHtml}${escapeHtml(config.route.workHeading)}${closingTag}`,
      'work heading'
    );
  }
  if (config.route?.contactHeading) {
    routeHtml = replaceFirst(
      routeHtml,
      /(<section class="contact"[\s\S]*?<h2 class="reveal">)[\s\S]*?(<\/h2>)/,
      (_match, openingHtml, closingTag) =>
        `${openingHtml}${escapeHtml(config.route.contactHeading)}${closingTag}`,
      'contact heading'
    );
  }
  return routeHtml;
}

function buildResume(config, paths) {
  let resumeHtml = readFileSync(resolveRepoPath('resume.html'), 'utf8');
  const foundation = readResumeFoundation();
  const summary =
    usesFlexiblePositioningContract(config)
      ? config.resume.summary
      : foundation.summary;
  const skills =
    usesFlexiblePositioningContract(config)
      ? config.resume.skills
      : foundation.skills;
  const routeUrl = `${PUBLIC_BASE}${paths.slug}/`;
  const description = `Wally Mostafa's resume for ${config.roleTitle}.`;

  resumeHtml = resumeHtml
    .replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>Wally Mostafa - ${escapeHtml(config.roleTitle)} Resume</title>`
    )
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${escapeHtml(description)}">`
    )
    .replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${escapeHtml(description)}">`
    )
    .replace(
      /<meta property="og:url" content="[^"]*">/,
      `<meta property="og:url" content="${routeUrl}">`
    );
  resumeHtml = replaceElementContent(
    resumeHtml,
    'data-resume-content',
    'summary',
    `\n    ${escapeHtml(summary)}\n  `
  );
  resumeHtml = replaceElementContent(
    resumeHtml,
    'data-resume-content',
    'skills',
    renderSkillItems(skills)
  );
  for (const roleId of RESUME_ROLE_IDS) {
    if (resumeRoleSubEntries(config.resume, roleId)) {
      continue;
    }
    resumeHtml = replaceElementContent(
      resumeHtml,
      'data-resume-role',
      roleId,
      renderBulletItems(config.resume.roles[roleId])
    );
  }
  resumeHtml = replaceResumeExperienceSections(resumeHtml, config);
  if (config.resume.roleContinuationBreaks?.length) {
    resumeHtml = resumeHtml.replace(
      '</head>',
      `<style data-resume-page-splitting="role-continuation">
  @media print {
    .job.job--continuation {
      break-before: page;
      page-break-before: always;
    }
  }
</style>
</head>`
    );
  }
  if (Array.isArray(config.resume.awards)) {
    resumeHtml = resumeHtml.replace(
      /<ul class="awards-list">[\s\S]*?<\/ul>/,
      `<ul class="awards-list">\n${config.resume.awards
        .map((award) => {
          const label = award.href
            ? `<a href="${escapeHtml(
                award.href
              )}" target="_blank" rel="noopener">${escapeHtml(
                award.label
              )}</a>`
            : `<span class="award-label" style="font-weight: 600; color: var(--ink);">${escapeHtml(
                award.label
              )}</span>`;
          return `    <li>\n      ${label}\n      <span class="award-detail"> — ${escapeHtml(
            award.detail
          )}</span>\n    </li>`;
        })
        .join('\n')}\n  </ul>`
    );
  }
  if (config.resume.layoutDensity === 'compact') {
    resumeHtml = resumeHtml.replace(
      '</head>',
      `<style data-resume-layout-density="compact">
  @page { margin: 0.4in; }
  @media print {
    header {
      padding-bottom: 0.45rem;
      margin-bottom: 0.55rem;
    }
    section {
      margin-bottom: 0.5rem;
    }
    .section-title {
      font-size: 0.72rem;
      padding-bottom: 2px;
      margin-bottom: 0.35rem;
    }
    .summary,
    .capabilities-list li,
    .job-desc li,
    .awards-list li,
    .edu {
      font-size: 9pt;
      line-height: 1.3;
    }
    .job {
      margin-bottom: 0.45rem;
    }
    .job-title {
      font-size: 10pt;
    }
    .job-meta {
      font-size: 8.5pt;
    }
    .job-desc li {
      margin-bottom: 0.08rem;
    }
  }
</style>
</head>`
    );
  }
  resumeHtml = replacePortfolioLink(
    resumeHtml,
    routeUrl,
    config.resume.portfolioLinkLabel || 'Portfolio'
  );
  return resumeHtml;
}

function extractBalancedTagBlock(html, startIndex, tagName) {
  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let started = false;
  let match;

  while ((match = tagPattern.exec(html))) {
    if (!started && match.index !== startIndex) {
      throw new Error(`Expected <${tagName}> at index ${startIndex}`);
    }
    started = true;
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      return html.slice(startIndex, tagPattern.lastIndex);
    }
  }
  throw new Error(`Could not find the closing </${tagName}> tag`);
}

function renderSubEntryJob(subEntry) {
  const meta = [subEntry.employer, subEntry.location, subEntry.dateRange]
    .filter(Boolean)
    .map((part) => escapeHtml(part))
    .join(' · ');
  return `  <div class="job">
    <div class="job-header">
      <span class="job-title">${escapeHtml(subEntry.title)}</span>
      <span class="job-meta">${meta}</span>
    </div>
    <ul class="job-desc">${renderBulletItems(subEntry.bullets)}</ul>
  </div>`;
}

export function splitJobBlockWithContinuation(jobBlock, afterBullet) {
  const listMatch = jobBlock.match(/<ul\b[^>]*>[\s\S]*?<\/ul>/i);
  if (!listMatch) {
    throw new Error('Could not find the resume job bullet list');
  }
  const listHtml = listMatch[0];
  const listOpen = listHtml.match(/^<ul\b[^>]*>/i)?.[0];
  const bulletItems = [...listHtml.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/gi)].map(
    (match) => match[0]
  );
  if (
    !listOpen ||
    !Number.isInteger(afterBullet) ||
    afterBullet < 1 ||
    afterBullet >= bulletItems.length
  ) {
    throw new Error('Invalid resume role continuation break');
  }
  const jobBeforeList = jobBlock.slice(0, listMatch.index);
  const jobAfterList = jobBlock.slice(listMatch.index + listHtml.length);
  const renderChunk = (prefix, items) => `${prefix}${listOpen}\n${items
    .map((item) => `      ${item}`)
    .join('\n')}\n    </ul>${jobAfterList}`;
  const continuationPrefix = jobBeforeList
    .replace('<div class="job">', '<div class="job job--continuation">')
    .replace(
      /(<span class="job-title">)([\s\S]*?)(<\/span>)/i,
      '$1$2 (continued)$3'
    );
  return `${renderChunk(
    jobBeforeList,
    bulletItems.slice(0, afterBullet)
  )}\n\n${renderChunk(
    continuationPrefix,
    bulletItems.slice(afterBullet)
  )}`;
}

function replaceResumeExperienceSections(resumeHtml, config) {
  const experienceMatch = resumeHtml.match(
    /<section data-resume-section="experience">[\s\S]*?<\/section>/
  );
  if (!experienceMatch) {
    throw new Error('Could not find the source resume experience section');
  }

  const sourceSection = experienceMatch[0];
  const jobBlocks = new Map();
  const continuationBreaks = new Map(
    (config.resume.roleContinuationBreaks || []).map(
      ({ roleId, afterBullet }) => [roleId, afterBullet]
    )
  );
  for (const roleId of RESUME_ROLE_IDS) {
    const subEntries = resumeRoleSubEntries(config.resume, roleId);
    if (subEntries) {
      jobBlocks.set(roleId, subEntries.map(renderSubEntryJob).join('\n\n'));
      continue;
    }
    const roleMarker = `data-resume-role="${roleId}"`;
    const markerIndex = sourceSection.indexOf(roleMarker);
    const jobStart = sourceSection.lastIndexOf(
      '<div class="job">',
      markerIndex
    );
    if (markerIndex === -1 || jobStart === -1) {
      throw new Error(`Could not find the source resume job for ${roleId}`);
    }
    let jobBlock = extractBalancedTagBlock(sourceSection, jobStart, 'div');
    if (continuationBreaks.has(roleId)) {
      jobBlock = splitJobBlockWithContinuation(
        jobBlock,
        continuationBreaks.get(roleId)
      );
    }
    jobBlocks.set(roleId, jobBlock);
  }

  const replacement = getResumeExperienceSections(config)
    .map(
      (section, index) => `<section data-resume-section="${
        index === 0 ? 'experience' : `experience-${index + 1}`
      }"${
        section.pageBreakBefore
          ? ' style="break-before: page; page-break-before: always;"'
          : ''
      }>
  <div class="section-title">${escapeHtml(section.heading)}</div>

${section.roleIds.map((roleId) => jobBlocks.get(roleId)).join('\n\n')}
</section>`
    )
    .join('\n\n');
  return resumeHtml.replace(experienceMatch[0], replacement);
}

function normalizeRouteQa(result) {
  return {
    viewports: result.viewports.map(({ screenshot, ...viewport }) => viewport),
    errors: result.errors,
  };
}

export async function buildTailoredPackage({
  configPath,
  allowStretch = false,
  overwrite = false,
}) {
  const absoluteConfigPath = resolveRepoPath(configPath);
  const config = readJson(absoluteConfigPath);
  Object.defineProperty(config, '__configPath', {
    value: absoluteConfigPath,
    enumerable: false,
  });
  config.slug = slugify(config.slug);
  assertValidV2Config(config, { requireCurrentContract: true });
  assertBuildAllowed(config, {
    allowStretch,
    allowExistingRefresh: overwrite,
  });
  assertHumanizerReviewCurrent(config);
  assertRecruiterFacingClaimsSupported(config);
  const paths = getArtifactPaths(config);

  for (const project of config.selectedProjects) {
    if (!existsSync(resolveRepoPath(project))) {
      throw new Error(`Missing selected project: ${project}`);
    }
  }
  for (const replacementAsset of scopedProjectReplacementAssets(config)) {
    const replacementPath = resolveRepoPath(replacementAsset);
    if (!existsSync(replacementPath) || !statSync(replacementPath).isFile()) {
      throw new Error(
        `Missing scoped project replacement asset: ${replacementAsset}`
      );
    }
  }

  const manifestBeforeBuild = readManifest();
  const previousPackage = manifestBeforeBuild.packages.find(
    (pkg) => pkg.slug === paths.slug
  );
  const trackedOutputs = [paths.routeIndexPath, paths.resumePdfPath];
  if (hasCoverLetterArtifact(config)) {
    trackedOutputs.push(
      paths.coverLetterPdfPath,
      paths.coverLetterMarkdownPath
    );
  }
  if (config.routeMode === 'scoped-projects') {
    trackedOutputs.push(
      ...config.selectedProjects.map((project) => `${paths.slug}/${project}`)
    );
  }
  if (!overwrite) {
    const conflicts = trackedOutputs.filter((filePath) =>
      existsSync(resolveRepoPath(filePath))
    );
    if (conflicts.length) {
      throw new Error(
        `Output already exists. Re-run with --overwrite if intentional:\n${conflicts.join(
          '\n'
        )}`
      );
    }
  }

  const routeHtml = buildRoute(config, paths);
  const resumeHtml = buildResume(config, paths);
  const coverLetterMarkdown = hasCoverLetterArtifact(config)
    ? buildCoverLetterMarkdown(config, paths)
    : null;
  const coverLetterHtml = hasCoverLetterArtifact(config)
    ? buildCoverLetterHtml(config, paths)
    : null;
  const previousOutputs = [
    ...new Set([
      ...manifestPackageOutputs(previousPackage),
      ...existingScopedOutputs(paths.slug),
    ]),
  ];
  const transactionOutputs = [
    ...new Set([...trackedOutputs, ...previousOutputs]),
  ];
  const retiredOutputs = previousOutputs.filter(
    (filePath) => !trackedOutputs.includes(filePath)
  );
  const rollbackSnapshot = snapshotFiles([
    ...transactionOutputs,
    absoluteConfigPath,
    'scripts/tailored-packages.json',
  ]);
  try {
    rmSync(resolveRepoPath(paths.qaOutputDir), {
      recursive: true,
      force: true,
    });
    writeText(paths.routeIndexPath, routeHtml);
    if (config.routeMode === 'scoped-projects') {
      const titlesByProject = extractWorkCardTitles(
        readFileSync(resolveRepoPath('index.html'), 'utf8')
      );
      for (const project of config.selectedProjects) {
        if (!titlesByProject.has(project)) {
          titlesByProject.set(
            project,
            canonicalProjectDetails(project).title
          );
        }
      }
      for (const [index, project] of config.selectedProjects.entries()) {
        writeText(
          `${paths.slug}/${project}`,
          buildScopedProjectHtml(project, config, paths, index, titlesByProject)
        );
      }
    }

    writeText(paths.tempResumeHtmlPath, resumeHtml);
    const renderResult = renderResumePdf({
      htmlPath: paths.tempResumeHtmlPath,
      pdfPath: paths.resumePdfPath,
    });
    const atsResult = runAtsCheck({
      configPath: absoluteConfigPath,
      pdfPath: paths.resumePdfPath,
    });
    if (!atsResult.ok) {
      throw new Error(`ATS preflight failed:\n${atsResult.failures.join('\n')}`);
    }
    let coverLetterRenderResult = null;
    let coverLetterCheckResult = null;
    if (hasCoverLetterArtifact(config)) {
      writeText(paths.coverLetterMarkdownPath, coverLetterMarkdown);
      writeText(paths.tempCoverLetterHtmlPath, coverLetterHtml);
      coverLetterRenderResult = renderResumePdf({
        htmlPath: paths.tempCoverLetterHtmlPath,
        pdfPath: paths.coverLetterPdfPath,
        waitForFonts: true,
      });
      coverLetterCheckResult = runCoverLetterCheck({
        configPath: absoluteConfigPath,
        pdfPath: paths.coverLetterPdfPath,
      });
      if (!coverLetterCheckResult.ok) {
        throw new Error(
          `Cover-letter preflight failed:\n${coverLetterCheckResult.failures.join(
            '\n'
          )}`
        );
      }
    }
    const routeQaResult = runRouteUiCheck({ configPath: absoluteConfigPath });
    const builtAt = new Date().toISOString();
    const resumeBaseProfiles =
      config.contractRevision === 7 ? readResumeBaseProfiles() : null;
    const qa = {
      status: 'qa-passed',
      builtAt,
      configInputSha256: configInputSha256(config),
      sourceResumeSha256: sha256File('resume.html'),
      resumeFoundation: {
        id: readResumeFoundation().id,
        sourcePdfSha256: readResumeFoundation().source.sha256,
      },
      resumeBase:
        config.contractRevision === 7
          ? {
              mode: config.fitGate.resumeBase.mode,
              sourceProfiles: config.fitGate.resumeBase.sourceProfiles,
              leadProfileId: config.fitGate.resumeBase.leadProfileId,
              accountPresentation:
                config.fitGate.resumeBase.accountPresentation,
              action: config.fitGate.resumeBase.action,
              registryVersion: resumeBaseProfiles.registryVersion,
              registrySha256: sha256File(
                'scripts/resume-base-profiles.json'
              ),
            }
          : null,
      artifactHashes: {
        routeSha256: sha256File(paths.routeIndexPath),
        resumePdfSha256: sha256File(paths.resumePdfPath),
        coverLetterPdfSha256: hasCoverLetterArtifact(config)
          ? sha256File(paths.coverLetterPdfPath)
          : null,
        coverLetterMarkdownSha256: hasCoverLetterArtifact(config)
          ? sha256File(paths.coverLetterMarkdownPath)
          : null,
        scopedProjectSha256:
          config.routeMode === 'scoped-projects'
            ? Object.fromEntries(
                config.selectedProjects.map((project) => [
                  project,
                  sha256File(`${paths.slug}/${project}`),
                ])
              )
            : {},
        scopedProjectAssetSha256: Object.fromEntries(
          scopedProjectReplacementAssets(config).map((assetPath) => [
            assetPath,
            sha256File(assetPath),
          ])
        ),
      },
      renderer: renderResult,
      coverLetterRenderer: coverLetterRenderResult,
      coverLetter: coverLetterCheckResult,
      ats: atsResult,
      humanizer: {
        status: config.copyReview.status,
        version: config.copyReview.humanizerVersion,
        mode: config.copyReview.mode,
        reviewedAt: config.copyReview.reviewedAt,
        copySha256: config.copyReview.copySha256,
        reviewMethod: config.copyReview.reviewMethod,
        semanticPassAttested: config.copyReview.semanticPassAttested,
        staticChecksPassed: config.copyReview.staticChecksPassed,
      },
      route: normalizeRouteQa(routeQaResult),
    };
    config.qa = qa;
    writeJson(absoluteConfigPath, config);
    upsertV2ManifestEntry(config, qa);
    for (const retiredOutput of retiredOutputs) {
      rmSync(resolveRepoPath(retiredOutput), { force: true });
    }

    return {
      configPath: relativeRepoPath(absoluteConfigPath),
      routePath: paths.routeIndexPath,
      resumePdfPath: paths.resumePdfPath,
      coverLetterPdfPath: hasCoverLetterArtifact(config)
        ? paths.coverLetterPdfPath
        : null,
      coverLetterMarkdownPath: hasCoverLetterArtifact(config)
        ? paths.coverLetterMarkdownPath
        : null,
      scopedProjectPaths:
        config.routeMode === 'scoped-projects'
          ? config.selectedProjects.map((project) => `${paths.slug}/${project}`)
          : [],
      qa,
    };
  } catch (error) {
    restoreFiles(rollbackSnapshot);
    throw error;
  } finally {
    rmSync(resolveRepoPath(paths.tempResumeHtmlPath), { force: true });
    rmSync(resolveRepoPath(paths.tempCoverLetterHtmlPath), { force: true });
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await buildTailoredPackage(options);
  console.log(`OK built v2 package ${result.routePath}`);
  console.log(`Resume PDF: ${result.resumePdfPath}`);
  if (result.coverLetterPdfPath) {
    console.log(`Cover-letter PDF: ${result.coverLetterPdfPath}`);
    console.log(`Cover-letter Markdown: ${result.coverLetterMarkdownPath}`);
  }
  console.log('Publish only the scoped files above, then run:');
  console.log(
    `node scripts/verify-tailored-route.mjs ${path.basename(
      path.dirname(result.routePath)
    )}`
  );
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
