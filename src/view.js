// Builds the view model: everything the screen shows, as display-ready data. Pure: no
// DOM, no storage, no clock (times are formatted by functions the caller passes in).
//
// This is where genotype becomes phenotype (§13.8). Nothing on screen is a true
// value; everything is a measurement. Per-cell values carry noise, and every aggregate
// shown (the colony rate, "full in") is built from those measured values, never from
// the true ones, so a total can't be used to back out a cell's traits. Mutations are
// never mentioned either: a player could see a daughter die, but not which of its genes
// changed.

import { CONFIG } from './config.js';
import { hashSeed, nextGaussian } from './rng.js';
import { cap, upkeep } from './state.js';

// Display formats. Presentation, not tuning, so they live here rather than in config.
const FORMAT = Object.freeze({
  minutesPerHour: 60,
  hoursPerDay: 24,
  minuteDigits: 2,
  percent: 100,
  poolDecimals: 1,
  cellDecimals: 2,
  logTimeWidth: 10,
});

// ---- §13.8 measurement --------------------------------------------------------------

// One cell's measured values for one session. Seeded by (cell id, session number), so
// every look within a session agrees and each new session is a fresh measurement.
// Draw order is fixed: intake, upkeep, division time.
export function observe(cell, sessionNumber, config = CONFIG) {
  let seed = hashSeed(cell.id, sessionNumber);
  const measure = (value) => {
    const [z, next] = nextGaussian(seed);
    seed = next;
    return value * (1 + config.displayNoise * z);
  };
  const intake = measure(cell.genotype.uptake);
  const cost = measure(upkeep(cell.genotype, config));
  const divisionHours = measure(cell.genotype.divisionHours);
  return { intake, upkeep: cost, net: intake - cost, divisionHours };
}

// ---- Formatting ---------------------------------------------------------------------

export function formatDuration(hours) {
  const total = Math.max(0, Math.round(hours * FORMAT.minutesPerHour));
  const h = Math.floor(total / FORMAT.minutesPerHour);
  const m = String(total % FORMAT.minutesPerHour).padStart(FORMAT.minuteDigits, '0');
  return `${h}h${m}m`;
}

const signed = (x, digits) => `${x >= 0 ? '+' : '-'}${Math.abs(x).toFixed(digits)}`;
const amount = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(FORMAT.poolDecimals));
const pct = (x) => `${Math.round(x * FORMAT.percent)}%`;
const label = (id) => `c${id}`;

// ---- The game screen ----------------------------------------------------------------

// ui: { selectedSlot, screen: 'game'|'rules'|'help', message, banner,
//       formatTime(ms) -> short time for the log, formatDate(ms) -> header clock }
export function buildViewModel(state, ui = {}, config = CONFIG) {
  const {
    selectedSlot = null,
    screen = 'game',
    message = '',
    banner = '',
    formatTime = String,
    formatDate = String,
  } = ui;
  const hour = config.msPerHour;
  const now = state.lastUpdateMs;
  const capacity = cap(state, config);
  let measuredRate = 0; // sum of the displayed per-cell nets, as displayed

  const slots = [];
  const rows = [];
  for (let slot = 1; slot <= state.slots; slot++) {
    const cell = state.cells.find((c) => c.slot === slot);
    const reservedBy = state.cells.find((c) => c.division && c.division.reservedSlot === slot);
    const selected = slot === selectedSlot;
    let glyph = 'empty';
    if (cell) glyph = cell.division ? 'dividing' : 'cell';
    else if (reservedBy) glyph = 'reserved';
    slots.push({ slot, glyph, selected });

    if (cell) {
      const seen = observe(cell, state.sessionNumber, config);
      rows.push({
        slot: String(slot),
        selected,
        id: label(cell.id),
        gen: String(cell.generation),
        intake: seen.intake.toFixed(FORMAT.cellDecimals),
        upkeep: seen.upkeep.toFixed(FORMAT.cellDecimals),
        net: signed(seen.net, FORMAT.cellDecimals),
        divTime: `~${formatDuration(seen.divisionHours)}`,
        // Remaining time is exact: a player can watch a division finish.
        state: cell.division
          ? `splits in ${formatDuration((cell.division.completesAtMs - now) / hour)}`
          : '',
      });
      measuredRate += Number(seen.net.toFixed(FORMAT.cellDecimals));
    } else {
      rows.push({
        slot: String(slot),
        selected,
        id: '',
        gen: '',
        intake: '',
        upkeep: '',
        net: '',
        divTime: '',
        state: reservedBy ? `reserved for a daughter of ${label(reservedBy.id)}` : 'empty',
      });
    }
  }

  return {
    screen,
    title: 'CELL-GAME',
    era: 'Era 1 · Prokaryote',
    dayText: `day ${Math.floor((now - state.startedAtMs) / hour / FORMAT.hoursPerDay) + 1}`,
    clock: formatDate(now),
    banner,
    message,
    slots,
    nutrientFill: capacity > 0 ? Math.min(1, state.pool / capacity) : 0,
    poolText: `${state.pool.toFixed(FORMAT.poolDecimals)} / ${amount(capacity)}`,
    // Measured, not true: the sum of the per-cell nets shown in the list, to the same
    // precision, and "full in" follows from it, so the header and the list agree.
    rateText: `${signed(measuredRate, FORMAT.cellDecimals)} N/h`,
    fillText: fillText(state.pool, capacity, measuredRate),
    cellsText: `${state.cells.length}/${state.slots}`,
    dividingText: String(state.cells.filter((c) => c.division).length),
    generationText: String(Math.max(0, ...state.cells.map((c) => c.generation))),
    rows,
    log: state.events.map(
      (e) => `${formatTime(e.atMs).padEnd(FORMAT.logTimeWidth)} ${describeEvent(e, config)}`,
    ),
    divideHint: `-${amount(config.divisionCost)} N`,
    cullHint: `+${amount(config.cullRefund)} N`,
    lines: screen === 'rules' ? rulesLines(config) : screen === 'help' ? helpLines() : [],
  };
}

function fillText(pool, capacity, rate) {
  if (rate > 0) return pool >= capacity ? 'full' : `full in ${formatDuration((capacity - pool) / rate)}`;
  if (rate < 0) return pool <= 0 ? 'starving' : `empty in ${formatDuration(pool / -rate)}`;
  return 'steady';
}

function describeEvent(e, config) {
  switch (e.type) {
    case 'divisionStarted':
      return `${label(e.cellId)} began dividing (-${amount(e.cost)} N)`;
    case 'split':
      return `${label(e.parentId)} split: ${e.daughters
        .map((d) => (d.viable ? `${label(d.id)} -> slot ${d.slot}` : 'a daughter was not viable'))
        .join(', ')}`;
    case 'culled':
      return `${label(e.cellId)} culled (+${amount(e.refund)} N)`;
    case 'starved':
      return `${label(e.cellId)} starved`;
    case 'recolonized':
      return `the dish is recolonized: ${label(e.cellId)} drifts in`;
    case 'session':
      return describeSession(e, config);
    default:
      return e.type;
  }
}

function describeSession(e, config) {
  const away = e.elapsedMs > 0 ? ` (away ${formatDuration(e.elapsedMs / config.msPerHour)})` : '';
  switch (e.status) {
    case 'fresh':
      return 'a single cell adrift in a primordial sea';
    case 'loaded':
      return `welcome back${away}`;
    case 'migrated':
      return `save upgraded to the current version${away}`;
    case 'corrupt':
      return 'saved game unreadable: kept as a backup, new game started';
    case 'storageUnavailable':
      return 'storage unavailable: this game will not be saved';
    default:
      return `session ${e.sessionNumber}`;
  }
}

// ---- Banners and messages (wording lives here; main.js decides when) ---------------

export function loadBanner(status, config = CONFIG) {
  if (status === 'corrupt') {
    return `Your saved game couldn't be read. It was kept as a backup (${config.saveKey}.corrupt) and a new game has started.`;
  }
  if (status === 'storageUnavailable') {
    return 'This browser is not letting the game save (private browsing or blocked site data?). You can play, but progress will be lost when the page closes.';
  }
  return '';
}

export function saveFailedBanner(result) {
  return `Saving failed (${result.error ?? result.reason}). Progress since the last successful save may be lost.`;
}

export function noCellText(state, slot) {
  if (slot === null) return 'Select a slot first (1-9, or click one).';
  const reservedBy = state.cells.find((c) => c.division && c.division.reservedSlot === slot);
  if (reservedBy) return `Slot ${slot} is reserved for a daughter of ${label(reservedBy.id)}.`;
  return `Slot ${slot} is empty. Select a cell first.`;
}

export function divideBlockedText(reason, state, cell, config = CONFIG) {
  switch (reason) {
    case 'alreadyDividing':
      return `${label(cell.id)} is already dividing.`;
    case 'noFreeSlot':
      return 'No free slot for a daughter: cull a cell first to make room.';
    case 'notEnoughNutrients':
      return `Not enough nutrients: dividing costs ${amount(config.divisionCost)} N and the pool has ${state.pool.toFixed(FORMAT.poolDecimals)} N.`;
    default:
      return `${label(cell.id)} can't divide (${reason}).`;
  }
}

export function dividedText(cell) {
  return `${label(cell.id)} began dividing. It will split into two daughters.`;
}

export function cullBlockedText(reason, cell) {
  if (reason === 'dividing') return `${label(cell.id)} is dividing and can't be culled until it splits.`;
  return `${label(cell.id)} can't be culled (${reason}).`;
}

export function cullConfirmText(state, cell, config = CONFIG) {
  const back = Math.min(cap(state, config), state.pool + config.cullRefund) - state.pool;
  const note = back < config.cullRefund ? '; the pool is nearly full' : '';
  return `Press c again to cull ${label(cell.id)} (+${amount(back)} N back${note}). Any other key cancels.`;
}

export function culledText(cell) {
  return `${label(cell.id)} culled.`;
}

// ---- Rules, help, and the out-of-date screen ---------------------------------------

function rulesLines(config) {
  const t = config.traits;
  const effects = Object.entries(config.mutationEffects).map(([name, e]) =>
    e.min === undefined
      ? `${pct(e.weight)} ${name}`
      : `${pct(e.weight)} ${name} (${signedPct(e.min)} to ${signedPct(e.max)})`,
  );
  return [
    'RULES  (Era 1; every number is a placeholder)',
    '',
    'Nutrients   cells absorb into one shared pool and pay upkeep from it',
    `            cap: ${config.storagePerCell} N per slot x ${config.membraneSlots} slots = ${config.storagePerCell * config.membraneSlots} N; any excess is lost`,
    `Upkeep      ${config.upkeepBase} + ${config.upkeepUptakeCoeff} x uptake^2 + ${config.upkeepSpeedCoeff} / division time`,
    'Net         uptake - upkeep   (all rates in N per hour)',
    `Founder     uptake ${t.uptake.base.toFixed(1)} N/h, divides in ${t.divisionHours.base}h`,
    `            traits range ${t.uptake.min}-${t.uptake.max} N/h and ${t.divisionHours.min}-${t.divisionHours.max}h`,
    `Division    costs ${config.divisionCost} N and needs a free slot for the daughter;`,
    '            the parent becomes two daughters',
    `Mutation    per daughter: ${pct(config.lethalChance)} not viable; each trait mutates`,
    `            with ${pct(config.mutationChancePerTrait)} chance, and a mutation is:`,
    ...effects.map((e) => `              ${e}`),
    `Culling     returns ${config.cullRefund} N, clipped at the cap`,
    'Starvation  empty pool, negative income: the least efficient cell dies',
    'Extinction  if every cell dies, a new founder drifts in',
    `Display     measured values carry ${pct(config.displayNoise)} noise, redrawn each`,
    '            session; the traits themselves are never shown',
  ];
}

const signedPct = (x) => `${x >= 0 ? '+' : '-'}${pct(Math.abs(x))}`;

function helpLines() {
  return [
    'CONTROLS',
    '',
    '1-9 or click      select a slot',
    'd                 divide the selected cell',
    'c, then c again   cull the selected cell',
    'i                 rules and numbers',
    '?                 this help',
    'esc               back, or cancel a cull',
    '',
    'On a touchscreen: tap a slot, then tap a command on the bottom line.',
    '',
    'Cells absorb and divide in real time, even while the page is closed.',
  ];
}

export function outdatedViewModel(detail) {
  return {
    screen: 'outdated',
    lines: [
      'THIS PAGE IS OUT OF DATE',
      '',
      'Your saved game was made by a newer version of this game than the one your browser has loaded. To keep that save safe, nothing has been started and nothing will be saved.',
      '',
      'Reload the page to get the latest version.',
      '',
      `(${detail})`,
    ],
  };
}
