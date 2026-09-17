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
    const statsFromMods: StatBag = {}
    if (isBroken(item)) return statsFromMods
    for (const mod of item.mods) {
        const stat = modById(mod.modId).stat
        statsFromMods[stat] = (statsFromMods[stat] ?? 0) + mod.value
    }
    return statsFromMods
}

function sumEquipped(hero: Hero): StatBag {
    const combinedStats: StatBag = {}
    for (const item of Object.values(hero.equipped)) {
        for (const [stat, value] of Object.entries(itemStats(item))) {
            const typedStatKey = stat as keyof StatBag
            combinedStats[typedStatKey] = (combinedStats[typedStatKey] ?? 0) + value
        }
    }
    return combinedStats
}

/** Base weapon damage, ignoring mods. An empty main hand still swings, just badly. */
function weaponDamage(hero: Hero): number {
    const mainHandWeapon = hero.equipped.mainhand
    if (!mainHandWeapon || isBroken(mainHandWeapon)) return 3 // bare hands
    const physicalDamageRange = baseById(mainHandWeapon.baseId).physical
    return physicalDamageRange ? (physicalDamageRange[0] + physicalDamageRange[1]) / 2 : 3
}

/**
 * Pure, and called again after every level-up and every item that breaks, so keep it cheap.
 * Order matters: base → flat → derived → increased.
 */
export function heroStats(hero: Hero): HeroStats {
    const classDefinition = CLASSES[hero.classId]
    const level = levelFromXp(hero.xp)
    const statsFromMods = sumEquipped(hero)

    const allAttributesBonus = statsFromMods.allAttributes ?? 0
    const attributeGainFromLevels = classDefinition.attributePerLevel * (level - 1)
    const str = classDefinition.str + attributeGainFromLevels + allAttributesBonus + (statsFromMods.str ?? 0)
    const dex = classDefinition.dex + attributeGainFromLevels + allAttributesBonus + (statsFromMods.dex ?? 0)
    const int = classDefinition.int + attributeGainFromLevels + allAttributesBonus + (statsFromMods.int ?? 0)

    // Attributes scale the defenses (CONTEXT: Str → life, Dex → evasion, Int → energy shield).
    const maxLife = Math.round(classDefinition.baseLife
        + classDefinition.lifePerLevel * (level - 1) + str * 2 + (statsFromMods.life ?? 0))
    const maxEnergyShield = Math.round(int * 1.5 + (statsFromMods.energyShield ?? 0))
    const evasion = Math.round(dex * 2 + (statsFromMods.evasion ?? 0))

    const critChanceFraction = Math.min(100, 5 + (statsFromMods.critChance ?? 0)) / 100
    const critMultiplier = 1 + critChanceFraction * (0.5 + (statsFromMods.critDamage ?? 0) / 100)
    const damageBonusFromLevels = 1 + classDefinition.damagePerLevel * (level - 1)
    const basicHitDamage = (weaponDamage(hero) + (statsFromMods.addedPhysical ?? 0))
        * (1 + (statsFromMods.increasedPhysical ?? 0) / 100) * damageBonusFromLevels

    return {
        level, str, dex, int,
        maxLife,
        maxEnergyShield,
        maxMana: Math.round(classDefinition.baseMana + int + (statsFromMods.mana ?? 0)),
        armour: Math.round(statsFromMods.armour ?? 0),
        evasion,
        blockChance: Math.min(50, statsFromMods.blockChance ?? 0), // cap 50%
        fireRes: Math.min(75, statsFromMods.fireRes ?? 0),
        coldRes: Math.min(75, statsFromMods.coldRes ?? 0),
        lightningRes: Math.min(75, statsFromMods.lightningRes ?? 0),
        magicalRes: Math.min(75, statsFromMods.magicalRes ?? 0),
        luck: statsFromMods.luck ?? 0,
        hitDamage: basicHitDamage * critMultiplier,
        attacksPerSecond: classDefinition.attacksPerSecond * (1 + (statsFromMods.attackSpeed ?? 0) / 100),
        cleaveDamage: basicHitDamage * critMultiplier * classDefinition.cleave.multiplier,
        cleaveCooldownSec: classDefinition.cleave.cooldownSec,
    }
}
