# Project state

Updated: 2026-09-22

## Where things stand

Design is at v1.0: direction settled, and Era 1 specified with placeholder numbers in
`docs/design.md` §13. The Era 1 vertical slice is playable locally: simulation core
(session 1), save/load with offline catch-up (2c), and the ASCII renderer, view and
input (2d). The repo is on GitHub (`cvoros/cell-game`, branch `main`), but GitHub Pages
is not enabled yet, so it can't be played from a phone.

## What exists

- `src/config.js`: every tunable value from §13, one deep-frozen object
- `src/rng.js`: mulberry32 as a pure step function; the seed lives in state
- `src/state.js`: state shape (documented at the top), `createInitialState()`, derived
  quantities (upkeep, net, cap, free slots)
- `src/advance.js`: pure, event-driven `advance(state, elapsedMs)`, covering accrual,
  cap, fission and mutation, non-viable daughters, starvation, and recolonization
- `src/actions.js`: `divide` and `cull`, plus `canDivide`/`canCull` checks
- `src/save.js`: the only module that touches storage. `saveGame`/`loadGame` with
  injected storage, `validate()`, a migration chain (v1 → v2), a `.corrupt` backup for
  bad saves, refusal of saves from newer versions, and catch-up via `advance()` on load.
  It never throws on storage failures. The save format is at schema v3 (v2 added
  `sessionNumber`, v3 `startedAtMs`), with frozen v1 and v2 fixtures in the tests.
- `src/view.js`: pure view model. It applies the §13.8 noise (seeded by cell id and
  session). Every aggregate on screen is built from the measured values, never the
  true ones. It holds all wording: event log, messages, banners, and the rules and help
  screens.
- `src/render.js`: pure `render(viewModel) -> string` plus `hitTest` for clicks and
  taps. It imports nothing.
- `src/main.js`: the only file touching the DOM and the clock. It wires load → 1 s tick
  (the same `advance()`) → input → autosave (15 s, after actions, on `pagehide`), and
  handles every load status, including the out-of-date screen.
- `index.html`: one `<pre>`, monochrome, 72 columns scaled to the viewport.
- `test/`: 79 tests (`node --test`) covering the simulation, the §13.10 replay,
  determinism, purity, save/load failure modes and the v1 → v2 migration, the view and
  its noise, the renderer and hit testing, and architecture guards (tunable numbers,
  DOM, clock, storage, and renderer isolation)
- `CLAUDE.md`: project instructions, pillars, architecture rules, scope guard
- `docs/design.md`: design document v1.0, including the Era 1 spec (§13)
- `docs/decisions.md`: decision log
- `docs/ideas.md`: parking lot (sandbox mode, selection policies)
- `README.md`, `.gitignore`

A formatted PDF version of the design doc (v0.1) exists in the originating chat. The
markdown here is the source of truth.

## Era 1 spec at a glance (§13)

- 9 membrane slots, 1 starting cell, 36 N starting nutrients.
- Two hidden traits: uptake (base 1.0 N/h) and division time (base 6 h). Upkeep is
  derived from both, giving a base net of +0.40 N/h per cell.
- Division costs 12 N and replaces the parent with two daughters. Each daughter has a
  3% chance of not being viable and a 30% chance per trait of mutating (50% of those are
  silent, 38% harmful, 12% beneficial). About 28% of daughters end up with changed
  traits.
- Culling refunds 3 N. Cap = 6 N per slot × 9 slots = 54 N, constant in Era 1, with
  anything over it clipped. The target check-in interval is a 12 h placeholder.
- Once full, the colony can replace at most 4 cells per check-in; nutrients hold steady
  play to about 3.7.
- The player sees measured values with 5% noise, never the traits. All rules are
  visible on a rules screen.

## Next steps, in order

1. Define success criteria for the vertical slice, e.g. "after three days of check-ins,
   I've made a selection decision I cared about."
2. Build the slice in small sessions, roughly:
   a. ~~Config, seeded PRNG, pure `advance()`, with tests.~~ Done in session 1.
   b. ~~Division, mutation, and culling rules, with tests.~~ Done in session 1 (the
      §13.10 replay test needed the actions).
   c. ~~Save and load (`localStorage`, schema v1) and offline catch-up on load.~~ Done
      in session 2c.
   d. ~~ASCII renderer, view model with display noise, input, wiring; schema v2.~~
      Done in session 2d. It was driven end to end under Node with stand-in DOM,
      storage and clock, but hasn't yet been checked by hand in a real browser.
   e. **Next:** enable GitHub Pages and verify on a phone. Things to check: text size
      at 72 columns on a narrow screen (the font scales to fit, so it may be tiny), that
      tap targets land (slots, list rows, the bottom command line), saving across a
      closed tab, and catch-up after hours away.
3. Play it for a few days and check the balance risks in §13.13.

## Open questions

- Earned vs. progression-tied graphics (not needed for the slice).
- Target check-in frequency: 12 h placeholder, to be confirmed in playtest.

## Notes

- `C:\ClaudeCode` is mirrored nightly to OneDrive, so this folder is already backed up.
- All §13 numbers are placeholders meant to be tuned. Change them in the config table,
  not in logic.
