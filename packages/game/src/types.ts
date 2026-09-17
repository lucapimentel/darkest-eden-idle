// erasableSyntaxOnly is on, so no `enum`: a const tuple plus a derived union.

export const SLOTS = ['mainhand', 'offhand', 'helm', 'chest', 'boots'] as const
export type Slot = (typeof SLOTS)[number]

export const KINDS = [
    'sword', 'axe', 'mace', 'bow', 'staff', // mainhand
    'shield', 'tome', // offhand
    'helm', 'chest', 'boots',
] as const
export type Kind = (typeof KINDS)[number]

/** Worst to best: the Overflow rule and the rarity roll both depend on this order. */
export const RARITIES = ['normal', 'magic', 'rare'] as const
export type Rarity = (typeof RARITIES)[number]
export const rarityRank = (rarity: Rarity) => RARITIES.indexOf(rarity)

export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning' | 'magical'

/** Every stat a mod can grant. All optional, all additive when merged. */
export interface StatBag {
    addedPhysical?: number
    increasedPhysical?: number // %
    critChance?: number // %
    critDamage?: number // % above the base 150%
    addedSpellFire?: number // M7: the Mage reads these; a Knight carrying a Tome does not
    addedSpellCold?: number
    addedSpellLightning?: number
    increasedSpell?: number // %
    life?: number
    energyShield?: number
    armour?: number
    evasion?: number
    blockChance?: number // %
    attackSpeed?: number // %
    castSpeed?: number // %
    mana?: number
    fireRes?: number // %
    coldRes?: number
    lightningRes?: number
    magicalRes?: number
    allAttributes?: number
    str?: number
    dex?: number
    int?: number
    luck?: number
}
export type StatKey = keyof StatBag

export interface Mod {
    modId: string
    tier: number
    value: number
}

export interface Item {
    id: string
    baseId: string
    rarity: Rarity
    itemLevel: number
    mods: Mod[]
    durability: number
    maxDurability: number
    isNew: boolean
}

/** Where an item lives. `equipped` is keyed by Slot; the other two are sparse arrays. */
export interface Hero {
    classId: 'knight'
    xp: number
    life: number // carried between Waves; 0 means the next Wave starts with a Death
    stage: number
    wave: number
    equipped: Partial<Record<Slot, Item>>
    inventory: (Item | null)[]
    overflow: (Item | null)[]
}

export interface SaveState {
    version: number
    saveId: string
    lastClaimAt: number
    gold: number
    hero: Hero
}
