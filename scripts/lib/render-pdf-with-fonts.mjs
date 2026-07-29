#!/usr/bin/env node

import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

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
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    return [...document.fonts].map((font) => ({
      family: font.family,
      status: font.status,
    }));
  });
  const unloadedFonts = fontState.filter((font) => font.status !== 'loaded');
  if (unloadedFonts.length) {
    throw new Error(
      `Fonts did not finish loading: ${unloadedFonts
        .map((font) => font.family)
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
