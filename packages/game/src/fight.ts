import { ENEMIES, ELITE_DAMAGE, ELITE_LIFE, monsterDamage, monsterLife, type EnemyDef } from './data/enemies.ts'
import { WAVES_PER_STAGE, enemiesForStage, monsterLevel } from './data/stages.ts'
import { mitigate } from './defense.ts'
import type { HeroStats } from './stats.ts'

type RandomNumberSource = () => number

export interface Pack {
    enemies: { enemyDefinition: EnemyDef; life: number; damage: number }[]
    elite: boolean
    monsterLevel: number
}

export const RESPAWN_SEC = 30 // PLAN §3; the Master Tree cuts this in M8

// A fight is never instant. Without this floor an over-geared hero clears a Wave in ~0 seconds
// and simulate()'s loop runs tens of millions of times to spend 8 hours.
export const MIN_WAVE_SEC = 1

/** Packs are 1–4 enemies; Wave 10 of every Stage adds an Elite (PLAN §3). */
export function rollPack(nextRandom: RandomNumberSource, stage: number, wave: number): Pack {
    const levelForThisStage = monsterLevel(stage)
    const enemyTypesForStage = enemiesForStage(stage)
        .map((id) => ENEMIES.find((enemy) => enemy.enemyId === id))
        .filter((enemy): enemy is EnemyDef => enemy !== undefined)

    const packSize = 1 + Math.floor(nextRandom() * 4)
    const enemies = Array.from({ length: packSize }, () => {
        const enemyDefinition = enemyTypesForStage[Math.floor(nextRandom() * enemyTypesForStage.length)]
        return {
            enemyDefinition,
            life: monsterLife(enemyDefinition, levelForThisStage),
            damage: monsterDamage(enemyDefinition, levelForThisStage),
        }
    })

    const elite = wave === WAVES_PER_STAGE
    if (elite) {
        // ponytail: the Elite is a scaled Warrior; M9 gives the Brute its own stats and moveset.
        const enemyDefinition = enemyTypesForStage[0]
        enemies.push({
            enemyDefinition,
            life: monsterLife(enemyDefinition, levelForThisStage) * ELITE_LIFE,
            damage: monsterDamage(enemyDefinition, levelForThisStage) * ELITE_DAMAGE,
        })
    }
    return { enemies, elite, monsterLevel: levelForThisStage }
}

export interface WaveOutcome {
    kills: number
    seconds: number
    damageTaken: number
    died: boolean
}

/**
 * One Wave, resolved statistically rather than frame by frame: a claim covers ~10k fights and
 * must run in milliseconds, so there is no stepping here. The Arena's Performance is what makes
 * a fight look like a fight; this decides what it was worth.
 *
 * `lifeAndShieldPool` is the hero's current energy shield + life. Returns how much of it
 * was spent.
 */
export function resolveWave(pack: Pack, heroCombatStats: HeroStats, lifeAndShieldPool: number): WaveOutcome {
    const packTotalLife = pack.enemies
        .reduce((runningTotal, enemyInPack) => runningTotal + enemyInPack.life, 0)

    // Cleave hits the whole pack, so its value scales with pack size — that is the entire
    // reason to enable it in the Rotation.
    const basicAttackDamagePerSecond = heroCombatStats.hitDamage * heroCombatStats.attacksPerSecond
    const cleaveDamagePerSecond = (heroCombatStats.cleaveDamage * pack.enemies.length)
        / heroCombatStats.cleaveCooldownSec
    const heroDamagePerSecond = basicAttackDamagePerSecond + cleaveDamagePerSecond

    const incomingDamagePerSecond = pack.enemies.reduce((runningTotal, enemyInPack) => {
        const damagePerHitAfterMitigation = mitigate(
            enemyInPack.damage, heroCombatStats, enemyInPack.enemyDefinition.damageType,
            true, pack.monsterLevel,
        )
        return runningTotal + damagePerHitAfterMitigation / (enemyInPack.enemyDefinition.attackMs / 1000)
    }, 0)
    // Enemies die off as the fight goes, so on average about half the pack is swinging.
    const averageIncomingDamagePerSecond =
        incomingDamagePerSecond * ((pack.enemies.length + 1) / 2) / pack.enemies.length

    if (heroDamagePerSecond <= 0) {
        // Can't kill anything. Burn the respawn timer rather than spin forever.
        return { kills: 0, seconds: RESPAWN_SEC, damageTaken: lifeAndShieldPool, died: true }
    }

    const secondsToClear = Math.max(MIN_WAVE_SEC, packTotalLife / heroDamagePerSecond)
    const secondsToDie = averageIncomingDamagePerSecond > 0
        ? lifeAndShieldPool / averageIncomingDamagePerSecond
        : Infinity

    if (secondsToDie < secondsToClear) {
        // Death costs time only: no XP, items or levels lost, and the Wave restarts.
        return { kills: 0, seconds: secondsToDie + RESPAWN_SEC, damageTaken: lifeAndShieldPool, died: true }
    }
    return {
        kills: pack.enemies.length,
        seconds: secondsToClear,
        damageTaken: averageIncomingDamagePerSecond * secondsToClear,
        died: false,
    }
}
