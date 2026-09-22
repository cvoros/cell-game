// Shared test utilities. Not a test file itself (no .test.js suffix).

import { CONFIG } from '../src/config.js';

export const HOUR = CONFIG.msPerHour;

// Base rules with no randomness in outcomes: every daughter is a faithful, viable copy.
export const NO_MUTATION = { ...CONFIG, lethalChance: 0, mutationChancePerTrait: 0 };

export function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

export function makeCell(id, slot, genotype = {}, extra = {}) {
  return {
    id,
    slot,
    genotype: {
      uptake: CONFIG.traits.uptake.base,
      divisionHours: CONFIG.traits.divisionHours.base,
      ...genotype,
    },
    generation: 0,
    parentId: null,
    division: null,
    ...extra,
  };
}

export function makeState({ pool, cells, nowMs = 0, seed = 1 }) {
  return {
    schemaVersion: CONFIG.schemaVersion,
    lastUpdateMs: nowMs,
    pool,
    slots: CONFIG.membraneSlots,
    cells,
    nextCellId: Math.max(0, ...cells.map((c) => c.id)) + 1,
    rngSeed: seed,
    sessionNumber: 0,
    events: [],
  };
}

// Idle (not dividing) cells, lowest id first.
export function idleIds(state) {
  return state.cells.filter((c) => !c.division).map((c) => c.id);
}
