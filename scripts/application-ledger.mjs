#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  PUBLIC_BASE,
  WORKFLOW_VERSION,
  bridgeRequiresCoverLetter,
  findManifestPackage,
  isMain,
  readJson,
  readResumeFoundation,
  resolveRepoPath,
} from './lib/workflow-v2.mjs';
import { checkPackages } from './check-tailored-packages.mjs';
import { fetchPublishedArtifacts } from './verify-tailored-route.mjs';

const STAGES = new Set([
  'applied',
  'recruiter-screen',
  'hiring-manager',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
]);
const OUTREACH_STATUSES = new Set(['draft', 'sent', 'replied']);
const ASSESSMENT_STATUSES = new Set([
  'invited',
  'started',
  'completed',
  'result-received',
]);
const ASSESSMENT_STATUS_RANK = {
  invited: 0,
  started: 1,
  completed: 2,
  'result-received': 3,
};
const ASSESSMENT_TYPES = new Set([
  'none',
  'structured-video',
  'skills-simulation',
  'coding',
  'language',
  'personality-work-style',
  'other',
]);
const SCREENING_QUESTION_STATUSES = new Set(['reviewed', 'unavailable']);
const FORM_HARD_GATE_STATUSES = new Set(['pass', 'blocked']);
const PARSED_FIELD_STATUSES = new Set(['pass', 'unavailable', 'incorrect']);
const IDENTITY_PARITY_STATUSES = new Set([
  'pass',
  'review-needed',
  'blocked',
]);
const NARRATIVE_ANSWER_STATUSES = new Set([
  'not-applicable',
  'passed',
  'pending',
]);
const AI_NOTICE_STATUSES = new Set(['none-seen', 'seen', 'unknown']);
const APPLICANT_PATH_STATUSES = new Set([
  'not-seen',
  'available',
  'not-offered',
]);
const PLATFORM_INTEGRITY_STATUSES = new Set(['clear', 'blocked']);
const COVER_LETTER_STATUSES = new Set([
  'used',
  'not-used',
  'not-applicable',
]);
const OUTCOME_CATEGORIES = new Set([
  'form-knockout',
  'ai-application-review',
  'recruiter-rejection',
  'assessment-rejection',
  'interview-outcome',
  'other',
]);
const STAGE_RANK = {
  applied: 0,
  'recruiter-screen': 1,
  'hiring-manager': 2,
  interview: 3,
  offer: 4,
};
const TERMINAL_STAGES = new Set(['offer', 'rejected', 'withdrawn']);
const OUTREACH_RANK = {
  draft: 0,
  sent: 1,
  replied: 2,
};
const FIT_CLASSES = new Set(['strong', 'adjacent', 'stretch']);
const EVIDENCE_MODES = new Set([
  'portfolio-primary',
  'balanced',
  'resume-primary',
  'credential-or-technical-primary',
]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const GOVERNED_CONTRACT_REVISIONS = new Set([5, 6, 7]);

function isGovernedContractRevision(value) {
  return GOVERNED_CONTRACT_REVISIONS.has(value);
}

function ledgerPath() {
  return path.resolve(
    process.env.APPLICATION_LEDGER_PATH ||
      resolveRepoPath('.private/applications.json')
  );
}

function usage() {
  console.error(
    [
      'Usage:',
      '  node scripts/application-ledger.mjs ready --package <slug> --application-url <url> --job-id <id> --ats <vendor> --prepared-at <ISO> --screening-questions reviewed|unavailable --form-hard-gates pass|blocked --parsed-fields pass|unavailable|incorrect --identity-parity pass|review-needed|blocked --identity-sha256 <sha> --narrative-answers not-applicable|passed|pending --attachment <filename> --uploaded-sha256 <sha> --ai-notice none-seen|seen|unknown --opt-out-path not-seen|available|not-offered --accommodation-path not-seen|available|not-offered --assessment <type> --platform-integrity clear|blocked --cover-letter used|not-used|not-applicable [--notice-url <url>] [--opt-out-url <url>] [--accommodation-url <url>] [--authored-copy-sha256 <sha>] [--semantic-pass-complete yes] [--related-role-acknowledged yes]',
      '  node scripts/application-ledger.mjs record --package <slug> --confirmation <reference> --applied-at <ISO> [--source <source>] [--ats <vendor>] [--job-id <id>]',
      '  node scripts/application-ledger.mjs event --id <application-id> --stage <stage> --at <ISO> --source <source> [--outcome-category <category>] [--person <name>] [--notes <text>]',
      '  node scripts/application-ledger.mjs assessment --id <application-id> --status invited|started|completed|result-received --assessment-type <type> --at <ISO> --source <source> [--competencies <comma-separated-bank-ids>] [--proof-ids <comma-separated-ids>] [--prep-copy-sha256 <sha>] [--semantic-pass-complete yes] [--notes <text>]',
      '  node scripts/application-ledger.mjs outreach --id <application-id> --status draft|sent|replied --channel <channel> --at <ISO> [--person <name>] [--notes <text>]',
      '  node scripts/application-ledger.mjs report',
    ].join('\n')
  );
}

function parseFlags(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${arg} requires a value`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function assertIso(value, label) {
  const isoPattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!value || !isoPattern.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be a valid ISO date/time`);
  }
}

function isIso(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isNullableString(value) {
  return value === undefined || value === null || typeof value === 'string';
}

function isBoolean(value) {
  return typeof value === 'boolean';
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function outreachThreadKey({ channel, person }) {
  return `${String(channel).trim().toLowerCase()}::${String(
    person || ''
  )
    .trim()
    .toLowerCase()}`;
}

function validateArtifactVerification(value, prefix, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  if (!isIso(value.verifiedAt)) {
    errors.push(`${prefix}.verifiedAt must be an ISO date/time`);
  }
  for (const field of ['configSha256', 'routeSha256', 'pdfSha256']) {
    if (!SHA256_PATTERN.test(value[field] || '')) {
      errors.push(`${prefix}.${field} must be a SHA-256 checksum`);
    }
  }
  for (const field of [
    'coverLetterPdfSha256',
    'coverLetterMarkdownSha256',
  ]) {
    if (
      value[field] !== undefined &&
      !SHA256_PATTERN.test(value[field] || '')
    ) {
      errors.push(`${prefix}.${field} must be a SHA-256 checksum when present`);
    }
  }
  if (
    !value.scopedProjectSha256 ||
    typeof value.scopedProjectSha256 !== 'object' ||
    Array.isArray(value.scopedProjectSha256)
  ) {
    errors.push(`${prefix}.scopedProjectSha256 must be an object`);
  } else {
    for (const [project, checksum] of Object.entries(
      value.scopedProjectSha256
    )) {
      if (
        !/^project-\d+\.html$/.test(project) ||
        !SHA256_PATTERN.test(checksum)
      ) {
        errors.push(
          `${prefix}.scopedProjectSha256 contains an invalid project checksum`
        );
      }
    }
  }
}

function readinessPredicateFailures(value) {
  const failures = [];
  if (value?.screeningQuestionsStatus !== 'reviewed') {
    failures.push('screening questions are not reviewed');
  }
  if (value?.formHardGateStatus !== 'pass') {
    failures.push('form hard gates are not clear');
  }
  if (value?.parsedFieldsStatus !== 'pass') {
    failures.push('parsed application fields are not approved');
  }
  if (value?.identityParityStatus !== 'pass') {
    failures.push('identity parity is unresolved');
  }
  if (
    !['not-applicable', 'passed'].includes(value?.narrativeAnswersStatus)
  ) {
    failures.push('narrative answers are incomplete');
  }
  if (
    value?.narrativeAnswersStatus === 'passed' &&
    (!SHA256_PATTERN.test(value?.authoredCopySha256 || '') ||
      value?.humanizerReview?.status !== 'passed' ||
      value?.humanizerReview?.semanticPassAttested !== true)
  ) {
    failures.push('narrative answers are not humanizer-approved');
  }
  if (
    value?.uploadedPdfSha256 !== value?.expectedPdfSha256 ||
    !SHA256_PATTERN.test(value?.expectedPdfSha256 || '')
  ) {
    failures.push('uploaded PDF does not match the verified artifact');
  }
  if (
    value?.duplicateStatus === 'related-role' &&
    value?.relatedRoleAcknowledged !== true
  ) {
    failures.push('related role is not acknowledged');
  }
  if (value?.platformIntegrityStatus !== 'clear') {
    failures.push('platform integrity status is not clear');
  }
  if (
    value?.coverLetterRequired === true &&
    value?.coverLetterStatus !== 'used'
  ) {
    failures.push('required cover letter is not included');
  }
  return failures;
}

function validateReadiness(value, prefix, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  for (const field of [
    'packageSlug',
    'company',
    'roleTitle',
    'jobId',
    'atsVendor',
    'attachedFilename',
  ]) {
    if (!isNonEmptyString(value[field])) {
      errors.push(`${prefix}.${field} is required`);
    }
  }
  if (!isGovernedContractRevision(value.contractRevision)) {
    errors.push(`${prefix}.contractRevision must be 5, 6, or 7`);
  }
  if (
    value.contractRevision >= 6 &&
    !isBoolean(value.coverLetterRequired)
  ) {
    errors.push(
      `${prefix}.coverLetterRequired must be boolean for revisions 6 and 7`
    );
  }
  if (!isValidUrl(value.applicationUrl)) {
    errors.push(`${prefix}.applicationUrl must be an HTTP or HTTPS URL`);
  }
  if (!isIso(value.preparedAt)) {
    errors.push(`${prefix}.preparedAt must be an ISO date/time`);
  }
  if (!['ready', 'blocked'].includes(value.status)) {
    errors.push(`${prefix}.status must be ready or blocked`);
  }
  if (
    !Array.isArray(value.blockers) ||
    !value.blockers.every(isNonEmptyString)
  ) {
    errors.push(`${prefix}.blockers must be a string array`);
  }
  if (
    value.status === 'ready' &&
    (!Array.isArray(value.blockers) || value.blockers.length)
  ) {
    errors.push(`${prefix}.blockers must be empty when status is ready`);
  }
  if (value.status === 'ready') {
    for (const failure of readinessPredicateFailures(value)) {
      errors.push(`${prefix} cannot be ready: ${failure}`);
    }
  }
  if (
    value.status === 'blocked' &&
    (!Array.isArray(value.blockers) || !value.blockers.length)
  ) {
    errors.push(`${prefix}.blockers must explain a blocked readiness record`);
  }
  for (const [field, allowed] of [
    ['screeningQuestionsStatus', SCREENING_QUESTION_STATUSES],
    ['formHardGateStatus', FORM_HARD_GATE_STATUSES],
    ['parsedFieldsStatus', PARSED_FIELD_STATUSES],
    ['identityParityStatus', IDENTITY_PARITY_STATUSES],
    ['narrativeAnswersStatus', NARRATIVE_ANSWER_STATUSES],
    ['aiProcessingNotice', AI_NOTICE_STATUSES],
    ['optOutPathStatus', APPLICANT_PATH_STATUSES],
    ['accommodationPathStatus', APPLICANT_PATH_STATUSES],
    ['assessmentType', ASSESSMENT_TYPES],
    ['platformIntegrityStatus', PLATFORM_INTEGRITY_STATUSES],
    ['coverLetterStatus', COVER_LETTER_STATUSES],
  ]) {
    if (!allowed.has(value[field])) {
      errors.push(`${prefix}.${field} is invalid`);
    }
  }
  for (const field of [
    'automatedProcessingNoticeUrl',
    'optOutUrl',
    'accommodationUrl',
  ]) {
    if (value[field] !== null && !isValidUrl(value[field])) {
      errors.push(`${prefix}.${field} must be an HTTP URL or null`);
    }
  }
  if (!['clear', 'related-role'].includes(value.duplicateStatus)) {
    errors.push(`${prefix}.duplicateStatus is invalid`);
  }
  if (!isBoolean(value.relatedRoleAcknowledged)) {
    errors.push(`${prefix}.relatedRoleAcknowledged must be boolean`);
  }
  if (
    value.duplicateStatus === 'related-role' &&
    value.relatedRoleAcknowledged !== true &&
    value.status === 'ready'
  ) {
    errors.push(
      `${prefix}.relatedRoleAcknowledged must be true for a ready related-role application`
    );
  }
  for (const field of ['expectedConfigSha256', 'expectedPdfSha256']) {
    if (!SHA256_PATTERN.test(value[field] || '')) {
      errors.push(`${prefix}.${field} must be a SHA-256 checksum`);
    }
  }
  for (const field of ['uploadedPdfSha256', 'identitySha256']) {
    if (!SHA256_PATTERN.test(value[field] || '')) {
      errors.push(`${prefix}.${field} must be a SHA-256 checksum`);
    }
  }
  if (
    value.status === 'ready' &&
    value.uploadedPdfSha256 !== value.expectedPdfSha256
  ) {
    errors.push(
      `${prefix}.uploadedPdfSha256 must match expectedPdfSha256 when status is ready`
    );
  }
  if (
    value.authoredCopySha256 !== null &&
    !SHA256_PATTERN.test(value.authoredCopySha256 || '')
  ) {
    errors.push(`${prefix}.authoredCopySha256 must be null or a SHA-256 checksum`);
  }
  if (
    value.narrativeAnswersStatus === 'passed' &&
    (!SHA256_PATTERN.test(value.authoredCopySha256 || '') ||
      value.humanizerReview?.semanticPassAttested !== true ||
      value.humanizerReview?.status !== 'passed')
  ) {
    errors.push(
      `${prefix} passed narrative answers require a hashed, attested humanizer review`
    );
  }
  if (
    !value.humanizerReview ||
    typeof value.humanizerReview !== 'object' ||
    !['not-applicable', 'pending', 'passed'].includes(
      value.humanizerReview.status
    ) ||
    !['surface-only', 'rewrite-requested'].includes(
      value.humanizerReview.mode
    ) ||
    !isBoolean(value.humanizerReview.semanticPassAttested)
  ) {
    errors.push(`${prefix}.humanizerReview is invalid`);
  }
  if (
    value.convertedApplicationId !== null &&
    !isNonEmptyString(value.convertedApplicationId)
  ) {
    errors.push(
      `${prefix}.convertedApplicationId must be a string or null`
    );
  }
}

export function validateLedger(ledger) {
  const errors = [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    return ['ledger must be an object'];
  }
  if (ledger.schemaVersion !== 1) {
    errors.push('schemaVersion must be 1');
  }
  const foundation = readResumeFoundation();
  const foundationProofIds = new Set(
    Object.values(foundation.roles).flatMap((role) =>
      role.map((bullet) => bullet.id)
    )
  );
  const assessmentCompetencyIds = new Set(
    (foundation.assessmentPrepBank || []).map(
      (competency) => competency.id
    )
  );
  if (!Array.isArray(ledger.applications)) {
    errors.push('applications must be an array');
    return errors;
  }
  if (ledger.readiness !== undefined && !Array.isArray(ledger.readiness)) {
    errors.push('readiness must be an array when present');
  }
  const readinessSlugs = new Set();
  const identityHashes = new Set();
  for (const [readinessIndex, readiness] of (
    ledger.readiness || []
  ).entries()) {
    const prefix = `readiness[${readinessIndex}]`;
    validateReadiness(readiness, prefix, errors);
    if (readinessSlugs.has(readiness?.packageSlug)) {
      errors.push(`${prefix}.packageSlug must be unique`);
    }
    readinessSlugs.add(readiness?.packageSlug);
    if (SHA256_PATTERN.test(readiness?.identitySha256 || '')) {
      identityHashes.add(readiness.identitySha256);
    }
  }

  const applicationIds = new Set();
  const packageSlugs = new Set();
  for (const [applicationIndex, application] of ledger.applications.entries()) {
    const prefix = `applications[${applicationIndex}]`;
    if (
      !application ||
      typeof application !== 'object' ||
      Array.isArray(application)
    ) {
      errors.push(`${prefix} must be an object`);
      continue;
    }
    for (const field of [
      'applicationId',
      'packageSlug',
      'company',
      'roleTitle',
      'source',
      'atsVendor',
      'targetLane',
      'evidenceMode',
      'fitClass',
      'appliedAt',
      'confirmation',
      'currentStage',
    ]) {
      if (!isNonEmptyString(application[field])) {
        errors.push(`${prefix}.${field} is required`);
      }
    }
    if (applicationIds.has(application.applicationId)) {
      errors.push(`${prefix}.applicationId must be unique`);
    }
    if (packageSlugs.has(application.packageSlug)) {
      errors.push(`${prefix}.packageSlug must be unique`);
    }
    applicationIds.add(application.applicationId);
    packageSlugs.add(application.packageSlug);

    if (
      application.contractRevision !== undefined &&
      !isGovernedContractRevision(application.contractRevision)
    ) {
      errors.push(
        `${prefix}.contractRevision must be 5, 6, or 7 when present`
      );
    }
    const isGovernedRevision = isGovernedContractRevision(
      application.contractRevision
    );
    if (isGovernedRevision) {
      for (const field of [
        'positioningLane',
        'bridgeType',
        'applicationStrategy',
        'coverLetterStatus',
        'requirementCoverage',
        'readiness',
      ]) {
        if (application[field] === undefined) {
          errors.push(
            `${prefix}.${field} is required for revisions 5, 6, and 7`
          );
        }
      }
      if (!isNonEmptyString(application.jobId)) {
        errors.push(`${prefix}.jobId is required for revisions 5, 6, and 7`);
      }
    }
    if (!isNullableString(application.jobId)) {
      errors.push(`${prefix}.jobId must be a string or null`);
    }
    for (const field of [
      'positioningLane',
      'bridgeType',
      'applicationStrategy',
    ]) {
      if (
        application[field] !== undefined &&
        !isNonEmptyString(application[field])
      ) {
        errors.push(`${prefix}.${field} must be a non-empty string when present`);
      }
    }
    if (
      application.coverLetterStatus !== undefined &&
      !COVER_LETTER_STATUSES.has(application.coverLetterStatus)
    ) {
      errors.push(`${prefix}.coverLetterStatus is invalid`);
    }
    if (application.requirementCoverage !== undefined) {
      const coverage = application.requirementCoverage;
      if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) {
        errors.push(`${prefix}.requirementCoverage must be an object`);
      } else {
        for (const field of [
          'direct',
          'adjacent',
          'notSupported',
          'exact',
          'recognizedEquivalent',
          'contextual',
        ]) {
          if (!Number.isInteger(coverage[field]) || coverage[field] < 0) {
            errors.push(
              `${prefix}.requirementCoverage.${field} must be a non-negative integer`
            );
          }
        }
      }
    }
    if (application.readiness !== undefined) {
      validateReadiness(application.readiness, `${prefix}.readiness`, errors);
      if (
        SHA256_PATTERN.test(application.readiness?.identitySha256 || '')
      ) {
        identityHashes.add(application.readiness.identitySha256);
      }
      if (
        application.readiness?.status !== 'ready' ||
        application.readiness?.packageSlug !== application.packageSlug
      ) {
        errors.push(`${prefix}.readiness must be the matching ready snapshot`);
      }
      if (
        application.readiness?.jobId !== application.jobId ||
        application.readiness?.company !== application.company ||
        application.readiness?.roleTitle !== application.roleTitle ||
        application.readiness?.atsVendor !== application.atsVendor ||
        (isGovernedRevision &&
          application.readiness?.contractRevision !==
            application.contractRevision) ||
        application.readiness?.expectedConfigSha256 !==
          application.artifactVerification?.configSha256 ||
        application.readiness?.expectedPdfSha256 !==
          application.artifactVerification?.pdfSha256
      ) {
        errors.push(
          `${prefix}.readiness must match the recorded requisition and artifact checksums`
        );
      }
    }
    if (isGovernedRevision) {
      const topLevelReadiness = (ledger.readiness || []).find(
        (readiness) => readiness.packageSlug === application.packageSlug
      );
      if (!topLevelReadiness) {
        errors.push(
          `${prefix} must retain its top-level readiness conversion record`
        );
      } else if (
        topLevelReadiness.convertedApplicationId !== application.applicationId
      ) {
        errors.push(
          `${prefix} top-level readiness must link back to this application`
        );
      }
    }
    if (!EVIDENCE_MODES.has(application.evidenceMode)) {
      errors.push(`${prefix}.evidenceMode is invalid`);
    }
    if (!FIT_CLASSES.has(application.fitClass)) {
      errors.push(`${prefix}.fitClass is invalid`);
    }
    if (!STAGES.has(application.currentStage)) {
      errors.push(`${prefix}.currentStage is invalid`);
    }
    if (!isIso(application.appliedAt)) {
      errors.push(`${prefix}.appliedAt must be an ISO date/time`);
    }
    validateArtifactVerification(
      application.artifactVerification,
      `${prefix}.artifactVerification`,
      errors
    );

    if (!Array.isArray(application.events) || !application.events.length) {
      errors.push(`${prefix}.events must be a non-empty array`);
    } else {
      let priorAt = application.appliedAt;
      let priorStage = 'applied';
      let terminal = false;
      for (const [eventIndex, event] of application.events.entries()) {
        const eventPrefix = `${prefix}.events[${eventIndex}]`;
        if (!event || typeof event !== 'object' || Array.isArray(event)) {
          errors.push(`${eventPrefix} must be an object`);
          continue;
        }
        if (!['stage', 'assessment'].includes(event.type)) {
          errors.push(`${eventPrefix}.type must be stage or assessment`);
        }
        if (event.type === 'stage' && !STAGES.has(event.stage)) {
          errors.push(`${eventPrefix}.stage is invalid`);
        }
        if (
          event.type === 'stage' &&
          event.outcomeCategory !== undefined &&
          event.outcomeCategory !== null &&
          !OUTCOME_CATEGORIES.has(event.outcomeCategory)
        ) {
          errors.push(`${eventPrefix}.outcomeCategory is invalid`);
        }
        if (
          event.type === 'stage' &&
          event.stage === 'rejected' &&
          application.readiness &&
          !OUTCOME_CATEGORIES.has(event.outcomeCategory)
        ) {
          errors.push(
            `${eventPrefix}.outcomeCategory is required for a governed revision rejection`
          );
        }
        if (event.type === 'assessment') {
          if (!ASSESSMENT_STATUSES.has(event.assessmentStatus)) {
            errors.push(`${eventPrefix}.assessmentStatus is invalid`);
          }
          if (
            !ASSESSMENT_TYPES.has(event.assessmentType) ||
            event.assessmentType === 'none'
          ) {
            errors.push(`${eventPrefix}.assessmentType is invalid`);
          }
          if (
            !Array.isArray(event.proofIds) ||
            !event.proofIds.every(isNonEmptyString)
          ) {
            errors.push(`${eventPrefix}.proofIds must be a string array`);
          } else if (
            new Set(event.proofIds).size !== event.proofIds.length
          ) {
            errors.push(`${eventPrefix}.proofIds must be unique`);
          } else if (
            event.proofIds.some(
              (proofId) => !foundationProofIds.has(proofId)
            )
          ) {
            errors.push(
              `${eventPrefix}.proofIds contains an unknown foundation proof ID`
            );
          }
          if (
            !Array.isArray(event.competencies) ||
            !event.competencies.every(isNonEmptyString)
          ) {
            errors.push(`${eventPrefix}.competencies must be a string array`);
          } else if (
            new Set(event.competencies).size !== event.competencies.length
          ) {
            errors.push(`${eventPrefix}.competencies must be unique`);
          } else if (
            event.competencies.some(
              (competency) => !assessmentCompetencyIds.has(competency)
            )
          ) {
            errors.push(
              `${eventPrefix}.competencies contains an unknown assessment bank ID`
            );
          }
          if (
            event.prepCopySha256 !== null &&
            !SHA256_PATTERN.test(event.prepCopySha256 || '')
          ) {
            errors.push(
              `${eventPrefix}.prepCopySha256 must be null or a SHA-256 checksum`
            );
          }
          if (!isBoolean(event.semanticPassAttested)) {
            errors.push(
              `${eventPrefix}.semanticPassAttested must be boolean`
            );
          }
          if (
            event.assessmentType === 'structured-video' &&
            event.assessmentStatus === 'started' &&
            (event.competencies?.length < 1 ||
              event.proofIds?.length < 2 ||
              !SHA256_PATTERN.test(event.prepCopySha256 || '') ||
              event.semanticPassAttested !== true)
          ) {
            errors.push(
              `${eventPrefix} structured-video preparation requires a competency, proof IDs, and a humanizer-reviewed prep hash`
            );
          }
        }
        if (!isIso(event.at)) {
          errors.push(`${eventPrefix}.at must be an ISO date/time`);
        } else {
          if (
            isIso(application.appliedAt) &&
            Date.parse(event.at) < Date.parse(application.appliedAt)
          ) {
            errors.push(`${eventPrefix}.at cannot precede appliedAt`);
          }
          if (isIso(priorAt) && Date.parse(event.at) < Date.parse(priorAt)) {
            errors.push(`${eventPrefix}.at must be chronological`);
          }
          priorAt = event.at;
        }
        if (!isNonEmptyString(event.source)) {
          errors.push(`${eventPrefix}.source is required`);
        }
        if (!isNullableString(event.person) || !isNullableString(event.notes)) {
          errors.push(`${eventPrefix} person and notes must be strings or null`);
        }
        if (terminal) {
          errors.push(`${eventPrefix} cannot follow a terminal stage`);
        } else if (
          event.type === 'stage' &&
          STAGES.has(event.stage) &&
          !['rejected', 'withdrawn'].includes(event.stage) &&
          STAGE_RANK[event.stage] < STAGE_RANK[priorStage]
        ) {
          errors.push(`${eventPrefix}.stage regresses from ${priorStage}`);
        }
        if (event.type === 'stage' && STAGES.has(event.stage)) {
          priorStage = event.stage;
          terminal = TERMINAL_STAGES.has(event.stage);
        }
      }
      if (
        application.events[0]?.type !== 'stage' ||
        application.events[0]?.stage !== 'applied'
      ) {
        errors.push(`${prefix}.events must begin with applied`);
      }
      const latestStageEvent = application.events
        .filter((event) => event.type === 'stage')
        .at(-1);
      if (latestStageEvent?.stage !== application.currentStage) {
        errors.push(`${prefix}.currentStage must match the latest event`);
      }

      const assessmentStates = new Map();
      for (const [eventIndex, event] of application.events.entries()) {
        if (event.type !== 'assessment') {
          continue;
        }
        const priorStatus = assessmentStates.get(event.assessmentType);
        if (
          priorStatus &&
          ASSESSMENT_STATUS_RANK[event.assessmentStatus] <
            ASSESSMENT_STATUS_RANK[priorStatus]
        ) {
          errors.push(
            `${prefix}.events[${eventIndex}].assessmentStatus regresses from ${priorStatus}`
          );
        }
        assessmentStates.set(event.assessmentType, event.assessmentStatus);
      }
    }

    if (!Array.isArray(application.outreach)) {
      errors.push(`${prefix}.outreach must be an array`);
    } else {
      let priorOutreachAt = application.appliedAt;
      const threadStates = new Map();
      for (const [outreachIndex, outreach] of application.outreach.entries()) {
        const outreachPrefix = `${prefix}.outreach[${outreachIndex}]`;
        if (
          !outreach ||
          typeof outreach !== 'object' ||
          Array.isArray(outreach)
        ) {
          errors.push(`${outreachPrefix} must be an object`);
          continue;
        }
        if (!OUTREACH_STATUSES.has(outreach.status)) {
          errors.push(`${outreachPrefix}.status is invalid`);
        }
        if (!isNonEmptyString(outreach.channel)) {
          errors.push(`${outreachPrefix}.channel is required`);
        }
        if (
          !isNullableString(outreach.person) ||
          !isNullableString(outreach.notes)
        ) {
          errors.push(
            `${outreachPrefix} person and notes must be strings or null`
          );
        }
        if (!isIso(outreach.at)) {
          errors.push(`${outreachPrefix}.at must be an ISO date/time`);
        } else {
          if (
            isIso(application.appliedAt) &&
            Date.parse(outreach.at) < Date.parse(application.appliedAt)
          ) {
            errors.push(`${outreachPrefix}.at cannot precede appliedAt`);
          }
          if (
            isIso(priorOutreachAt) &&
            Date.parse(outreach.at) < Date.parse(priorOutreachAt)
          ) {
            errors.push(`${outreachPrefix}.at must be chronological`);
          }
          priorOutreachAt = outreach.at;
        }
        const expectedThreadKey = outreachThreadKey(outreach);
        if (outreach.threadKey !== expectedThreadKey) {
          errors.push(`${outreachPrefix}.threadKey is incorrect`);
        }
        const priorStatus = threadStates.get(expectedThreadKey);
        if (
          priorStatus &&
          OUTREACH_STATUSES.has(outreach.status) &&
          OUTREACH_RANK[outreach.status] < OUTREACH_RANK[priorStatus]
        ) {
          errors.push(
            `${outreachPrefix}.status regresses within its outreach thread`
          );
        }
        if (OUTREACH_STATUSES.has(outreach.status)) {
          threadStates.set(expectedThreadKey, outreach.status);
        }
      }
    }
  }
  for (const [readinessIndex, readiness] of (
    ledger.readiness || []
  ).entries()) {
    if (
      readiness.convertedApplicationId &&
      !applicationIds.has(readiness.convertedApplicationId)
    ) {
      errors.push(
        `readiness[${readinessIndex}].convertedApplicationId does not reference an application`
      );
    } else if (readiness.convertedApplicationId) {
      const convertedApplication = ledger.applications.find(
        (application) =>
          application.applicationId === readiness.convertedApplicationId
      );
      if (convertedApplication?.packageSlug !== readiness.packageSlug) {
        errors.push(
          `readiness[${readinessIndex}] converted application must use the same package slug`
        );
      }
      if (!convertedApplication?.readiness) {
        errors.push(
          `readiness[${readinessIndex}] converted application must retain the readiness snapshot`
        );
      } else {
        const topLevelSnapshot = {
          ...readiness,
          convertedApplicationId: null,
        };
        const embeddedSnapshot = {
          ...convertedApplication.readiness,
          convertedApplicationId: null,
        };
        if (
          JSON.stringify(topLevelSnapshot) !==
          JSON.stringify(embeddedSnapshot)
        ) {
          errors.push(
            `readiness[${readinessIndex}] does not match the converted application's snapshot`
          );
        }
      }
    }
  }
  if (identityHashes.size > 1) {
    errors.push(
      'readiness identity fingerprints must remain stable across applications'
    );
  }
  return errors;
}

function assertValidLedger(ledger) {
  const errors = validateLedger(ledger);
  if (errors.length) {
    throw new Error(
      `Private application ledger is invalid:\n- ${errors.join('\n- ')}`
    );
  }
}

function readLedger() {
  const filePath = ledgerPath();
  if (!existsSync(filePath)) {
    return { schemaVersion: 1, readiness: [], applications: [] };
  }
  const ledger = JSON.parse(readFileSync(filePath, 'utf8'));
  assertValidLedger(ledger);
  return ledger;
}

export function writeLedgerAtomic(
  ledger,
  { rename = renameSync } = {}
) {
  assertValidLedger(ledger);
  const filePath = ledgerPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(ledger, null, 2)}\n`, {
      mode: 0o600,
    });
    rename(temporaryPath, filePath);
  } finally {
    if (existsSync(temporaryPath)) {
      unlinkSync(temporaryPath);
    }
  }
}

function withLedgerLock(update) {
  const filePath = ledgerPath();
  const lockPath = `${filePath}.lock`;
  mkdirSync(path.dirname(filePath), { recursive: true });
  let lockDescriptor;
  try {
    lockDescriptor = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error('Application ledger is locked by another process');
    }
    throw error;
  }

  try {
    const ledger = readLedger();
    const result = update(ledger);
    writeLedgerAtomic(ledger);
    return result;
  } finally {
    closeSync(lockDescriptor);
    unlinkSync(lockPath);
  }
}

function applicationId(slug, appliedAt) {
  const timestamp = new Date(appliedAt)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
  return `${slug}-${timestamp}`;
}

function requireFields(options, fields) {
  for (const field of fields) {
    if (!options[field]?.trim()) {
      throw new Error(`--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
    }
  }
}

function assertNotBefore(value, earliest, label) {
  if (Date.parse(value) < Date.parse(earliest)) {
    throw new Error(`${label} cannot be earlier than ${earliest}`);
  }
}

function latestTimestamp(items, fallback) {
  return items.length ? items.at(-1).at : fallback;
}

async function verifiedPackageContext(packageSlug, publicBase) {
  const pkg = findManifestPackage(packageSlug);
  if (!pkg) {
    throw new Error(`No package found for ${packageSlug}`);
  }
  if ((pkg.workflowVersion || 1) !== WORKFLOW_VERSION) {
    throw new Error('Only v2 packages can use the application ledger');
  }
  if (pkg.publishStatus !== 'live-verified') {
    throw new Error('Package must be live-verified before application readiness');
  }
  const packageCheck = checkPackages({
    slug: pkg.slug,
    publicBase,
  });
  if (packageCheck.failures.length) {
    throw new Error(
      `Package verification is stale or invalid:\n${packageCheck.failures.join(
        '\n'
      )}`
    );
  }
  const config = readJson(pkg.configPath);
  await fetchPublishedArtifacts(pkg, config, { publicBase });
  return { pkg, config };
}

function optionValue(options, field, allowed, flag) {
  const value = options[field];
  if (!allowed.has(value)) {
    throw new Error(`${flag} must be one of ${[...allowed].join(', ')}`);
  }
  return value;
}

export function applicationDuplicateStatus(
  ledger,
  { company, jobId, packageSlug = null }
) {
  const normalizedCompany = company.trim().toLowerCase();
  const normalizedJobId = String(jobId || '').trim().toLowerCase();
  const exactApplication = ledger.applications.find(
    (application) =>
      application.company.trim().toLowerCase() === normalizedCompany &&
      application.jobId &&
      application.jobId.trim().toLowerCase() === normalizedJobId
  );
  const exactReadiness = (ledger.readiness || []).find(
    (readiness) =>
      readiness.packageSlug !== packageSlug &&
      readiness.status === 'ready' &&
      !readiness.convertedApplicationId &&
      readiness.company.trim().toLowerCase() === normalizedCompany &&
      readiness.jobId.trim().toLowerCase() === normalizedJobId
  );
  const exact = exactApplication || exactReadiness;
  const relatedActive = ledger.applications.filter(
    (application) =>
      application.company.trim().toLowerCase() === normalizedCompany &&
      !TERMINAL_STAGES.has(application.currentStage) &&
      String(application.jobId || '').trim().toLowerCase() !== normalizedJobId
  );
  return {
    exact,
    exactApplication,
    exactReadiness,
    relatedActive,
    status: exact
      ? 'exact'
      : relatedActive.length
        ? 'related-role'
        : 'clear',
  };
}

export async function prepareApplication(
  options,
  { publicBase = PUBLIC_BASE } = {}
) {
  requireFields(options, [
    'package',
    'applicationUrl',
    'jobId',
    'ats',
    'preparedAt',
    'screeningQuestions',
    'formHardGates',
    'parsedFields',
    'identityParity',
    'identitySha256',
    'narrativeAnswers',
    'attachment',
    'uploadedSha256',
    'aiNotice',
    'optOutPath',
    'accommodationPath',
    'assessment',
    'platformIntegrity',
    'coverLetter',
  ]);
  assertIso(options.preparedAt, '--prepared-at');
  if (!isValidUrl(options.applicationUrl)) {
    throw new Error('--application-url must be an HTTP or HTTPS URL');
  }
  const screeningQuestionsStatus = optionValue(
    options,
    'screeningQuestions',
    SCREENING_QUESTION_STATUSES,
    '--screening-questions'
  );
  const formHardGateStatus = optionValue(
    options,
    'formHardGates',
    FORM_HARD_GATE_STATUSES,
    '--form-hard-gates'
  );
  const parsedFieldsStatus = optionValue(
    options,
    'parsedFields',
    PARSED_FIELD_STATUSES,
    '--parsed-fields'
  );
  const identityParityStatus = optionValue(
    options,
    'identityParity',
    IDENTITY_PARITY_STATUSES,
    '--identity-parity'
  );
  const narrativeAnswersStatus = optionValue(
    options,
    'narrativeAnswers',
    NARRATIVE_ANSWER_STATUSES,
    '--narrative-answers'
  );
  const aiProcessingNotice = optionValue(
    options,
    'aiNotice',
    AI_NOTICE_STATUSES,
    '--ai-notice'
  );
  const optOutPathStatus = optionValue(
    options,
    'optOutPath',
    APPLICANT_PATH_STATUSES,
    '--opt-out-path'
  );
  const accommodationPathStatus = optionValue(
    options,
    'accommodationPath',
    APPLICANT_PATH_STATUSES,
    '--accommodation-path'
  );
  const assessmentType = optionValue(
    options,
    'assessment',
    ASSESSMENT_TYPES,
    '--assessment'
  );
  const platformIntegrityStatus = optionValue(
    options,
    'platformIntegrity',
    PLATFORM_INTEGRITY_STATUSES,
    '--platform-integrity'
  );
  const coverLetterStatus = optionValue(
    options,
    'coverLetter',
    COVER_LETTER_STATUSES,
    '--cover-letter'
  );
  for (const [value, flag] of [
    [options.authoredCopySha256, '--authored-copy-sha256'],
    [options.identitySha256, '--identity-sha256'],
    [options.uploadedSha256, '--uploaded-sha256'],
  ]) {
    if (value && !SHA256_PATTERN.test(value)) {
      throw new Error(`${flag} must be a SHA-256 checksum`);
    }
  }
  for (const [value, flag] of [
    [options.noticeUrl, '--notice-url'],
    [options.optOutUrl, '--opt-out-url'],
    [options.accommodationUrl, '--accommodation-url'],
  ]) {
    if (value && !isValidUrl(value)) {
      throw new Error(`${flag} must be an HTTP or HTTPS URL`);
    }
  }

  const { pkg, config } = await verifiedPackageContext(
    options.package,
    publicBase
  );
  if (!isGovernedContractRevision(config.contractRevision)) {
    throw new Error(
      'Submission readiness is required only for governed revision 5, 6, or 7 packages; legacy packages retain their historical application flow'
    );
  }
  if (!pkg.verification) {
    throw new Error('Package is missing verification metadata');
  }

  return withLedgerLock((ledger) => {
    ledger.readiness ||= [];
    const duplicate = applicationDuplicateStatus(ledger, {
      company: config.job.company,
      jobId: options.jobId,
      packageSlug: pkg.slug,
    });
    if (duplicate.exact) {
      throw new Error(
        `An application already exists for ${config.job.company} requisition ${options.jobId}`
      );
    }
    const existingReadiness = ledger.readiness.find(
      (candidate) => candidate.packageSlug === pkg.slug
    );
    if (existingReadiness?.convertedApplicationId) {
      throw new Error(
        `Readiness for ${pkg.slug} has already been converted into application ${existingReadiness.convertedApplicationId}`
      );
    }
    const relatedRole = duplicate.status === 'related-role';
    const relatedRoleAcknowledged =
      options.relatedRoleAcknowledged === 'yes';
    const expectedFilename = path.basename(pkg.resumePdfPath);
    const blockers = [];
    if (screeningQuestionsStatus !== 'reviewed') {
      blockers.push('Live screening questions have not been reviewed');
    }
    if (formHardGateStatus !== 'pass') {
      blockers.push('The live application form revealed a blocking hard gate');
    }
    if (parsedFieldsStatus !== 'pass') {
      blockers.push('ATS-parsed application fields have not been reviewed');
    }
    if (identityParityStatus !== 'pass') {
      blockers.push('Resume, application, and LinkedIn identity parity is unresolved');
    }
    const priorIdentityHash = [
      ...(ledger.readiness || []),
      ...ledger.applications
        .map((application) => application.readiness)
        .filter(Boolean),
    ].find(
      (candidate) =>
        candidate.packageSlug !== pkg.slug && candidate.identitySha256
    )?.identitySha256;
    if (
      priorIdentityHash &&
      priorIdentityHash !== options.identitySha256
    ) {
      blockers.push(
        'The identity fingerprint differs from earlier applications'
      );
    }
    if (narrativeAnswersStatus === 'pending') {
      blockers.push('Narrative application answers are still pending');
    }
    if (
      narrativeAnswersStatus === 'passed' &&
      (!options.authoredCopySha256 ||
        options.semanticPassComplete !== 'yes')
    ) {
      blockers.push(
        'Narrative answers require a humanizer-reviewed copy hash and semantic-pass attestation'
      );
    }
    if (options.attachment !== expectedFilename) {
      blockers.push(
        `Attached filename must be ${expectedFilename}`
      );
    }
    if (options.uploadedSha256 !== pkg.verification.pdfSha256) {
      blockers.push(
        'The uploaded resume checksum does not match the live-verified artifact'
      );
    }
    if (platformIntegrityStatus !== 'clear') {
      blockers.push('A platform speed, automation, or integrity warning is active');
    }
    if (
      bridgeRequiresCoverLetter(config) &&
      coverLetterStatus !== 'used'
    ) {
      blockers.push(
        'This package requires the generated cover letter to be included with the application'
      );
    }
    if (relatedRole && !relatedRoleAcknowledged) {
      blockers.push(
        'Another active application exists at this company; acknowledge the related role before submission'
      );
    }

    const readiness = {
      packageSlug: pkg.slug,
      contractRevision: config.contractRevision,
      company: config.job.company,
      roleTitle: config.job.roleTitle,
      jobId: options.jobId.trim(),
      applicationUrl: options.applicationUrl,
      atsVendor: options.ats,
      preparedAt: new Date(options.preparedAt).toISOString(),
      status: blockers.length ? 'blocked' : 'ready',
      blockers,
      screeningQuestionsStatus,
      formHardGateStatus,
      parsedFieldsStatus,
      identityParityStatus,
      narrativeAnswersStatus,
      authoredCopySha256: options.authoredCopySha256 || null,
      humanizerReview: {
        status:
          narrativeAnswersStatus === 'passed'
            ? 'passed'
            : narrativeAnswersStatus === 'pending'
              ? 'pending'
              : 'not-applicable',
        mode:
          options.rewriteRequested === 'yes'
            ? 'rewrite-requested'
            : 'surface-only',
        semanticPassAttested: options.semanticPassComplete === 'yes',
      },
      attachedFilename: options.attachment,
      uploadedPdfSha256: options.uploadedSha256,
      identitySha256: options.identitySha256,
      expectedConfigSha256: pkg.verification.configSha256,
      expectedPdfSha256: pkg.verification.pdfSha256,
      duplicateStatus: relatedRole ? 'related-role' : 'clear',
      relatedRoleAcknowledged,
      aiProcessingNotice,
      automatedProcessingNoticeUrl: options.noticeUrl || null,
      optOutPathStatus,
      optOutUrl: options.optOutUrl || null,
      accommodationPathStatus,
      accommodationUrl: options.accommodationUrl || null,
      assessmentType,
      platformIntegrityStatus,
      coverLetterRequired: bridgeRequiresCoverLetter(config),
      coverLetterStatus,
      convertedApplicationId: null,
    };
    const readinessIndex = ledger.readiness.findIndex(
      (candidate) => candidate.packageSlug === pkg.slug
    );
    if (readinessIndex >= 0) {
      ledger.readiness[readinessIndex] = readiness;
    } else {
      ledger.readiness.push(readiness);
    }
    return readiness;
  });
}

export async function recordApplication(
  options,
  { publicBase = PUBLIC_BASE } = {}
) {
  requireFields(options, ['package', 'confirmation', 'appliedAt']);
  assertIso(options.appliedAt, '--applied-at');
  const { pkg, config } = await verifiedPackageContext(
    options.package,
    publicBase
  );
  return withLedgerLock((ledger) => {
    if (
      ledger.applications.some(
        (application) => application.packageSlug === pkg.slug
      )
    ) {
      throw new Error(`An application already exists for ${pkg.slug}`);
    }
    const readiness = (ledger.readiness || []).find(
      (candidate) => candidate.packageSlug === pkg.slug
    );
    if (isGovernedContractRevision(config.contractRevision)) {
      if (!readiness || readiness.status !== 'ready') {
        throw new Error(
          'Revision 5 and 6 applications require a passing readiness snapshot before submission can be recorded'
        );
      }
      const readinessFailures = readinessPredicateFailures(readiness);
      if (readinessFailures.length) {
        throw new Error(
          `Application readiness no longer passes:\n- ${readinessFailures.join(
            '\n- '
          )}`
        );
      }
      if (readiness.attachedFilename !== path.basename(pkg.resumePdfPath)) {
        throw new Error(
          'Application readiness references the wrong resume attachment'
        );
      }
      const duplicate = applicationDuplicateStatus(ledger, {
        company: config.job.company,
        jobId: readiness.jobId,
        packageSlug: pkg.slug,
      });
      if (duplicate.exact) {
        throw new Error(
          `An application or ready submission already exists for ${config.job.company} requisition ${readiness.jobId}`
        );
      }
      if (
        readiness.expectedConfigSha256 !== pkg.verification.configSha256 ||
        readiness.expectedPdfSha256 !== pkg.verification.pdfSha256
      ) {
        throw new Error(
          'Application readiness is stale because the verified package checksum changed'
        );
      }
      if (
        String(options.jobId || readiness.jobId).trim().toLowerCase() !==
        readiness.jobId.trim().toLowerCase()
      ) {
        throw new Error('Application job ID does not match readiness');
      }
      if (
        options.ats &&
        options.ats.trim().toLowerCase() !==
          readiness.atsVendor.trim().toLowerCase()
      ) {
        throw new Error('Application ATS vendor does not match readiness');
      }
      assertNotBefore(
        options.appliedAt,
        readiness.preparedAt,
        '--applied-at'
      );
    }

    const id = applicationId(pkg.slug, options.appliedAt);
    const requirementCoverage = (config.requirements || []).reduce(
      (coverage, requirement) => {
        if (requirement.evidenceStatus === 'direct') {
          coverage.direct += 1;
        } else if (requirement.evidenceStatus === 'adjacent') {
          coverage.adjacent += 1;
        } else if (requirement.evidenceStatus === 'none') {
          coverage.notSupported += 1;
        }
        if (requirement.matchMode === 'exact') {
          coverage.exact += 1;
        } else if (requirement.matchMode === 'recognized-equivalent') {
          coverage.recognizedEquivalent += 1;
        } else if (requirement.matchMode === 'contextual') {
          coverage.contextual += 1;
        }
        return coverage;
      },
      {
        direct: 0,
        adjacent: 0,
        notSupported: 0,
        exact: 0,
        recognizedEquivalent: 0,
        contextual: 0,
      }
    );
    const record = {
      applicationId: id,
      ...(isGovernedContractRevision(config.contractRevision)
        ? { contractRevision: config.contractRevision }
        : {}),
      packageSlug: pkg.slug,
      company: config.job.company,
      roleTitle: config.job.roleTitle,
      jobId:
        options.jobId?.trim() ||
        (isGovernedContractRevision(config.contractRevision)
          ? readiness.jobId
          : config.job.jobId) ||
        null,
      source: options.source || config.job.sourceChannel,
      atsVendor:
        isGovernedContractRevision(config.contractRevision)
          ? readiness.atsVendor
          : options.ats || config.job.atsVendor || 'unknown',
      targetLane: config.classification.targetLane,
      evidenceMode: config.classification.evidenceMode,
      fitClass: config.fitClass,
      ...(isGovernedContractRevision(config.contractRevision)
        ? {
            positioningLane: config.positioning.laneId,
            bridgeType: config.positioning.bridgeType,
            applicationStrategy: config.positioning.applicationStrategy,
            coverLetterStatus: readiness.coverLetterStatus,
            requirementCoverage,
            readiness: structuredClone(readiness),
          }
        : {}),
      artifactVerification: {
        verifiedAt: pkg.verification.verifiedAt,
        configSha256: pkg.verification.configSha256,
        routeSha256: pkg.verification.routeSha256,
        pdfSha256: pkg.verification.pdfSha256,
        ...(pkg.verification.coverLetterPdfSha256
          ? {
              coverLetterPdfSha256:
                pkg.verification.coverLetterPdfSha256,
              coverLetterMarkdownSha256:
                pkg.verification.coverLetterMarkdownSha256,
            }
          : {}),
        scopedProjectSha256: pkg.verification.scopedProjectSha256,
      },
      appliedAt: new Date(options.appliedAt).toISOString(),
      confirmation: options.confirmation,
      currentStage: 'applied',
      events: [
        {
          type: 'stage',
          stage: 'applied',
          at: new Date(options.appliedAt).toISOString(),
          source: 'application',
          notes: 'Submission confirmation recorded.',
        },
      ],
      outreach: [],
    };
    ledger.applications.push(record);
    if (readiness) {
      readiness.convertedApplicationId = id;
    }
    return record;
  });
}

function findApplication(ledger, id) {
  const application = ledger.applications.find(
    (candidate) => candidate.applicationId === id
  );
  if (!application) {
    throw new Error(`No application found for ${id}`);
  }
  return application;
}

export function recordEvent(options) {
  requireFields(options, ['id', 'stage', 'at', 'source']);
  assertIso(options.at, '--at');
  if (!STAGES.has(options.stage)) {
    throw new Error(`--stage must be one of ${[...STAGES].join(', ')}`);
  }
  if (
    options.outcomeCategory &&
    !OUTCOME_CATEGORIES.has(options.outcomeCategory)
  ) {
    throw new Error(
      `--outcome-category must be one of ${[
        ...OUTCOME_CATEGORIES,
      ].join(', ')}`
    );
  }
  return withLedgerLock((ledger) => {
    const application = findApplication(ledger, options.id);
    if (TERMINAL_STAGES.has(application.currentStage)) {
      throw new Error(
        `Cannot move an application out of terminal stage ${application.currentStage}`
      );
    }
    assertNotBefore(options.at, application.appliedAt, '--at');
    assertNotBefore(
      options.at,
      latestTimestamp(application.events, application.appliedAt),
      '--at'
    );
    if (
      !['rejected', 'withdrawn'].includes(options.stage) &&
      STAGE_RANK[options.stage] < STAGE_RANK[application.currentStage]
    ) {
      throw new Error(
        `Stage cannot regress from ${application.currentStage} to ${options.stage}`
      );
    }
    if (
      options.stage === 'rejected' &&
      application.readiness &&
      !options.outcomeCategory
    ) {
      throw new Error(
        'Governed revision rejections require --outcome-category so form, application review, recruiter, assessment, and interview outcomes remain distinct'
      );
    }
    const event = {
      type: 'stage',
      stage: options.stage,
      at: new Date(options.at).toISOString(),
      source: options.source,
      outcomeCategory: options.outcomeCategory || null,
      person: options.person || null,
      notes: options.notes || null,
    };
    application.events.push(event);
    application.currentStage = options.stage;
    return event;
  });
}

export function recordAssessment(options) {
  requireFields(options, [
    'id',
    'status',
    'assessmentType',
    'at',
    'source',
  ]);
  assertIso(options.at, '--at');
  if (!ASSESSMENT_STATUSES.has(options.status)) {
    throw new Error(
      `--status must be one of ${[...ASSESSMENT_STATUSES].join(', ')}`
    );
  }
  if (
    !ASSESSMENT_TYPES.has(options.assessmentType) ||
    options.assessmentType === 'none'
  ) {
    throw new Error(
      `--assessment-type must be one of ${[...ASSESSMENT_TYPES]
        .filter((type) => type !== 'none')
        .join(', ')}`
    );
  }
  if (
    options.prepCopySha256 &&
    !SHA256_PATTERN.test(options.prepCopySha256)
  ) {
    throw new Error('--prep-copy-sha256 must be a SHA-256 checksum');
  }

  const proofIds = (options.proofIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const competencies = (options.competencies || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (new Set(proofIds).size !== proofIds.length) {
    throw new Error('--proof-ids must contain distinct foundation proof IDs');
  }
  if (new Set(competencies).size !== competencies.length) {
    throw new Error('--competencies must contain distinct assessment bank IDs');
  }
  const foundation = readResumeFoundation();
  const foundationProofIds = new Set(
    Object.values(foundation.roles).flatMap((role) =>
      role.map((bullet) => bullet.id)
    )
  );
  const foundationCompetencies = new Set(
    (foundation.assessmentPrepBank || []).map(
      (competency) => competency.id
    )
  );
  const unknownProofIds = proofIds.filter(
    (proofId) => !foundationProofIds.has(proofId)
  );
  if (unknownProofIds.length) {
    throw new Error(
      `Unknown foundation proof IDs: ${unknownProofIds.join(', ')}`
    );
  }
  const unknownCompetencies = competencies.filter(
    (competency) => !foundationCompetencies.has(competency)
  );
  if (unknownCompetencies.length) {
    throw new Error(
      `Unknown assessment competency IDs: ${unknownCompetencies.join(', ')}`
    );
  }
  if (
    options.assessmentType === 'structured-video' &&
    options.status === 'started' &&
    (competencies.length < 1 ||
      proofIds.length < 2 ||
      !options.prepCopySha256 ||
      options.semanticPassComplete !== 'yes')
  ) {
    throw new Error(
      'Starting a structured-video assessment requires at least one competency, two foundation proof IDs, a prep-copy SHA-256 hash, and --semantic-pass-complete yes'
    );
  }

  return withLedgerLock((ledger) => {
    const application = findApplication(ledger, options.id);
    if (TERMINAL_STAGES.has(application.currentStage)) {
      throw new Error(
        `Cannot add an assessment event after terminal stage ${application.currentStage}`
      );
    }
    assertNotBefore(options.at, application.appliedAt, '--at');
    assertNotBefore(
      options.at,
      latestTimestamp(application.events, application.appliedAt),
      '--at'
    );
    const priorAssessment = application.events
      .filter(
        (event) =>
          event.type === 'assessment' &&
          event.assessmentType === options.assessmentType
      )
      .at(-1);
    if (
      priorAssessment &&
      ASSESSMENT_STATUS_RANK[options.status] <
        ASSESSMENT_STATUS_RANK[priorAssessment.assessmentStatus]
    ) {
      throw new Error(
        `Assessment cannot regress from ${priorAssessment.assessmentStatus} to ${options.status}`
      );
    }
    const event = {
      type: 'assessment',
      assessmentStatus: options.status,
      assessmentType: options.assessmentType,
      at: new Date(options.at).toISOString(),
      source: options.source,
      person: null,
      notes: options.notes || null,
      competencies,
      proofIds,
      prepCopySha256: options.prepCopySha256 || null,
      semanticPassAttested: options.semanticPassComplete === 'yes',
    };
    application.events.push(event);
    return event;
  });
}

export function recordOutreach(options) {
  requireFields(options, ['id', 'status', 'channel', 'at']);
  assertIso(options.at, '--at');
  if (!OUTREACH_STATUSES.has(options.status)) {
    throw new Error(
      `--status must be one of ${[...OUTREACH_STATUSES].join(', ')}`
    );
  }
  return withLedgerLock((ledger) => {
    const application = findApplication(ledger, options.id);
    assertNotBefore(options.at, application.appliedAt, '--at');
    const threadKey = outreachThreadKey(options);
    const threadOutreach = application.outreach.filter(
      (outreach) =>
        (outreach.threadKey || outreachThreadKey(outreach)) === threadKey
    );
    assertNotBefore(
      options.at,
      latestTimestamp(threadOutreach, application.appliedAt),
      '--at'
    );
    const previousStatus = threadOutreach.at(-1)?.status;
    if (
      previousStatus &&
      OUTREACH_RANK[options.status] < OUTREACH_RANK[previousStatus]
    ) {
      throw new Error(
        `Outreach cannot regress from ${previousStatus} to ${options.status}`
      );
    }
    const outreach = {
      status: options.status,
      channel: options.channel,
      threadKey,
      at: new Date(options.at).toISOString(),
      person: options.person || null,
      notes: options.notes || null,
    };
    application.outreach.push(outreach);
    application.outreach.sort(
      (left, right) => Date.parse(left.at) - Date.parse(right.at)
    );
    return outreach;
  });
}

function increment(target, key) {
  target[key] = (target[key] || 0) + 1;
}

export function buildReport() {
  const ledger = readLedger();
  const report = {
    totalReadinessRecords: (ledger.readiness || []).length,
    readinessByStatus: {},
    totalApplications: ledger.applications.length,
    byStage: {},
    byFitClass: {},
    byEvidenceMode: {},
    byAtsVendor: {},
    bySource: {},
    byPositioningLane: {},
    byBridgeType: {},
    byApplicationStrategy: {},
    byCoverLetterStatus: {},
    requirementCoverage: {
      direct: 0,
      adjacent: 0,
      notSupported: 0,
      exact: 0,
      recognizedEquivalent: 0,
      contextual: 0,
    },
    assessments: {
      byType: {},
      byStatus: {},
    },
    outcomes: {
      byCategory: {},
      readinessBlockers: {},
    },
    outreach: {
      draft: 0,
      sent: 0,
      replied: 0,
    },
  };
  for (const readiness of ledger.readiness || []) {
    increment(report.readinessByStatus, readiness.status);
    for (const blocker of readiness.blockers) {
      increment(report.outcomes.readinessBlockers, blocker);
    }
  }
  for (const application of ledger.applications) {
    increment(report.byStage, application.currentStage);
    increment(report.byFitClass, application.fitClass);
    increment(report.byEvidenceMode, application.evidenceMode);
    increment(report.byAtsVendor, application.atsVendor);
    increment(report.bySource, application.source);
    increment(
      report.byPositioningLane,
      application.positioningLane || application.targetLane || 'legacy'
    );
    increment(report.byBridgeType, application.bridgeType || 'legacy');
    increment(
      report.byApplicationStrategy,
      application.applicationStrategy || 'legacy'
    );
    increment(
      report.byCoverLetterStatus,
      application.coverLetterStatus || 'legacy'
    );
    for (const [field, count] of Object.entries(
      application.requirementCoverage || {}
    )) {
      if (field in report.requirementCoverage) {
        report.requirementCoverage[field] += count;
      }
    }
    for (const event of application.events) {
      if (event.type === 'assessment') {
        increment(report.assessments.byType, event.assessmentType);
        increment(report.assessments.byStatus, event.assessmentStatus);
      }
      if (event.type === 'stage' && event.outcomeCategory) {
        increment(report.outcomes.byCategory, event.outcomeCategory);
      }
    }
    for (const outreach of application.outreach) {
      increment(report.outreach, outreach.status);
    }
  }
  return report;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') {
    usage();
    process.exit(command ? 0 : 2);
  }
  if (command === 'report') {
    console.log(JSON.stringify(buildReport(), null, 2));
    return;
  }
  const options = parseFlags(args);
  let result;
  if (command === 'ready') {
    result = await prepareApplication(options);
  } else if (command === 'record') {
    result = await recordApplication(options);
  } else if (command === 'event') {
    result = recordEvent(options);
  } else if (command === 'assessment') {
    result = recordAssessment(options);
  } else if (command === 'outreach') {
    result = recordOutreach(options);
  } else {
    usage();
    throw new Error(`Unknown command: ${command}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
