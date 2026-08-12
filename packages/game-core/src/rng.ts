import type { Rng } from "./model";

function hashSeed(seed: number | string): number {
  if (typeof seed === "number") return seed >>> 0;
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Fast deterministic RNG for tests, AI, and offline games. Not cryptographic. */
export function createSeededRng(seed: number | string): Rng {
  let state = hashSeed(seed) || 0x9e3779b9;
  return {
    nextUint32(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return (value ^ (value >>> 14)) >>> 0;
    },
  };
}

export function randomIndex(rng: Rng, upperExclusive: number): number {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0 || upperExclusive > 0x1_0000_0000) {
    throw new Error(`Invalid random range: ${upperExclusive}`);
  }
  const limit = Math.floor(0x1_0000_0000 / upperExclusive) * upperExclusive;
  let sample: number;
  do sample = rng.nextUint32() >>> 0;
  while (sample >= limit);
  return sample % upperExclusive;
}

export function shuffled<T>(values: readonly T[], rng: Rng): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(rng, index + 1);
    const temporary = result[index]!;
    result[index] = result[swapIndex]!;
    result[swapIndex] = temporary;
  }
  return result;
}
