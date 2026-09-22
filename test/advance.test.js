import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { advance } from '../src/advance.js';
import { cull, divide } from '../src/actions.js';
import { createInitialState, freeSlots } from '../src/state.js';
import { HOUR, NO_MUTATION, deepFreeze, makeCell, makeState } from './helpers.js';

const close = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `expected ${expected}, got ${actual}`);

test('initial state matches §13: 1 base cell in slot 5, 36 N, 9 slots', () => {
  const s = createInitialState({ nowMs: 1000, seed: 7 });
  assert.equal(s.pool, 36);
  assert.equal(s.slots, 9);
  assert.equal(s.cells.length, 1);
  assert.deepEqual(s.cells[0], {
    id: 1,
    slot: 5,
    genotype: { uptake: 1, divisionHours: 6 },
    generation: 0,
    parentId: null,
    division: null,
  });
  assert.equal(s.lastUpdateMs, 1000);
  assert.equal(s.schemaVersion, CONFIG.schemaVersion);
});

test('1 cell accrues 10 h at +0.40 N/h: 36 → 40', () => {
  const s = advance(createInitialState({ nowMs: 0, seed: 1 }), 10 * HOUR);
  close(s.pool, 40);
  assert.equal(s.lastUpdateMs, 10 * HOUR);
});

test('split elapsed time gives the same result as one call', () => {
  const start = divide(createInitialState({ nowMs: 0, seed: 1 }), 1, NO_MUTATION);
  const once = advance(start, 17 * HOUR, NO_MUTATION);
  let stepped = start;
  for (let i = 0; i < 17; i++) stepped = advance(stepped, HOUR, NO_MUTATION);
  close(stepped.pool, once.pool);
  assert.deepEqual(stepped.cells, once.cells);
});

test('pool clips at 54 and never exceeds it', () => {
  const cells = Array.from({ length: 9 }, (_, i) => makeCell(i + 1, i + 1));
  let s = makeState({ pool: 50, cells }); // +3.6 N/h, reaches 54 after 1.11 h
  for (let i = 0; i < 20; i++) {
    s = advance(s, HOUR / 2);
    assert.ok(s.pool <= 54, `pool ${s.pool} exceeded the cap`);
  }
  assert.equal(s.pool, 54);
});

test('cull refunds clip at the cap too', () => {
  const cells = Array.from({ length: 9 }, (_, i) => makeCell(i + 1, i + 1));
  const s = cull(makeState({ pool: 53, cells }), 3);
  assert.equal(s.pool, 54);
  assert.equal(s.events.at(-1).refund, 1); // only 1 of the 3 N fit
  const full = cull(makeState({ pool: 54, cells }), 3);
  assert.equal(full.pool, 54);
});

test('a division completing mid-interval doubles the rate at that moment', () => {
  let s = divide(createInitialState({ nowMs: 0, seed: 1 }), 1, NO_MUTATION); // 24 N
  const at6 = advance(s, 6 * HOUR, NO_MUTATION);
  close(at6.pool, 24 + 0.4 * 6);
  assert.equal(at6.cells.length, 2);
  // 6 h at 0.4 N/h, then 4 h at 0.8 N/h
  s = advance(s, 10 * HOUR, NO_MUTATION);
  close(s.pool, 24 + 0.4 * 6 + 0.8 * 4);
  assert.deepEqual(
    s.cells.map((c) => [c.slot, c.generation, c.parentId]),
    [
      [5, 1, 1],
      [1, 1, 1],
    ],
  );
});

test('fission puts daughters in the parent slot and the reserved slot', () => {
  let s = divide(createInitialState({ nowMs: 0, seed: 1 }), 1, NO_MUTATION);
  assert.equal(s.cells[0].division.reservedSlot, 1);
  assert.ok(!freeSlots(s).includes(1), 'reserved slot is not free');
  s = advance(s, 6 * HOUR, NO_MUTATION);
  assert.deepEqual(s.cells.map((c) => c.slot).sort(), [1, 5]);
  const split = s.events.find((e) => e.type === 'split');
  assert.equal(split.atMs, 6 * HOUR);
});

test('non-viable daughters free their slot', () => {
  const lethal = { ...NO_MUTATION, lethalChance: 1 };
  let s = makeState({ pool: 36, cells: [makeCell(1, 5), makeCell(2, 2)] });
  s = divide(s, 1, lethal);
  s = advance(s, 7 * HOUR, lethal);
  assert.deepEqual(s.cells.map((c) => c.id), [2]);
  assert.equal(freeSlots(s).length, 8);
  const split = s.events.find((e) => e.type === 'split');
  assert.deepEqual(split.daughters, [
    { slot: 5, viable: false },
    { slot: 1, viable: false },
  ]);
});

test('mutated traits stay within their configured ranges', () => {
  const wild = { ...CONFIG, mutationChancePerTrait: 1, lethalChance: 0 };
  let s = createInitialState({ nowMs: 0, seed: 99 });
  s.pool = 1e6; // plenty of nutrients; the cap only clips income
  for (let round = 0; round < 60; round++) {
    const cell = s.cells.find((c) => !c.division);
    if (freeSlots(s).length > 0 && cell && s.pool >= CONFIG.divisionCost) s = divide(s, cell.id, wild);
    else s = cull(s, s.cells.find((c) => !c.division).id, wild);
    s = advance(s, 50 * HOUR, wild);
  }
  for (const c of s.cells) {
    const { uptake, divisionHours } = c.genotype;
    assert.ok(uptake >= 0.1 && uptake <= 6, `uptake ${uptake}`);
    assert.ok(divisionHours >= 1 && divisionHours <= 48, `divisionHours ${divisionHours}`);
  }
});

test('starvation kills the lowest-net cell and stops once net >= 0', () => {
  // nets: A −0.256, B +0.400, C −0.1635 → colony −0.0195 N/h; pool empties at 51.28 h
  const cells = [makeCell(1, 1, { uptake: 0.2 }), makeCell(2, 2), makeCell(3, 3, { uptake: 0.3 })];
  const s = advance(makeState({ pool: 1, cells }), 60 * HOUR);
  assert.deepEqual(s.cells.map((c) => c.id), [2, 3], 'only A starved; C survives');
  const starved = s.events.filter((e) => e.type === 'starved');
  assert.equal(starved.length, 1);
  assert.equal(starved[0].cellId, 1);
  const emptyAt = 1 / 0.0195;
  close(starved[0].atMs / HOUR, emptyAt, 1e-6);
  close(s.pool, (0.4 - 0.1635) * (60 - emptyAt), 1e-9);
});

test('starvation repeats while net stays negative', () => {
  // nets: −0.256, −0.1635, +0.215625 → colony −0.204 N/h with an empty pool
  const cells = [
    makeCell(1, 1, { uptake: 0.2 }),
    makeCell(2, 2, { uptake: 0.3 }),
    makeCell(3, 3, { uptake: 0.75 }), // net 0.75 − (0.3 + 0.084375 + 0.15) = 0.215625
  ];
  const s = advance(makeState({ pool: 0, cells }), HOUR);
  // −0.256 − 0.1635 + 0.2156 < 0 → kill 1; −0.1635 + 0.2156 > 0 → stop
  assert.deepEqual(s.cells.map((c) => c.id), [2, 3]);
});

test('extinction recolonizes with a base founder in slot 5', () => {
  // net −0.256 N/h; 1 N lasts 3.90625 h
  const s = advance(makeState({ pool: 1, cells: [makeCell(1, 1, { uptake: 0.2 })] }), 10 * HOUR);
  assert.equal(s.cells.length, 1);
  const founder = s.cells[0];
  assert.equal(founder.slot, 5);
  assert.notEqual(founder.id, 1);
  assert.deepEqual(founder.genotype, { uptake: 1, divisionHours: 6 });
  assert.equal(founder.generation, 0);
  assert.equal(founder.parentId, null);
  assert.deepEqual(
    s.events.map((e) => e.type),
    ['starved', 'recolonized'],
  );
  close(s.pool, 0.4 * (10 - 3.90625));
});

test('culling the last cell recolonizes', () => {
  const s = cull(createInitialState({ nowMs: 0, seed: 1 }), 1);
  assert.equal(s.cells.length, 1);
  assert.equal(s.cells[0].id, 2);
  assert.equal(s.events.at(-1).type, 'recolonized');
});

test('zero, negative and NaN elapsed time are no-ops', () => {
  const s = divide(createInitialState({ nowMs: 5 * HOUR, seed: 3 }), 1);
  for (const elapsed of [0, -1, -12 * HOUR, NaN]) {
    const out = advance(s, elapsed);
    assert.deepEqual(out, s);
    assert.notEqual(out, s, 'still returns a new object');
  }
});

test('advance() and the actions never mutate their input', () => {
  let s = divide(createInitialState({ nowMs: 0, seed: 11 }), 1);
  s = advance(s, 6 * HOUR); // a real fission with real rolls
  const frozen = deepFreeze(structuredClone(s));
  const snapshot = structuredClone(frozen);
  // Exercise accrual, fission, mutation rolls, starvation and the actions.
  const later = advance(frozen, 30 * HOUR);
  const starving = deepFreeze(makeState({ pool: 1, cells: [makeCell(1, 1, { uptake: 0.2 })] }));
  advance(starving, 10 * HOUR);
  const target = frozen.cells.find((c) => !c.division).id;
  divide(frozen, target);
  cull(frozen, target);
  assert.deepEqual(frozen, snapshot);
  assert.notDeepEqual(later, frozen);
});
