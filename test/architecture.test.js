// Guards for the CLAUDE.md architecture rules that a code review could miss.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const sources = readdirSync(SRC)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ file: f, code: stripCommentsAndStrings(readFileSync(SRC + f, 'utf8')) }));

function stripCommentsAndStrings(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''");
}

test('no tunable numbers outside config.js', () => {
  // 0 and 1 are structural (empty, first, "1 + delta"). rng.js holds the mulberry32
  // algorithm constants, which are not tuning values.
  const exempt = new Set(['config.js', 'rng.js']);
  for (const { file, code } of sources) {
    if (exempt.has(file)) continue;
    const numbers = (code.match(/(?<![\w.])\d[\d_]*(\.\d+)?(e[+-]?\d+)?(?![\w])/gi) ?? []).filter(
      (n) => n !== '0' && n !== '1',
    );
    assert.deepEqual(numbers, [], `${file} contains numeric literals: ${numbers.join(', ')}`);
  }
});

test('the simulation core references no DOM and imports no renderer', () => {
  for (const { file, code } of sources) {
    assert.doesNotMatch(code, /\b(document|window|HTMLElement|requestAnimationFrame|localStorage)\b/, file);
  }
  // Import paths are strings, which the stripped copy has lost, so read the raw source.
  for (const f of readdirSync(SRC).filter((f) => f.endsWith('.js'))) {
    const imports = [...readFileSync(SRC + f, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const path of imports) assert.doesNotMatch(path, /render/i, `${f} imports ${path}`);
  }
});

test('the core reads no clock and uses no ambient randomness', () => {
  for (const { file, code } of sources) {
    assert.doesNotMatch(code, /Date\.now|new Date|performance\.now|Math\.random/, file);
  }
});
