import type { Kind, Slot } from '../types.ts'

export interface Base {
    baseId: string
    name: string
    slot: Slot
    kind: Kind
    twoHanded?: boolean
    physical?: [number, number] // weapons only: the base damage range prefixes scale
    icon: string // relative to /assets/icons/items/
    minItemLevel: number
}

// M2 ships one base per kind. More bases are content, not code: adding a row is the whole change.
export const BASES: Base[] = [
    { baseId: 'rusted_sword', name: 'Rusted Sword', slot: 'mainhand', kind: 'sword', physical: [5, 9], icon: 'weapons/WeaponIconsVol1/Sword_01.png', minItemLevel: 1 },
    { baseId: 'notched_axe', name: 'Notched Axe', slot: 'mainhand', kind: 'axe', physical: [7, 11], icon: 'weapons/WeaponIconsVol1/Axe_01.png', minItemLevel: 1 },
    { baseId: 'iron_mace', name: 'Iron Mace', slot: 'mainhand', kind: 'mace', physical: [8, 10], icon: 'weapons/WeaponIconsVol1/Hammer_01.png', minItemLevel: 1 },
    { baseId: 'short_bow', name: 'Short Bow', slot: 'mainhand', kind: 'bow', twoHanded: true, physical: [9, 15], icon: 'weapons/WeaponIconsVol1/Bow_01.png', minItemLevel: 1 },
    { baseId: 'gnarled_staff', name: 'Gnarled Staff', slot: 'mainhand', kind: 'staff', twoHanded: true, physical: [6, 14], icon: 'weapons/WeaponIconsVol1/Staff_51.png', minItemLevel: 1 },

    { baseId: 'battered_shield', name: 'Battered Shield', slot: 'offhand', kind: 'shield', icon: 'weapons/WeaponIconsVol1/shield_01.png', minItemLevel: 1 },
    { baseId: 'worn_tome', name: 'Worn Tome', slot: 'offhand', kind: 'tome', icon: 'weapons/WeaponIconsVol1/Book_1.png', minItemLevel: 1 },

    { baseId: 'leather_cap', name: 'Leather Cap', slot: 'helm', kind: 'helm', icon: 'armor/Helm_01_guard.png', minItemLevel: 1 },
    { baseId: 'padded_vest', name: 'Padded Vest', slot: 'chest', kind: 'chest', icon: 'armor/Chest_48_leather.png', minItemLevel: 1 },
    { baseId: 'worn_boots', name: 'Worn Boots', slot: 'boots', kind: 'boots', icon: 'armor/Boots_01_common.png', minItemLevel: 1 },
]

const BY_ID = new Map(BASES.map((base) => [base.baseId, base]))

export function baseById(baseId: string): Base {
    const base = BY_ID.get(baseId)
    if (!base) throw new Error(`unknown base: ${baseId}`)
    return base
}
