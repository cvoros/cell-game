# cell-game (working title TBD)

A single-player check-in game about evolution. You start as one cell drawn in ASCII.
Nutrients accrue while you are away; dividing produces daughter cells with random
mutations; you choose which lineages continue. Mechanics and graphics both grow in
complexity as the organism does.

- Design document: `docs/design.md`
- Decision log: `docs/decisions.md`
- Current state: `docs/state.md`
- Project instructions for Claude Code: `CLAUDE.md`

## Play it locally

The game loads as ES modules, which browsers won't load from a `file://` page, so serve
the folder instead. From the repo root:

```
python -m http.server 8000
```

Then open <http://localhost:8000/>. Your game saves to the browser's local storage for
that address. Stop the server with Ctrl+C.

Controls: `1`–`9` (or click) selects a slot, `d` divides, `c` twice culls, `i` shows the
rules and numbers, and `?` shows help. On a touchscreen, tap a slot, then tap a command
on the bottom line.

## Run the tests

```
node --test
```

Run it from the repo root. It needs Node only, with no install step (developed on
Node 24). The tests cover the simulation, saving, the view model and the renderer, but
not the browser.

Status: Era 1 vertical slice, playable locally. Not yet deployed.
