// Browser entry point, and the only module that touches the DOM or the clock. Storage
// goes through save.js. This file wires load -> tick -> input -> save; every rule lives
// in the pure modules it calls.

import { CONFIG } from './config.js';
import { advance } from './advance.js';
import { canCull, canDivide, cull, divide } from './actions.js';
import { beginSession } from './state.js';
import { loadGame, saveGame } from './save.js';
import {
  buildViewModel,
  cullBlockedText,
  cullConfirmText,
  culledText,
  divideBlockedText,
  dividedText,
  loadBanner,
  noCellText,
  outdatedViewModel,
  saveFailedBanner,
} from './view.js';
import { hitTest, render } from './render.js';

const screenEl = document.getElementById('screen');
const probeEl = document.getElementById('probe'); // one character, for click mapping

let state = null;
let running = false;
let lastViewModel = null;
const intervals = [];
const ui = {
  screen: 'game',
  selectedSlot: null,
  message: '',
  banner: '',
  bannerIsSaveFailure: false,
  confirmCullId: null,
};

// ---- Clock formatting (the view formats nothing time-zone dependent itself) --------

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function formatTime(ms) {
  const when = new Date(ms);
  const sameDay = when.toDateString() === new Date().toDateString();
  return sameDay ? timeFormat.format(when) : `${dayFormat.format(when)} ${timeFormat.format(when)}`;
}

function formatDate(ms) {
  const when = new Date(ms);
  return `${dateFormat.format(when)}  ${timeFormat.format(when)}`;
}

// ---- Start ----------------------------------------------------------------------------

function start() {
  const result = loadGame({ nowMs: Date.now() });
  switch (result.status) {
    case 'futureVersion':
      showOutdated(result.detail); // start no game, render no dish, save nothing
      return;
    case 'fresh':
    case 'loaded':
    case 'migrated':
      break;
    case 'corrupt':
    case 'storageUnavailable':
      ui.banner = loadBanner(result.status);
      break;
    default:
      showOutdated(`unexpected load status: ${result.status}`);
      return;
  }

  state = beginSession(result.state, { status: result.status, elapsedMs: result.elapsedMs });
  ui.selectedSlot = state.cells[0]?.slot ?? null;
  running = true;

  document.addEventListener('keydown', onKey);
  screenEl.addEventListener('click', onClick);
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', onVisibility);
  intervals.push(setInterval(tick, CONFIG.uiTickMs));
  intervals.push(setInterval(persist, CONFIG.autosaveMs));

  persist(); // record the session (and the catch-up) straight away
  draw();
}

function showOutdated(detail) {
  running = false;
  intervals.forEach(clearInterval);
  lastViewModel = null;
  screenEl.textContent = render(outdatedViewModel(detail));
}

// ---- Loop -----------------------------------------------------------------------------

// The open page uses the same advance() as the offline catch-up: one code path.
function tick() {
  if (!running) return;
  state = advance(state, Date.now() - state.lastUpdateMs);
  draw();
}

function draw() {
  if (!running) return;
  lastViewModel = buildViewModel(state, { ...ui, formatTime, formatDate });
  screenEl.textContent = render(lastViewModel);
}

function persist() {
  if (!running) return;
  const result = saveGame(state);
  if (result.ok) {
    if (ui.bannerIsSaveFailure) {
      ui.banner = '';
      ui.bannerIsSaveFailure = false;
    }
  } else if (result.reason === 'newerSaveExists') {
    showOutdated('a newer version of the game saved over this one while it was open');
  } else if (result.reason === 'storageUnavailable') {
    ui.banner = loadBanner('storageUnavailable'); // already shown since load; keep it up
  } else {
    ui.banner = saveFailedBanner(result);
    ui.bannerIsSaveFailure = true;
  }
}

function onVisibility() {
  if (document.visibilityState === 'hidden') persist();
  else tick(); // catch up at once rather than on the next interval
}

// ---- Input ----------------------------------------------------------------------------

function onKey(event) {
  if (!running || event.ctrlKey || event.metaKey || event.altKey) return;
  if (handle(actionForKey(event.key))) event.preventDefault();
}

function actionForKey(key) {
  const n = Number(key);
  if (key.trim() !== '' && Number.isInteger(n)) return { type: 'select', slot: n };
  return { type: 'key', key: key.length === 1 ? key.toLowerCase() : key };
}

function onClick(event) {
  if (!running || !lastViewModel) return;
  const box = screenEl.getBoundingClientRect();
  const style = getComputedStyle(screenEl);
  const charWidth = probeEl.getBoundingClientRect().width;
  const lineHeight = parseFloat(style.lineHeight);
  const col = Math.floor((event.clientX - box.left - parseFloat(style.paddingLeft)) / charWidth);
  const row = Math.floor((event.clientY - box.top - parseFloat(style.paddingTop)) / lineHeight);
  const action = hitTest(lastViewModel, row, col);
  if (action) handle(action);
}

// Returns true if the input meant something.
function handle(action) {
  tick(); // act on the present, not on the last tick
  const cullPending = ui.confirmCullId;
  ui.confirmCullId = null; // anything but a second c cancels a pending cull

  if (ui.screen !== 'game') {
    if (action.type === 'key' && ['Escape', 'i', '?'].includes(action.key)) {
      ui.screen = action.key === '?' && ui.screen !== 'help' ? 'help' : action.key === 'i' && ui.screen !== 'rules' ? 'rules' : 'game';
      draw();
      return true;
    }
    return false;
  }

  if (action.type === 'select') {
    if (action.slot < 1 || action.slot > state.slots) return false;
    ui.selectedSlot = action.slot;
    ui.message = '';
  } else {
    switch (action.key) {
      case 'd':
        ui.message = divideSelected();
        break;
      case 'c':
        ui.message = cullSelected(cullPending);
        break;
      case 'i':
        ui.screen = 'rules';
        break;
      case '?':
        ui.screen = 'help';
        break;
      case 'Escape':
        ui.message = '';
        break;
      default:
        return false;
    }
  }
  draw();
  return true;
}

function selectedCell() {
  return state.cells.find((c) => c.slot === ui.selectedSlot) ?? null;
}

function divideSelected() {
  const cell = selectedCell();
  if (!cell) return noCellText(state, ui.selectedSlot);
  const reason = canDivide(state, cell.id);
  if (reason) return divideBlockedText(reason, state, cell);
  state = divide(state, cell.id);
  persist();
  return dividedText(cell);
}

function cullSelected(cullPending) {
  const cell = selectedCell();
  if (!cell) return noCellText(state, ui.selectedSlot);
  const reason = canCull(state, cell.id);
  if (reason) return cullBlockedText(reason, cell);
  if (cullPending !== cell.id) {
    ui.confirmCullId = cell.id;
    return cullConfirmText(state, cell);
  }
  state = cull(state, cell.id);
  persist();
  return culledText(cell);
}

start();
