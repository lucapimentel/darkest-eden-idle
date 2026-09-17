export const LEVEL_CAP = 30

// ponytail: flat quadratic curve; M9's balance pass replaces it with real pacing.
export const xpToNext = (level: number) => 100 * level * level

/** Total XP a hero must have accumulated to *be* this level. */
export function xpForLevel(level: number): number {
    let totalXpRequired = 0
    for (let levelBeingCounted = 1; levelBeingCounted < level; levelBeingCounted++) {
        totalXpRequired += xpToNext(levelBeingCounted)
    }
    return totalXpRequired
}

/** A loop to the cap, not algebra: 30 iterations, no rounding bugs, and it caps naturally. */
export function levelFromXp(totalXp: number): number {
    let level = 1
    let xpSpentOnEarlierLevels = 0
    while (level < LEVEL_CAP && totalXp >= xpSpentOnEarlierLevels + xpToNext(level)) {
        xpSpentOnEarlierLevels += xpToNext(level)
        level++
    }
    return level
}
