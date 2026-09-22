// The simulation core: advance(state, elapsedMs) -> new state. Pure: never mutates its
// input, holds no module state, reads no clock, and knows nothing about rendering.
//
// Offline progress is computed, not ticked (§13.9). Between events the pool changes
// linearly at the colony's net rate, clipped at the cap, so each stretch is solved in
// closed form. The events are:
//   - a division completes (fission, mutation rolls; the net rate changes)
//   - the pool reaches 0 while net is negative (starvation; the net rate changes)
// Reaching the cap needs no event of its own: the pool is clipped and the rate is
// unchanged.

import { CONFIG } from './config.js';
import { nextRandom } from './rng.js';
import {
  cap,
  cloneState,
  colonyNet,
  logEvent,
  netRate,
  recolonizeIfExtinct,
} from './state.js';

export function advance(state, elapsedMs, config = CONFIG) {
  const draft = cloneState(state);
  if (!(elapsedMs > 0)) return draft; // zero, negative (clock moved back) or NaN
  const endMs = draft.lastUpdateMs + elapsedMs;

  settle(draft, config);
  for (;;) {
    const next = nextCompletion(draft, endMs);
    const targetMs = next ? next.division.completesAtMs : endMs;
    const perMs = colonyNet(draft, config) / config.msPerHour;

    if (perMs < 0) {
      const zeroAtMs = draft.lastUpdateMs + draft.pool / -perMs;
      if (zeroAtMs < targetMs) {
        draft.pool = 0;
        draft.lastUpdateMs = zeroAtMs;
        settle(draft, config);
        continue; // the net rate has changed; re-solve from here
      }
    }

    draft.pool = clampPool(draft.pool + perMs * (targetMs - draft.lastUpdateMs), draft, config);
    draft.lastUpdateMs = targetMs;
    if (!next) break;

    completeDivision(draft, next, config);
    settle(draft, config);
  }
  return draft;
}

function clampPool(pool, draft, config) {
  return Math.min(cap(draft, config), Math.max(0, pool));
}

// The earliest division completing at or before endMs; ties go to the lower id.
function nextCompletion(draft, endMs) {
  let best = null;
  for (const cell of draft.cells) {
    if (!cell.division || cell.division.completesAtMs > endMs) continue;
    if (
      !best ||
      cell.division.completesAtMs < best.division.completesAtMs ||
      (cell.division.completesAtMs === best.division.completesAtMs && cell.id < best.id)
    ) {
      best = cell;
    }
  }
  return best;
}

// §13.7: with the pool empty and colony net negative, the least efficient cell starves
// (ties: lower id), repeated until net >= 0. Then recolonize if nothing is left.
function settle(draft, config) {
  while (draft.pool <= 0 && draft.cells.length > 0 && colonyNet(draft, config) < 0) {
    let worst = draft.cells[0];
    for (const cell of draft.cells) {
      if (netRate(cell.genotype, config) < netRate(worst.genotype, config)) worst = cell;
    }
    draft.cells = draft.cells.filter((cell) => cell !== worst);
    logEvent(
      draft,
      { atMs: draft.lastUpdateMs, type: 'starved', cellId: worst.id, slot: worst.slot },
      config,
    );
  }
  recolonizeIfExtinct(draft, config);
}

// How a mutation of size delta changes each trait (§13.5): positive delta is always
// "better at that trait".
const APPLY_DELTA = {
  uptake: (value, delta) => value * (1 + delta),
  divisionHours: (value, delta) => value / (1 + delta),
};

// §13.4/§13.5: the parent is replaced by two daughters, one in its own slot and one in
// the reserved slot. Per daughter, draws happen in a fixed order so a seed replays
// exactly: lethal roll, then for each trait in config order a mutation roll, then (if
// it mutates) an effect roll, then (unless silent) a magnitude roll.
function completeDivision(draft, parent, config) {
  draft.cells = draft.cells.filter((cell) => cell !== parent);
  const daughters = [];

  for (const slot of [parent.slot, parent.division.reservedSlot]) {
    if (roll(draft) < config.lethalChance) {
      daughters.push({ slot, viable: false });
      continue;
    }
    const genotype = { ...parent.genotype };
    const mutations = [];
    for (const trait of Object.keys(config.traits)) {
      if (roll(draft) >= config.mutationChancePerTrait) continue;
      const effect = pickEffect(roll(draft), config);
      if (effect.min === undefined) continue; // silent
      const delta = effect.min + roll(draft) * (effect.max - effect.min);
      const { min, max } = config.traits[trait];
      genotype[trait] = Math.min(max, Math.max(min, APPLY_DELTA[trait](genotype[trait], delta)));
      mutations.push({ trait, delta });
    }
    const cell = {
      id: draft.nextCellId++,
      slot,
      genotype,
      generation: parent.generation + 1,
      parentId: parent.id,
      division: null,
    };
    draft.cells.push(cell);
    daughters.push({ slot, viable: true, id: cell.id, mutations });
  }

  draft.cells.sort((a, b) => a.id - b.id);
  logEvent(
    draft,
    { atMs: draft.lastUpdateMs, type: 'split', parentId: parent.id, daughters },
    config,
  );
}

function pickEffect(r, config) {
  const effects = Object.values(config.mutationEffects);
  let cumulative = 0;
  for (const effect of effects) {
    cumulative += effect.weight;
    if (r < cumulative) return effect;
  }
  return effects[effects.length - 1]; // guards against weights summing just under 1
}

function roll(draft) {
  const [value, nextSeed] = nextRandom(draft.rngSeed);
  draft.rngSeed = nextSeed;
  return value;
}
