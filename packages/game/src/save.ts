import { emptyInventory, emptyOverflow } from './inventory.ts'
import { MAX_DURABILITY } from './items.ts'
import type { SaveState } from './types.ts'

/** Bump whenever SaveState's shape changes. M2 wipes on a mismatch; the save dies in M4 anyway. */
export const SAVE_VERSION = 1

export function newSave(saveId: string, now: number): SaveState {
    return {
        version: SAVE_VERSION,
        saveId,
        lastClaimAt: now,
        gold: 50,
        hero: {
            classId: 'knight',
            xp: 0,
            life: 0, // 0 means "start at full"
            stage: 1,
            wave: 1,
            equipped: {
                mainhand: {
                    id: 'starter-sword',
                    baseId: 'rusted_sword',
                    rarity: 'normal',
                    itemLevel: 1,
                    mods: [],
                    durability: MAX_DURABILITY,
                    maxDurability: MAX_DURABILITY,
                    isNew: false,
                },
            },
            inventory: emptyInventory(),
            overflow: emptyOverflow(),
        },
    }
}
