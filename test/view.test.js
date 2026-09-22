import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { beginSession, colonyNet, netRate, upkeep } from '../src/state.js';
import { buildViewModel, formatDuration, observe } from '../src/view.js';
import { HOUR, deepFreeze, makeCell, makeState } from './helpers.js';

const UI = { selectedSlot: 1, formatTime: (ms) => `t${ms / HOUR}h`, formatDate: () => 'Tue 22 Sep  08:14' };

function colony(sessionNumber = 3) {
  const s = makeState({
    pool: 28.4,
    cells: [
      makeCell(41, 1, { uptake: 1.42, divisionHours: 5.8 }),
      makeCell(38, 2, { uptake: 1.05, divisionHours: 6.3 }),
      makeCell(44, 3, { uptake: 1.18, divisionHours: 6.1 }, { division: { completesAtMs: 6 * HOUR, reservedSlot: 5 } }),
      makeCell(40, 6, { uptake: 1.2345678901, divisionHours: 7.6543210987 }),
    ],
  });
  s.sessionNumber = sessionNumber;
  return s;
}

test('observe() is deterministic per (cell id, session) and redraws each session', () => {
  const cell = makeCell(7, 1, { uptake: 1.3, divisionHours: 5 });
  assert.deepEqual(observe(cell, 4), observe(cell, 4));
  assert.notDeepEqual(observe(cell, 4), observe(cell, 5));
  assert.notDeepEqual(observe(cell, 4), observe(makeCell(8, 1, cell.genotype), 4));
});

test('the view model is identical across repeated calls within a session', () => {
  const s = colony();
  assert.deepEqual(buildViewModel(s, UI), buildViewModel(s, UI));
});

test('a new session number changes the measured values', () => {
  const a = buildViewModel(colony(3), UI).rows.filter((r) => r.id);
  const b = buildViewModel(colony(4), UI).rows.filter((r) => r.id);
  assert.notDeepEqual(
    a.map((r) => [r.intake, r.upkeep, r.divTime]),
    b.map((r) => [r.intake, r.upkeep, r.divTime]),
  );
});

test('display noise has the configured spread (SD 5%, centred on the true value)', () => {
  const n = 4000;
  const ratios = [];
  for (let id = 1; id <= n; id++) ratios.push(observe(makeCell(id, 1), 1).intake / CONFIG.traits.uptake.base);
  const mean = ratios.reduce((s, r) => s + r, 0) / n;
  const sd = Math.sqrt(ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / n);
  assert.ok(Math.abs(mean - 1) < 0.005, `mean ${mean}`);
  assert.ok(Math.abs(sd - CONFIG.displayNoise) < 0.004, `sd ${sd}`);
});

test('the view model never carries genotype', () => {
  const s = colony();
  const vm = buildViewModel(s, UI);
  const json = JSON.stringify(vm);
  assert.doesNotMatch(json, /genotype|uptake|divisionHours|rngSeed|mutations/);

  // No number anywhere in the view model equals a raw trait or a true upkeep value.
  const secrets = s.cells.flatMap((c) => [c.genotype.uptake, c.genotype.divisionHours, upkeep(c.genotype)]);
  const numbers = [];
  (function collect(v) {
    if (typeof v === 'number') numbers.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(collect);
  })(vm);
  for (const secret of secrets) assert.ok(!numbers.includes(secret), `leaked ${secret}`);
  for (const secret of ['1.2345678901', '7.6543210987']) assert.ok(!json.includes(secret), `leaked ${secret}`);

  // And the shown values really are measurements, not rounded truth.
  const shown = vm.rows.filter((r) => r.id).map((r) => r.intake);
  const truth = s.cells.map((c) => c.genotype.uptake.toFixed(2));
  assert.notDeepEqual(shown, truth);
});

test('the view model lists every slot, marks the selection, and shows reservations', () => {
  const vm = buildViewModel(colony(), UI);
  assert.equal(vm.slots.length, 9);
  assert.equal(vm.rows.length, 9);
  assert.deepEqual(vm.slots.filter((s) => s.selected).map((s) => s.slot), [1]);
  assert.equal(vm.slots[2].glyph, 'dividing');
  assert.equal(vm.slots[4].glyph, 'reserved');
  assert.equal(vm.rows[4].state, 'reserved for a daughter of c44');
  assert.equal(vm.rows[2].state, 'splits in 6h00m');
  assert.equal(vm.rows[8].state, 'empty');
  assert.equal(vm.poolText, '28.4 / 54');
});

// ---- Aggregates are measurements too (§13.8) ---------------------------------------

const rateOf = (vm) => Number(vm.rateText.replace(' N/h', ''));
const displayedNets = (vm) => vm.rows.filter((r) => r.id).map((r) => Number(r.net));

test('with one cell, the header rate is not the true net rate', () => {
  const s = makeState({ pool: 36, cells: [makeCell(1, 5)] });
  s.sessionNumber = 1;
  const vm = buildViewModel(s, UI);
  const trueNet = netRate(s.cells[0].genotype);
  assert.notEqual(rateOf(vm), Number(trueNet.toFixed(2)), 'header must not reveal the true net');
  assert.notEqual(vm.rateText, `+${trueNet.toFixed(2)} N/h`);
  assert.notEqual(vm.rateText, `+${trueNet.toFixed(1)} N/h`);
  // It is exactly the one displayed per-cell net.
  assert.equal(rateOf(vm), displayedNets(vm)[0]);
});

test('the header rate equals the sum of the displayed per-cell nets', () => {
  for (const session of [1, 2, 3, 4, 5]) {
    const vm = buildViewModel(colony(session), UI);
    const sum = displayedNets(vm).reduce((a, b) => a + b, 0);
    assert.equal(rateOf(vm).toFixed(2), sum.toFixed(2), `session ${session}`);
    assert.notEqual(rateOf(vm).toFixed(2), colonyNet(colony(session)).toFixed(2), 'not the true total');
  }
});

test('"full in" follows from the displayed rate, not the true one', () => {
  for (const session of [1, 2, 3, 4, 5]) {
    const s = colony(session);
    const vm = buildViewModel(s, UI);
    const expected = formatDuration((54 - s.pool) / rateOf(vm));
    assert.equal(vm.fillText, `full in ${expected}`, `session ${session}`);
  }
  // A full pool says so whatever the rate.
  const full = colony();
  full.pool = 54;
  assert.equal(buildViewModel(full, UI).fillText, 'full');
});

test('a negative measured rate reports when the pool empties', () => {
  const s = makeState({ pool: 2, cells: [makeCell(1, 5, { uptake: 0.2 })] });
  s.sessionNumber = 1;
  const vm = buildViewModel(s, UI);
  assert.ok(rateOf(vm) < 0);
  assert.equal(vm.fillText, `empty in ${formatDuration(2 / -rateOf(vm))}`);
});

// ---- Day count ------------------------------------------------------------------------

test('the day count starts at day 1 and turns over every 24 h of play', () => {
  const day = (hoursIn) => {
    const s = colony();
    s.startedAtMs = 0;
    s.lastUpdateMs = hoursIn * HOUR;
    return buildViewModel(s, UI).dayText;
  };
  assert.equal(day(0), 'day 1');
  assert.equal(day(23.9), 'day 1');
  assert.equal(day(24), 'day 2');
  assert.equal(day(24 * 9 + 5), 'day 10');
});

test('formatDuration rounds to minutes', () => {
  assert.equal(formatDuration(0), '0h00m');
  assert.equal(formatDuration(7.85), '7h51m');
  assert.equal(formatDuration(5 + 58 / 60), '5h58m');
  assert.equal(formatDuration(-1), '0h00m');
});

test('beginSession counts the session, logs how the load went, and is pure', () => {
  const s = deepFreeze(colony(3));
  const next = beginSession(s, { status: 'loaded', elapsedMs: 9 * HOUR });
  assert.equal(next.sessionNumber, 4);
  assert.deepEqual(next.events.at(-1), {
    atMs: s.lastUpdateMs,
    type: 'session',
    sessionNumber: 4,
    status: 'loaded',
    elapsedMs: 9 * HOUR,
  });
  assert.equal(s.sessionNumber, 3);
  const vm = buildViewModel(next, UI);
  assert.match(vm.log.at(-1), /welcome back \(away 9h00m\)/);
});

test('rules and help screens carry their lines; rules quote the config', () => {
  const rules = buildViewModel(colony(), { ...UI, screen: 'rules' }).lines.join('\n');
  assert.match(rules, /cap: 6 N per slot x 9 slots = 54 N/);
  assert.match(rules, /0\.3 \+ 0\.15 x uptake\^2 \+ 0\.9 \/ division time/);
  assert.match(rules, /3% not viable/);
  assert.match(rules, /38% harmful \(-25% to -2%\)/);
  assert.ok(buildViewModel(colony(), { ...UI, screen: 'help' }).lines.length > 0);
});

test('rules and help lines fit the 72-column screen (71 plus the margin)', () => {
  for (const screen of ['rules', 'help']) {
    for (const line of buildViewModel(colony(), { ...UI, screen }).lines) {
      assert.ok(line.length <= 71, `${screen} line is ${line.length} wide: ${line}`);
    }
  }
});
