#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  PUBLIC_BASE,
  assertHumanizerReviewCurrent,
  assertValidV2Config,
  ensureRegularFile,
  isMain,
  normalizeText,
  readJson,
  readResumeFoundation,
  relativeRepoPath,
  resolveRepoPath,
  usesFlexiblePositioningContract,
} from './lib/workflow-v2.mjs';

const MAX_PDF_BYTES = 2_500_000;
const REQUIRED_HEADINGS = ['SUMMARY', 'SKILLS', 'EXPERIENCE', 'AWARDS', 'EDUCATION'];

function usage() {
  console.error(
    'Usage: node scripts/ats-check.mjs --config <package-config.json> --pdf <resume.pdf> [--json]'
  );
}

function parseArgs(args) {
  const parsed = { json: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') {
      parsed.configPath = args[index + 1];
      index += 1;
    } else if (arg === '--pdf') {
      parsed.pdfPath = args[index + 1];
      index += 1;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--help') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!parsed.configPath || !parsed.pdfPath) {
    usage();
    throw new Error('Both --config and --pdf are required');
  }
  return parsed;
}

function commandOutput(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function parsePageCount(pdfPath) {
  const info = commandOutput('pdfinfo', [pdfPath]);
  const match = info.match(/^Pages:\s+(\d+)/m);
  if (!match) {
    throw new Error('pdfinfo did not report a page count');
  }
  return Number(match[1]);
}

function inspectPdf(pdfPath) {
  const helperPath = resolveRepoPath('scripts/lib/pdf_inspect.py');
  const output = commandOutput('python3', [helperPath, pdfPath]);
  return JSON.parse(output);
}

function headingPresent(compactUpperText, heading) {
  return compactUpperText.includes(heading);
}

function buildCoverage(config, extractedText) {
  const normalizedResume = normalizeText(extractedText);
  return config.requirements.map((requirement) => {
    const matchedTerms = requirement.resumeTerms.filter((term) =>
      normalizedResume.includes(normalizeText(term))
    );
    const missingTerms = requirement.resumeTerms.filter(
      (term) => !matchedTerms.includes(term)
    );
    let status = 'not-supported';
    if (requirement.evidenceStatus === 'direct' && matchedTerms.length) {
      status = 'covered-directly';
    } else if (requirement.evidenceStatus === 'adjacent' && matchedTerms.length) {
      status = 'covered-adjacently';
    }
    return {
      id: requirement.id,
      requirement: requirement.text,
      priority: requirement.priority,
      evidenceStatus: requirement.evidenceStatus,
      matchMode: requirement.matchMode || null,
      status,
      matchedTerms,
      missingTerms,
    };
  });
}

export function runAtsCheck({ configPath, pdfPath }) {
  const config = readJson(configPath);
  config.__configPath = resolveRepoPath(configPath);
  assertValidV2Config(config);
  assertHumanizerReviewCurrent(config);
  const absolutePdfPath = ensureRegularFile(pdfPath, 'resume PDF');
  const failures = [];
  const warnings = [];
  let extractedText = '';
  let firstPageText = '';
  let pageCount = null;
  let inspection = { annotations: [] };

  try {
    extractedText = commandOutput('pdftotext', ['-layout', absolutePdfPath, '-']);
  } catch (error) {
    failures.push(`PDF text extraction failed: ${error.message}`);
  }

  try {
    firstPageText = commandOutput('pdftotext', [
      '-layout',
      '-f',
      '1',
      '-l',
      '1',
      absolutePdfPath,
      '-',
    ]);
  } catch (error) {
    failures.push(`PDF first-page extraction failed: ${error.message}`);
  }

  try {
    pageCount = parsePageCount(absolutePdfPath);
  } catch (error) {
    failures.push(`PDF metadata inspection failed: ${error.message}`);
  }

  try {
    inspection = inspectPdf(absolutePdfPath);
  } catch (error) {
    failures.push(`PDF annotation inspection failed: ${error.message}`);
  }

  if (!extractedText.trim()) {
    failures.push('PDF text extraction is empty');
  }
  if (extractedText.includes('\uFFFD')) {
    failures.push('PDF text contains replacement characters');
  }
  if (/[\uFB00-\uFB06]/u.test(extractedText)) {
    failures.push('PDF text contains ligature artifacts');
  }
  if (extractedText.includes('→')) {
    failures.push('PDF text contains the unsupported arrow character');
  }
  if (pageCount !== null && pageCount > 2) {
    failures.push(`PDF is ${pageCount} pages; the contract allows at most 2`);
  }
  if (statSync(absolutePdfPath).size > MAX_PDF_BYTES) {
    failures.push(`PDF exceeds the ${MAX_PDF_BYTES}-byte parser limit`);
  }

  const firstLines = extractedText.split(/\r?\n/).slice(0, 16).join(' ');
  for (const [label, pattern] of [
    ['name', /WALLY\s+MOSTAFA/i],
    ['email', /wmostafa12@gmail\.com/i],
    ['phone', /347[-.\s]420[-.\s]3558/i],
    ['location', /Raleigh,\s*NC/i],
  ]) {
    if (!pattern.test(firstLines)) {
      failures.push(`Contact ${label} is missing from the first extracted lines`);
    }
  }

  const compactUpperText = extractedText.toUpperCase().replace(/\s+/g, '');
  for (const heading of REQUIRED_HEADINGS) {
    if (!headingPresent(compactUpperText, heading)) {
      failures.push(`Missing standard heading: ${heading}`);
    }
  }

  if (usesFlexiblePositioningContract(config)) {
    const normalizedFirstPage = normalizeText(firstPageText);
    if (
      !normalizedFirstPage.includes(normalizeText(config.resume.summary))
    ) {
      failures.push('Tailored resume summary is missing from the first page');
    }
    for (const skill of config.resume.skills) {
      if (!normalizedFirstPage.includes(normalizeText(skill.label))) {
        failures.push(
          `Selected skill is missing from the first page: ${skill.label}`
        );
      }
    }
  }

  const uris = inspection.annotations.map((annotation) => annotation.uri);
  const expectedPortfolio = `${PUBLIC_BASE}${config.slug}/`;
  const portfolioUris = uris.filter((uri) => uri.startsWith(PUBLIC_BASE));
  if (
    portfolioUris.length !== 1 ||
    portfolioUris[0] !== expectedPortfolio
  ) {
    failures.push(
      `Portfolio annotations must point exclusively to ${expectedPortfolio}; found ${
        portfolioUris.join(', ') || '<none>'
      }`
    );
  }
  if (!uris.includes('https://linkedin.com/in/wallymo')) {
    failures.push('LinkedIn annotation is missing or incorrect');
  }

  const normalizedResume = normalizeText(extractedText);
  if (usesFlexiblePositioningContract(config)) {
    const foundation = readResumeFoundation();
    let anchorCursor = 0;
    for (const roleId of Object.keys(foundation.roleHeaders || {})) {
      const header = foundation.roleHeaders[roleId];
      for (const [label, value] of [
        ['title', header.title],
        ['employer', header.employer],
        ['date range', header.dateRange],
      ]) {
        const normalizedAnchor = normalizeText(value);
        const anchorIndex = normalizedResume.indexOf(
          normalizedAnchor,
          anchorCursor
        );
        if (anchorIndex === -1) {
          failures.push(
            `Resume ${label} anchor is missing or out of chronological order for ${roleId}: ${value}`
          );
        } else {
          anchorCursor = anchorIndex + normalizedAnchor.length;
        }
      }
    }
    for (const anchor of foundation.educationAnchors || []) {
      const normalizedAnchor = normalizeText(anchor);
      const anchorIndex = normalizedResume.indexOf(
        normalizedAnchor,
        anchorCursor
      );
      if (anchorIndex === -1) {
        failures.push(
          `Education anchor is missing or out of order: ${anchor}`
        );
      } else {
        anchorCursor = anchorIndex + normalizedAnchor.length;
      }
    }

    let bulletCursor = Math.max(
      0,
      normalizedResume.indexOf(normalizeText('EXPERIENCE'))
    );
    for (const roleId of Object.keys(foundation.roles || {})) {
      const sourceIds = config.resume.sourceBulletIds[roleId] || [];
      const tailoredBullets = config.resume.roles[roleId] || [];
      for (const [bulletIndex, tailoredBullet] of tailoredBullets.entries()) {
        const sourceId = sourceIds[bulletIndex] || `unmapped:${roleId}:${bulletIndex}`;
        const normalizedBullet = normalizeText(tailoredBullet);
        const occurrenceIndex = normalizedResume.indexOf(
          normalizedBullet,
          bulletCursor
        );
        if (!normalizedBullet || occurrenceIndex === -1) {
          failures.push(
            `Mapped resume bullet is missing or out of order in the PDF: ${sourceId}`
          );
        } else {
          bulletCursor = occurrenceIndex + normalizedBullet.length;
        }
      }
    }
  }
  for (const prohibitedPhrase of [
    ...config.constraints.doNotClaim,
    ...config.constraints.blockedTerms,
  ]) {
    if (normalizedResume.includes(normalizeText(prohibitedPhrase))) {
      failures.push(
        `Unsupported prohibited phrase appears in the resume: ${prohibitedPhrase}`
      );
    }
  }
  for (const requirement of config.requirements) {
    if (requirement.evidenceStatus !== 'none') {
      continue;
    }
    for (const unsupportedTerm of requirement.resumeTerms) {
      if (normalizedResume.includes(normalizeText(unsupportedTerm))) {
        failures.push(
          `Unsupported requirement language appears in the resume: ${unsupportedTerm}`
        );
      }
    }
  }

  const coverage = buildCoverage(config, extractedText);
  for (const item of coverage) {
    if (
      item.evidenceStatus !== 'none' &&
      item.missingTerms.length &&
      item.priority === 'core'
    ) {
      warnings.push(
        `${item.id}: supported core language missing from the PDF: ${item.missingTerms.join(', ')}`
      );
    }
  }

  return {
    ok: failures.length === 0,
    pdfPath: relativeRepoPath(absolutePdfPath),
    pageCount,
    fileSize: existsSync(absolutePdfPath) ? statSync(absolutePdfPath).size : null,
    annotations: inspection.annotations,
    coverage,
    failures,
    warnings,
  };
}

function printHuman(result) {
  for (const failure of result.failures) {
    console.error(`FAIL: ${failure}`);
  }
  for (const warning of result.warnings) {
    console.warn(`WARN: ${warning}`);
  }
  for (const item of result.coverage) {
    console.log(
      `${item.status.toUpperCase()}: ${item.id} (${item.matchedTerms.join(', ') || 'no matched terms'})`
    );
  }
  if (result.ok) {
    console.log(
      `OK ATS preflight: ${result.pdfPath} (${result.pageCount} pages, ${result.fileSize} bytes)`
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runAtsCheck(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printHuman(result);
  }
  if (!result.ok) {
    process.exit(1);
  }
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
