import { WAVES_PER_STAGE, goldPerKill, monsterLevel, xpPerKill } from './data/stages.ts'
import { resolveWave, rollPack } from './fight.ts'
import { place } from './inventory.ts'
import { rollItem, wearAndRepair } from './items.ts'
import { mulberry32 } from './rng.ts'
import { heroStats, isBroken } from './stats.ts'
import type { Item, SaveState } from './types.ts'
import { levelFromXp } from './xp.ts'

export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000 // the Master Tree raises this to 12h in M8
const DROP_CHANCE = 0.05 // per kill, before Luck
const LIFE_REGEN_BETWEEN_WAVES = 0.2 // PLAN §3: only 20%, so deaths come from attrition

export interface ClaimResult {
    elapsedSec: number
    kills: number
    deaths: number
    xp: number
    gold: number
    levelsGained: number
    repairGold: number
    broken: string[]
    items: Item[]
    overflowKept: number
    destroyed: number
    stage: number
    wave: number
}

export interface ClaimOutcome {
    result: ClaimResult
    /** The new save. The input is never touched, so a failed claim can replay the same seed. */
    save: SaveState
}

/**
 * The only thing that ever grants a reward (PLAN §2). Pure: no Date.now(), no Math.random(),
 * and the input save is cloned rather than mutated. `elapsedMs` is an argument, and the offline
 * cap is applied in here so that no caller can forget it.
 */
export function simulate(input: SaveState, elapsedMs: number, seed: number): ClaimOutcome {
    const save = structuredClone(input)
    const rand = mulberry32(seed)
    const hero = save.hero
    let remaining = Math.min(Math.max(0, elapsedMs), OFFLINE_CAP_MS) / 1000

    const startLevel = levelFromXp(hero.xp)
    let stats = heroStats(hero)
    let life = hero.life > 0 ? Math.min(hero.life, stats.maxLife) : stats.maxLife

    const result: ClaimResult = {
        elapsedSec: Math.round(remaining), kills: 0, deaths: 0, xp: 0, gold: 0, levelsGained: 0,
        repairGold: 0, broken: [], items: [], overflowKept: 0, destroyed: 0,
        stage: hero.stage, wave: hero.wave,
    }

    let itemSeq = 0
    while (remaining > 0) {
        const pack = rollPack(rand, hero.stage, hero.wave)
        // Energy shield recharges fully between fights, so the pool always starts with all of it.
        const outcome = resolveWave(pack, stats, life + stats.maxEnergyShield)
        if (outcome.seconds > remaining) break // not enough time left to finish this Wave
        remaining -= outcome.seconds

        if (outcome.died) {
            result.deaths++
            life = stats.maxLife // the Wave restarts; a Death costs time only
            continue
        }

        // Energy shield absorbs first, then life. ES is back to full next Wave either way.
        life -= Math.max(0, outcome.damageTaken - stats.maxEnergyShield)
        life = Math.min(stats.maxLife, life + stats.maxLife * LIFE_REGEN_BETWEEN_WAVES)

        const level = monsterLevel(hero.stage)
        const xp = outcome.kills * xpPerKill(level)
        const gold = outcome.kills * goldPerKill(level)
        result.kills += outcome.kills
        result.xp += xp
        result.gold += gold
        hero.xp += xp
        save.gold += gold

        let statsDirty = levelFromXp(hero.xp) !== stats.level

        // --- Durability and Auto-repair (PLAN §3) ---
        for (const item of Object.values(hero.equipped)) {
            const wasBroken = isBroken(item)
            const repaired = wearAndRepair(item, outcome.kills, save.gold)
            item.durability = repaired.durability
            save.gold -= repaired.spent
            result.repairGold += repaired.spent
            // No gold means items keep wearing, and a Broken item gives no stats at all.
            if (!wasBroken && isBroken(item)) {
                result.broken.push(item.id)
                statsDirty = true
            }
        }

        // --- Drops ---
        const dropChance = DROP_CHANCE * (1 + stats.luck / 200)
        for (let i = 0; i < outcome.kills; i++) {
            if (rand() >= dropChance) continue
            const id = `${save.saveId}-${input.lastClaimAt}-${itemSeq++}`
            const drop = rollItem(rand, level, stats.luck, id)
            const placed = place(hero.inventory, hero.overflow, drop)
            if (placed.kept === null) {
                result.destroyed++ // the Overflow rule destroyed the drop; never silently
                continue
            }
            if (placed.kept === 'overflow') result.overflowKept++
            if (placed.destroyed) result.destroyed++
            result.items.push(drop)
        }

        // A level-up or a broken item changes the hero from that moment on (PLAN §2).
        if (statsDirty) {
            stats = heroStats(hero)
            life = Math.min(life, stats.maxLife)
        }

        hero.wave++
        if (hero.wave > WAVES_PER_STAGE) hero.wave = 1
    }

    hero.life = Math.max(1, Math.round(life))
    save.gold = Math.round(save.gold)
    result.gold = Math.round(result.gold)
    result.repairGold = Math.round(result.repairGold)
    result.levelsGained = levelFromXp(hero.xp) - startLevel
    result.stage = hero.stage
    result.wave = hero.wave
    return { result, save }
}
