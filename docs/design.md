# Design document — cell-game (working title TBD)

Version 1.0 · 2026-09-22 · Chris Voros

Status: direction set; Era 1 specified with placeholder numbers (§13). Next step is the
vertical slice.

---

## 1. Summary

The screen is almost empty. A single character sits in the middle of it, `o`, surrounded
by a scattering of dots. That is you: one cell adrift in a primordial sea, absorbing
whatever drifts past. There is no map, no menu, no color. There is only a number that
slowly climbs while you are away.

You check in over breakfast. The cell has fed enough to divide, and now there are two,
but they are not quite the same. One absorbs a little faster. The other copied itself
with a flaw. You didn't choose either difference. All you can choose is which one gets
to keep dividing.

Weeks pass in minutes-long visits. Your lineage adapts to a sea that turns poisonous
with oxygen. One day, by pure luck, one of your cells swallows a bacterium and doesn't
digest it. The bacterium stays and becomes a power plant. Your whole economy changes
overnight, because that is what happened on Earth two billion years ago.

As your organism becomes more complex, so does the world it lives in. The ASCII dots
gain color, then shape, then detail. Your cells begin to stick together, then to
specialize, then to move and hunt. By the end you are looking at a living creature in a
crowded ecosystem, and you know how it got there, because you were the selection
pressure the whole time.

**The one idea that holds it together:** the game evolves the same way the organism
does. Life starts simple and becomes complex, and so do the mechanics and the graphics.
The visual progression from ASCII to modern 2D is not a gimmick; it is the theme.

The player does not design the organism. The player **selects**. Random variation plus
selection plus inheritance, repeated over many generations, is the whole engine of the
game and the whole engine of evolution.

## 2. Design pillars

Every feature should serve at least one. A feature that serves none is out of scope.

| Pillar | What it means in practice |
| --- | --- |
| Check-in play | Short sessions, real-time timers, progress that accrues while away — the rhythm of SimCity BuildIt and Pocket Frogs. Not a 30-minute sit-down game. |
| Evolution by selection | Mutations are random. The player chooses which lineages survive; the environment filters the rest. No upgrade purchases that imply organisms design themselves. |
| Biologically honest | True in spirit and honest in direction. Timescales and chemistry compress, but nothing teaches a false principle. |
| Growing complexity | Begins with one verb and one resource. New mechanics arrive on a planned schedule tied to real evolutionary milestones. |
| Evolving graphics | ASCII at the start, modern 2D at the end. Rendering style advances with the organism. |
| Simulation first | The player controls processes and parameters, not units. Rules run consistently whether or not anyone is watching; outcomes are observed rather than awarded. |

## 3. Core loop

### Passive accrual

The colony absorbs **nutrients** continuously, whether or not the game is open. This is
the base resource and the first number the player ever sees.

### Infrastructure

Cell structures change the rate and shape of the nutrient flow. In keeping with the
selection pillar, these become available as traits a lineage acquires and the player
then propagates, rather than items bought from a shop.

| Structure | Effect | Role in the economy |
| --- | --- | --- |
| Absorber cells | Raise the nutrient rate | Core income growth |
| Vacuoles (storage) | Raise the cap on how much accumulates while away | Controls how long a player can stay away without waste |
| Mitochondria | Convert nutrients into **ATP** | Second-tier resource for division and upgrades; unlocked by the endosymbiosis event |
| Membrane expansion | Unlocks more space on the grid | Room to grow the colony |

### The check-in rhythm

Open, collect what accrued, spend it, queue a division, leave. Division takes real time
(roughly 20 minutes to 8 hours) and its output is a surprise: daughter cells carry small
random mutations. Same cadence as BuildIt factories and Pocket Frogs breeding, with a
small reveal every visit.

### Storage caps

Caps make check-ins rewarding without punishing a missed day, and nearly every
successful check-in game uses them. The cap is the real design dial for session
frequency: it sets how long a player can stay away before resources go to waste.

**Tuning principle:** pick the target return interval first (for example, twice a day),
then set the cap so it fills in slightly more than that interval at the current income
rate. As income grows, vacuole upgrades keep the interval steady.

## 4. Evolution by selection

Evolution as the spine rules out the obvious design. In real evolution nobody designs
the organism, so "buy an upgrade" would teach exactly the wrong instinct. The player
does the selecting, which is also how Pocket Frogs breeding works.

| Step | Real biology | In the game |
| --- | --- | --- |
| Variation | Copying DNA introduces random mutations. Most are neutral, some help, some hurt. | Division produces daughter cells with small random mutations. The player can't choose them. |
| Selection (artificial) | Breeders shaped dogs and crops by choosing which individuals reproduce. | The player chooses which lineages keep dividing and which die off. |
| Selection (natural) | The environment kills poorly suited organisms regardless of anyone's wishes. | Temperature, toxins, and scarcity cull poorly adapted cells whether the player likes it or not. |
| Inheritance | Offspring carry their parents' traits, including mutations. | Traits persist down a lineage, so selection compounds across generations. |

**The misconception this corrects:** the most common misunderstanding of evolution is
that organisms "try" to improve or evolve traits because they need them. Played long
enough, this game teaches the real principle through play — random variation, filtered
by selection — with no explanation required.

## 4a. The selection interaction

The player's two verbs are **choose which cells divide** (positive selection) and
**cull** (negative selection). Both, not one: this is what a breeder actually does, and
together they are the player's entire toolkit. Everything else in the game feeds these
two decisions.

**Space couples the two verbs.** The membrane has a hard cap on slots, justified by the
surface-area-to-volume constraint. Division needs a free slot, so culling is how room is
made. Culling is therefore not a separate chore; it is the cost of dividing. One
constraint drives both verbs and no extra machinery is needed.

**Culling returns resources.** A culled cell returns a fraction of its nutrients, which
is what really happens when a cell is broken down and recycled. This gives negative
selection an economic role and means a bad mutation is never a pure loss.

**Selection is on phenotype, not genotype.** Cells display observable proxies — "absorbs
quickly", "divides slowly" — while the underlying traits stay hidden. Breeders cannot
see genes either. This makes selection genuinely uncertain rather than a stat-sheet
comparison, and it is the accurate model.

**Known scaling problem.** Per-cell decisions work at nine cells and become tedious at
ninety. The intended answer is selection *policies* introduced in a later era ("cull
anything below this absorption rate"), moving the player from clicking units to setting
rules. Parked in `docs/ideas.md`; not part of the prototype.

## 4b. Simulation stance

This should feel as much like a simulation of biology as a game: a system the player
nudges and then observes, not a set of buttons that dispense rewards.

**What that means concretely**

- **The player controls processes and parameters, not units.** The inputs are selection
  pressure (which lineages continue, which are culled) and a few environmental knobs.
  There is no "build an absorber cell" button.
- **Instrumentation is the reward.** A lineage tree, trait frequency over generations,
  population and resource graphs, and an event log. The satisfaction is seeing what
  happened and understanding why. All of this is cheap to render in ASCII.
- **Nothing is scripted.** No congratulatory pop-ups, no staged tutorial beats. The same
  rules run whether or not anyone is watching.
- **Numbers are visible.** Mutation rates, diffusion values, and odds are shown rather
  than hidden. Hiding them would make this a game with a biology skin.
- **Events replace mini-games where possible.** Rather than a slot machine, a phage
  bloom arrives on a probability and the population's existing resistance determines the
  outcome, which the player watches unfold.

**Decided: authored arc, emergent detail**

Eras are authored and the game has a direction. Era transitions fire on real simulation
state (for example, "60% of the population carries oxygen tolerance") rather than on a
checklist, and everything within an era is emergent. The rails stay; what happens
between them is not scripted.

Pure emergence — unlimited dish, no eras, see what happens — is a different game. It is
parked as a possible sandbox mode once the simulation exists (see `docs/ideas.md`),
not as the main line.

**Reference points**

- *Niche - a genetics survival game* — real Mendelian genetics driving survival; the
  closest existing thing to this design.
- *Creatures* (Steve Grand, 1996) — simulated neural networks and biochemistry; a study
  in how much simulation a player will sit with.
- *SimEarth*, *SimLife* — process-control sims with visible parameters.

## 5. Era map

Progress is evolution itself. Each era is anchored to a real milestone, adds one new
verb, and advances the graphics.

| Era | Real biology | New mechanic | Graphics |
| --- | --- | --- | --- |
| 1. Prokaryote | Simple cells, no nucleus | Nutrient absorption, fission, mutation | ASCII |
| 2. Great Oxidation | Photosynthesizers flood the world with oxygen, toxic to most life | Environmental event: adapt or die | ASCII with color |
| 3. Endosymbiosis | A cell engulfed a bacterium that became the mitochondrion | Capture event: absorb a neighbor species, unlocking ATP | 16-color tiles |
| 4. Eukaryote | Nucleus, larger genome | More mutation slots, bigger cells | Pixel art |
| 5. Colonial | Cells cluster (like Volvox) | Cells stick together and share resources | Pixel art |
| 6. Differentiation | Identical DNA, different jobs | Specialized cell types as "buildings" | Refined 2D |
| 7. Organism | Tissues, organs, predation | Movement, hunting, battle element | Modern 2D |

**Signature moment — endosymbiosis.** A rare, chance-based event that permanently
transforms the economy. It really happened roughly two billion years ago and is the
origin of every complex cell alive today. It should feel like the biggest moment in the
early game.

## 6. Real constraints that become mechanics

| Constraint | The real biology | The mechanic |
| --- | --- | --- |
| Surface area to volume | Volume grows faster than surface area, so an oversized cell can't feed its interior through its membrane. The real reason cells divide. | A natural cap on cell size that forces division rather than endless growth. |
| Energy budget | Everything costs ATP; more capable machinery costs more to run. | Mutations that do more carry higher upkeep, creating real trade-offs. |
| Horizontal gene transfer | Bacteria swap genes directly with neighbors, not only with offspring. | An occasional event or mini-game that picks up a trait from a passing microbe. |

## 7. Bonus layer — mini-games of chance

| Mini-game | How it works | What it adds |
| --- | --- | --- |
| Mutation roll | Spend ATP to roll for a random trait. Most neutral, some great, a rare few harmful. | A slot machine that also drives evolution |
| Phage attack | Short timed event: tap invading viruses before they breach the membrane. | Light battle element, skill mixed into chance |
| Nutrient bloom | A rich patch drifts past; short window to send cells to harvest it. | Rewards checking in at unpredictable times |
| Binary fission gamble | Divide early for a chance at twins, with a risk of a weak cell. | Risk/reward inside the core action |
| Gene transfer | Pick up a trait from a passing microbe. | Another route to variation |

**Balance rule:** mini-games add to passive income; they never replace it. If bonuses
grow too large, the optional layer becomes mandatory and the game feels like a chore.

## 8. Graphics progression

Style advances with the organism: ASCII, color ASCII, 16-color tiles, pixel art, refined
2D, modern 2D.

Precedents to study: **Evoland** (graphics eras as progression), **A Dark Room** (starts
as a single line of text and expands), **Spore's cell stage** (playable microbe).

**Open decision — earned or tied to progression?**

| Option | How it works | Trade-off |
| --- | --- | --- |
| Earned in-game | The organism evolves better senses (light-sensitive spots, then eyes) and the world renders sharper as it does. | More memorable, ties graphics to biology. Harder to design and balance. |
| Tied to progression | Reaching a new era switches the art style. | Simpler and predictable. Less of a hook. |

Current lean: earned. The organism's own perception defines how the player sees the
world, making the graphics progression part of the evolution rather than a reward.

## 9. Accuracy guardrails

Goal: true in spirit and honest in direction.

| Simplify freely | Never teach |
| --- | --- |
| Compress timescales enormously (billions of years into weeks of play) | Directed mutation: organisms choosing or earning the mutations they need |
| Reduce chemistry to two or three resources (nutrients, ATP, later oxygen) | Need-driven evolution: traits appearing because the organism "wants" them |
| Let the player speed things up | Evolution as a ladder with a goal at the top |

**Field notes.** When an era unlocks, show a short in-game note: one or two sentences on
what really happened. Rewards curious players, costs almost nothing, anchors each
mechanic to real science.

## 10. Directions considered

The current design is a hybrid: the Petri Dish Colony as the core loop, wrapped in the
Evolution Ladder's era structure, with the Infection RTS's battles arriving later.

| Direction | Concept | Closest to | Status |
| --- | --- | --- | --- |
| 1. Petri Dish Colony | One cell; dividing is the build action. Daughter cells specialize into tissue types acting as buildings. Nutrients diffuse, so placement matters. Pathogens drift in, tower-defense style. | SimCity BuildIt, Pocket Frogs | Core loop |
| 2. Evolution Ladder | Each era is a new mechanic and a new art style, each adding one verb. | Evoland | Progression structure |
| 3. Infection RTS | A microbe colony invading a host; the immune system is the opposing AI faction. Units, harvesting, mutations as a tech tree. | Warcraft | Deferred; battles arrive in Era 7 |

## 11. Open questions

| Question | Why it matters |
| --- | --- |
| Earned or progression-tied graphics? | Shapes the renderer design and the trait system. |
| ~~How does the player select?~~ | Decided: both culling and choosing dividers (§4a). |
| Target check-in frequency? | Sets division timers and storage caps. Placeholder of 12 h used in §13; confirm in playtest. |
| What happens after Era 7? | Endless climb, ecosystem sandbox, or a defined ending. |
| Where does the battle element live? | Phage mini-games early, predation in Era 7, or an immune-system faction. |
| Platform? | Browser-first assumed for the prototype; mobile later is possible. |
| Title? | Candidates in `decisions.md`. Repo codename `cell-game` is stable either way. |

## 12. Process and workflow

### Engineering practice

**Greybox first.** Starting in ASCII is real industry practice — prove the mechanics are
fun before spending anything on art. Here the artistic idea and good process coincide.

**Separate game state from rendering.** The most important architecture decision. The
simulation knows nothing about how it's drawn; renderers are swappable layers over the
same state. Build it into the first prototype; retrofitting is painful.

**Compute offline progress; don't simulate it.** On open, read elapsed time since the
last save and calculate what accrued, up to the cap. Nothing runs in the background.
Keeps the game cheap to run, works in a plain browser, and makes the core advance a pure
function of `(state, elapsed)` — easy to test.

**Keep every probability in one config table.** Mutation odds, payouts, event chances
will be tuned constantly. One data table makes balancing a spreadsheet exercise instead
of a code hunt, and keeps the rolls auditable.

**Design complexity as a schedule.** Write down which mechanic appears at which stage
before building. Unplanned, "complexity grows over time" becomes "everything at once."
The era map is the first version of that schedule.

### Workflow

| Phase | Where | What happens | Why |
| --- | --- | --- | --- |
| 1. Brainstorm | Chat | Loose back-and-forth on ideas and direction | Cheap, nothing needs to run |
| 2. Design doc | Project folder | This document: pillars, loop, eras, out of scope | Design lives in a file, not chat history |
| 3. Vertical slice | Claude Code | Era 1 only, ASCII, playable in the browser | Proves the core loop is fun first |
| 4. Iterate | Claude Code | One feature per session, starting from this doc | Small scoped requests produce code that lasts |

### Using Claude efficiently

- Move out of chat once the design firms up; long threads carry their whole history.
- Never re-explain the game — `CLAUDE.md` and this doc are the context.
- Ask for one feature per session, not "build the game."
- Research only when a question needs it; this biology is stable textbook material.
- Update this document when decisions change, so it stays the single source of truth.

## 13. Era 1 specification (prototype)

Everything the vertical slice needs in order to be built. **Every value is a
placeholder**, chosen to be self-consistent rather than tuned. All of them belong in the
single config table (`CLAUDE.md`), and the keys below are the proposed names in that
table. Units: nutrients (N), hours (h).

### 13.1 The model in one paragraph

The colony lives inside a membrane with nine slots. Every cell continuously absorbs
nutrients into one shared pool and pays its upkeep out of that pool. The pool is capped
by how much the cells can store. Dividing a cell costs nutrients up front and takes real
time. When it finishes, the parent is gone and two daughters stand in its place, each
with a chance of mutations to its two heritable traits. The player sees each cell's
measured performance, never its traits, and does exactly two things: chooses which cells
divide, and culls cells to free slots. Everything that happens between check-ins is
computed from elapsed time.

### 13.2 Traits and upkeep

Two heritable traits make up the genotype. The player never sees them directly.

| Key | Base | Range | Why |
| --- | --- | --- | --- |
| `uptake` (U) | 1.0 N/h | 0.1 – 6.0 | Gross absorption. The one trait the economy obviously rewards, so it needs a cost (below). |
| `divisionHours` (T) | 6 h | 1 – 48 | Two divisions fit within one check-in interval at base; harmful drift pushes T past 12 h, where slowness starts to cost the player. |

Upkeep is derived from the traits, never stored:

```
upkeep = upkeepBase + upkeepUptakeCoeff × U² + upkeepSpeedCoeff / T
net    = U − upkeep
```

| Key | Value | Why |
| --- | --- | --- |
| `upkeepBase` | 0.30 N/h | Staying alive costs something even when doing nothing. |
| `upkeepUptakeCoeff` | 0.15 | Energy budget (§6): more transport machinery costs more, with diminishing returns. Net peaks at U ≈ 3.3, about 3× base, so "absorbs more" stops paying well before the range limit. |
| `upkeepSpeedCoeff` | 0.9 | Rate–yield trade-off, which is real in microbes: growing fast is wasteful. At T = 3 h, net falls from 0.40 to 0.25. |

At base: upkeep 0.60, **net +0.40 N/h per cell**. A cell whose uptake falls below about
0.5 has negative net income and will starve (see 13.7).

### 13.3 Nutrients and storage

| Key | Value | Why |
| --- | --- | --- |
| `startingNutrients` | 36 N | Three divisions' worth. A lone cell earns only 0.4 N/h, so without this reserve the first day is dead air. |
| `storagePerCell` | 6 N | At base net, a cell fills its share in 15 h, slightly more than the 12 h target interval (§3 tuning principle). |
| `storageFloor` | 36 N | Cap = max(floor, 6 × cells), so a young colony is never capped below its own starting reserve. |
| `targetCheckInHours` | 12 | Placeholder for the pending check-in-frequency decision: twice a day. Storage and division cost are both derived from it. |

### 13.4 Membrane and division

| Key | Value | Why |
| --- | --- | --- |
| `membraneSlots` | 9 (3×3) | Small enough to judge every cell by hand (`docs/ideas.md`). The surface-area-to-volume constraint is the in-world reason. |
| `startingCells` | 1 | The game starts with one cell (§1). |
| `divisionCost` | 12 N, paid up front | With the colony full, the slot rule allows at most 4 divisions per check-in (cull 4, then 4 of the remaining 5 divide). That costs 36 N net of refunds, against about 43 N of income per 12 h, so nutrients and slots bind at about the same point. |
| Slot rule | A division needs one free slot, reserved at start | This is the coupling from §4a: no free slot, no division, so culling makes room. |
| Fission | The parent is replaced by two daughters, one in the parent's slot and one in the reserved slot | Binary fission: there is no "original" left over. Both copies are fresh draws, so every division is a comparison between siblings. |
| While dividing | Keeps absorbing; cannot be culled or divided again | Fission is a commitment. Avoids refund edge cases. |

### 13.5 Mutation

Rolled independently for each daughter at the moment of fission.

| Key | Value | Why |
| --- | --- | --- |
| `lethalChance` | 0.03 per daughter | The daughter is not viable. Its slot is freed and no nutrients come back. Natural selection is visible from the first day, not only from later eras. |
| `mutationChancePerTrait` | 0.30 per trait | About half of daughters (1 − 0.7² ≈ 51%) differ from their parent. Every division is a small reveal, but faithful copies stay common. |
| `mutationEffects` | 50% silent (δ = 0) · 38% harmful, δ ∈ U[−25%, −2%] · 12% beneficial, δ ∈ U[+2%, +12%] | The real distribution of fitness effects: most changes do nothing, harmful ones outnumber and outweigh beneficial ones. Unselected lineages slowly decay, which is exactly what gives selection its purpose. |
| Applying δ | U ← U × (1 + δ); T ← T ÷ (1 + δ) | Positive δ always means "better at that trait": more uptake, faster division. Results are clamped to the trait ranges. |

With the colony full, the player gets up to 4 divisions per check-in, which means 8
daughters and 16 trait rolls. On average that's about 0.6 beneficial mutations, 1.8
harmful ones, and 0.24 non-viable daughters per check-in: something to cull every visit,
and a promising cell about once a day.

### 13.6 Culling

| Key | Value | Why |
| --- | --- | --- |
| `cullRefund` | 3 N (25% of division cost) | A broken-down cell is recycled (§4a). Kept below division cost so constant churn is never free. |
| Timing | Instant; any cell except one that is dividing | Culling is the cheap, fast verb, and division is the slow, costly one. |
| Last cell | Can be culled | Honest and self-correcting (see extinction below). |

### 13.7 Natural selection without the player

| Key | Value | Why |
| --- | --- | --- |
| Starvation | When the pool is at 0 and colony net is negative, the cell with the lowest net dies. Repeat until net ≥ 0. | The least efficient cells starve first. Natural selection with no scripted event behind it. |
| Extinction | If no cells remain, a new founder with base traits appears in slot 5, and the log reads "the dish is recolonized" | Keeps the prototype playable without a game-over screen. Honest, because the sea is full of microbes. |

### 13.8 What the player sees (phenotype)

| Key | Value | Why |
| --- | --- | --- |
| Shown per cell | Measured intake, upkeep, net, and division time | Performance, never genotype (§4a). Every number the player compares is one a microbiologist could measure. |
| `displayNoise` | SD 5%, multiplicative, applied separately to each value | Measurements are imperfect. A 15% gap is obvious; a 5% gap needs a few check-ins before it can be trusted, which makes selection a judgment rather than a sort. |
| Noise refresh | Rerolled per cell once per session, seeded by (cell id, session number) | Repeated looks agree within one visit, so the player can't reroll by refreshing. Across visits, the player builds confidence. |
| Rules screen | All config values and formulas on this page are visible in-game (`[i]`) | Pillar 6: numbers are visible. The rules are public; only the individual cell's genes are hidden. |

### 13.9 Time, randomness, save

| Key | Value | Why |
| --- | --- | --- |
| Offline advance | Event-driven: the pool changes linearly between events (division completes, starvation, cap reached), each solved in closed form | Keeps `(state, elapsedMs) -> state` exact and cheap for any absence length. No per-tick simulation is needed. |
| Negative elapsed time | Treated as 0 | The device clock moved backwards. Cheating the clock forwards is accepted (decision log). |
| `rngSeed` | Stored in the save; seeded PRNG (e.g. mulberry32) | Every roll comes from state, so the advance stays pure and tests can reproduce exact outcomes. |
| `uiTickMs` | 1000 | Pool and timers visibly move while the page is open, using the same advance function. |
| `autosaveMs` | 15000, plus after every action and on `pagehide` | Closing the tab loses at most a few seconds, and computed offline progress covers even that. |
| `saveKey` / `schemaVersion` | `cell-game.save` / 1 | Versioned from the start (`CLAUDE.md`). |

### 13.10 A worked first two days

Assumes check-ins at 08:00 and 20:00, the player dividing whatever is affordable, all
cells at base traits, and no mutations. It's a sanity check on the numbers, not a
prediction.

| Check-in | Cells | Pool on arrival | Action | Pool after |
| --- | --- | --- | --- | --- |
| Day 0 08:00 | 1 | 36.0 | Divide 1 | 24.0 |
| Day 0 20:00 | 2 | 31.2 | Divide 2 | 7.2 |
| Day 1 08:00 | 4 | 21.6 | Divide 1 | 9.6 |
| Day 1 20:00 | 5 | 31.2 | Divide 2 | 7.2 |
| Day 2 08:00 | 7 | 36.0 | Divide 2 (colony now full) | 12.0 |
| Day 2 20:00 | 9 | 50.4 | Cull 4, divide 4 (the most the slots allow) | 14.4 |

From here, about 43 N arrives per 12 h. Up to 36 N of it goes to turnover, and the cap
of 54 fills in 15 h. The
first sibling comparison comes at the second check-in, and the membrane fills on
day 2.

### 13.11 The ASCII screen

About 72 columns, monospace, no color (color arrives in Era 2). The membrane's slots are
numbered 1–9, reading left to right and top to bottom.

```
 CELL-GAME   Era 1 · Prokaryote                              day 3  08:14
 ========================================================================
    .        .    .          .       .     .         .           .
       .   +-----------------------------+      .          .
   .       |                             |   .       .
           |   [o]       o         8     |        .            .
     .     |                             |  .
           |    o        ?         o     |      .       .
   .       |                             |                   .
           |    o                  o     |   .
      .    |                             |       .       .
           +-----------------------------+  .        .
     .          .       .    .        .        .              .
 ========================================================================
 nutrients  28.4 / 42     +3.3 N/h     full in 4h 10m
 cells 7/9    dividing 1    highest generation 11
 ------------------------------------------------------------------------
  slot  cell  gen  intake  upkeep    net   div time   state
  > 1   c41    11    1.42    0.76  +0.66     ~5h50m
    2   c38    10    1.05    0.61  +0.44     ~6h20m
    3   c44    10    1.18    0.66  +0.52     ~6h05m   dividing, 5h58m left
    4   c33     9    0.97    0.59  +0.38     ~6h10m
    6   c40    11    1.21    0.62  +0.59     ~9h25m
    7   c42    11    0.78    0.54  +0.24     ~6h00m
    9   c39    10    1.10    0.67  +0.43     ~4h55m
 ------------------------------------------------------------------------
 08:13        c44 began dividing (-12 N)
 08:12        c35 culled (+3 N)
 03:40        c37 split: c42 -> slot 7, c43 not viable
 d2 21:05     c30 split: c40 -> slot 6, c41 -> slot 1
 ------------------------------------------------------------------------
 [1-9] select   [d] divide -12 N   [c] cull +3 N   [i] rules   [?] help
```

| Glyph | Meaning |
| --- | --- |
| `o` | A living cell |
| `[o]` | The selected cell (also marked `>` in the list) |
| `8` | A cell mid-fission: two lobes pinching apart |
| `?` | The slot reserved for a daughter still to come |
| blank | A free slot |
| `.` outside the membrane | Nutrients in the pool. Density is pool ÷ cap, around 40 dots when full. Decoration drawn by the renderer; it doesn't need to be in the config. |

The screen shows a real trade-off: c40 (slot 6) has the best net yield but divides
slowly, and c42 (slot 7) is the obvious cull. The list is phenotype only, and the
numbers carry ±5% noise.

**Controls.** Number keys or a click select a slot. `d` divides the selected cell (if
there's a free slot and enough nutrients). `c` culls it, and asks for a second `c` to
confirm. `i` opens the rules screen (13.8). The event log keeps the last 50 entries and
shows the most recent 4.

### 13.12 Deliberately outside the slice

- **Lineage tree view** — stretch goal. The slice stores each cell's parent id, so the
  tree can be drawn later without changing the save shape.
- **Trait-frequency and population graphs** — Era 1 instrumentation after the slice
  proves fun.
- **Era 2 trigger.** Placeholder: world oxygen starts rising on day 7 of play. That's
  world state, not colony state, because the Great Oxidation was caused by other
  organisms. The slice ends before it.
- **Events, horizontal gene transfer, selection policies** — later eras
  (`docs/ideas.md`).

### 13.13 Balance risks to watch in playtest

- **The cap tightens as the colony improves.** At net 1.0 N/h per cell, nine cells fill
  54 N in 6 h, which quietly demands more frequent check-ins. Candidate fixes: a larger
  `storagePerCell`, or storage as a third trait.
- **Beneficial mutations may be too subtle.** An average +7% against 5% noise might not
  read as a discovery. Try a larger beneficial range or lower noise.
- **Division time barely matters to a twice-a-day player** until T drifts past 12 h. The
  harmful bias is meant to cause that drift. Confirm it actually happens.
- **The first session has one action.** If day 0 feels empty, raise `startingNutrients`
  or add a second starting cell rather than scripting anything.
