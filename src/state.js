// Game state: shape, construction, and derived quantities.
//
// State is plain, JSON-serialisable data. It knows nothing about how it is drawn.
//
// {
//   schemaVersion: number,        save-format version (CONFIG.schemaVersion)
//   lastUpdateMs:  number,        simulated clock: the moment this state describes
//   startedAtMs:   number,        when this game began (v3); the header's day count
//   pool:          number,        shared nutrients, N; 0 <= pool <= cap
//   slots:         number,        membrane slots, numbered 1..slots
//   cells: [                      living cells, in id order
//     {
//       id:         number,       unique, never reused (renderer shows it as "c<id>")
//       slot:       number,       1..slots
//       genotype:   { uptake, divisionHours },   hidden traits (§13.2)
//       generation: number,       founder = 0, daughter = parent + 1
//       parentId:   number|null,  null for a founder
//       division:   null | { completesAtMs, reservedSlot }   set while dividing
//     }
//   ],
//   nextCellId:    number,        next id to hand out
//   rngSeed:       number,        mulberry32 seed; advanced by every roll
//   sessionNumber: number,        page loads so far (v2); seeds the §13.8 display noise
//   events: [                     newest last, at most CONFIG.eventLogMax
//     { atMs, type: 'divisionStarted', cellId, slot, reservedSlot, cost }
//     { atMs, type: 'split', parentId, daughters: [
//         { slot, viable: false }
//         { slot, viable: true, id, mutations: [{ trait, delta }] } ] }
//     { atMs, type: 'culled', cellId, slot, refund }
//     { atMs, type: 'starved', cellId, slot }
//     { atMs, type: 'recolonized', cellId, slot }
//     { atMs, type: 'session', sessionNumber, status, elapsedMs }   status from loadGame
//   ]
// }
//
// Functions named with a `draft` parameter mutate that object in place. They are only
// ever called on a fresh copy made by cloneState, so the public API stays pure.

import { CONFIG } from './config.js';
import { toSeed } from './rng.js';

export function cloneState(state) {
  return structuredClone(state);
}

export function createInitialState({ nowMs, seed }, config = CONFIG) {
  const draft = {
    schemaVersion: config.schemaVersion,
    lastUpdateMs: nowMs,
    startedAtMs: nowMs,
    pool: config.startingNutrients,
    slots: config.membraneSlots,
    cells: [],
    nextCellId: 1,
    rngSeed: toSeed(seed),
    sessionNumber: 0,
    events: [],
  };
  for (let i = 0; i < config.startingCells; i++) {
    const slot = i === 0 ? config.founderSlot : freeSlots(draft)[0];
    addFounder(draft, slot, config);
  }
  return draft;
}

// ---- Derived quantities (§13.2, §13.3) -------------------------------------------

export function upkeep(genotype, config = CONFIG) {
  const { uptake, divisionHours } = genotype;
  return (
    config.upkeepBase +
    config.upkeepUptakeCoeff * uptake * uptake +
    config.upkeepSpeedCoeff / divisionHours
  );
}

export function netRate(genotype, config = CONFIG) {
  return genotype.uptake - upkeep(genotype, config);
}

// Colony net income, N/h.
export function colonyNet(state, config = CONFIG) {
  return state.cells.reduce((sum, cell) => sum + netRate(cell.genotype, config), 0);
}

export function cap(state, config = CONFIG) {
  return config.storagePerCell * state.slots;
}

// Slots neither occupied by a cell nor reserved by a division, lowest first.
export function freeSlots(state) {
  const taken = new Set();
  for (const cell of state.cells) {
    taken.add(cell.slot);
    if (cell.division) taken.add(cell.division.reservedSlot);
  }
  const free = [];
  for (let slot = 1; slot <= state.slots; slot++) if (!taken.has(slot)) free.push(slot);
  return free;
}

export function findCell(state, cellId) {
  return state.cells.find((cell) => cell.id === cellId);
}

// ---- Draft mutators (only called on copies) -------------------------------------

export function baseGenotype(config = CONFIG) {
  return {
    uptake: config.traits.uptake.base,
    divisionHours: config.traits.divisionHours.base,
  };
}

export function addFounder(draft, slot, config = CONFIG) {
  const cell = {
    id: draft.nextCellId++,
    slot,
    genotype: baseGenotype(config),
    generation: 0,
    parentId: null,
    division: null,
  };
  draft.cells.push(cell);
  return cell;
}

export function logEvent(draft, event, config = CONFIG) {
  draft.events.push(event);
  const excess = draft.events.length - config.eventLogMax;
  if (excess > 0) draft.events.splice(0, excess);
}

// Called once per page load, after loadGame: counts the session (which reseeds the
// §13.8 display noise) and records how the load went in the event log.
export function beginSession(state, { status, elapsedMs = 0 }, config = CONFIG) {
  const draft = cloneState(state);
  draft.sessionNumber += 1;
  logEvent(
    draft,
    { atMs: draft.lastUpdateMs, type: 'session', sessionNumber: draft.sessionNumber, status, elapsedMs },
    config,
  );
  return draft;
}

// §13.7: if every cell is gone, a base founder drifts into the founder slot.
export function recolonizeIfExtinct(draft, config = CONFIG) {
  if (draft.cells.length > 0) return;
  const cell = addFounder(draft, config.founderSlot, config);
  logEvent(
    draft,
    { atMs: draft.lastUpdateMs, type: 'recolonized', cellId: cell.id, slot: cell.slot },
    config,
  );
}
