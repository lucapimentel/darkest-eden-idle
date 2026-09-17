import { baseById } from './data/bases.ts'
import { sellPrice } from './items.ts'
import type { Item, SaveState, Slot } from './types.ts'

/**
 * The item actions, as pure rules over a save. The UI calls these; in M4 the server calls the
 * same functions from its endpoints. A refusal returns a reason instead of throwing, because
 * "your Inventory is full" is something the player needs to read.
 */
export type ActionResult = { ok: true } | { ok: false; reason: string }

const firstFree = (slots: (Item | null)[]) => slots.indexOf(null)

function findInInventory(save: SaveState, itemId: string): number {
    return save.hero.inventory.findIndex((slot) => slot?.id === itemId)
}

export function equip(save: SaveState, itemId: string): ActionResult {
    const hero = save.hero
    const index = findInInventory(save, itemId)
    if (index === -1) return { ok: false, reason: 'That item is not in the Inventory.' }
    const item = hero.inventory[index]
    if (!item) return { ok: false, reason: 'That item is not in the Inventory.' }

    const base = baseById(item.baseId)
    const displaced: Item[] = []
    const current = hero.equipped[base.slot]
    if (current) displaced.push(current)

    // A two-handed weapon locks the Off-hand (PLAN §3).
    if (base.twoHanded && hero.equipped.offhand) displaced.push(hero.equipped.offhand)
    // Equipping an Off-hand while a two-hander is held pushes the two-hander out.
    if (base.slot === 'offhand') {
        const mainhand = hero.equipped.mainhand
        if (mainhand && baseById(mainhand.baseId).twoHanded) displaced.push(mainhand)
    }

    // The slot the item is leaving counts as free, so a straight swap always fits.
    const freeSlots = hero.inventory.filter((slot) => slot === null).length + 1
    if (displaced.length > freeSlots) {
        return { ok: false, reason: 'The Inventory is too full to unequip what this replaces.' }
    }

    hero.inventory[index] = null
    for (const gear of displaced) {
        for (const slot of Object.keys(hero.equipped) as Slot[]) {
            if (hero.equipped[slot]?.id === gear.id) delete hero.equipped[slot]
        }
        hero.inventory[firstFree(hero.inventory)] = gear
    }
    item.isNew = false
    hero.equipped[base.slot] = item
    return { ok: true }
}

export function unequip(save: SaveState, slot: Slot): ActionResult {
    const item = save.hero.equipped[slot]
    if (!item) return { ok: false, reason: 'Nothing is equipped there.' }
    const free = firstFree(save.hero.inventory)
    if (free === -1) return { ok: false, reason: 'The Inventory is full.' }
    save.hero.inventory[free] = item
    delete save.hero.equipped[slot]
    return { ok: true }
}

export function sell(save: SaveState, itemId: string): ActionResult {
    for (const store of [save.hero.inventory, save.hero.overflow]) {
        const index = store.findIndex((slot) => slot?.id === itemId)
        const item = index === -1 ? null : store[index]
        if (!item) continue
        store[index] = null
        save.gold += sellPrice(item)
        return { ok: true }
    }
    return { ok: false, reason: 'That item is not in the Inventory or Overflow.' }
}

/** Move an Overflow item into a free Inventory slot — the only way out of the Overflow. */
export function rescue(save: SaveState, itemId: string): ActionResult {
    const index = save.hero.overflow.findIndex((slot) => slot?.id === itemId)
    const item = index === -1 ? null : save.hero.overflow[index]
    if (!item) return { ok: false, reason: 'That item is not in the Overflow.' }
    const free = firstFree(save.hero.inventory)
    if (free === -1) return { ok: false, reason: 'The Inventory is full.' }
    save.hero.inventory[free] = item
    save.hero.overflow[index] = null
    return { ok: true }
}

export function markSeen(save: SaveState) {
    for (const store of [save.hero.inventory, save.hero.overflow]) {
        for (const item of store) if (item) item.isNew = false
    }
}
