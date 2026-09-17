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
    const nextRandom = mulberry32(seed)
    const hero = save.hero
    let secondsRemaining = Math.min(Math.max(0, elapsedMs), OFFLINE_CAP_MS) / 1000

    const levelAtStartOfClaim = levelFromXp(hero.xp)
    let currentStats = heroStats(hero)
    let currentLife = hero.life > 0 ? Math.min(hero.life, currentStats.maxLife) : currentStats.maxLife

    const result: ClaimResult = {
        elapsedSec: Math.round(secondsRemaining), kills: 0, deaths: 0, xp: 0, gold: 0, levelsGained: 0,
        repairGold: 0, broken: [], items: [], overflowKept: 0, destroyed: 0,
        stage: hero.stage, wave: hero.wave,
    }

    let droppedItemCounter = 0
    while (secondsRemaining > 0) {
        const pack = rollPack(nextRandom, hero.stage, hero.wave)
        // Energy shield recharges fully between fights, so the pool always starts with all of it.
        const waveOutcome = resolveWave(pack, currentStats, currentLife + currentStats.maxEnergyShield)
        if (waveOutcome.seconds > secondsRemaining) break // not enough time left to finish this Wave
        secondsRemaining -= waveOutcome.seconds

        if (waveOutcome.died) {
            result.deaths++
            currentLife = currentStats.maxLife // the Wave restarts; a Death costs time only
            continue
        }

        // Energy shield absorbs first, then life. ES is back to full next Wave either way.
        currentLife -= Math.max(0, waveOutcome.damageTaken - currentStats.maxEnergyShield)
        currentLife = Math.min(currentStats.maxLife,
            currentLife + currentStats.maxLife * LIFE_REGEN_BETWEEN_WAVES)

        const monsterLevelForStage = monsterLevel(hero.stage)
        const xpFromThisWave = waveOutcome.kills * xpPerKill(monsterLevelForStage)
        const goldFromThisWave = waveOutcome.kills * goldPerKill(monsterLevelForStage)
        result.kills += waveOutcome.kills
        result.xp += xpFromThisWave
        result.gold += goldFromThisWave
        hero.xp += xpFromThisWave
        save.gold += goldFromThisWave

        let statsNeedRecalculating = levelFromXp(hero.xp) !== currentStats.level

        // --- Durability and Auto-repair (PLAN §3) ---
        for (const item of Object.values(hero.equipped)) {
            const wasAlreadyBroken = isBroken(item)
            const repairResult = wearAndRepair(item, waveOutcome.kills, save.gold)
            item.durability = repairResult.durability
            save.gold -= repairResult.spent
            result.repairGold += repairResult.spent
            // No gold means items keep wearing, and a Broken item gives no stats at all.
            if (!wasAlreadyBroken && isBroken(item)) {
                result.broken.push(item.id)
                statsNeedRecalculating = true
            }
        }

        // --- Drops ---
        const dropChanceWithLuck = DROP_CHANCE * (1 + currentStats.luck / 200)
        for (let dropIndex = 0; dropIndex < waveOutcome.kills; dropIndex++) {
            if (nextRandom() >= dropChanceWithLuck) continue
            const newItemId = `${save.saveId}-${input.lastClaimAt}-${droppedItemCounter++}`
            const droppedItem = rollItem(nextRandom, monsterLevelForStage, currentStats.luck, newItemId)
            const placement = place(hero.inventory, hero.overflow, droppedItem)
            if (placement.kept === null) {
                result.destroyed++ // the Overflow rule destroyed the drop; never silently
                continue
            }
            if (placement.kept === 'overflow') result.overflowKept++
            if (placement.destroyed) result.destroyed++
            result.items.push(droppedItem)
        }

        // A level-up or a broken item changes the hero from that moment on (PLAN §2).
        if (statsNeedRecalculating) {
            currentStats = heroStats(hero)
            currentLife = Math.min(currentLife, currentStats.maxLife)
        }

        hero.wave++
        if (hero.wave > WAVES_PER_STAGE) hero.wave = 1
    }

    hero.life = Math.max(1, Math.round(currentLife))
    save.gold = Math.round(save.gold)
    result.gold = Math.round(result.gold)
    result.repairGold = Math.round(result.repairGold)
    result.levelsGained = levelFromXp(hero.xp) - levelAtStartOfClaim
    result.stage = hero.stage
    result.wave = hero.wave
    return { result, save }
}
