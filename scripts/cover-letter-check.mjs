#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import {
  PUBLIC_BASE,
  assertHumanizerReviewCurrent,
  assertValidV2Config,
  ensureRegularFile,
  hasCoverLetterArtifact,
  isMain,
  normalizeText,
  readJson,
  resolveRepoPath,
} from './lib/workflow-v2.mjs';
import {
  COVER_LETTER_TEMPLATE_VERSION,
  formatCoverLetterDate,
} from './lib/cover-letter-template.mjs';

const MAX_PDF_BYTES = 2_500_000;

function usage() {
  console.error(
    'Usage: node scripts/cover-letter-check.mjs --config <package-config.json> --pdf <cover-letter.pdf> [--json]'
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

function pageCount(pdfPath) {
  const info = commandOutput('pdfinfo', [pdfPath]);
  const match = info.match(/^Pages:\s+(\d+)/m);
  if (!match) {
    throw new Error('pdfinfo did not report a page count');
  }
  return Number(match[1]);
}

function inspectPdf(pdfPath) {
  const helperPath = resolveRepoPath('scripts/lib/pdf_inspect.py');
  return JSON.parse(commandOutput('python3', [helperPath, pdfPath]));
}

function bboxWords(pdfPath) {
  const bbox = commandOutput('pdftotext', ['-bbox', pdfPath, '-']);
  return [...bbox.matchAll(
    /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]+)<\/word>/g
  )].map((match) => ({
    xMin: Number(match[1]),
    yMin: Number(match[2]),
    xMax: Number(match[3]),
    yMax: Number(match[4]),
    text: match[5]
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"'),
  }));
}

function firstWord(words, text) {
  return words.find((word) => word.text === text) || null;
}

function lastWord(words, text) {
  return [...words].reverse().find((word) => word.text === text) || null;
}

export function runCoverLetterCheck({ configPath, pdfPath }) {
  const config = readJson(configPath);
  assertValidV2Config(config);
  assertHumanizerReviewCurrent(config);
  if (!hasCoverLetterArtifact(config)) {
    throw new Error('The package contract does not include a cover letter');
  }

  const absolutePdfPath = ensureRegularFile(pdfPath, 'cover-letter PDF');
  const failures = [];
  let extractedText = '';
  let pages = null;
  let inspection = { annotations: [] };
  let fonts = '';
  let words = [];
  let pageInfo = '';

  try {
    extractedText = commandOutput('pdftotext', [
      '-layout',
      absolutePdfPath,
      '-',
    ]);
  } catch (error) {
    failures.push(`Cover-letter text extraction failed: ${error.message}`);
  }
  try {
    pages = pageCount(absolutePdfPath);
    pageInfo = commandOutput('pdfinfo', [absolutePdfPath]);
  } catch (error) {
    failures.push(`Cover-letter metadata inspection failed: ${error.message}`);
  }
  try {
    inspection = inspectPdf(absolutePdfPath);
  } catch (error) {
    failures.push(`Cover-letter annotation inspection failed: ${error.message}`);
  }
  try {
    fonts = commandOutput('pdffonts', [absolutePdfPath]);
  } catch (error) {
    failures.push(`Cover-letter font inspection failed: ${error.message}`);
  }
  try {
    words = bboxWords(absolutePdfPath);
  } catch (error) {
    failures.push(`Cover-letter layout inspection failed: ${error.message}`);
  }

  if (!extractedText.trim()) {
    failures.push('Cover-letter text extraction is empty');
  }
  if (extractedText.includes('\uFFFD')) {
    failures.push('Cover-letter text contains replacement characters');
  }
  if (/[\uFB00-\uFB06]/u.test(extractedText)) {
    failures.push('Cover-letter text contains ligature artifacts');
  }
  if (extractedText.includes('→') || extractedText.includes('—')) {
    failures.push('Cover-letter text contains an unsafe symbol');
  }
  if (pages !== null && pages !== 1) {
    failures.push(`Cover letter is ${pages} pages; it must be exactly 1`);
  }
  if (!/Page size:\s+612 x 792 pts \(letter\)/i.test(pageInfo)) {
    failures.push('Cover letter must use deterministic US Letter dimensions');
  }
  if (!/\bSyne(?:-|_)/i.test(fonts)) {
    failures.push('Cover letter is missing the canonical Syne display font');
  }
  if (!/\bInstrumentSans(?:-|_)/i.test(fonts)) {
    failures.push(
      'Cover letter is missing the canonical Instrument Sans body font'
    );
  }
  const sizeBytes = statSync(absolutePdfPath).size;
  if (sizeBytes > MAX_PDF_BYTES) {
    failures.push(`Cover letter exceeds the ${MAX_PDF_BYTES}-byte parser limit`);
  }

  const normalizedText = normalizeText(extractedText);
  for (const [label, value] of [
    ['name', 'Wally Mostafa'],
    ['company', config.job.company],
    ['role title', config.job.roleTitle],
    ['email', 'wmostafa12@gmail.com'],
    ['phone', '347-420-3558'],
    ['location', 'Raleigh, NC'],
    ['greeting', config.coverLetter.greeting],
    ...config.coverLetter.paragraphs.map((paragraph, index) => [
      `paragraph ${index + 1}`,
      paragraph,
    ]),
    ['closing', config.coverLetter.closing],
    ['signature', config.coverLetter.signature],
  ]) {
    if (!normalizedText.includes(normalizeText(value))) {
      failures.push(`Cover-letter ${label} is missing from extracted text`);
    }
  }

  const uris = inspection.annotations.map((annotation) => annotation.uri);
  const expectedPortfolio = `${PUBLIC_BASE}${config.slug}/`;
  if (!uris.includes(expectedPortfolio)) {
    failures.push(`Cover-letter Portfolio link must point to ${expectedPortfolio}`);
  }
  if (!uris.includes('https://linkedin.com/in/wallymo')) {
    failures.push('Cover-letter LinkedIn annotation is missing or incorrect');
  }
  if (!uris.includes('mailto:wmostafa12@gmail.com')) {
    failures.push('Cover-letter email annotation is missing or incorrect');
  }

  const headerWally = firstWord(words, 'WALLY');
  const headerMostafa = firstWord(words, 'MOSTAFA');
  const contactEmail = firstWord(words, 'wmostafa12@gmail.com');
  const dateWord = firstWord(
    words,
    formatCoverLetterDate(config.coverLetter.date).split(/\s+/)[0]
  );
  const greetingWord = firstWord(words, 'Dear');
  const signatureWord = lastWord(words, 'Wally');
  const nameCenter =
    headerWally && headerMostafa
      ? (headerWally.xMin + headerMostafa.xMax) / 2
      : null;
  for (const [label, word] of [
    ['display name', headerWally],
    ['display surname', headerMostafa],
    ['contact line', contactEmail],
    ['date', dateWord],
    ['greeting', greetingWord],
    ['signature', signatureWord],
  ]) {
    if (!word) {
      failures.push(`Cover-letter branded layout is missing the ${label}`);
    }
  }
  if (
    nameCenter !== null &&
    (Math.abs(nameCenter - 306) > 4 ||
      headerWally.yMin < 35 ||
      headerWally.yMin > 45)
  ) {
    failures.push(
      'Cover-letter display name is not in the canonical centered header position'
    );
  }
  if (
    contactEmail &&
    (contactEmail.xMin < 130 ||
      contactEmail.xMin > 145 ||
      contactEmail.yMin < 64 ||
      contactEmail.yMin > 73)
  ) {
    failures.push(
      'Cover-letter contact line is not in the canonical centered header position'
    );
  }
  for (const [label, word] of [
    ['date', dateWord],
    ['greeting', greetingWord],
    ['signature', signatureWord],
  ]) {
    if (word && (word.xMin < 44 || word.xMin > 46.5)) {
      failures.push(
        `Cover-letter ${label} does not use the canonical 0.62-inch left margin`
      );
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    pageCount: pages,
    sizeBytes,
    templateVersion: COVER_LETTER_TEMPLATE_VERSION,
    fonts: {
      display: 'Syne 800',
      body: 'Instrument Sans 400/600',
    },
    layout: {
      page: 'Letter',
      margin: '0.58in 0.62in',
      header: 'centered-rule',
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runCoverLetterCheck(options);
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(
      `OK cover letter: ${result.pageCount} page, ${result.sizeBytes} bytes`
    );
  } else {
    for (const failure of result.failures) {
      console.error(`FAIL: ${failure}`);
    }
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
