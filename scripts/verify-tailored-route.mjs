#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  PUBLIC_BASE,
  RESUME_BASE_PROFILES_PATH,
  WORKFLOW_VERSION,
  getArtifactPaths,
  hasCoverLetterArtifact,
  isMain,
  readJson,
  readManifest,
  resolveRepoPath,
  scopedProjectReplacementAssets,
  sha256,
  writeJson,
} from './lib/workflow-v2.mjs';
import { checkPackages } from './check-tailored-packages.mjs';

function usage() {
  console.error('Usage: node scripts/verify-tailored-route.mjs <route-slug>');
}

function scopedPaths(pkg, config, paths) {
  return [
    paths.routeIndexPath,
    paths.resumePdfPath,
    ...(hasCoverLetterArtifact(config)
      ? [paths.coverLetterPdfPath, paths.coverLetterMarkdownPath]
      : []),
    pkg.configPath,
    ...(config.contractRevision === 7 ? [RESUME_BASE_PROFILES_PATH] : []),
    'scripts/tailored-packages.json',
    ...(config.routeMode === 'scoped-projects'
      ? config.selectedProjects.map((project) => `${paths.slug}/${project}`)
      : []),
    ...scopedProjectReplacementAssets(config),
  ];
}

function gitStatus(paths) {
  return execFileSync('git', ['status', '--short', '--', ...paths], {
    cwd: resolveRepoPath('.'),
    encoding: 'utf8',
  }).trim();
}

async function fetchLive(url) {
  const cacheBusted = `${url}${url.includes('?') ? '&' : '?'}verify=${Date.now()}`;
  const response = await fetch(cacheBusted, {
    redirect: 'follow',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });
  if (response.status !== 200) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response;
}

export function assertChecksum(label, localBuffer, liveBuffer) {
  const localChecksum = sha256(localBuffer);
  const liveChecksum = sha256(liveBuffer);
  if (localChecksum !== liveChecksum) {
    throw new Error(
      `${label} checksum mismatch: local ${localChecksum}, live ${liveChecksum}`
    );
  }
  return localChecksum;
}

export async function fetchPublishedArtifacts(
  pkg,
  config,
  { publicBase = PUBLIC_BASE } = {}
) {
  const paths = getArtifactPaths(config);
  const base = publicBase.endsWith('/') ? publicBase : `${publicBase}/`;
  const routeUrl = `${base}${paths.slug}/`;
  const resumePdfUrl = `${base}${paths.resumePdfPath}`;
  const configUrl = `${base}${pkg.configPath}`;
  const coverLetterPdfUrl = `${base}${paths.coverLetterPdfPath}`;
  const coverLetterMarkdownUrl = `${base}${paths.coverLetterMarkdownPath}`;
  const resumeBaseProfilesUrl = `${base}${RESUME_BASE_PROFILES_PATH}`;
  const projectUrls = config.selectedProjects.map((project) =>
    config.routeMode === 'canonical-projects'
      ? `${base}${project}`
      : `${base}${paths.slug}/${project}`
  );
  const replacementAssets = scopedProjectReplacementAssets(config);
  const scopedProjectAssetUrls = replacementAssets.map(
    (assetPath) => `${base}${assetPath}`
  );

  const routeResponse = await fetchLive(routeUrl);
  const liveRoute = Buffer.from(await routeResponse.arrayBuffer());
  const routeBody = liveRoute.toString('utf8');
  if (!routeBody.includes(`href="../${paths.resumePdfPath}"`)) {
    throw new Error(`Live route does not point to ${paths.resumePdfPath}`);
  }
  const localRoute = readFileSync(resolveRepoPath(paths.routeIndexPath));
  const routeSha256 = assertChecksum('Role route', localRoute, liveRoute);

  const configResponse = await fetchLive(configUrl);
  const liveConfig = Buffer.from(await configResponse.arrayBuffer());
  const localConfig = readFileSync(resolveRepoPath(pkg.configPath));
  const configSha256 = assertChecksum(
    'Package config',
    localConfig,
    liveConfig
  );

  let resumeBaseProfilesSha256 = null;
  if (config.contractRevision === 7) {
    const profileResponse = await fetchLive(resumeBaseProfilesUrl);
    const liveProfiles = Buffer.from(await profileResponse.arrayBuffer());
    const localProfiles = readFileSync(
      resolveRepoPath(RESUME_BASE_PROFILES_PATH)
    );
    resumeBaseProfilesSha256 = assertChecksum(
      'Resume base profiles',
      localProfiles,
      liveProfiles
    );
  }

  const scopedProjectSha256 = {};
  for (const [projectIndex, projectUrl] of projectUrls.entries()) {
    const projectResponse = await fetchLive(projectUrl);
    if (config.routeMode === 'scoped-projects') {
      const project = config.selectedProjects[projectIndex];
      const liveProject = Buffer.from(await projectResponse.arrayBuffer());
      const localProject = readFileSync(
        resolveRepoPath(`${paths.slug}/${project}`)
      );
      scopedProjectSha256[project] = assertChecksum(
        `Scoped project ${project}`,
        localProject,
        liveProject
      );
    }
  }

  const scopedProjectAssetSha256 = {};
  for (const [assetIndex, assetUrl] of scopedProjectAssetUrls.entries()) {
    const assetPath = replacementAssets[assetIndex];
    const assetResponse = await fetchLive(assetUrl);
    const liveAsset = Buffer.from(await assetResponse.arrayBuffer());
    const localAsset = readFileSync(resolveRepoPath(assetPath));
    scopedProjectAssetSha256[assetPath] = assertChecksum(
      `Scoped project replacement asset ${assetPath}`,
      localAsset,
      liveAsset
    );
  }

  const pdfResponse = await fetchLive(resumePdfUrl);
  const livePdf = Buffer.from(await pdfResponse.arrayBuffer());
  const localPdf = readFileSync(resolveRepoPath(paths.resumePdfPath));
  const pdfSha256 = assertChecksum('Resume PDF', localPdf, livePdf);

  let coverLetterPdfSha256 = null;
  let coverLetterMarkdownSha256 = null;
  if (hasCoverLetterArtifact(config)) {
    const coverLetterPdfResponse = await fetchLive(coverLetterPdfUrl);
    const liveCoverLetterPdf = Buffer.from(
      await coverLetterPdfResponse.arrayBuffer()
    );
    const localCoverLetterPdf = readFileSync(
      resolveRepoPath(paths.coverLetterPdfPath)
    );
    coverLetterPdfSha256 = assertChecksum(
      'Cover-letter PDF',
      localCoverLetterPdf,
      liveCoverLetterPdf
    );

    const coverLetterMarkdownResponse = await fetchLive(
      coverLetterMarkdownUrl
    );
    const liveCoverLetterMarkdown = Buffer.from(
      await coverLetterMarkdownResponse.arrayBuffer()
    );
    const localCoverLetterMarkdown = readFileSync(
      resolveRepoPath(paths.coverLetterMarkdownPath)
    );
    coverLetterMarkdownSha256 = assertChecksum(
      'Cover-letter Markdown',
      localCoverLetterMarkdown,
      liveCoverLetterMarkdown
    );
  }

  return {
    routeUrl,
    resumePdfUrl,
    configUrl,
    projectUrls,
    configSha256,
    pdfSha256,
    ...(config.contractRevision === 7
      ? { resumeBaseProfilesUrl, resumeBaseProfilesSha256 }
      : {}),
    ...(hasCoverLetterArtifact(config)
      ? {
          coverLetterPdfUrl,
          coverLetterMarkdownUrl,
          coverLetterPdfSha256,
          coverLetterMarkdownSha256,
        }
      : {}),
    routeSha256,
    scopedProjectSha256,
    scopedProjectAssetUrls,
    scopedProjectAssetSha256,
  };
}

export async function verifyTailoredRoute(slug, { publicBase = PUBLIC_BASE } = {}) {
  const manifest = readManifest();
  const normalizedSlug = slug.replace(/^\/+|\/+$/g, '');
  const index = manifest.packages.findIndex((pkg) => pkg.slug === normalizedSlug);
  if (index === -1) {
    throw new Error(`No package found for ${normalizedSlug}`);
  }
  const pkg = manifest.packages[index];
  if ((pkg.workflowVersion || 1) !== WORKFLOW_VERSION) {
    throw new Error(
      `${normalizedSlug} is a legacy package. Convert it to workflowVersion 2 before reuse.`
    );
  }

  const localCheck = checkPackages({
    slug: normalizedSlug,
    publicBase,
  });
  if (localCheck.failures.length) {
    throw new Error(`Local v2 checks failed:\n${localCheck.failures.join('\n')}`);
  }
  const config = readJson(pkg.configPath);
  const paths = getArtifactPaths(config);
  const dirty = gitStatus(scopedPaths(pkg, config, paths));
  if (dirty) {
    throw new Error(`Scoped files must be committed before live verification:\n${dirty}`);
  }

  const liveProof = await fetchPublishedArtifacts(pkg, config, {
    publicBase,
  });

  const verifiedAt = new Date().toISOString();
  manifest.packages[index] = {
    ...pkg,
    publishStatus: 'live-verified',
    verification: {
      verifiedAt,
      ...liveProof,
      configInputSha256: config.qa.configInputSha256,
      qaBuiltAt: config.qa.builtAt,
    },
  };
  writeJson('scripts/tailored-packages.json', manifest);

  return manifest.packages[index].verification;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || args.includes('--help')) {
    usage();
    process.exit(args.includes('--help') ? 0 : 2);
  }
  const result = await verifyTailoredRoute(args[0]);
  console.log(`OK live route: ${result.routeUrl}`);
  console.log(`OK live resume PDF: ${result.resumePdfUrl}`);
  if (result.coverLetterPdfUrl) {
    console.log(`OK live cover-letter PDF: ${result.coverLetterPdfUrl}`);
    console.log(
      `OK live cover-letter Markdown: ${result.coverLetterMarkdownUrl}`
    );
  }
  console.log(`OK live package config: ${result.configUrl}`);
  if (result.resumeBaseProfilesUrl) {
    console.log(`OK live resume base profiles: ${result.resumeBaseProfilesUrl}`);
  }
  console.log(`OK PDF checksum: ${result.pdfSha256}`);
  console.log('Updated publishStatus to live-verified.');
}

if (isMain(import.meta.url)) {
  main().catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  });
}
