// Persistence and load-time catch-up. The ONLY module that touches storage: advance.js
// and state.js stay pure. Storage is injected (anything with getItem/setItem, e.g.
// localStorage or a test fake), so this runs under plain Node.
//
// Nothing here throws on a storage failure. Private browsing, disabled storage and
// quota errors come back as a result describing what happened; the game keeps running.

import { CONFIG } from './config.js';
import { advance } from './advance.js';
import { createInitialState } from './state.js';
import { toSeed } from './rng.js';

// ---- Migrations ---------------------------------------------------------------------
//
// MIGRATIONS[n] upgrades a save from schema version n to n + 1 and returns a new object
// (don't mutate the argument).
//
// To change the save shape:
//   1. Bump CONFIG.schemaVersion (say to 3) and update the state shape in state.js.
//   2. Add MIGRATIONS[2] = (save) => ({ ...save, schemaVersion: save.schemaVersion + 1,
//      newField: default }) that turns any valid v2 save into a valid v3 save.
//   3. Update validate() for the new shape, and add a test that loads a real v2 save
//      (keep a frozen fixture of one; don't build it with today's createInitialState).
// Never edit or remove an existing step: old saves in the wild still pass through it.
export const MIGRATIONS = Object.freeze({
  // v1 → v2: add the session counter that seeds the §13.8 display noise. A v1 save has
  // never been through a counted session, so it starts at 0; the load that follows
  // makes it session 1, exactly like a new game.
  1: (save) => ({ ...save, schemaVersion: save.schemaVersion + 1, sessionNumber: 0 }),

  // v2 → v3: record when the game began, for the header's day count. An existing save
  // never stored it, so use the earliest moment it does record: the oldest log entry,
  // else lastUpdateMs. The log keeps only the newest entries, so for a long game this
  // is a lower bound on age, and the day count starts from there.
  2: (save) => {
    const times = (Array.isArray(save.events) ? save.events : [])
      .map((e) => e && e.atMs)
      .filter(Number.isFinite);
    return {
      ...save,
      schemaVersion: save.schemaVersion + 1,
      startedAtMs: Math.min(save.lastUpdateMs, ...times),
    };
  },
});

// Runs a save through the chain up to targetVersion. Throws if a step is missing, and
// refuses saves from a newer version rather than guessing at them.
export function migrate(save, { migrations = MIGRATIONS, targetVersion = CONFIG.schemaVersion } = {}) {
  let current = save;
  if (current.schemaVersion > targetVersion) throw new FutureVersionError(current.schemaVersion, targetVersion);
  while (current.schemaVersion < targetVersion) {
    const step = migrations[current.schemaVersion];
    if (!step) throw new Error(`no migration from schema v${current.schemaVersion}`);
    current = step(current);
  }
  return current;
}

export class FutureVersionError extends Error {
  constructor(version, supported) {
    super(`save is from schema v${version}, newer than this build (v${supported})`);
    this.version = version;
  }
}

// ---- Serialisation and validation --------------------------------------------------

export function serialize(state) {
  return JSON.stringify(state);
}

// Throws SyntaxError on text that isn't JSON; loadGame catches it.
export function deserialize(json) {
  return JSON.parse(json);
}

// Structural check before a save is trusted. Returns a list of problems; empty = valid.
// Trait values are checked for being finite and positive but not against the config
// ranges: ranges get retuned, and an older save shouldn't become "corrupt" when they do.
export function validate(state) {
  const problems = [];
  const isInt = Number.isInteger;
  const finite = Number.isFinite;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return ['save is not an object'];

  if (!isInt(state.schemaVersion)) problems.push('schemaVersion is not an integer');
  if (!finite(state.lastUpdateMs)) problems.push('lastUpdateMs is not a finite number');
  if (!finite(state.startedAtMs)) problems.push('startedAtMs is not a finite number');
  if (!finite(state.pool) || state.pool < 0) problems.push('pool is not a finite number >= 0');
  if (!isInt(state.slots) || state.slots < 1) problems.push('slots is not a positive integer');
  if (!isInt(state.nextCellId)) problems.push('nextCellId is not an integer');
  if (!isInt(state.rngSeed) || state.rngSeed < 0 || state.rngSeed !== toSeed(state.rngSeed)) {
    problems.push('rngSeed is not an unsigned 32-bit integer');
  }
  if (!isInt(state.sessionNumber) || state.sessionNumber < 0) {
    problems.push('sessionNumber is not an integer >= 0');
  }
  if (!Array.isArray(state.events)) problems.push('events is not an array');
  if (!Array.isArray(state.cells)) {
    problems.push('cells is not an array');
    return problems;
  }

  const inRange = (slot) => isInt(slot) && slot >= 1 && slot <= state.slots;
  const slotsTaken = new Set();
  const ids = new Set();
  const claim = (slot, what) => {
    if (!inRange(slot)) problems.push(`${what} is outside slots 1..${state.slots}`);
    else if (slotsTaken.has(slot)) problems.push(`${what} shares slot ${slot}`);
    else slotsTaken.add(slot);
  };

  state.cells.forEach((cell, i) => {
    const label = `cells[${i}]`;
    if (!cell || typeof cell !== 'object') {
      problems.push(`${label} is not an object`);
      return;
    }
    if (!isInt(cell.id)) problems.push(`${label}.id is not an integer`);
    else if (ids.has(cell.id)) problems.push(`${label}.id ${cell.id} is duplicated`);
    else ids.add(cell.id);
    if (isInt(cell.id) && isInt(state.nextCellId) && cell.id >= state.nextCellId) {
      problems.push(`${label}.id is not below nextCellId`);
    }
    claim(cell.slot, `${label}.slot`);
    const g = cell.genotype;
    if (!g || typeof g !== 'object') problems.push(`${label}.genotype is missing`);
    else {
      for (const trait of Object.keys(CONFIG.traits)) {
        if (!finite(g[trait]) || g[trait] <= 0) problems.push(`${label}.genotype.${trait} is not a positive number`);
      }
    }
    if (!isInt(cell.generation) || cell.generation < 0) problems.push(`${label}.generation is not an integer >= 0`);
    if (cell.parentId !== null && !isInt(cell.parentId)) problems.push(`${label}.parentId is not an integer or null`);
    if (cell.division !== null) {
      const d = cell.division;
      if (!d || typeof d !== 'object') problems.push(`${label}.division is not an object or null`);
      else {
        if (!finite(d.completesAtMs)) problems.push(`${label}.division.completesAtMs is not finite`);
        claim(d.reservedSlot, `${label}.division.reservedSlot`);
      }
    }
  });
  return problems;
}

// ---- Storage ------------------------------------------------------------------------

// Even reading `localStorage` can throw (e.g. a SecurityError when site data is blocked).
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Result: { ok: true } or { ok: false, reason, error? }. Never throws.
//   reason: 'storageUnavailable' | 'invalidState' | 'newerSaveExists' | 'writeFailed'
export function saveGame(state, { storage = defaultStorage(), config = CONFIG } = {}) {
  if (!storage) return { ok: false, reason: 'storageUnavailable' };
  const problems = validate(state);
  if (problems.length) return { ok: false, reason: 'invalidState', error: problems.join('; ') };
  try {
    // Don't overwrite a save written by a newer build (e.g. this tab is a cached old
    // version of the page): that would silently destroy the player's newer game.
    const existing = storage.getItem(config.saveKey);
    if (existing !== null && newerThan(existing, config.schemaVersion)) {
      return { ok: false, reason: 'newerSaveExists' };
    }
    storage.setItem(config.saveKey, serialize(state));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'writeFailed', error: String(error) };
  }
}

function newerThan(json, version) {
  try {
    return deserialize(json).schemaVersion > version;
  } catch {
    return false; // unparseable: corrupt, not newer; loadGame has already backed it up
  }
}

// The full load path. Never throws. Returns { state, status, detail?, elapsedMs? }:
//   'fresh'              no save present; new game
//   'loaded'             valid save, caught up by elapsedMs
//   'migrated'           older schema, upgraded, then caught up
//   'corrupt'            unparseable or invalid; blob kept under <saveKey>.corrupt; new game
//   'futureVersion'      save is from a newer build; state is null, storage is untouched,
//                        and the caller must not start a game over it
//   'storageUnavailable' storage missing or unreadable; new game (saves will fail too)
export function loadGame({ storage = defaultStorage(), nowMs, seed = nowMs, config = CONFIG } = {}) {
  const fresh = () => createInitialState({ nowMs, seed: toSeed(seed) }, config);
  if (!storage) return { state: fresh(), status: 'storageUnavailable' };

  let json;
  try {
    json = storage.getItem(config.saveKey);
  } catch (error) {
    return { state: fresh(), status: 'storageUnavailable', detail: String(error) };
  }
  if (json === null || json === undefined) return { state: fresh(), status: 'fresh' };

  let saved;
  try {
    saved = deserialize(json);
  } catch (error) {
    return corrupt(storage, json, `unparseable: ${error.message}`, fresh, config);
  }
  if (!saved || typeof saved !== 'object' || !Number.isInteger(saved.schemaVersion)) {
    return corrupt(storage, json, 'no integer schemaVersion', fresh, config);
  }

  const fromVersion = saved.schemaVersion;
  try {
    saved = migrate(saved, { targetVersion: config.schemaVersion });
  } catch (error) {
    if (error instanceof FutureVersionError) {
      return { state: null, status: 'futureVersion', detail: error.message };
    }
    return corrupt(storage, json, error.message, fresh, config);
  }

  const problems = validate(saved);
  if (problems.length) return corrupt(storage, json, problems.join('; '), fresh, config);

  // Offline catch-up. A clock that moved backwards gives a negative elapsed, which
  // advance() treats as 0: the simulation waits until the wall clock passes lastUpdateMs.
  const elapsedMs = nowMs - saved.lastUpdateMs;
  return {
    state: advance(saved, elapsedMs, config),
    status: fromVersion < config.schemaVersion ? 'migrated' : 'loaded',
    elapsedMs,
  };
}

function corrupt(storage, json, detail, fresh, config) {
  try {
    storage.setItem(`${config.saveKey}.corrupt`, json);
  } catch {
    detail += ' (backup to .corrupt also failed)';
  }
  return { state: fresh(), status: 'corrupt', detail };
}
