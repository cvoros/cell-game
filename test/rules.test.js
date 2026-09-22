import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { baseGenotype, cap, netRate, upkeep } from '../src/state.js';
import { makeState } from './helpers.js';

const close = (actual, expected, eps = 1e-9) =>
  assert.ok(Math.abs(actual - expected) < eps, `expected ${expected}, got ${actual}`);

test('base cell: upkeep 0.60 N/h, net +0.40 N/h', () => {
  close(upkeep(baseGenotype()), 0.6);
  close(netRate(baseGenotype()), 0.4);
});

test('upkeep matches 0.30 + 0.15·U² + 0.9/T at several trait values', () => {
  const cases = [
    // [U, T, upkeep]
    [1.0, 6, 0.3 + 0.15 * 1 + 0.15],
    [2.0, 6, 0.3 + 0.6 + 0.15],
    [1.0, 3, 0.3 + 0.15 + 0.3],
    [3.3333333333, 6, 0.3 + 0.15 * 3.3333333333 ** 2 + 0.15],
    [0.1, 48, 0.3 + 0.0015 + 0.01875],
    [6.0, 1, 0.3 + 5.4 + 0.9],
  ];
  for (const [uptake, divisionHours, expected] of cases) {
    close(upkeep({ uptake, divisionHours }), expected);
  }
});

test('§13.2 derived claims: net peaks near U = 3.33 at 1.22; T = 3 h nets 0.25', () => {
  close(netRate({ uptake: 1 / 0.3, divisionHours: 6 }), 10 / 3 - 0.45 - 0.15 * (10 / 3) ** 2);
  assert.equal(netRate({ uptake: 1 / 0.3, divisionHours: 6 }).toFixed(2), '1.22');
  close(netRate({ uptake: 1, divisionHours: 3 }), 0.25);
  assert.ok(netRate({ uptake: 3.2, divisionHours: 6 }) < netRate({ uptake: 1 / 0.3, divisionHours: 6 }));
  assert.ok(netRate({ uptake: 3.5, divisionHours: 6 }) < netRate({ uptake: 1 / 0.3, divisionHours: 6 }));
});

test('cap is storagePerCell × membraneSlots = 54, regardless of cell count', () => {
  assert.equal(cap(makeState({ pool: 0, cells: [] })), 54);
  assert.equal(CONFIG.storagePerCell * CONFIG.membraneSlots, 54);
});

test('config is deeply frozen', () => {
  assert.ok(Object.isFrozen(CONFIG));
  assert.ok(Object.isFrozen(CONFIG.traits.uptake));
  assert.ok(Object.isFrozen(CONFIG.mutationEffects.harmful));
});

test('mutation effect weights sum to 1', () => {
  const total = Object.values(CONFIG.mutationEffects).reduce((s, e) => s + e.weight, 0);
  close(total, 1);
});
