import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitTest, render } from '../src/render.js';
import { outdatedViewModel } from '../src/view.js';

// A hand-built view model, so these tests exercise the renderer alone. It mirrors the
// design.md §13.11 sketch.
function fixture(overrides = {}) {
  const row = (slot, id, gen, intake, upkeep, net, divTime, state = '') => ({
    slot: String(slot), selected: slot === 1, id, gen, intake, upkeep, net, divTime, state,
  });
  const empty = (slot, state) => row(slot, '', '', '', '', '', '', state);
  return {
    screen: 'game',
    title: 'CELL-GAME',
    era: 'Era 1 · Prokaryote',
    clock: 'Tue 22 Sep  08:14',
    banner: '',
    message: '',
    slots: [
      { slot: 1, glyph: 'cell', selected: true },
      { slot: 2, glyph: 'cell', selected: false },
      { slot: 3, glyph: 'dividing', selected: false },
      { slot: 4, glyph: 'cell', selected: false },
      { slot: 5, glyph: 'reserved', selected: false },
      { slot: 6, glyph: 'cell', selected: false },
      { slot: 7, glyph: 'cell', selected: false },
      { slot: 8, glyph: 'empty', selected: false },
      { slot: 9, glyph: 'cell', selected: false },
    ],
    nutrientFill: 28.4 / 54,
    poolText: '28.4 / 54',
    rateText: '+3.3 N/h',
    fillText: 'full in 7h51m',
    cellsText: '7/9',
    dividingText: '1',
    generationText: '11',
    rows: [
      row(1, 'c41', '11', '1.42', '0.76', '+0.66', '~5h50m'),
      row(2, 'c38', '10', '1.05', '0.61', '+0.44', '~6h20m'),
      row(3, 'c44', '10', '1.18', '0.66', '+0.52', '~6h05m', 'dividing, 5h58m left'),
      row(4, 'c33', '9', '0.97', '0.59', '+0.38', '~6h10m'),
      empty(5, 'reserved (c44)'),
      row(6, 'c40', '11', '1.21', '0.62', '+0.59', '~9h25m'),
      row(7, 'c42', '11', '0.78', '0.54', '+0.24', '~6h00m'),
      empty(8, 'empty'),
      row(9, 'c39', '10', '1.10', '0.67', '+0.43', '~4h55m'),
    ],
    log: [
      'Mon 20:00  c28 split: c29 -> slot 4, c30 -> slot 2',
      'Mon 21:05  c30 split: c40 -> slot 6, c41 -> slot 1',
      '03:40      c37 split: c42 -> slot 7, a daughter was not viable',
      '08:12      c35 culled (+3 N)',
      '08:13      c44 began dividing (-12 N)',
      '08:14      welcome back (away 9h12m)',
    ],
    divideHint: '-12 N',
    cullHint: '+3 N',
    lines: [],
    ...overrides,
  };
}

const lines = (vm) => render(vm).split('\n');

test('render() is stable for a fixed view model', () => {
  assert.equal(render(fixture()), render(fixture()));
});

test('every line fits in 72 columns', () => {
  for (const vm of [fixture(), fixture({ banner: 'x '.repeat(80), message: 'y '.repeat(80) })]) {
    for (const line of lines(vm)) assert.ok(line.length <= 72, `${line.length}: ${line}`);
  }
});

test('the membrane shows all 9 slots with the documented glyphs', () => {
  const screen = lines(fixture());
  const dish = screen.slice(2, 13);
  const border = `+${'-'.repeat(29)}+`;
  assert.equal(dish[1].slice(11, 42), border, 'top border');
  assert.equal(dish[9].slice(11, 42), border, 'bottom border');
  const inside = (line) => line.slice(12, 41);
  assert.deepEqual([3, 5, 7].map((i) => inside(dish[i]).replace(/ /g, '')), ['[o]o8', 'o?o', 'oo']);
  // Slot 8 is empty: row 3 has only two glyphs, at the left and right positions.
  assert.equal(dish[7][11 + 5], 'o');
  assert.equal(dish[7][11 + 15], ' ');
  assert.equal(dish[7][11 + 25], 'o');
});

test('the selected cell is marked in both the grid and the list', () => {
  const screen = lines(fixture());
  assert.ok(screen.some((l) => l.includes('[o]')));
  const listRows = screen.filter((l) => /^ [> ]\s+\d /.test(l));
  assert.equal(listRows.length, 9);
  assert.deepEqual(listRows.filter((l) => l.startsWith(' >')).map((l) => l.trim().split(/\s+/)[1]), ['1']);
});

test('the list columns line up with the header', () => {
  const screen = lines(fixture());
  const header = screen.find((l) => l.includes('intake') && l.includes('div time'));
  const row = screen.find((l) => l.includes('c41'));
  const endOf = (line, word) => line.indexOf(word) + word.length;
  assert.equal(endOf(row, '1.42'), endOf(header, 'intake'));
  assert.equal(endOf(row, '0.76'), endOf(header, 'upkeep'));
  assert.equal(endOf(row, '+0.66'), endOf(header, 'net'));
  assert.equal(endOf(row, '~5h50m'), endOf(header, 'div time'));
  const dividing = screen.find((l) => l.includes('c44'));
  assert.equal(dividing.indexOf('dividing,'), header.indexOf('state'));
});

test('the log shows the most recent 4 entries', () => {
  const text = render(fixture());
  assert.ok(!text.includes('c28 split'));
  assert.ok(!text.includes('c30 split'));
  for (const entry of ['c37 split', 'c35 culled', 'c44 began dividing', 'welcome back']) {
    assert.ok(text.includes(entry), entry);
  }
});

test('the nutrient dots track the pool', () => {
  const dots = (fill) => render(fixture({ nutrientFill: fill })).split('\n').slice(2, 13).join('').split('.').length - 1;
  assert.equal(dots(0), 0);
  assert.equal(dots(1), 40);
  assert.ok(dots(0.5) === 20);
  // Filling adds dots without moving the existing ones.
  const half = render(fixture({ nutrientFill: 0.5 })).split('\n');
  const more = render(fixture({ nutrientFill: 0.6 })).split('\n');
  half.slice(2, 13).forEach((line, i) =>
    [...line].forEach((ch, c) => ch === '.' && assert.equal(more[2 + i][c], '.')),
  );
});

test('banners and messages are drawn; the hint line carries the costs', () => {
  const text = render(fixture({ banner: 'Saving failed.', message: 'Press c again to cull c41.' }));
  assert.ok(text.includes('! Saving failed.'));
  assert.ok(text.includes('Press c again to cull c41.'));
  assert.match(text.split('\n').at(-1), /\[d\] divide -12 N {3}\[c\] cull \+3 N/);
});

test('hitTest maps grid slots, list rows and command hints', () => {
  const vm = fixture();
  const screen = lines(vm);
  const at = (needle, row) => [row, screen[row].indexOf(needle)];
  const gridRow = 2 + 5; // header, rule, then dish line 5 (the middle grid row)
  assert.deepEqual(hitTest(vm, gridRow, 11 + 15), { type: 'select', slot: 5 });
  const c39 = screen.findIndex((l) => l.includes('c39'));
  assert.deepEqual(hitTest(vm, ...at('c39', c39)), { type: 'select', slot: 9 });
  const last = screen.length - 1;
  assert.deepEqual(hitTest(vm, ...at('[d]', last)), { type: 'key', key: 'd' });
  assert.deepEqual(hitTest(vm, ...at('[c]', last)), { type: 'key', key: 'c' });
  assert.deepEqual(hitTest(vm, ...at('[?]', last)), { type: 'key', key: '?' });
  assert.equal(hitTest(vm, 0, 0), null);
});

test('every screen fits in 72 columns without losing words', () => {
  const detail = 'save is from schema v99, newer than this build (v2)';
  const outdated = outdatedViewModel(detail);
  const text = render(outdated);
  for (const line of text.split('\n')) assert.ok(line.length <= 72, `${line.length}: ${line}`);
  const words = (s) => s.split(/\s+/).filter(Boolean);
  assert.deepEqual(words(text), words(outdated.lines.join(' ')), 'wrapping must not drop or cut words');
});

test('the out-of-date screen shows the message and nothing of the game', () => {
  const text = render(outdatedViewModel('save is from schema v3'));
  assert.match(text, /OUT OF DATE/);
  assert.match(text, /Reload the page/);
  assert.doesNotMatch(text, /nutrients|\+-{10}|\[d\]/);
});

test('rules and help screens have a way back', () => {
  const vm = fixture({ screen: 'help', lines: ['CONTROLS'] });
  const screen = lines(vm);
  const back = screen.findIndex((l) => l.includes('[esc] back'));
  assert.deepEqual(hitTest(vm, back, 2), { type: 'key', key: 'Escape' });
});
