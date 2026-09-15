export function mulberry32(seed: number): () => number {
    let parsedSeed = seed >>> 0; // parsed to unsigned 32 bit
    return () => {
        parsedSeed = (parsedSeed + 0x6d2b79f5) >>> 0
        let temporaryParsedSeed = parsedSeed;
        temporaryParsedSeed = Math.imul(temporaryParsedSeed ^ (temporaryParsedSeed >>> 15), temporaryParsedSeed | 1);
        temporaryParsedSeed ^= temporaryParsedSeed + Math.imul(temporaryParsedSeed ^ (temporaryParsedSeed >>> 7), temporaryParsedSeed | 61);
        return ((temporaryParsedSeed ^ (temporaryParsedSeed >>> 14)) >>> 0) / 4294967296
    }
}