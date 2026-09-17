import { baseById } from './data/bases.ts'
import { sellPrice } from './items.ts'
import type { Item, SaveState, Slot } from './types.ts'

/**
 * The item actions, as pure rules over a save. The UI calls these; in M4 the server calls the
 * same functions from its endpoints. A refusal returns a reason instead of throwing, because
 * "your Inventory is full" is something the player needs to read.
 */
export type ActionResult = { ok: true } | { ok: false; reason: string }

const firstFreeSlotIndex = (slotArray: (Item | null)[]) => slotArray.indexOf(null)

function indexInInventory(save: SaveState, itemId: string): number {
    return save.hero.inventory.findIndex((slot) => slot?.id === itemId)
}

export function equip(save: SaveState, itemId: string): ActionResult {
    const hero = save.hero
    const itemIndex = indexInInventory(save, itemId)
    if (itemIndex === -1) return { ok: false, reason: 'That item is not in the Inventory.' }
    const item = hero.inventory[itemIndex]
    if (!item) return { ok: false, reason: 'That item is not in the Inventory.' }

    const baseDefinition = baseById(item.baseId)
    const itemsPushedOut: Item[] = []
    const currentlyEquipped = hero.equipped[baseDefinition.slot]
    if (currentlyEquipped) itemsPushedOut.push(currentlyEquipped)

    // A two-handed weapon locks the Off-hand (PLAN §3).
    if (baseDefinition.twoHanded && hero.equipped.offhand) itemsPushedOut.push(hero.equipped.offhand)
    // Equipping an Off-hand while a two-hander is held pushes the two-hander out.
    if (baseDefinition.slot === 'offhand') {
        const mainHandItem = hero.equipped.mainhand
        if (mainHandItem && baseById(mainHandItem.baseId).twoHanded) itemsPushedOut.push(mainHandItem)
    }

    // The slot the item is leaving counts as free, so a straight swap always fits.
    const freeSlotsAfterTheSwap = hero.inventory.filter((slot) => slot === null).length + 1
    if (itemsPushedOut.length > freeSlotsAfterTheSwap) {
        return { ok: false, reason: 'The Inventory is too full to unequip what this replaces.' }
    }

    hero.inventory[itemIndex] = null
    for (const pushedOutItem of itemsPushedOut) {
        for (const slot of Object.keys(hero.equipped) as Slot[]) {
            if (hero.equipped[slot]?.id === pushedOutItem.id) delete hero.equipped[slot]
        }
        hero.inventory[firstFreeSlotIndex(hero.inventory)] = pushedOutItem
    }
    item.isNew = false
    hero.equipped[baseDefinition.slot] = item
    return { ok: true }
}

export function unequip(save: SaveState, slot: Slot): ActionResult {
    const item = save.hero.equipped[slot]
    if (!item) return { ok: false, reason: 'Nothing is equipped there.' }
    const freeSlotIndex = firstFreeSlotIndex(save.hero.inventory)
    if (freeSlotIndex === -1) return { ok: false, reason: 'The Inventory is full.' }
    save.hero.inventory[freeSlotIndex] = item
    delete save.hero.equipped[slot]
    return { ok: true }
}

export function sell(save: SaveState, itemId: string): ActionResult {
    for (const storageArea of [save.hero.inventory, save.hero.overflow]) {
        const itemIndex = storageArea.findIndex((slot) => slot?.id === itemId)
        const item = itemIndex === -1 ? null : storageArea[itemIndex]
        if (!item) continue
        storageArea[itemIndex] = null
        save.gold += sellPrice(item)
        return { ok: true }
    }
    return { ok: false, reason: 'That item is not in the Inventory or Overflow.' }
}

/** Move an Overflow item into a free Inventory slot — the only way out of the Overflow. */
export function rescue(save: SaveState, itemId: string): ActionResult {
    const itemIndex = save.hero.overflow.findIndex((slot) => slot?.id === itemId)
    const item = itemIndex === -1 ? null : save.hero.overflow[itemIndex]
    if (!item) return { ok: false, reason: 'That item is not in the Overflow.' }
    const freeSlotIndex = firstFreeSlotIndex(save.hero.inventory)
    if (freeSlotIndex === -1) return { ok: false, reason: 'The Inventory is full.' }
    save.hero.inventory[freeSlotIndex] = item
    save.hero.overflow[itemIndex] = null
    return { ok: true }
}

export function markSeen(save: SaveState) {
    for (const storageArea of [save.hero.inventory, save.hero.overflow]) {
        for (const item of storageArea) if (item) item.isNew = false
    }
}
