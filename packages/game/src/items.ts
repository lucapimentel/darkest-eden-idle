import { BASES, baseById, type Base } from './data/bases.ts'
import { candidateMods, type ModDef, type ModTier } from './data/mods.ts'
import type { Item, Mod, Rarity } from './types.ts'

type RandomNumberSource = () => number

export const MAX_DURABILITY = 100

/** Max prefixes and suffixes per rarity (PLAN §3). Normal has no mods. */
const AFFIX_LIMIT: Record<Rarity, number> = { normal: 0, magic: 1, rare: 3 }

function pickByWeight<T>(nextRandom: RandomNumberSource, candidates: readonly T[],
    weightOf: (candidate: T) => number): T {
    const totalWeight = candidates
        .reduce((runningWeight, candidate) => runningWeight + weightOf(candidate), 0)
    let rollAcrossTheWeights = nextRandom() * totalWeight
    for (const candidate of candidates) {
        rollAcrossTheWeights -= weightOf(candidate)
        if (rollAcrossTheWeights < 0) return candidate
    }
    return candidates[candidates.length - 1]
}

/** Luck shifts the rarity weights toward Magic and Rare. */
export function rollRarity(nextRandom: RandomNumberSource, luck: number): Rarity {
    const luckBonus = 1 + luck / 100
    const rarityWeights: [Rarity, number][] = [
        ['normal', 70],
        ['magic', 25 * luckBonus],
        ['rare', 5 * luckBonus],
    ]
    return pickByWeight(nextRandom, rarityWeights, ([, weightOf]) => weightOf)[0]
}

/**
 * Luck also gives a chance to roll a value twice and keep the better one — on drops *and*
 * on crafts, which is why M6's `craft()` calls this same helper.
 */
export function rollValue(nextRandom: RandomNumberSource, tier: ModTier, luck: number): number {
    const [lowestValue, highestValue] = tier.range
    const rollOnce = () => lowestValue + nextRandom() * (highestValue - lowestValue)
    const rolledValue = luck > 0 && nextRandom() < Math.min(0.5, luck / 200)
        ? Math.max(rollOnce(), rollOnce())
        : rollOnce()
    // One decimal is enough for every Tier range in the table, and it keeps saves small.
    return Math.round(rolledValue * 10) / 10
}

function rollMod(nextRandom: RandomNumberSource, modPool: ModDef[], itemLevel: number, luck: number): Mod {
    const modDefinition = pickByWeight(nextRandom, modPool, () => 1)
    const tiersAllowedByItemLevel = modDefinition.tiers.filter((tier) => tier.itemLevel <= itemLevel)
    const tier = pickByWeight(nextRandom, tiersAllowedByItemLevel, (tierCandidate) => tierCandidate.weight)
    return { modId: modDefinition.modId, tier: tier.tier, value: rollValue(nextRandom, tier, luck) }
}

function rollAffixes(nextRandom: RandomNumberSource, chosenBase: Base, itemLevel: number,
    rarity: Rarity, luck: number): Mod[] {
    const maxModsPerAffixType = AFFIX_LIMIT[rarity]
    if (maxModsPerAffixType === 0) return []
    const rolledMods: Mod[] = []
    for (const type of ['prefix', 'suffix'] as const) {
        // At least one of each, then fill up to the limit.
        const howManyToRoll = 1 + Math.floor(nextRandom() * maxModsPerAffixType)
        const modPool = candidateMods(chosenBase.kind, itemLevel, type)
        for (let i = 0; i < howManyToRoll && modPool.length > 0; i++) {
            const rolledMod = rollMod(nextRandom, modPool, itemLevel, luck)
            rolledMods.push(rolledMod)
            // No duplicate mods on one item: "+4 life, +7 life" is a bug, not an item.
            modPool.splice(modPool.findIndex((modDefinition) => modDefinition.modId === rolledMod.modId), 1)
        }
    }
    return rolledMods
}

/**
 * The generator is passed in, not a seed, so one claim's whole loot stream comes from one
 * sequence — which is what makes a claim replayable.
 */
export function rollItem(nextRandom: RandomNumberSource, itemLevel: number, luck: number, id: string): Item {
    const basesAllowedByItemLevel = BASES.filter((chosenBase) => chosenBase.minItemLevel <= itemLevel)
    const chosenBase = pickByWeight(nextRandom, basesAllowedByItemLevel, () => 1)
    const rarity = rollRarity(nextRandom, luck)
    return {
        id,
        baseId: chosenBase.baseId,
        rarity,
        itemLevel,
        mods: rollAffixes(nextRandom, chosenBase, itemLevel, rarity, luck),
        durability: MAX_DURABILITY,
        maxDurability: MAX_DURABILITY,
        isNew: true,
    }
}

const RARITY_REPAIR: Record<Rarity, number> = { normal: 1, magic: 1.6, rare: 2.5 }

/** Gold per durability point. Scales with rarity and item level — the main gold sink in M2. */
export function repairCost(item: Item): number {
    return RARITY_REPAIR[item.rarity] * (1 + item.itemLevel / 10)
}

export const WEAR_PER_KILL = 0.05 // ~2000 kills wears an item out if it is never repaired

/**
 * Wear an equipped item for a Wave, then repair what the available gold covers.
 * When gold runs out the item keeps wearing, and at 0 it is Broken and gives no stats.
 */
export function wearAndRepair(item: Item, kills: number, gold: number):
    { durability: number; spent: number } {
    const durabilityAfterWear = Math.max(0, item.durability - WEAR_PER_KILL * kills)
    const durabilityMissing = item.maxDurability - durabilityAfterWear
    if (durabilityMissing <= 0 || gold <= 0) return { durability: durabilityAfterWear, spent: 0 }

    const goldPerDurabilityPoint = repairCost(item)
    const durabilityTheGoldCovers = Math.min(durabilityMissing, gold / goldPerDurabilityPoint)
    return {
        durability: durabilityAfterWear + durabilityTheGoldCovers,
        spent: durabilityTheGoldCovers * goldPerDurabilityPoint,
    }
}

/** What the vendor pays. The Master Tree raises this in M8. */
export function sellPrice(item: Item): number {
    return Math.max(1, Math.round(RARITY_REPAIR[item.rarity] * (2 + item.itemLevel)))
}

export function itemName(item: Item): string {
    return baseById(item.baseId).name
}
