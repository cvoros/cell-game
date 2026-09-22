// Guards for the CLAUDE.md architecture rules that a code review could miss.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const raw = Object.fromEntries(
  readdirSync(SRC)
    .filter((f) => f.endsWith('.js'))
    .map((f) => [f, readFileSync(SRC + f, 'utf8')]),
);
const sources = Object.entries(raw).map(([file, code]) => ({ file, code: stripCommentsAndStrings(code) }));

// The browser entry point is the one file allowed the DOM and the clock.
const ENTRY = 'main.js';

function stripCommentsAndStrings(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, "''");
}

function numericLiterals(code) {
  return (code.match(/(?<![\w.])\d[\d_]*(\.\d+)?(e[+-]?\d+)?(?![\w])/gi) ?? []).filter(
    (n) => n !== '0' && n !== '1',
  );
}

// Presentation files keep their numbers in one named, frozen block (LAYOUT in
// render.js, FORMAT in view.js). Everything outside that block is held to the same
// standard as the core.
function withoutNamedBlock(code, name) {
  return code.replace(new RegExp(`const ${name} = Object\\.freeze\\(\\{[\\s\\S]*?\\n\\}\\);`), '');
}

function importsOf(file) {
  return [...raw[file].matchAll(/^import[\s\S]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
}

test('no tunable numbers outside config.js', () => {
  // 0 and 1 are structural (empty, first, "1 + delta"). rng.js holds the mulberry32
  // and hashing algorithm constants, which are not tuning values.
  const exempt = new Set(['config.js', 'rng.js']);
  // MIGRATIONS is exempt for the opposite reason: a migration step is frozen history.
  // Its version keys and any default it writes must stay fixed even when the config is
  // retuned, so it must hardcode them rather than read CONFIG.
  const named = { 'render.js': 'LAYOUT', 'view.js': 'FORMAT', 'save.js': 'MIGRATIONS' };
  for (const { file, code } of sources) {
    if (exempt.has(file)) continue;
    const checked = named[file] ? withoutNamedBlock(code, named[file]) : code;
    const numbers = numericLiterals(checked);
    assert.deepEqual(numbers, [], `${file} contains numeric literals: ${numbers.join(', ')}`);
  }
});

test('the presentation blocks exist, so the check above is not vacuous', () => {
  assert.match(raw['render.js'], /const LAYOUT = Object\.freeze\(\{/);
  assert.match(raw['view.js'], /const FORMAT = Object\.freeze\(\{/);
  assert.notEqual(withoutNamedBlock(raw['render.js'], 'LAYOUT'), raw['render.js']);
  assert.notEqual(withoutNamedBlock(raw['view.js'], 'FORMAT'), raw['view.js']);
  assert.notEqual(withoutNamedBlock(raw['save.js'], 'MIGRATIONS'), raw['save.js']);
  assert.doesNotMatch(
    raw['save.js'].match(/const MIGRATIONS = Object\.freeze\(\{[\s\S]*?\n\}\);/)[0],
    /CONFIG/,
    'migrations must not read the live config',
  );
});

test('nothing but main.js references the DOM', () => {
  for (const { file, code } of sources) {
    if (file === ENTRY) continue;
    assert.doesNotMatch(code, /\b(document|window|HTMLElement|requestAnimationFrame|getComputedStyle)\b/, file);
  }
});

test('nothing but main.js reads the clock or uses ambient randomness', () => {
  for (const { file, code } of sources) {
    if (file === ENTRY) continue;
    assert.doesNotMatch(code, /Date\.now|new Date|performance\.now|Math\.random/, file);
  }
  assert.doesNotMatch(raw[ENTRY], /Math\.random/, 'main.js: randomness comes from the seeded PRNG only');
});

test('only save.js touches storage, and only main.js uses save.js', () => {
  for (const { file, code } of sources) {
    if (file === 'save.js') continue;
    assert.doesNotMatch(code, /\b(localStorage|sessionStorage|indexedDB|getItem|setItem)\b/, file);
  }
  const importers = Object.keys(raw).filter((f) => importsOf(f).includes('./save.js'));
  assert.deepEqual(importers, [ENTRY]);
});

test('no module imports a renderer except main.js', () => {
  for (const file of Object.keys(raw)) {
    if (file === ENTRY) continue;
    for (const path of importsOf(file)) assert.doesNotMatch(path, /render/i, `${file} imports ${path}`);
  }
});

test('render.js is isolated: no imports, no DOM, no storage, no clock, no config', () => {
  assert.deepEqual(importsOf('render.js'), [], 'render.js must take everything from the view model');
  const code = stripCommentsAndStrings(raw['render.js']);
  assert.doesNotMatch(code, /\b(document|window|localStorage|sessionStorage|CONFIG)\b/);
  assert.doesNotMatch(code, /Date|performance|Math\.random/);
});

test('view.js reads state and config but no storage and no DOM', () => {
  const allowed = new Set(['./config.js', './rng.js', './state.js']);
  for (const path of importsOf('view.js')) assert.ok(allowed.has(path), `view.js imports ${path}`);
});
