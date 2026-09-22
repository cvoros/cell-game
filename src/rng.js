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

// Normalises any integer seed to the unsigned 32-bit form nextRandom expects.
export function toSeed(n) {
  return n >>> 0;
}
