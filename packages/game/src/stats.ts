import { CLASSES } from './data/classes.ts'
import { baseById } from './data/bases.ts'
import { modById } from './data/mods.ts'
import { levelFromXp } from './xp.ts'
import type { Hero, Item, StatBag } from './types.ts'

export interface HeroStats {
    level: number
    str: number
    dex: number
    int: number
    maxLife: number
    maxEnergyShield: number
    maxMana: number
    armour: number
    evasion: number
    blockChance: number
    fireRes: number
    coldRes: number
    lightningRes: number
    magicalRes: number
    luck: number
    /** Expected damage of one basic attack, crit included. */
    hitDamage: number
    attacksPerSecond: number
    cleaveDamage: number
    cleaveCooldownSec: number
}

/** A Broken item (0 durability) gives no stats — PLAN §3. */
export const isBroken = (item: Item) => item.durability <= 0

export function itemStats(item: Item): StatBag {
    const bag: StatBag = {}
    if (isBroken(item)) return bag
    for (const mod of item.mods) {
        const stat = modById(mod.modId).stat
        bag[stat] = (bag[stat] ?? 0) + mod.value
    }
    return bag
}

function sumEquipped(hero: Hero): StatBag {
    const total: StatBag = {}
    for (const item of Object.values(hero.equipped)) {
        for (const [stat, value] of Object.entries(itemStats(item))) {
            const key = stat as keyof StatBag
            total[key] = (total[key] ?? 0) + value
        }
    }
    return total
}

/** Base weapon damage, ignoring mods. An empty main hand still swings, just badly. */
function weaponDamage(hero: Hero): number {
    const weapon = hero.equipped.mainhand
    if (!weapon || isBroken(weapon)) return 3 // bare hands
    const physical = baseById(weapon.baseId).physical
    return physical ? (physical[0] + physical[1]) / 2 : 3
}

/**
 * Pure, and called again after every level-up and every item that breaks, so keep it cheap.
 * Order matters: base → flat → derived → increased.
 */
export function heroStats(hero: Hero): HeroStats {
    const def = CLASSES[hero.classId]
    const level = levelFromXp(hero.xp)
    const bag = sumEquipped(hero)

    const all = bag.allAttributes ?? 0
    const fromLevel = def.attributePerLevel * (level - 1)
    const str = def.str + fromLevel + all + (bag.str ?? 0)
    const dex = def.dex + fromLevel + all + (bag.dex ?? 0)
    const int = def.int + fromLevel + all + (bag.int ?? 0)

    // Attributes scale the defenses (CONTEXT: Str → life, Dex → evasion, Int → energy shield).
    const maxLife = Math.round(def.baseLife + def.lifePerLevel * (level - 1) + str * 2 + (bag.life ?? 0))
    const maxEnergyShield = Math.round(int * 1.5 + (bag.energyShield ?? 0))
    const evasion = Math.round(dex * 2 + (bag.evasion ?? 0))

    const crit = Math.min(100, 5 + (bag.critChance ?? 0)) / 100
    const critMultiplier = 1 + crit * (0.5 + (bag.critDamage ?? 0) / 100)
    const fromLevelDamage = 1 + def.damagePerLevel * (level - 1)
    const hit = (weaponDamage(hero) + (bag.addedPhysical ?? 0))
        * (1 + (bag.increasedPhysical ?? 0) / 100) * fromLevelDamage

    return {
        level, str, dex, int,
        maxLife,
        maxEnergyShield,
        maxMana: Math.round(def.baseMana + int + (bag.mana ?? 0)),
        armour: Math.round(bag.armour ?? 0),
        evasion,
        blockChance: Math.min(50, bag.blockChance ?? 0), // cap 50%
        fireRes: Math.min(75, bag.fireRes ?? 0),
        coldRes: Math.min(75, bag.coldRes ?? 0),
        lightningRes: Math.min(75, bag.lightningRes ?? 0),
        magicalRes: Math.min(75, bag.magicalRes ?? 0),
        luck: bag.luck ?? 0,
        hitDamage: hit * critMultiplier,
        attacksPerSecond: def.attacksPerSecond * (1 + (bag.attackSpeed ?? 0) / 100),
        cleaveDamage: hit * critMultiplier * def.cleave.multiplier,
        cleaveCooldownSec: def.cleave.cooldownSec,
    }
}
