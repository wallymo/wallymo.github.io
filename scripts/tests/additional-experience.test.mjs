import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import {
  RESUME_ROLE_IDS,
  getArtifactPaths,
  getResumeExperienceEntries,
  humanizerCopyEntries,
  humanizerCopySha256,
  readResumeFoundation,
  recruiterFacingClaimViolations,
  resumeRoleBulletTexts,
  resumeRoleSubEntries,
  validateV2Config,
} from '../lib/workflow-v2.mjs';
import { buildResume } from '../build-tailored-package.mjs';
import { resumeExperienceAnchorFailures } from '../ats-check.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const foundation = readResumeFoundation();

function fixture() {
  const config = JSON.parse(readFileSync(path.join(repoRoot, 'scripts/examples/package-v2.json'), 'utf8'));
  config.resume.experienceSections = [
    { heading: 'Account Management Experience', roleIds: ['account-management'] },
    { heading: 'Most Recent Experience', roleIds: RESUME_ROLE_IDS.filter((id) => id !== 'account-management') },
  ];
  config.resume.additionalExperience = [{
    id: 'example-current-contract',
    title: 'Freelance Product Manager',
    employer: 'Example consultancy | Client: Example agency',
    location: 'Remote',
    dateRange: 'Oct 2026 - Present',
    beforeRoleId: 'hedgehox',
    bullets: [
      'Define requirements and acceptance criteria for existing scoping and briefing tools',
      'Coordinate product, design, engineering, testing, and handoff priorities',
    ],
    sourceBulletIds: ['addition:example-contract-requirements', 'addition:example-contract-coordination'],
    sourceNote: 'User-confirmed current contract with responsibility for product definition and implementation support.',
  }];
  return config;
}

function schemaErrors(config) {
  const result = spawnSync('python3', ['-c', [
    'import json, sys, jsonschema',
    'schema = json.load(open(sys.argv[1]))',
    'config = json.load(sys.stdin)',
    'print(json.dumps([e.message for e in jsonschema.Draft202012Validator(schema).iter_errors(config)]))',
  ].join('\n'), path.join(repoRoot, 'scripts/schemas/package-v2.schema.json')], {
    input: JSON.stringify(config), encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function extractedFixtureText(config) {
  return [
    ...getResumeExperienceEntries(config).map(({ roleId, additionalExperience }) => {
      if (additionalExperience) {
        return [additionalExperience.title, additionalExperience.employer, additionalExperience.location, additionalExperience.dateRange, ...additionalExperience.bullets].filter(Boolean).join('\n');
      }
      const entries = resumeRoleSubEntries(config.resume, roleId);
      if (entries) {
        return entries.map((entry) => [entry.title, entry.employer, entry.dateRange, ...entry.bullets].join('\n')).join('\n');
      }
      const header = foundation.roleHeaders[roleId];
      return [config.resume.roleTitleOverrides?.[roleId] || header.title, header.employer, header.dateRange, ...resumeRoleBulletTexts(config.resume, roleId)].join('\n');
    }),
    ...foundation.educationAnchors,
  ].join('\n');
}

test('additional experience leaves legacy configs valid and preserves section order', () => {
  const config = fixture();
  assert.deepEqual(validateV2Config(config), []);
  assert.deepEqual(schemaErrors(config), []);
  assert.deepEqual(getResumeExperienceEntries(config).map(({ roleId }) => roleId), [
    'account-management', 'example-current-contract', ...RESUME_ROLE_IDS.filter((id) => id !== 'account-management'),
  ]);
  delete config.resume.additionalExperience;
  assert.deepEqual(validateV2Config(config), []);
  assert.deepEqual(schemaErrors(config), []);
  assert.deepEqual(getResumeExperienceEntries(config).map(({ roleId }) => roleId), [
    'account-management', ...RESUME_ROLE_IDS.filter((id) => id !== 'account-management'),
  ]);
});

test('additional experience requires public evidence and one-to-one new source IDs', () => {
  const missingEvidence = fixture();
  delete missingEvidence.resume.additionalExperience[0].sourceNote;
  assert.match(validateV2Config(missingEvidence).join('\n'), /sourceNote is required/);
  assert.ok(schemaErrors(missingEvidence).some((error) => /sourceNote/.test(error)));

  const privatePath = fixture();
  privatePath.resume.additionalExperience[0].sourceNote = 'Evidence in /Users/example/Downloads/private-work-order.docx';
  assert.match(validateV2Config(privatePath).join('\n'), /sanitized public evidence/);

  const missingMapping = fixture();
  missingMapping.resume.additionalExperience[0].sourceBulletIds.pop();
  assert.match(validateV2Config(missingMapping).join('\n'), /map every bullet/);

  const reusedEvidence = fixture();
  reusedEvidence.resume.additionalExperience[0].sourceBulletIds[0] = 'hedgehox-01';
  assert.match(validateV2Config(reusedEvidence).join('\n'), /must not reuse foundation or profile evidence/);
  reusedEvidence.resume.additionalExperience[0].sourceBulletIds[0] = 'addition:scout-xyrem-account-lead';
  assert.match(validateV2Config(reusedEvidence).join('\n'), /must not reuse foundation or profile evidence/);

  const duplicate = fixture();
  duplicate.resume.additionalExperience[0].sourceBulletIds[1] = duplicate.resume.additionalExperience[0].sourceBulletIds[0];
  assert.match(validateV2Config(duplicate).join('\n'), /unique across the full resume/);

  const duplicateAcrossRoles = fixture();
  duplicateAcrossRoles.resume.roles.hedgehox.push('Additional supported test responsibility');
  duplicateAcrossRoles.resume.sourceBulletIds.hedgehox.push(duplicateAcrossRoles.resume.additionalExperience[0].sourceBulletIds[0]);
  assert.match(validateV2Config(duplicateAcrossRoles).join('\n'), /unique across the full resume/);
});

test('additional experience rejects role collisions, invalid targets, and older revisions', () => {
  const collision = fixture();
  collision.resume.additionalExperience[0].id = 'hedgehox';
  assert.match(validateV2Config(collision).join('\n'), /unique new role ID/);
  const unknownTarget = fixture();
  unknownTarget.resume.additionalExperience[0].beforeRoleId = 'missing-role';
  assert.match(validateV2Config(unknownTarget).join('\n'), /existing foundation role/);
  const older = fixture();
  older.contractRevision = 6;
  assert.match(validateV2Config(older).join('\n'), /additionalExperience is available only for revision 7/);
  assert.ok(schemaErrors(older).length);
});

test('additional experience is included in proof mapping and authored copy gates', () => {
  const config = fixture();
  config.requirements[0].proofIds.push(config.resume.additionalExperience[0].sourceBulletIds[0]);
  assert.deepEqual(validateV2Config(config), []);
  const fields = humanizerCopyEntries(config).map(([field]) => field);
  for (const field of ['title', 'employer', 'location', 'dateRange', 'sourceNote', 'bullets[0]', 'bullets[1]']) {
    assert.ok(fields.includes(`resume.additionalExperience[0].${field}`));
  }
  const hash = humanizerCopySha256(config);
  config.resume.additionalExperience[0].sourceNote += ' Updated evidence.';
  assert.notEqual(humanizerCopySha256(config), hash);
  const prohibited = config.constraints.doNotClaim[0];
  config.resume.additionalExperience[0].bullets[0] += ` ${prohibited}`;
  assert.ok(recruiterFacingClaimViolations(config).some((message) => /additionalExperience\[0\]\.bullets\[0\]/.test(message)));
  config.resume.additionalExperience[0].sourceNote += ` ${prohibited}`;
  assert.ok(recruiterFacingClaimViolations(config).some((message) => /additionalExperience\[0\]\.sourceNote/.test(message)));
});

test('additional experience renders in its section and keeps compact callout spacing', () => {
  const config = fixture();
  config.resume.portfolioCallout = true;
  config.resume.layoutDensity = 'compact';
  const html = buildResume(config, getArtifactPaths(config));
  assert.ok(html.indexOf('Most Recent Experience') < html.indexOf('Freelance Product Manager'));
  assert.ok(html.indexOf('Freelance Product Manager') < html.indexOf('AI Implementation Lead'));
  assert.match(html, /Example consultancy \| Client: Example agency/);
  assert.doesNotMatch(html, /User-confirmed current contract/);
  assert.doesNotMatch(html, /experience-2"\]\s+\.job(?:-desc)?\b/);
});

test('additional experience ATS anchors reject missing headers, missing bullets, and wrong ordering', () => {
  const config = fixture();
  const text = extractedFixtureText(config);
  assert.deepEqual(resumeExperienceAnchorFailures(config, foundation, text), []);
  const missingHeader = text.replace('Freelance Product Manager', '');
  assert.ok(resumeExperienceAnchorFailures(config, foundation, missingHeader).some((error) => /title anchor.*example-current-contract/.test(error)));
  const missingBullet = text.replace(config.resume.additionalExperience[0].bullets[0], '');
  assert.ok(resumeExperienceAnchorFailures(config, foundation, missingBullet).some((error) => /addition:example-contract-requirements/.test(error)));
  const newBlock = [config.resume.additionalExperience[0].title, config.resume.additionalExperience[0].employer, config.resume.additionalExperience[0].location, config.resume.additionalExperience[0].dateRange, ...config.resume.additionalExperience[0].bullets].join('\n');
  const wrongOrder = text.replace(newBlock, '') + '\n' + newBlock;
  assert.ok(resumeExperienceAnchorFailures(config, foundation, wrongOrder).some((error) => /missing or out of chronological order/.test(error)));
});
