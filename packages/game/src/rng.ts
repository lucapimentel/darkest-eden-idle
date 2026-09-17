export function mulberry32(initialSeed: number): () => number {
    let currentSeedState = initialSeed >>> 0; // parsed to unsigned 32 bit
    return () => {
        currentSeedState = (currentSeedState + 0x6d2b79f5) >>> 0
        let scrambledSeedState = currentSeedState;
        scrambledSeedState = Math.imul(
            scrambledSeedState ^ (scrambledSeedState >>> 15), scrambledSeedState | 1);
        scrambledSeedState ^= scrambledSeedState + Math.imul(
            scrambledSeedState ^ (scrambledSeedState >>> 7), scrambledSeedState | 61);
        return ((scrambledSeedState ^ (scrambledSeedState >>> 14)) >>> 0) / 4294967296
    }
}