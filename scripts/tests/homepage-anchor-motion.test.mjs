import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const revisionSource = readFileSync(
  path.join(repoRoot, 'assets/portfolio-revision/revision.js'),
  'utf8'
);

test('Chapters clicks scroll smoothly without changing restoration behavior', () => {
  assert.match(
    revisionSource,
    /function followAnchor\(\{ smooth = false \} = \{\}\)/,
    'direct hash and history restoration must remain instant by default'
  );
  assert.match(
    revisionSource,
    /behavior: smooth && !motion\.matches \? 'smooth' : 'instant'/,
    'explicit navigation must respect the reduced-motion preference'
  );
  assert.match(
    revisionSource,
    /link\.addEventListener\('click',[\s\S]*?followAnchor\(\{ smooth: true \}\);/,
    'the Chapters click handler must request smooth scrolling'
  );
  assert.match(
    revisionSource,
    /document\.fonts\?\.ready[\s\S]*?followAnchor\(\);/,
    'layout restoration must keep the default instant positioning'
  );
});
