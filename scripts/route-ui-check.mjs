#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import {
  assertValidV2Config,
  getArtifactPaths,
  isMain,
  readJson,
  resolveChromeExecutable,
  resolveRepoPath,
} from './lib/workflow-v2.mjs';

function usage() {
  console.error(
    'Usage: node scripts/route-ui-check.mjs --config <package-config.json>'
  );
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') {
      parsed.configPath = args[index + 1];
      index += 1;
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

export function runRouteUiCheck({ configPath }) {
  const config = readJson(configPath);
  assertValidV2Config(config);
  const paths = getArtifactPaths(config);
  const helperPath = resolveRepoPath('scripts/lib/route_ui_check.py');
  const outputDirectory = resolveRepoPath(paths.qaOutputDir);
  const args = [
    helperPath,
    '--root',
    resolveRepoPath('.'),
    '--slug',
    paths.slug,
    '--resume-pdf',
    paths.resumePdfPath,
    '--selected-projects',
    JSON.stringify(config.selectedProjects),
    '--route-mode',
    config.routeMode,
    '--output-dir',
    outputDirectory,
    '--chrome',
    resolveChromeExecutable(),
  ];
  try {
    const result = JSON.parse(
      execFileSync('python3', args, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120_000,
      })
    );
    rmSync(outputDirectory, { recursive: true, force: true });
    return result;
  } catch (error) {
    try {
      const result = JSON.parse(error.stdout?.toString() || '{}');
      if (result.errors?.length) {
        throw new Error(result.errors.join('\n'));
      }
    } catch (parsedError) {
      if (parsedError.message !== 'Unexpected end of JSON input') {
        throw parsedError;
      }
    }
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = runRouteUiCheck(options);
  console.log(
    `OK route UI QA: ${result.viewports.map((viewport) => viewport.name).join(', ')}`
  );
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.stderr?.toString().trim() || error.message}`);
    process.exit(1);
  });
}
