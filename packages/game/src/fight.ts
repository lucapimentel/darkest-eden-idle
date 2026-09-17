import { ENEMIES, ELITE_DAMAGE, ELITE_LIFE, monsterDamage, monsterLife, type EnemyDef } from './data/enemies.ts'
import { WAVES_PER_STAGE, enemiesForStage, monsterLevel } from './data/stages.ts'
import { mitigate } from './defense.ts'
import type { HeroStats } from './stats.ts'

type Rand = () => number

export interface Pack {
    enemies: { def: EnemyDef; life: number; damage: number }[]
    elite: boolean
    monsterLevel: number
}

export const RESPAWN_SEC = 30 // PLAN §3; the Master Tree cuts this in M8

// A fight is never instant. Without this floor an over-geared hero clears a Wave in ~0 seconds
// and simulate()'s loop runs tens of millions of times to spend 8 hours.
export const MIN_WAVE_SEC = 1

/** Packs are 1–4 enemies; Wave 10 of every Stage adds an Elite (PLAN §3). */
export function rollPack(rand: Rand, stage: number, wave: number): Pack {
    const level = monsterLevel(stage)
    const available = enemiesForStage(stage)
        .map((id) => ENEMIES.find((enemy) => enemy.enemyId === id))
        .filter((enemy): enemy is EnemyDef => enemy !== undefined)

    const size = 1 + Math.floor(rand() * 4)
    const enemies = Array.from({ length: size }, () => {
        const def = available[Math.floor(rand() * available.length)]
        return { def, life: monsterLife(def, level), damage: monsterDamage(def, level) }
    })

    const elite = wave === WAVES_PER_STAGE
    if (elite) {
        // ponytail: the Elite is a scaled Warrior; M9 gives the Brute its own stats and moveset.
        const def = available[0]
        enemies.push({
            def,
            life: monsterLife(def, level) * ELITE_LIFE,
            damage: monsterDamage(def, level) * ELITE_DAMAGE,
        })
    }
    return { enemies, elite, monsterLevel: level }
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
 * `pool` is the hero's current energy shield + life. Returns how much of it was spent.
 */
export function resolveWave(pack: Pack, stats: HeroStats, pool: number): WaveOutcome {
    const packLife = pack.enemies.reduce((sum, enemy) => sum + enemy.life, 0)

    // Cleave hits the whole pack, so its value scales with pack size — that is the entire
    // reason to enable it in the Rotation.
    const singleTarget = stats.hitDamage * stats.attacksPerSecond
    const cleave = (stats.cleaveDamage * pack.enemies.length) / stats.cleaveCooldownSec
    const heroDps = singleTarget + cleave

    const incoming = pack.enemies.reduce((sum, enemy) => {
        const perHit = mitigate(enemy.damage, stats, enemy.def.damageType, true, pack.monsterLevel)
        return sum + perHit / (enemy.def.attackMs / 1000)
    }, 0)
    // Enemies die off as the fight goes, so on average about half the pack is swinging.
    const averageIncoming = incoming * ((pack.enemies.length + 1) / 2) / pack.enemies.length

    if (heroDps <= 0) {
        // Can't kill anything. Burn the respawn timer rather than spin forever.
        return { kills: 0, seconds: RESPAWN_SEC, damageTaken: pool, died: true }
    }

    const secondsToClear = Math.max(MIN_WAVE_SEC, packLife / heroDps)
    const secondsToDie = averageIncoming > 0 ? pool / averageIncoming : Infinity

    if (secondsToDie < secondsToClear) {
        // Death costs time only: no XP, items or levels lost, and the Wave restarts.
        return { kills: 0, seconds: secondsToDie + RESPAWN_SEC, damageTaken: pool, died: true }
    }
    return {
        kills: pack.enemies.length,
        seconds: secondsToClear,
        damageTaken: averageIncoming * secondsToClear,
        died: false,
    }
}
