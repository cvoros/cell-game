import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { nextRandom } from '../src/rng.js';
import { advance } from '../src/advance.js';
import { divide } from '../src/actions.js';
import { createInitialState } from '../src/state.js';
import { HOUR, idleIds } from './helpers.js';

// Every trait mutates on every daughter, so outcomes depend heavily on the rolls.
const WILD = { ...CONFIG, mutationChancePerTrait: 1 };

function play(seed) {
  let s = createInitialState({ nowMs: 0, seed }, WILD);
  for (let round = 0; round < 3; round++) {
    for (const id of idleIds(s)) {
      if (s.pool >= WILD.divisionCost) s = divide(s, id, WILD);
    }
    s = advance(s, 12 * HOUR, WILD);
  }
  return s;
}

test('nextRandom is pure and in [0, 1)', () => {
  let seed = 12345;
  const a = [];
  for (let i = 0; i < 1000; i++) {
    const [v, next] = nextRandom(seed);
    assert.ok(v >= 0 && v < 1);
    a.push(v);
    seed = next;
  }
  assert.deepEqual(nextRandom(12345), nextRandom(12345));
  assert.ok(new Set(a).size > 990, 'values vary');
});

test('the same seed produces identical outcomes', () => {
  assert.deepEqual(play(42), play(42));
});

test('different seeds diverge', () => {
  const a = play(42);
  const b = play(43);
  assert.notDeepEqual(
    a.cells.map((c) => c.genotype),
    b.cells.map((c) => c.genotype),
  );
});
