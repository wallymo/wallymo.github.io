#!/usr/bin/env node

import { lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  approveHumanizerReview,
  assertHumanizerReviewCurrent,
  assertValidV2Config,
  humanizerCopyEntries,
  humanizerViolations,
  isMain,
  readJson,
  relativeRepoPath,
  resolveRepoPath,
  writeJson,
} from './lib/workflow-v2.mjs';

function usage() {
  console.error(
    'Usage: node scripts/humanizer-check.mjs --config scripts/packages/<slug>.json [--approve --semantic-pass-complete] [--rewrite-requested]'
  );
}

function parseArgs(args) {
  const parsed = {
    approve: false,
    rewriteRequested: false,
    semanticPassComplete: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') {
      parsed.configPath = args[index + 1];
      index += 1;
    } else if (arg === '--approve') {
      parsed.approve = true;
    } else if (arg === '--rewrite-requested') {
      parsed.rewriteRequested = true;
    } else if (arg === '--semantic-pass-complete') {
      parsed.semanticPassComplete = true;
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
  if (parsed.rewriteRequested && !parsed.approve) {
    throw new Error('--rewrite-requested can only be used with --approve');
  }
  if (parsed.semanticPassComplete && !parsed.approve) {
    throw new Error('--semantic-pass-complete can only be used with --approve');
  }
  if (parsed.approve && !parsed.semanticPassComplete) {
    throw new Error(
      '--approve requires --semantic-pass-complete after the full humanizer skill pass'
    );
  }
  return parsed;
}

function assertPackageConfigPath(absoluteConfigPath) {
  const packageDirectory = resolveRepoPath('scripts/packages');
  const relativePath = path.relative(packageDirectory, absoluteConfigPath);
  if (
    !relativePath ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath) ||
    path.dirname(relativePath) !== '.' ||
    path.extname(relativePath) !== '.json'
  ) {
    throw new Error(
      '--config must point directly to scripts/packages/<slug>.json'
    );
  }

  let packageDirectoryStats;
  let configStats;
  try {
    packageDirectoryStats = lstatSync(packageDirectory);
    configStats = lstatSync(absoluteConfigPath);
  } catch {
    throw new Error('--config must point to an existing package config');
  }
  if (
    packageDirectoryStats.isSymbolicLink() ||
    !packageDirectoryStats.isDirectory() ||
    configStats.isSymbolicLink() ||
    !configStats.isFile() ||
    configStats.nlink !== 1
  ) {
    throw new Error(
      '--config and scripts/packages must be regular, non-linked filesystem entries'
    );
  }

  const realRepoRoot = realpathSync(resolveRepoPath('.'));
  const realPackageDirectory = realpathSync(packageDirectory);
  const realConfigPath = realpathSync(absoluteConfigPath);
  if (
    realPackageDirectory !==
      path.join(realRepoRoot, 'scripts', 'packages') ||
    path.dirname(realConfigPath) !== realPackageDirectory
  ) {
    throw new Error('--config must resolve inside the repository package directory');
  }
}

export function runHumanizerCheck({
  configPath,
  approve = false,
  rewriteRequested = false,
  semanticPassComplete = false,
}) {
  const absoluteConfigPath = resolveRepoPath(configPath);
  assertPackageConfigPath(absoluteConfigPath);
  const config = readJson(absoluteConfigPath);
  if (!approve) {
    assertValidV2Config(config, { requireCurrentContract: true });
  }

  const violations = humanizerViolations(config);
  if (violations.length) {
    throw new Error(
      `Copy still contains obvious AI-writing patterns:\n- ${violations.join(
        '\n- '
      )}`
    );
  }

  if (approve) {
    approveHumanizerReview(config, {
      mode: rewriteRequested ? 'rewrite-requested' : 'surface-only',
      rewriteAuthorized: rewriteRequested,
      semanticPassComplete,
    });
    assertValidV2Config(config, { requireCurrentContract: true });
    writeJson(absoluteConfigPath, config);
  } else {
    assertHumanizerReviewCurrent(config);
  }

  return {
    configPath: relativeRepoPath(absoluteConfigPath),
    fieldsChecked: humanizerCopyEntries(config).length,
    status: config.copyReview.status,
    mode: config.copyReview.mode,
    copySha256: config.copyReview.copySha256,
  };
}

if (isMain(import.meta.url)) {
  try {
    const result = runHumanizerCheck(parseArgs(process.argv.slice(2)));
    console.log(
      `Humanizer copy gate passed for ${result.configPath} (${result.fieldsChecked} fields, ${result.mode}).`
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
