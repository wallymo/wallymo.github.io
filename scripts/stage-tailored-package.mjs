#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
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
  scopedProjectEntries,
  scopedProjectRedirectEntries,
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

function pathIsWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function assertSafeRepositoryPath(root, relativePath, label) {
  const normalized = normalizeRelativePath(relativePath);
  const rootRealPath = realpathSync(root);
  const parts = normalized.split('/');
  let currentPath = rootRealPath;

  for (let index = 0; index < parts.length; index += 1) {
    currentPath = path.join(currentPath, parts[index]);
    const entry = lstatSync(currentPath, { throwIfNoEntry: false });
    if (!entry) break;
    if (entry.isSymbolicLink()) {
      throw new Error(`${label} contains a symlink: ${normalized}`);
    }
    if (index < parts.length - 1 && !entry.isDirectory()) {
      throw new Error(`${label} has a non-directory ancestor: ${normalized}`);
    }
    const currentRealPath = realpathSync(currentPath);
    if (!pathIsWithin(rootRealPath, currentRealPath)) {
      throw new Error(`${label} escapes the repository: ${normalized}`);
    }
  }

  const absolutePath = path.join(rootRealPath, ...parts);
  if (!pathIsWithin(rootRealPath, absolutePath)) {
    throw new Error(`${label} escapes the repository: ${normalized}`);
  }
  return absolutePath;
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
  let repositoryPath = null;

  if (/^(?:https|ssh):\/\//i.test(value)) {
    try {
      const remote = new URL(value);
      if (
        !['https:', 'ssh:'].includes(remote.protocol.toLowerCase()) ||
        remote.hostname.toLowerCase() !== 'github.com' ||
        remote.search ||
        remote.hash
      ) {
        return null;
      }
      repositoryPath = remote.pathname;
    } catch {
      return null;
    }
  } else {
    const scpMatch = value.match(
      /^(?:[A-Za-z0-9._-]+@)?github\.com:([^?#]+)$/i
    );
    if (!scpMatch) return null;
    repositoryPath = scpMatch[1];
  }

  const normalizedPath = repositoryPath
    .replace(/^\/+|\/+$/g, '')
    .replace(/\.git$/i, '');
  const segments = normalizedPath.split('/');
  if (
    segments.length !== 2 ||
    segments.some(
      (segment) =>
        !/^[A-Za-z0-9._-]+$/.test(segment) ||
        segment === '.' ||
        segment === '..'
    )
  ) {
    return null;
  }
  return `${segments[0]}/${segments[1]}`;
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
  if (lstatSync(resolvedTarget).isSymbolicLink()) {
    throw new Error('Target root must not be a symbolic link');
  }
  const targetRealPath = realpathSync(resolvedTarget);
  const sourceRealPath = realpathSync(sourceRoot);
  if (
    pathIsWithin(sourceRealPath, targetRealPath) ||
    pathIsWithin(targetRealPath, sourceRealPath)
  ) {
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
  if (result.status !== 0) {
    throw new Error('Target checkout is missing an origin remote');
  }
  const repository = githubRepositoryFromRemote(result.stdout);
  if (!repository) {
    throw new Error(`Target origin is not a github.com repository: ${result.stdout.trim()}`);
  }
  return repository;
}

const DEPENDENCY_EXTENSIONS = new Set([
  '.css',
  '.avif',
  '.eot',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.js',
  '.json',
  '.m4a',
  '.mjs',
  '.mp3',
  '.mp4',
  '.otf',
  '.pdf',
  '.png',
  '.svg',
  '.ttf',
  '.wasm',
  '.wav',
  '.webm',
  '.webmanifest',
  '.webp',
  '.woff',
  '.woff2',
  '.xml',
]);

function routeArtifactPaths(config) {
  const paths = getArtifactPaths(config);
  const artifacts = [paths.routeIndexPath];
  if (config.route?.designConcept) {
    artifacts.push(paths.designConceptCssPath);
  }
  if (config.routeMode === 'scoped-projects') {
    for (const { output } of scopedProjectEntries(config)) {
      artifacts.push(normalizeRelativePath(path.posix.join(paths.slug, output)));
    }
    for (const { source } of scopedProjectRedirectEntries(config)) {
      artifacts.push(normalizeRelativePath(path.posix.join(paths.slug, source)));
    }
  }
  return [...new Set(artifacts.map(normalizeRelativePath))].sort();
}

function referenceCandidates(filePath, value) {
  const trimmed = String(value || '').trim();
  if (
    !trimmed ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return [];
  }
  const withoutSuffix = trimmed.split('#')[0].split('?')[0];
  if (!withoutSuffix) return [];
  const rawCandidates = [withoutSuffix];
  try {
    const decoded = decodeURIComponent(withoutSuffix);
    if (decoded !== withoutSuffix) rawCandidates.push(decoded);
  } catch {
    // Literal percent signs are valid filenames; retain the raw candidate.
  }
  return rawCandidates.map((candidate) =>
    normalizeRelativePath(
      candidate.startsWith('/')
        ? candidate.slice(1) || '.'
        : path.posix.normalize(
            path.posix.join(path.posix.dirname(filePath), candidate)
          )
    )
  );
}

function hrefRequiresFile(value) {
  const pathname = String(value || '').split('#')[0].split('?')[0];
  if (!pathname || pathname.endsWith('/')) return false;
  const extension = path.posix.extname(pathname).toLowerCase();
  return extension === '.html' || DEPENDENCY_EXTENSIONS.has(extension);
}

function localReferences(root, filePath) {
  const extension = path.posix.extname(filePath).toLowerCase();
  const source = readFileSync(
    assertSafeRepositoryPath(root, filePath, 'Package dependency'),
    'utf8'
  );
  const references = [];
  const addReference = (value, requiredFile = true) => {
    references.push({ requiredFile, value });
  };
  if (extension === '.html') {
    for (const match of source.matchAll(
      /\b(href|poster|src)\s*=\s*["']([^"']+)["']/gi
    )) {
      addReference(
        match[2],
        match[1].toLowerCase() !== 'href' || hrefRequiresFile(match[2])
      );
    }
    for (const match of source.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi)) {
      for (const candidate of match[1].split(',')) {
        addReference(candidate.trim().split(/\s+/)[0]);
      }
    }
    for (const match of source.matchAll(
      /url\(\s*["']?([^"')]+)["']?\s*\)/gi
    )) {
      addReference(match[1]);
    }
  } else if (extension === '.css') {
    for (const match of source.matchAll(
      /url\(\s*["']?([^"')]+)["']?\s*\)/gi
    )) {
      addReference(match[1]);
    }
    for (const match of source.matchAll(/@import\s+["']([^"']+)["']/gi)) {
      addReference(match[1]);
    }
  } else if (extension === '.js' || extension === '.mjs') {
    for (const match of source.matchAll(
      /(?:from\s+|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g
    )) {
      if (match[1].startsWith('.') || match[1].startsWith('/')) {
        addReference(match[1]);
      }
    }
    for (const match of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
      if (match[1].startsWith('.') || match[1].startsWith('/')) {
        addReference(match[1]);
      }
    }
    for (const match of source.matchAll(
      /new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g
    )) {
      addReference(match[1]);
    }
    for (const match of source.matchAll(
      /(?:fetch|importScripts|Worker|SharedWorker)\s*\(\s*["']([^"']+)["']/g
    )) {
      if (hrefRequiresFile(match[1])) addReference(match[1]);
    }
  } else if (extension === '.webmanifest') {
    const manifest = JSON.parse(source);
    for (const icon of manifest.icons || []) {
      if (typeof icon?.src === 'string') addReference(icon.src);
    }
    for (const screenshot of manifest.screenshots || []) {
      if (typeof screenshot?.src === 'string') addReference(screenshot.src);
    }
    for (const shortcut of manifest.shortcuts || []) {
      for (const icon of shortcut?.icons || []) {
        if (typeof icon?.src === 'string') addReference(icon.src);
      }
    }
  }
  return references;
}

function resolveDependencyClosure(
  routePaths,
  seedPaths,
  root = getRepoRoot()
) {
  const owned = new Set(routePaths);
  const dependencies = new Set(seedPaths.map(normalizeRelativePath));
  const queue = [...routePaths, ...dependencies];
  const inspected = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (inspected.has(current)) continue;
    inspected.add(current);
    const currentPath = assertSafeRepositoryPath(
      root,
      current,
      'Package dependency'
    );
    if (!existsSync(currentPath)) {
      throw new Error(`Missing package dependency: ${current}`);
    }
    const currentStat = lstatSync(currentPath);
    if (!currentStat.isFile() || currentStat.isSymbolicLink()) {
      throw new Error(`Package dependency is not a regular file: ${current}`);
    }
    const extension = path.posix.extname(current).toLowerCase();
    if (
      !['.css', '.html', '.js', '.mjs', '.webmanifest'].includes(extension)
    ) {
      continue;
    }
    for (const reference of localReferences(root, current)) {
      const candidates = referenceCandidates(current, reference.value);
      if (!candidates.length) continue;
      const candidateEntries = candidates.map((candidate) => ({
        candidate,
        candidatePath: assertSafeRepositoryPath(
          root,
          candidate,
          `Local reference from ${current}`
        ),
      }));
      const existingCandidates = candidateEntries.filter(({ candidatePath }) =>
        existsSync(candidatePath)
      );
      if (!existingCandidates.length) {
        if (reference.requiredFile) {
          throw new Error(
            `Missing local reference ${reference.value} from ${current}`
          );
        }
        continue;
      }
      for (const { candidate, candidatePath } of existingCandidates) {
        const candidateStat = lstatSync(candidatePath);
        if (candidateStat.isDirectory() && !reference.requiredFile) continue;
        if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) {
          throw new Error(
            `Local reference is not a regular file: ${candidate} from ${current}`
          );
        }
        const candidateExtension = path.posix.extname(candidate).toLowerCase();
        if (candidateExtension === '.html' && !owned.has(candidate)) {
          continue;
        }
        if (
          candidateExtension !== '.html' &&
          !DEPENDENCY_EXTENSIONS.has(candidateExtension)
        ) {
          throw new Error(
            `Unsupported local dependency type: ${candidate} from ${current}`
          );
        }
        if (!owned.has(candidate) && !dependencies.has(candidate)) {
          dependencies.add(candidate);
          queue.push(candidate);
        }
      }
    }
  }
  return [...dependencies].sort();
}

function packageArtifactPlan(config, configPath) {
  const sourceRoot = getRepoRoot();
  const paths = getArtifactPaths(config);
  const configAbsolutePath = resolveRepoPath(configPath);
  const configRelativePath = relativePathWithin(
    sourceRoot,
    configAbsolutePath,
    'Package config'
  );
  assertSafeRepositoryPath(sourceRoot, configRelativePath, 'Package config');
  const routePaths = routeArtifactPaths(config);
  const ownedArtifacts = [
    ...routePaths,
    configRelativePath,
    paths.resumePdfPath,
  ];
  if (hasCoverLetterArtifact(config)) {
    ownedArtifacts.push(
      paths.coverLetterPdfPath,
      paths.coverLetterMarkdownPath
    );
  }
  const dependencySeeds = [...scopedProjectAssets(config)];
  if (config.contractRevision === 7) {
    dependencySeeds.push(RESUME_BASE_PROFILES_PATH);
  }
  const sharedDependencies = resolveDependencyClosure(
    routePaths,
    dependencySeeds
  );
  const normalizedOwned = [
    ...new Set(ownedArtifacts.map(normalizeRelativePath)),
  ].sort();
  return {
    ownedArtifacts: normalizedOwned,
    sharedDependencies,
    routeArtifacts: routePaths,
    dependencySeeds: [...new Set(dependencySeeds.map(normalizeRelativePath))].sort(),
    artifactPaths: [
      ...new Set([...normalizedOwned, ...sharedDependencies]),
    ].sort(),
  };
}

function deploymentRecordRelativePath(slug) {
  return `.portfolio-deployments/${slug}.json`;
}

function readDeploymentRecord(targetRoot, slug) {
  const relativePath = deploymentRecordRelativePath(slug);
  const absolutePath = assertSafeRepositoryPath(
    targetRoot,
    relativePath,
    'Target deployment record'
  );
  if (!existsSync(absolutePath)) return null;
  const record = JSON.parse(readFileSync(absolutePath, 'utf8'));
  if (
    record?.schemaVersion !== 1 ||
    record?.slug !== slug ||
    !Array.isArray(record.ownedArtifacts) ||
    !Array.isArray(record.sharedDependencies)
  ) {
    throw new Error(`Invalid target deployment record: ${relativePath}`);
  }
  return record;
}

function safeRetiredOwnedArtifacts(record, config, configPath) {
  if (!record) return [];
  const paths = getArtifactPaths(config);
  const slugPrefix = `${paths.slug}/`;
  const configRelativePath = relativePathWithin(
    getRepoRoot(),
    resolveRepoPath(configPath),
    'Package config'
  );
  const oldStem =
    typeof record.artifactStem === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(record.artifactStem)
      ? record.artifactStem
      : null;
  const allowedOldFiles = new Set([configRelativePath]);
  if (oldStem) {
    allowedOldFiles.add(`output/pdf/Wally-Mostafa-${oldStem}-Resume.pdf`);
    allowedOldFiles.add(
      `output/pdf/Wally-Mostafa-${oldStem}-Cover-Letter.pdf`
    );
    allowedOldFiles.add(
      `output/pdf/Wally-Mostafa-${oldStem}-Cover-Letter.md`
    );
  }
  return record.ownedArtifacts
    .map(normalizeRelativePath)
    .filter(
      (relativePath) =>
        relativePath.startsWith(slugPrefix) ||
        allowedOldFiles.has(relativePath)
    );
}

function targetRouteFiles(targetRoot, slug) {
  const routeRoot = assertSafeRepositoryPath(
    targetRoot,
    slug,
    'Target route'
  );
  if (!existsSync(routeRoot)) return [];
  if (!statSync(routeRoot).isDirectory()) {
    throw new Error(`Target route is not a directory: ${slug}`);
  }
  return listRegularFiles(routeRoot).map((relativePath) =>
    normalizeRelativePath(path.posix.join(slug, relativePath))
  );
}

function backupTargetMutation(targetRoot, relativePaths) {
  const paths = [...new Set(relativePaths.map(normalizeRelativePath))].sort();
  if (!paths.length) return null;
  const backupRoot = mkdtempSync(path.join(os.tmpdir(), 'portfolio-stage-backup-'));
  const existing = [];
  const missing = [];
  try {
    for (const relativePath of paths) {
      const targetPath = assertSafeRepositoryPath(
        targetRoot,
        relativePath,
        'Target mutation path'
      );
      if (!existsSync(targetPath)) {
        missing.push(relativePath);
        continue;
      }
      const targetStat = lstatSync(targetPath);
      if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
        throw new Error(`Target mutation path is not a regular file: ${relativePath}`);
      }
      const backupPath = path.join(backupRoot, relativePath);
      mkdirSync(path.dirname(backupPath), { recursive: true });
      copyFileSync(targetPath, backupPath);
      if (sha256File(targetPath) !== sha256File(backupPath)) {
        throw new Error(`Target backup checksum mismatch: ${relativePath}`);
      }
      existing.push(relativePath);
    }
  } catch (error) {
    rmSync(backupRoot, { recursive: true, force: true });
    throw error;
  }
  return { backupRoot, existing, missing, paths };
}

function restoreTargetMutation(targetRoot, transaction) {
  if (!transaction) return;
  const failures = [];
  for (const relativePath of transaction.missing) {
    const targetPath = assertSafeRepositoryPath(
      targetRoot,
      relativePath,
      'Target rollback path'
    );
    if (!existsSync(targetPath)) continue;
    try {
      const targetStat = lstatSync(targetPath);
      if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
        throw new Error('created path is not a regular file');
      }
      unlinkSync(targetPath);
    } catch (error) {
      failures.push(`${relativePath}: ${error.message}`);
    }
  }
  for (const relativePath of transaction.existing) {
    try {
      const backupPath = path.join(transaction.backupRoot, relativePath);
      const targetPath = assertSafeRepositoryPath(
        targetRoot,
        relativePath,
        'Target rollback path'
      );
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(backupPath, targetPath);
      if (sha256File(backupPath) !== sha256File(targetPath)) {
        throw new Error('restored checksum mismatch');
      }
    } catch (error) {
      failures.push(`${relativePath}: ${error.message}`);
    }
  }
  if (failures.length) {
    throw new Error(`Target rollback failed:\n- ${failures.join('\n- ')}`);
  }
}

function verifyStagedPackage(targetRoot, plan, recordPath, expectedRecordText) {
  for (const relativePath of plan.artifactPaths) {
    const sourcePath = assertSafeRepositoryPath(
      getRepoRoot(),
      relativePath,
      'Source artifact'
    );
    const targetPath = assertSafeRepositoryPath(
      targetRoot,
      relativePath,
      'Staged artifact'
    );
    if (!existsSync(targetPath)) {
      throw new Error(`Staged artifact is missing: ${relativePath}`);
    }
    const targetStat = lstatSync(targetPath);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      throw new Error(`Staged artifact is not a regular file: ${relativePath}`);
    }
    if (sha256File(sourcePath) !== sha256File(targetPath)) {
      throw new Error(`Staged checksum mismatch: ${relativePath}`);
    }
  }
  const stagedClosure = resolveDependencyClosure(
    plan.routeArtifacts,
    plan.dependencySeeds,
    targetRoot
  );
  if (JSON.stringify(stagedClosure) !== JSON.stringify(plan.sharedDependencies)) {
    throw new Error('Staged dependency closure does not match the source package');
  }
  const targetRecordPath = assertSafeRepositoryPath(
    targetRoot,
    recordPath,
    'Target deployment record'
  );
  if (
    !existsSync(targetRecordPath) ||
    readFileSync(targetRecordPath, 'utf8') !== expectedRecordText
  ) {
    throw new Error(`Staged deployment record mismatch: ${recordPath}`);
  }
}

function deploymentRecord(config, plan, expectedRepository, publicBase) {
  return {
    schemaVersion: 1,
    slug: getArtifactPaths(config).slug,
    artifactStem: config.artifactStem,
    publishRepository: expectedRepository,
    publicBase,
    ownedArtifacts: plan.ownedArtifacts,
    sharedDependencies: plan.sharedDependencies,
    sha256: Object.fromEntries(
      plan.artifactPaths.map((relativePath) => [
        relativePath,
        sha256File(
          assertSafeRepositoryPath(
            getRepoRoot(),
            relativePath,
            'Source artifact'
          )
        ),
      ])
    ),
  };
}

function serializeDeploymentRecord(record) {
  return `${JSON.stringify(record, null, 2)}\n`;
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
  const configAbsolutePath = resolveRepoPath(configPath);
  const configRelativePath = relativePathWithin(
    sourceRoot,
    configAbsolutePath,
    'Package config'
  );
  const safeConfigPath = assertSafeRepositoryPath(
    sourceRoot,
    configRelativePath,
    'Package config'
  );
  const config = readJson(safeConfigPath);
  if (validatePackage) validatePackageReady(config, configPath);
  if (config?.privacy?.publicSafe !== true) {
    throw new Error('Package config must set privacy.publicSafe to true');
  }

  const expectedRepository = getPackageRepository(config);
  const publicBase = getPackagePublicBase(config);
  const targetRealPath = assertSafeTargetRoot(targetRoot, sourceRoot);
  const actualRepository = targetRemoteRepository(targetRealPath);
  if (
    actualRepository.toLowerCase() !== expectedRepository.toLowerCase()
  ) {
    throw new Error(
      `Target origin ${actualRepository} does not match ${expectedRepository}`
    );
  }

  const paths = getArtifactPaths(config);
  const plan = packageArtifactPlan(config, configPath);
  const relativePaths = plan.artifactPaths;
  const recordPath = deploymentRecordRelativePath(paths.slug);
  const previousRecord = readDeploymentRecord(targetRealPath, paths.slug);
  const currentArtifacts = new Set(plan.artifactPaths);
  const retiredArtifacts = new Set([
    ...safeRetiredOwnedArtifacts(previousRecord, config, configPath).filter(
      (relativePath) => !currentArtifacts.has(relativePath)
    ),
    ...targetRouteFiles(targetRealPath, paths.slug).filter(
      (relativePath) => !currentArtifacts.has(relativePath)
    ),
  ]);
  if (!hasCoverLetterArtifact(config)) {
    for (const relativePath of [
      paths.coverLetterPdfPath,
      paths.coverLetterMarkdownPath,
    ]) {
      const targetPath = assertSafeRepositoryPath(
        targetRealPath,
        relativePath,
        'Retired target artifact'
      );
      if (existsSync(targetPath)) {
        retiredArtifacts.add(relativePath);
      }
    }
  }
  const expectedRecord = deploymentRecord(
    config,
    plan,
    expectedRepository,
    publicBase
  );
  const expectedRecordText = serializeDeploymentRecord(expectedRecord);
  const plannedPaths = new Set([
    ...relativePaths,
    ...retiredArtifacts,
    recordPath,
  ]);
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
  const copyPaths = [];
  for (const relativePath of relativePaths) {
    const sourcePath = assertSafeRepositoryPath(
      sourceRoot,
      relativePath,
      'Source artifact'
    );
    if (!existsSync(sourcePath) || !lstatSync(sourcePath).isFile()) {
      throw new Error(`Missing package artifact: ${relativePath}`);
    }
    if (lstatSync(sourcePath).isSymbolicLink()) {
      throw new Error(`Refusing to stage symlink: ${relativePath}`);
    }
    const targetPath = assertSafeRepositoryPath(
      targetRealPath,
      relativePath,
      'Target artifact'
    );
    if (!existsSync(targetPath)) {
      copyPaths.push(relativePath);
      continue;
    }
    const targetStat = lstatSync(targetPath);
    if (!targetStat.isFile() || targetStat.isSymbolicLink()) {
      throw new Error(`Target artifact is not a regular file: ${relativePath}`);
    }
    if (sha256File(sourcePath) !== sha256File(targetPath)) {
      conflicts.push(relativePath);
      copyPaths.push(relativePath);
    }
  }
  const targetRecordPath = assertSafeRepositoryPath(
    targetRealPath,
    recordPath,
    'Target deployment record'
  );
  let recordNeedsWrite = !existsSync(targetRecordPath);
  if (!recordNeedsWrite) {
    const recordStat = lstatSync(targetRecordPath);
    if (!recordStat.isFile() || recordStat.isSymbolicLink()) {
      throw new Error(`Target deployment record is not a regular file: ${recordPath}`);
    }
    if (readFileSync(targetRecordPath, 'utf8') !== expectedRecordText) {
      conflicts.push(recordPath);
      recordNeedsWrite = true;
    }
  }
  if (retiredArtifacts.size && !overwrite) {
    throw new Error(
      `Target contains retired package artifacts; rerun with --overwrite after review:\n- ${[
        ...retiredArtifacts,
      ].join('\n- ')}`
    );
  }
  if (conflicts.length && !overwrite) {
    throw new Error(
      `Target artifacts differ; rerun with --overwrite after review:\n- ${conflicts.join('\n- ')}`
    );
  }

  const copyPathSet = new Set(copyPaths);
  const transaction = backupTargetMutation(targetRealPath, [
    ...copyPaths,
    ...retiredArtifacts,
    ...(recordNeedsWrite ? [recordPath] : []),
  ]);
  const copied = [];
  const unchanged = [];
  let retiredBackupRoot = null;
  try {
    for (const relativePath of relativePaths) {
      if (!copyPathSet.has(relativePath)) {
        unchanged.push(relativePath);
        continue;
      }
      const sourcePath = assertSafeRepositoryPath(
        sourceRoot,
        relativePath,
        'Source artifact'
      );
      const targetPath = assertSafeRepositoryPath(
        targetRealPath,
        relativePath,
        'Target artifact'
      );
      mkdirSync(path.dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
      copied.push(relativePath);
    }
    for (const relativePath of [...retiredArtifacts].sort()) {
      const targetPath = assertSafeRepositoryPath(
        targetRealPath,
        relativePath,
        'Retired target artifact'
      );
      if (existsSync(targetPath)) unlinkSync(targetPath);
    }
    if (recordNeedsWrite) {
      assertSafeRepositoryPath(
        targetRealPath,
        recordPath,
        'Target deployment record'
      );
      mkdirSync(path.dirname(targetRecordPath), { recursive: true });
      writeFileSync(targetRecordPath, expectedRecordText);
      copied.push(recordPath);
    } else {
      unchanged.push(recordPath);
    }
    verifyStagedPackage(
      targetRealPath,
      plan,
      recordPath,
      expectedRecordText
    );
    if (transaction) {
      if (retiredArtifacts.size) {
        retiredBackupRoot = transaction.backupRoot;
      } else {
        rmSync(transaction.backupRoot, { recursive: true, force: true });
      }
    }
  } catch (error) {
    let rollbackError = null;
    try {
      restoreTargetMutation(targetRealPath, transaction);
    } catch (restoreError) {
      rollbackError = restoreError;
    }
    if (transaction && !rollbackError) {
      rmSync(transaction.backupRoot, { recursive: true, force: true });
    }
    if (rollbackError) {
      throw new Error(
        `${error.message}\n${rollbackError.message}\nRecovery backup: ${transaction?.backupRoot || 'unavailable'}`
      );
    }
    throw new Error(`Staging failed and target was rolled back: ${error.message}`);
  }

  return {
    slug: paths.slug,
    publicBase,
    publishRepository: expectedRepository,
    targetRoot: targetRealPath,
    copied,
    unchanged,
    artifactPaths: relativePaths,
    deploymentRecordPath: recordPath,
    retiredArtifacts: [...retiredArtifacts].sort(),
    retiredBackupRoot,
    warnings: retiredBackupRoot
      ? [`Retired target artifacts were backed up to ${retiredBackupRoot}`]
      : [],
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
