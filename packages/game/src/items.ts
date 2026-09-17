import { BASES, baseById, type Base } from './data/bases.ts'
import { candidateMods, type ModDef, type ModTier } from './data/mods.ts'
import type { Item, Mod, Rarity } from './types.ts'

type Rand = () => number

export const MAX_DURABILITY = 100

/** Max prefixes and suffixes per rarity (PLAN §3). Normal has no mods. */
const AFFIX_LIMIT: Record<Rarity, number> = { normal: 0, magic: 1, rare: 3 }

function pickWeighted<T>(rand: Rand, items: readonly T[], weight: (item: T) => number): T {
    const total = items.reduce((sum, item) => sum + weight(item), 0)
    let roll = rand() * total
    for (const item of items) {
        roll -= weight(item)
        if (roll < 0) return item
    }
    return items[items.length - 1]
}

/** Luck shifts the rarity weights toward Magic and Rare. */
export function rollRarity(rand: Rand, luck: number): Rarity {
    const bonus = 1 + luck / 100
    const weights: [Rarity, number][] = [
        ['normal', 70],
        ['magic', 25 * bonus],
        ['rare', 5 * bonus],
    ]
    return pickWeighted(rand, weights, ([, weight]) => weight)[0]
}

/**
 * Luck also gives a chance to roll a value twice and keep the better one — on drops *and*
 * on crafts, which is why M6's `craft()` calls this same helper.
 */
export function rollValue(rand: Rand, tier: ModTier, luck: number): number {
    const [low, high] = tier.range
    const once = () => low + rand() * (high - low)
    const value = luck > 0 && rand() < Math.min(0.5, luck / 200)
        ? Math.max(once(), once())
        : once()
    // One decimal is enough for every Tier range in the table, and it keeps saves small.
    return Math.round(value * 10) / 10
}

function rollMod(rand: Rand, pool: ModDef[], itemLevel: number, luck: number): Mod {
    const def = pickWeighted(rand, pool, () => 1)
    const allowed = def.tiers.filter((tier) => tier.itemLevel <= itemLevel)
    const tier = pickWeighted(rand, allowed, (candidate) => candidate.weight)
    return { modId: def.modId, tier: tier.tier, value: rollValue(rand, tier, luck) }
}

function rollAffixes(rand: Rand, base: Base, itemLevel: number, rarity: Rarity, luck: number): Mod[] {
    const limit = AFFIX_LIMIT[rarity]
    if (limit === 0) return []
    const mods: Mod[] = []
    for (const type of ['prefix', 'suffix'] as const) {
        // At least one of each, then fill up to the limit.
        const count = 1 + Math.floor(rand() * limit)
        const pool = candidateMods(base.kind, itemLevel, type)
        for (let i = 0; i < count && pool.length > 0; i++) {
            const mod = rollMod(rand, pool, itemLevel, luck)
            mods.push(mod)
            // No duplicate mods on one item: "+4 life, +7 life" is a bug, not an item.
            pool.splice(pool.findIndex((def) => def.modId === mod.modId), 1)
        }
    }
    return mods
}

/**
 * The generator is passed in, not a seed, so one claim's whole loot stream comes from one
 * sequence — which is what makes a claim replayable.
 */
export function rollItem(rand: Rand, itemLevel: number, luck: number, id: string): Item {
    const eligible = BASES.filter((base) => base.minItemLevel <= itemLevel)
    const base = pickWeighted(rand, eligible, () => 1)
    const rarity = rollRarity(rand, luck)
    return {
        id,
        baseId: base.baseId,
        rarity,
        itemLevel,
        mods: rollAffixes(rand, base, itemLevel, rarity, luck),
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
export function wearAndRepair(item: Item, kills: number, gold: number): { durability: number; spent: number } {
    const worn = Math.max(0, item.durability - WEAR_PER_KILL * kills)
    const missing = item.maxDurability - worn
    if (missing <= 0 || gold <= 0) return { durability: worn, spent: 0 }

    const perPoint = repairCost(item)
    const affordable = Math.min(missing, gold / perPoint)
    return { durability: worn + affordable, spent: affordable * perPoint }
}

/** What the vendor pays. The Master Tree raises this in M8. */
export function sellPrice(item: Item): number {
    return Math.max(1, Math.round(RARITY_REPAIR[item.rarity] * (2 + item.itemLevel)))
}

export function itemName(item: Item): string {
    return baseById(item.baseId).name
}
