// mulberry32, written as a pure step function: the caller owns the seed (it lives in
// game state), so every roll is reproducible and the simulation holds no hidden state.
// The constants below are part of the algorithm, not tuning values.

// Returns [value in [0, 1), nextSeed]. Seeds are unsigned 32-bit integers.
export function nextRandom(seed) {
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let t = nextSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, nextSeed];
}

// Mixes several integers into one seed (FNV-1a style), for streams keyed by more than
// one value, e.g. the §13.8 display noise keyed by (cell id, session number).
export function hashSeed(...ints) {
  let h = 0x811c9dc5;
  for (const n of ints) {
    h = Math.imul(h ^ (n >>> 0), 0x01000193) >>> 0;
    h ^= h >>> 15;
  }
  return h >>> 0;
}

// Standard normal draw (Box–Muller). Returns [z, nextSeed].
export function nextGaussian(seed) {
  const [u1, s1] = nextRandom(seed);
  const [u2, s2] = nextRandom(s1);
  const z = Math.sqrt(-2 * Math.log(1 - u1)) * Math.cos(2 * Math.PI * u2); // 1 − u1 is never 0
  return [z, s2];
}

// Normalises any integer seed to the unsigned 32-bit form nextRandom expects.
export function toSeed(n) {
  return n >>> 0;
}
