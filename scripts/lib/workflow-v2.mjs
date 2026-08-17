import {
  accessSync,
  constants,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(moduleDir, '..', '..');

export const WORKFLOW_VERSION = 2;
export const CURRENT_CONTRACT_REVISION = 7;
export const HUMANIZER_VERSION = '2.2.0';
const SUPPORTED_CONTRACT_REVISIONS = new Set([2, 3, 4, 5, 6, 7]);
const FLEXIBLE_POSITIONING_REVISIONS = new Set([5, 6, 7]);
const RESUME_COMPOSITION_MODES = new Set([
  'foundation-complete',
  'curated-user-authorized',
  'profile-complete',
  'hybrid-selective',
]);
export const PUBLIC_BASE = 'https://wallymo.github.io/';
export const RESUME_FOUNDATION_PATH = 'scripts/resume-foundation.json';
export const RESUME_BASE_PROFILES_PATH =
  'scripts/resume-base-profiles.json';
export const RESUME_ROLE_IDS = [
  'hedgehox',
  'one-block-away',
  'kinesso',
  'omnicom',
  'heartbeat',
  'account-management',
];
const DEFAULT_RESUME_EXPERIENCE_SECTIONS = [
  {
    heading: 'Experience',
    roleIds: RESUME_ROLE_IDS,
  },
];
const BRIDGE_TYPES = new Set([
  'direct',
  'operating-center',
  'domain-transfer',
  'tool-transfer',
  'level-transfer',
  'not-credible',
]);
const APPLICATION_STRATEGIES = new Set([
  'direct',
  'transferable',
  'approved-stretch',
  'stop',
]);
const REQUIREMENT_SOURCES = new Set([
  'jd',
  'application-form',
  'employer-policy',
  'assessment',
]);
const REQUIREMENT_CONFIDENCE = new Set([
  'explicit',
  'contextual',
  'ambiguous',
]);
const REQUIREMENT_DESTINATIONS = new Set([
  'summary',
  'skills',
  'experience',
  'portfolio',
  'application-answer',
  'cover-letter',
]);
const REQUIREMENT_MATCH_MODES = new Set([
  'exact',
  'recognized-equivalent',
  'contextual',
  'not-supported',
]);
const RESUME_BASE_MODES = new Set([
  'account-leadership',
  'ai-product-implementation',
  'hybrid-selective',
]);
const RESUME_BASE_ACTIONS = new Set(['use-existing', 'tailor-to-jd']);
const ACCOUNT_PRESENTATIONS = new Set([
  'agency-progression',
  'consolidated',
]);
const RESUME_DESTINATIONS = new Set(['summary', 'skills', 'experience']);
const DEFENSIVE_POSITIONING_PATTERN =
  /\b(?:i may not|i do not have|i don't have|while i have not|while i haven't|although i|not a perfect fit|my background is closest|without pretending)\b/i;

export function usesFlexiblePositioningContract(configOrRevision) {
  const revision =
    typeof configOrRevision === 'object'
      ? configOrRevision?.contractRevision
      : configOrRevision;
  return FLEXIBLE_POSITIONING_REVISIONS.has(revision);
}

export function getResumeExperienceSections(config) {
  return Array.isArray(config?.resume?.experienceSections)
    ? config.resume.experienceSections
    : DEFAULT_RESUME_EXPERIENCE_SECTIONS;
}

export function getRoutePresentation(config) {
  if (config?.route?.presentation) {
    return config.route.presentation;
  }
  return usesFlexiblePositioningContract(config) &&
    config?.classification?.targetLane === 'client-account-delivery'
    ? 'showcase'
    : 'full';
}

export function scopedProjectFilename(config, project) {
  if (config?.routeMode !== 'scoped-projects') {
    return project;
  }
  return config?.route?.projectAliases?.[project] || project;
}

export function scopedProjectEntries(config) {
  const selectedProjects = Array.isArray(config?.selectedProjects)
    ? config.selectedProjects
    : [];
  return selectedProjects.map((project) => ({
    source: project,
    output: scopedProjectFilename(config, project),
  }));
}

export function scopedProjectRedirectEntries(config) {
  return scopedProjectEntries(config)
    .filter(({ source, output }) => source !== output)
    .map(({ source, output }) => ({ source, target: output }));
}

export function scopedProjectAssets(config) {
  return [
    ...new Set(
      [
        ...Object.values(config?.route?.projectAssetOverrides || {}).flatMap(
          (overrides) => Object.values(overrides || {})
        ),
        ...Object.values(config?.route?.projectVideoInsertions || {}).flatMap(
          (video) => [video?.src, video?.poster].filter(Boolean)
        ),
      ]
    ),
  ].sort();
}

export function resumeRoleSubEntries(resume, roleId) {
  const roleValue = resume?.roles?.[roleId];
  const isSubEntry = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  return Array.isArray(roleValue) &&
    roleValue.length > 0 &&
    roleValue.every(isSubEntry)
    ? roleValue
    : null;
}

export function resumeRoleBulletTexts(resume, roleId) {
  const subEntries = resumeRoleSubEntries(resume, roleId);
  if (subEntries) {
    return subEntries.flatMap((subEntry) =>
      Array.isArray(subEntry?.bullets) ? subEntry.bullets : []
    );
  }
  const roleValue = resume?.roles?.[roleId];
  return Array.isArray(roleValue) ? roleValue : [];
}

export function hasCoverLetterArtifact(config) {
  return Boolean(
    config?.contractRevision >= 6 &&
      config?.coverLetter &&
      typeof config.coverLetter === 'object'
  );
}

export function bridgeRequiresCoverLetter(config) {
  return Boolean(
    config?.contractRevision >= 6 &&
      config?.fitGate?.coverLetterBridge?.status === 'recommended'
  );
}

export function getRepoRoot() {
  return path.resolve(process.env.WORKFLOW_REPO_ROOT || defaultRepoRoot);
}

export function resolveRepoPath(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  return path.resolve(getRepoRoot(), filePath);
}

export function relativeRepoPath(filePath) {
  return path.relative(getRepoRoot(), resolveRepoPath(filePath)).split(path.sep).join('/');
}

export function readJson(filePath) {
  return JSON.parse(readFileSync(resolveRepoPath(filePath), 'utf8'));
}

export function readResumeFoundation() {
  return readJson(RESUME_FOUNDATION_PATH);
}

export function readResumeBaseProfiles() {
  return readJson(RESUME_BASE_PROFILES_PATH);
}

function foundationRoleIdsForVersion(foundation, roleId, version) {
  const explicitOrder = foundation?.versionRoleOrders?.[String(version)]?.[roleId];
  if (Array.isArray(explicitOrder)) {
    return [...explicitOrder];
  }
  return (foundation?.roles?.[roleId] || [])
    .filter(
      (bullet) =>
        (bullet.introducedInFoundationVersion || 1) <= version
    )
    .map((bullet) => bullet.id);
}

export function writeJson(filePath, value) {
  writeFileSync(resolveRepoPath(filePath), `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha256File(filePath) {
  return sha256(readFileSync(resolveRepoPath(filePath)));
}

function sortForHash(value) {
  if (Array.isArray(value)) {
    return value.map(sortForHash);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith('__'))
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortForHash(nestedValue)])
    );
  }
  return value;
}

export function configInputSha256(config) {
  const buildInput = sortForHash({
    ...config,
    qa: { status: 'pending' },
  });
  return sha256(JSON.stringify(buildInput));
}

export function humanizerCopyEntries(config) {
  const entries = [];
  const add = (field, value) => {
    if (typeof value === 'string' && value.trim()) {
      entries.push([field, value]);
    }
  };
  const addArray = (field, values) => {
    if (!Array.isArray(values)) {
      return;
    }
    values.forEach((value, index) => add(`${field}[${index}]`, value));
  };

  add('classification.targetLane', config?.classification?.targetLane);
  add('classification.primarySource', config?.classification?.primarySource);
  add(
    'classification.supportingSource',
    config?.classification?.supportingSource
  );
  if (Array.isArray(config?.classification?.hardGates)) {
    config.classification.hardGates.forEach((hardGate, index) => {
      add(`classification.hardGates[${index}].evidence`, hardGate?.evidence);
    });
  }
  if (Array.isArray(config?.requirements)) {
    config.requirements.forEach((requirement, requirementIndex) => {
      addArray(
        `requirements[${requirementIndex}].evidence`,
        requirement?.evidence
      );
    });
  }

  add('positioning.targetIdentity', config?.positioning?.targetIdentity);
  add('positioning.employerNeed', config?.positioning?.employerNeed);
  add('positioning.bridgeThesis', config?.positioning?.bridgeThesis);
  add('positioning.remainingGap', config?.positioning?.remainingGap);

  addArray('fitGate.supportedOverlap', config?.fitGate?.supportedOverlap);
  addArray(
    'fitGate.unsupportedRequirements',
    config?.fitGate?.unsupportedRequirements
  );
  addArray('fitGate.actualMismatches', config?.fitGate?.actualMismatches);
  addArray('fitGate.missingEvidence', config?.fitGate?.missingEvidence);
  add(
    'fitGate.coverLetterBridge.rationale',
    config?.fitGate?.coverLetterBridge?.rationale
  );
  add('fitGate.resumeBase.rationale', config?.fitGate?.resumeBase?.rationale);
  add('fitGate.recommendation', config?.fitGate?.recommendation);
  add('coverLetter.greeting', config?.coverLetter?.greeting);
  addArray('coverLetter.paragraphs', config?.coverLetter?.paragraphs);
  add('coverLetter.closing', config?.coverLetter?.closing);
  add('coverLetter.signature', config?.coverLetter?.signature);

  if (config?.contractRevision !== 4) {
    add('resume.summary', config?.resume?.summary);
    add('resume.portfolioLinkLabel', config?.resume?.portfolioLinkLabel);
    if (Array.isArray(config?.resume?.experienceSections)) {
      config.resume.experienceSections.forEach((section, index) => {
        add(`resume.experienceSections[${index}].heading`, section?.heading);
      });
    }
    if (Array.isArray(config?.resume?.awards)) {
      config.resume.awards.forEach((award, index) => {
        add(`resume.awards[${index}].label`, award?.label);
        add(`resume.awards[${index}].detail`, award?.detail);
      });
    }
    if (Array.isArray(config?.resume?.skills)) {
      config.resume.skills.forEach((skill, index) => {
        add(`resume.skills[${index}].label`, skill?.label);
        add(`resume.skills[${index}].description`, skill?.description);
      });
    }
  }
  for (const roleId of RESUME_ROLE_IDS) {
    const subEntries = resumeRoleSubEntries(config?.resume, roleId);
    if (subEntries) {
      subEntries.forEach((subEntry, subIndex) => {
        add(`resume.roles.${roleId}[${subIndex}].title`, subEntry?.title);
        addArray(
          `resume.roles.${roleId}[${subIndex}].bullets`,
          subEntry?.bullets
        );
      });
    } else {
      addArray(`resume.roles.${roleId}`, config?.resume?.roles?.[roleId]);
    }
  }

  add('hero.eyebrow', config?.hero?.eyebrow);
  addArray('hero.tags', config?.hero?.tags);
  add('hero.intro', config?.hero?.intro);
  add('contact.prompt', config?.contact?.prompt);
  add('contact.signoff', config?.contact?.signoff);
  add('route.heroIntent', config?.route?.heroIntent);
  add('route.workHeading', config?.route?.workHeading);
  add('route.contactHeading', config?.route?.contactHeading);
  if (
    config?.route?.projectPullquoteOverrides &&
    typeof config.route.projectPullquoteOverrides === 'object' &&
    !Array.isArray(config.route.projectPullquoteOverrides)
  ) {
    for (const [project, pullquote] of Object.entries(
      config.route.projectPullquoteOverrides
    )) {
      add(`route.projectPullquoteOverrides.${project}`, pullquote);
    }
  }
  return entries;
}

export function humanizerCopySha256(config) {
  return sha256(JSON.stringify(humanizerCopyEntries(config)));
}

const HUMANIZER_PATTERNS = [
  {
    label: 'chatbot filler',
    pattern:
      /\b(?:great question|of course|certainly|i hope this helps|let me know if|would you like)\b/i,
  },
  {
    label: 'inflated AI vocabulary',
    pattern:
      /\b(?:delve|tapestry|pivotal|vibrant|testament|groundbreaking|seamless|evolving landscape)\b/i,
  },
  {
    label: 'superficial analysis phrase',
    pattern:
      /(?:,|\b)(?:highlighting|underscoring|showcasing|symbolizing|reflecting|fostering)\b/i,
  },
  {
    label: 'promotional copula avoidance',
    pattern: /\b(?:serves as|stands as|boasts)\b/i,
  },
  {
    label: 'negative parallelism',
    pattern: /\b(?:not just|not only)\b[^.]{0,160}\b(?:but|it's)\b/i,
  },
  {
    label: 'formulaic transition',
    pattern: /\b(?:additionally|at its core|in order to)\b/i,
  },
  {
    label: 'generic conclusion',
    pattern: /\b(?:the future looks bright|exciting times lie ahead)\b/i,
  },
  { label: 'em dash', pattern: /—/ },
  { label: 'curly quotation mark', pattern: /[“”]/ },
  {
    label: 'decorative emoji',
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
  },
];

export function humanizerViolations(config) {
  const violations = [];
  for (const [field, value] of humanizerCopyEntries(config)) {
    for (const { label, pattern } of HUMANIZER_PATTERNS) {
      if (pattern.test(value)) {
        violations.push(`${field}: ${label}`);
      }
    }
    if (usesFlexiblePositioningContract(config) && /\bUSD\b/i.test(value)) {
      violations.push(`${field}: use $ instead of USD in recruiter-facing copy`);
    }
  }
  return [...new Set(violations)];
}

function isStrictReviewTimestamp(value, now = Date.now()) {
  if (typeof value !== 'string') {
    return false;
  }
  const parsed = Date.parse(value);
  return (
    !Number.isNaN(parsed) &&
    new Date(parsed).toISOString() === value &&
    parsed <= now
  );
}

export function approveHumanizerReview(
  config,
  {
    reviewedAt = new Date().toISOString(),
    mode = 'surface-only',
    rewriteAuthorized = false,
    semanticPassComplete = false,
  } = {}
) {
  if (semanticPassComplete !== true) {
    throw new Error(
      'Approval requires --semantic-pass-complete after the full humanizer skill pass'
    );
  }
  if (mode === 'rewrite-requested' && rewriteAuthorized !== true) {
    throw new Error('rewrite-requested mode requires explicit authorization');
  }
  if (mode !== 'surface-only' && mode !== 'rewrite-requested') {
    throw new Error('Humanizer mode must be surface-only or rewrite-requested');
  }
  if (!isStrictReviewTimestamp(reviewedAt)) {
    throw new Error(
      'reviewedAt must be a canonical ISO timestamp and cannot be in the future'
    );
  }
  const violations = humanizerViolations(config);
  if (violations.length) {
    throw new Error(
      `Copy still contains obvious AI-writing patterns:\n- ${violations.join(
        '\n- '
      )}`
    );
  }
  config.copyReview = {
    humanizerVersion: HUMANIZER_VERSION,
    mode,
    status: 'passed',
    reviewedAt,
    copySha256: humanizerCopySha256(config),
    preserved:
      mode === 'surface-only'
        ? ['content', 'structure', 'claims', 'ending']
        : ['claims'],
    rewriteAuthorized: mode === 'rewrite-requested',
    reviewMethod: 'humanizer-skill',
    semanticPassAttested: true,
    staticChecksPassed: true,
    finalAntiAiPass: true,
    remainingTells: [],
  };
  return config.copyReview;
}

export function humanizerReviewErrors(config) {
  if (
    config?.contractRevision !== CURRENT_CONTRACT_REVISION &&
    config?.copyReview === undefined
  ) {
    return [];
  }

  const errors = humanizerViolations(config);
  const review = config?.copyReview;
  if (!review || typeof review !== 'object') {
    errors.push('copyReview is required');
    return errors;
  }
  if (review.humanizerVersion !== HUMANIZER_VERSION) {
    errors.push(`copyReview.humanizerVersion must be ${HUMANIZER_VERSION}`);
  }
  if (review.mode !== 'surface-only' && review.mode !== 'rewrite-requested') {
    errors.push('copyReview.mode must be surface-only or rewrite-requested');
  }
  if (
    review.mode === 'rewrite-requested' &&
    review.rewriteAuthorized !== true
  ) {
    errors.push('rewrite-requested mode requires explicit authorization');
  }
  if (review.status !== 'passed') {
    errors.push('copyReview.status must be passed');
  }
  if (!isStrictReviewTimestamp(review.reviewedAt)) {
    errors.push(
      'copyReview.reviewedAt must be a canonical ISO timestamp and cannot be in the future'
    );
  }
  if (review.copySha256 !== humanizerCopySha256(config)) {
    errors.push('copyReview.copySha256 is stale; run the humanizer pass again');
  }
  const requiredPreserved =
    review.mode === 'surface-only'
      ? ['content', 'structure', 'claims', 'ending']
      : ['claims'];
  if (
    !Array.isArray(review.preserved) ||
    !requiredPreserved.every((item) => review.preserved.includes(item))
  ) {
    errors.push(
      `copyReview.preserved must include ${requiredPreserved.join(', ')}`
    );
  }
  if (review.finalAntiAiPass !== true) {
    errors.push('copyReview.finalAntiAiPass must be true');
  }
  if (
    review.reviewMethod !== 'humanizer-skill' ||
    review.semanticPassAttested !== true
  ) {
    errors.push(
      'copyReview must attest that the full humanizer skill pass was completed'
    );
  }
  if (review.staticChecksPassed !== true) {
    errors.push('copyReview.staticChecksPassed must be true');
  }
  if (!Array.isArray(review.remainingTells) || review.remainingTells.length) {
    errors.push('copyReview.remainingTells must be empty after the final revision');
  }
  return [...new Set(errors)];
}

export function assertHumanizerReviewCurrent(config) {
  const errors = humanizerReviewErrors(config);
  if (errors.length) {
    throw new Error(`Humanizer copy gate failed:\n- ${errors.join('\n- ')}`);
  }
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pushError(errors, condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

export function wordCount(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function foundationBulletIdMap(foundation) {
  const idToRole = new Map();
  for (const roleId of RESUME_ROLE_IDS) {
    for (const bullet of foundation?.roles?.[roleId] || []) {
      idToRole.set(bullet.id, roleId);
    }
  }
  return idToRole;
}

function resumeEvidenceIdMap(foundation, profileRegistry = null) {
  const idToRole = foundationBulletIdMap(foundation);
  for (const evidence of profileRegistry?.evidenceAdditions || []) {
    if (isNonEmptyString(evidence?.id) && isNonEmptyString(evidence?.roleId)) {
      idToRole.set(evidence.id, evidence.roleId);
    }
  }
  return idToRole;
}

function profileSourceIds(profile) {
  return new Set(
    RESUME_ROLE_IDS.flatMap((roleId) => profile?.requiredSourceIds?.[roleId] || [])
  );
}

function selectedResumeBaseProfiles(resumeBase, profileRegistry) {
  if (!Array.isArray(resumeBase?.sourceProfiles)) {
    return [];
  }
  return resumeBase.sourceProfiles
    .map((sourceProfile) => {
      const profile = profileRegistry?.profiles?.[sourceProfile?.id];
      return profile
        ? {
            id: sourceProfile.id,
            requestedVersion: sourceProfile.version,
            profile,
          }
        : null;
    })
    .filter(Boolean);
}

function isGeneralNetworkingJob(job) {
  return Boolean(
    job?.jobId === 'general-profile' &&
      job?.sourceChannel === 'user-requested-general-resume'
  );
}

function validateResumeBaseGate(
  config,
  errors,
  foundation,
  profileRegistry
) {
  if (config?.contractRevision !== 7) {
    return;
  }

  pushError(
    errors,
    profileRegistry && typeof profileRegistry === 'object',
    'resume base profile registry is required for revision 7'
  );
  if (!profileRegistry || typeof profileRegistry !== 'object') {
    return;
  }
  pushError(
    errors,
    profileRegistry.registryVersion === 1,
    'resume base profile registryVersion must be 1'
  );
  pushError(
    errors,
    profileRegistry.foundationId === foundation?.id,
    'resume base profile registry must reference the current resume foundation'
  );

  const resumeBase = config?.fitGate?.resumeBase;
  pushError(
    errors,
    resumeBase && typeof resumeBase === 'object' && !Array.isArray(resumeBase),
    'fitGate.resumeBase is required for revision 7'
  );
  if (!resumeBase || typeof resumeBase !== 'object' || Array.isArray(resumeBase)) {
    return;
  }

  pushError(
    errors,
    RESUME_BASE_MODES.has(resumeBase.mode),
    'fitGate.resumeBase.mode must be account-leadership, ai-product-implementation, or hybrid-selective'
  );
  pushError(
    errors,
    RESUME_BASE_ACTIONS.has(resumeBase.action),
    'fitGate.resumeBase.action must be use-existing or tailor-to-jd'
  );
  pushError(
    errors,
    ACCOUNT_PRESENTATIONS.has(resumeBase.accountPresentation),
    'fitGate.resumeBase.accountPresentation must be agency-progression or consolidated'
  );
  pushError(
    errors,
    isNonEmptyString(resumeBase.rationale),
    'fitGate.resumeBase.rationale is required'
  );
  pushError(
    errors,
    Array.isArray(resumeBase.sourceProfiles) &&
      resumeBase.sourceProfiles.length >= 1 &&
      resumeBase.sourceProfiles.length <= 2,
    'fitGate.resumeBase.sourceProfiles must include one or two profiles'
  );

  const sourceProfileIds = Array.isArray(resumeBase.sourceProfiles)
    ? resumeBase.sourceProfiles.map((sourceProfile) => sourceProfile?.id)
    : [];
  pushError(
    errors,
    new Set(sourceProfileIds).size === sourceProfileIds.length,
    'fitGate.resumeBase.sourceProfiles must not contain duplicates'
  );
  for (const [index, sourceProfile] of (
    resumeBase.sourceProfiles || []
  ).entries()) {
    const profile = profileRegistry.profiles?.[sourceProfile?.id];
    pushError(
      errors,
      profile && typeof profile === 'object',
      `fitGate.resumeBase.sourceProfiles[${index}].id is unknown`
    );
    pushError(
      errors,
      Number.isInteger(sourceProfile?.version) &&
        sourceProfile.version === profile?.version,
      `fitGate.resumeBase.sourceProfiles[${index}].version must match the profile registry`
    );
  }

  const expectedProfileIds =
    resumeBase.mode === 'hybrid-selective'
      ? ['account-leadership', 'ai-product-implementation']
      : [resumeBase.mode];
  pushError(
    errors,
    sourceProfileIds.length === expectedProfileIds.length &&
      expectedProfileIds.every((profileId) => sourceProfileIds.includes(profileId)),
    'fitGate.resumeBase.sourceProfiles must match the selected base mode'
  );
  pushError(
    errors,
    expectedProfileIds.includes(resumeBase.leadProfileId),
    'fitGate.resumeBase.leadProfileId must be one of the selected source profiles'
  );
  if (resumeBase.mode !== 'hybrid-selective') {
    pushError(
      errors,
      resumeBase.leadProfileId === resumeBase.mode,
      'a single-profile resume must lead with its selected profile'
    );
  }

  const generalNetworking = isGeneralNetworkingJob(config?.job);
  pushError(
    errors,
    resumeBase.action !== 'use-existing' || generalNetworking,
    'fitGate.resumeBase.action use-existing is allowed only for a general networking profile'
  );
  pushError(
    errors,
    generalNetworking || resumeBase.action === 'tailor-to-jd',
    'every employer job description must use fitGate.resumeBase.action tailor-to-jd'
  );

  const compositionMode = config?.resume?.compositionMode || 'foundation-complete';
  const expectedCompositionMode =
    resumeBase.mode === 'account-leadership'
      ? 'profile-complete'
      : resumeBase.mode === 'hybrid-selective'
        ? 'hybrid-selective'
        : 'foundation-complete';
  pushError(
    errors,
    compositionMode === 'curated-user-authorized' ||
      compositionMode === expectedCompositionMode,
    `resume.compositionMode must be ${expectedCompositionMode} for ${resumeBase.mode}`
  );
  if (resumeBase.mode === 'account-leadership') {
    pushError(
      errors,
      resumeBase.accountPresentation === 'agency-progression',
      'account-leadership resumes must use agency-progression presentation'
    );
  }
  if (resumeBase.mode === 'ai-product-implementation') {
    pushError(
      errors,
      resumeBase.accountPresentation === 'consolidated',
      'ai-product-implementation resumes must use consolidated account presentation'
    );
  }

  const selectedProfiles = selectedResumeBaseProfiles(
    resumeBase,
    profileRegistry
  );
  const leadProfile = selectedProfiles.find(
    ({ id }) => id === resumeBase.leadProfileId
  )?.profile;
  const targetLane = config?.positioning?.laneId;
  pushError(
    errors,
    leadProfile?.allowedPositioningLaneIds?.includes(targetLane),
    'positioning.laneId is not compatible with the selected lead resume profile'
  );

  if (resumeBase.mode === 'hybrid-selective') {
    const firstRoleId = config?.resume?.experienceSections?.[0]?.roleIds?.[0];
    pushError(
      errors,
      isNonEmptyString(firstRoleId),
      'hybrid-selective resumes must define experienceSections so the lead profile controls section order'
    );
    pushError(
      errors,
      resumeBase.leadProfileId === 'account-leadership'
        ? firstRoleId === 'account-management'
        : isNonEmptyString(firstRoleId) && firstRoleId !== 'account-management',
      'hybrid-selective experienceSections must begin with the selected lead profile'
    );
    const mappedIds = mappedResumeIds(config?.resume);
    const accountCoreIds = new Set(
      profileRegistry.profiles?.['account-leadership']?.coreProofIds || []
    );
    const aiCoreIds = new Set(
      profileRegistry.profiles?.['ai-product-implementation']?.coreProofIds || []
    );
    const directCoreRequirements = (config?.requirements || []).filter(
      (requirement) =>
        requirement?.priority === 'core' &&
        requirement?.evidenceStatus === 'direct' &&
        Array.isArray(requirement?.proofIds)
    );
    const provesProfile = (profileIds) =>
      directCoreRequirements.some((requirement) =>
        requirement.proofIds.some(
          (proofId) => profileIds.has(proofId) && mappedIds.has(proofId)
        )
      );
    pushError(
      errors,
      provesProfile(accountCoreIds) && provesProfile(aiCoreIds),
      'hybrid-selective requires direct core requirements backed by selected account-leadership and AI/product evidence'
    );
  }
}

function mappedResumeIds(resume) {
  return new Set(
    RESUME_ROLE_IDS.flatMap(
      (roleId) => resume?.sourceBulletIds?.[roleId] || []
    )
  );
}

function validateRequirements(config, errors, foundation = null) {
  pushError(errors, Array.isArray(config.requirements) && config.requirements.length > 0, 'requirements must be a non-empty array');
  if (!Array.isArray(config.requirements)) {
    return;
  }

  const requirementIds = config.requirements
    .map((requirement) => requirement?.id)
    .filter(isNonEmptyString);
  pushError(
    errors,
    new Set(requirementIds).size === requirementIds.length,
    'requirements[].id must be unique'
  );

  const allowedPriority = new Set([
    'hard-gate',
    'core',
    'preferred',
    'context',
  ]);
  const allowedEvidence = new Set(['direct', 'adjacent', 'none']);
  const availableProofIds = mappedResumeIds(config?.resume);
  if (foundation) {
    for (const proofId of foundationBulletIdMap(foundation).keys()) {
      availableProofIds.add(proofId);
    }
  }

  for (const [index, requirement] of config.requirements.entries()) {
    const prefix = `requirements[${index}]`;
    pushError(errors, isNonEmptyString(requirement?.id), `${prefix}.id is required`);
    pushError(errors, isNonEmptyString(requirement?.text), `${prefix}.text is required`);
    pushError(errors, allowedPriority.has(requirement?.priority), `${prefix}.priority must be hard-gate, core, preferred, or context`);
    pushError(errors, allowedEvidence.has(requirement?.evidenceStatus), `${prefix}.evidenceStatus must be direct, adjacent, or none`);
    pushError(errors, isStringArray(requirement?.evidence), `${prefix}.evidence must be a string array`);
    if (requirement?.evidenceStatus !== 'none') {
      pushError(errors, requirement?.evidence?.length > 0, `${prefix}.evidence is required for supported requirements`);
    }
    pushError(errors, isStringArray(requirement?.resumeTerms), `${prefix}.resumeTerms must be a string array`);
    pushError(errors, requirement?.resumeTerms?.length > 0, `${prefix}.resumeTerms must be non-empty`);

    if (!usesFlexiblePositioningContract(config)) {
      continue;
    }

    pushError(
      errors,
      REQUIREMENT_SOURCES.has(requirement?.source),
      `${prefix}.source must be jd, application-form, employer-policy, or assessment`
    );
    pushError(
      errors,
      REQUIREMENT_CONFIDENCE.has(requirement?.confidence),
      `${prefix}.confidence must be explicit, contextual, or ambiguous`
    );
    pushError(
      errors,
      Array.isArray(requirement?.proofIds) &&
        requirement.proofIds.every(isNonEmptyString),
      `${prefix}.proofIds must be a string array`
    );
    if (Array.isArray(requirement?.proofIds)) {
      pushError(
        errors,
        new Set(requirement.proofIds).size === requirement.proofIds.length,
        `${prefix}.proofIds must not contain duplicates`
      );
      pushError(
        errors,
        requirement.proofIds.every((proofId) =>
          availableProofIds.has(proofId)
        ),
        `${prefix}.proofIds contains an unknown resume proof ID`
      );
    }
    pushError(
      errors,
      Array.isArray(requirement?.destinations) &&
        requirement.destinations.length > 0 &&
        requirement.destinations.every((destination) =>
          REQUIREMENT_DESTINATIONS.has(destination)
        ),
      `${prefix}.destinations must contain supported package destinations`
    );
    if (Array.isArray(requirement?.destinations)) {
      pushError(
        errors,
        new Set(requirement.destinations).size ===
          requirement.destinations.length,
        `${prefix}.destinations must not contain duplicates`
      );
    }
    pushError(
      errors,
      REQUIREMENT_MATCH_MODES.has(requirement?.matchMode),
      `${prefix}.matchMode must be exact, recognized-equivalent, contextual, or not-supported`
    );
    if (requirement?.evidenceStatus === 'none') {
      pushError(
        errors,
        requirement?.matchMode === 'not-supported',
        `${prefix}.matchMode must be not-supported when evidenceStatus is none`
      );
    } else {
      pushError(
        errors,
        requirement?.matchMode !== 'not-supported',
        `${prefix}.matchMode cannot be not-supported for supported evidence`
      );
    }
    if (
      requirement?.priority === 'core' &&
      requirement?.evidenceStatus !== 'none'
    ) {
      pushError(
        errors,
        requirement?.proofIds?.length > 0,
        `${prefix}.proofIds must identify resume evidence for a supported core criterion`
      );
      pushError(
        errors,
        requirement?.destinations?.some((destination) =>
          RESUME_DESTINATIONS.has(destination)
        ),
        `${prefix} must place supported core evidence in the resume; a cover letter cannot be the only destination`
      );
    }
  }
}

export function deriveHardGateStatus(hardGates = []) {
  if (hardGates.some((gate) => gate.status === 'fail')) {
    return 'fail';
  }
  if (hardGates.some((gate) => gate.status === 'uncertain')) {
    return 'uncertain';
  }
  return 'pass';
}

function validateResume(
  config,
  errors,
  profileRegistry = null,
  { requireCurrentContract = false } = {}
) {
  const resume = config.resume;
  pushError(errors, resume && typeof resume === 'object', 'resume is required');
  if (!resume || typeof resume !== 'object') {
    return;
  }
  const compositionMode =
    resume.compositionMode || 'foundation-complete';
  const curatedResume = compositionMode === 'curated-user-authorized';
  const profileComplete = compositionMode === 'profile-complete';
  const hybridSelective = compositionMode === 'hybrid-selective';
  const agencyPresentation =
    config?.fitGate?.resumeBase?.accountPresentation === 'agency-progression';
  pushError(
    errors,
    RESUME_COMPOSITION_MODES.has(compositionMode),
    'resume.compositionMode must be foundation-complete, curated-user-authorized, profile-complete, or hybrid-selective'
  );
  if (profileComplete || hybridSelective) {
    pushError(
      errors,
      config.contractRevision === 7,
      `${compositionMode} mode is available only for revision 7`
    );
  }
  if (curatedResume) {
    const authorization = resume.curationAuthorization;
    pushError(
      errors,
      usesFlexiblePositioningContract(config),
      'resume curated-user-authorized mode is available only for revisions 5, 6, and 7'
    );
    pushError(
      errors,
      authorization && typeof authorization === 'object',
      'resume.curationAuthorization is required for curated-user-authorized mode'
    );
    pushError(
      errors,
      authorization?.authorizedBy === 'user',
      'resume.curationAuthorization.authorizedBy must be user'
    );
    pushError(
      errors,
      /^\d{4}-\d{2}-\d{2}$/.test(authorization?.authorizedAt || ''),
      'resume.curationAuthorization.authorizedAt must use YYYY-MM-DD'
    );
    pushError(
      errors,
      isNonEmptyString(authorization?.scope),
      'resume.curationAuthorization.scope is required'
    );
    pushError(
      errors,
      isNonEmptyString(authorization?.reason),
      'resume.curationAuthorization.reason is required'
    );
  }

  pushError(errors, isNonEmptyString(resume.summary), 'resume.summary is required');
  pushError(errors, Array.isArray(resume.skills) && resume.skills.length >= 4 && resume.skills.length <= 6, 'resume.skills must include 4 to 6 entries');

  if (Array.isArray(resume.skills)) {
    for (const [index, skill] of resume.skills.entries()) {
      pushError(errors, isNonEmptyString(skill?.label), `resume.skills[${index}].label is required`);
      pushError(errors, isNonEmptyString(skill?.description), `resume.skills[${index}].description is required`);
    }
  }

  pushError(errors, resume.roles && typeof resume.roles === 'object', 'resume.roles is required');
  for (const roleId of RESUME_ROLE_IDS) {
    const subEntries = resumeRoleSubEntries(resume, roleId);
    if (subEntries) {
      pushError(
        errors,
        (curatedResume ||
          (config.contractRevision === 7 &&
            agencyPresentation &&
            (profileComplete || hybridSelective))) &&
          usesFlexiblePositioningContract(config),
        `resume.roles.${roleId} sub-entries require curated authorization or a revision 7 agency-progression base`
      );
      pushError(
        errors,
        subEntries.length >= 2 && subEntries.length <= 8,
        `resume.roles.${roleId} must include 2 to 8 sub-entries`
      );
      for (const [subIndex, subEntry] of subEntries.entries()) {
        const prefix = `resume.roles.${roleId}[${subIndex}]`;
        pushError(
          errors,
          isNonEmptyString(subEntry?.title),
          `${prefix}.title is required`
        );
        pushError(
          errors,
          isNonEmptyString(subEntry?.employer),
          `${prefix}.employer is required`
        );
        pushError(
          errors,
          isNonEmptyString(subEntry?.dateRange),
          `${prefix}.dateRange is required`
        );
        pushError(
          errors,
          subEntry?.location === undefined ||
            isNonEmptyString(subEntry.location),
          `${prefix}.location must be a non-empty string when present`
        );
        pushError(
          errors,
          Array.isArray(subEntry?.bullets) &&
            subEntry.bullets.length > 0 &&
            subEntry.bullets.every(isNonEmptyString),
          `${prefix}.bullets must be a non-empty string array`
        );
      }
      continue;
    }
    pushError(
      errors,
      Array.isArray(resume.roles?.[roleId]) &&
        resume.roles[roleId].length > 0 &&
        resume.roles[roleId].every(isNonEmptyString),
      `resume.roles.${roleId} must be a non-empty string array`
    );
  }
  if (resume.experienceSections !== undefined) {
    pushError(
      errors,
      Array.isArray(resume.experienceSections) &&
        resume.experienceSections.length >= 1 &&
        resume.experienceSections.length <= 3,
      'resume.experienceSections must include 1 to 3 sections'
    );
    if (Array.isArray(resume.experienceSections)) {
      const sectionRoleIds = [];
      for (const [sectionIndex, section] of resume.experienceSections.entries()) {
        pushError(
          errors,
          section && typeof section === 'object',
          `resume.experienceSections[${sectionIndex}] must be an object`
        );
        pushError(
          errors,
          isNonEmptyString(section?.heading),
          `resume.experienceSections[${sectionIndex}].heading is required`
        );
        pushError(
          errors,
          Array.isArray(section?.roleIds) &&
            section.roleIds.length > 0 &&
            section.roleIds.every(isNonEmptyString),
          `resume.experienceSections[${sectionIndex}].roleIds must be a non-empty string array`
        );
        if (Array.isArray(section?.roleIds)) {
          sectionRoleIds.push(...section.roleIds);
          pushError(
            errors,
            section.roleIds.every((roleId) => RESUME_ROLE_IDS.includes(roleId)),
            `resume.experienceSections[${sectionIndex}].roleIds contains an unknown role`
          );
        }
        pushError(
          errors,
          section?.pageBreakBefore === undefined ||
            typeof section.pageBreakBefore === 'boolean',
          `resume.experienceSections[${sectionIndex}].pageBreakBefore must be a boolean`
        );
      }
      pushError(
        errors,
        sectionRoleIds.length === RESUME_ROLE_IDS.length &&
          new Set(sectionRoleIds).size === RESUME_ROLE_IDS.length &&
          RESUME_ROLE_IDS.every((roleId) => sectionRoleIds.includes(roleId)),
        'resume.experienceSections must place every foundation role exactly once'
      );
    }
  }
  pushError(
    errors,
    resume.layoutDensity === undefined ||
      ['standard', 'compact'].includes(resume.layoutDensity),
    'resume.layoutDensity must be standard or compact'
  );
  pushError(
    errors,
    resume.portfolioLinkLabel === undefined ||
      isNonEmptyString(resume.portfolioLinkLabel),
    'resume.portfolioLinkLabel must be a non-empty string when present'
  );
  if (resume.roleContinuationBreaks !== undefined) {
    pushError(
      errors,
      Array.isArray(resume.roleContinuationBreaks) &&
        resume.roleContinuationBreaks.length >= 1 &&
        resume.roleContinuationBreaks.length <= RESUME_ROLE_IDS.length,
      'resume.roleContinuationBreaks must include 1 to 6 entries when present'
    );
    if (Array.isArray(resume.roleContinuationBreaks)) {
      const continuationRoleIds = [];
      for (const [index, continuation] of
        resume.roleContinuationBreaks.entries()) {
        const prefix = `resume.roleContinuationBreaks[${index}]`;
        const roleId = continuation?.roleId;
        const bulletCount = resumeRoleBulletTexts(resume, roleId).length;
        continuationRoleIds.push(roleId);
        pushError(
          errors,
          continuation && typeof continuation === 'object',
          `${prefix} must be an object`
        );
        pushError(
          errors,
          RESUME_ROLE_IDS.includes(roleId),
          `${prefix}.roleId contains an unknown role`
        );
        pushError(
          errors,
          resumeRoleSubEntries(resume, roleId) === null,
          `${prefix}.roleId cannot use per-agency sub-entries`
        );
        pushError(
          errors,
          Number.isInteger(continuation?.afterBullet) &&
            continuation.afterBullet >= 1 &&
            continuation.afterBullet < bulletCount,
          `${prefix}.afterBullet must leave at least one bullet before and after the break`
        );
      }
      pushError(
        errors,
        new Set(continuationRoleIds).size === continuationRoleIds.length,
        'resume.roleContinuationBreaks must not repeat a role'
      );
    }
  }
  if (resume.awards !== undefined) {
    pushError(
      errors,
      Array.isArray(resume.awards) &&
        resume.awards.length >= 1 &&
        resume.awards.length <= 5,
      'resume.awards must include 1 to 5 entries'
    );
    if (Array.isArray(resume.awards)) {
      for (const [awardIndex, award] of resume.awards.entries()) {
        pushError(
          errors,
          isNonEmptyString(award?.label),
          `resume.awards[${awardIndex}].label is required`
        );
        pushError(
          errors,
          isNonEmptyString(award?.detail),
          `resume.awards[${awardIndex}].detail is required`
        );
        pushError(
          errors,
          award?.href === undefined ||
            /^https:\/\//.test(award.href),
          `resume.awards[${awardIndex}].href must be an HTTPS URL`
        );
      }
    }
  }

  if (
    config.contractRevision !== 4 &&
    !usesFlexiblePositioningContract(config)
  ) {
    return;
  }

  let foundation;
  try {
    foundation = readResumeFoundation();
  } catch (error) {
    errors.push(`resume foundation could not be read: ${error.message}`);
    return;
  }

  pushError(
    errors,
    resume.foundationId === foundation.id,
    `resume.foundationId must be ${foundation.id}`
  );
  const currentFoundationVersion = Number.isInteger(foundation.foundationVersion)
    ? foundation.foundationVersion
    : 1;
  const requestedFoundationVersion = Number.isInteger(resume.foundationVersion)
    ? resume.foundationVersion
    : Math.min(2, currentFoundationVersion);
  pushError(
    errors,
    Number.isInteger(requestedFoundationVersion) &&
      requestedFoundationVersion >= 1 &&
      requestedFoundationVersion <= currentFoundationVersion,
    `resume.foundationVersion must be between 1 and ${currentFoundationVersion}`
  );
  if (requireCurrentContract && compositionMode === 'foundation-complete') {
    pushError(
      errors,
      resume.foundationVersion === currentFoundationVersion,
      `resume.foundationVersion must be ${currentFoundationVersion} for new or rebuilt foundation-complete packages`
    );
  }
  if (config.contractRevision === 4) {
    pushError(
      errors,
      resume.summary === foundation.summary,
      'resume.summary must match the fixed resume foundation; revision 4 allows bullet edits only'
    );
    pushError(
      errors,
      JSON.stringify(resume.skills) === JSON.stringify(foundation.skills),
      'resume.skills must match the fixed resume foundation; revision 4 allows bullet edits only'
    );
  } else {
    const skillBank = Array.isArray(foundation.skillBank)
      ? foundation.skillBank
      : [];
    const skillsById = new Map(skillBank.map((skill) => [skill.id, skill]));
    pushError(
      errors,
      !/\b(?:Wally|he|him|his)\b/i.test(resume.summary || ''),
      'resume.summary must use first person or an implied first-person professional identity'
    );
    pushError(
      errors,
      !DEFENSIVE_POSITIONING_PATTERN.test(resume.summary || ''),
      'resume.summary must not open with defensive or apologetic positioning'
    );
    pushError(
      errors,
      Array.isArray(resume.skillIds) &&
        resume.skillIds.length >= 4 &&
        resume.skillIds.length <= 6 &&
        resume.skillIds.every(isNonEmptyString),
      'resume.skillIds must select 4 to 6 foundation skills'
    );
    if (Array.isArray(resume.skillIds)) {
      pushError(
        errors,
        new Set(resume.skillIds).size === resume.skillIds.length,
        'resume.skillIds must not contain duplicates'
      );
      pushError(
        errors,
        resume.skillIds.every((skillId) => skillsById.has(skillId)),
        'resume.skillIds contains an unknown foundation skill'
      );
      const selectedSkills = resume.skillIds.map((skillId) => {
        const skill = skillsById.get(skillId);
        return skill
          ? { label: skill.label, description: skill.description }
          : null;
      });
      pushError(
        errors,
        JSON.stringify(resume.skills) === JSON.stringify(selectedSkills),
        'resume.skills must match the selected foundation skill definitions and order'
      );
    }
  }
  pushError(
    errors,
    resume.sourceBulletIds && typeof resume.sourceBulletIds === 'object',
    'resume.sourceBulletIds is required for revision 4'
  );

  const evidenceIdToRole = resumeEvidenceIdMap(foundation, profileRegistry);
  const resumeBase = config?.fitGate?.resumeBase;
  const accountProfile = profileRegistry?.profiles?.['account-leadership'];
  const selectedProfile =
    resumeBase?.mode === 'account-leadership'
      ? accountProfile
      : resumeBase?.mode === 'ai-product-implementation'
        ? profileRegistry?.profiles?.['ai-product-implementation']
        : null;
  const allMappedBulletIds = [];
  for (const roleId of RESUME_ROLE_IDS) {
    const roleBullets = resumeRoleBulletTexts(resume, roleId);
    const sourceBulletIds = resume.sourceBulletIds?.[roleId];
    const foundationBullets = foundation.roles?.[roleId];
    const foundationIds = Array.isArray(foundationBullets)
      ? foundationBullets.map((bullet) => bullet.id)
      : [];
    const requiredFoundationIds = foundationRoleIdsForVersion(
      foundation,
      roleId,
      requestedFoundationVersion
    );
    const foundationIdSet = new Set(foundationIds);
    const validAdditionId = (value) =>
      /^addition:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

    pushError(
      errors,
      Array.isArray(foundationBullets) && foundationBullets.length > 0,
      `resume foundation is missing role ${roleId}`
    );
    pushError(
      errors,
      Array.isArray(sourceBulletIds) &&
        sourceBulletIds.length === roleBullets?.length &&
        sourceBulletIds.every(isNonEmptyString),
      `resume.sourceBulletIds.${roleId} must map every tailored bullet`
    );
    if (!Array.isArray(sourceBulletIds)) {
      continue;
    }
    allMappedBulletIds.push(...sourceBulletIds);

    pushError(
      errors,
      new Set(sourceBulletIds).size === sourceBulletIds.length,
      `resume.sourceBulletIds.${roleId} must not contain duplicates`
    );
    pushError(
      errors,
      sourceBulletIds.every(
        (sourceId) =>
          foundationIdSet.has(sourceId) || validAdditionId(sourceId)
      ),
      `resume.sourceBulletIds.${roleId} contains an unknown source ID`
    );
    pushError(
      errors,
      sourceBulletIds.every(
        (sourceId) =>
          !evidenceIdToRole.has(sourceId) ||
          evidenceIdToRole.get(sourceId) === roleId
      ),
      `resume.sourceBulletIds.${roleId} moves approved evidence from its original job`
    );
    const retainedFoundationIds = sourceBulletIds.filter((sourceId) =>
      foundationIdSet.has(sourceId)
    );
    const retainedRequiredFoundationIds = retainedFoundationIds.filter(
      (sourceId) => requiredFoundationIds.includes(sourceId)
    );
    const requiredProfileIds = selectedProfile?.requiredSourceIds?.[roleId] || [];
    pushError(
      errors,
      config.contractRevision === 4
        ? JSON.stringify(retainedRequiredFoundationIds) ===
            JSON.stringify(requiredFoundationIds)
        : curatedResume
          ? retainedFoundationIds.length >= 1
        : profileComplete
          ? requiredProfileIds.every((sourceId) =>
              sourceBulletIds.includes(sourceId)
            )
        : hybridSelective
          ? roleId === 'one-block-away'
            ? foundationIds.every((sourceId) =>
                sourceBulletIds.includes(sourceId)
              )
            : retainedFoundationIds.length >= 1
        : retainedRequiredFoundationIds.length ===
            requiredFoundationIds.length &&
            requiredFoundationIds.every((sourceId) =>
              retainedRequiredFoundationIds.includes(sourceId)
            ),
      config.contractRevision === 4
        ? `resume.roles.${roleId} must retain every foundation bullet in source order; additions are allowed but removals are blocked`
        : curatedResume
          ? `resume.roles.${roleId} must retain at least one foundation bullet under its original job`
        : profileComplete
          ? `resume.roles.${roleId} must retain every required ${resumeBase?.mode || 'selected'} profile source ID exactly once`
        : hybridSelective
          ? roleId === 'one-block-away'
            ? 'hybrid-selective resumes must retain the complete One Block Away foundation section'
            : `hybrid-selective resumes must retain at least one foundation bullet under ${roleId}`
        : `resume.roles.${roleId} must retain every foundation bullet for version ${requestedFoundationVersion} exactly once within its original job; within-job reordering and additions are allowed`
    );
  }
  pushError(
    errors,
    new Set(allMappedBulletIds).size === allMappedBulletIds.length,
    'resume.sourceBulletIds must be unique across the full resume'
  );
  if (
    usesFlexiblePositioningContract(config) &&
    compositionMode === 'foundation-complete'
  ) {
    const foundationIds = RESUME_ROLE_IDS.flatMap((roleId) =>
      foundationRoleIdsForVersion(
        foundation,
        roleId,
        requestedFoundationVersion
      )
    );
    const mappedFoundationIds = allMappedBulletIds.filter(
      (sourceId) => !sourceId.startsWith('addition:')
    );
    pushError(
      errors,
      foundationIds.length > 0 &&
        new Set(foundationIds).size === foundationIds.length,
      `foundation-complete resumes require unique foundation version ${requestedFoundationVersion} bullet IDs`
    );
    pushError(
      errors,
      mappedFoundationIds.length === foundationIds.length &&
        foundationIds.every((sourceId) =>
          mappedFoundationIds.includes(sourceId)
        ),
      `foundation-complete resumes must retain all ${foundationIds.length} foundation version ${requestedFoundationVersion} bullet IDs exactly once`
    );
  }

  if (
    config.contractRevision === 7 &&
    (profileComplete || hybridSelective) &&
    agencyPresentation
  ) {
    const subEntries = resumeRoleSubEntries(resume, 'account-management');
    const expectedSubEntries = accountProfile?.accountSubEntries || [];
    pushError(
      errors,
      Array.isArray(subEntries) && subEntries.length === expectedSubEntries.length,
      'agency-progression resumes must preserve every approved account-history sub-entry'
    );
    if (Array.isArray(subEntries) && subEntries.length === expectedSubEntries.length) {
      const flatAccountIds = resume.sourceBulletIds?.['account-management'] || [];
      let sourceOffset = 0;
      for (const [index, subEntry] of subEntries.entries()) {
        const expected = expectedSubEntries[index];
        const selectedIds = flatAccountIds.slice(
          sourceOffset,
          sourceOffset + subEntry.bullets.length
        );
        sourceOffset += subEntry.bullets.length;
        for (const field of ['title', 'employer', 'location', 'dateRange']) {
          pushError(
            errors,
            (subEntry?.[field] ?? null) === (expected?.[field] ?? null),
            `resume.roles.account-management[${index}].${field} must match the approved account profile`
          );
        }
        const expectedIds = new Set(expected?.sourceIds || []);
        const approvedAccountIds = profileSourceIds(accountProfile);
        pushError(
          errors,
          selectedIds.every(
            (sourceId) =>
              !approvedAccountIds.has(sourceId) || expectedIds.has(sourceId)
          ),
          `resume.roles.account-management[${index}] moves approved evidence to the wrong agency entry`
        );
        if (profileComplete) {
          pushError(
            errors,
            [...expectedIds].every((sourceId) =>
              selectedIds.includes(sourceId)
            ),
            `resume.roles.account-management[${index}] must retain its complete approved account evidence`
          );
        } else {
          pushError(
            errors,
            selectedIds.some((sourceId) => expectedIds.has(sourceId)),
            `resume.roles.account-management[${index}] must retain evidence from its approved agency entry`
          );
        }
      }
    }
  }

  if (
    config.contractRevision === 7 &&
    hybridSelective &&
    !agencyPresentation
  ) {
    pushError(
      errors,
      resumeRoleSubEntries(resume, 'account-management') === null,
      'hybrid-selective consolidated account presentation must use the consolidated account block'
    );
  }
}

function validatePositioning(config, errors, foundation, profileRegistry = null) {
  if (!usesFlexiblePositioningContract(config)) {
    return;
  }
  const positioning = config.positioning;
  pushError(
    errors,
    positioning && typeof positioning === 'object',
    'positioning is required for revisions 5, 6, and 7'
  );
  if (!positioning || typeof positioning !== 'object') {
    return;
  }

  const laneIds = new Set(
    (foundation?.positioningLanes || []).map((lane) => lane.id)
  );
  const proofIds = new Set(
    resumeEvidenceIdMap(foundation, profileRegistry).keys()
  );
  const selectedResumeProofIds = mappedResumeIds(config?.resume);
  const skillIds = new Set(
    (foundation?.skillBank || []).map((skill) => skill.id)
  );
  pushError(
    errors,
    Array.isArray(foundation?.skillBank) && foundation.skillBank.length >= 4,
    'resume foundation must define an evidence-backed skill bank'
  );
  for (const [index, skill] of (foundation?.skillBank || []).entries()) {
    pushError(
      errors,
      isNonEmptyString(skill?.id) &&
        isNonEmptyString(skill?.label) &&
        isNonEmptyString(skill?.description),
      `resume foundation skillBank[${index}] is incomplete`
    );
    pushError(
      errors,
      Array.isArray(skill?.evidenceIds) &&
        skill.evidenceIds.length > 0 &&
        skill.evidenceIds.every((proofId) => proofIds.has(proofId)),
      `resume foundation skillBank[${index}].evidenceIds must reference foundation bullets`
    );
  }
  for (const [index, lane] of (
    foundation?.positioningLanes || []
  ).entries()) {
    pushError(
      errors,
      isNonEmptyString(lane?.id) &&
        Array.isArray(lane?.defaultSkillIds) &&
        lane.defaultSkillIds.length >= 4 &&
        lane.defaultSkillIds.every((skillId) => skillIds.has(skillId)),
      `resume foundation positioningLanes[${index}] has invalid default skills`
    );
    pushError(
      errors,
      Array.isArray(lane?.priorityProofIds) &&
        lane.priorityProofIds.length >= 2 &&
        lane.priorityProofIds.every((proofId) => proofIds.has(proofId)),
      `resume foundation positioningLanes[${index}] has invalid proof IDs`
    );
  }
  pushError(
    errors,
    Array.isArray(foundation?.assessmentPrepBank) &&
      foundation.assessmentPrepBank.length > 0,
    'resume foundation must define an assessment preparation bank'
  );
  for (const [index, competency] of (
    foundation?.assessmentPrepBank || []
  ).entries()) {
    pushError(
      errors,
      isNonEmptyString(competency?.id) &&
        isNonEmptyString(competency?.label) &&
        Array.isArray(competency?.proofIds) &&
        competency.proofIds.length >= 2 &&
        competency.proofIds.every((proofId) => proofIds.has(proofId)),
      `resume foundation assessmentPrepBank[${index}] is invalid`
    );
  }
  pushError(
    errors,
    isNonEmptyString(positioning.laneId) &&
      laneIds.has(positioning.laneId),
    'positioning.laneId must match a foundation positioning lane'
  );
  pushError(
    errors,
    positioning.laneId === config.classification?.targetLane,
    'positioning.laneId must match classification.targetLane'
  );
  for (const field of [
    'targetIdentity',
    'employerNeed',
    'bridgeThesis',
  ]) {
    pushError(
      errors,
      isNonEmptyString(positioning[field]),
      `positioning.${field} is required`
    );
  }
  pushError(
    errors,
    BRIDGE_TYPES.has(positioning.bridgeType),
    'positioning.bridgeType is invalid'
  );
  pushError(
    errors,
    APPLICATION_STRATEGIES.has(positioning.applicationStrategy),
    'positioning.applicationStrategy is invalid'
  );
  pushError(
    errors,
    Array.isArray(positioning.proofIds) &&
      positioning.proofIds.length >= 2 &&
      positioning.proofIds.length <= 3 &&
      positioning.proofIds.every(isNonEmptyString),
    'positioning.proofIds must include 2 to 3 foundation proof IDs'
  );
  if (Array.isArray(positioning.proofIds)) {
    pushError(
      errors,
      new Set(positioning.proofIds).size === positioning.proofIds.length,
      'positioning.proofIds must not contain duplicates'
    );
    pushError(
      errors,
      positioning.proofIds.every((proofId) => proofIds.has(proofId)),
      'positioning.proofIds contains an unknown foundation proof ID'
    );
    if (config.contractRevision === 7) {
      pushError(
        errors,
        positioning.proofIds.every((proofId) =>
          selectedResumeProofIds.has(proofId)
        ),
        'revision 7 positioning.proofIds must be present in the selected resume evidence'
      );
    }
  }
  pushError(
    errors,
    positioning.remainingGap === null ||
      isNonEmptyString(positioning.remainingGap),
    'positioning.remainingGap must be a non-empty string or null'
  );

  const transferBridge = new Set([
    'operating-center',
    'domain-transfer',
    'tool-transfer',
    'level-transfer',
  ]);
  if (config.fitClass === 'strong') {
    pushError(
      errors,
      positioning.bridgeType === 'direct' &&
        positioning.applicationStrategy === 'direct' &&
        positioning.remainingGap === null,
      'strong fits require direct positioning with no material remaining gap'
    );
  } else if (config.fitClass === 'adjacent') {
    pushError(
      errors,
      transferBridge.has(positioning.bridgeType) &&
        positioning.applicationStrategy === 'transferable' &&
        isNonEmptyString(positioning.remainingGap),
      'adjacent fits require a transferable bridge and a visible remaining gap'
    );
  } else if (config.fitClass === 'stretch') {
    pushError(
      errors,
      transferBridge.has(positioning.bridgeType) &&
        positioning.applicationStrategy === 'approved-stretch' &&
        isNonEmptyString(positioning.remainingGap),
      'stretch fits require an approved-stretch strategy and a visible remaining gap'
    );
  } else if (config.fitClass === 'not-fit') {
    pushError(
      errors,
      positioning.bridgeType === 'not-credible' &&
        positioning.applicationStrategy === 'stop' &&
        isNonEmptyString(positioning.remainingGap),
      'not-fit packages require stop and not-credible positioning'
    );
  }

  const normalizedSummary = normalizeText(config.resume?.summary);
  pushError(
    errors,
    normalizedSummary.includes(normalizeText(positioning.targetIdentity)),
    'resume.summary must name positioning.targetIdentity'
  );
  pushError(
    errors,
    normalizedSummary.includes(normalizeText(positioning.bridgeThesis)),
    'resume.summary must contain positioning.bridgeThesis'
  );
}

function validateCoverLetter(config, errors, foundation) {
  if (config.contractRevision !== 6 && config.contractRevision !== 7) {
    return;
  }

  const bridgeStatus = config.fitGate?.coverLetterBridge?.status;
  const coverLetter = config.coverLetter;
  const required = bridgeStatus === 'recommended';

  if (required) {
    pushError(
      errors,
      coverLetter && typeof coverLetter === 'object',
      'coverLetter is required when the cover-letter bridge is recommended'
    );
  }
  if (bridgeStatus === 'not-credible') {
    pushError(
      errors,
      coverLetter === null,
      'coverLetter must be null when the bridge is not credible'
    );
  }
  if (coverLetter === null || coverLetter === undefined) {
    if (
      (config.contractRevision === 6 || config.contractRevision === 7) &&
      coverLetter === undefined
    ) {
      errors.push('coverLetter must be explicitly set to an object or null');
    }
    return;
  }
  if (typeof coverLetter !== 'object' || Array.isArray(coverLetter)) {
    errors.push('coverLetter must be an object or null');
    return;
  }

  const allowedTriggers = new Set(['bridge-recommended', 'user-requested']);
  pushError(
    errors,
    allowedTriggers.has(coverLetter.trigger),
    'coverLetter.trigger must be bridge-recommended or user-requested'
  );
  if (required) {
    pushError(
      errors,
      coverLetter.trigger === 'bridge-recommended',
      'a recommended bridge must generate a bridge-recommended cover letter'
    );
  } else if (bridgeStatus === 'not-needed') {
    pushError(
      errors,
      coverLetter.trigger === 'user-requested',
      'a not-needed cover letter may be included only when explicitly requested'
    );
  }

  pushError(
    errors,
    /^\d{4}-\d{2}-\d{2}$/.test(coverLetter.date || '') &&
      !Number.isNaN(Date.parse(`${coverLetter.date}T00:00:00Z`)) &&
      new Date(`${coverLetter.date}T00:00:00Z`)
        .toISOString()
        .slice(0, 10) === coverLetter.date,
    'coverLetter.date must be a valid YYYY-MM-DD date'
  );
  for (const field of ['greeting', 'closing', 'signature']) {
    pushError(
      errors,
      isNonEmptyString(coverLetter[field]),
      `coverLetter.${field} is required`
    );
  }
  pushError(
    errors,
    Array.isArray(coverLetter.paragraphs) &&
      coverLetter.paragraphs.length >= 3 &&
      coverLetter.paragraphs.length <= 6 &&
      coverLetter.paragraphs.every(isNonEmptyString),
    'coverLetter.paragraphs must include 3 to 6 non-empty paragraphs'
  );
  if (Array.isArray(coverLetter.paragraphs)) {
    const letterWords = wordCount(
      [
        ...coverLetter.paragraphs,
        coverLetter.closing,
      ].join(' ')
    );
    pushError(
      errors,
      letterWords >= 200 && letterWords <= 500,
      'coverLetter body and closing must be 200 to 500 words'
    );
    pushError(
      errors,
      !DEFENSIVE_POSITIONING_PATTERN.test(coverLetter.paragraphs[0] || ''),
      'coverLetter must lead with the case, not defensive or apologetic positioning'
    );
  }

  const foundationProofIds = new Set(
    foundationBulletIdMap(foundation).keys()
  );
  pushError(
    errors,
    Array.isArray(coverLetter.proofIds) &&
      coverLetter.proofIds.length >= 2 &&
      coverLetter.proofIds.length <= 3 &&
      coverLetter.proofIds.every(isNonEmptyString),
    'coverLetter.proofIds must include 2 to 3 foundation proof IDs'
  );
  if (Array.isArray(coverLetter.proofIds)) {
    pushError(
      errors,
      new Set(coverLetter.proofIds).size === coverLetter.proofIds.length,
      'coverLetter.proofIds must not contain duplicates'
    );
    pushError(
      errors,
      coverLetter.proofIds.every((proofId) =>
        foundationProofIds.has(proofId)
      ),
      'coverLetter.proofIds contains an unknown foundation proof ID'
    );
    pushError(
      errors,
      coverLetter.proofIds.every((proofId) =>
        config.positioning?.proofIds?.includes(proofId)
      ),
      'coverLetter.proofIds must come from positioning.proofIds'
    );
  }
}

export function validateV2Config(
  config,
  { requireCurrentContract = false } = {}
) {
  const errors = [];
  const fitClasses = new Set(['strong', 'adjacent', 'stretch', 'not-fit']);
  const routeModes = new Set(['canonical-projects', 'scoped-projects']);
  const evidenceModes = new Set([
    'portfolio-primary',
    'balanced',
    'resume-primary',
    'credential-or-technical-primary',
  ]);
  const hardGateStatuses = new Set(['pass', 'uncertain', 'fail']);
  const individualGateStatuses = new Set(['pass', 'uncertain', 'fail', 'not-applicable']);
  const coverLetterBridgeStatuses = new Set([
    'not-needed',
    'recommended',
    'not-credible',
  ]);

  pushError(errors, config?.workflowVersion === WORKFLOW_VERSION, `workflowVersion must be ${WORKFLOW_VERSION}`);
  pushError(
    errors,
    config?.contractRevision === undefined ||
      SUPPORTED_CONTRACT_REVISIONS.has(config?.contractRevision),
    'contractRevision must be 2, 3, 4, 5, 6, or 7 when present'
  );
  if (requireCurrentContract) {
    pushError(
      errors,
      config?.contractRevision === CURRENT_CONTRACT_REVISION,
      `contractRevision must be ${CURRENT_CONTRACT_REVISION} for new or rebuilt packages`
    );
  }
  pushError(errors, isNonEmptyString(config?.slug), 'slug is required');
  pushError(errors, config?.slug === slugify(config?.slug || ''), 'slug must already be lowercase kebab-case');
  pushError(errors, isNonEmptyString(config?.roleTitle), 'roleTitle is required');
  pushError(errors, isNonEmptyString(config?.artifactStem), 'artifactStem is required');
  pushError(errors, /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/.test(config?.artifactStem || ''), 'artifactStem must contain only letters, numbers, and hyphens');
  pushError(errors, fitClasses.has(config?.fitClass), 'fitClass must be strong, adjacent, stretch, or not-fit');
  pushError(errors, routeModes.has(config?.routeMode), 'routeMode must be canonical-projects or scoped-projects');
  pushError(errors, Array.isArray(config?.selectedProjects) && config.selectedProjects.length >= 3 && config.selectedProjects.length <= 5, 'selectedProjects must include 3 to 5 projects');
  if (Array.isArray(config?.selectedProjects)) {
    pushError(
      errors,
      new Set(config.selectedProjects).size === config.selectedProjects.length,
      'selectedProjects must not contain duplicates'
    );
    for (const project of config.selectedProjects) {
      pushError(errors, /^project-\d+\.html$/.test(project), `invalid selected project: ${project}`);
    }
  }

  const job = config?.job;
  pushError(errors, job && typeof job === 'object', 'job is required');
  for (const field of ['company', 'roleTitle', 'sourceChannel', 'dateCaptured', 'rawJd']) {
    pushError(errors, isNonEmptyString(job?.[field]), `job.${field} is required`);
  }

  const classification = config?.classification;
  pushError(errors, classification && typeof classification === 'object', 'classification is required');
  pushError(errors, isNonEmptyString(classification?.targetLane), 'classification.targetLane is required');
  pushError(errors, evidenceModes.has(classification?.evidenceMode), 'classification.evidenceMode is invalid');
  pushError(errors, isNonEmptyString(classification?.primarySource), 'classification.primarySource is required');
  pushError(errors, isNonEmptyString(classification?.supportingSource), 'classification.supportingSource is required');
  pushError(errors, hardGateStatuses.has(classification?.hardGateStatus), 'classification.hardGateStatus must be pass, uncertain, or fail');
  pushError(errors, Array.isArray(classification?.hardGates) && classification.hardGates.length > 0, 'classification.hardGates must be non-empty');
  if (Array.isArray(classification?.hardGates)) {
    for (const [index, gate] of classification.hardGates.entries()) {
      pushError(errors, isNonEmptyString(gate?.gate), `classification.hardGates[${index}].gate is required`);
      pushError(errors, individualGateStatuses.has(gate?.status), `classification.hardGates[${index}].status is invalid`);
      pushError(errors, isNonEmptyString(gate?.evidence), `classification.hardGates[${index}].evidence is required`);
    }
    pushError(
      errors,
      classification?.hardGateStatus === deriveHardGateStatus(classification.hardGates),
      `classification.hardGateStatus must match the individual gates (${deriveHardGateStatus(classification.hardGates)})`
    );
  }

  const fitGate = config?.fitGate;
  pushError(errors, fitGate && typeof fitGate === 'object', 'fitGate is required');
  for (const field of ['supportedOverlap', 'unsupportedRequirements', 'actualMismatches', 'missingEvidence']) {
    pushError(errors, isStringArray(fitGate?.[field]), `fitGate.${field} must be a string array`);
  }
  pushError(errors, fitGate?.supportedOverlap?.length > 0, 'fitGate.supportedOverlap must be non-empty');
  pushError(errors, isNonEmptyString(fitGate?.recommendation), 'fitGate.recommendation is required');

  const coverLetterBridge = fitGate?.coverLetterBridge;
  const shouldValidateCoverLetterBridge =
    requireCurrentContract ||
    SUPPORTED_CONTRACT_REVISIONS.has(config?.contractRevision) ||
    coverLetterBridge !== undefined;
  if (
    requireCurrentContract ||
    SUPPORTED_CONTRACT_REVISIONS.has(config?.contractRevision)
  ) {
    pushError(
      errors,
      coverLetterBridge && typeof coverLetterBridge === 'object',
      'fitGate.coverLetterBridge is required'
    );
  }
  if (shouldValidateCoverLetterBridge) {
    pushError(
      errors,
      coverLetterBridge && typeof coverLetterBridge === 'object',
      'fitGate.coverLetterBridge must be an object'
    );
    pushError(
      errors,
      coverLetterBridgeStatuses.has(coverLetterBridge?.status),
      'fitGate.coverLetterBridge.status must be not-needed, recommended, or not-credible'
    );
    pushError(
      errors,
      isNonEmptyString(coverLetterBridge?.rationale),
      'fitGate.coverLetterBridge.rationale is required'
    );
    if (coverLetterBridge?.status === 'recommended') {
      pushError(
        errors,
        config?.fitClass === 'adjacent' || config?.fitClass === 'stretch',
        'a recommended cover-letter bridge is only valid for adjacent or stretch fits'
      );
      pushError(
        errors,
        classification?.hardGateStatus === 'pass' &&
          deriveHardGateStatus(classification?.hardGates) === 'pass',
        'a cover-letter bridge cannot be recommended unless every hard gate passes'
      );
      pushError(
        errors,
        /cover letter/i.test(coverLetterBridge?.rationale || ''),
        'a recommended cover-letter bridge rationale must explicitly mention a cover letter'
      );
    }
    if (config?.fitClass === 'strong') {
      pushError(
        errors,
        coverLetterBridge?.status === 'not-needed',
        'strong fits must use a not-needed cover-letter bridge'
      );
    }
    if (config?.fitClass === 'adjacent' || config?.fitClass === 'stretch') {
      pushError(
        errors,
        coverLetterBridge?.status === 'recommended' ||
          coverLetterBridge?.status === 'not-credible',
        'adjacent and stretch fits must use a recommended or not-credible cover-letter bridge'
      );
    }
    if (config?.fitClass === 'not-fit') {
      pushError(
        errors,
        coverLetterBridge?.status === 'not-credible',
        'not-fit packages must use a not-credible cover-letter bridge'
      );
    }
  }

  let foundation = null;
  let profileRegistry = null;
  if (usesFlexiblePositioningContract(config)) {
    try {
      foundation = readResumeFoundation();
    } catch (error) {
      errors.push(`resume foundation could not be read: ${error.message}`);
    }
  }
  if (config?.contractRevision === 7) {
    try {
      profileRegistry = readResumeBaseProfiles();
    } catch (error) {
      errors.push(`resume base profiles could not be read: ${error.message}`);
    }
  }

  validateResumeBaseGate(config, errors, foundation, profileRegistry);
  validateRequirements(config, errors, foundation);
  validateResume(config, errors, profileRegistry, { requireCurrentContract });
  validatePositioning(config, errors, foundation, profileRegistry);
  validateCoverLetter(config, errors, foundation);

  if (
    usesFlexiblePositioningContract(config) &&
    Array.isArray(classification?.hardGates)
  ) {
    const requirementsById = new Map(
      (config.requirements || []).map((requirement) => [
        requirement.id,
        requirement,
      ])
    );
    for (const [index, gate] of classification.hardGates.entries()) {
      const requirement = requirementsById.get(gate?.requirementId);
      pushError(
        errors,
        isNonEmptyString(gate?.requirementId) && Boolean(requirement),
        `classification.hardGates[${index}].requirementId must reference a requirement`
      );
      if (!requirement) {
        continue;
      }
      pushError(
        errors,
        requirement.priority === 'hard-gate',
        `classification.hardGates[${index}] must reference a hard-gate requirement`
      );
      if (gate.status === 'fail') {
        pushError(
          errors,
          requirement.confidence === 'explicit',
          `classification.hardGates[${index}] cannot fail on an ambiguous or contextual requirement`
        );
        pushError(
          errors,
          requirement.evidenceStatus === 'none',
          `classification.hardGates[${index}] can fail only when its requirement is unsupported`
        );
      }
      if (gate.status === 'pass') {
        pushError(
          errors,
          requirement.evidenceStatus !== 'none',
          `classification.hardGates[${index}] cannot pass when its requirement is unsupported`
        );
      }
      if (
        requirement.confidence === 'explicit' &&
        requirement.evidenceStatus === 'none'
      ) {
        pushError(
          errors,
          gate.status === 'fail',
          `classification.hardGates[${index}] must fail for an explicit unsupported hard-gate requirement`
        );
      }
    }
    const gateRequirementIds = classification.hardGates
      .map((gate) => gate?.requirementId)
      .filter(isNonEmptyString);
    pushError(
      errors,
      new Set(gateRequirementIds).size === gateRequirementIds.length,
      'classification.hardGates[].requirementId must be unique'
    );
    const hardRequirementIds = (config.requirements || [])
      .filter((requirement) => requirement.priority === 'hard-gate')
      .map((requirement) => requirement.id);
    pushError(
      errors,
      hardRequirementIds.length === gateRequirementIds.length &&
        hardRequirementIds.every((requirementId) =>
          gateRequirementIds.includes(requirementId)
        ),
      'every hard-gate requirement must have exactly one classification hard gate'
    );

    if (config.fitClass === 'not-fit') {
      const explicitStructuralGap = (config.requirements || []).some(
        (requirement) =>
          requirement.confidence === 'explicit' &&
          (requirement.priority === 'hard-gate' ||
            requirement.priority === 'core') &&
          requirement.evidenceStatus === 'none'
      );
      pushError(
        errors,
        explicitStructuralGap,
        'not-fit requires an explicit unsupported hard gate or core operating-center requirement; ambiguous requirements cannot independently produce not-fit'
      );
    }
  }

  const hero = config?.hero;
  pushError(errors, hero && typeof hero === 'object', 'hero is required');
  pushError(errors, isNonEmptyString(hero?.eyebrow), 'hero.eyebrow is required');
  pushError(errors, Array.isArray(hero?.tags) && hero.tags.length >= 2, 'hero.tags must include at least two entries');
  pushError(errors, isNonEmptyString(hero?.intro), 'hero.intro is required');
  if (isNonEmptyString(hero?.intro)) {
    pushError(errors, !/\b(?:Wally|he|him|his)\b/i.test(hero.intro), 'hero.intro must use first person');
    if (usesFlexiblePositioningContract(config)) {
      const heroWordCount = wordCount(hero.intro);
      const usesSupportingShowcaseHero =
        config.contractRevision === CURRENT_CONTRACT_REVISION &&
        config.route?.presentation === 'showcase';
      if (usesSupportingShowcaseHero) {
        pushError(
          errors,
          heroWordCount >= 20 && heroWordCount <= 70,
          'showcase hero.intro must be 20 to 70 words'
        );
      } else {
        pushError(
          errors,
          heroWordCount >= 45 &&
            (config.contractRevision !== 7 || heroWordCount <= 70),
          config.contractRevision === 7
            ? 'hero.intro must be 45 to 70 words for revision 7'
            : 'hero.intro must be at least 45 words for revisions 5 and 6'
        );
      }
      pushError(
        errors,
        !DEFENSIVE_POSITIONING_PATTERN.test(hero.intro),
        'hero.intro must not use defensive or apologetic positioning'
      );
      pushError(
        errors,
        normalizeText(hero.intro) !== normalizeText(config.resume?.summary),
        'hero.intro must not duplicate resume.summary'
      );
      if (!usesSupportingShowcaseHero) {
        pushError(
          errors,
          normalizeText(hero.intro).includes(
            normalizeText(config.positioning?.bridgeThesis)
          ),
          'hero.intro must contain positioning.bridgeThesis'
        );
      }
    }
  }

  const contact = config?.contact;
  pushError(errors, contact && typeof contact === 'object', 'contact is required');
  pushError(errors, isNonEmptyString(contact?.prompt), 'contact.prompt is required');
  pushError(errors, /email/i.test(contact?.prompt || ''), 'contact.prompt must make email the clear next step');
  pushError(errors, isNonEmptyString(contact?.signoff), 'contact.signoff is required');

  const route = config?.route;
  if (route !== undefined) {
    pushError(errors, route && typeof route === 'object', 'route must be an object');
    if (route && typeof route === 'object') {
      pushError(
        errors,
        route.presentation === undefined ||
          ['full', 'showcase'].includes(route.presentation),
        'route.presentation must be full or showcase'
      );
      pushError(
        errors,
        route.heroIntent === undefined || route.heroIntent === 'resume-support',
        'route.heroIntent must be resume-support when present'
      );
      pushError(
        errors,
        route.heroIntent !== 'resume-support' ||
          route.presentation === 'showcase',
        'route.heroIntent resume-support requires route.presentation showcase'
      );
      pushError(
        errors,
        route.projectCardStats === undefined ||
          ['visible', 'hidden'].includes(route.projectCardStats),
        'route.projectCardStats must be visible or hidden when present'
      );
      pushError(
        errors,
        route.workHeading === undefined || isNonEmptyString(route.workHeading),
        'route.workHeading must be a non-empty string when present'
      );
      pushError(
        errors,
        route.contactHeading === undefined ||
          isNonEmptyString(route.contactHeading),
        'route.contactHeading must be a non-empty string when present'
      );
      const projectAliases = route.projectAliases;
      pushError(
        errors,
        projectAliases === undefined ||
          (projectAliases &&
            typeof projectAliases === 'object' &&
            !Array.isArray(projectAliases) &&
            Object.keys(projectAliases).length > 0),
        'route.projectAliases must be a non-empty object when present'
      );
      if (
        projectAliases &&
        typeof projectAliases === 'object' &&
        !Array.isArray(projectAliases)
      ) {
        const selectedProjects = Array.isArray(config.selectedProjects)
          ? config.selectedProjects
          : [];
        pushError(
          errors,
          config.routeMode === 'scoped-projects',
          'route.projectAliases requires routeMode scoped-projects'
        );
        for (const [project, alias] of Object.entries(projectAliases)) {
          pushError(
            errors,
            selectedProjects.includes(project),
            `route.projectAliases references an unselected project: ${project}`
          );
          pushError(
            errors,
            /^project-\d+\.html$/.test(alias),
            `route.projectAliases.${project} must be a project HTML filename`
          );
        }
        const scopedFilenames = scopedProjectEntries(config).map(
          ({ output }) => output
        );
        pushError(
          errors,
          new Set(scopedFilenames).size === scopedFilenames.length,
          'route.projectAliases must produce unique scoped project filenames'
        );
        const redirectSources = scopedProjectRedirectEntries(config).map(
          ({ source }) => source
        );
        pushError(
          errors,
          redirectSources.every(
            (source) => !scopedFilenames.includes(source)
          ),
          'route.projectAliases redirect paths must not collide with scoped project filenames'
        );
      }
      const projectAssetOverrides = route.projectAssetOverrides;
      pushError(
        errors,
        projectAssetOverrides === undefined ||
          (projectAssetOverrides &&
            typeof projectAssetOverrides === 'object' &&
            !Array.isArray(projectAssetOverrides)),
        'route.projectAssetOverrides must be an object when present'
      );
      if (
        projectAssetOverrides &&
        typeof projectAssetOverrides === 'object' &&
        !Array.isArray(projectAssetOverrides)
      ) {
        pushError(
          errors,
          config.routeMode === 'scoped-projects',
          'route.projectAssetOverrides requires routeMode scoped-projects'
        );
        for (const [project, overrides] of Object.entries(
          projectAssetOverrides
        )) {
          pushError(
            errors,
            config.selectedProjects?.includes(project),
            `route.projectAssetOverrides references an unselected project: ${project}`
          );
          pushError(
            errors,
            overrides &&
              typeof overrides === 'object' &&
              !Array.isArray(overrides) &&
              Object.keys(overrides).length > 0,
            `route.projectAssetOverrides.${project} must be a non-empty object`
          );
          if (
            overrides &&
            typeof overrides === 'object' &&
            !Array.isArray(overrides)
          ) {
            for (const [sourceAsset, replacementAsset] of Object.entries(
              overrides
            )) {
              pushError(
                errors,
                /^assets\/[^\s]+$/.test(sourceAsset) &&
                  !sourceAsset.split('/').includes('..'),
                `invalid scoped project source asset: ${sourceAsset}`
              );
              pushError(
                errors,
                /^assets\/[^\s]+$/.test(replacementAsset) &&
                  !replacementAsset.split('/').includes('..'),
                `invalid scoped project replacement asset: ${replacementAsset}`
              );
            }
          }
        }
      }
      const projectStatRemovals = route.projectStatRemovals;
      pushError(
        errors,
        projectStatRemovals === undefined ||
          (projectStatRemovals &&
            typeof projectStatRemovals === 'object' &&
            !Array.isArray(projectStatRemovals)),
        'route.projectStatRemovals must be an object when present'
      );
      if (
        projectStatRemovals &&
        typeof projectStatRemovals === 'object' &&
        !Array.isArray(projectStatRemovals)
      ) {
        pushError(
          errors,
          config.routeMode === 'scoped-projects',
          'route.projectStatRemovals requires routeMode scoped-projects'
        );
        for (const [project, removals] of Object.entries(
          projectStatRemovals
        )) {
          pushError(
            errors,
            config.selectedProjects?.includes(project),
            `route.projectStatRemovals references an unselected project: ${project}`
          );
          pushError(
            errors,
            Array.isArray(removals) &&
              removals.length > 0 &&
              removals.every(isNonEmptyString) &&
              new Set(removals).size === removals.length,
            `route.projectStatRemovals.${project} must be a non-empty array of unique strings`
          );
        }
      }
      const projectFullWidthSections = route.projectFullWidthSections;
      pushError(
        errors,
        projectFullWidthSections === undefined ||
          (projectFullWidthSections &&
            typeof projectFullWidthSections === 'object' &&
            !Array.isArray(projectFullWidthSections)),
        'route.projectFullWidthSections must be an object when present'
      );
      if (
        projectFullWidthSections &&
        typeof projectFullWidthSections === 'object' &&
        !Array.isArray(projectFullWidthSections)
      ) {
        pushError(
          errors,
          config.routeMode === 'scoped-projects',
          'route.projectFullWidthSections requires routeMode scoped-projects'
        );
        for (const [project, sections] of Object.entries(
          projectFullWidthSections
        )) {
          pushError(
            errors,
            config.selectedProjects?.includes(project),
            `route.projectFullWidthSections references an unselected project: ${project}`
          );
          pushError(
            errors,
            Array.isArray(sections) &&
              sections.length > 0 &&
              sections.every(
                (section) =>
                  section &&
                  typeof section === 'object' &&
                  !Array.isArray(section) &&
                  Object.keys(section).every((key) =>
                    ['asset', 'copyMode'].includes(key)
                  ) &&
                  /^assets\/[^\s]+$/.test(section.asset) &&
                  !section.asset.split('/').includes('..') &&
                  section.copyMode === 'heading-only'
              ) &&
              new Set(sections.map((section) => section.asset)).size ===
                sections.length,
            `route.projectFullWidthSections.${project} must be a non-empty array of unique safe section definitions`
          );
        }
      }
      const projectFigureRemovals = route.projectFigureRemovals;
      pushError(
        errors,
        projectFigureRemovals === undefined ||
          (projectFigureRemovals &&
            typeof projectFigureRemovals === 'object' &&
            !Array.isArray(projectFigureRemovals)),
        'route.projectFigureRemovals must be an object when present'
      );
      if (
        projectFigureRemovals &&
        typeof projectFigureRemovals === 'object' &&
        !Array.isArray(projectFigureRemovals)
      ) {
        pushError(
          errors,
          config.routeMode === 'scoped-projects',
          'route.projectFigureRemovals requires routeMode scoped-projects'
        );
        for (const [project, removals] of Object.entries(
          projectFigureRemovals
        )) {
          pushError(
            errors,
            config.selectedProjects?.includes(project),
            `route.projectFigureRemovals references an unselected project: ${project}`
          );
          pushError(
            errors,
            Array.isArray(removals) &&
              removals.length > 0 &&
              removals.every(
                (asset) =>
                  /^assets\/[^\s]+$/.test(asset) &&
                  !asset.split('/').includes('..')
              ) &&
              new Set(removals).size === removals.length,
            `route.projectFigureRemovals.${project} must be a non-empty array of unique safe asset paths`
          );
        }
      }
      const projectPullquoteOverrides = route.projectPullquoteOverrides;
      pushError(
        errors,
        projectPullquoteOverrides === undefined ||
          (projectPullquoteOverrides &&
            typeof projectPullquoteOverrides === 'object' &&
            !Array.isArray(projectPullquoteOverrides)),
        'route.projectPullquoteOverrides must be an object when present'
      );
      if (
        projectPullquoteOverrides &&
        typeof projectPullquoteOverrides === 'object' &&
        !Array.isArray(projectPullquoteOverrides)
      ) {
        pushError(
          errors,
          config.routeMode === 'scoped-projects',
          'route.projectPullquoteOverrides requires routeMode scoped-projects'
        );
        for (const [project, pullquote] of Object.entries(
          projectPullquoteOverrides
        )) {
          pushError(
            errors,
            config.selectedProjects?.includes(project),
            `route.projectPullquoteOverrides references an unselected project: ${project}`
          );
          pushError(
            errors,
            isNonEmptyString(pullquote),
            `route.projectPullquoteOverrides.${project} must be a non-empty string`
          );
        }
      }
      const projectVideoInsertions = route.projectVideoInsertions;
      pushError(
        errors,
        projectVideoInsertions === undefined ||
          (projectVideoInsertions &&
            typeof projectVideoInsertions === 'object' &&
            !Array.isArray(projectVideoInsertions)),
        'route.projectVideoInsertions must be an object when present'
      );
      if (
        projectVideoInsertions &&
        typeof projectVideoInsertions === 'object' &&
        !Array.isArray(projectVideoInsertions)
      ) {
        pushError(
          errors,
          config.routeMode === 'scoped-projects',
          'route.projectVideoInsertions requires routeMode scoped-projects'
        );
        const isSafeRepoAsset = (assetPath) =>
          isNonEmptyString(assetPath) &&
          !assetPath.startsWith('/') &&
          !assetPath.split('/').includes('..');
        for (const [project, video] of Object.entries(
          projectVideoInsertions
        )) {
          pushError(
            errors,
            config.selectedProjects?.includes(project),
            `route.projectVideoInsertions references an unselected project: ${project}`
          );
          pushError(
            errors,
            video && typeof video === 'object' && !Array.isArray(video),
            `route.projectVideoInsertions.${project} must be an object`
          );
          if (video && typeof video === 'object' && !Array.isArray(video)) {
            pushError(
              errors,
              isSafeRepoAsset(video.src) && /\.mp4$/i.test(video.src),
              `route.projectVideoInsertions.${project}.src must be a safe MP4 path`
            );
            pushError(
              errors,
              video.poster === undefined ||
                (isSafeRepoAsset(video.poster) &&
                  /\.(?:jpe?g|png|webp)$/i.test(video.poster)),
              `route.projectVideoInsertions.${project}.poster must be a safe image path when present`
            );
            pushError(
              errors,
              video.placement === 'inside-section-before-pullquote',
              `route.projectVideoInsertions.${project}.placement must be inside-section-before-pullquote`
            );
          }
        }
      }
    }
  }
  if (requireCurrentContract) {
    pushError(
      errors,
      route && typeof route === 'object' &&
        ['full', 'showcase'].includes(route.presentation),
      'route.presentation must be explicitly set to full or showcase for new or rebuilt packages'
    );
    pushError(
      errors,
      route?.presentation !== 'showcase' ||
        route?.heroIntent === 'resume-support',
      'showcase routes require route.heroIntent resume-support for new or rebuilt packages'
    );
  }
  pushError(
    errors,
    !requireCurrentContract ||
      getRoutePresentation(config) !== 'showcase' ||
      config?.routeMode === 'scoped-projects',
    'route.presentation showcase requires routeMode scoped-projects'
  );

  const constraints = config?.constraints;
  pushError(errors, constraints && typeof constraints === 'object', 'constraints is required');
  pushError(errors, isStringArray(constraints?.doNotClaim), 'constraints.doNotClaim must be a string array');
  pushError(errors, isStringArray(constraints?.blockedTerms), 'constraints.blockedTerms must be a string array');

  const privacy = config?.privacy;
  pushError(errors, privacy && typeof privacy === 'object', 'privacy is required');
  pushError(errors, privacy?.publicSafe === true, 'privacy.publicSafe must be true before a config can be committed');
  pushError(errors, isNonEmptyString(privacy?.notes), 'privacy.notes is required');

  const copyReview = config?.copyReview;
  const shouldValidateCopyReview =
    requireCurrentContract ||
    config?.contractRevision === CURRENT_CONTRACT_REVISION ||
    copyReview !== undefined;
  if (
    requireCurrentContract ||
    config?.contractRevision === CURRENT_CONTRACT_REVISION
  ) {
    pushError(
      errors,
      copyReview && typeof copyReview === 'object',
      'copyReview is required for the current contract revision'
    );
  }
  if (shouldValidateCopyReview) {
    pushError(
      errors,
      copyReview && typeof copyReview === 'object',
      'copyReview must be an object'
    );
    pushError(
      errors,
      copyReview?.humanizerVersion === HUMANIZER_VERSION,
      `copyReview.humanizerVersion must be ${HUMANIZER_VERSION}`
    );
    pushError(
      errors,
      copyReview?.mode === 'surface-only' ||
        copyReview?.mode === 'rewrite-requested',
      'copyReview.mode must be surface-only or rewrite-requested'
    );
    pushError(
      errors,
      copyReview?.status === 'pending' || copyReview?.status === 'passed',
      'copyReview.status must be pending or passed'
    );
    pushError(
      errors,
      Array.isArray(copyReview?.preserved) &&
        copyReview.preserved.every(isNonEmptyString),
      'copyReview.preserved must be a string array'
    );
    pushError(
      errors,
      Array.isArray(copyReview?.remainingTells) &&
        copyReview.remainingTells.every(isNonEmptyString),
      'copyReview.remainingTells must be a string array'
    );
    pushError(
      errors,
      copyReview?.reviewMethod === 'humanizer-skill',
      'copyReview.reviewMethod must be humanizer-skill'
    );
    pushError(
      errors,
      typeof copyReview?.semanticPassAttested === 'boolean',
      'copyReview.semanticPassAttested must be boolean'
    );
    pushError(
      errors,
      typeof copyReview?.staticChecksPassed === 'boolean',
      'copyReview.staticChecksPassed must be boolean'
    );
    if (copyReview?.status === 'passed') {
      pushError(
        errors,
        copyReview?.mode !== 'rewrite-requested' ||
          copyReview?.rewriteAuthorized === true,
        'rewrite-requested mode requires explicit authorization'
      );
      pushError(
        errors,
        isStrictReviewTimestamp(copyReview?.reviewedAt),
        'copyReview.reviewedAt must be a canonical ISO timestamp and cannot be in the future'
      );
      pushError(
        errors,
        /^[a-f0-9]{64}$/.test(copyReview?.copySha256 || ''),
        'copyReview.copySha256 must be a SHA-256 checksum'
      );
      pushError(
        errors,
        copyReview?.copySha256 === humanizerCopySha256(config),
        'copyReview.copySha256 is stale; run the humanizer pass again'
      );
      pushError(
        errors,
        (copyReview?.mode === 'surface-only'
          ? ['content', 'structure', 'claims', 'ending']
          : ['claims']
        ).every((item) => copyReview?.preserved?.includes(item)),
        copyReview?.mode === 'surface-only'
          ? 'copyReview.preserved must include content, structure, claims, and ending'
          : 'copyReview.preserved must include claims'
      );
      pushError(
        errors,
        copyReview?.reviewMethod === 'humanizer-skill' &&
          copyReview?.semanticPassAttested === true,
        'copyReview must attest that the full humanizer skill pass was completed'
      );
      pushError(
        errors,
        copyReview?.staticChecksPassed === true,
        'copyReview.staticChecksPassed must be true'
      );
      pushError(
        errors,
        copyReview?.finalAntiAiPass === true,
        'copyReview.finalAntiAiPass must be true'
      );
      pushError(
        errors,
        copyReview?.remainingTells?.length === 0,
        'copyReview.remainingTells must be empty after the final revision'
      );
    }
  }

  pushError(errors, config?.qa && typeof config.qa === 'object', 'qa is required');
  return errors;
}

export function assertValidV2Config(config, options) {
  const errors = validateV2Config(config, options);
  if (errors.length) {
    throw new Error(`Invalid v2 package config:\n- ${errors.join('\n- ')}`);
  }
}

export function assertBuildAllowed(
  config,
  { allowStretch = false, allowExistingRefresh = false } = {}
) {
  if (
    config?.contractRevision === 7 &&
    config?.fitGate?.resumeBase?.action === 'use-existing' &&
    !(
      allowExistingRefresh &&
      isGeneralNetworkingJob(config?.job)
    )
  ) {
    const profileId = config.fitGate.resumeBase.leadProfileId;
    const profile = readResumeBaseProfiles().profiles?.[profileId];
    throw new Error(
      `Resume-base gate selected use-existing. Use ${profile?.generalArtifact?.resumePdfPath || profileId} without generating a new package.`
    );
  }
  const derivedHardGateStatus = deriveHardGateStatus(
    config.classification.hardGates
  );
  if (
    config.classification.hardGateStatus === 'fail' ||
    derivedHardGateStatus === 'fail'
  ) {
    throw new Error('Hard-screen gate failed. No files were generated.');
  }
  if (
    config.classification.hardGateStatus === 'uncertain' ||
    derivedHardGateStatus === 'uncertain'
  ) {
    throw new Error('Hard-screen gate is unresolved. Resolve it before generating files.');
  }
  if (config.fitClass === 'not-fit') {
    throw new Error(`Fit gate is not-fit. ${config.fitGate.recommendation}`);
  }
  if (config.fitClass === 'stretch' && !allowStretch) {
    throw new Error('Fit gate is stretch. Re-run with --allow-stretch only after explicit approval.');
  }
  if (
    usesFlexiblePositioningContract(config) &&
    config.positioning?.applicationStrategy === 'stop'
  ) {
    throw new Error('Application strategy is stop. No files were generated.');
  }
}

export function recruiterFacingClaimViolations(config) {
  const recruiterFacingCopy = [
    ...(usesFlexiblePositioningContract(config)
      ? [
          ['resume.summary', config.resume.summary],
          ...(config.resume.portfolioLinkLabel
            ? [
                [
                  'resume.portfolioLinkLabel',
                  config.resume.portfolioLinkLabel,
                ],
              ]
            : []),
          ...config.resume.skills.flatMap((skill, index) => [
            [`resume.skills[${index}].label`, skill.label],
            [`resume.skills[${index}].description`, skill.description],
          ]),
          ...(config.resume.experienceSections || []).map((section, index) => [
            `resume.experienceSections[${index}].heading`,
            section.heading,
          ]),
          ...(config.resume.awards || []).flatMap((award, index) => [
            [`resume.awards[${index}].label`, award.label],
            [`resume.awards[${index}].detail`, award.detail],
          ]),
          ...RESUME_ROLE_IDS.flatMap((roleId) => {
            const subEntries = resumeRoleSubEntries(config.resume, roleId);
            const titleEntries = subEntries
              ? subEntries.map((subEntry, subIndex) => [
                  `resume.roles.${roleId}[${subIndex}].title`,
                  subEntry.title,
                ])
              : [];
            return [
              ...titleEntries,
              ...resumeRoleBulletTexts(config.resume, roleId).map(
                (bullet, index) => [`resume.roles.${roleId}[${index}]`, bullet]
              ),
            ];
          }),
        ]
      : []),
    ...(hasCoverLetterArtifact(config)
      ? [
          ['coverLetter.greeting', config.coverLetter.greeting],
          ...config.coverLetter.paragraphs.map((paragraph, index) => [
            `coverLetter.paragraphs[${index}]`,
            paragraph,
          ]),
          ['coverLetter.closing', config.coverLetter.closing],
          ['coverLetter.signature', config.coverLetter.signature],
        ]
      : []),
    ['hero.eyebrow', config.hero.eyebrow],
    ...config.hero.tags.map((tag, index) => [`hero.tags[${index}]`, tag]),
    ['hero.intro', config.hero.intro],
    ['contact.prompt', config.contact.prompt],
    ['contact.signoff', config.contact.signoff],
    ...(typeof config.route?.workHeading === 'string' &&
    config.route.workHeading.trim()
      ? [['route.workHeading', config.route.workHeading]]
      : []),
    ...(typeof config.route?.contactHeading === 'string' &&
    config.route.contactHeading.trim()
      ? [['route.contactHeading', config.route.contactHeading]]
      : []),
    ...Object.entries(config.route?.projectPullquoteOverrides || {}).map(
      ([project, pullquote]) => [
        `route.projectPullquoteOverrides.${project}`,
        pullquote,
      ]
    ),
  ];
  const prohibitedPhrases = [
    ...config.constraints.doNotClaim,
    ...config.constraints.blockedTerms,
    ...config.requirements
      .filter((requirement) => requirement.evidenceStatus === 'none')
      .flatMap((requirement) => requirement.resumeTerms),
  ];
  const violations = [];

  for (const [field, value] of recruiterFacingCopy) {
    const normalizedValue = normalizeText(value);
    for (const phrase of prohibitedPhrases) {
      if (normalizedValue.includes(normalizeText(phrase))) {
        violations.push(`${field} contains unsupported language: ${phrase}`);
      }
    }
  }
  return [...new Set(violations)];
}

export function assertRecruiterFacingClaimsSupported(config) {
  const violations = recruiterFacingClaimViolations(config);
  if (violations.length) {
    throw new Error(
      `Recruiter-facing route copy contains unsupported claims:\n- ${violations.join(
        '\n- '
      )}`
    );
  }
}

export function getArtifactPaths(config) {
  const slug = slugify(config.slug);
  return {
    slug,
    routeIndexPath: `${slug}/index.html`,
    resumePdfPath: `output/pdf/Wally-Mostafa-${config.artifactStem}-Resume.pdf`,
    tempResumeHtmlPath: `tmp/tailored-resumes/${slug}.html`,
    coverLetterPdfPath: `output/pdf/Wally-Mostafa-${config.artifactStem}-Cover-Letter.pdf`,
    coverLetterMarkdownPath: `output/pdf/Wally-Mostafa-${config.artifactStem}-Cover-Letter.md`,
    tempCoverLetterHtmlPath: `tmp/tailored-resumes/${slug}-cover-letter.html`,
    qaOutputDir: `tmp/qa/${slug}`,
  };
}

export function replaceElementContent(html, attribute, value, replacement) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(<([a-z0-9]+)\\b[^>]*\\b${attribute}="${escapedValue}"[^>]*>)[\\s\\S]*?(<\\/\\2>)`,
    'i'
  );
  if (!pattern.test(html)) {
    throw new Error(`Could not find ${attribute}="${value}"`);
  }
  return html.replace(
    pattern,
    (_fullMatch, openingTag, _tagName, closingTag) =>
      `${openingTag}${replacement}${closingTag}`
  );
}

export function replacePortfolioLink(
  html,
  routeUrl,
  linkLabel = 'Portfolio'
) {
  let replacementCount = 0;
  const escapedLinkLabel = escapeHtml(linkLabel);
  const output = html.replace(/<a\b([^>]*)>\s*Portfolio\s*<\/a>/gi, (full, rawAttributes) => {
    let attributes = rawAttributes;
    if (/\bhref="[^"]*"/i.test(attributes)) {
      attributes = attributes.replace(/\bhref="[^"]*"/i, `href="${routeUrl}"`);
    } else {
      attributes = ` href="${routeUrl}"${attributes}`;
    }
    if (!/\btarget="/i.test(attributes)) {
      attributes += ' target="_blank"';
    }
    if (!/\brel="/i.test(attributes)) {
      attributes += ' rel="noopener"';
    }
    replacementCount += 1;
    return `<a${attributes}>${escapedLinkLabel}</a>`;
  });
  if (replacementCount === 0) {
    throw new Error('Could not find the Portfolio contact link');
  }
  return output;
}

export function renderSkillItems(skills) {
  return `\n${skills
    .map(
      (skill) =>
        `    <li>\n      <span class="cap-label">${escapeHtml(skill.label)}</span>\n      <span class="cap-desc"> — ${escapeHtml(skill.description)}</span>\n    </li>`
    )
    .join('\n')}\n  `;
}

export function renderBulletItems(bullets) {
  return `\n${bullets.map((bullet) => `      <li>${escapeHtml(bullet)}</li>`).join('\n')}\n    `;
}

export function findExecutable(filePath) {
  try {
    accessSync(filePath, constants.X_OK);
    return filePath;
  } catch {
    return null;
  }
}

function playwrightHeadlessShellCandidates() {
  const cacheRoot = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
  if (!existsSync(cacheRoot)) {
    return [];
  }

  return readdirSync(cacheRoot)
    .filter((entry) => entry.startsWith('chromium_headless_shell-'))
    .sort((a, b) => {
      const aVersion = Number(a.split('-').at(-1)) || 0;
      const bVersion = Number(b.split('-').at(-1)) || 0;
      return bVersion - aVersion;
    })
    .map((entry) =>
      path.join(cacheRoot, entry, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell')
    );
}

export function resolveChromeExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    ...playwrightHeadlessShellCandidates(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const executable = findExecutable(candidate);
    if (executable) {
      return executable;
    }
  }

  try {
    const chromium = execFileSync('which', ['chromium'], { encoding: 'utf8' }).trim();
    const executable = findExecutable(chromium);
    if (executable) {
      execFileSync(executable, ['--version'], { stdio: 'ignore' });
      return executable;
    }
  } catch {
    // The Homebrew wrapper can exist while its application target is missing.
  }

  throw new Error('No working Chrome/Chromium executable found. Set CHROME_PATH explicitly.');
}

export function isMain(importMetaUrl) {
  return Boolean(process.argv[1]) && importMetaUrl === pathToFileURL(path.resolve(process.argv[1])).href;
}

export function ensureRegularFile(filePath, label = filePath) {
  const absolutePath = resolveRepoPath(filePath);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) {
    throw new Error(`Missing ${label}: ${relativeRepoPath(absolutePath)}`);
  }
  return absolutePath;
}

export function getManifestPath() {
  return resolveRepoPath('scripts/tailored-packages.json');
}

export function readManifest() {
  return readJson('scripts/tailored-packages.json');
}

export function findManifestPackage(slug) {
  return readManifest().packages?.find((pkg) => pkg.slug === slugify(slug)) ?? null;
}

export function upsertV2ManifestEntry(config, qa = {}) {
  const manifest = readManifest();
  const paths = getArtifactPaths(config);
  const configPath = relativeRepoPath(config.__configPath || `scripts/packages/${paths.slug}.json`);
  const entry = {
    workflowVersion: WORKFLOW_VERSION,
    contractRevision: config.contractRevision,
    slug: paths.slug,
    roleTitle: config.roleTitle,
    artifactStem: config.artifactStem,
    configPath,
    targetLane: config.classification.targetLane,
    evidenceMode: config.classification.evidenceMode,
    fitClass: config.fitClass,
    positioningLane: config.positioning?.laneId,
    bridgeType: config.positioning?.bridgeType,
    applicationStrategy: config.positioning?.applicationStrategy,
    ...(config.contractRevision === 7
      ? {
          resumeBaseMode: config.fitGate.resumeBase.mode,
          resumeBaseLeadProfile: config.fitGate.resumeBase.leadProfileId,
          resumeBaseAction: config.fitGate.resumeBase.action,
          accountPresentation:
            config.fitGate.resumeBase.accountPresentation,
          resumeBaseProfiles: config.fitGate.resumeBase.sourceProfiles,
        }
      : {}),
    routeMode: config.routeMode,
    selectedProjects: config.selectedProjects,
    resumePdfPath: paths.resumePdfPath,
    ...(hasCoverLetterArtifact(config)
      ? {
          coverLetterPdfPath: paths.coverLetterPdfPath,
          coverLetterMarkdownPath: paths.coverLetterMarkdownPath,
        }
      : {}),
    publishStatus: 'local-only',
    qaStatus: qa.status || 'qa-passed',
    builtAt: qa.builtAt || new Date().toISOString(),
  };
  const index = manifest.packages.findIndex((pkg) => pkg.slug === paths.slug);
  if (index >= 0) {
    manifest.packages[index] = { ...manifest.packages[index], ...entry };
    delete manifest.packages[index].resumeHtmlPath;
    if (!hasCoverLetterArtifact(config)) {
      delete manifest.packages[index].coverLetterPdfPath;
      delete manifest.packages[index].coverLetterMarkdownPath;
    }
    delete manifest.packages[index].verification;
  } else {
    manifest.packages.push(entry);
    manifest.packages.sort((a, b) => a.slug.localeCompare(b.slug));
  }
  writeJson('scripts/tailored-packages.json', manifest);
  return entry;
}

export function normalizeText(value) {
  return String(value).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
