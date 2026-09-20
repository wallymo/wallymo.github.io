#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  RESUME_BASE_PROFILES_PATH,
  assertValidV2Config,
  findManifestPackage,
  getArtifactPaths,
  getPackagePublicBase,
  getPackageRepository,
  getRepoRoot,
  hasCoverLetterArtifact,
  isMain,
  readJson,
  relativeRepoPath,
  resolveRepoPath,
  scopedProjectAssets,
} from './lib/workflow-v2.mjs';
import { checkPackages } from './check-tailored-packages.mjs';

function usage() {
  console.error(
    'Usage: node scripts/stage-tailored-package.mjs --config <package-config.json> --target-root <git-checkout> [--overwrite]'
  );
}

function parseArgs(args) {
  const parsed = { overwrite: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--config') {
      parsed.configPath = args[index + 1];
      index += 1;
    } else if (arg === '--target-root') {
      parsed.targetRoot = args[index + 1];
      index += 1;
    } else if (arg === '--overwrite') {
      parsed.overwrite = true;
    } else if (arg === '--help') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!parsed.configPath || !parsed.targetRoot) {
    usage();
    throw new Error('--config and --target-root are required');
  }
  return parsed;
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function normalizeRelativePath(filePath) {
  const normalized = filePath.split(path.sep).join('/').replace(/^\.\//, '');
  if (
    !normalized ||
    path.isAbsolute(filePath) ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../')
  ) {
    throw new Error(`Unsafe artifact path: ${filePath}`);
  }
  return normalized;
}

function relativePathWithin(root, filePath, label) {
  const relative = path.relative(root, filePath);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`)) {
    throw new Error(`${label} must be inside ${root}`);
  }
  return normalizeRelativePath(relative);
}

function listRegularFiles(directory, root = directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing to stage symlink: ${absolutePath}`);
    }
    if (entry.isDirectory()) {
      files.push(...listRegularFiles(absolutePath, root));
    } else if (entry.isFile()) {
      files.push(normalizeRelativePath(path.relative(root, absolutePath)));
    }
  }
  return files.sort();
}

export function githubRepositoryFromRemote(remoteUrl) {
  const value = String(remoteUrl || '').trim();
  const match = value.match(
    /github\.com(?::|\/)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i
  );
  return match ? `${match[1]}/${match[2]}` : null;
}

function gitResult(targetRoot, args) {
  return spawnSync('git', ['-C', targetRoot, ...args], {
    encoding: 'utf8',
  });
}

function gitOutput(targetRoot, args, label) {
  const result = gitResult(targetRoot, args);
  if (result.status !== 0) {
    throw new Error(
      `${label}: ${(result.stderr || result.stdout || 'git command failed').trim()}`
    );
  }
  return result.stdout.trim();
}

function nulPaths(targetRoot, args) {
  const result = spawnSync('git', ['-C', targetRoot, ...args], {
    encoding: 'buffer',
  });
  if (result.status !== 0) {
    throw new Error(
      `Could not inspect target checkout: ${Buffer.from(
        result.stderr || result.stdout || ''
      )
        .toString('utf8')
        .trim()}`
    );
  }
  return Buffer.from(result.stdout || '')
    .toString('utf8')
    .split('\0')
    .filter(Boolean)
    .map(normalizeRelativePath);
}

export function dirtyTargetPaths(targetRoot) {
  return [
    ...new Set([
      ...nulPaths(targetRoot, ['diff', '--name-only', '-z']),
      ...nulPaths(targetRoot, ['diff', '--cached', '--name-only', '-z']),
      ...nulPaths(targetRoot, [
        'ls-files',
        '--others',
        '--exclude-standard',
        '-z',
      ]),
    ]),
  ].sort();
}

function assertSafeTargetRoot(targetRoot, sourceRoot) {
  const resolvedTarget = path.resolve(targetRoot);
  const filesystemRoot = path.parse(resolvedTarget).root;
  if (resolvedTarget === filesystemRoot || resolvedTarget === os.homedir()) {
    throw new Error('Target root must be a dedicated repository checkout');
  }
  if (!existsSync(resolvedTarget) || !statSync(resolvedTarget).isDirectory()) {
    throw new Error(`Target checkout does not exist: ${resolvedTarget}`);
  }
  const targetRealPath = realpathSync(resolvedTarget);
  if (targetRealPath === realpathSync(sourceRoot)) {
    throw new Error('Target root must be separate from the source repository');
  }
  const gitRoot = realpathSync(
    gitOutput(resolvedTarget, ['rev-parse', '--show-toplevel'], 'Invalid target checkout')
  );
  if (gitRoot !== targetRealPath) {
    throw new Error(`Target root must be the Git checkout root: ${gitRoot}`);
  }
  return targetRealPath;
}

function targetRemoteRepository(targetRoot) {
  const result = gitResult(targetRoot, ['remote', 'get-url', 'origin']);
  if (result.status !== 0) return null;
  const repository = githubRepositoryFromRemote(result.stdout);
  if (!repository) {
    throw new Error(`Target origin is not a github.com repository: ${result.stdout.trim()}`);
  }
  return repository;
}

function packageArtifactPaths(config, configPath) {
  const sourceRoot = getRepoRoot();
  const paths = getArtifactPaths(config);
  const routeRoot = resolveRepoPath(paths.slug);
  if (!existsSync(routeRoot) || !statSync(routeRoot).isDirectory()) {
    throw new Error(`Missing built route directory: ${paths.slug}`);
  }
  const configAbsolutePath = resolveRepoPath(configPath);
  const configRelativePath = relativePathWithin(
    sourceRoot,
    configAbsolutePath,
    'Package config'
  );
  const artifactPaths = [
    ...listRegularFiles(routeRoot).map((filePath) =>
      normalizeRelativePath(path.posix.join(paths.slug, filePath))
    ),
    configRelativePath,
    paths.resumePdfPath,
    ...scopedProjectAssets(config),
  ];
  if (config.contractRevision === 7) {
    artifactPaths.push(RESUME_BASE_PROFILES_PATH);
  }
  if (hasCoverLetterArtifact(config)) {
    artifactPaths.push(
      paths.coverLetterPdfPath,
      paths.coverLetterMarkdownPath
    );
  }
  return [...new Set(artifactPaths.map(normalizeRelativePath))].sort();
}

function validatePackageReady(config, configPath) {
  assertValidV2Config(config);
  const pkg = findManifestPackage(config.slug);
  if (!pkg) {
    throw new Error(`Package ${config.slug} is missing from scripts/tailored-packages.json`);
  }
  const expectedConfigPath = relativeRepoPath(resolveRepoPath(configPath));
  if (pkg.configPath !== expectedConfigPath) {
    throw new Error(
      `Manifest config mismatch: expected ${expectedConfigPath}, found ${pkg.configPath}`
    );
  }
  const packageCheck = checkPackages({ slug: config.slug });
  if (packageCheck.failures.length) {
    throw new Error(
      `Package checks must pass before staging:\n- ${packageCheck.failures.join('\n- ')}`
    );
  }
}

export function stageTailoredPackage({
  configPath,
  targetRoot,
  overwrite = false,
  validatePackage = true,
} = {}) {
  if (!configPath || !targetRoot) {
    throw new Error('configPath and targetRoot are required');
  }
  const sourceRoot = getRepoRoot();
  const config = readJson(configPath);
  if (validatePackage) validatePackageReady(config, configPath);
  if (config?.privacy?.publicSafe !== true) {
    throw new Error('Package config must set privacy.publicSafe to true');
  }

  const expectedRepository = getPackageRepository(config);
  const publicBase = getPackagePublicBase(config);
  const targetRealPath = assertSafeTargetRoot(targetRoot, sourceRoot);
  const actualRepository = targetRemoteRepository(targetRealPath);
  if (
    actualRepository &&
    actualRepository.toLowerCase() !== expectedRepository.toLowerCase()
  ) {
    throw new Error(
      `Target origin ${actualRepository} does not match ${expectedRepository}`
    );
  }

  const relativePaths = packageArtifactPaths(config, configPath);
  const plannedPaths = new Set(relativePaths);
  const dirtyPaths = dirtyTargetPaths(targetRealPath);
  const unrelatedDirtyPaths = dirtyPaths.filter(
    (filePath) => !plannedPaths.has(filePath)
  );
  if (unrelatedDirtyPaths.length) {
    throw new Error(
      `Target checkout has unrelated changes:\n- ${unrelatedDirtyPaths.join('\n- ')}`
    );
  }

  const conflicts = [];
  for (const relativePath of relativePaths) {
    const sourcePath = resolveRepoPath(relativePath);
    if (!existsSync(sourcePath) || !lstatSync(sourcePath).isFile()) {
      throw new Error(`Missing package artifact: ${relativePath}`);
    }
    if (lstatSync(sourcePath).isSymbolicLink()) {
      throw new Error(`Refusing to stage symlink: ${relativePath}`);
    }
    const targetPath = path.join(targetRealPath, relativePath);
    if (!existsSync(targetPath)) continue;
    const targetStat = lstatSync(targetPath);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      throw new Error(`Target artifact is not a regular file: ${relativePath}`);
    }
    if (sha256File(sourcePath) !== sha256File(targetPath)) {
      conflicts.push(relativePath);
    }
  }
  if (conflicts.length && !overwrite) {
    throw new Error(
      `Target artifacts differ; rerun with --overwrite after review:\n- ${conflicts.join('\n- ')}`
    );
  }

  const copied = [];
  const unchanged = [];
  for (const relativePath of relativePaths) {
    const sourcePath = resolveRepoPath(relativePath);
    const targetPath = path.join(targetRealPath, relativePath);
    if (
      existsSync(targetPath) &&
      sha256File(sourcePath) === sha256File(targetPath)
    ) {
      unchanged.push(relativePath);
      continue;
    }
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
    if (sha256File(sourcePath) !== sha256File(targetPath)) {
      throw new Error(`Staged checksum mismatch: ${relativePath}`);
    }
    copied.push(relativePath);
  }

  return {
    slug: getArtifactPaths(config).slug,
    publicBase,
    publishRepository: expectedRepository,
    targetRoot: targetRealPath,
    copied,
    unchanged,
    artifactPaths: relativePaths,
    warnings: actualRepository
      ? []
      : ['Target checkout has no origin remote; validate it before publishing.'],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = stageTailoredPackage(options);
  console.log(
    `OK staged ${result.slug} for ${result.publishRepository} (${result.publicBase})`
  );
  console.log(`Copied: ${result.copied.length}`);
  console.log(`Unchanged: ${result.unchanged.length}`);
  for (const warning of result.warnings) console.warn(`WARN: ${warning}`);
  console.log(`Target: ${result.targetRoot}`);
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
