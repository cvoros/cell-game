import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { advance } from '../src/advance.js';
import { divide } from '../src/actions.js';
import { createInitialState } from '../src/state.js';
import {
  deserialize,
  loadGame,
  migrate,
  saveGame,
  serialize,
  validate,
} from '../src/save.js';
import { HOUR, makeCell, makeState } from './helpers.js';

const KEY = CONFIG.saveKey;
const T0 = Date.UTC(2026, 8, 22, 8); // an arbitrary fixed "now"

// In-memory stand-in for localStorage.
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

// A mid-game state with real rolls behind it: dividing cells, events, an advanced seed.
function midGame() {
  let s = createInitialState({ nowMs: T0, seed: 2026 });
  s = divide(s, 1);
  s = advance(s, 6 * HOUR);
  s = divide(s, s.cells[0].id);
  return advance(s, 2 * HOUR);
}

test('serialize/deserialize round-trips to a deeply equal plain object', () => {
  const s = midGame();
  assert.deepEqual(deserialize(serialize(s)), s);
});

test('save then load with zero elapsed returns a deeply equal state', () => {
  const s = midGame();
  const storage = fakeStorage();
  assert.deepEqual(saveGame(s, { storage }), { ok: true });
  const loaded = loadGame({ storage, nowMs: s.lastUpdateMs });
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.elapsedMs, 0);
  assert.deepEqual(loaded.state, s);
});

test('no save present returns a fresh initial state', () => {
  const loaded = loadGame({ storage: fakeStorage(), nowMs: T0, seed: 5 });
  assert.equal(loaded.status, 'fresh');
  assert.deepEqual(loaded.state, createInitialState({ nowMs: T0, seed: 5 }));
});

test('unparseable JSON: fresh state, bad blob kept under the corrupt key', () => {
  const storage = fakeStorage({ [KEY]: '{"pool": 12, "cells": [' });
  const loaded = loadGame({ storage, nowMs: T0, seed: 5 });
  assert.equal(loaded.status, 'corrupt');
  assert.match(loaded.detail, /unparseable/);
  assert.deepEqual(loaded.state, createInitialState({ nowMs: T0, seed: 5 }));
  assert.equal(storage.getItem(`${KEY}.corrupt`), '{"pool": 12, "cells": [');
});

test('parseable but structurally invalid saves are treated as corrupt too', () => {
  const bad = { ...midGame(), pool: 'lots' };
  const storage = fakeStorage({ [KEY]: JSON.stringify(bad) });
  const loaded = loadGame({ storage, nowMs: T0 });
  assert.equal(loaded.status, 'corrupt');
  assert.match(loaded.detail, /pool/);
  assert.equal(storage.getItem(`${KEY}.corrupt`), JSON.stringify(bad));
});

test('validate() accepts real states', () => {
  assert.deepEqual(validate(createInitialState({ nowMs: T0, seed: 1 })), []);
  assert.deepEqual(validate(midGame()), []);
});

test('validate() rejects structurally invalid saves', () => {
  const good = () => makeState({ pool: 10, cells: [makeCell(1, 1), makeCell(2, 2)] });
  assert.deepEqual(validate(good()), []);

  const missing = good();
  delete missing.rngSeed;
  assert.match(validate(missing).join(), /rngSeed/);

  // NaN can't survive JSON (it becomes null), so check both forms.
  assert.match(validate({ ...good(), pool: NaN }).join(), /pool/);
  assert.match(validate(deserialize(serialize({ ...good(), pool: NaN }))).join(), /pool/);

  const shared = good();
  shared.cells[1].slot = 1;
  assert.match(validate(shared).join(), /shares slot 1/);

  const outside = good();
  outside.cells[1].slot = 12;
  assert.match(validate(outside).join(), /outside slots 1\.\.9/);

  const reservedClash = good();
  reservedClash.cells[0].division = { completesAtMs: 0, reservedSlot: 2 };
  assert.match(validate(reservedClash).join(), /shares slot 2/); // a reserved slot counts as taken

  const dupId = good();
  dupId.cells[1].id = 1;
  assert.match(validate(dupId).join(), /duplicated/);

  const badTrait = good();
  badTrait.cells[0].genotype.uptake = -1;
  assert.match(validate(badTrait).join(), /uptake/);

  assert.deepEqual(validate(null), ['save is not an object']);
  assert.deepEqual(validate([]), ['save is not an object']);
});

test('a future schemaVersion is refused, not migrated, and storage is left alone', () => {
  const future = { ...midGame(), schemaVersion: CONFIG.schemaVersion + 1, somethingNew: true };
  const json = JSON.stringify(future);
  const storage = fakeStorage({ [KEY]: json });
  const loaded = loadGame({ storage, nowMs: T0 });
  assert.equal(loaded.status, 'futureVersion');
  assert.equal(loaded.state, null);
  assert.equal(storage.getItem(KEY), json);
  assert.equal(storage.getItem(`${KEY}.corrupt`), null);
  // And an older build won't overwrite it.
  const result = saveGame(createInitialState({ nowMs: T0, seed: 1 }), { storage });
  assert.deepEqual(result, { ok: false, reason: 'newerSaveExists' });
  assert.equal(storage.getItem(KEY), json);
});

test('the migration chain runs each step in order and refuses gaps', () => {
  const chain = {
    1: (s) => ({ ...s, schemaVersion: 2, a: 'added in v2' }),
    2: (s) => ({ ...s, schemaVersion: 3, b: `${s.a}, then v3` }),
  };
  const out = migrate({ schemaVersion: 1 }, { migrations: chain, targetVersion: 3 });
  assert.deepEqual(out, { schemaVersion: 3, a: 'added in v2', b: 'added in v2, then v3' });
  assert.throws(() => migrate({ schemaVersion: 0 }, { migrations: chain, targetVersion: 3 }), /no migration from schema v0/);
  assert.throws(() => migrate({ schemaVersion: 4 }, { migrations: chain, targetVersion: 3 }), /newer than this build/);
});

// A real v1 save, frozen as written by the session-2c build. Don't regenerate it from
// today's code: the point is to prove that yesterday's saves still load.
const V1_SAVE = Object.freeze({
  schemaVersion: 1,
  lastUpdateMs: 1789891200000,
  pool: 14.4,
  slots: 9,
  cells: [
    { id: 3, slot: 1, genotype: { uptake: 1.043, divisionHours: 5.71 }, generation: 1, parentId: 1, division: null },
    {
      id: 2,
      slot: 5,
      genotype: { uptake: 1, divisionHours: 6 },
      generation: 1,
      parentId: 1,
      division: { completesAtMs: 1789902000000, reservedSlot: 2 },
    },
  ],
  nextCellId: 4,
  rngSeed: 3056214129,
  events: [
    { atMs: 1789869600000, type: 'divisionStarted', cellId: 1, slot: 5, reservedSlot: 1, cost: 12 },
    {
      atMs: 1789891200000,
      type: 'split',
      parentId: 1,
      daughters: [
        { slot: 5, viable: true, id: 2, mutations: [] },
        { slot: 1, viable: true, id: 3, mutations: [{ trait: 'uptake', delta: 0.043 }] },
      ],
    },
  ],
});

test('v1 -> v2 migration adds sessionNumber 0 and preserves everything else', () => {
  const migrated = migrate(structuredClone(V1_SAVE));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.sessionNumber, 0);
  const { schemaVersion: _a, sessionNumber: _b, ...rest } = migrated;
  const { schemaVersion: _c, ...original } = V1_SAVE;
  assert.deepEqual(rest, original);
  assert.deepEqual(validate(migrated), []);
});

test('a v1 save loads through the migration and is caught up', () => {
  const storage = fakeStorage({ [KEY]: JSON.stringify(V1_SAVE) });
  const loaded = loadGame({ storage, nowMs: V1_SAVE.lastUpdateMs + 12 * HOUR });
  assert.equal(loaded.status, 'migrated');
  assert.equal(loaded.state.schemaVersion, CONFIG.schemaVersion);
  assert.equal(loaded.state.sessionNumber, 0);
  const expected = advance(migrate(structuredClone(V1_SAVE)), 12 * HOUR);
  assert.deepEqual(loaded.state, expected);
  // Saving it writes a v2 save; loading that is a plain load.
  saveGame(loaded.state, { storage });
  assert.equal(loadGame({ storage, nowMs: loaded.state.lastUpdateMs }).status, 'loaded');
});

test('validate() requires sessionNumber in v2 saves', () => {
  const s = createInitialState({ nowMs: T0, seed: 1 });
  delete s.sessionNumber;
  assert.match(validate(s).join(), /sessionNumber/);
});

test('an older save with no migration path is corrupt, not guessed at', () => {
  const old = { ...midGame(), schemaVersion: 0 };
  const loaded = loadGame({ storage: fakeStorage({ [KEY]: JSON.stringify(old) }), nowMs: T0 });
  assert.equal(loaded.status, 'corrupt');
  assert.match(loaded.detail, /no migration from schema v0/);
});

test('offline catch-up: loaded 12 h later equals advance(state, 12 h) exactly', () => {
  const s = midGame();
  const storage = fakeStorage();
  saveGame(s, { storage });
  const loaded = loadGame({ storage, nowMs: s.lastUpdateMs + 12 * HOUR });
  const expected = advance(s, 12 * HOUR);
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.elapsedMs, 12 * HOUR);
  assert.equal(loaded.state.pool, expected.pool);
  assert.equal(loaded.state.rngSeed, expected.rngSeed);
  assert.deepEqual(loaded.state.cells, expected.cells);
  assert.deepEqual(loaded.state, expected);
  assert.notEqual(loaded.state.rngSeed, s.rngSeed, 'fissions happened during the absence');
});

test('a clock moved backwards is treated as 0 elapsed and leaves the state intact', () => {
  const s = midGame();
  const storage = fakeStorage();
  saveGame(s, { storage });
  const loaded = loadGame({ storage, nowMs: s.lastUpdateMs - 5 * HOUR });
  assert.equal(loaded.status, 'loaded');
  assert.equal(loaded.elapsedMs, -5 * HOUR);
  assert.deepEqual(loaded.state, s);
  assert.deepEqual(validate(loaded.state), []);
});

test('a 30-day absence is fast and ends with the pool at the cap', () => {
  const s = midGame();
  const storage = fakeStorage();
  saveGame(s, { storage });
  const started = performance.now();
  const loaded = loadGame({ storage, nowMs: s.lastUpdateMs + 30 * 24 * HOUR });
  const took = performance.now() - started;
  assert.ok(took < 100, `catch-up took ${took.toFixed(1)} ms`);
  assert.equal(loaded.state.pool, CONFIG.storagePerCell * CONFIG.membraneSlots);
  assert.equal(loaded.state.cells.filter((c) => c.division).length, 0);
});

test('storage that throws on read is handled without throwing', () => {
  const storage = {
    getItem: () => {
      throw new Error('SecurityError: access denied');
    },
    setItem: () => {
      throw new Error('SecurityError: access denied');
    },
  };
  const loaded = loadGame({ storage, nowMs: T0, seed: 5 });
  assert.equal(loaded.status, 'storageUnavailable');
  assert.deepEqual(loaded.state, createInitialState({ nowMs: T0, seed: 5 }));
  const saved = saveGame(loaded.state, { storage });
  assert.equal(saved.ok, false);
  assert.equal(saved.reason, 'writeFailed');
});

test('storage that throws on write (quota) is reported, not thrown', () => {
  const storage = fakeStorage();
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  const result = saveGame(midGame(), { storage });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'writeFailed');
  assert.match(result.error, /QuotaExceededError/);
});

test('a corrupt save whose backup write also fails still returns a fresh game', () => {
  const storage = fakeStorage({ [KEY]: 'not json' });
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  const loaded = loadGame({ storage, nowMs: T0 });
  assert.equal(loaded.status, 'corrupt');
  assert.match(loaded.detail, /backup to \.corrupt also failed/);
  assert.ok(loaded.state);
});

test('no storage at all is reported, not thrown', () => {
  assert.equal(loadGame({ storage: null, nowMs: T0 }).status, 'storageUnavailable');
  assert.deepEqual(saveGame(midGame(), { storage: null }), { ok: false, reason: 'storageUnavailable' });
});

test('saveGame refuses to write an invalid state', () => {
  const result = saveGame({ ...midGame(), pool: -3 }, { storage: fakeStorage() });
  assert.equal(result.reason, 'invalidState');
});
