import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
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

function writeMinimalStageSource(sourceRoot, { routeHtml }) {
  const config = {
    workflowVersion: 2,
    contractRevision: 7,
    slug: 'proof-grid-symlink-fixture',
    artifactStem: 'Proof-Grid-Symlink-Fixture',
    routeMode: 'scoped-projects',
    selectedProjects: [],
    route: {
      designConcept: 'proof-grid',
    },
    privacy: {
      publicSafe: true,
    },
  };
  const configPath = 'scripts/packages/proof-grid-symlink-fixture.json';

  writeFixture(
    sourceRoot,
    'concepts/portfolio-concepts.json',
    `${JSON.stringify(
      {
        schemaVersion: 1,
        concepts: [
          {
            id: 'editorial-proof',
            name: 'Editorial Proof',
            publicUrl: 'https://wallymo.github.io/',
            repository: 'wallymo/wallymo.github.io',
            homepageClass: 'editorial-proof-homepage',
            projectClass: 'editorial-proof-case-study',
            cssSources: [],
          },
          {
            id: 'proof-grid',
            name: 'Proof Grid',
            publicUrl: 'https://wally-mostafa.github.io/',
            repository: 'wally-mostafa/wally-mostafa.github.io',
            homepageClass: 'proof-grid-homepage',
            projectClass: 'proof-grid-case-study',
            cssSources: ['concepts/proof-grid/homepage.css'],
          },
        ],
      },
      null,
      2
    )}\n`
  );
  writeFixture(sourceRoot, configPath, `${JSON.stringify(config, null, 2)}\n`);
  writeFixture(
    sourceRoot,
    'proof-grid-symlink-fixture/index.html',
    routeHtml
  );
  writeFixture(
    sourceRoot,
    'proof-grid-symlink-fixture/design-concept.css',
    '.fixture { color: blue; }\n'
  );
  writeFixture(
    sourceRoot,
    'output/pdf/Wally-Mostafa-Proof-Grid-Symlink-Fixture-Resume.pdf',
    'fixture-pdf'
  );
  writeFixture(
    sourceRoot,
    'scripts/resume-base-profiles.json',
    '{"schemaVersion":1}\n'
  );

  return configPath;
}

function initializeStageTarget(targetRoot, extraPaths = []) {
  git(targetRoot, ['init', '-b', 'main']);
  writeFixture(targetRoot, 'README.md', '# Deployment target\n');
  git(targetRoot, ['add', 'README.md', ...extraPaths]);
  git(targetRoot, ['commit', '-m', 'Initialize target']);
  git(targetRoot, [
    'remote',
    'add',
    'origin',
    'git@github.com:wally-mostafa/wally-mostafa.github.io.git',
  ]);
}

test('GitHub remote URLs normalize to owner/repository', () => {
  assert.equal(
    githubRepositoryFromRemote(
      'https://github.com/wally-mostafa/wally-mostafa.github.io.git'
    ),
    'wally-mostafa/wally-mostafa.github.io'
  );
  assert.equal(
    githubRepositoryFromRemote(
      'git@github.com:wally-mostafa/wally-mostafa.github.io.git'
    ),
    'wally-mostafa/wally-mostafa.github.io'
  );
  assert.equal(
    githubRepositoryFromRemote('https://example.com/owner/repository.git'),
    null
  );
  assert.equal(
    githubRepositoryFromRemote(
      'git@notgithub.com:wally-mostafa/wally-mostafa.github.io.git'
    ),
    null
  );
  assert.equal(
    githubRepositoryFromRemote(
      'https://evil.example/github.com/wally-mostafa/wally-mostafa.github.io'
    ),
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
  let retiredBackupRoot = null;

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
    writeFixture(
      sourceRoot,
      'concepts/portfolio-concepts.json',
      `${JSON.stringify(
        {
          schemaVersion: 1,
          concepts: [
            {
              id: 'editorial-proof',
              name: 'Editorial Proof',
              publicUrl: 'https://wallymo.github.io/',
              repository: 'wallymo/wallymo.github.io',
              homepageClass: 'editorial-proof-homepage',
              projectClass: 'editorial-proof-case-study',
              cssSources: [],
            },
            {
              id: 'proof-grid',
              name: 'Proof Grid',
              publicUrl: 'https://wally-mostafa.github.io/',
              repository: 'wally-mostafa/wally-mostafa.github.io',
              homepageClass: 'proof-grid-homepage',
              projectClass: 'proof-grid-case-study',
              cssSources: ['concepts/proof-grid/homepage.css'],
            },
          ],
        },
        null,
        2
      )}\n`
    );
    writeFixture(sourceRoot, configPath, `${JSON.stringify(config, null, 2)}\n`);
    writeFixture(
      sourceRoot,
      'proof-grid-fixture/index.html',
      '<img src="../assets/missing.png" alt="Missing fixture">\n'
    );
    writeFixture(
      sourceRoot,
      'proof-grid-fixture/design-concept.css',
      '.fixture { color: blue; }\n'
    );
    writeFixture(
      sourceRoot,
      'proof-grid-fixture/notes.txt',
      'source-only notes must never be published\n'
    );
    writeFixture(
      sourceRoot,
      'proof-grid-fixture/extra.html',
      '<p>Linked but undeclared HTML must never be published</p>\n'
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
    writeFixture(
      sourceRoot,
      'assets/shared.css',
      '.shared { background-image: url("./shared.png"); }\n'
    );
    writeFixture(sourceRoot, 'assets/shared.png', 'shared-image');
    writeFixture(sourceRoot, 'assets/inline.png', 'inline-image');
    writeFixture(
      sourceRoot,
      'assets/runtime.js',
      'import "./module.js"; fetch("./runtime.json"); new URL("./worker.js", import.meta.url);\n'
    );
    writeFixture(sourceRoot, 'assets/module.js', 'export const ready = true;\n');
    writeFixture(sourceRoot, 'assets/worker.js', 'self.onmessage = () => {};\n');
    writeFixture(sourceRoot, 'assets/runtime.json', '{"ready":true}\n');
    writeFixture(
      sourceRoot,
      'assets/site.webmanifest',
      `${JSON.stringify({
        icons: [{ src: 'manifest-icon.png' }],
        screenshots: [{ src: 'manifest-shot.png' }],
        shortcuts: [{ icons: [{ src: 'manifest-shortcut.png' }] }],
      })}\n`
    );
    writeFixture(sourceRoot, 'assets/manifest-icon.png', 'manifest-icon');
    writeFixture(sourceRoot, 'assets/manifest-shot.png', 'manifest-shot');
    writeFixture(sourceRoot, 'assets/manifest-shortcut.png', 'manifest-shortcut');

    git(targetRoot, ['init', '-b', 'main']);
    writeFixture(targetRoot, 'README.md', '# Deployment target\n');
    git(targetRoot, ['add', 'README.md']);
    git(targetRoot, ['commit', '-m', 'Initialize target']);

    assert.throws(
      () =>
        stageTailoredPackage({
          configPath,
          targetRoot,
          validatePackage: false,
        }),
      /Target checkout is missing an origin remote/
    );

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
      /does not match wally-mostafa\/wally-mostafa\.github\.io/
    );

    git(targetRoot, [
      'remote',
      'set-url',
      'origin',
      'git@github.com:wally-mostafa/wally-mostafa.github.io.git',
    ]);
    assert.throws(
      () =>
        stageTailoredPackage({
          configPath,
          targetRoot,
          validatePackage: false,
        }),
      /Missing local reference \.\.\/assets\/missing\.png/
    );
    const routeHtml = '<link rel="stylesheet" href="../assets/shared.css"><link rel="manifest" href="../assets/site.webmanifest"><script src="../assets/runtime.js"></script><div style="background-image:url(\'../assets/inline.png\')"></div><h1>Fixture</h1>\n';
    writeFixture(sourceRoot, 'proof-grid-fixture/index.html', routeHtml);
    const staged = stageTailoredPackage({
      configPath,
      targetRoot,
      validatePackage: false,
    });
    assert.equal(
      staged.publishRepository,
      'wally-mostafa/wally-mostafa.github.io'
    );
    assert.equal(staged.publicBase, 'https://wally-mostafa.github.io/');
    assert.ok(staged.copied.includes('proof-grid-fixture/index.html'));
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/fixture.png'), 'utf8'),
      'fixture-image'
    );
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/shared.css'), 'utf8'),
      '.shared { background-image: url("./shared.png"); }\n'
    );
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/shared.png'), 'utf8'),
      'shared-image'
    );
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/inline.png'), 'utf8'),
      'inline-image'
    );
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/runtime.json'), 'utf8'),
      '{"ready":true}\n'
    );
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/manifest-shot.png'), 'utf8'),
      'manifest-shot'
    );
    assert.equal(
      existsSync(path.join(targetRoot, 'proof-grid-fixture/notes.txt')),
      false
    );
    assert.equal(
      existsSync(path.join(targetRoot, 'proof-grid-fixture/extra.html')),
      false
    );

    const deploymentRecordPath = path.join(
      targetRoot,
      '.portfolio-deployments/proof-grid-fixture.json'
    );
    assert.equal(staged.deploymentRecordPath, '.portfolio-deployments/proof-grid-fixture.json');
    assert.equal(existsSync(deploymentRecordPath), true);
    const deploymentRecord = JSON.parse(
      readFileSync(deploymentRecordPath, 'utf8')
    );
    assert.deepEqual(deploymentRecord.ownedArtifacts, [
      'output/pdf/Wally-Mostafa-Proof-Grid-Fixture-Resume.pdf',
      'proof-grid-fixture/design-concept.css',
      'proof-grid-fixture/index.html',
      'scripts/packages/proof-grid-fixture.json',
    ]);
    assert.deepEqual(deploymentRecord.sharedDependencies, [
      'assets/fixture.png',
      'assets/inline.png',
      'assets/manifest-icon.png',
      'assets/manifest-shortcut.png',
      'assets/manifest-shot.png',
      'assets/module.js',
      'assets/runtime.js',
      'assets/runtime.json',
      'assets/shared.css',
      'assets/shared.png',
      'assets/site.webmanifest',
      'assets/worker.js',
      'scripts/resume-base-profiles.json',
    ]);

    const deploymentRecordDirectory = path.dirname(deploymentRecordPath);
    unlinkSync(deploymentRecordPath);
    writeFixture(
      targetRoot,
      'proof-grid-fixture/index.html',
      '<h1>Rollback sentinel</h1>\n'
    );
    chmodSync(deploymentRecordDirectory, 0o500);
    try {
      assert.throws(
        () =>
          stageTailoredPackage({
            configPath,
            targetRoot,
            overwrite: true,
            validatePackage: false,
          }),
        /Staging failed and target was rolled back/
      );
      assert.equal(
        readFileSync(
          path.join(targetRoot, 'proof-grid-fixture/index.html'),
          'utf8'
        ),
        '<h1>Rollback sentinel</h1>\n'
      );
      assert.equal(existsSync(deploymentRecordPath), false);
    } finally {
      chmodSync(deploymentRecordDirectory, 0o700);
    }
    const recovered = stageTailoredPackage({
      configPath,
      targetRoot,
      overwrite: true,
      validatePackage: false,
    });
    assert.ok(recovered.copied.includes('proof-grid-fixture/index.html'));
    assert.equal(existsSync(deploymentRecordPath), true);

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
      routeHtml
    );

    const retiredRelativePath = 'proof-grid-fixture/retired.html';
    writeFixture(targetRoot, retiredRelativePath, '<p>Retired route file</p>\n');
    assert.throws(
      () =>
        stageTailoredPackage({
          configPath,
          targetRoot,
          validatePackage: false,
        }),
      /Target contains retired package artifacts; rerun with --overwrite after review:[\s\S]*proof-grid-fixture\/retired\.html/
    );
    const retired = stageTailoredPackage({
      configPath,
      targetRoot,
      overwrite: true,
      validatePackage: false,
    });
    retiredBackupRoot = retired.retiredBackupRoot;
    assert.deepEqual(retired.retiredArtifacts, [retiredRelativePath]);
    assert.equal(existsSync(path.join(targetRoot, retiredRelativePath)), false);
    assert.ok(retiredBackupRoot);
    assert.equal(
      readFileSync(path.join(retiredBackupRoot, retiredRelativePath), 'utf8'),
      '<p>Retired route file</p>\n'
    );
  } finally {
    if (previousRepoRoot === undefined) {
      delete process.env.WORKFLOW_REPO_ROOT;
    } else {
      process.env.WORKFLOW_REPO_ROOT = previousRepoRoot;
    }
    if (retiredBackupRoot) {
      rmSync(retiredBackupRoot, { recursive: true, force: true });
    }
    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(targetRoot, { recursive: true, force: true });
  }
});

test('staging follows transitive dependencies imported by an mjs entrypoint', () => {
  const sourceRoot = mkdtempSync(
    path.join(os.tmpdir(), 'portfolio-stage-mjs-source-')
  );
  const targetRoot = mkdtempSync(
    path.join(os.tmpdir(), 'portfolio-stage-mjs-target-')
  );
  const previousRepoRoot = process.env.WORKFLOW_REPO_ROOT;
  process.env.WORKFLOW_REPO_ROOT = sourceRoot;

  try {
    const configPath = writeMinimalStageSource(sourceRoot, {
      routeHtml:
        '<script type="module" src="../assets/runtime.mjs"></script>\n',
    });
    writeFixture(
      sourceRoot,
      'assets/runtime.mjs',
      'import "./module.mjs"; new URL("./runtime-data.json", import.meta.url);\n'
    );
    writeFixture(
      sourceRoot,
      'assets/module.mjs',
      'export const ready = true;\n'
    );
    writeFixture(sourceRoot, 'assets/runtime-data.json', '{"ready":true}\n');
    initializeStageTarget(targetRoot);

    const staged = stageTailoredPackage({
      configPath,
      targetRoot,
      validatePackage: false,
    });
    const stagedModuleDependencies = staged.artifactPaths.filter((filePath) =>
      [
        'assets/module.mjs',
        'assets/runtime-data.json',
        'assets/runtime.mjs',
      ].includes(filePath)
    );

    assert.deepEqual(stagedModuleDependencies, [
      'assets/module.mjs',
      'assets/runtime-data.json',
      'assets/runtime.mjs',
    ]);
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/module.mjs'), 'utf8'),
      'export const ready = true;\n'
    );
    assert.equal(
      readFileSync(path.join(targetRoot, 'assets/runtime-data.json'), 'utf8'),
      '{"ready":true}\n'
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

test(
  'staging rejects a source dependency whose ancestor is a symlink before copying it',
  { skip: process.platform === 'win32' },
  () => {
    const sourceRoot = mkdtempSync(
      path.join(os.tmpdir(), 'portfolio-stage-source-symlink-')
    );
    const targetRoot = mkdtempSync(
      path.join(os.tmpdir(), 'portfolio-stage-target-clean-')
    );
    const externalSourceRoot = mkdtempSync(
      path.join(os.tmpdir(), 'portfolio-stage-external-source-')
    );
    const previousRepoRoot = process.env.WORKFLOW_REPO_ROOT;
    process.env.WORKFLOW_REPO_ROOT = sourceRoot;

    try {
      const configPath = writeMinimalStageSource(sourceRoot, {
        routeHtml:
          '<img src="../assets/escape/secret.png" alt="External fixture">\n',
      });
      writeFixture(externalSourceRoot, 'secret.png', 'external-source-secret');
      mkdirSync(path.join(sourceRoot, 'assets'), { recursive: true });
      symlinkSync(
        externalSourceRoot,
        path.join(sourceRoot, 'assets/escape'),
        'dir'
      );
      initializeStageTarget(targetRoot);

      let stageError = null;
      try {
        stageTailoredPackage({
          configPath,
          targetRoot,
          validatePackage: false,
        });
      } catch (error) {
        stageError = error;
      }

      assert.equal(
        existsSync(path.join(targetRoot, 'assets/escape/secret.png')),
        false,
        'staging must not copy a file reached through a source ancestor symlink'
      );
      assert.ok(stageError instanceof Error, 'staging must reject the source symlink');
      assert.match(stageError.message, /symlink/i);
    } finally {
      if (previousRepoRoot === undefined) {
        delete process.env.WORKFLOW_REPO_ROOT;
      } else {
        process.env.WORKFLOW_REPO_ROOT = previousRepoRoot;
      }
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(externalSourceRoot, { recursive: true, force: true });
    }
  }
);

test(
  'staging rejects a target artifact whose ancestor is a symlink and leaves the external target untouched',
  { skip: process.platform === 'win32' },
  () => {
    const sourceRoot = mkdtempSync(
      path.join(os.tmpdir(), 'portfolio-stage-source-clean-')
    );
    const targetRoot = mkdtempSync(
      path.join(os.tmpdir(), 'portfolio-stage-target-symlink-')
    );
    const externalTargetRoot = mkdtempSync(
      path.join(os.tmpdir(), 'portfolio-stage-external-target-')
    );
    const previousRepoRoot = process.env.WORKFLOW_REPO_ROOT;
    process.env.WORKFLOW_REPO_ROOT = sourceRoot;

    try {
      const configPath = writeMinimalStageSource(sourceRoot, {
        routeHtml: '<img src="../assets/fixture.png" alt="Fixture">\n',
      });
      writeFixture(sourceRoot, 'assets/fixture.png', 'fixture-image');
      symlinkSync(externalTargetRoot, path.join(targetRoot, 'assets'), 'dir');
      initializeStageTarget(targetRoot, ['assets']);

      const externalArtifactPath = path.join(
        externalTargetRoot,
        'fixture.png'
      );
      let stageError = null;
      try {
        stageTailoredPackage({
          configPath,
          targetRoot,
          validatePackage: false,
        });
      } catch (error) {
        stageError = error;
      }

      assert.equal(
        existsSync(externalArtifactPath),
        false,
        'staging must not write through a target ancestor symlink'
      );
      assert.ok(stageError instanceof Error, 'staging must reject the target symlink');
      assert.match(stageError.message, /symlink/i);
    } finally {
      if (previousRepoRoot === undefined) {
        delete process.env.WORKFLOW_REPO_ROOT;
      } else {
        process.env.WORKFLOW_REPO_ROOT = previousRepoRoot;
      }
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(targetRoot, { recursive: true, force: true });
      rmSync(externalTargetRoot, { recursive: true, force: true });
    }
  }
);
