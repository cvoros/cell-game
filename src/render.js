// The ASCII renderer: render(viewModel) -> string. Pure, and deliberately ignorant: it
// imports nothing, so it cannot reach game state, rules, config, storage or the DOM.
// Everything it shows arrives in the view model (view.js). The layout follows the
// design.md §13.11 sketch.
//
// hitTest(viewModel, row, col) maps a character position back to what is drawn there,
// so clicks and taps work without the renderer knowing about the DOM.

// Every number in this file lives here. These are layout, not game rules.
const LAYOUT = Object.freeze({
  width: 72,
  gridColumns: 3,
  dishLines: 11, // the dish, including one line of open water above and below
  boxTop: 1, // dish-relative lines of the membrane border
  boxBottom: 9,
  boxLeft: 11,
  boxWidth: 31,
  slotLines: [3, 5, 7], // dish-relative line of each grid row
  slotCenters: [5, 15, 25], // box-relative column of each grid column
  slotHitReach: 4, // columns either side of a glyph that still select it
  dotClearance: 1, // columns kept clear of dots beside the membrane
  maxDots: 40,
  dotHash: [73856093, 19349663, 83492791],
  logLines: 4,
  messageLines: 2,
  columns: { slot: 5, id: 5, gen: 3, intake: 6, upkeep: 6, net: 6, divTime: 8 },
  hintGap: 3,
});

// Empty slots get a glyph of their own so all nine positions (and tap targets) show at
// all times; '-' is never used for nutrient dots, which only appear outside the membrane.
const GLYPHS = Object.freeze({ cell: 'o', dividing: '8', reserved: '?', empty: '-' });

export function render(viewModel) {
  return layout(viewModel).lines.join('\n');
}

// Returns { type: 'select', slot } | { type: 'key', key } | null.
export function hitTest(viewModel, row, col) {
  const hit = layout(viewModel).hits.find((h) => h.row === row && col >= h.from && col <= h.to);
  return hit ? hit.action : null;
}

// ---- Layout -------------------------------------------------------------------------

function layout(vm) {
  const out = { lines: [], hits: [] };
  if (vm.screen === 'outdated') {
    for (const line of vm.lines) {
      const wrapped = wrap(line, LAYOUT.width - 1);
      if (wrapped.length === 0) text(out, '');
      for (const part of wrapped) text(out, ` ${part}`);
    }
  } else if (vm.screen === 'rules' || vm.screen === 'help') {
    header(out, vm);
    for (const line of vm.lines) text(out, ` ${line}`);
    text(out, '');
    const back = ' [esc] back';
    out.hits.push({ row: out.lines.length, from: 0, to: back.length, action: { type: 'key', key: 'Escape' } });
    text(out, back);
  } else {
    game(out, vm);
  }
  out.lines = out.lines.map((line) => line.slice(0, LAYOUT.width).trimEnd());
  return out;
}

function game(out, vm) {
  header(out, vm);
  dish(out, vm);
  rule(out, '=');
  text(out, ` nutrients  ${vm.poolText}     ${vm.rateText}     ${vm.fillText}`);
  text(out, ` cells ${vm.cellsText}    dividing ${vm.dividingText}    highest generation ${vm.generationText}`);
  rule(out, '-');
  text(out, listRow({ slot: 'slot', id: 'cell', gen: 'gen', intake: 'intake', upkeep: 'upkeep', net: 'net', divTime: 'div time', state: 'state' }));
  for (const row of vm.rows) {
    out.hits.push({ row: out.lines.length, from: 0, to: LAYOUT.width, action: { type: 'select', slot: Number(row.slot) } });
    text(out, listRow(row));
  }
  rule(out, '-');
  // Controls sit at a fixed row directly under the list. What varies in length (the
  // message, the log) comes after them, so nothing above ever moves and no space is
  // held open for lines that don't exist yet.
  hints(out, vm);
  for (const line of wrap(vm.message, LAYOUT.width - 1).slice(0, LAYOUT.messageLines)) text(out, ` ${line}`);
  rule(out, '-');
  for (const entry of vm.log.slice(-LAYOUT.logLines)) text(out, ` ${entry}`);
}

function header(out, vm) {
  const left = ` ${vm.title}   ${vm.era}`;
  const right = vm.dayText ? `${vm.dayText}   ${vm.clock} ` : `${vm.clock} `;
  text(out, left + ' '.repeat(Math.max(1, LAYOUT.width - left.length - right.length)) + right);
  rule(out, '=');
  if (vm.banner) for (const line of wrap(`! ${vm.banner}`, LAYOUT.width - 1)) text(out, ` ${line}`);
}

// The membrane, its slots, and nutrient dots in the water around it.
function dish(out, vm) {
  const top = out.lines.length;
  const grid = Array.from({ length: LAYOUT.dishLines }, () => Array(LAYOUT.width).fill(' '));
  const right = LAYOUT.boxLeft + LAYOUT.boxWidth - 1;

  for (let line = LAYOUT.boxTop; line <= LAYOUT.boxBottom; line++) {
    const border = line === LAYOUT.boxTop || line === LAYOUT.boxBottom;
    grid[line][LAYOUT.boxLeft] = border ? '+' : '|';
    grid[line][right] = border ? '+' : '|';
    if (border) for (let c = LAYOUT.boxLeft + 1; c < right; c++) grid[line][c] = '-';
  }

  for (const s of vm.slots) {
    const index = s.slot - 1;
    const line = LAYOUT.slotLines[Math.floor(index / LAYOUT.gridColumns)];
    const col = LAYOUT.boxLeft + LAYOUT.slotCenters[index % LAYOUT.gridColumns];
    grid[line][col] = GLYPHS[s.glyph];
    if (s.selected) {
      grid[line][col - 1] = '[';
      grid[line][col + 1] = ']';
    }
    out.hits.push({
      row: top + line,
      from: col - LAYOUT.slotHitReach,
      to: col + LAYOUT.slotHitReach,
      action: { type: 'select', slot: s.slot },
    });
  }

  const dots = Math.round(Math.max(0, Math.min(1, vm.nutrientFill)) * LAYOUT.maxDots);
  for (const [line, col] of waterCells().slice(0, dots)) grid[line][col] = '.';

  for (const row of grid) out.lines.push(row.join(''));
}

// Positions outside the membrane, in a fixed scattered order, so dots appear one at a
// time as the pool fills instead of jumping around.
let waterCache = null;
function waterCells() {
  if (waterCache) return waterCache;
  const [a, b, c] = LAYOUT.dotHash;
  const clearLeft = LAYOUT.boxLeft - LAYOUT.dotClearance;
  const clearRight = LAYOUT.boxLeft + LAYOUT.boxWidth - 1 + LAYOUT.dotClearance;
  const cells = [];
  for (let line = 0; line < LAYOUT.dishLines; line++) {
    for (let col = 1; col < LAYOUT.width - 1; col++) {
      const besideBox = line >= LAYOUT.boxTop && line <= LAYOUT.boxBottom;
      if (besideBox && col >= clearLeft && col <= clearRight) continue;
      cells.push({ line, col, key: Math.imul(Math.imul(line, a) ^ Math.imul(col, b), c) >>> 0 });
    }
  }
  cells.sort((p, q) => p.key - q.key);
  waterCache = cells.map(({ line, col }) => [line, col]);
  return waterCache;
}

// One line of the cell list; the header and every row go through here, so the columns
// always line up. An empty or reserved slot has no measurements, so its note starts in
// the cell column instead of trailing after a run of blank columns.
function listRow(r) {
  const w = LAYOUT.columns;
  // The first column is "slot" in the header and "> 1" (marker, then number) in a row.
  const first = r.slot === 'slot' ? r.slot : `${r.selected ? '>' : ' '} ${r.slot}`;
  if (!r.id) return [' ', first.padEnd(w.slot), ' ', r.state].join('');
  return [
    ' ',
    first.padEnd(w.slot),
    ' ',
    r.id.padEnd(w.id),
    ' ',
    r.gen.padStart(w.gen),
    ' ',
    r.intake.padStart(w.intake),
    ' ',
    r.upkeep.padStart(w.upkeep),
    ' ',
    r.net.padStart(w.net),
    ' ',
    r.divTime.padStart(w.divTime),
    ' ',
    r.state,
  ].join('');
}

function hints(out, vm) {
  const items = [
    { text: '[1-9] select' },
    { text: `[d] divide ${vm.divideHint}`, key: 'd' },
    { text: `[c] cull ${vm.cullHint}`, key: 'c' },
    { text: '[i] rules', key: 'i' },
    { text: '[?] help', key: '?' },
  ];
  const row = out.lines.length;
  let line = '';
  for (const item of items) {
    line += line ? ' '.repeat(LAYOUT.hintGap) : ' ';
    if (item.key) {
      out.hits.push({ row, from: line.length, to: line.length + item.text.length - 1, action: { type: 'key', key: item.key } });
    }
    line += item.text;
  }
  text(out, line);
}

function rule(out, char) {
  text(out, ` ${char.repeat(LAYOUT.width - 1)}`);
}

function text(out, line) {
  out.lines.push(line);
}

function wrap(textToWrap, width) {
  if (!textToWrap) return [];
  const lines = [];
  let current = '';
  for (const word of textToWrap.split(' ')) {
    if (current && current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}
