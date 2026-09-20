import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  githubRepositoryFromRemote,
  stageTailoredPackage,
} from '../stage-tailored-package.mjs';

function writeFixture(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content);
  return absolutePath;
}

function git(targetRoot, args) {
  return execFileSync('git', ['-C', targetRoot, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Portfolio Test',
      GIT_AUTHOR_EMAIL: 'portfolio-test@example.com',
      GIT_COMMITTER_NAME: 'Portfolio Test',
      GIT_COMMITTER_EMAIL: 'portfolio-test@example.com',
    },
  }).trim();
}

test('GitHub remote URLs normalize to owner/repository', () => {
  assert.equal(
    githubRepositoryFromRemote(
      'https://github.com/wallymostafa/wallymostafa.github.io.git'
    ),
    'wallymostafa/wallymostafa.github.io'
  );
  assert.equal(
    githubRepositoryFromRemote(
      'git@github.com:wallymostafa/wallymostafa.github.io.git'
    ),
    'wallymostafa/wallymostafa.github.io'
  );
  assert.equal(
    githubRepositoryFromRemote('https://example.com/owner/repository.git'),
    null
  );
});

test('staging enforces the registered repository, dirty guard, and overwrite review', () => {
  const sourceRoot = mkdtempSync(
    path.join(os.tmpdir(), 'portfolio-stage-source-')
  );
  const targetRoot = mkdtempSync(
    path.join(os.tmpdir(), 'portfolio-stage-target-')
  );
  const previousRepoRoot = process.env.WORKFLOW_REPO_ROOT;
  process.env.WORKFLOW_REPO_ROOT = sourceRoot;

  const config = {
    workflowVersion: 2,
    contractRevision: 7,
    slug: 'proof-grid-fixture',
    artifactStem: 'Proof-Grid-Fixture',
    routeMode: 'scoped-projects',
    selectedProjects: [],
    route: {
      designConcept: 'proof-grid',
      projectAssetOverrides: {
        'project-01.html': {
          'assets/original.png': 'assets/fixture.png',
        },
      },
    },
    privacy: {
      publicSafe: true,
    },
  };
  const configPath = 'scripts/packages/proof-grid-fixture.json';

  try {
    writeFixture(sourceRoot, configPath, `${JSON.stringify(config, null, 2)}\n`);
    writeFixture(sourceRoot, 'proof-grid-fixture/index.html', '<h1>Fixture</h1>\n');
    writeFixture(
      sourceRoot,
      'proof-grid-fixture/design-concept.css',
      '.fixture { color: blue; }\n'
    );
    writeFixture(
      sourceRoot,
      'output/pdf/Wally-Mostafa-Proof-Grid-Fixture-Resume.pdf',
      'fixture-pdf'
    );
    writeFixture(
      sourceRoot,
      'scripts/resume-base-profiles.json',
      '{"schemaVersion":1}\n'
    );
    writeFixture(sourceRoot, 'assets/fixture.png', 'fixture-image');

    git(targetRoot, ['init', '-b', 'main']);
    writeFixture(targetRoot, 'README.md', '# Deployment target\n');
    git(targetRoot, ['add', 'README.md']);
    git(targetRoot, ['commit', '-m', 'Initialize target']);
    git(targetRoot, [
      'remote',
      'add',
      'origin',
      'https://github.com/wallymo/wallymo.github.io.git',
    ]);

    assert.throws(
      () =>
        stageTailoredPackage({
          configPath,
          targetRoot,
          validatePackage: false,
        }),
      /does not match wallymostafa\/wallymostafa\.github\.io/
    );

    git(targetRoot, [
      'remote',
      'set-url',
      'origin',
      'git@github.com:wallymostafa/wallymostafa.github.io.git',
    ]);
    const staged = stageTailoredPackage({
      configPath,
      targetRoot,
      validatePackage: false,
    });
    assert.equal(staged.publishRepository, 'wallymostafa/wallymostafa.github.io');
    assert.equal(staged.publicBase, 'https://wallymostafa.github.io/');
    assert.ok(staged.copied.includes('proof-grid-fixture/index.html'));
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/fixture.png'), 'utf8'),
      'fixture-image'
    );

    writeFixture(targetRoot, 'unrelated.txt', 'do not overwrite');
    assert.throws(
      () =>
        stageTailoredPackage({
          configPath,
          targetRoot,
          overwrite: true,
          validatePackage: false,
        }),
      /Target checkout has unrelated changes:[\s\S]*unrelated\.txt/
    );
    unlinkSync(path.join(targetRoot, 'unrelated.txt'));

    writeFixture(
      targetRoot,
      'proof-grid-fixture/index.html',
      '<h1>Local target edit</h1>\n'
    );
    assert.throws(
      () =>
        stageTailoredPackage({
          configPath,
          targetRoot,
          validatePackage: false,
        }),
      /rerun with --overwrite after review/
    );
    const overwritten = stageTailoredPackage({
      configPath,
      targetRoot,
      overwrite: true,
      validatePackage: false,
    });
    assert.ok(overwritten.copied.includes('proof-grid-fixture/index.html'));
    assert.equal(
      readFileSync(
        path.join(targetRoot, 'proof-grid-fixture/index.html'),
        'utf8'
      ),
      '<h1>Fixture</h1>\n'
    );
  } finally {
    if (previousRepoRoot === undefined) {
      delete process.env.WORKFLOW_REPO_ROOT;
    } else {
      process.env.WORKFLOW_REPO_ROOT = previousRepoRoot;
    }
    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(targetRoot, { recursive: true, force: true });
  }
});
