// Every tunable value in the game. Nothing else in the codebase may contain a tuning
// number: logic reads from here. Keys follow docs/design.md §13. All values are
// placeholders until playtested.

function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') deepFreeze(value);
  }
  return Object.freeze(obj);
}

export const CONFIG = deepFreeze({
  // Units. Not a tuning value, but kept here so no other file carries a bare number.
  msPerHour: 3_600_000,

  // §13.2 Traits (genotype). Base value for a founder, and the range mutations clamp to.
  traits: {
    uptake: { base: 1.0, min: 0.1, max: 6.0 }, // N/h, gross absorption
    divisionHours: { base: 6, min: 1, max: 48 }, // h, time a division takes
  },

  // §13.2 Upkeep = upkeepBase + upkeepUptakeCoeff × U² + upkeepSpeedCoeff / T (N/h).
  upkeepBase: 0.3,
  upkeepUptakeCoeff: 0.15,
  upkeepSpeedCoeff: 0.9,

  // §13.3 Nutrients and storage. Cap = storagePerCell × membraneSlots, constant in Era 1;
  // anything that would take the pool above it is clipped.
  startingNutrients: 36,
  storagePerCell: 6,
  targetCheckInHours: 12, // placeholder for the pending check-in-frequency decision

  // §13.4 Membrane and division.
  membraneSlots: 9,
  startingCells: 1,
  founderSlot: 5, // centre of the 3×3 membrane: the starting cell and any recolonizer
  divisionCost: 12,

  // §13.5 Mutation, rolled per daughter at fission.
  lethalChance: 0.03,
  mutationChancePerTrait: 0.3,
  mutationEffects: {
    silent: { weight: 0.5 },
    harmful: { weight: 0.38, min: -0.25, max: -0.02 },
    beneficial: { weight: 0.12, min: 0.02, max: 0.12 },
  },

  // §13.6 Culling.
  cullRefund: 3,

  // §13.8 Phenotype display (used by the renderer session, not the core).
  displayNoise: 0.05,

  // §13.9 Runtime and save (used by later sessions).
  uiTickMs: 1000,
  autosaveMs: 15000,
  saveKey: 'cell-game.save',
  schemaVersion: 3, // v2 added sessionNumber, v3 startedAtMs (see MIGRATIONS in save.js)

  // §13.11 Event log retention.
  eventLogMax: 50,
});
