import type { Kind, StatKey } from '../types.ts'

export interface ModTier {
    tier: number
    itemLevel: number // the item level this Tier needs: T3 → 1, T2 → 11, T1 → 21
    weight: number // weaker Tiers are heavier, so they stay more common
    range: [number, number]
}

export interface ModDef {
    modId: string
    name: string // "{} to maximum Life"; {} is the rolled value
    type: 'prefix' | 'suffix'
    stat: StatKey
    kinds: readonly Kind[]
    tiers: readonly ModTier[]
}

const WEAPONS = ['sword', 'axe', 'mace', 'bow', 'staff'] as const
const ARMOUR = ['helm', 'chest', 'boots'] as const
const ALL: readonly Kind[] = ['sword', 'axe', 'mace', 'bow', 'staff', 'shield', 'tome', 'helm', 'chest', 'boots']

/** T1 needs item level 21 (Stage 7+), T2 needs 11 (Stage 4+), T3 needs 1. */
const tiers = (t1: [number, number], t2: [number, number], t3: [number, number]): ModTier[] => [
    { tier: 1, itemLevel: 21, weight: 1, range: t1 },
    { tier: 2, itemLevel: 11, weight: 3, range: t2 },
    { tier: 3, itemLevel: 1, weight: 6, range: t3 },
]

// The table is PLAN §3. Adding content means adding a row here, never touching rollItem().
export const MODS: ModDef[] = [
    // --- prefixes ---
    { modId: 'added_phys', name: '+{} to Physical Damage', type: 'prefix', stat: 'addedPhysical', kinds: WEAPONS, tiers: tiers([12, 20], [6, 11], [2, 5]) },
    { modId: 'inc_phys', name: '{}% increased Physical Damage', type: 'prefix', stat: 'increasedPhysical', kinds: WEAPONS, tiers: tiers([45, 70], [25, 44], [10, 24]) },
    { modId: 'crit_chance', name: '+{}% Critical Hit Chance', type: 'prefix', stat: 'critChance', kinds: [...WEAPONS], tiers: tiers([4, 6], [2.5, 3.9], [1, 2.4]) },
    { modId: 'crit_damage', name: '+{}% Critical Damage Bonus', type: 'prefix', stat: 'critDamage', kinds: [...WEAPONS], tiers: tiers([35, 50], [20, 34], [8, 19]) },

    { modId: 'spell_fire', name: '+{} to Fire Damage to Spells', type: 'prefix', stat: 'addedSpellFire', kinds: ['staff', 'tome'], tiers: tiers([14, 22], [7, 13], [2, 6]) },
    { modId: 'spell_cold', name: '+{} to Cold Damage to Spells', type: 'prefix', stat: 'addedSpellCold', kinds: ['staff', 'tome'], tiers: tiers([14, 22], [7, 13], [2, 6]) },
    { modId: 'spell_light', name: '+{} to Lightning Damage to Spells', type: 'prefix', stat: 'addedSpellLightning', kinds: ['staff', 'tome'], tiers: tiers([14, 22], [7, 13], [2, 6]) },
    { modId: 'inc_spell', name: '{}% increased Spell Damage', type: 'prefix', stat: 'increasedSpell', kinds: ['staff', 'tome'], tiers: tiers([45, 70], [25, 44], [10, 24]) },

    { modId: 'life', name: '+{} to maximum Life', type: 'prefix', stat: 'life', kinds: [...ARMOUR, 'shield', 'tome'], tiers: tiers([50, 80], [25, 49], [8, 24]) },
    { modId: 'energy_shield', name: '+{} to maximum Energy Shield', type: 'prefix', stat: 'energyShield', kinds: [...ARMOUR, 'shield', 'tome'], tiers: tiers([28, 45], [14, 27], [4, 13]) },
    { modId: 'armour', name: '+{} to Armour', type: 'prefix', stat: 'armour', kinds: [...ARMOUR, 'shield'], tiers: tiers([80, 130], [40, 79], [12, 39]) },
    { modId: 'evasion', name: '+{} to Evasion', type: 'prefix', stat: 'evasion', kinds: [...ARMOUR, 'shield'], tiers: tiers([80, 130], [40, 79], [12, 39]) },
    { modId: 'block', name: '+{}% Block Chance', type: 'prefix', stat: 'blockChance', kinds: ['shield'], tiers: tiers([8, 12], [5, 7], [2, 4]) },

    // --- suffixes ---
    { modId: 'attack_speed', name: '{}% increased Attack Speed', type: 'suffix', stat: 'attackSpeed', kinds: WEAPONS, tiers: tiers([15, 22], [9, 14], [3, 8]) },
    { modId: 'cast_speed', name: '{}% increased Cast Speed', type: 'suffix', stat: 'castSpeed', kinds: ['staff', 'tome'], tiers: tiers([15, 22], [9, 14], [3, 8]) },
    { modId: 'mana', name: '+{} to maximum Mana', type: 'suffix', stat: 'mana', kinds: ALL, tiers: tiers([40, 60], [20, 39], [6, 19]) },
    { modId: 'fire_res', name: '+{}% Fire Resistance', type: 'suffix', stat: 'fireRes', kinds: ALL, tiers: tiers([28, 40], [16, 27], [5, 15]) },
    { modId: 'cold_res', name: '+{}% Cold Resistance', type: 'suffix', stat: 'coldRes', kinds: ALL, tiers: tiers([28, 40], [16, 27], [5, 15]) },
    { modId: 'light_res', name: '+{}% Lightning Resistance', type: 'suffix', stat: 'lightningRes', kinds: ALL, tiers: tiers([28, 40], [16, 27], [5, 15]) },
    { modId: 'magical_res', name: '+{}% Magical Resistance', type: 'suffix', stat: 'magicalRes', kinds: ALL, tiers: tiers([28, 40], [16, 27], [5, 15]) },
    { modId: 'all_attributes', name: '+{} to all Attributes', type: 'suffix', stat: 'allAttributes', kinds: ALL, tiers: tiers([14, 20], [8, 13], [2, 7]) },
    { modId: 'str', name: '+{} to Strength', type: 'suffix', stat: 'str', kinds: ALL, tiers: tiers([25, 35], [14, 24], [4, 13]) },
    { modId: 'dex', name: '+{} to Dexterity', type: 'suffix', stat: 'dex', kinds: ALL, tiers: tiers([25, 35], [14, 24], [4, 13]) },
    { modId: 'int', name: '+{} to Intelligence', type: 'suffix', stat: 'int', kinds: ALL, tiers: tiers([25, 35], [14, 24], [4, 13]) },
    { modId: 'luck', name: '+{} to Luck', type: 'suffix', stat: 'luck', kinds: ALL, tiers: tiers([12, 18], [7, 11], [2, 6]) },
]

const BY_ID = new Map(MODS.map((mod) => [mod.modId, mod]))

export function modById(modId: string): ModDef {
    const mod = BY_ID.get(modId)
    if (!mod) throw new Error(`unknown mod: ${modId}`)
    return mod
}

/** Mods that can roll on this kind at this item level, with the Tiers that are allowed. */
export function candidateMods(kind: Kind, itemLevel: number, type: 'prefix' | 'suffix'): ModDef[] {
    return MODS.filter((mod) =>
        mod.type === type &&
        mod.kinds.includes(kind) &&
        mod.tiers.some((tier) => tier.itemLevel <= itemLevel))
}

/** A mod value is shown with one decimal only when the Tier range actually needs one. */
export function formatMod(mod: { modId: string; value: number }): string {
    const def = modById(mod.modId)
    const fractional = def.tiers.some((tier) => tier.range.some((bound) => !Number.isInteger(bound)))
    return def.name.replace('{}', fractional ? mod.value.toFixed(1) : String(Math.round(mod.value)))
}
