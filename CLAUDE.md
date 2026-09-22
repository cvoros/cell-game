# CLAUDE.md — project instructions

Read this first in every session. It is the contract for how this project is built.

## What this is

A single-player, check-in ("idle") browser game about evolution. The player starts as
one cell rendered in ASCII and, over many short sessions, selects which lineages survive
until the colony becomes a multicellular organism. Both the mechanics and the graphics
gain complexity as the organism does.

Working title is undecided. The repo codename is `cell-game` and does not need to change.

Full design: `docs/design.md` (v1.0). Decisions: `docs/decisions.md`. Current status:
`docs/state.md`.

## Design pillars

Any feature must serve at least one of these. A feature that serves none is out of scope.

1. **Check-in play** — short sessions, real-time timers, progress accrues while away.
2. **Evolution by selection** — mutations are random; the player selects, never designs.
3. **Biologically honest** — compress freely, but never teach a false principle.
4. **Growing complexity** — one new verb per era, on a planned schedule.
5. **Evolving graphics** — ASCII first, modern 2D last.
6. **Simulation texture, authored arc** — it should behave like a simulation: the player
   controls processes and parameters rather than units, the same rules run whether or not
   anyone is watching, instrumentation is the reward, numbers are visible. But the era
   sequence is authored and the game is going somewhere. Not a sandbox.

## Architecture rules

These are not preferences. Breaking them costs a rewrite.

- **The simulation must not know how it is drawn.** Game state is pure data. Renderers
  (ASCII, tiles, pixel, sprite) are swappable layers that read state and draw it. No
  rendering calls inside simulation code, no DOM references in state.
- **Offline progress is computed, not simulated.** On load, read elapsed time since the
  last save and calculate what accrued, capped by storage. Nothing runs in the
  background. The core advance is a pure function: `(state, elapsedMs) -> state`.
- **All tuning values live in one config table.** Mutation odds, rates, timers, costs,
  caps, payouts. No magic numbers scattered through logic. Balancing must be editable in
  one file.
- **Save data is versioned.** Include a schema version in the save object and write a
  migration path before changing its shape.

## Conventions

- Browser-first. No build step until one is actually needed; plain modules are fine.
- Prefer small pure functions for game rules, so they can be tested without a browser.
- Tests for anything involving time, rates, or probability. Those are the parts that
  break silently.
- Keep the ASCII renderer working even after later renderers exist. It is the cheapest
  way to debug state.

## Working agreement

- One feature per session. Large open-ended requests produce code that gets rewritten.
- Update `docs/state.md` and `docs/decisions.md` before ending a session.
- Commit at meaningful checkpoints with a short message saying what changed and why.
- When a design question comes up mid-build, write it into `docs/decisions.md` rather
  than deciding silently in code.

## Scope guard (prototype)

In scope: Era 1 only (prokaryote), ASCII rendering, nutrient accrual, division with
random mutation, player selection, storage caps, local save.

Out of scope until the prototype proves fun: multiplayer, monetization, accounts,
Eras 2-7, sound, art assets, mobile packaging.
