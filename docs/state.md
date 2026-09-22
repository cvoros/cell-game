# Project state

Updated: 2026-09-22

## Where things stand

Design is at v1.0: direction settled, and Era 1 specified with placeholder numbers in
`docs/design.md` §13. No code exists yet. The repo is on GitHub (`cvoros/cell-game`,
branch `main`), but GitHub Pages is not set up yet.

## What exists

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
   a. Config table plus the pure `advance(state, elapsedMs)` with a seeded PRNG, with
      tests (accrual, cap, division completion, starvation, clock going backwards).
   b. Division, mutation, and culling rules, with tests.
   c. Save and load (`localStorage`, schema v1) and offline catch-up on load.
   d. ASCII renderer and keyboard controls matching the §13.11 sketch.
   e. Deploy to GitHub Pages.
3. Play it for a few days and check the balance risks in §13.13.

## Open questions

- Earned vs. progression-tied graphics (not needed for the slice).
- Target check-in frequency: 12 h placeholder, to be confirmed in playtest.

## Notes

- `C:\ClaudeCode` is mirrored nightly to OneDrive, so this folder is already backed up.
- All §13 numbers are placeholders meant to be tuned. Change them in the config table,
  not in logic.
