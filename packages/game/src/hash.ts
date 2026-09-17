// FNV-1a. A claim's seed is hash(saveId, lastClaimAt), so any claim can be replayed in a test
// and (from M4) retried after a failed transaction without paying out twice.
export function hash(...parts: (string | number)[]): number {
    let h = 0x811c9dc5
    for (const part of parts) {
        for (const char of String(part)) {
            h ^= char.charCodeAt(0)
            h = Math.imul(h, 0x01000193)
        }
        // A separator, so hash("a", "bc") and hash("ab", "c") can't collide.
        h = Math.imul(h ^ 0x2c, 0x01000193)
    }
    return h >>> 0
}
