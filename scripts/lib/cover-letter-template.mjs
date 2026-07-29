import { pathToFileURL } from 'node:url';
import {
  PUBLIC_BASE,
  escapeHtml,
  resolveRepoPath,
} from './workflow-v2.mjs';

export const COVER_LETTER_TEMPLATE_VERSION =
  'real-chemistry-21grams-v1';

export function formatCoverLetterDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function buildCoverLetterMarkdown(config, paths) {
  const routeUrl = `${PUBLIC_BASE}${paths.slug}/`;
  const letter = config.coverLetter;
  return [
    '# Wally Mostafa',
    '',
    '[wmostafa12@gmail.com](mailto:wmostafa12@gmail.com) | 347-420-3558 | Raleigh, NC',
    '[LinkedIn](https://linkedin.com/in/wallymo) | [Portfolio](' + routeUrl + ')',
    '',
    formatCoverLetterDate(letter.date),
    '',
    letter.greeting,
    '',
    ...letter.paragraphs.flatMap((paragraph) => [paragraph, '']),
    letter.closing,
    '',
    letter.signature,
    '',
  ].join('\n');
}

export function buildCoverLetterHtml(config, paths) {
  const routeUrl = `${PUBLIC_BASE}${paths.slug}/`;
  const letter = config.coverLetter;
  const instrumentSansUrl = pathToFileURL(
    resolveRepoPath(
      'assets/fonts/cover-letter/instrument-sans-latin.woff2'
    )
  ).href;
  const syneUrl = pathToFileURL(
    resolveRepoPath('assets/fonts/cover-letter/syne-800-latin.woff2')
  ).href;
  const paragraphs = letter.paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join('\n\n    ');

  return `<!doctype html>
<html lang="en" data-cover-letter-template="${COVER_LETTER_TEMPLATE_VERSION}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Wally Mostafa - ${escapeHtml(config.job.company)} ${escapeHtml(config.job.roleTitle)} Cover Letter</title>
  <meta name="description" content="Wally Mostafa - cover letter for ${escapeHtml(config.job.roleTitle)} at ${escapeHtml(config.job.company)}.">
  <style>
    @font-face {
      font-display: block;
      font-family: 'Instrument Sans';
      font-style: normal;
      font-weight: 400 700;
      src: url('${instrumentSansUrl}') format('woff2');
    }

    @font-face {
      font-display: block;
      font-family: 'Syne';
      font-style: normal;
      font-weight: 800;
      src: url('${syneUrl}') format('woff2');
    }

    :root {
      --ink: #1a1714;
      --ink-soft: #38332d;
      --ink-muted: #5c5550;
      --surface: #f8f5f0;
      --font-display: 'Syne', sans-serif;
      --font-body: 'Instrument Sans', sans-serif;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: var(--surface);
      color: var(--ink);
      font-family: var(--font-body);
      font-size: 10.2pt;
      line-height: 1.54;
      padding: 3rem 1.25rem;
    }

    .letter {
      background: #fff;
      box-shadow: 0 18px 60px rgba(26, 23, 20, 0.12);
      margin: 0 auto;
      max-width: 7.2in;
      min-height: 10in;
      padding: 0.58in 0.62in;
    }

    header {
      border-bottom: 2px solid var(--ink);
      margin-bottom: 1rem;
      padding-bottom: 0.72rem;
      text-align: center;
    }

    h1 {
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: 0;
      line-height: 1;
      margin-bottom: 0.38rem;
      text-transform: uppercase;
    }

    .contact {
      color: var(--ink-muted);
      display: flex;
      flex-wrap: wrap;
      font-size: 9.4pt;
      gap: 0.45rem;
      justify-content: center;
    }

    .contact a {
      color: var(--ink);
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
    }

    .date {
      color: var(--ink-muted);
      margin-bottom: 0.9rem;
    }

    p {
      color: var(--ink-soft);
      margin-bottom: 0.65rem;
      orphans: 3;
      widows: 3;
    }

    .greeting,
    .signature {
      color: var(--ink);
      font-weight: 600;
    }

    .signature {
      margin-top: 0.85rem;
    }

    @page {
      size: Letter;
      margin: 0.58in 0.62in;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .letter {
        box-shadow: none;
        max-width: none;
        min-height: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <main class="letter">
    <header>
      <h1>WALLY MOSTAFA</h1>
      <div class="contact">
        <a href="mailto:wmostafa12@gmail.com">wmostafa12@gmail.com</a>
        <span>·</span>
        <span>347-420-3558</span>
        <span>·</span>
        <span>Raleigh, NC</span>
        <span>·</span>
        <a href="https://linkedin.com/in/wallymo">LinkedIn</a>
        <span>·</span>
        <a href="${routeUrl}">Portfolio</a>
      </div>
    </header>

    <p class="date">${escapeHtml(formatCoverLetterDate(letter.date))}</p>

    <p class="greeting">${escapeHtml(letter.greeting)}</p>

    ${paragraphs}

    <p>${escapeHtml(letter.closing)}</p>

    <p class="signature">${escapeHtml(letter.signature)}</p>
  </main>
</body>
</html>
`;
}
