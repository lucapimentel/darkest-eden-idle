import { rarityRank, type Item } from './types.ts'

export const SLOTS_PER_TAB = 30 // the Master Tree grows this in M8
export const OVERFLOW_SLOTS = 5

/** Better = higher rarity; ties go to the higher item level (PLAN §3). */
export function isBetter(candidateItem: Item, comparedWith: Item): boolean {
    const rarityDifference = rarityRank(candidateItem.rarity) - rarityRank(comparedWith.rarity)
    if (rarityDifference !== 0) return rarityDifference > 0
    return candidateItem.itemLevel > comparedWith.itemLevel
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
export function place(inventorySlots: (Item | null)[], overflowSlots: (Item | null)[],
    droppedItem: Item): Placement {
    const firstFreeInventorySlot = inventorySlots.indexOf(null)
    if (firstFreeInventorySlot !== -1) {
        inventorySlots[firstFreeInventorySlot] = droppedItem
        return { kept: 'inventory', destroyed: null }
    }

    const firstFreeOverflowSlot = overflowSlots.indexOf(null)
    if (firstFreeOverflowSlot !== -1) {
        overflowSlots[firstFreeOverflowSlot] = droppedItem
        return { kept: 'overflow', destroyed: null }
    }

    // Overflow is full, so it keeps the best: find the worst item currently in it.
    let worstOverflowIndex = 0
    for (let overflowIndex = 1; overflowIndex < overflowSlots.length; overflowIndex++) {
        const itemInThatSlot = overflowSlots[overflowIndex]
        const worstInOverflow = overflowSlots[worstOverflowIndex]
        if (itemInThatSlot && worstInOverflow && isBetter(worstInOverflow, itemInThatSlot)) {
            worstOverflowIndex = overflowIndex
        }
    }
    const worstInOverflow = overflowSlots[worstOverflowIndex]
    if (worstInOverflow && isBetter(droppedItem, worstInOverflow)) {
        overflowSlots[worstOverflowIndex] = droppedItem
        return { kept: 'overflow', destroyed: worstInOverflow }
    }
    return { kept: null, destroyed: droppedItem }
}

export const emptyInventory = () => Array<Item | null>(SLOTS_PER_TAB).fill(null)
export const emptyOverflow = () => Array<Item | null>(OVERFLOW_SLOTS).fill(null)
