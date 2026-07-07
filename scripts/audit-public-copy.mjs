#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files', '*.html'], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const blockedPatterns = [
  { label: 'internal route note', pattern: /\broute intentionally\b/i },
  { label: 'tracked/canonical implementation note', pattern: /\btracked canonical\b/i },
  { label: 'canonical project implementation note', pattern: /\bcanonical project pages?\b/i },
  { label: 'public navigation implementation note', pattern: /\bpublic navigation\b/i },
  { label: 'page-narrowing implementation note', pattern: /\bthis page narrows\b/i },
  { label: 'local-only caveat', pattern: /\blocal[- ]only\b/i },
  { label: 'untracked file caveat', pattern: /\buntracked\b/i },
  { label: 'uncommitted file caveat', pattern: /\buncommitted\b/i },
  { label: 'unpushed file caveat', pattern: /\bunpushed\b/i },
  { label: 'live 404 caveat', pattern: /\blive[- ]404\b/i },
  { label: 'publish readiness caveat', pattern: /\bpublish[- ]ready\b/i },
  { label: 'implementation note', pattern: /\bimplementation note\b/i },
  { label: 'internal note', pattern: /\binternal note\b/i },
  { label: 'debug copy', pattern: /\bdebug\b/i },
  { label: 'todo copy', pattern: /\bTODO\b/ },
  { label: 'wip copy', pattern: /\bWIP\b/ },
  { label: 'placeholder copy', pattern: /\bplaceholder\b/i },
  { label: 'lorem ipsum copy', pattern: /\blorem ipsum\b/i },
  { label: 'not-ready caveat', pattern: /\bnot ready\b/i },
];

function decodeBasicEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&rsquo;|&lsquo;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/&ndash;|&#8211;/gi, '-');
}

function visibleText(html) {
  return decodeBasicEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<head[\s\S]*?<\/head>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(text, index) {
  const start = Math.max(0, index - 90);
  const end = Math.min(text.length, index + 170);
  return text.slice(start, end);
}

const failures = [];

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const text = visibleText(html);

  for (const { label, pattern } of blockedPatterns) {
    const match = text.match(pattern);
    if (match) {
      failures.push({
        file,
        label,
        match: match[0],
        excerpt: excerpt(text, match.index ?? 0),
      });
    }
  }
}

if (failures.length > 0) {
  console.error('Public copy audit failed. Remove internal/process language from visible HTML text.\n');
  for (const failure of failures) {
    console.error(`${failure.file} [${failure.label}]`);
    console.error(`  matched: ${failure.match}`);
    console.error(`  context: ${failure.excerpt}\n`);
  }
  process.exit(1);
}

console.log(`OK public copy audit passed for ${files.length} HTML files`);
