// Seeded randomness (mulberry32) so the city, the traffic and the
// staged screenshot scenes are identical for a given seed. The world
// builder, the traffic and the autopilot all draw from one stream per
// seed, which is what makes ?shot=...&seed=7 deterministic.
export function createRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one entry from a list, uniformly.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

// A float in [min, max).
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// True with probability p (0..1).
export function chance(rng, p) {
  return rng() < p;
}

export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpolate between two headings taking the short way around.
export function angleToward(a, b, t) {
  let delta = b - a;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return a + delta * t;
}

// Squared distance on the ground plane — cheaper than a square root
// when only a comparison is needed.
export function distSq(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
