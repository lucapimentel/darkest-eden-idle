import type { DamageType } from '../types.ts'

export interface EnemyDef {
    enemyId: string
    name: string
    damageType: DamageType
    ranged: boolean
    life: number // at monster level 1; scaled by monsterLife()
    damage: number
    attackMs: number
}

// M2 needs Stage 1 only, so it ships the two Stages 1–3 enemies. M9 adds the rest of the mix.
// Tuned so a fresh level 1 Knight clears Stage 1 packs and dies only rarely. M9 does the
// real balance pass across all 10 Stages.
export const ENEMIES: EnemyDef[] = [
    { enemyId: 'warrior', name: 'Skeleton Warrior', damageType: 'physical', ranged: false, life: 14, damage: 2, attackMs: 1300 },
    { enemyId: 'archer', name: 'Skeleton Archer', damageType: 'physical', ranged: true, life: 10, damage: 1.6, attackMs: 1700 },
]

/** Elites are the same enemy with a multiplier; M9 gives the Brute its own sheet and moveset. */
export const ELITE_LIFE = 6
export const ELITE_DAMAGE = 2

export const monsterLife = (enemy: EnemyDef, monsterLevel: number) =>
    Math.round(enemy.life * (1 + 0.35 * (monsterLevel - 1)))

// Not rounded to an integer: at low monster levels a whole point is a big relative step.
export const monsterDamage = (enemy: EnemyDef, monsterLevel: number) =>
    Math.round(enemy.damage * (1 + 0.3 * (monsterLevel - 1)) * 10) / 10
