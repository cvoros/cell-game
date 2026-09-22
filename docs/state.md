# Project state

Updated: 2026-09-22

## Where things stand

Design is at v0.1 — direction settled, Era 1 details not yet specified. No code exists
yet. Folder scaffolded; git not yet initialized.

## What exists

- `CLAUDE.md` — project instructions, pillars, architecture rules, scope guard
- `docs/design.md` — design document v0.1
- `docs/decisions.md` — decision log
- `README.md`, `.gitignore`

A formatted PDF version of the design doc exists in the originating chat. The markdown
here is the source of truth.

## Next steps, in order

1. `git init`, first commit.
2. Answer the three pending questions in `docs/decisions.md` — especially the selection
   interaction, since it's the central mechanic.
3. Write the Era 1 spec into `docs/design.md`: starting nutrient rate, division cost and
   timer, storage cap, mutation odds, and what the ASCII screen shows. Placeholder
   numbers are fine; having numbers at all is what makes it buildable. That makes the
   doc v1.0.
4. Define success criteria for the vertical slice, e.g. "after three days of check-ins,
   I've made a selection decision I cared about."
5. Build the slice: Era 1 only, ASCII, in the browser, state separated from rendering.

## Notes

- `C:\ClaudeCode` is mirrored nightly to OneDrive, so this folder is already backed up.
