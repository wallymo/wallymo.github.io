#!/usr/bin/env node

console.error(
  [
    'This legacy generator has been retired.',
    'New and reused packages must use workflow v2:',
    '  node scripts/build-tailored-package.mjs --config scripts/packages/<slug>.json',
    'Start from scripts/examples/package-v2.json and preserve the raw JD, gates, exact resume copy, constraints, and QA state.',
  ].join('\n')
);
process.exit(2);
