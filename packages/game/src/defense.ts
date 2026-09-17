import type { HeroStats } from './stats.ts'
import type { DamageType } from './types.ts'

export const ARMOUR_CAP = 0.9
export const EVASION_CAP = 0.75
export const BLOCK_CAP = 0.5
export const RES_CAP = 75

/** PoE-style: armour works better against small hits, so it never fully solves one big hit. */
export function armourReduction(armour: number, damage: number): number {
    if (armour <= 0 || damage <= 0) return 0
    return Math.min(ARMOUR_CAP, armour / (armour + 5 * damage))
}

/**
 * Chance to be hit. Stacking evasion has diminishing returns, so it can't be the only defense.
 * Accuracy rises with monster level, which is why evasion needs upkeep as Stages go up.
 */
export function chanceToBeHit(evasion: number, monsterLevel: number): number {
    if (evasion <= 0) return 1
    const accuracy = 40 + monsterLevel * 12
    const chance = accuracy / (accuracy + Math.pow(evasion / 4, 0.8))
    return Math.max(1 - EVASION_CAP, chance)
}

function resistance(stats: HeroStats, type: DamageType): number {
    switch (type) {
        case 'fire': return stats.fireRes
        case 'cold': return stats.coldRes
        case 'lightning': return stats.lightningRes
        case 'magical': return stats.magicalRes
        case 'physical': return 0
    }
}

/**
 * One incoming hit, resolved in PLAN §3's order: block → evasion → armour → resistance.
 *
 * Block and evasion are chances, but this returns their *expected* contribution rather than
 * rolling. A claim covers thousands of fights, so the expectation is what the player actually
 * experiences, and it keeps a claim low-variance and reproducible.
 */
export function mitigate(damage: number, stats: HeroStats, type: DamageType, isAttack: boolean,
    monsterLevel: number): number {
    if (damage <= 0) return 0
    const blocked = Math.min(BLOCK_CAP, stats.blockChance / 100)
    // Spells can't be evaded (PLAN §3); attacks and arrows can.
    const hitChance = isAttack ? chanceToBeHit(stats.evasion, monsterLevel) : 1

    let taken = damage
    if (type === 'physical') taken *= 1 - armourReduction(stats.armour, damage)
    taken *= 1 - Math.min(RES_CAP, resistance(stats, type)) / 100
    return taken * (1 - blocked) * hitChance
}
