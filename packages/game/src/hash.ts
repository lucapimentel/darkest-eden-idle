// FNV-1a. A claim's seed is hash(saveId, lastClaimAt), so any claim can be replayed in a test
// and (from M4) retried after a failed transaction without paying out twice.
export function hash(...partsToHash: (string | number)[]): number {
    let hashValue = 0x811c9dc5
    for (const partToMix of partsToHash) {
        for (const character of String(partToMix)) {
            hashValue ^= character.charCodeAt(0)
            hashValue = Math.imul(hashValue, 0x01000193)
        }
        // A separator, so hash("a", "bc") and hash("ab", "c") can't collide.
        hashValue = Math.imul(hashValue ^ 0x2c, 0x01000193)
    }
    return hashValue >>> 0
}
