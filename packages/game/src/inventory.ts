import { rarityRank, type Item } from './types.ts'

export const SLOTS_PER_TAB = 30 // the Master Tree grows this in M8
export const OVERFLOW_SLOTS = 5

/** Better = higher rarity; ties go to the higher item level (PLAN §3). */
export function isBetter(candidate: Item, than: Item): boolean {
    const byRarity = rarityRank(candidate.rarity) - rarityRank(than.rarity)
    if (byRarity !== 0) return byRarity > 0
    return candidate.itemLevel > than.itemLevel
}

export interface Placement {
    /** `null` when the drop was destroyed. */
    kept: 'inventory' | 'overflow' | null
    /** The item that was destroyed to make room, or the drop itself. */
    destroyed: Item | null
}

/**
 * The single place a drop can land. Mutates the arrays, because `simulate()` calls this
 * thousands of times per claim and copying the Inventory each time is pure waste.
 *
 * There is no third place for an item to be: a drop either lands somewhere or is destroyed.
 */
export function place(inventory: (Item | null)[], overflow: (Item | null)[], drop: Item): Placement {
    const free = inventory.indexOf(null)
    if (free !== -1) {
        inventory[free] = drop
        return { kept: 'inventory', destroyed: null }
    }

    const freeOverflow = overflow.indexOf(null)
    if (freeOverflow !== -1) {
        overflow[freeOverflow] = drop
        return { kept: 'overflow', destroyed: null }
    }

    // Overflow is full, so it keeps the best: find the worst item currently in it.
    let worstIndex = 0
    for (let i = 1; i < overflow.length; i++) {
        const item = overflow[i]
        const worst = overflow[worstIndex]
        if (item && worst && isBetter(worst, item)) worstIndex = i
    }
    const worst = overflow[worstIndex]
    if (worst && isBetter(drop, worst)) {
        overflow[worstIndex] = drop
        return { kept: 'overflow', destroyed: worst }
    }
    return { kept: null, destroyed: drop }
}

export const emptyInventory = () => Array<Item | null>(SLOTS_PER_TAB).fill(null)
export const emptyOverflow = () => Array<Item | null>(OVERFLOW_SLOTS).fill(null)
