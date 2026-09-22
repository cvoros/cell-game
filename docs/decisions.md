# Decision log

One line per decision: date, what was decided, why. Append; don't rewrite history.
When a decision is reversed, add a new entry rather than editing the old one.

## 2026-09-22

- **Genre: single-player check-in game**, not active-session play. Suits the theme (a
  colony growing while you're away) and the amount of time available to play it.
- **Progression is evolution**, era by era, rather than an endless score climb.
- **The player selects; the player does not design.** Mutations are random and the
  player chooses which lineages continue. Any "buy an upgrade" mechanic would teach the
  opposite of how evolution works.
- **Biological accuracy is a pillar**, at the level of "true in spirit, honest in
  direction." Timescales and chemistry compress; principles don't bend.
- **Graphics progress with the organism**, ASCII first. Doubles as greyboxing.
- **Core loop = Petri Dish Colony**, wrapped in the Evolution Ladder era structure;
  RTS-style battles deferred to Era 7.
- **Repo codename `cell-game`.** Title still undecided, and the folder name does not
  depend on it. Candidates: Primordial, Deep Time, Replicate, Endless Forms, Descent,
  Lineage, LUCA, Fission, First Light.
- **Build in Claude Code CLI on native Windows** (installed 2026-09-22, v2.1.280),
  rather than the desktop app, for `CLAUDE.md` auto-loading, skills, and git in-session.
- **Scaffolded this folder by hand** rather than with the `create-project` skill, which
  is not synced to the CLI.

- **Hosting: public GitHub repo, deployed via GitHub Pages**, matching delayDay and
  matchup-tracker. No backend: the game is a static site, state lives in `localStorage`,
  and offline progress is computed from elapsed time on load.
- **No Firebase/Supabase for now.** A backend is only worth adding for cross-device
  sync, shared leaderboards, or server-authoritative time. Accepted consequence: since
  offline progress uses the device clock, a player can cheat by changing it. Acceptable
  for a game played by the author and a couple of friends.

- **Simulation first.** The game should read as a simulation of biology that the player
  nudges and observes, not a reward dispenser. Player input is selection pressure and
  environmental parameters; instrumentation (lineage tree, trait frequencies, event log)
  is the payoff; numbers are shown, not hidden. Added as a sixth pillar.
- **Mini-games reframed as observable events.** A slot-machine mutation roll conflicts
  with the simulation stance. Chance stays, but as events whose outcome is determined by
  the population's existing traits and watched rather than tapped.

- **Authored arc, emergent detail.** Era transitions fire on real simulation state rather
  than a checklist, and detail within an era emerges from the rules. Pure emergence is a
  sandbox, and a sandbox has no arc — parked as a possible mode, not the main line.
  Pillar 6 reworded from "simulation first" to "simulation texture, authored arc" so it
  can't be read as an argument for a sandbox.

- **Selection interaction: both culling and choosing which cells divide.** This is what a
  breeder actually does, and the two verbs are the player's whole toolkit. Three
  consequences decided with it: (a) a hard cap on membrane slots couples the verbs, so
  culling is how room is made for division rather than a separate chore; (b) a culled
  cell returns a fraction of its nutrients, matching real recycling and giving negative
  selection an economic role; (c) selection is on phenotype - cells show observable
  proxies while underlying traits stay hidden, as breeders cannot see genes.

- **Era 1 spec written with placeholder numbers** (`design.md` §13; design doc now v1.0).
  Structural choices made along the way:
  - **Two heritable traits (uptake, division time), with upkeep derived** from them
    rather than stored. Uptake has quadratic upkeep, so it has an optimum rather than
    "more is better". Fast division costs energy (the rate–yield trade-off). A trade-off
    on each trait keeps selection a judgment.
  - **Mutation rate is fixed, not tied to division speed.** A speed–accuracy link was
    considered and dropped: the real evidence is mixed, and pillar 3 says don't teach
    what isn't settled.
  - **Mutation effects follow a deleterious-skewed distribution** (50% silent, 38%
    harmful, 12% beneficial, with beneficial effects smaller). Unselected lineages
    decay, which is what gives selection a purpose.
  - **Binary fission consumes the parent.** Two mutated daughters replace it; there is
    no unchanged "original" left.
  - **"Numbers visible" vs. "phenotype only" resolved:** the rules and odds are public
    on a rules screen; an individual cell's traits are hidden and shown only as measured
    values with 5% noise.
  - **Starvation and extinction are real.** The least efficient cell starves when the
    pool hits zero. If everything dies, the dish is recolonized by a base founder rather
    than showing a game-over screen.
  - **Target check-in placeholder: 12 h.** Storage and division cost are derived from
    it. Still pending confirmation in playtest.
- **The storage cap is tied to slots, not living cells**: cap = `storagePerCell` ×
  `membraneSlots` = 54 N, constant in Era 1, and `storageFloor` is removed (found in
  review of §13). The old max(36, 6 × cells) shrank on every cull, and the slot rule
  forces culling before dividing, so the core verb destroyed nutrients. In the worked
  table, 62.4 N was cut to 36 and only 3 divisions were affordable instead of 4. It also
  rewarded dividing before culling, for no biological reason. Storage is membrane
  volume, which doesn't shrink when a cell dies. Vacuole upgrades will raise
  `storagePerCell`, so the upgrade path is kept. Anything over the cap is clipped,
  including cull refunds.

- **Build session 1 (config + simulation core).** Where §13 was silent, the code does
  the following. Each item is easy to change if it plays wrong:
  - **Player actions live in `src/actions.js`** (`divide`, `cull`, `canDivide`,
    `canCull`). This file wasn't in the planned layout, but the §13.10 replay can't be
    tested without it. Actions apply at `state.lastUpdateMs`, so callers advance first.
  - **`package.json` exists only to set `"type": "module"`**, so plain `.js` files load
    as ES modules under Node. It has no dependencies.
  - **`msPerHour` is in the config** so no other file has a bare number, even a unit.
  - **The starting cell also uses slot 5** (`founderSlot`). §13.7 set slot 5 only for
    the recolonizing founder.
  - **A division reserves the lowest-numbered free slot.** The first daughter takes the
    parent's slot and the second takes the reserved one.
  - **Fixed random-draw order per daughter:** lethal roll; then for each trait in
    config order (uptake, divisionHours), a mutation roll, then an effect roll, then a
    magnitude roll if the effect isn't silent. The order is part of what a seed means,
    so changing it changes every saved game's future.
  - **Division time is fixed when the division starts**, from the parent's
    `divisionHours`.
  - **Dividing cells can starve.** Their reserved slot is released and the division
    cost is not refunded. Starvation ties go to the lower cell id. As §13.7 says,
    starvation is checked only when the pool is at 0; a colony with a positive pool and
    negative net drains the pool first.
  - **Extinction recolonizes at the instant of the last death** and leaves the pool
    untouched. Culling the last cell does the same.
  - **Event log entries are structured data, not text**, so the renderer decides the
    wording. Silent mutations aren't recorded. A cull's `refund` is the amount that
    actually reached the pool after clipping.
  - **A pool above the cap** (unreachable in normal play) is clipped down by the next
    advance.
  - **`advance()` and the actions take an optional config** (default `CONFIG`), so
    tests can turn mutation off to replay the worked table exactly. The game itself
    always uses the default.

- **Build session 2c (save/load and offline catch-up).** Where §13.9 was silent:
  - **A save from a newer schema is refused on both paths.** `loadGame` returns
    `state: null` with status `futureVersion` and leaves storage untouched, and
    `saveGame` won't overwrite a newer save (`newerSaveExists`). Without the second
    guard, an older build (for example a cached copy of the page after a deploy) would
    start a fresh game and autosave over the player's real one. The 2d UI must show a
    "reload for the latest version" message instead of starting a game.
  - **A clock moved backwards freezes the simulation** until the wall clock passes
    `lastUpdateMs` again. The saved `lastUpdateMs` and division completion times are
    left alone, so no progress is lost or counted twice. The cost is that a player whose
    clock jumped back sees nothing happen for that long.
  - **A fresh game's seed defaults to `nowMs`.** The core bans `Math.random`, and a
    time-derived seed is different for every new game. It can be overridden for tests.
  - **Only the most recent corrupt save is kept** (`cell-game.save.corrupt`). The
    corrupt blob stays under the main key until the next successful save replaces it.
  - **An older save with no migration step is corrupt**, not guessed at.
  - **`validate()` checks structure, not balance.** Trait values must be finite and
    positive but are not checked against the config ranges, so retuning a range can't
    make existing saves "corrupt". A pool above the cap is accepted (the next advance
    clips it). Event entries aren't checked beyond `events` being an array, because
    they are display-only.
  - **`saveGame` validates before writing**, so a bug upstream can't persist a state
    that the next load would reject.

- **Build session 2d (renderer, view, input; save schema v2).**
  - **Schema v2 adds `sessionNumber`**, which seeds the §13.8 display noise. The v1 → v2
    migration sets it to 0, so the next load makes it session 1, exactly as for a new
    game. A frozen v1 save is kept as a test fixture so old saves stay provably
    loadable.
  - **`main.js` increments the session, not `loadGame`** (via `beginSession`). This
    keeps `loadGame` a plain load, so "save then load is identical" and "catch-up
    equals `advance()`" stay exact. `beginSession` also logs how the load went.
  - **What counts as visible phenotype.** Per-cell intake, upkeep, net and division time
    are noisy measurements (SD 5%, drawn per cell per session in a fixed order). The
    colony's total income and the pool are exact, since the player can watch the pool
    move. The time left on a division is exact, since a player can watch a division
    finish. That reveals the parent's true division time only once it's gone. The log
    reports which daughters were viable, but never which traits mutated.
  - **Departures from the §13.11 sketch:**
    - The cell list always shows all 9 slots, empty and reserved ones included, so the
      layout never jumps and a row can be tapped.
    - The header shows the local date and time instead of "day 3", because the state
      has no game start time. Adding one would be a v3 field.
    - The slot marker sits right beside its number (`> 1`).
  - **Presentation numbers stay out of the config.** `render.js` keeps its numbers in one
    `LAYOUT` block and `view.js` keeps its in one `FORMAT` block. The architecture test
    checks that no other numbers appear in those files, and that `render.js` imports
    nothing at all.
  - **Touch input:** the bottom hint line is tappable (`[d]`, `[c]`, `[i]`, `[?]`) and
    so are grid slots and list rows. Without that, a phone couldn't play at all. It
    works through a pure `hitTest(viewModel, row, col)`, so the renderer still knows
    nothing about the DOM.
  - **Monochrome in both color schemes:** Era 1 has no color, but the page follows the
    system light or dark setting (one foreground, one background).

- **No exact values anywhere on screen: everything is a measurement** (session
  2d-fix, from reviewing the live page). This reverses the 2d choice to show the colony
  rate exactly. With one cell, an exact header rate *is* that cell's true net, which
  defeated §13.8's noise at the very moment the player is learning to read it. "Full in"
  was a second exact channel to the same number, and with a few cells an exact sum
  pins down each noisy per-cell reading. Now every aggregate is built from the
  displayed per-cell values: the header rate is the sum of the nets shown (to the same
  two decimals), and "full in" / "empty in" comes from that rate, so header and list
  always agree.
  - **What stays exact, and why:** the pool (the rules act on it, and a noisy pool
    would make "not enough nutrients" lie), counts, and the time left on a division.
  - **Known residual channel:** watching the exact pool change over time reveals the
    colony's true total income. It's slow to read at one decimal, never isolates a
    single cell, and closing it would mean making the stock itself uncertain. That's a
    bigger design change, left for playtest to justify.
  - **Also true, not a leak:** the founder's traits are public by design (rules screen,
    §13.8), so a single founder's net was never secret. The fix matters from the first
    split on.
- **Schema v3 adds `startedAtMs`** for the header's day count. The v2 → v3 migration
  uses the oldest log entry, else `lastUpdateMs`. The log keeps only 50 entries, so for
  a long-running save that's a lower bound on its age, and the day count restarts from
  there. Days count 24 h periods of play from the start (day 1 = the first 24 h), not
  calendar days, which keeps it pure and independent of time zone. The §13.10 table
  counts from Day 0; the header counts from day 1, because "day 0" reads oddly to a
  player.
- **Migrations are exempt from the no-numbers guard.** A migration is frozen history:
  its version keys and any defaults it writes must never change when the config is
  retuned, so it must hardcode them and never read `CONFIG`. The architecture test
  enforces the second half.
- **Screen layout changes from review:**
  - Empty slots draw as `-`, so all nine positions show.
  - The controls sit at a fixed row under the list, with the message and a
    content-sized log below them, so there's no dead space and no jumping.
  - Empty and reserved rows start their note in the cell column.
  - A dividing cell reads `splits in 5h58m`, one space after `div time`.

### Pending

- Earned vs. progression-tied graphics.
- Target check-in frequency: 12 h placeholder in use; confirm in playtest.
