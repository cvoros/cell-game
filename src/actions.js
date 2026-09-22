// The player's two verbs (§4a), as pure functions of state. Each acts at
// state.lastUpdateMs, so callers advance() to the present first. Illegal actions throw;
// use the can* functions to check first.

import { CONFIG } from './config.js';
import { cap, cloneState, findCell, freeSlots, logEvent, recolonizeIfExtinct } from './state.js';

// Returns null if the cell can divide now, otherwise a reason code.
export function canDivide(state, cellId, config = CONFIG) {
  const cell = findCell(state, cellId);
  if (!cell) return 'noSuchCell';
  if (cell.division) return 'alreadyDividing';
  if (freeSlots(state).length === 0) return 'noFreeSlot';
  if (state.pool < config.divisionCost) return 'notEnoughNutrients';
  return null;
}

// §13.4: pay the cost, reserve the lowest free slot, start the timer.
export function divide(state, cellId, config = CONFIG) {
  const reason = canDivide(state, cellId, config);
  if (reason) throw new Error(`cannot divide cell ${cellId}: ${reason}`);
  const draft = cloneState(state);
  const cell = findCell(draft, cellId);
  const reservedSlot = freeSlots(draft)[0];
  draft.pool -= config.divisionCost;
  cell.division = {
    completesAtMs: draft.lastUpdateMs + cell.genotype.divisionHours * config.msPerHour,
    reservedSlot,
  };
  logEvent(
    draft,
    {
      atMs: draft.lastUpdateMs,
      type: 'divisionStarted',
      cellId,
      slot: cell.slot,
      reservedSlot,
      cost: config.divisionCost,
    },
    config,
  );
  return draft;
}

export function canCull(state, cellId) {
  const cell = findCell(state, cellId);
  if (!cell) return 'noSuchCell';
  if (cell.division) return 'dividing';
  return null;
}

// §13.6: remove the cell and recycle part of it. The refund is clipped at the cap
// (§13.3). Culling the last cell triggers recolonization (§13.7).
export function cull(state, cellId, config = CONFIG) {
  const reason = canCull(state, cellId);
  if (reason) throw new Error(`cannot cull cell ${cellId}: ${reason}`);
  const draft = cloneState(state);
  const cell = findCell(draft, cellId);
  draft.cells = draft.cells.filter((c) => c !== cell);
  const before = draft.pool;
  draft.pool = Math.min(cap(draft, config), draft.pool + config.cullRefund);
  logEvent(
    draft,
    // refund is what actually reached the pool, after clipping
    { atMs: draft.lastUpdateMs, type: 'culled', cellId, slot: cell.slot, refund: draft.pool - before },
    config,
  );
  recolonizeIfExtinct(draft, config);
  return draft;
}
