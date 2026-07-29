#!/usr/bin/env node

import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ensureRegularFile,
  isMain,
  relativeRepoPath,
  resolveChromeExecutable,
  resolveRepoPath,
} from './lib/workflow-v2.mjs';

function usage() {
  console.error(
    'Usage: node scripts/render-resume-pdf.mjs --html <resume-html> --pdf <resume-pdf>'
  );
}

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
    } else if (arg === '--help') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!parsed.htmlPath || !parsed.pdfPath) {
    usage();
    throw new Error('Both --html and --pdf are required');
  }
  return parsed;
}

export function renderResumePdf({
  htmlPath,
  pdfPath,
  chromePath,
  waitForFonts = false,
} = {}) {
  const absoluteHtmlPath = ensureRegularFile(htmlPath, 'resume HTML');
  const absolutePdfPath = resolveRepoPath(pdfPath);
  const executable = chromePath || resolveChromeExecutable();
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'wally-resume-chrome-'));

  mkdirSync(path.dirname(absolutePdfPath), { recursive: true });
  if (existsSync(absolutePdfPath)) {
    rmSync(absolutePdfPath);
  }

  try {
    if (waitForFonts) {
      execFileSync(
        process.execPath,
        [
          resolveRepoPath('scripts/lib/render-pdf-with-fonts.mjs'),
          '--html',
          absoluteHtmlPath,
          '--pdf',
          absolutePdfPath,
          '--chrome',
          executable,
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 60_000,
        }
      );
    } else {
      execFileSync(
        executable,
        [
          '--headless=new',
          '--disable-gpu',
          '--disable-extensions',
          '--hide-scrollbars',
          '--run-all-compositor-stages-before-draw',
          '--virtual-time-budget=3000',
          '--no-pdf-header-footer',
          '--print-to-pdf-no-header',
          `--user-data-dir=${userDataDir}`,
          `--print-to-pdf=${absolutePdfPath}`,
          pathToFileURL(absoluteHtmlPath).href,
        ],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 45_000,
        }
      );
    }
  } finally {
    rmSync(userDataDir, { recursive: true, force: true });
  }

  if (!existsSync(absolutePdfPath)) {
    throw new Error(`Chrome did not create ${relativeRepoPath(absolutePdfPath)}`);
  }

  let browserVersion = path.basename(executable);
  try {
    browserVersion = execFileSync(executable, ['--version'], {
      encoding: 'utf8',
      timeout: 10_000,
    }).trim();
  } catch {
    // Rendering already proved the executable works; version metadata is optional.
  }

  return {
    browser: {
      name: path.basename(executable),
      version: browserVersion,
    },
    htmlPath: relativeRepoPath(absoluteHtmlPath),
    pdfPath: relativeRepoPath(absolutePdfPath),
    fontWait: waitForFonts,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = renderResumePdf(options);
  console.log(`OK rendered ${result.pdfPath}`);
  console.log(`Browser: ${result.browser.version}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
