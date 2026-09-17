export const LEVEL_CAP = 30

// ponytail: flat quadratic curve; M9's balance pass replaces it with real pacing.
export const xpToNext = (level: number) => 100 * level * level

/** Total XP a hero must have accumulated to *be* this level. */
export function xpForLevel(level: number): number {
    let total = 0
    for (let l = 1; l < level; l++) total += xpToNext(l)
    return total
}

/** A loop to the cap, not algebra: 30 iterations, no rounding bugs, and it caps naturally. */
export function levelFromXp(totalXp: number): number {
    let level = 1
    let spent = 0
    while (level < LEVEL_CAP && totalXp >= spent + xpToNext(level)) {
        spent += xpToNext(level)
        level++
    }
    return level
}
