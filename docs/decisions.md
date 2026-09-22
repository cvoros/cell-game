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

### Pending

- Earned vs. progression-tied graphics.
- Target check-in frequency: 12 h placeholder in use; confirm in playtest.
