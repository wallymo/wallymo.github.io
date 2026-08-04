#!/usr/bin/env node

import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--html') {
      parsed.htmlPath = args[index + 1];
      index += 1;
    } else if (arg === '--pdf') {
      parsed.pdfPath = args[index + 1];
      index += 1;
    } else if (arg === '--chrome') {
      parsed.chromePath = args[index + 1];
      index += 1;
    } else if (arg === '--font-profile') {
      parsed.fontProfile = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  for (const field of ['htmlPath', 'pdfPath', 'chromePath']) {
    if (!parsed[field]) {
      throw new Error(`Missing --${field.replace('Path', '')}`);
    }
  }
  return parsed;
}

function pdfFontCss() {
  const helperDirectory = path.dirname(fileURLToPath(import.meta.url));
  const fontDirectory = path.resolve(
    helperDirectory,
    '..',
    '..',
    'assets',
    'fonts',
    'pdf'
  );
  const fontUrl = (fileName) =>
    pathToFileURL(path.join(fontDirectory, fileName)).href;
  return `
    @font-face {
      font-family: 'Instrument Sans PDF';
      src: url('${fontUrl('InstrumentSans-Regular.ttf')}') format('truetype');
      font-style: normal;
      font-weight: 400;
      font-display: block;
    }
    @font-face {
      font-family: 'Instrument Sans PDF';
      src: url('${fontUrl('InstrumentSans-SemiBold.ttf')}') format('truetype');
      font-style: normal;
      font-weight: 600;
      font-display: block;
    }
    @font-face {
      font-family: 'Instrument Sans PDF';
      src: url('${fontUrl('InstrumentSans-Bold.ttf')}') format('truetype');
      font-style: normal;
      font-weight: 700;
      font-display: block;
    }
    @font-face {
      font-family: 'Instrument Sans PDF';
      src: url('${fontUrl('InstrumentSans-Italic.ttf')}') format('truetype');
      font-style: italic;
      font-weight: 400;
      font-display: block;
    }
    @font-face {
      font-family: 'Syne PDF';
      src: url('${fontUrl('Syne-Bold.ttf')}') format('truetype');
      font-style: normal;
      font-weight: 700;
      font-display: block;
    }
    @font-face {
      font-family: 'Syne PDF';
      src: url('${fontUrl('Syne-ExtraBold.ttf')}') format('truetype');
      font-style: normal;
      font-weight: 800;
      font-display: block;
    }
    :root {
      --font-display: 'Syne PDF', sans-serif !important;
      --font-body: 'Instrument Sans PDF', sans-serif !important;
    }
  `;
}

const REQUIRED_PDF_FONTS = [
  '400 12px "Instrument Sans PDF"',
  'italic 400 12px "Instrument Sans PDF"',
  '600 12px "Instrument Sans PDF"',
  '700 12px "Instrument Sans PDF"',
  '700 12px "Syne PDF"',
  '800 12px "Syne PDF"',
];

const options = parseArgs(process.argv.slice(2));
const browser = await chromium.launch({
  executablePath: options.chromePath,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.resolve(options.htmlPath)).href, {
    waitUntil: 'load',
    timeout: 30_000,
  });
  if (options.fontProfile === 'portfolio-pdf') {
    await page.addStyleTag({ content: pdfFontCss() });
  }
  const requiredFonts =
    options.fontProfile === 'portfolio-pdf' ? REQUIRED_PDF_FONTS : [];
  const fontState = await page.evaluate(async (fontSpecs) => {
    const required = await Promise.all(
      fontSpecs.map(async (spec) => ({
        spec,
        faces: (await document.fonts.load(spec)).length,
        loaded: document.fonts.check(spec),
      }))
    );
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    return required;
  }, requiredFonts);
  const unloadedFonts = fontState.filter(
    (font) => !font.loaded || font.faces === 0
  );
  if (unloadedFonts.length) {
    throw new Error(
      `Fonts did not finish loading: ${unloadedFonts
        .map((font) => font.spec)
        .join(', ')}`
    );
  }
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: path.resolve(options.pdfPath),
    displayHeaderFooter: false,
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
  });
} finally {
  await browser.close();
}
