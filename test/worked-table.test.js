// Replays the §13.10 worked table: check-ins every 12 h, base traits, no mutations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance } from '../src/advance.js';
import { cull, divide } from '../src/actions.js';
import { createInitialState } from '../src/state.js';
import { HOUR, NO_MUTATION, idleIds } from './helpers.js';

// [label, cells on arrival, pool on arrival, culls, divisions, pool after]
const TABLE = [
  ['Day 0 08:00', 1, '36.0', 0, 1, '24.0'],
  ['Day 0 20:00', 2, '31.2', 0, 2, '7.2'],
  ['Day 1 08:00', 4, '21.6', 0, 1, '9.6'],
  ['Day 1 20:00', 5, '31.2', 0, 2, '7.2'],
  ['Day 2 08:00', 7, '36.0', 0, 2, '12.0'],
  ['Day 2 20:00', 9, '50.4', 4, 4, '6.0'],
];

test('§13.10 worked table replays exactly', () => {
  let s = createInitialState({ nowMs: 0, seed: 1 }, NO_MUTATION);
  TABLE.forEach(([label, cells, arrive, culls, divisions, after], i) => {
    if (i > 0) s = advance(s, 12 * HOUR, NO_MUTATION);
    assert.equal(s.cells.length, cells, `${label}: cells on arrival`);
    assert.equal(s.pool.toFixed(1), arrive, `${label}: pool on arrival`);
    for (const id of idleIds(s).slice(0, culls)) s = cull(s, id, NO_MUTATION);
    for (const id of idleIds(s).slice(0, divisions)) s = divide(s, id, NO_MUTATION);
    assert.equal(s.pool.toFixed(1), after, `${label}: pool after`);
  });
});

test('the cull at Day 2 20:00 clips 8.4 N at the cap', () => {
  let s = createInitialState({ nowMs: 0, seed: 1 }, NO_MUTATION);
  for (const [, , , culls, divisions] of TABLE.slice(0, 5)) {
    for (const id of idleIds(s).slice(0, culls)) s = cull(s, id, NO_MUTATION);
    for (const id of idleIds(s).slice(0, divisions)) s = divide(s, id, NO_MUTATION);
    s = advance(s, 12 * HOUR, NO_MUTATION);
  }
  for (const id of idleIds(s).slice(0, 4)) s = cull(s, id, NO_MUTATION);
  assert.equal(s.pool, 54);
  const refunded = s.events.filter((e) => e.type === 'culled').reduce((sum, e) => sum + e.refund, 0);
  assert.equal((12 - refunded).toFixed(1), '8.4');
});

test('steady play after the table averages about 3.7 replacements per check-in', () => {
  let s = createInitialState({ nowMs: 0, seed: 1 }, NO_MUTATION);
  for (const [, , , culls, divisions] of TABLE) {
    for (const id of idleIds(s).slice(0, culls)) s = cull(s, id, NO_MUTATION);
    for (const id of idleIds(s).slice(0, divisions)) s = divide(s, id, NO_MUTATION);
    s = advance(s, 12 * HOUR, NO_MUTATION);
  }
  const counts = [];
  for (let i = 0; i < 8; i++) {
    // Greedy: the most replacements the pool allows after refunds (clipped), max 4.
    let k = 4;
    while (k > 0 && Math.min(54, s.pool + 3 * k) < 12 * k) k--;
    for (const id of idleIds(s).slice(0, k)) s = cull(s, id, NO_MUTATION);
    for (const id of idleIds(s).slice(0, k)) s = divide(s, id, NO_MUTATION);
    counts.push(k);
    s = advance(s, 12 * HOUR, NO_MUTATION);
  }
  assert.deepEqual(counts, [4, 4, 3, 4, 4, 4, 3, 4]);
});
