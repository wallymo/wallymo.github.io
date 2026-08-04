import assert from 'node:assert/strict';
import {
  appendFileSync,
  cpSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  RESUME_ROLE_IDS,
  approveHumanizerReview,
  assertBuildAllowed,
  assertHumanizerReviewCurrent,
  assertRecruiterFacingClaimsSupported,
  configInputSha256,
  humanizerCopyEntries,
  humanizerViolations,
  getResumeExperienceSections,
  getRoutePresentation,
  replaceElementContent,
  replacePortfolioLink,
  resolveChromeExecutable,
  resumeRoleBulletTexts,
  resumeRoleSubEntries,
  validateV2Config,
} from '../lib/workflow-v2.mjs';
import {
  assertChecksum,
  verifyTailoredRoute,
} from '../verify-tailored-route.mjs';
import {
  applicationDuplicateStatus,
  prepareApplication,
  recordAssessment,
  recordApplication,
  validateLedger,
  writeLedgerAtomic,
} from '../application-ledger.mjs';
import {
  COVER_LETTER_TEMPLATE_VERSION,
  buildCoverLetterHtml,
} from '../lib/cover-letter-template.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const node = process.execPath;

function run(args, options = {}) {
  return spawnSync(node, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
}

function schemaErrors(config) {
  const schemaPath = path.join(
    repoRoot,
    'scripts',
    'schemas',
    'package-v2.schema.json'
  );
  const validator = spawnSync(
    'python3',
    [
      '-c',
      [
        'import json, sys',
        'import jsonschema',
        'schema = json.load(open(sys.argv[1]))',
        'instance = json.load(sys.stdin)',
        'validator = jsonschema.Draft202012Validator(schema)',
        'errors = sorted(validator.iter_errors(instance), key=lambda error: list(error.absolute_path))',
        'print(json.dumps([error.message for error in errors]))',
      ].join('\n'),
      schemaPath,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      input: JSON.stringify(config),
    }
  );
  assert.equal(
    validator.status,
    0,
    `JSON Schema validation helper failed:\n${validator.stderr}`
  );
  return JSON.parse(validator.stdout);
}

function validConfig() {
  return JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'examples', 'package-v2.json'),
      'utf8'
    )
  );
}

function revision6Config() {
  const config = validConfig();
  config.contractRevision = 6;
  delete config.fitGate.resumeBase;
  delete config.resume.compositionMode;
  return config;
}

function resumeBaseFixtureData() {
  const foundation = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'resume-foundation.json'),
      'utf8'
    )
  );
  const registry = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'resume-base-profiles.json'),
      'utf8'
    )
  );
  const evidenceText = new Map();
  for (const [roleId, bullets] of Object.entries(foundation.roles)) {
    for (const bullet of bullets) {
      evidenceText.set(bullet.id, { roleId, text: bullet.text });
    }
  }
  for (const evidence of registry.evidenceAdditions) {
    evidenceText.set(evidence.id, {
      roleId: evidence.roleId,
      text: evidence.text,
    });
  }
  return { foundation, registry, evidenceText };
}

function accountLeadershipConfig() {
  const config = validConfig();
  const { foundation, registry, evidenceText } = resumeBaseFixtureData();
  const profile = registry.profiles['account-leadership'];

  config.classification.targetLane = 'client-account-delivery';
  config.classification.evidenceMode = 'resume-primary';
  config.classification.primarySource =
    'The resume directly proves sustained account ownership, client leadership, budgets, and coordinated delivery.';
  config.classification.supportingSource =
    'The portfolio supports later UX, analytics, and AI delivery judgment.';
  config.requirements[1] = {
    ...config.requirements[1],
    id: 'core-account-leadership',
    text: 'Own strategic client relationships and coordinated account delivery.',
    evidence: [
      'Eight years of direct account leadership covered client relationships, budgets, briefs, and cross-functional delivery.',
    ],
    proofIds: ['account-management-02'],
    resumeTerms: ['account leadership'],
    matchMode: 'exact',
  };
  config.fitGate.resumeBase = {
    mode: 'account-leadership',
    sourceProfiles: [{ id: 'account-leadership', version: 1 }],
    leadProfileId: 'account-leadership',
    accountPresentation: 'agency-progression',
    action: 'tailor-to-jd',
    rationale:
      'The role is centered on account ownership, client relationships, and coordinated delivery rather than AI product implementation.',
  };
  config.fitGate.supportedOverlap = [
    'Eight years of direct account management and later client-facing product work match the role operating center.',
  ];
  config.fitGate.recommendation =
    'Proceed from the Account Leadership base and tailor the positioning to the employer job description.';
  config.positioning = {
    laneId: 'client-account-delivery',
    targetIdentity: 'account and client leader',
    employerNeed:
      'Own strategic relationships and keep client priorities, account decisions, and delivery aligned.',
    bridgeType: 'direct',
    applicationStrategy: 'direct',
    bridgeThesis: 'connect client priorities, account decisions, and delivery',
    proofIds: [
      'account-management-02',
      'account-management-03',
      'kinesso-01',
    ],
    remainingGap: null,
  };
  config.resume.compositionMode = 'profile-complete';
  config.resume.layoutDensity = 'compact';
  config.resume.summary =
    'Account and client leader with 15 years across healthcare, enterprise products, and AI-enabled delivery. I connect client priorities, account decisions, and delivery through eight years managing Fortune 500 relationships and budgets up to $20M, later UX leadership that grew a team from 2 to 30, and current work taking client-led AI initiatives from discovery through working products.';
  config.resume.skillIds = [
    'client-account-leadership',
    'program-project-delivery',
    'client-success-product-adoption',
    'consultative-sales-solution-delivery',
  ];
  config.resume.skills = config.resume.skillIds.map((skillId) => {
    const skill = foundation.skillBank.find((candidate) => candidate.id === skillId);
    return { label: skill.label, description: skill.description };
  });
  config.resume.experienceSections = [
    {
      heading: 'Account Management Experience',
      roleIds: ['account-management'],
    },
    {
      heading: 'Most Recent Experience',
      roleIds: [
        'hedgehox',
        'one-block-away',
        'kinesso',
        'omnicom',
        'heartbeat',
      ],
    },
  ];
  for (const roleId of RESUME_ROLE_IDS) {
    if (roleId === 'account-management') {
      continue;
    }
    const sourceIds = profile.requiredSourceIds[roleId];
    config.resume.sourceBulletIds[roleId] = [...sourceIds];
    config.resume.roles[roleId] = sourceIds.map(
      (sourceId) => evidenceText.get(sourceId).text
    );
  }
  config.resume.roles['account-management'] = profile.accountSubEntries.map(
    (subEntry) => ({
      title: subEntry.title,
      employer: subEntry.employer,
      location: subEntry.location,
      dateRange: subEntry.dateRange,
      bullets: subEntry.sourceIds.map(
        (sourceId) => evidenceText.get(sourceId).text
      ),
    })
  );
  config.resume.sourceBulletIds['account-management'] =
    profile.accountSubEntries.flatMap((subEntry) => subEntry.sourceIds);
  config.hero.intro =
    'I connect client priorities, account decisions, and delivery. For this role, I bring eight years managing Fortune 500 accounts and budgets up to $20M, experience leading integrated programs across complex teams, and recent UX and AI work that strengthened discovery, solution design, adoption, and client follow-through from the first conversation through a working product.';
  return config;
}

function hybridSelectiveConfig() {
  const config = accountLeadershipConfig();
  config.fitGate.resumeBase = {
    mode: 'hybrid-selective',
    sourceProfiles: [
      { id: 'account-leadership', version: 1 },
      { id: 'ai-product-implementation', version: 1 },
    ],
    leadProfileId: 'account-leadership',
    accountPresentation: 'agency-progression',
    action: 'tailor-to-jd',
    rationale:
      'The role gives core weight to strategic account ownership and client-facing AI product implementation.',
  };
  config.resume.compositionMode = 'hybrid-selective';

  const keepRoleIds = {
    hedgehox: ['hedgehox-03'],
    'one-block-away': [
      'one-block-away-01',
      'one-block-away-02',
      'one-block-away-03',
      'one-block-away-04',
      'one-block-away-05',
    ],
    kinesso: ['kinesso-01'],
    omnicom: ['omnicom-01'],
    heartbeat: ['heartbeat-01'],
  };
  for (const [roleId, sourceIds] of Object.entries(keepRoleIds)) {
    const oldIds = config.resume.sourceBulletIds[roleId];
    const oldBullets = config.resume.roles[roleId];
    config.resume.sourceBulletIds[roleId] = [...sourceIds];
    config.resume.roles[roleId] = sourceIds.map(
      (sourceId) => oldBullets[oldIds.indexOf(sourceId)]
    );
  }
  const accountIdsByEntry = [
    ['addition:scout-xyrem-account-lead'],
    ['account-management-02'],
    ['addition:barker-tough-mudder-pdi'],
    ['addition:cdm-lipitor-zoloft-digital'],
    ['account-management-01'],
    ['addition:rosetta-prevenar-client-contact'],
  ];
  const originalAccountIds = config.resume.sourceBulletIds['account-management'];
  const originalAccountBullets = resumeRoleBulletTexts(
    config.resume,
    'account-management'
  );
  config.resume.roles['account-management'] =
    config.resume.roles['account-management'].map((subEntry, index) => ({
      ...subEntry,
      bullets: accountIdsByEntry[index].map(
        (sourceId) => originalAccountBullets[originalAccountIds.indexOf(sourceId)]
      ),
    }));
  config.resume.sourceBulletIds['account-management'] =
    accountIdsByEntry.flat();
  config.requirements[1].proofIds = ['account-management-02'];
  config.requirements.push({
    id: 'core-ai-implementation',
    text: 'Translate client needs into working AI workflows and products.',
    priority: 'core',
    source: 'jd',
    confidence: 'explicit',
    evidenceStatus: 'direct',
    evidence: [
      'Current work converts client and agency needs into functional AI tools and review workflows.',
    ],
    proofIds: ['hedgehox-03'],
    destinations: ['summary', 'experience', 'portfolio'],
    resumeTerms: ['AI implementation'],
    matchMode: 'exact',
  });
  config.positioning.proofIds = [
    'account-management-02',
    'hedgehox-03',
    'kinesso-01',
  ];
  return config;
}

function aiLedHybridSelectiveConfig() {
  const config = hybridSelectiveConfig();
  const { foundation, evidenceText } = resumeBaseFixtureData();
  config.classification.targetLane = 'ai-product-implementation';
  config.classification.evidenceMode = 'balanced';
  config.classification.primarySource =
    'The resume and portfolio directly prove client-facing AI workflow design, product decisions, and functional implementation.';
  config.classification.supportingSource =
    'Earlier account leadership supports strategic relationship ownership and coordinated delivery.';
  config.fitGate.resumeBase.leadProfileId = 'ai-product-implementation';
  config.fitGate.resumeBase.accountPresentation = 'consolidated';
  config.fitGate.resumeBase.rationale =
    'AI product implementation is the lead discipline, while direct strategic account ownership remains a core responsibility rather than incidental client contact.';
  config.positioning = {
    laneId: 'ai-product-implementation',
    targetIdentity: 'client-facing AI product implementation leader',
    employerNeed:
      'Turn client priorities into useful AI workflows while owning strategic relationships and delivery decisions.',
    bridgeType: 'direct',
    applicationStrategy: 'direct',
    bridgeThesis: 'turn client priorities into working AI workflows',
    proofIds: ['hedgehox-03', 'account-management-02', 'one-block-away-01'],
    remainingGap: null,
  };
  config.resume.summary =
    'Client-facing AI product implementation leader with 15 years across healthcare, enterprise platforms, and account delivery. I turn client priorities into working AI workflows, guide product decisions from discovery through implementation, and bring eight years of earlier account leadership managing Fortune 500 relationships and budgets up to $20M. The result is practical delivery grounded in both client trust and product judgment.';
  config.resume.skillIds = [
    'ai-implementation-workflow-design',
    'product-strategy-poc-delivery',
    'client-account-leadership',
    'program-project-delivery',
  ];
  config.resume.skills = config.resume.skillIds.map((skillId) => {
    const skill = foundation.skillBank.find((candidate) => candidate.id === skillId);
    return { label: skill.label, description: skill.description };
  });
  config.resume.experienceSections = [
    {
      heading: 'AI & Product Implementation Experience',
      roleIds: ['hedgehox', 'one-block-away', 'kinesso', 'omnicom', 'heartbeat'],
    },
    {
      heading: 'Account Leadership Experience',
      roleIds: ['account-management'],
    },
  ];
  config.resume.roles['account-management'] = [
    evidenceText.get('account-management-02').text,
  ];
  config.resume.sourceBulletIds['account-management'] = [
    'account-management-02',
  ];
  config.hero.intro =
    'I turn client priorities into working AI workflows. For this role, I bring current implementation work across regulated review, brief intake, scoping, and decision support; enterprise product leadership at scale; and eight years of earlier account ownership that taught me how to guide relationships, budgets, and cross-functional delivery without losing sight of what the client needs.';
  return config;
}

function recommendedCoverLetter() {
  return {
    trigger: 'bridge-recommended',
    date: '2026-07-29',
    greeting: 'Dear Company hiring team,',
    paragraphs: [
      'I am applying for the Company Role because the work sits at the intersection of customer needs, product decisions, and delivery. That has been the center of my career across healthcare, enterprise software, and practical AI implementation. I can bring a clear view of the problem, turn it into something teams can use, and keep stakeholders aligned from the first conversation through launch.',
      'At Hedgehox, I have translated pharma agency needs into working AI tools for claim review, brief intake, scoping, review routing, and FDA signal monitoring. The work requires more than a concept deck. I define the workflow, build the functional product, test the review logic, and shape a demo that helps clients and investors understand what is useful now and what should come next.',
      'I have also led at enterprise scale. At Kinesso, I grew product design from 2 to 30 people across the US and Poland while supporting analytics products used by more than 7,000 people across 22 white-label brands. Earlier in my career, I managed Fortune 500 pharma and healthcare relationships with $2M-$50M+ budgets, which taught me how to connect client priorities with the teams responsible for delivery.',
      'The target domain is adjacent to the direct experience shown on my resume, but the operating center is familiar: understand the need, make the path concrete, and earn confidence through delivery. My background gives me a practical bridge between clients, product teams, and the people who have to adopt the work.',
    ],
    closing:
      'I would welcome the chance to discuss how that mix of client leadership, product judgment, and hands-on delivery could support the Company team.',
    signature: 'Wally Mostafa',
    proofIds: ['hedgehox-03', 'one-block-away-04'],
  };
}

function setFit(config, fitClass) {
  config.fitClass = fitClass;
  if (fitClass === 'strong') {
    config.coverLetter = null;
    config.positioning.bridgeType = 'direct';
    config.positioning.applicationStrategy = 'direct';
    config.positioning.remainingGap = null;
    config.fitGate.coverLetterBridge = {
      status: 'not-needed',
      rationale:
        'The resume and portfolio directly prove the role core, so a cover letter is not needed to make the case.',
    };
  } else if (fitClass === 'adjacent') {
    config.coverLetter = recommendedCoverLetter();
    config.positioning.bridgeType = 'operating-center';
    config.positioning.applicationStrategy = 'transferable';
    config.positioning.remainingGap =
      'The target domain is adjacent to the direct experience shown.';
    config.fitGate.coverLetterBridge = {
      status: 'recommended',
      rationale:
        'We can make the case with a cover letter by connecting supported enterprise delivery skills to the role while naming the remaining domain gap.',
    };
  } else if (fitClass === 'stretch') {
    config.coverLetter = recommendedCoverLetter();
    config.positioning.bridgeType = 'domain-transfer';
    config.positioning.applicationStrategy = 'approved-stretch';
    config.positioning.remainingGap =
      'The resume does not directly prove the target domain at the requested depth.';
    config.fitGate.coverLetterBridge = {
      status: 'recommended',
      rationale:
        'We can make the case with a cover letter using supported transferable evidence, subject to explicit stretch approval.',
    };
  } else if (fitClass === 'not-fit') {
    config.coverLetter = null;
    config.positioning.bridgeType = 'not-credible';
    config.positioning.applicationStrategy = 'stop';
    config.positioning.remainingGap =
      'A central hard requirement is unsupported by the available evidence.';
    config.fitGate.coverLetterBridge = {
      status: 'not-credible',
      rationale:
        'A cover letter cannot bridge the materially different operating center without unsupported claims.',
    };
  }
  return config;
}

function git(tempRoot, args) {
  const result = spawnSync('git', args, {
    cwd: tempRoot,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
}

function initializeGit(tempRoot) {
  git(tempRoot, ['init', '-q']);
  git(tempRoot, ['config', 'user.email', 'workflow-v2@example.com']);
  git(tempRoot, ['config', 'user.name', 'Workflow v2 Test']);
}

function commitAll(tempRoot, message) {
  git(tempRoot, ['add', '-A']);
  git(tempRoot, ['commit', '-qm', message]);
}

function snapshotDirectory(directoryPath) {
  if (!existsSync(directoryPath)) {
    return new Map();
  }
  const snapshot = new Map();

  function walk(currentDirectory) {
    for (const entry of readdirSync(currentDirectory)) {
      const absoluteEntry = path.join(currentDirectory, entry);
      if (statSync(absoluteEntry).isDirectory()) {
        walk(absoluteEntry);
      } else {
        snapshot.set(
          path.relative(directoryPath, absoluteEntry),
          readFileSync(absoluteEntry)
        );
      }
    }
  }

  walk(directoryPath);
  return snapshot;
}

function assertDirectorySnapshot(directoryPath, expected) {
  const actual = snapshotDirectory(directoryPath);
  assert.deepEqual([...actual.keys()].sort(), [...expected.keys()].sort());
  for (const [relativePath, expectedContent] of expected) {
    assert.deepEqual(actual.get(relativePath), expectedContent);
  }
}

function createBuildFixture({
  slug = 'workflow-v2-fixture',
  artifactStem = 'Workflow-V2-Fixture',
  fitClass = 'strong',
  routeMode = 'canonical-projects',
  selectedProjects = ['project-01.html', 'project-02.html', 'project-03.html'],
} = {}) {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'workflow-v2-fixture-'));
  for (const file of [
    'index.html',
    'resume.html',
    'project-01.html',
    'project-02.html',
    'project-03.html',
    'project-04.html',
    'project-05.html',
    'project-06.html',
    'project-07.html',
    'favicon.ico',
    'apple-touch-icon.png',
    'site.webmanifest',
  ]) {
    cpSync(path.join(repoRoot, file), path.join(tempRoot, file));
  }
  symlinkSync(path.join(repoRoot, 'assets'), path.join(tempRoot, 'assets'));
  mkdirSync(path.join(tempRoot, 'scripts', 'packages'), { recursive: true });
  mkdirSync(path.join(tempRoot, 'scripts', 'lib'), { recursive: true });
  cpSync(
    path.join(repoRoot, 'scripts', 'resume-foundation.json'),
    path.join(tempRoot, 'scripts', 'resume-foundation.json')
  );
  cpSync(
    path.join(repoRoot, 'scripts', 'resume-base-profiles.json'),
    path.join(tempRoot, 'scripts', 'resume-base-profiles.json')
  );
  cpSync(
    path.join(repoRoot, 'scripts', 'lib', 'pdf_inspect.py'),
    path.join(tempRoot, 'scripts', 'lib', 'pdf_inspect.py')
  );
  cpSync(
    path.join(repoRoot, 'scripts', 'lib', 'route_ui_check.py'),
    path.join(tempRoot, 'scripts', 'lib', 'route_ui_check.py')
  );
  cpSync(
    path.join(repoRoot, 'scripts', 'lib', 'render-pdf-with-fonts.mjs'),
    path.join(tempRoot, 'scripts', 'lib', 'render-pdf-with-fonts.mjs')
  );
  writeFileSync(
    path.join(tempRoot, 'scripts', 'tailored-packages.json'),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        workflowVersions: [1, 2],
        packages: [],
      },
      null,
      2
    )}\n`
  );

  const config = validConfig();
  config.slug = slug;
  config.roleTitle = 'Workflow v2 Fixture';
  config.artifactStem = artifactStem;
  setFit(config, fitClass);
  config.routeMode = routeMode;
  if (routeMode === 'canonical-projects') {
    config.route.presentation = 'full';
  }
  config.selectedProjects = selectedProjects;
  config.job.company = 'Fixture Company';
  config.job.roleTitle = 'Fixture Role';
  if (config.coverLetter) {
    config.coverLetter.greeting = 'Dear Fixture Company hiring team,';
    config.coverLetter.paragraphs[0] =
      config.coverLetter.paragraphs[0].replace(
        'Company Role',
        'Fixture Role'
      );
    config.coverLetter.closing = config.coverLetter.closing.replace(
      'Company team',
      'Fixture Company team'
    );
  }
  config.job.rawJd =
    'AI implementation, product strategy, and stakeholder work.';
  config.requirements[0].text = 'AI implementation';
  config.constraints.blockedTerms = ['Python engineering'];
  config.hero.eyebrow = 'Workflow v2 Fixture';
  config.hero.intro =
    'I connect customer needs, product decisions, and delivery. For this role, that means turning unclear requirements into working AI products while keeping the review steps teams depend on. I have built regulated tools from discovery through functional software, led systems used by 7,000+ people across 22 brands, and managed $2M-$50M+ client portfolios.';
  approveHumanizerReview(config, {
    reviewedAt: '2026-07-22T12:00:00.000Z',
    semanticPassComplete: true,
  });
  const configPath = path.join(
    tempRoot,
    'scripts',
    'packages',
    `${slug}.json`
  );
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  return { tempRoot, config, configPath };
}

async function startFixtureServer(tempRoot, { transform } = {}) {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url, 'http://127.0.0.1');
    let relativePath = decodeURIComponent(requestUrl.pathname).replace(
      /^\/+/,
      ''
    );
    if (!relativePath || relativePath.endsWith('/')) {
      relativePath = path.join(relativePath, 'index.html');
    }
    const absolutePath = path.resolve(tempRoot, relativePath);
    if (
      !absolutePath.startsWith(`${tempRoot}${path.sep}`) ||
      !existsSync(absolutePath) ||
      !statSync(absolutePath).isFile()
    ) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    const content = readFileSync(absolutePath);
    response.writeHead(200);
    response.end(transform ? transform(relativePath, content) : content);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    publicBase: `http://127.0.0.1:${address.port}/`,
  };
}

test('v2 example satisfies the enforced config contract', () => {
  assert.deepEqual(validateV2Config(validConfig()), []);
});

test('revision 7 requires a valid resume-base decision and reserves use-existing for networking', () => {
  const missingDecision = validConfig();
  delete missingDecision.fitGate.resumeBase;
  assert.match(
    validateV2Config(missingDecision).join('\n'),
    /fitGate\.resumeBase is required for revision 7/
  );
  assert.ok(schemaErrors(missingDecision).length > 0);

  const employerReuse = validConfig();
  employerReuse.fitGate.resumeBase.action = 'use-existing';
  assert.match(
    validateV2Config(employerReuse).join('\n'),
    /use-existing is allowed only for a general networking profile|every employer job description must use.*tailor-to-jd/
  );

  const networkingReuse = validConfig();
  networkingReuse.job.jobId = 'general-profile';
  networkingReuse.job.sourceChannel = 'user-requested-general-resume';
  networkingReuse.fitGate.resumeBase.action = 'use-existing';
  assert.deepEqual(validateV2Config(networkingReuse), []);
  assert.throws(
    () => assertBuildAllowed(networkingReuse),
    /selected use-existing.*Wally-Mostafa-Resume\.pdf/
  );
  assert.doesNotThrow(() =>
    assertBuildAllowed(networkingReuse, { allowExistingRefresh: true })
  );

  const incompatibleLane = validConfig();
  incompatibleLane.classification.targetLane = 'client-account-delivery';
  incompatibleLane.positioning.laneId = 'client-account-delivery';
  assert.match(
    validateV2Config(incompatibleLane).join('\n'),
    /positioning\.laneId is not compatible with the selected lead resume profile/
  );
});

test('revision 7 account-leadership profile preserves the approved agency progression and evidence floor', () => {
  const account = accountLeadershipConfig();
  assert.deepEqual(validateV2Config(account), []);
  assert.deepEqual(schemaErrors(account), []);
  assert.equal(
    resumeRoleSubEntries(account.resume, 'account-management').length,
    6
  );
  assert.equal(account.resume.sourceBulletIds['one-block-away'].length, 5);

  const removedEvidence = structuredClone(account);
  removedEvidence.resume.roles['account-management'][0].bullets.shift();
  removedEvidence.resume.sourceBulletIds['account-management'].shift();
  assert.match(
    validateV2Config(removedEvidence).join('\n'),
    /must retain every required account-leadership profile source ID|must retain its complete approved account evidence/
  );

  const changedEmployer = structuredClone(account);
  changedEmployer.resume.roles['account-management'][0].employer =
    'Different Agency';
  assert.match(
    validateV2Config(changedEmployer).join('\n'),
    /employer must match the approved account profile/
  );
});

test('pure account and pure AI roles remain single-profile despite incidental technology or client language', () => {
  const account = accountLeadershipConfig();
  account.job.rawJd =
    'Own strategic accounts and coordinated delivery for a technology-enabled service.';
  assert.deepEqual(validateV2Config(account), []);
  assert.equal(account.fitGate.resumeBase.mode, 'account-leadership');

  const aiProduct = validConfig();
  aiProduct.job.rawJd =
    'Lead AI product implementation through client discovery and workflow design.';
  assert.deepEqual(validateV2Config(aiProduct), []);
  assert.equal(aiProduct.fitGate.resumeBase.mode, 'ai-product-implementation');
});

test('resume summaries have no hard word-count gate', () => {
  const shortSummary = validConfig();
  shortSummary.resume.summary =
    'AI product and implementation leader. I connect customer needs, product decisions, and delivery.';
  assert.ok(shortSummary.resume.summary.trim().split(/\s+/).length < 45);
  assert.deepEqual(validateV2Config(shortSummary), []);

  const longSummary = validConfig();
  longSummary.resume.summary = [
    longSummary.resume.summary,
    'My work also includes client discovery, regulated review workflows, enterprise design leadership, product adoption, and cross-functional delivery across healthcare and large software organizations.',
    'That range gives me a practical view of how a useful idea becomes a working product and how teams earn confidence in it.',
  ].join(' ');
  assert.ok(longSummary.resume.summary.trim().split(/\s+/).length > 65);
  assert.deepEqual(validateV2Config(longSummary), []);
});

test('revision 7 hybrid-selective draws from both evidence pools without concatenating them', () => {
  const hybrid = hybridSelectiveConfig();
  const { registry } = resumeBaseFixtureData();
  const combinedProfileIds = new Set(
    Object.values(registry.profiles).flatMap((profile) =>
      Object.values(profile.requiredSourceIds).flat()
    )
  );
  assert.deepEqual(validateV2Config(hybrid), []);
  assert.deepEqual(schemaErrors(hybrid), []);
  const selectedEvidenceCount = Object.values(
    hybrid.resume.sourceBulletIds
  ).flat().length;
  assert.equal(combinedProfileIds.size, 34);
  assert.ok(selectedEvidenceCount < combinedProfileIds.size);
  assert.equal(hybrid.resume.sourceBulletIds['one-block-away'].length, 5);

  const missingAiCore = structuredClone(hybrid);
  missingAiCore.requirements = missingAiCore.requirements.filter(
    (requirement) => requirement.id !== 'core-ai-implementation'
  );
  assert.match(
    validateV2Config(missingAiCore).join('\n'),
    /hybrid-selective requires direct core requirements backed by selected account-leadership and AI\/product evidence/
  );

  const missingFounderEvidence = structuredClone(hybrid);
  missingFounderEvidence.resume.roles['one-block-away'].pop();
  missingFounderEvidence.resume.sourceBulletIds['one-block-away'].pop();
  assert.match(
    validateV2Config(missingFounderEvidence).join('\n'),
    /must retain the complete One Block Away foundation section/
  );

  const wrongAgency = structuredClone(hybrid);
  const scoutId = wrongAgency.resume.sourceBulletIds['account-management'][0];
  wrongAgency.resume.sourceBulletIds['account-management'][0] =
    'addition:barker-tough-mudder-pdi';
  wrongAgency.resume.sourceBulletIds['account-management'][2] = scoutId;
  assert.match(
    validateV2Config(wrongAgency).join('\n'),
    /moves approved evidence to the wrong agency entry/
  );
});

test('revision 7 supports an AI-led hybrid with consolidated account evidence', () => {
  const hybrid = aiLedHybridSelectiveConfig();
  assert.deepEqual(validateV2Config(hybrid), []);
  assert.deepEqual(schemaErrors(hybrid), []);
  assert.equal(
    hybrid.fitGate.resumeBase.leadProfileId,
    'ai-product-implementation'
  );
  assert.equal(hybrid.fitGate.resumeBase.accountPresentation, 'consolidated');
  assert.equal(
    resumeRoleSubEntries(hybrid.resume, 'account-management'),
    null
  );
  assert.equal(
    hybrid.resume.experienceSections[0].heading,
    'AI & Product Implementation Experience'
  );

  const wrongLeadOrder = aiLedHybridSelectiveConfig();
  wrongLeadOrder.resume.experienceSections.reverse();
  assert.match(
    validateV2Config(wrongLeadOrder).join('\n'),
    /experienceSections must begin with the selected lead profile/
  );

  const invalidAgencyBlocks = aiLedHybridSelectiveConfig();
  invalidAgencyBlocks.resume.roles['account-management'] =
    hybridSelectiveConfig().resume.roles['account-management'];
  assert.match(
    validateV2Config(invalidAgencyBlocks).join('\n'),
    /consolidated account presentation must use the consolidated account block/
  );
});

test('revisions 5 through 7 preserve every foundation bullet in foundation-complete mode', () => {
  const edited = validConfig();
  edited.resume.roles.hedgehox[0] =
    'Built and iterated the functional Claims Detection POC that secured an investor.';
  assert.deepEqual(validateV2Config(edited), []);

  const added = validConfig();
  added.resume.roles.hedgehox.push(
    'Added a supported JD-specific result without replacing prior experience.'
  );
  added.resume.sourceBulletIds.hedgehox.push('addition:jd-specific-result');
  assert.deepEqual(validateV2Config(added), []);

  const duplicateAddition = structuredClone(added);
  duplicateAddition.resume.roles.omnicom.push(
    'A second added bullet cannot reuse an addition ID.'
  );
  duplicateAddition.resume.sourceBulletIds.omnicom.push(
    'addition:jd-specific-result'
  );
  assert.match(
    validateV2Config(duplicateAddition).join('\n'),
    /must be unique across the full resume/
  );

  const removed = validConfig();
  removed.resume.roles.hedgehox.splice(2, 1);
  removed.resume.sourceBulletIds.hedgehox.splice(2, 1);
  assert.match(
    validateV2Config(removed).join('\n'),
    /must retain every foundation bullet/
  );

  const reordered = validConfig();
  reordered.resume.roles['one-block-away'].reverse();
  reordered.resume.sourceBulletIds['one-block-away'].reverse();
  assert.deepEqual(validateV2Config(reordered), []);

  const movedBetweenEmployers = validConfig();
  movedBetweenEmployers.resume.roles['one-block-away'].push(
    movedBetweenEmployers.resume.roles.hedgehox.shift()
  );
  movedBetweenEmployers.resume.sourceBulletIds['one-block-away'].push(
    movedBetweenEmployers.resume.sourceBulletIds.hedgehox.shift()
  );
  assert.match(
    validateV2Config(movedBetweenEmployers).join('\n'),
    /must retain every foundation bullet|contains an unknown source ID/
  );

  const changedSummary = validConfig();
  changedSummary.resume.summary =
    'AI product and implementation leader with 15 years in healthcare and enterprise software. I connect customer needs, product decisions, and delivery. I have moved regulated AI work from discovery into functional products, scaled systems used by 7,000+ people across 22 brands, and managed $2M-$50M+ Fortune 500 client portfolios.';
  assert.deepEqual(validateV2Config(changedSummary), []);

  const changedSkills = validConfig();
  const foundation = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'resume-foundation.json'),
      'utf8'
    )
  );
  changedSkills.resume.skillIds = [
    'client-account-leadership',
    'program-project-delivery',
    'client-success-product-adoption',
    'consultative-sales-solution-delivery',
  ];
  changedSkills.resume.skills = changedSkills.resume.skillIds.map((skillId) => {
    const skill = foundation.skillBank.find(
      (candidate) => candidate.id === skillId
    );
    return { label: skill.label, description: skill.description };
  });
  assert.deepEqual(validateV2Config(changedSkills), []);

  const inventedSkill = structuredClone(changedSkills);
  inventedSkill.resume.skills[0].description = 'A newly invented skill line.';
  assert.match(
    validateV2Config(inventedSkill).join('\n'),
    /must match the selected foundation skill definitions and order/
  );
});

test('curated resume mode requires explicit user authorization and keeps evidence under the original job', () => {
  const curated = revision6Config();
  curated.resume.compositionMode = 'curated-user-authorized';
  curated.resume.curationAuthorization = {
    authorizedBy: 'user',
    authorizedAt: '2026-07-29',
    scope: 'Pure account-management resume only.',
    reason:
      'The user authorized removing and rewriting lower-value bullets so direct account work carries more weight.',
  };
  for (const roleId of [
    'hedgehox',
    'one-block-away',
    'kinesso',
    'omnicom',
    'heartbeat',
  ]) {
    curated.resume.roles[roleId] = curated.resume.roles[roleId].slice(0, 1);
    curated.resume.sourceBulletIds[roleId] =
      curated.resume.sourceBulletIds[roleId].slice(0, 1);
  }
  curated.resume.roles['account-management'].push(
    'Added a supported account-management result.'
  );
  curated.resume.sourceBulletIds['account-management'].push(
    'addition:account-result'
  );
  assert.deepEqual(validateV2Config(curated), []);

  const missingAuthorization = structuredClone(curated);
  delete missingAuthorization.resume.curationAuthorization;
  assert.match(
    validateV2Config(missingAuthorization).join('\n'),
    /resume\.curationAuthorization is required/
  );

  const emptyFoundationRole = structuredClone(curated);
  emptyFoundationRole.resume.roles.hedgehox = [
    'An addition cannot replace all source evidence for a job.',
  ];
  emptyFoundationRole.resume.sourceBulletIds.hedgehox = [
    'addition:replacement-only',
  ];
  assert.match(
    validateV2Config(emptyFoundationRole).join('\n'),
    /must retain at least one foundation bullet under its original job/
  );

  const movedEvidence = structuredClone(curated);
  movedEvidence.resume.roles.omnicom.push(
    curated.resume.roles.hedgehox[0]
  );
  movedEvidence.resume.sourceBulletIds.omnicom.push(
    curated.resume.sourceBulletIds.hedgehox[0]
  );
  assert.match(
    validateV2Config(movedEvidence).join('\n'),
    /contains an unknown source ID/
  );
});

test('curated resume mode supports per-agency sub-entries with flat source mapping', () => {
  const curated = revision6Config();
  curated.resume.compositionMode = 'curated-user-authorized';
  curated.resume.curationAuthorization = {
    authorizedBy: 'user',
    authorizedAt: '2026-07-30',
    scope: 'Healthcare account management resume only.',
    reason:
      'The user authorized splitting consolidated account work into per-agency entries with curated bullets.',
  };
  const foundationBullets = structuredClone(
    curated.resume.roles['account-management']
  );
  const foundationIds = structuredClone(
    curated.resume.sourceBulletIds['account-management']
  );
  curated.resume.roles['account-management'] = [
    {
      title: 'Account Supervisor / Digital Strategist',
      employer: 'Scout Marketing',
      location: 'San Diego, CA',
      dateRange: 'Jun 2015 - Jul 2018',
      bullets: [
        'Led the XYREM consumer account across digital, social, TV, and print work.',
      ],
    },
    {
      title: 'Senior Account Executive',
      employer: 'FCB Health',
      dateRange: 'Apr 2011 - Jun 2015',
      bullets: foundationBullets,
    },
  ];
  curated.resume.sourceBulletIds['account-management'] = [
    'addition:scout-xyrem-lead',
    ...foundationIds,
  ];
  assert.deepEqual(validateV2Config(curated), []);
  assert.deepEqual(schemaErrors(curated), []);
  assert.equal(
    resumeRoleSubEntries(curated.resume, 'account-management').length,
    2
  );
  assert.equal(resumeRoleSubEntries(curated.resume, 'hedgehox'), null);
  assert.deepEqual(
    resumeRoleBulletTexts(curated.resume, 'account-management'),
    [
      'Led the XYREM consumer account across digital, social, TV, and print work.',
      ...foundationBullets,
    ]
  );

  const entries = humanizerCopyEntries(curated);
  assert.ok(
    entries.some(
      ([field, value]) =>
        field === 'resume.roles.account-management[0].title' &&
        value === 'Account Supervisor / Digital Strategist'
    )
  );
  assert.ok(
    entries.some(
      ([field]) => field === 'resume.roles.account-management[1].bullets[2]'
    )
  );
  assert.ok(
    entries.every(
      ([field]) =>
        !/^resume\.roles\..*\.(?:dateRange|employer|location)$/.test(field)
    )
  );

  const plainEntries = humanizerCopyEntries(validConfig());
  assert.ok(
    plainEntries.some(
      ([field]) => field === 'resume.roles.account-management[0]'
    )
  );
  assert.ok(
    plainEntries.every(
      ([field]) => !field.startsWith('resume.roles.account-management[0].')
    )
  );

  const notCurated = revision6Config();
  notCurated.resume.roles['account-management'] = structuredClone(
    curated.resume.roles['account-management']
  );
  notCurated.resume.sourceBulletIds['account-management'] = [
    'addition:scout-xyrem-lead',
    ...foundationIds,
  ];
  assert.match(
    validateV2Config(notCurated).join('\n'),
    /sub-entries require curated authorization or a revision 7 agency-progression base/
  );

  const tooFew = structuredClone(curated);
  tooFew.resume.roles['account-management'] = [
    structuredClone(curated.resume.roles['account-management'][1]),
  ];
  tooFew.resume.sourceBulletIds['account-management'] = [...foundationIds];
  assert.match(
    validateV2Config(tooFew).join('\n'),
    /must include 2 to 8 sub-entries/
  );

  const missingDate = structuredClone(curated);
  delete missingDate.resume.roles['account-management'][0].dateRange;
  assert.match(
    validateV2Config(missingDate).join('\n'),
    /account-management\[0\]\.dateRange is required/
  );

  const emptyBullets = structuredClone(curated);
  emptyBullets.resume.roles['account-management'][0].bullets = [];
  assert.match(
    validateV2Config(emptyBullets).join('\n'),
    /account-management\[0\]\.bullets must be a non-empty string array/
  );

  const unmappedBullet = structuredClone(curated);
  unmappedBullet.resume.sourceBulletIds['account-management'] = [
    ...foundationIds,
  ];
  assert.match(
    validateV2Config(unmappedBullet).join('\n'),
    /must map every tailored bullet/
  );
});

test('revisions 5 and 6 support relevance-first experience sections without duplicating or dropping roles', () => {
  const relevanceFirst = validConfig();
  relevanceFirst.resume.layoutDensity = 'compact';
  relevanceFirst.resume.experienceSections = [
    {
      heading: 'Account Management Experience',
      roleIds: ['account-management'],
    },
    {
      heading: 'Recent & Complementary Experience',
      roleIds: [
        'hedgehox',
        'one-block-away',
        'kinesso',
        'omnicom',
        'heartbeat',
      ],
    },
  ];
  assert.deepEqual(validateV2Config(relevanceFirst), []);
  assert.deepEqual(
    getResumeExperienceSections(relevanceFirst).flatMap(
      (section) => section.roleIds
    ),
    [
      'account-management',
      'hedgehox',
      'one-block-away',
      'kinesso',
      'omnicom',
      'heartbeat',
    ]
  );
  assert.ok(
    humanizerCopyEntries(relevanceFirst).some(
      ([field, value]) =>
        field === 'resume.experienceSections[0].heading' &&
        value === 'Account Management Experience'
    )
  );

  const duplicateRole = structuredClone(relevanceFirst);
  duplicateRole.resume.experienceSections[1].roleIds.push(
    'account-management'
  );
  assert.match(
    validateV2Config(duplicateRole).join('\n'),
    /must place every foundation role exactly once/
  );

  const missingRole = structuredClone(relevanceFirst);
  missingRole.resume.experienceSections[1].roleIds.pop();
  assert.match(
    validateV2Config(missingRole).join('\n'),
    /must place every foundation role exactly once/
  );

  const standard = validConfig();
  assert.deepEqual(getResumeExperienceSections(standard), [
    {
      heading: 'Experience',
      roleIds: [
        'hedgehox',
        'one-block-away',
        'kinesso',
        'omnicom',
        'heartbeat',
        'account-management',
      ],
    },
  ]);

  const invalidDensity = structuredClone(relevanceFirst);
  invalidDensity.resume.layoutDensity = 'tiny';
  assert.match(
    validateV2Config(invalidDensity).join('\n'),
    /resume\.layoutDensity must be standard or compact/
  );
});

test(
  'relevance-first experience sections render in the requested order and pass ATS checks',
  { timeout: 180_000 },
  () => {
    const { tempRoot, config, configPath } = createBuildFixture({
      slug: 'relevance-first-fixture',
      artifactStem: 'Relevance-First-Fixture',
    });
    try {
      config.resume.experienceSections = [
        {
          heading: 'Account Management Experience',
          roleIds: ['account-management'],
        },
        {
          heading: 'Recent & Complementary Experience',
          pageBreakBefore: true,
          roleIds: [
            'hedgehox',
            'one-block-away',
            'kinesso',
            'omnicom',
            'heartbeat',
          ],
        },
      ];
      config.resume.layoutDensity = 'compact';
      config.resume.awards = [
        {
          label: 'Manny Award 2013',
          detail: 'Best Non-Branded Campaign, "Get Your Shift Together"',
        },
        {
          label: 'Indigo Awards 2023',
          detail: 'Design System & Data Visualization: 3x Gold, 2x Silver',
          href: 'https://www.indigoaward.com/winners/6748',
        },
      ];
      approveHumanizerReview(config, {
        reviewedAt: '2026-07-29T12:00:00.000Z',
        semanticPassComplete: true,
      });
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const result = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

      const pdfPath = path.join(
        tempRoot,
        'output',
        'pdf',
        'Wally-Mostafa-Relevance-First-Fixture-Resume.pdf'
      );
      const extracted = run([
        '-e',
        [
          "const { execFileSync } = require('node:child_process');",
          `const output = execFileSync('pdftotext', ['${pdfPath}', '-'], { encoding: 'utf8' });`,
          'process.stdout.write(output);',
        ].join('\n'),
      ]);
      assert.equal(extracted.status, 0, extracted.stderr);
      const compactText = extracted.stdout.toUpperCase().replace(/\s+/g, '');
      const accountHeading = compactText.indexOf(
        'ACCOUNTMANAGEMENTEXPERIENCE'
      );
      const accountRole = compactText.indexOf(
        'ACCOUNTMANAGEMENT&CLIENTSTRATEGY'
      );
      const recentHeading = compactText.indexOf(
        'RECENT&COMPLEMENTARYEXPERIENCE'
      );
      const recentRole = compactText.indexOf('AIIMPLEMENTATIONPARTNER');
      const mannyAward = compactText.indexOf('MANNYAWARD2013');
      const indigoAward = compactText.indexOf('INDIGOAWARDS2023');
      assert.ok(accountHeading >= 0);
      assert.ok(accountRole > accountHeading);
      assert.ok(recentHeading > accountRole);
      assert.ok(recentRole > recentHeading);
      assert.ok(mannyAward > recentRole);
      assert.ok(indigoAward > mannyAward);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'showcase routes drop the positioning sections and retitle the work grid',
  { timeout: 180_000 },
  () => {
    const { tempRoot, config, configPath } = createBuildFixture({
      slug: 'showcase-route-fixture',
      artifactStem: 'Showcase-Route-Fixture',
    });
    try {
      const invalidPresentation = structuredClone(config);
      invalidPresentation.route = { presentation: 'billboard' };
      assert.match(
        validateV2Config(invalidPresentation).join('\n'),
        /route\.presentation must be full or showcase/
      );
      const emptyHeading = structuredClone(config);
      emptyHeading.route = { presentation: 'showcase', workHeading: ' ' };
      assert.match(
        validateV2Config(emptyHeading).join('\n'),
        /route\.workHeading must be a non-empty string/
      );
      const leakyShowcase = structuredClone(config);
      leakyShowcase.route = { presentation: 'showcase' };
      assert.match(
        validateV2Config(leakyShowcase, { requireCurrentContract: true }).join('\n'),
        /route\.presentation showcase requires routeMode scoped-projects/
      );
      const omittedPresentation = structuredClone(config);
      delete omittedPresentation.route;
      assert.match(
        validateV2Config(omittedPresentation, {
          requireCurrentContract: true,
        }).join('\n'),
        /route\.presentation must be explicitly set to full or showcase/
      );
      const historicalOmission = structuredClone(config);
      delete historicalOmission.route;
      assert.doesNotMatch(
        validateV2Config(historicalOmission).join('\n'),
        /route\.presentation must be explicitly set/
      );

      const accountLane = structuredClone(config);
      delete accountLane.route;
      accountLane.classification.targetLane = 'client-account-delivery';
      assert.equal(getRoutePresentation(accountLane), 'showcase');
      accountLane.route = { presentation: 'full' };
      assert.equal(getRoutePresentation(accountLane), 'full');
      const otherLane = structuredClone(config);
      delete otherLane.route;
      assert.notEqual(
        otherLane.classification.targetLane,
        'client-account-delivery'
      );
      assert.equal(getRoutePresentation(otherLane), 'full');

      config.route = {
        presentation: 'showcase',
        workHeading: 'A few pieces of relevant work.',
        contactHeading: 'Thanks for stopping by.',
      };
      config.routeMode = 'scoped-projects';
      assert.ok(
        humanizerCopyEntries(config).some(
          ([field, value]) =>
            field === 'route.workHeading' &&
            value === 'A few pieces of relevant work.'
        )
      );
      assert.ok(
        humanizerCopyEntries(config).some(
          ([field, value]) =>
            field === 'route.contactHeading' &&
            value === 'Thanks for stopping by.'
        )
      );
      approveHumanizerReview(config, {
        reviewedAt: '2026-08-03T12:00:00.000Z',
        semanticPassComplete: true,
      });
      assert.deepEqual(validateV2Config(config), []);
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const result = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

      const routeHtml = readFileSync(
        path.join(tempRoot, 'showcase-route-fixture', 'index.html'),
        'utf8'
      );
      assert.ok(routeHtml.includes('A few pieces of relevant work.'));
      assert.ok(!routeHtml.includes('Proof for the lane.'));
      assert.ok(!routeHtml.includes('id="how-i-build"'));
      assert.ok(!routeHtml.includes('id="capabilities"'));
      assert.ok(!routeHtml.includes('id="arc"'));
      assert.ok(!routeHtml.includes('converging into AI implementation'));
      assert.ok(!routeHtml.includes('href="#how-i-build"'));
      assert.ok(!routeHtml.includes('href="#arc"'));
      assert.ok(routeHtml.includes('id="awards"'));
      assert.ok(routeHtml.includes('trust-strip'));
      assert.ok(routeHtml.includes('id="contact"'));
      assert.ok(routeHtml.includes('Thanks for stopping by.'));
      assert.ok(!routeHtml.includes("Let's talk."));
      assert.ok(!routeHtml.includes('Get in touch'));
      assert.ok(!routeHtml.includes('class="contact-subtitle'));
      assert.ok(routeHtml.includes('mailto:wmostafa12@gmail.com'));
      assert.ok(!routeHtml.includes('Also from this period'));
      assert.ok(!routeHtml.includes('project-07.html'));
      assert.ok(!/<a href="\.\.\/project-\d+\.html">/.test(routeHtml));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'curated per-agency sub-entries render as separate jobs and pass ATS checks',
  { timeout: 180_000 },
  () => {
    const { tempRoot, config, configPath } = createBuildFixture({
      slug: 'per-agency-fixture',
      artifactStem: 'Per-Agency-Fixture',
    });
    try {
      config.resume.compositionMode = 'curated-user-authorized';
      config.resume.curationAuthorization = {
        authorizedBy: 'user',
        authorizedAt: '2026-07-30',
        scope: 'Per-agency fixture resume only.',
        reason:
          'The user authorized splitting consolidated account work into per-agency entries with curated bullets.',
      };
      const foundationBullets = structuredClone(
        config.resume.roles['account-management']
      );
      const foundationIds = structuredClone(
        config.resume.sourceBulletIds['account-management']
      );
      config.resume.roles['account-management'] = [
        {
          title: 'Account Supervisor / Digital Strategist',
          employer: 'Scout Marketing',
          location: 'San Diego, CA',
          dateRange: 'Jun 2015 - Jul 2018',
          bullets: [
            'Led the XYREM consumer account across digital, social, TV, and print work.',
          ],
        },
        {
          title: 'Senior Account Manager',
          employer: 'FCB Health',
          dateRange: 'Apr 2011 - Jun 2015',
          bullets: foundationBullets,
        },
      ];
      config.resume.sourceBulletIds['account-management'] = [
        'addition:scout-xyrem-lead',
        ...foundationIds,
      ];
      config.resume.experienceSections = [
        {
          heading: 'Account Management Experience',
          roleIds: ['account-management'],
        },
        {
          heading: 'Recent & Complementary Experience',
          roleIds: [
            'hedgehox',
            'one-block-away',
            'kinesso',
            'omnicom',
            'heartbeat',
          ],
        },
      ];
      config.resume.layoutDensity = 'compact';
      approveHumanizerReview(config, {
        reviewedAt: '2026-07-30T12:00:00.000Z',
        semanticPassComplete: true,
      });
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const result = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

      const pdfPath = path.join(
        tempRoot,
        'output',
        'pdf',
        'Wally-Mostafa-Per-Agency-Fixture-Resume.pdf'
      );
      const extracted = run([
        '-e',
        [
          "const { execFileSync } = require('node:child_process');",
          `const output = execFileSync('pdftotext', ['${pdfPath}', '-'], { encoding: 'utf8' });`,
          'process.stdout.write(output);',
        ].join('\n'),
      ]);
      assert.equal(extracted.status, 0, extracted.stderr);
      const compactText = extracted.stdout.toUpperCase().replace(/\s+/g, '');
      const accountHeading = compactText.indexOf(
        'ACCOUNTMANAGEMENTEXPERIENCE'
      );
      const scoutTitle = compactText.indexOf(
        'ACCOUNTSUPERVISOR/DIGITALSTRATEGIST'
      );
      const scoutMeta = compactText.indexOf('SCOUTMARKETING');
      const fcbTitle = compactText.indexOf('SENIORACCOUNTMANAGER');
      const recentHeading = compactText.indexOf(
        'RECENT&COMPLEMENTARYEXPERIENCE'
      );
      const recentRole = compactText.indexOf('AIIMPLEMENTATIONPARTNER');
      assert.ok(accountHeading >= 0);
      assert.ok(scoutTitle > accountHeading);
      assert.ok(scoutMeta > scoutTitle);
      assert.ok(fcbTitle > scoutMeta);
      assert.ok(recentHeading > fcbTitle);
      assert.ok(recentRole > recentHeading);
      assert.equal(
        compactText.indexOf('ACCOUNTMANAGEMENT&CLIENTSTRATEGY'),
        -1
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'foundation skill drift warns on built packages and still blocks rebuilds',
  { timeout: 180_000 },
  () => {
    const { tempRoot, configPath } = createBuildFixture({
      slug: 'skill-drift-fixture',
      artifactStem: 'Skill-Drift-Fixture',
    });
    try {
      const buildResult = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(buildResult.status, 0, `${buildResult.stdout}\n${buildResult.stderr}`);

      for (const args of [
        ['init', '-q'],
        ['config', 'user.email', 'workflow-v2@example.com'],
        ['config', 'user.name', 'Workflow v2 Test'],
        [
          'add',
          'skill-drift-fixture/index.html',
          'output/pdf/Wally-Mostafa-Skill-Drift-Fixture-Resume.pdf',
          'scripts/packages/skill-drift-fixture.json',
          'scripts/tailored-packages.json',
        ],
        ['commit', '-qm', 'fixture'],
      ]) {
        const gitResult = spawnSync('git', args, {
          cwd: tempRoot,
          encoding: 'utf8',
        });
        assert.equal(gitResult.status, 0, gitResult.stderr);
      }

      const foundationPath = path.join(
        tempRoot,
        'scripts',
        'resume-foundation.json'
      );
      const foundation = JSON.parse(readFileSync(foundationPath, 'utf8'));
      const builtConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      const selectedSkillId = builtConfig.resume.skillIds[0];
      const skill = foundation.skillBank.find(
        (entry) => entry.id === selectedSkillId
      );
      skill.description = `${skill.description} plus a later foundation edit`;
      writeFileSync(
        foundationPath,
        `${JSON.stringify(foundation, null, 2)}\n`
      );

      const driftCheck = run(
        ['scripts/check-tailored-packages.mjs', 'skill-drift-fixture'],
        { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
      );
      assert.equal(
        driftCheck.status,
        0,
        `${driftCheck.stdout}\n${driftCheck.stderr}`
      );
      assert.match(
        `${driftCheck.stdout}\n${driftCheck.stderr}`,
        /skills text predates the current resume foundation/
      );

      const rebuildResult = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath, '--overwrite'],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.notEqual(rebuildResult.status, 0);
      assert.match(
        `${rebuildResult.stdout}\n${rebuildResult.stderr}`,
        /resume\.skills must match the selected foundation skill definitions/
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test('element replacement preserves literal dollar amounts', () => {
  const html = '<ul data-resume-role="account-management"><li>Old</li></ul>';
  const output = replaceElementContent(
    html,
    'data-resume-role',
    'account-management',
    '<li>Managed $2M-$50M+ programs</li>'
  );
  assert.match(output, /Managed \$2M-\$50M\+ programs/);
  assert.doesNotMatch(output, /Managed ulM/);
});

test('revisions 5 and 6 keep dollar symbols in authored copy without rewriting raw JD currency', () => {
  const authoredUsd = validConfig();
  authoredUsd.resume.roles.hedgehox[0] =
    'Managed USD 2M in supported client work.';
  assert.match(
    humanizerViolations(authoredUsd).join('\n'),
    /use \$ instead of USD/
  );

  const sourceUsd = validConfig();
  sourceUsd.job.rawJd = 'Own a USD 2M annual budget.';
  assert.doesNotMatch(
    humanizerViolations(sourceUsd).join('\n'),
    /use \$ instead of USD/
  );
});

test('humanizer review is surface-only, blocks AI tells, and expires after copy edits', () => {
  const config = validConfig();
  assert.throws(
    () => assertHumanizerReviewCurrent(config),
    /copyReview.status must be passed/
  );
  assert.throws(
    () => approveHumanizerReview(config),
    /semantic-pass-complete/
  );

  const obviousAiCopy = structuredClone(config);
  obviousAiCopy.hero.intro =
    'This pivotal work serves as a testament to a vibrant, evolving landscape.';
  assert.ok(humanizerViolations(obviousAiCopy).length >= 2);
  assert.throws(
    () =>
      approveHumanizerReview(obviousAiCopy, {
        semanticPassComplete: true,
      }),
    /obvious AI-writing patterns/
  );

  const copyBeforeApproval = humanizerCopyEntries(config);
  assert.ok(
    copyBeforeApproval.some(
      ([field]) => field === 'classification.hardGates[0].evidence'
    )
  );
  assert.ok(
    copyBeforeApproval.some(
      ([field]) => field === 'requirements[0].evidence[0]'
    )
  );
  approveHumanizerReview(config, {
    reviewedAt: '2026-07-22T12:00:00.000Z',
    semanticPassComplete: true,
  });
  assert.deepEqual(humanizerCopyEntries(config), copyBeforeApproval);
  assert.deepEqual(config.copyReview.preserved, [
    'content',
    'structure',
    'claims',
    'ending',
  ]);
  assert.doesNotThrow(() => assertHumanizerReviewCurrent(config));

  config.contact.prompt = `${config.contact.prompt} Please reach out.`;
  assert.throws(
    () => assertHumanizerReviewCurrent(config),
    /copySha256 is stale/
  );

  const whitespaceEdit = validConfig();
  approveHumanizerReview(whitespaceEdit, {
    reviewedAt: '2026-07-22T12:00:00.000Z',
    semanticPassComplete: true,
  });
  whitespaceEdit.contact.signoff = `${whitespaceEdit.contact.signoff} `;
  assert.throws(
    () => assertHumanizerReviewCurrent(whitespaceEdit),
    /copySha256 is stale/
  );

  const sourceEdit = validConfig();
  approveHumanizerReview(sourceEdit, {
    reviewedAt: '2026-07-22T12:00:00.000Z',
    semanticPassComplete: true,
  });
  sourceEdit.job.rawJd = `${sourceEdit.job.rawJd}\nPublic source update.`;
  assert.doesNotThrow(() => assertHumanizerReviewCurrent(sourceEdit));

  const authoredEvidenceEdit = structuredClone(sourceEdit);
  authoredEvidenceEdit.classification.hardGates[0].evidence +=
    ' Additional fit explanation.';
  assert.throws(
    () => assertHumanizerReviewCurrent(authoredEvidenceEdit),
    /copySha256 is stale/
  );

  const coverLetterEdit = setFit(validConfig(), 'adjacent');
  approveHumanizerReview(coverLetterEdit, {
    reviewedAt: '2026-07-22T12:00:00.000Z',
    semanticPassComplete: true,
  });
  assert.ok(
    humanizerCopyEntries(coverLetterEdit).some(
      ([field]) => field === 'coverLetter.paragraphs[0]'
    )
  );
  coverLetterEdit.coverLetter.paragraphs[0] += ' One more claim.';
  assert.throws(
    () => assertHumanizerReviewCurrent(coverLetterEdit),
    /copySha256 is stale/
  );

  assert.throws(
    () =>
      approveHumanizerReview(validConfig(), {
        reviewedAt: new Date(Date.now() + 60 * 1000).toISOString(),
        semanticPassComplete: true,
      }),
    /cannot be in the future/
  );

  assert.throws(
    () =>
      approveHumanizerReview(validConfig(), {
        mode: 'rewrite-requested',
        semanticPassComplete: true,
      }),
    /explicit authorization/
  );
});

test('humanizer CLI records the reviewed copy and builder rejects pending copy', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'humanizer-gate-test-'));
  try {
    mkdirSync(path.join(tempRoot, 'scripts', 'packages'), { recursive: true });
    cpSync(
      path.join(repoRoot, 'scripts', 'resume-foundation.json'),
      path.join(tempRoot, 'scripts', 'resume-foundation.json')
    );
    cpSync(
      path.join(repoRoot, 'scripts', 'resume-base-profiles.json'),
      path.join(tempRoot, 'scripts', 'resume-base-profiles.json')
    );
    const config = validConfig();
    config.slug = 'humanizer-gate';
    config.artifactStem = 'Humanizer-Gate';
    const configPath = path.join(
      tempRoot,
      'scripts',
      'packages',
      'humanizer-gate.json'
    );
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

    const pendingBuild = run(
      ['scripts/build-tailored-package.mjs', '--config', configPath],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
    );
    assert.notEqual(pendingBuild.status, 0);
    assert.match(pendingBuild.stderr, /Humanizer copy gate failed/);
    assert.equal(existsSync(path.join(tempRoot, 'humanizer-gate')), false);

    const pendingAts = run([
      'scripts/ats-check.mjs',
      '--config',
      configPath,
      '--pdf',
      path.join(tempRoot, 'missing.pdf'),
    ]);
    assert.notEqual(pendingAts.status, 0);
    assert.match(pendingAts.stderr, /Humanizer copy gate failed/);

    const staticOnly = run(
      [
        'scripts/humanizer-check.mjs',
        '--config',
        configPath,
        '--approve',
      ],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
    );
    assert.notEqual(staticOnly.status, 0);
    assert.match(staticOnly.stderr, /--semantic-pass-complete/);

    const approved = run(
      [
        'scripts/humanizer-check.mjs',
        '--config',
        configPath,
        '--approve',
        '--semantic-pass-complete',
      ],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
    );
    assert.equal(approved.status, 0, approved.stderr);
    const saved = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(saved.copyReview.status, 'passed');
    assert.equal(saved.copyReview.mode, 'surface-only');
    assert.equal(saved.copyReview.reviewMethod, 'humanizer-skill');
    assert.equal(saved.copyReview.semanticPassAttested, true);
    assert.equal(saved.copyReview.staticChecksPassed, true);
    assert.equal(saved.copyReview.finalAntiAiPass, true);
    assert.deepEqual(saved.copyReview.remainingTells, []);

    const rewriteApproval = run(
      [
        'scripts/humanizer-check.mjs',
        '--config',
        configPath,
        '--approve',
        '--semantic-pass-complete',
        '--rewrite-requested',
      ],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
    );
    assert.equal(rewriteApproval.status, 0, rewriteApproval.stderr);
    const rewritten = JSON.parse(readFileSync(configPath, 'utf8'));
    assert.equal(rewritten.copyReview.mode, 'rewrite-requested');
    assert.equal(rewritten.copyReview.rewriteAuthorized, true);

    rewritten.contact.prompt = `${rewritten.contact.prompt} `;
    writeFileSync(configPath, `${JSON.stringify(rewritten, null, 2)}\n`);
    const staleAts = run([
      'scripts/ats-check.mjs',
      '--config',
      configPath,
      '--pdf',
      path.join(tempRoot, 'missing.pdf'),
    ]);
    assert.notEqual(staleAts.status, 0);
    assert.match(staleAts.stderr, /copySha256 is stale/);

    const outsidePath = path.join(tempRoot, 'outside.json');
    writeFileSync(outsidePath, `${JSON.stringify(config, null, 2)}\n`);
    const outsideApproval = run(
      [
        'scripts/humanizer-check.mjs',
        '--config',
        outsidePath,
        '--approve',
        '--semantic-pass-complete',
      ],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
    );
    assert.notEqual(outsideApproval.status, 0);
    assert.match(outsideApproval.stderr, /scripts\/packages/);

    const linkedTarget = path.join(tempRoot, 'linked-target.json');
    writeFileSync(linkedTarget, `${JSON.stringify(config, null, 2)}\n`);
    const symlinkConfigPath = path.join(
      tempRoot,
      'scripts',
      'packages',
      'symlink-config.json'
    );
    symlinkSync(linkedTarget, symlinkConfigPath);
    const symlinkApproval = run(
      [
        'scripts/humanizer-check.mjs',
        '--config',
        symlinkConfigPath,
        '--approve',
        '--semantic-pass-complete',
      ],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
    );
    assert.notEqual(symlinkApproval.status, 0);
    assert.match(symlinkApproval.stderr, /non-linked filesystem entries/);

    const hardlinkConfigPath = path.join(
      tempRoot,
      'scripts',
      'packages',
      'hardlink-config.json'
    );
    linkSync(linkedTarget, hardlinkConfigPath);
    const hardlinkApproval = run(
      [
        'scripts/humanizer-check.mjs',
        '--config',
        hardlinkConfigPath,
        '--approve',
        '--semantic-pass-complete',
      ],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot } }
    );
    assert.notEqual(hardlinkApproval.status, 0);
    assert.match(hardlinkApproval.stderr, /non-linked filesystem entries/);

    const symlinkRoot = path.join(tempRoot, 'symlink-root');
    const externalPackages = path.join(tempRoot, 'external-packages');
    mkdirSync(path.join(symlinkRoot, 'scripts'), { recursive: true });
    mkdirSync(externalPackages);
    const externalConfigPath = path.join(externalPackages, 'package.json');
    writeFileSync(externalConfigPath, `${JSON.stringify(config, null, 2)}\n`);
    symlinkSync(
      externalPackages,
      path.join(symlinkRoot, 'scripts', 'packages'),
      'dir'
    );
    const symlinkDirectoryApproval = run(
      [
        'scripts/humanizer-check.mjs',
        '--config',
        path.join(symlinkRoot, 'scripts', 'packages', 'package.json'),
        '--approve',
        '--semantic-pass-complete',
      ],
      { env: { ...process.env, WORKFLOW_REPO_ROOT: symlinkRoot } }
    );
    assert.notEqual(symlinkDirectoryApproval.status, 0);
    assert.match(
      symlinkDirectoryApproval.stderr,
      /non-linked filesystem entries/
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('config validation rejects duplicate projects and inconsistent hard gates', () => {
  const duplicateProjects = validConfig();
  duplicateProjects.selectedProjects = [
    'project-01.html',
    'project-01.html',
    'project-02.html',
  ];
  assert.match(
    validateV2Config(duplicateProjects).join('\n'),
    /must not contain duplicates/
  );

  const inconsistentGate = validConfig();
  inconsistentGate.classification.hardGates[0].status = 'fail';
  assert.match(
    validateV2Config(inconsistentGate).join('\n'),
    /hardGateStatus must match/
  );
  assert.throws(
    () => assertBuildAllowed(inconsistentGate),
    /Hard-screen gate failed/
  );

  const duplicateRequirements = validConfig();
  duplicateRequirements.requirements[1].id =
    duplicateRequirements.requirements[0].id;
  assert.match(
    validateV2Config(duplicateRequirements).join('\n'),
    /requirements\[\]\.id must be unique/
  );

  const unsupportedPassingGate = validConfig();
  unsupportedPassingGate.requirements[0].evidenceStatus = 'none';
  unsupportedPassingGate.requirements[0].evidence = [];
  unsupportedPassingGate.requirements[0].proofIds = [];
  unsupportedPassingGate.requirements[0].matchMode = 'not-supported';
  assert.match(
    validateV2Config(unsupportedPassingGate).join('\n'),
    /cannot pass when its requirement is unsupported/
  );

  const unsupportedIgnoredGate = validConfig();
  unsupportedIgnoredGate.requirements[0].evidenceStatus = 'none';
  unsupportedIgnoredGate.requirements[0].evidence = [];
  unsupportedIgnoredGate.requirements[0].proofIds = [];
  unsupportedIgnoredGate.requirements[0].matchMode = 'not-supported';
  unsupportedIgnoredGate.classification.hardGates[0].status =
    'not-applicable';
  assert.match(
    validateV2Config(unsupportedIgnoredGate).join('\n'),
    /must fail for an explicit unsupported hard-gate requirement/
  );

  const duplicateGateReference = validConfig();
  duplicateGateReference.classification.hardGates.push(
    structuredClone(duplicateGateReference.classification.hardGates[0])
  );
  assert.match(
    validateV2Config(duplicateGateReference).join('\n'),
    /hardGates\[\]\.requirementId must be unique/
  );
});

test('revisions 5 and 6 require resume proof for supported core criteria and ignore ambiguous knockout language', () => {
  const coverLetterOnly = validConfig();
  coverLetterOnly.requirements[1].destinations = ['cover-letter'];
  assert.match(
    validateV2Config(coverLetterOnly).join('\n'),
    /must place supported core evidence in the resume/
  );

  const ambiguousNotFit = setFit(validConfig(), 'not-fit');
  ambiguousNotFit.requirements[1].confidence = 'ambiguous';
  ambiguousNotFit.requirements[1].evidenceStatus = 'none';
  ambiguousNotFit.requirements[1].proofIds = [];
  ambiguousNotFit.requirements[1].destinations = ['cover-letter'];
  ambiguousNotFit.requirements[1].matchMode = 'not-supported';
  assert.match(
    validateV2Config(ambiguousNotFit).join('\n'),
    /not-fit requires an explicit unsupported hard gate or core operating-center requirement/
  );
});

test('cover-letter bridge is explicit and cannot bypass fit or hard gates', () => {
  const missingBridge = validConfig();
  delete missingBridge.fitGate.coverLetterBridge;
  assert.match(
    validateV2Config(missingBridge).join('\n'),
    /coverLetterBridge is required/
  );

  const wrongStrongStatus = validConfig();
  wrongStrongStatus.fitGate.coverLetterBridge.status = 'recommended';
  assert.match(
    validateV2Config(wrongStrongStatus).join('\n'),
    /recommended cover-letter bridge is only valid for adjacent or stretch|strong fits must use a not-needed/
  );

  const adjacent = setFit(validConfig(), 'adjacent');
  assert.deepEqual(validateV2Config(adjacent), []);

  const adjacentWithoutLetter = structuredClone(adjacent);
  adjacentWithoutLetter.coverLetter = null;
  assert.match(
    validateV2Config(adjacentWithoutLetter).join('\n'),
    /coverLetter is required when the cover-letter bridge is recommended/
  );

  const wrongTrigger = structuredClone(adjacent);
  wrongTrigger.coverLetter.trigger = 'user-requested';
  assert.match(
    validateV2Config(wrongTrigger).join('\n'),
    /recommended bridge must generate a bridge-recommended cover letter/
  );

  const notNeededWithAutomaticLetter = validConfig();
  notNeededWithAutomaticLetter.coverLetter = recommendedCoverLetter();
  assert.match(
    validateV2Config(notNeededWithAutomaticLetter).join('\n'),
    /not-needed cover letter may be included only when explicitly requested/
  );

  const adjacentWithoutBridge = structuredClone(adjacent);
  adjacentWithoutBridge.fitGate.coverLetterBridge.status = 'not-needed';
  assert.match(
    validateV2Config(adjacentWithoutBridge).join('\n'),
    /adjacent and stretch fits must use a recommended or not-credible/
  );

  const missingPhrase = structuredClone(adjacent);
  missingPhrase.fitGate.coverLetterBridge.rationale =
    'The transferable enterprise delivery evidence supports a credible case.';
  assert.match(
    validateV2Config(missingPhrase).join('\n'),
    /must explicitly mention a cover letter/
  );

  const failedGate = structuredClone(adjacent);
  failedGate.classification.hardGateStatus = 'fail';
  failedGate.classification.hardGates[0].status = 'fail';
  assert.match(
    validateV2Config(failedGate).join('\n'),
    /cannot be recommended unless every hard gate passes/
  );

  const uncertainGate = structuredClone(adjacent);
  uncertainGate.classification.hardGateStatus = 'uncertain';
  uncertainGate.classification.hardGates[0].status = 'uncertain';
  assert.match(
    validateV2Config(uncertainGate).join('\n'),
    /cannot be recommended unless every hard gate passes/
  );

  const notFit = structuredClone(adjacent);
  notFit.fitClass = 'not-fit';
  assert.match(
    validateV2Config(notFit).join('\n'),
    /not-fit packages must use a not-credible cover-letter bridge/
  );

  const notCredibleWithLetter = setFit(validConfig(), 'not-fit');
  notCredibleWithLetter.coverLetter = recommendedCoverLetter();
  assert.match(
    validateV2Config(notCredibleWithLetter).join('\n'),
    /coverLetter must be null when the bridge is not credible/
  );
});

test('cover letters use the locked Real Chemistry 21GRAMS visual template', () => {
  const config = setFit(validConfig(), 'adjacent');
  const html = buildCoverLetterHtml(config, { slug: config.slug });

  assert.match(
    html,
    new RegExp(
      `data-cover-letter-template="${COVER_LETTER_TEMPLATE_VERSION}"`
    )
  );
  assert.match(html, /assets\/fonts\/cover-letter\/syne-800-latin\.woff2/);
  assert.match(
    html,
    /assets\/fonts\/cover-letter\/instrument-sans-latin\.woff2/
  );
  assert.doesNotMatch(html, /fonts\.googleapis\.com/);
  assert.match(html, /text-align: center/);
  assert.match(html, /border-bottom: 2px solid var\(--ink\)/);
  assert.match(html, /margin: 0\.58in 0\.62in/);
  assert.match(html, /font-size: 10\.2pt/);
  assert.match(html, /line-height: 1\.54/);
  assert.match(html, /<h1>WALLY MOSTAFA<\/h1>/);
  assert.match(html, /347-420-3558/);
  assert.match(html, /Raleigh, NC/);
  assert.doesNotMatch(html, /font-family: Arial/);
  assert.doesNotMatch(html, /class="subject"/);
});

test('JSON schema mirrors the cover-letter bridge decision matrix', () => {
  assert.deepEqual(schemaErrors(validConfig()), []);

  const previousContract = validConfig();
  delete previousContract.contractRevision;
  delete previousContract.fitGate.coverLetterBridge;
  delete previousContract.copyReview;
  assert.deepEqual(schemaErrors(previousContract), []);

  const revisionlessWithInvalidBridge = structuredClone(previousContract);
  revisionlessWithInvalidBridge.fitGate.coverLetterBridge = {
    status: 'recommended',
    rationale: 'We can make the case with a cover letter.',
  };
  assert.ok(schemaErrors(revisionlessWithInvalidBridge).length > 0);

  const missingBridge = validConfig();
  delete missingBridge.fitGate.coverLetterBridge;
  assert.ok(schemaErrors(missingBridge).length > 0);

  const adjacent = setFit(validConfig(), 'adjacent');
  assert.deepEqual(schemaErrors(adjacent), []);

  const adjacentWithoutLetter = structuredClone(adjacent);
  adjacentWithoutLetter.coverLetter = null;
  assert.ok(schemaErrors(adjacentWithoutLetter).length > 0);

  const failedGate = structuredClone(adjacent);
  failedGate.classification.hardGateStatus = 'fail';
  failedGate.classification.hardGates[0].status = 'fail';
  assert.ok(schemaErrors(failedGate).length > 0);

  const missingPhrase = structuredClone(adjacent);
  missingPhrase.fitGate.coverLetterBridge.rationale =
    'The transferable evidence supports a credible case.';
  assert.ok(schemaErrors(missingPhrase).length > 0);
});

test('JSON schema keeps revision 2 valid and enforces current copy review', () => {
  const revisionTwo = validConfig();
  revisionTwo.contractRevision = 2;
  delete revisionTwo.copyReview;
  assert.deepEqual(validateV2Config(revisionTwo), []);
  assert.deepEqual(schemaErrors(revisionTwo), []);

  const missingReview = validConfig();
  delete missingReview.copyReview;
  assert.match(
    validateV2Config(missingReview).join('\n'),
    /copyReview is required for the current contract revision/
  );
  assert.ok(schemaErrors(missingReview).length > 0);

  const approved = validConfig();
  approveHumanizerReview(approved, {
    reviewedAt: '2026-07-22T12:00:00.000Z',
    semanticPassComplete: true,
  });
  assert.deepEqual(validateV2Config(approved), []);
  assert.deepEqual(schemaErrors(approved), []);

  const lostEndingBoundary = structuredClone(approved);
  lostEndingBoundary.copyReview.preserved = [
    'content',
    'structure',
    'claims',
  ];
  assert.match(
    validateV2Config(lostEndingBoundary).join('\n'),
    /preserved must include content, structure, claims, and ending/
  );
  assert.ok(schemaErrors(lostEndingBoundary).length > 0);
});

test('builder requires the current contract for new and reused packages', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'bridge-contract-test-'));
  try {
    mkdirSync(path.join(tempRoot, 'scripts', 'packages'), { recursive: true });
    cpSync(
      path.join(repoRoot, 'scripts', 'resume-foundation.json'),
      path.join(tempRoot, 'scripts', 'resume-foundation.json')
    );
    cpSync(
      path.join(repoRoot, 'scripts', 'resume-base-profiles.json'),
      path.join(tempRoot, 'scripts', 'resume-base-profiles.json')
    );

    const missingBridge = validConfig();
    missingBridge.slug = 'missing-bridge';
    missingBridge.artifactStem = 'Missing-Bridge';
    delete missingBridge.fitGate.coverLetterBridge;
    const newConfigPath = path.join(
      tempRoot,
      'scripts',
      'packages',
      'missing-bridge.json'
    );
    writeFileSync(newConfigPath, `${JSON.stringify(missingBridge, null, 2)}\n`);
    const newBuild = run(
      ['scripts/build-tailored-package.mjs', '--config', newConfigPath],
      {
        env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot },
      }
    );
    assert.notEqual(newBuild.status, 0);
    assert.match(newBuild.stderr, /coverLetterBridge is required/);
    assert.equal(existsSync(path.join(tempRoot, 'missing-bridge')), false);

    const previousContract = validConfig();
    previousContract.slug = 'previous-contract';
    previousContract.artifactStem = 'Previous-Contract';
    delete previousContract.contractRevision;
    delete previousContract.fitGate.coverLetterBridge;
    delete previousContract.copyReview;
    const reusedConfigPath = path.join(
      tempRoot,
      'scripts',
      'packages',
      'previous-contract.json'
    );
    writeFileSync(
      reusedConfigPath,
      `${JSON.stringify(previousContract, null, 2)}\n`
    );
    const reusedBuild = run(
      [
        'scripts/build-tailored-package.mjs',
        '--config',
        reusedConfigPath,
        '--overwrite',
      ],
      {
        env: { ...process.env, WORKFLOW_REPO_ROOT: tempRoot },
      }
    );
    assert.notEqual(reusedBuild.status, 0);
    assert.match(
      reusedBuild.stderr,
      /contractRevision must be 7 for new or rebuilt packages/
    );
    assert.equal(existsSync(path.join(tempRoot, 'previous-contract')), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('pre-rule verified v2 configs remain valid and checksum-stable until reuse', () => {
  const previousContract = validConfig();
  delete previousContract.contractRevision;
  delete previousContract.fitGate.coverLetterBridge;
  delete previousContract.copyReview;
  const expectedChecksum = configInputSha256(previousContract);
  previousContract.qa = {
    status: 'qa-passed',
    configInputSha256: expectedChecksum,
  };
  const beforeValidation = JSON.stringify(previousContract);

  assert.deepEqual(validateV2Config(previousContract), []);
  assert.equal(JSON.stringify(previousContract), beforeValidation);
  assert.equal(configInputSha256(previousContract), expectedChecksum);

  const revisionTwo = validConfig();
  revisionTwo.contractRevision = 2;
  delete revisionTwo.copyReview;
  const revisionTwoChecksum = configInputSha256(revisionTwo);
  revisionTwo.qa = {
    status: 'qa-passed',
    configInputSha256: revisionTwoChecksum,
  };
  const revisionTwoBeforeValidation = JSON.stringify(revisionTwo);
  assert.deepEqual(validateV2Config(revisionTwo), []);
  assert.equal(JSON.stringify(revisionTwo), revisionTwoBeforeValidation);
  assert.equal(configInputSha256(revisionTwo), revisionTwoChecksum);
});

test('fit and hard gates stop generation before files are created', () => {
  const notFit = setFit(validConfig(), 'not-fit');
  assert.throws(() => assertBuildAllowed(notFit), /not-fit/);

  const stretch = setFit(validConfig(), 'stretch');
  assert.throws(() => assertBuildAllowed(stretch), /--allow-stretch/);
  assert.doesNotThrow(() =>
    assertBuildAllowed(stretch, { allowStretch: true })
  );

  const unresolved = validConfig();
  unresolved.classification.hardGateStatus = 'uncertain';
  assert.throws(() => assertBuildAllowed(unresolved), /unresolved/);
});

test('unsupported claims are blocked in recruiter-facing route copy', () => {
  const config = validConfig();
  config.constraints.blockedTerms = ['Python engineering'];
  config.hero.intro =
    'I fit this role through AI implementation and Python engineering.';
  assert.throws(
    () => assertRecruiterFacingClaimsSupported(config),
    /hero\.intro contains unsupported language: Python engineering/
  );

  const coverLetterConfig = setFit(validConfig(), 'adjacent');
  coverLetterConfig.constraints.blockedTerms = ['Python engineering'];
  coverLetterConfig.coverLetter.paragraphs[1] +=
    ' I also lead Python engineering.';
  assert.throws(
    () => assertRecruiterFacingClaimsSupported(coverLetterConfig),
    /coverLetter\.paragraphs\[1\] contains unsupported language: Python engineering/
  );
});

test('not-fit builder exits before creating route or PDF files', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'workflow-v2-not-fit-'));
  try {
    mkdirSync(path.join(tempRoot, 'scripts', 'packages'), { recursive: true });
    cpSync(
      path.join(repoRoot, 'scripts', 'resume-foundation.json'),
      path.join(tempRoot, 'scripts', 'resume-foundation.json')
    );
    cpSync(
      path.join(repoRoot, 'scripts', 'resume-base-profiles.json'),
      path.join(tempRoot, 'scripts', 'resume-base-profiles.json')
    );
    const config = setFit(validConfig(), 'not-fit');
    config.slug = 'not-fit-fixture';
    config.artifactStem = 'Not-Fit-Fixture';
    config.requirements[1].evidenceStatus = 'none';
    config.requirements[1].proofIds = [];
    config.requirements[1].destinations = ['cover-letter'];
    config.requirements[1].matchMode = 'not-supported';
    approveHumanizerReview(config, {
      reviewedAt: '2026-07-22T12:00:00.000Z',
      semanticPassComplete: true,
    });
    const configPath = path.join(
      tempRoot,
      'scripts',
      'packages',
      'not-fit-fixture.json'
    );
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    const result = run(
      ['scripts/build-tailored-package.mjs', '--config', configPath],
      {
        env: {
          ...process.env,
          WORKFLOW_REPO_ROOT: tempRoot,
        },
      }
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /not-fit/);
    assert.equal(existsSync(path.join(tempRoot, 'not-fit-fixture')), false);
    assert.equal(
      existsSync(
        path.join(
          tempRoot,
          'output',
          'pdf',
          'Wally-Mostafa-Not-Fit-Fixture-Resume.pdf'
        )
      ),
      false
    );
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('Portfolio replacement works with attributes after href', () => {
  const source =
    '<a class="print-link" href="https://wallymo.github.io/" target="_blank" rel="noopener">Portfolio</a><a href="https://wallymo.github.io/stale-role/">Portfolio</a>';
  const route = 'https://wallymo.github.io/test-role/';
  const output = replacePortfolioLink(source, route);
  assert.match(output, new RegExp(`href="${route}"`));
  assert.match(output, /class="print-link"/);
  assert.equal((output.match(new RegExp(`href="${route}"`, 'g')) || []).length, 2);
  assert.doesNotMatch(output, /stale-role/);
  assert.equal((output.match(/target="_blank"/g) || []).length, 2);
  assert.equal((output.match(/rel="noopener"/g) || []).length, 2);
});

test('checksum parity rejects a different live artifact', () => {
  assert.equal(
    assertChecksum('fixture', Buffer.from('same'), Buffer.from('same')).length,
    64
  );
  assert.throws(
    () => assertChecksum('fixture', Buffer.from('local'), Buffer.from('live')),
    /checksum mismatch/
  );
});

test(
  'live verification rejects an unpushed package config or resume-base registry',
  { timeout: 180_000 },
  async () => {
    const { tempRoot, configPath } = createBuildFixture({
      slug: 'config-parity-fixture',
      artifactStem: 'Config-Parity-Fixture',
    });
    const previousRepoRoot = process.env.WORKFLOW_REPO_ROOT;
    let server;
    try {
      const built = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);
      initializeGit(tempRoot);
      commitAll(tempRoot, 'config parity fixture');

      const configRelativePath = path.relative(tempRoot, configPath);
      const fixtureServer = await startFixtureServer(tempRoot, {
        transform(relativePath, content) {
          return relativePath === configRelativePath
            ? Buffer.concat([content, Buffer.from(' ')])
            : content;
        },
      });
      server = fixtureServer.server;
      process.env.WORKFLOW_REPO_ROOT = tempRoot;
      await assert.rejects(
        () =>
          verifyTailoredRoute('config-parity-fixture', {
            publicBase: fixtureServer.publicBase,
          }),
        /Package config checksum mismatch/
      );
      await new Promise((resolve) => server.close(resolve));
      server = undefined;

      const registryServer = await startFixtureServer(tempRoot, {
        transform(relativePath, content) {
          return relativePath === 'scripts/resume-base-profiles.json'
            ? Buffer.concat([content, Buffer.from(' ')])
            : content;
        },
      });
      server = registryServer.server;
      await assert.rejects(
        () =>
          verifyTailoredRoute('config-parity-fixture', {
            publicBase: registryServer.publicBase,
          }),
        /Resume base profiles checksum mismatch/
      );
      const manifest = JSON.parse(
        readFileSync(
          path.join(tempRoot, 'scripts', 'tailored-packages.json'),
          'utf8'
        )
      );
      assert.equal(manifest.packages[0].publishStatus, 'local-only');
      assert.equal(manifest.packages[0].verification, undefined);
    } finally {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
      }
      if (previousRepoRoot === undefined) {
        delete process.env.WORKFLOW_REPO_ROOT;
      } else {
        process.env.WORKFLOW_REPO_ROOT = previousRepoRoot;
      }
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test('application ledger refuses an unconfirmed application', () => {
  const temporaryLedger = path.join(
    mkdtempSync(path.join(os.tmpdir(), 'application-ledger-test-')),
    'applications.json'
  );
  const result = run(
    [
      'scripts/application-ledger.mjs',
      'record',
      '--package',
      'missing-package',
      '--applied-at',
      '2026-07-16T14:00:00Z',
    ],
    {
      env: {
        ...process.env,
        APPLICATION_LEDGER_PATH: temporaryLedger,
      },
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--confirmation is required/);
});

test('application duplicate checks block exact requisitions and flag active related roles', () => {
  const ledger = {
    applications: [
      {
        company: 'Company',
        jobId: 'REQ-123',
        currentStage: 'recruiter-screen',
      },
      {
        company: 'Company',
        jobId: 'REQ-100',
        currentStage: 'rejected',
      },
    ],
  };
  assert.equal(
    applicationDuplicateStatus(ledger, {
      company: 'company',
      jobId: ' req-123 ',
    }).status,
    'exact'
  );
  const related = applicationDuplicateStatus(ledger, {
    company: 'Company',
    jobId: 'REQ-456',
  });
  assert.equal(related.status, 'related-role');
  assert.equal(related.relatedActive.length, 1);

  const reserved = applicationDuplicateStatus(
    {
      applications: [],
      readiness: [
        {
          packageSlug: 'other-package',
          company: 'Company',
          jobId: 'REQ-900',
          status: 'ready',
          convertedApplicationId: null,
        },
      ],
    },
    {
      company: 'company',
      jobId: 'req-900',
      packageSlug: 'current-package',
    }
  );
  assert.equal(reserved.status, 'exact');
  assert.equal(reserved.exactReadiness.packageSlug, 'other-package');
});

test('private ledger rejects identity fingerprint rotation across readiness snapshots', () => {
  const ledger = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  ledger.readiness[0].identitySha256 = 'e'.repeat(64);
  assert.match(
    validateLedger(ledger).join('\n'),
    /identity fingerprints must remain stable/
  );

  const bypassedReadiness = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  bypassedReadiness.readiness[0].screeningQuestionsStatus = 'unavailable';
  assert.match(
    validateLedger(bypassedReadiness).join('\n'),
    /cannot be ready: screening questions are not reviewed/
  );

  const disguisedRevision = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  delete disguisedRevision.applications[0].readiness;
  assert.match(
    validateLedger(disguisedRevision).join('\n'),
    /readiness is required for revisions 5, 6, and 7/
  );

  const missingBacklink = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  missingBacklink.readiness[0].convertedApplicationId = null;
  assert.match(
    validateLedger(missingBacklink).join('\n'),
    /top-level readiness must link back/
  );

  const missingTopLevelReadiness = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  missingTopLevelReadiness.readiness = [];
  assert.match(
    validateLedger(missingTopLevelReadiness).join('\n'),
    /must retain its top-level readiness conversion record/
  );

  const downgradedRevision = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  downgradedRevision.applications[0].contractRevision = 4;
  assert.match(
    validateLedger(downgradedRevision).join('\n'),
    /contractRevision must be 5, 6, or 7 when present/
  );

  const mismatchedIdentityFields = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  mismatchedIdentityFields.applications[0].atsVendor = 'ashby';
  assert.match(
    validateLedger(mismatchedIdentityFields).join('\n'),
    /readiness must match the recorded requisition and artifact checksums/
  );
});

test('revision 1 through 4 ledger records remain valid without readiness metadata', () => {
  const legacy = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  delete legacy.readiness;
  const application = legacy.applications[0];
  delete application.contractRevision;
  for (const field of [
    'positioningLane',
    'bridgeType',
    'applicationStrategy',
    'coverLetterStatus',
    'requirementCoverage',
    'readiness',
  ]) {
    delete application[field];
  }
  application.events = [application.events[0]];
  assert.deepEqual(validateLedger(legacy), []);
});

test('application ledger records confirmed submissions and keeps outreach states distinct', { timeout: 180_000 }, async () => {
  const { tempRoot, configPath } = createBuildFixture({
    slug: 'confirmed-fixture',
    artifactStem: 'Confirmed-Fixture',
    fitClass: 'adjacent',
  });
  const previousRepoRoot = process.env.WORKFLOW_REPO_ROOT;
  const previousLedgerPath = process.env.APPLICATION_LEDGER_PATH;
  let server;
  try {
    const built = run(
      ['scripts/build-tailored-package.mjs', '--config', configPath],
      {
        env: {
          ...process.env,
          WORKFLOW_REPO_ROOT: tempRoot,
          CHROME_PATH: resolveChromeExecutable(),
        },
      }
    );
    assert.equal(built.status, 0, `${built.stdout}\n${built.stderr}`);

    const manifestPath = path.join(
      tempRoot,
      'scripts',
      'tailored-packages.json'
    );
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.packages[0].publishStatus = 'live-verified';
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    initializeGit(tempRoot);
    commitAll(tempRoot, 'forged verification fixture');

    const privateLedger = path.join(tempRoot, '.private', 'applications.json');
    let corruptLivePdf = false;
    let corruptLiveCoverLetter = false;
    const fixtureServer = await startFixtureServer(tempRoot, {
      transform(relativePath, content) {
        const corruptResume =
          corruptLivePdf && relativePath.endsWith('-Resume.pdf');
        const corruptCoverLetter =
          corruptLiveCoverLetter &&
          relativePath.endsWith('-Cover-Letter.pdf');
        return corruptResume || corruptCoverLetter
          ? Buffer.concat([content, Buffer.from('stale')])
          : content;
      },
    });
    server = fixtureServer.server;
    process.env.WORKFLOW_REPO_ROOT = tempRoot;
    process.env.APPLICATION_LEDGER_PATH = privateLedger;
    const env = {
      ...process.env,
      WORKFLOW_REPO_ROOT: tempRoot,
      APPLICATION_LEDGER_PATH: privateLedger,
    };
    await assert.rejects(
      () =>
        recordApplication(
          {
            package: 'confirmed-fixture',
            confirmation: 'Visible confirmation page',
            appliedAt: '2026-07-16T14:00:00Z',
          },
          { publicBase: fixtureServer.publicBase }
        ),
      /missing verification metadata/
    );

    const localManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    localManifest.packages[0].publishStatus = 'local-only';
    delete localManifest.packages[0].verification;
    writeFileSync(
      manifestPath,
      `${JSON.stringify(localManifest, null, 2)}\n`
    );
    commitAll(tempRoot, 'restore local-only fixture');

    corruptLiveCoverLetter = true;
    await assert.rejects(
      () =>
        verifyTailoredRoute('confirmed-fixture', {
          publicBase: fixtureServer.publicBase,
        }),
      /Cover-letter PDF checksum mismatch/
    );
    corruptLiveCoverLetter = false;
    await verifyTailoredRoute('confirmed-fixture', {
      publicBase: fixtureServer.publicBase,
    });
    commitAll(tempRoot, 'record live verification');
    const verifiedManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const wrongBaseCheck = run(
      ['scripts/check-tailored-packages.mjs', 'confirmed-fixture'],
      {
        env: {
          ...process.env,
          WORKFLOW_REPO_ROOT: tempRoot,
        },
      }
    );
    assert.notEqual(wrongBaseCheck.status, 0);
    assert.match(wrongBaseCheck.stderr, /verification route URL is incorrect/);

    corruptLivePdf = true;
    await assert.rejects(
      () =>
        recordApplication(
          {
            package: 'confirmed-fixture',
            confirmation: 'Visible confirmation page',
            appliedAt: '2026-07-16T14:00:00Z',
          },
          { publicBase: fixtureServer.publicBase }
        ),
      /Resume PDF checksum mismatch/
    );
    corruptLivePdf = false;
    const readinessOptions = {
      package: 'confirmed-fixture',
      applicationUrl: `${fixtureServer.publicBase}apply/REQ-123`,
      jobId: 'REQ-123',
      ats: 'greenhouse',
      preparedAt: '2026-07-16T13:50:00Z',
      screeningQuestions: 'reviewed',
      formHardGates: 'pass',
      parsedFields: 'pass',
      identityParity: 'pass',
      identitySha256: 'd'.repeat(64),
      narrativeAnswers: 'not-applicable',
      attachment: 'wrong.pdf',
      uploadedSha256: 'e'.repeat(64),
      aiNotice: 'seen',
      noticeUrl: `${fixtureServer.publicBase}automated-processing`,
      optOutPath: 'available',
      optOutUrl: `${fixtureServer.publicBase}automated-processing/opt-out`,
      accommodationPath: 'available',
      accommodationUrl: `${fixtureServer.publicBase}accommodations`,
      assessment: 'structured-video',
      platformIntegrity: 'clear',
      coverLetter: 'used',
    };
    const blockedReadiness = await prepareApplication(
      readinessOptions,
      { publicBase: fixtureServer.publicBase }
    );
    assert.equal(blockedReadiness.status, 'blocked');
    assert.match(
      blockedReadiness.blockers.join('\n'),
      /Attached filename|checksum/
    );
    const readinessOnlyLedger = JSON.parse(
      readFileSync(privateLedger, 'utf8')
    );
    assert.equal(readinessOnlyLedger.applications.length, 0);

    const missingCoverLetterReadiness = await prepareApplication(
      {
        ...readinessOptions,
        attachment: 'Wally-Mostafa-Confirmed-Fixture-Resume.pdf',
        uploadedSha256:
          verifiedManifest.packages[0].verification.pdfSha256,
        coverLetter: 'not-used',
      },
      { publicBase: fixtureServer.publicBase }
    );
    assert.equal(missingCoverLetterReadiness.status, 'blocked');
    assert.match(
      missingCoverLetterReadiness.blockers.join('\n'),
      /requires the generated cover letter/
    );

    const formBlockedReadiness = await prepareApplication(
      {
        ...readinessOptions,
        formHardGates: 'blocked',
        parsedFields: 'incorrect',
        attachment: 'Wally-Mostafa-Confirmed-Fixture-Resume.pdf',
        uploadedSha256:
          verifiedManifest.packages[0].verification.pdfSha256,
      },
      { publicBase: fixtureServer.publicBase }
    );
    assert.equal(formBlockedReadiness.status, 'blocked');
    assert.match(
      formBlockedReadiness.blockers.join('\n'),
      /application form revealed a blocking hard gate/
    );
    assert.match(
      formBlockedReadiness.blockers.join('\n'),
      /ATS-parsed application fields have not been reviewed/
    );

    const ready = await prepareApplication(
      {
        ...readinessOptions,
        attachment: 'Wally-Mostafa-Confirmed-Fixture-Resume.pdf',
        uploadedSha256:
          verifiedManifest.packages[0].verification.pdfSha256,
      },
      { publicBase: fixtureServer.publicBase }
    );
    assert.equal(ready.status, 'ready');
    const duplicateReadyLedger = JSON.parse(
      readFileSync(privateLedger, 'utf8')
    );
    duplicateReadyLedger.readiness.push({
      ...structuredClone(duplicateReadyLedger.readiness[0]),
      packageSlug: 'other-confirmed-fixture',
      convertedApplicationId: null,
    });
    writeFileSync(
      privateLedger,
      `${JSON.stringify(duplicateReadyLedger, null, 2)}\n`
    );
    await assert.rejects(
      () =>
        recordApplication(
          {
            package: 'confirmed-fixture',
            confirmation: 'Visible confirmation page',
            appliedAt: '2026-07-16T14:00:00Z',
            jobId: 'REQ-123',
          },
          { publicBase: fixtureServer.publicBase }
        ),
      /ready submission already exists/
    );
    duplicateReadyLedger.readiness.pop();
    writeFileSync(
      privateLedger,
      `${JSON.stringify(duplicateReadyLedger, null, 2)}\n`
    );
    await assert.rejects(
      () =>
        recordApplication(
          {
            package: 'confirmed-fixture',
            confirmation: 'Visible confirmation page',
            appliedAt: '2026-07-16T14:00:00Z',
            jobId: 'REQ-123',
            ats: 'ashby',
          },
          { publicBase: fixtureServer.publicBase }
        ),
      /ATS vendor does not match readiness/
    );
    const application = await recordApplication(
      {
        package: 'confirmed-fixture',
        confirmation: 'Visible confirmation page',
        appliedAt: '2026-07-16T14:00:00Z',
        jobId: 'REQ-123',
      },
      { publicBase: fixtureServer.publicBase }
    );
    assert.equal(
      application.artifactVerification.configSha256,
      verifiedManifest.packages[0].verification.configSha256
    );
    await assert.rejects(
      () =>
        prepareApplication(
          {
            ...readinessOptions,
            attachment: 'Wally-Mostafa-Confirmed-Fixture-Resume.pdf',
            uploadedSha256:
              verifiedManifest.packages[0].verification.pdfSha256,
          },
          { publicBase: fixtureServer.publicBase }
        ),
      /application already exists.*REQ-123/i
    );
    assert.throws(
      () =>
        recordAssessment({
          id: application.applicationId,
          status: 'started',
          assessmentType: 'structured-video',
          at: '2026-07-16T14:05:00Z',
          source: 'employer-email',
        }),
      /requires at least one competency/
    );
    assert.throws(
      () =>
        recordAssessment({
          id: application.applicationId,
          status: 'started',
          assessmentType: 'structured-video',
          at: '2026-07-16T14:05:00Z',
          source: 'employer-email',
          competencies: 'ai-product-delivery',
          proofIds: 'hedgehox-03,hedgehox-03',
          prepCopySha256: 'f'.repeat(64),
          semanticPassComplete: 'yes',
        }),
      /distinct foundation proof IDs/
    );
    const invitedAssessment = recordAssessment({
      id: application.applicationId,
      status: 'invited',
      assessmentType: 'structured-video',
      at: '2026-07-16T14:02:00Z',
      source: 'employer-email',
    });
    assert.equal(invitedAssessment.assessmentStatus, 'invited');
    const startedAssessment = recordAssessment({
      id: application.applicationId,
      status: 'started',
      assessmentType: 'structured-video',
      at: '2026-07-16T14:05:00Z',
      source: 'employer-portal',
      competencies: 'ai-product-delivery',
      proofIds: 'hedgehox-03,one-block-away-04',
      prepCopySha256: 'f'.repeat(64),
      semanticPassComplete: 'yes',
    });
    assert.equal(startedAssessment.semanticPassAttested, true);
    const assessmentLedger = JSON.parse(readFileSync(privateLedger, 'utf8'));
    assert.equal(assessmentLedger.applications[0].currentStage, 'applied');

    const drafted = run(
      [
        'scripts/application-ledger.mjs',
        'outreach',
        '--id',
        application.applicationId,
        '--status',
        'draft',
        '--channel',
        'LinkedIn',
        '--at',
        '2026-07-16T14:10:00Z',
      ],
      { env }
    );
    assert.equal(drafted.status, 0, drafted.stderr);
    const sent = run(
      [
        'scripts/application-ledger.mjs',
        'outreach',
        '--id',
        application.applicationId,
        '--status',
        'sent',
        '--channel',
        'LinkedIn',
        '--at',
        '2026-07-16T14:20:00Z',
      ],
      { env }
    );
    assert.equal(sent.status, 0, sent.stderr);
    const emailDraft = run(
      [
        'scripts/application-ledger.mjs',
        'outreach',
        '--id',
        application.applicationId,
        '--status',
        'draft',
        '--channel',
        'Email',
        '--at',
        '2026-07-16T14:30:00Z',
      ],
      { env }
    );
    assert.equal(emailDraft.status, 0, emailDraft.stderr);
    const linkedInRegression = run(
      [
        'scripts/application-ledger.mjs',
        'outreach',
        '--id',
        application.applicationId,
        '--status',
        'draft',
        '--channel',
        'LinkedIn',
        '--at',
        '2026-07-16T14:25:00Z',
      ],
      { env }
    );
    assert.notEqual(linkedInRegression.status, 0);
    assert.match(linkedInRegression.stderr, /cannot regress/);
    const reportResult = run(
      ['scripts/application-ledger.mjs', 'report'],
      { env }
    );
    assert.equal(reportResult.status, 0, reportResult.stderr);
    const report = JSON.parse(reportResult.stdout);
    assert.equal(report.totalApplications, 1);
    assert.equal(report.totalReadinessRecords, 1);
    assert.equal(report.readinessByStatus.ready, 1);
    assert.equal(report.byPositioningLane['ai-product-implementation'], 1);
    assert.equal(report.byCoverLetterStatus.used, 1);
    assert.equal(report.requirementCoverage.direct, 2);
    assert.equal(report.requirementCoverage.exact, 1);
    assert.equal(report.requirementCoverage.contextual, 1);
    assert.equal(report.assessments.byType['structured-video'], 2);
    assert.equal(report.assessments.byStatus.invited, 1);
    assert.equal(report.assessments.byStatus.started, 1);
    assert.equal(report.outreach.draft, 2);
    assert.equal(report.outreach.sent, 1);

    const olderOutreach = run(
      [
        'scripts/application-ledger.mjs',
        'outreach',
        '--id',
        application.applicationId,
        '--status',
        'replied',
        '--channel',
        'LinkedIn',
        '--at',
        '2026-07-16T14:05:00Z',
      ],
      { env }
    );
    assert.notEqual(olderOutreach.status, 0);
    assert.match(olderOutreach.stderr, /cannot be earlier/);

    const rejected = run(
      [
        'scripts/application-ledger.mjs',
        'event',
        '--id',
        application.applicationId,
        '--stage',
        'rejected',
        '--at',
        '2026-07-16T15:00:00Z',
        '--source',
        'email',
        '--outcome-category',
        'ai-application-review',
      ],
      { env }
    );
    assert.equal(rejected.status, 0, rejected.stderr);
    const regression = run(
      [
        'scripts/application-ledger.mjs',
        'event',
        '--id',
        application.applicationId,
        '--stage',
        'interview',
        '--at',
        '2026-07-16T16:00:00Z',
        '--source',
        'email',
      ],
      { env }
    );
    assert.notEqual(regression.status, 0);
    assert.match(regression.stderr, /terminal stage rejected/);

    writeFileSync(`${privateLedger}.lock`, 'locked');
    const lockedWrite = run(
      [
        'scripts/application-ledger.mjs',
        'outreach',
        '--id',
        application.applicationId,
        '--status',
        'replied',
        '--channel',
        'LinkedIn',
        '--at',
        '2026-07-16T16:10:00Z',
      ],
      { env }
    );
    assert.notEqual(lockedWrite.status, 0);
    assert.match(lockedWrite.stderr, /locked by another process/);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (previousRepoRoot === undefined) {
      delete process.env.WORKFLOW_REPO_ROOT;
    } else {
      process.env.WORKFLOW_REPO_ROOT = previousRepoRoot;
    }
    if (previousLedgerPath === undefined) {
      delete process.env.APPLICATION_LEDGER_PATH;
    } else {
      process.env.APPLICATION_LEDGER_PATH = previousLedgerPath;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('failed ledger rename removes the sensitive temporary copy', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'ledger-rename-failure-'));
  const ledgerFile = path.join(tempRoot, 'applications.json');
  const previousLedgerPath = process.env.APPLICATION_LEDGER_PATH;
  process.env.APPLICATION_LEDGER_PATH = ledgerFile;
  try {
    assert.throws(
      () =>
        writeLedgerAtomic(
          { schemaVersion: 1, applications: [] },
          {
            rename() {
              throw new Error('simulated rename failure');
            },
          }
        ),
      /simulated rename failure/
    );
    assert.deepEqual(
      readdirSync(tempRoot).filter((entry) => entry.endsWith('.tmp')),
      []
    );
  } finally {
    if (previousLedgerPath === undefined) {
      delete process.env.APPLICATION_LEDGER_PATH;
    } else {
      process.env.APPLICATION_LEDGER_PATH = previousLedgerPath;
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('private ledger validation rejects corrupt records before reporting', () => {
  const example = JSON.parse(
    readFileSync(
      path.join(repoRoot, 'scripts', 'applications.example.json'),
      'utf8'
    )
  );
  assert.deepEqual(validateLedger(example), []);

  const corrupt = structuredClone(example);
  corrupt.applications[0].currentStage = 'interview';
  corrupt.applications[0].outreach[0].threadKey = 'wrong-thread';
  const errors = validateLedger(corrupt);
  assert.ok(
    errors.some((error) => error.includes('currentStage must match'))
  );
  assert.ok(errors.some((error) => error.includes('threadKey is incorrect')));

  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'invalid-ledger-'));
  try {
    const ledgerPath = path.join(tempRoot, 'applications.json');
    writeFileSync(ledgerPath, `${JSON.stringify(corrupt, null, 2)}\n`);
    const report = run(['scripts/application-ledger.mjs', 'report'], {
      env: {
        ...process.env,
        APPLICATION_LEDGER_PATH: ledgerPath,
      },
    });
    assert.notEqual(report.status, 0);
    assert.match(report.stderr, /Private application ledger is invalid/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('malformed PDFs fail the ATS preflight while keyword coverage stays advisory', () => {
  const temporaryDir = mkdtempSync(path.join(os.tmpdir(), 'ats-check-test-'));
  const fakePdf = path.join(temporaryDir, 'bad.pdf');
  const configPath = path.join(temporaryDir, 'package.json');
  const config = validConfig();
  approveHumanizerReview(config, {
    reviewedAt: '2026-07-22T12:00:00.000Z',
    semanticPassComplete: true,
  });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  writeFileSync(fakePdf, 'not a pdf');
  const result = run([
    'scripts/ats-check.mjs',
    '--config',
    configPath,
    '--pdf',
    fakePdf,
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PDF text extraction failed|PDF metadata inspection failed/);
});

test('legacy inventory is non-blocking by default', () => {
  const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'workflow-v2-legacy-'));
  try {
    mkdirSync(path.join(tempRoot, 'scripts'), { recursive: true });
    writeFileSync(
      path.join(tempRoot, 'scripts', 'tailored-packages.json'),
      `${JSON.stringify(
        {
          schemaVersion: 2,
          workflowVersions: [1, 2],
          packages: [
            {
              slug: 'legacy-fixture',
              resumePdfPath: 'output/pdf/Legacy-Fixture.pdf',
            },
          ],
        },
        null,
        2
      )}\n`
    );
    const result = run(['scripts/check-tailored-packages.mjs', '--all'], {
      env: {
        ...process.env,
        WORKFLOW_REPO_ROOT: tempRoot,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /1 legacy package\(s\) skipped/);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('legacy generator is retired so new packages cannot bypass v2', () => {
  const result = run(['scripts/generate-tailored-package.mjs']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /legacy generator has been retired/);
});

test(
  'failed route QA retains temporary screenshots for diagnosis',
  { timeout: 180_000 },
  () => {
    const { tempRoot, config, configPath } = createBuildFixture({
      slug: 'route-failure-fixture',
      artifactStem: 'Route-Failure-Fixture',
    });
    try {
      const routeDirectory = path.join(tempRoot, config.slug);
      mkdirSync(routeDirectory, { recursive: true });
      cpSync(
        path.join(tempRoot, 'index.html'),
        path.join(routeDirectory, 'index.html')
      );
      const result = run(
        ['scripts/route-ui-check.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.notEqual(result.status, 0);
      const qaDirectory = path.join(
        tempRoot,
        'tmp',
        'qa',
        config.slug
      );
      assert.ok(existsSync(path.join(qaDirectory, 'desktop.png')));
      assert.ok(existsSync(path.join(qaDirectory, 'mobile.png')));
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'failed post-render QA rolls back every generated artifact and config mutation',
  { timeout: 180_000 },
  () => {
    const { tempRoot, config, configPath } = createBuildFixture({
      slug: 'rollback-fixture',
      artifactStem: 'Rollback-Fixture',
    });
    try {
      config.resume.roles.hedgehox.push(
        'Delivered a rollback-only prohibited phrase.'
      );
      config.resume.sourceBulletIds.hedgehox.push(
        'addition:rollback-only-prohibited'
      );
      config.constraints.blockedTerms = [
        'rollback-only prohibited phrase',
      ];
      approveHumanizerReview(config, {
        reviewedAt: '2026-07-22T12:00:00.000Z',
        semanticPassComplete: true,
      });
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
      const result = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.notEqual(result.status, 0);
      assert.match(
        result.stderr,
        /ATS preflight failed|Recruiter-facing route copy contains unsupported claims/
      );
      assert.equal(
        existsSync(path.join(tempRoot, 'rollback-fixture', 'index.html')),
        false
      );
      assert.equal(
        existsSync(
          path.join(
            tempRoot,
            'output',
            'pdf',
            'Wally-Mostafa-Rollback-Fixture-Resume.pdf'
          )
        ),
        false
      );
      assert.equal(
        existsSync(
          path.join(
            tempRoot,
            'tmp',
            'tailored-resumes',
            'rollback-fixture.html'
          )
        ),
        false
      );
      const restoredConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.equal(restoredConfig.qa.status, 'pending');
      const manifest = JSON.parse(
        readFileSync(
          path.join(tempRoot, 'scripts', 'tailored-packages.json'),
          'utf8'
        )
      );
      assert.deepEqual(manifest.packages, []);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'scoped-project v2 packages rewrite nested resources and QA every page',
  { timeout: 180_000 },
  () => {
    const { tempRoot, configPath } = createBuildFixture({
      slug: 'scoped-fixture',
      artifactStem: 'Scoped-Fixture',
      routeMode: 'scoped-projects',
      selectedProjects: [
        'project-03.html',
        'project-06.html',
        'project-07.html',
      ],
    });
    try {
      const result = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      for (const [projectIndex, project] of [
        'project-03.html',
        'project-06.html',
        'project-07.html',
      ].entries()) {
        const html = readFileSync(
          path.join(tempRoot, 'scoped-fixture', project),
          'utf8'
        );
        assert.doesNotMatch(
          html,
          /\b(?:href|src)="(?:assets\/|favicon\.ico|apple-touch-icon\.png|site\.webmanifest)/
        );
        assert.match(
          html,
          /href="\.\.\/output\/pdf\/Wally-Mostafa-Scoped-Fixture-Resume\.pdf"/
        );
        assert.match(
          html,
          new RegExp(
            `<div class="project-number">${String(projectIndex + 1).padStart(
              2,
              '0'
            )}</div>`
          )
        );
      }
      const savedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.equal(savedConfig.qa.route.errors.length, 0);
      assert.equal(savedConfig.qa.route.viewports.length, 8);
      assert.equal(
        savedConfig.qa.route.viewports.some((viewport) =>
          Object.hasOwn(viewport, 'screenshot')
        ),
        false
      );
      assert.equal(
        existsSync(path.join(tempRoot, 'tmp', 'qa', 'scoped-fixture')),
        false
      );
      assert.equal(
        Object.keys(
          savedConfig.qa.artifactHashes.scopedProjectSha256
        ).length,
        3
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'overwrite removes retired scoped pages and restores prior QA after failure',
  { timeout: 240_000 },
  () => {
    const { tempRoot, configPath } = createBuildFixture({
      slug: 'overwrite-fixture',
      artifactStem: 'Overwrite-Fixture',
      routeMode: 'scoped-projects',
      selectedProjects: [
        'project-03.html',
        'project-04.html',
        'project-05.html',
      ],
    });
    try {
      const env = {
        ...process.env,
        WORKFLOW_REPO_ROOT: tempRoot,
        CHROME_PATH: resolveChromeExecutable(),
      };
      const initialBuild = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        { env }
      );
      assert.equal(
        initialBuild.status,
        0,
        `${initialBuild.stdout}\n${initialBuild.stderr}`
      );

      const qaDirectory = path.join(
        tempRoot,
        'tmp',
        'qa',
        'overwrite-fixture'
      );
      const priorQa = snapshotDirectory(qaDirectory);
      const manifestPath = path.join(
        tempRoot,
        'scripts',
        'tailored-packages.json'
      );
      const manifestWithStaleVerification = JSON.parse(
        readFileSync(manifestPath, 'utf8')
      );
      manifestWithStaleVerification.packages[0].publishStatus =
        'live-verified';
      manifestWithStaleVerification.packages[0].verification = {
        verifiedAt: '2026-07-15T12:00:00.000Z',
        stale: true,
      };
      writeFileSync(
        manifestPath,
        `${JSON.stringify(manifestWithStaleVerification, null, 2)}\n`
      );
      const priorManifest = readFileSync(manifestPath);

      const failingConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      failingConfig.selectedProjects = [
        'project-03.html',
        'project-04.html',
        'project-06.html',
      ];
      failingConfig.resume.roles.hedgehox.push(
        'Delivered a forbidden overwrite phrase.'
      );
      failingConfig.resume.sourceBulletIds.hedgehox.push(
        'addition:forbidden-overwrite'
      );
      failingConfig.constraints.blockedTerms = [
        'forbidden overwrite phrase',
      ];
      approveHumanizerReview(failingConfig, {
        reviewedAt: '2026-07-22T12:00:00.000Z',
        semanticPassComplete: true,
      });
      writeFileSync(
        configPath,
        `${JSON.stringify(failingConfig, null, 2)}\n`
      );

      const failedOverwrite = run(
        [
          'scripts/build-tailored-package.mjs',
          '--config',
          configPath,
          '--overwrite',
        ],
        { env }
      );
      assert.notEqual(failedOverwrite.status, 0);
      assert.match(
        failedOverwrite.stderr,
        /ATS preflight failed|Recruiter-facing route copy contains unsupported claims/
      );
      assert.ok(
        existsSync(
          path.join(tempRoot, 'overwrite-fixture', 'project-05.html')
        )
      );
      assert.equal(
        existsSync(
          path.join(tempRoot, 'overwrite-fixture', 'project-06.html')
        ),
        false
      );
      assert.deepEqual(readFileSync(manifestPath), priorManifest);
      assertDirectorySnapshot(qaDirectory, priorQa);

      const succeedingConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      succeedingConfig.resume.roles.hedgehox =
        succeedingConfig.resume.roles.hedgehox.filter(
          (bullet) => !bullet.includes('forbidden overwrite phrase')
        );
      succeedingConfig.resume.sourceBulletIds.hedgehox =
        succeedingConfig.resume.sourceBulletIds.hedgehox.filter(
          (sourceId) => sourceId !== 'addition:forbidden-overwrite'
        );
      succeedingConfig.constraints.blockedTerms = ['Python engineering'];
      approveHumanizerReview(succeedingConfig, {
        reviewedAt: '2026-07-22T12:00:00.000Z',
        semanticPassComplete: true,
      });
      writeFileSync(
        configPath,
        `${JSON.stringify(succeedingConfig, null, 2)}\n`
      );
      const successfulOverwrite = run(
        [
          'scripts/build-tailored-package.mjs',
          '--config',
          configPath,
          '--overwrite',
        ],
        { env }
      );
      assert.equal(
        successfulOverwrite.status,
        0,
        `${successfulOverwrite.stdout}\n${successfulOverwrite.stderr}`
      );
      assert.equal(
        existsSync(
          path.join(tempRoot, 'overwrite-fixture', 'project-05.html')
        ),
        false
      );
      assert.ok(
        existsSync(
          path.join(tempRoot, 'overwrite-fixture', 'project-06.html')
        )
      );
      assert.equal(existsSync(qaDirectory), false);
      const finalManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      assert.deepEqual(finalManifest.packages[0].selectedProjects, [
        'project-03.html',
        'project-04.html',
        'project-06.html',
      ]);
      assert.equal(finalManifest.packages[0].verification, undefined);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'hybrid-selective fixture builds a readable two-page package with base metadata',
  { timeout: 180_000 },
  () => {
    const fixture = createBuildFixture({
      slug: 'hybrid-selective-fixture',
      artifactStem: 'Hybrid-Selective-Fixture',
    });
    const { tempRoot, configPath } = fixture;
    try {
      const config = hybridSelectiveConfig();
      config.slug = 'hybrid-selective-fixture';
      config.roleTitle = 'Hybrid Selective Fixture';
      config.artifactStem = 'Hybrid-Selective-Fixture';
      config.job.company = 'Fixture Company';
      config.job.roleTitle = 'Hybrid Client AI Lead';
      config.job.jobId = 'hybrid-fixture';
      config.job.rawJd =
        'Own strategic client relationships and translate client needs into working AI workflows.';
      config.hero.eyebrow = 'Hybrid Client AI Lead';
      config.constraints.blockedTerms = ['Python engineering'];
      approveHumanizerReview(config, {
        reviewedAt: '2026-08-02T12:00:00.000Z',
        semanticPassComplete: true,
      });
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const result = run(
        ['scripts/build-tailored-package.mjs', '--config', configPath],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

      const pdfPath = path.join(
        tempRoot,
        'output',
        'pdf',
        'Wally-Mostafa-Hybrid-Selective-Fixture-Resume.pdf'
      );
      const pdfInfo = spawnSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
      assert.equal(pdfInfo.status, 0, pdfInfo.stderr);
      const pageCount = Number(pdfInfo.stdout.match(/^Pages:\s+(\d+)$/m)?.[1]);
      assert.ok(pageCount >= 1 && pageCount <= 2);

      const savedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.equal(savedConfig.qa.ats.ok, true);
      assert.ok(
        savedConfig.qa.ats.annotations.some(
          (annotation) =>
            annotation.uri ===
            'https://wallymo.github.io/hybrid-selective-fixture/'
        )
      );
      assert.equal(savedConfig.qa.resumeBase.mode, 'hybrid-selective');
      assert.equal(savedConfig.qa.resumeBase.registryVersion, 1);
      assert.match(savedConfig.qa.resumeBase.registrySha256, /^[a-f0-9]{64}$/);
      assert.equal(
        savedConfig.qa.resumeBase.leadProfileId,
        'account-leadership'
      );
      const manifest = JSON.parse(
        readFileSync(
          path.join(tempRoot, 'scripts', 'tailored-packages.json'),
          'utf8'
        )
      );
      assert.equal(manifest.packages[0].resumeBaseMode, 'hybrid-selective');
      assert.equal(
        manifest.packages[0].accountPresentation,
        'agency-progression'
      );
      assert.match(
        readFileSync(
          path.join(tempRoot, 'hybrid-selective-fixture', 'index.html'),
          'utf8'
        ),
        /Wally-Mostafa-Hybrid-Selective-Fixture-Resume\.pdf/
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);

test(
  'end-to-end v2 fixture automatically builds a recommended cover letter and removes temporary HTML',
  { timeout: 180_000 },
  () => {
    const { tempRoot, config, configPath } = createBuildFixture({
      fitClass: 'adjacent',
    });
    try {
      config.requirements[0].resumeTerms = ['deliberately absent supported phrase'];
      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const result = run(
        [
          'scripts/build-tailored-package.mjs',
          '--config',
          configPath,
        ],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
            CHROME_PATH: resolveChromeExecutable(),
          },
        }
      );
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

      const pdfPath = path.join(
        tempRoot,
        'output',
        'pdf',
        'Wally-Mostafa-Workflow-V2-Fixture-Resume.pdf'
      );
      const routePath = path.join(
        tempRoot,
        'workflow-v2-fixture',
        'index.html'
      );
      const temporaryHtml = path.join(
        tempRoot,
        'tmp',
        'tailored-resumes',
        'workflow-v2-fixture.html'
      );
      const coverLetterPdfPath = path.join(
        tempRoot,
        'output',
        'pdf',
        'Wally-Mostafa-Workflow-V2-Fixture-Cover-Letter.pdf'
      );
      const coverLetterMarkdownPath = path.join(
        tempRoot,
        'output',
        'pdf',
        'Wally-Mostafa-Workflow-V2-Fixture-Cover-Letter.md'
      );
      const temporaryCoverLetterHtml = path.join(
        tempRoot,
        'tmp',
        'tailored-resumes',
        'workflow-v2-fixture-cover-letter.html'
      );
      const qaDirectory = path.join(
        tempRoot,
        'tmp',
        'qa',
        'workflow-v2-fixture'
      );
      assert.ok(existsSync(pdfPath));
      assert.ok(existsSync(coverLetterPdfPath));
      assert.ok(existsSync(coverLetterMarkdownPath));
      assert.ok(existsSync(routePath));
      assert.equal(existsSync(temporaryHtml), false);
      assert.equal(existsSync(temporaryCoverLetterHtml), false);
      assert.equal(existsSync(qaDirectory), false);
      const coverLetterInfo = spawnSync(
        'pdfinfo',
        [coverLetterPdfPath],
        { encoding: 'utf8' }
      );
      assert.equal(coverLetterInfo.status, 0, coverLetterInfo.stderr);
      assert.match(coverLetterInfo.stdout, /^Pages:\s+1$/m);
      assert.match(
        readFileSync(routePath, 'utf8'),
        /href="\.\.\/output\/pdf\/Wally-Mostafa-Workflow-V2-Fixture-Resume\.pdf"/
      );

      const manifest = JSON.parse(
        readFileSync(
          path.join(tempRoot, 'scripts', 'tailored-packages.json'),
          'utf8'
        )
      );
      assert.equal(manifest.packages[0].workflowVersion, 2);
      assert.equal(manifest.packages[0].resumeHtmlPath, undefined);
      assert.equal(
        manifest.packages[0].coverLetterPdfPath,
        'output/pdf/Wally-Mostafa-Workflow-V2-Fixture-Cover-Letter.pdf'
      );
      assert.equal(
        manifest.packages[0].coverLetterMarkdownPath,
        'output/pdf/Wally-Mostafa-Workflow-V2-Fixture-Cover-Letter.md'
      );
      assert.equal(manifest.packages[0].qaStatus, 'qa-passed');
      const savedConfig = JSON.parse(readFileSync(configPath, 'utf8'));
      assert.equal(savedConfig.qa.ats.ok, true);
      assert.equal(savedConfig.qa.coverLetter.ok, true);
      assert.equal(savedConfig.qa.coverLetter.pageCount, 1);
      assert.equal(
        savedConfig.qa.coverLetter.templateVersion,
        COVER_LETTER_TEMPLATE_VERSION
      );
      assert.equal(
        savedConfig.qa.coverLetter.fonts.display,
        'Syne 800'
      );
      assert.equal(
        savedConfig.qa.coverLetter.fonts.body,
        'Instrument Sans 400/600'
      );
      assert.equal(
        savedConfig.qa.coverLetter.layout.header,
        'centered-rule'
      );
      assert.equal(savedConfig.qa.coverLetterRenderer.fontWait, true);
      assert.equal(
        savedConfig.qa.route.viewports.some((viewport) =>
          Object.hasOwn(viewport, 'screenshot')
        ),
        false
      );
      assert.ok(savedConfig.qa.ats.warnings.length > 0);
      assert.equal(
        savedConfig.qa.configInputSha256,
        configInputSha256(savedConfig)
      );
      assert.equal(savedConfig.qa.renderer.browser.name.includes('/'), false);

      const unsupportedConfig = structuredClone(savedConfig);
      unsupportedConfig.requirements[1].evidenceStatus = 'none';
      unsupportedConfig.requirements[1].proofIds = [];
      unsupportedConfig.requirements[1].destinations = ['cover-letter'];
      unsupportedConfig.requirements[1].matchMode = 'not-supported';
      unsupportedConfig.requirements[1].resumeTerms = ['AI implementation'];
      writeFileSync(
        configPath,
        `${JSON.stringify(unsupportedConfig, null, 2)}\n`
      );
      const unsupportedResult = run(
        [
          'scripts/ats-check.mjs',
          '--config',
          configPath,
          '--pdf',
          pdfPath,
        ],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
          },
        }
      );
      assert.notEqual(unsupportedResult.status, 0);
      assert.match(
        unsupportedResult.stderr,
        /Unsupported requirement language/
      );
      writeFileSync(configPath, `${JSON.stringify(savedConfig, null, 2)}\n`);

      for (const args of [
        ['init', '-q'],
        ['config', 'user.email', 'workflow-v2@example.com'],
        ['config', 'user.name', 'Workflow v2 Test'],
        [
          'add',
          'workflow-v2-fixture/index.html',
          'output/pdf/Wally-Mostafa-Workflow-V2-Fixture-Resume.pdf',
          'output/pdf/Wally-Mostafa-Workflow-V2-Fixture-Cover-Letter.pdf',
          'output/pdf/Wally-Mostafa-Workflow-V2-Fixture-Cover-Letter.md',
          'scripts/packages/workflow-v2-fixture.json',
          'scripts/tailored-packages.json',
        ],
        ['commit', '-qm', 'fixture'],
      ]) {
        const gitResult = spawnSync('git', args, {
          cwd: tempRoot,
          encoding: 'utf8',
        });
        assert.equal(gitResult.status, 0, gitResult.stderr);
      }
      const cleanCheck = run(
        ['scripts/check-tailored-packages.mjs', 'workflow-v2-fixture'],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
          },
        }
      );
      assert.equal(cleanCheck.status, 0, cleanCheck.stderr);
      appendFileSync(routePath, '\n<!-- post-QA mutation -->\n');
      const staleCheck = run(
        ['scripts/check-tailored-packages.mjs', 'workflow-v2-fixture'],
        {
          env: {
            ...process.env,
            WORKFLOW_REPO_ROOT: tempRoot,
          },
        }
      );
      assert.notEqual(staleCheck.status, 0);
      assert.match(staleCheck.stderr, /route changed after QA/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  }
);
