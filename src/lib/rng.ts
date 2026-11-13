/** Seeded pseudorandom generator so simulations can be reproduced per session. */
export function createRng(seed: number) {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pickOne<T>(items: T[], rng: () => number): T | null {
  if (!items.length) return null;
  return items[Math.floor(rng() * items.length)] ?? null;
}

export function weightedPick<T>(items: Array<{ item: T; weight: number }>, rng: () => number): T | null {
  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (total <= 0) return null;
  let threshold = rng() * total;
  for (const entry of items) {
    threshold -= Math.max(0, entry.weight);
    if (threshold <= 0) return entry.item;
  }
  return items[items.length - 1]?.item ?? null;
}
