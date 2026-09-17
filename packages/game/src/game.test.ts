import { test } from 'node:test'
import assert from 'node:assert/strict'

import { hash } from './hash.ts'
import { LEVEL_CAP, levelFromXp, xpForLevel, xpToNext } from './xp.ts'
import { BASES, baseById } from './data/bases.ts'
import { MODS, candidateMods, modById } from './data/mods.ts'
import { armourReduction, chanceToBeHit, mitigate } from './defense.ts'
import { heroStats, isBroken } from './stats.ts'
import { MAX_DURABILITY, repairCost, rollItem, wearAndRepair } from './items.ts'
import { OVERFLOW_SLOTS, SLOTS_PER_TAB, emptyInventory, emptyOverflow, isBetter, place } from './inventory.ts'
import { simulate, OFFLINE_CAP_MS } from './simulate.ts'
import { newSave } from './save.ts'
import { equip, rescue, sell, unequip } from './actions.ts'
import { mulberry32 } from './rng.ts'
import type { Item, Rarity, SaveState } from './types.ts'

// --- DEI-021: the seed -------------------------------------------------------------------

test('hash separates its parts, so two heroes never share a loot stream', () => {
    assert.notEqual(hash('a', 'bc'), hash('ab', 'c'))
    assert.equal(hash('hero-1', 1000), hash('hero-1', 1000))
})

// --- DEI-022: the level curve ------------------------------------------------------------

test('levelFromXp is the inverse of xpForLevel, and caps', () => {
    for (let level = 1; level <= LEVEL_CAP; level++) {
        assert.equal(levelFromXp(xpForLevel(level)), level, `level ${level}`)
        if (level > 1) assert.equal(levelFromXp(xpForLevel(level) - 1), level - 1)
    }
    assert.equal(levelFromXp(xpForLevel(LEVEL_CAP) + xpToNext(LEVEL_CAP) * 100), LEVEL_CAP)
})

// --- DEI-023: defenses -------------------------------------------------------------------

test('armour equal to 5x the hit halves it, and never passes the 90% cap', () => {
    assert.equal(armourReduction(500, 100), 0.5)
    assert.equal(armourReduction(0, 100), 0)
    assert.ok(armourReduction(1_000_000, 10) <= 0.9)
})

test('armour works better against small hits than big ones', () => {
    assert.ok(armourReduction(500, 10) > armourReduction(500, 200))
})

test('evasion caps at 75% and zero evasion is always hit', () => {
    assert.equal(chanceToBeHit(0, 3), 1)
    assert.ok(chanceToBeHit(1_000_000, 3) >= 0.25 - 1e-9)
})

test('spells ignore evasion and armour, resistances apply', () => {
    const stats = { ...heroStats(newSave('t', 0).hero), evasion: 5000, armour: 5000, fireRes: 50 }
    const spell = mitigate(100, stats, 'fire', false, 3)
    assert.ok(Math.abs(spell - 50) < 1e-9, `expected 50, got ${spell}`)
})

// --- DEI-024: the data table -------------------------------------------------------------

test('every mod row is well formed', () => {
    const seen = new Set<string>()
    for (const mod of MODS) {
        assert.ok(!seen.has(mod.modId), `duplicate mod id ${mod.modId}`)
        seen.add(mod.modId)
        assert.ok(mod.kinds.length > 0, `${mod.modId} rolls on nothing`)
        for (const kind of mod.kinds) {
            assert.ok(BASES.some((base) => base.kind === kind), `${mod.modId}: no base of ${kind}`)
        }
        // T1 is the best and needs the highest item level; ranges must ascend with it.
        const tiers = [...mod.tiers].sort((a, b) => a.tier - b.tier)
        for (let i = 1; i < tiers.length; i++) {
            assert.ok(tiers[i].itemLevel < tiers[i - 1].itemLevel, `${mod.modId} tier ilvl order`)
            assert.ok(tiers[i].range[0] < tiers[i - 1].range[0], `${mod.modId} tier value order`)
            assert.ok(tiers[i].weight > tiers[i - 1].weight, `${mod.modId}: weak tiers stay common`)
        }
        assert.equal(modById(mod.modId), mod)
    }
    for (const base of BASES) assert.equal(baseById(base.baseId), base)
})

// --- DEI-025: rollItem -------------------------------------------------------------------

test('the same seed rolls the same item', () => {
    const a = rollItem(mulberry32(99), 20, 0, 'x')
    const b = rollItem(mulberry32(99), 20, 0, 'x')
    assert.deepEqual(a, b)
})

test('a Stage 1 drop can never roll T1 or T2', () => {
    const rand = mulberry32(7)
    for (let i = 0; i < 10_000; i++) {
        for (const mod of rollItem(rand, 3, 0, `i${i}`).mods) {
            assert.equal(mod.tier, 3, `ilvl 3 rolled T${mod.tier} of ${mod.modId}`)
        }
    }
})

test('an item never rolls the same mod twice, and respects its rarity limits', () => {
    const rand = mulberry32(11)
    const limits: Record<Rarity, number> = { normal: 0, magic: 1, rare: 3 }
    for (let i = 0; i < 5_000; i++) {
        const item = rollItem(rand, 30, 0, `i${i}`)
        const ids = item.mods.map((mod) => mod.modId)
        assert.equal(new Set(ids).size, ids.length, `duplicate mod on ${item.baseId}`)
        const prefixes = item.mods.filter((mod) => modById(mod.modId).type === 'prefix').length
        const suffixes = item.mods.length - prefixes
        assert.ok(prefixes <= limits[item.rarity], `${item.rarity} had ${prefixes} prefixes`)
        assert.ok(suffixes <= limits[item.rarity], `${item.rarity} had ${suffixes} suffixes`)
    }
})

test('Luck makes Rares more common', () => {
    const rareRate = (luck: number) => {
        const rand = mulberry32(3)
        let rares = 0
        for (let i = 0; i < 20_000; i++) if (rollItem(rand, 30, luck, `i${i}`).rarity === 'rare') rares++
        return rares
    }
    assert.ok(rareRate(100) > rareRate(0), 'Luck 100 should beat Luck 0')
})

test('candidateMods gates on item level', () => {
    assert.ok(candidateMods('sword', 3, 'prefix').length > 0)
    assert.equal(candidateMods('helm', 3, 'prefix').every((mod) => mod.kinds.includes('helm')), true)
})

// --- DEI-028: the Overflow rule ----------------------------------------------------------

const item = (rarity: Rarity, itemLevel: number, id = `${rarity}${itemLevel}`): Item => ({
    id, baseId: 'rusted_sword', rarity, itemLevel, mods: [],
    durability: MAX_DURABILITY, maxDurability: MAX_DURABILITY, isNew: true,
})

test('a drop goes to the Inventory when there is room', () => {
    const inventory = emptyInventory()
    const overflow = emptyOverflow()
    assert.deepEqual(place(inventory, overflow, item('normal', 1)), { kept: 'inventory', destroyed: null })
    assert.equal(inventory[0]?.id, 'normal1')
})

test('a full Inventory sends drops to the Overflow', () => {
    const inventory = emptyInventory().map(() => item('normal', 1, 'filler'))
    const overflow = emptyOverflow()
    assert.equal(place(inventory, overflow, item('rare', 9)).kept, 'overflow')
    assert.equal(overflow[0]?.id, 'rare9')
})

test('a full Overflow keeps the better drop and destroys the worst item', () => {
    const inventory = emptyInventory().map(() => item('normal', 1, 'filler'))
    const overflow = [item('magic', 5, 'a'), item('normal', 9, 'worst'), item('rare', 3, 'c'),
    item('magic', 7, 'd'), item('magic', 8, 'e')]
    const placed = place(inventory, overflow, item('rare', 12, 'drop'))
    assert.equal(placed.kept, 'overflow')
    assert.equal(placed.destroyed?.id, 'worst')
    assert.ok(overflow.some((slot) => slot?.id === 'drop'))
    assert.ok(!overflow.some((slot) => slot?.id === 'worst'))
})

test('a worse drop into a full Overflow is destroyed and changes nothing', () => {
    const inventory = emptyInventory().map(() => item('normal', 1, 'filler'))
    const overflow = [item('rare', 5, 'a'), item('rare', 6, 'b'), item('rare', 7, 'c'),
    item('rare', 8, 'd'), item('rare', 9, 'e')]
    const before = structuredClone(overflow)
    const placed = place(inventory, overflow, item('normal', 30, 'drop'))
    assert.deepEqual(placed, { kept: null, destroyed: overflow[0] === null ? null : placed.destroyed })
    assert.equal(placed.kept, null)
    assert.equal(placed.destroyed?.id, 'drop')
    assert.deepEqual(overflow, before)
})

test('rarity beats item level, and item level breaks the tie', () => {
    assert.ok(isBetter(item('rare', 1), item('magic', 30)))
    assert.ok(isBetter(item('magic', 9), item('magic', 8)))
    assert.ok(!isBetter(item('magic', 8), item('magic', 8)))
})

// --- DEI-029: simulate -------------------------------------------------------------------

const HOUR = 60 * 60 * 1000
const start = (): SaveState => newSave('test-save', 0)
const seed = hash('test-save', 0)

test('the same save, elapsed and seed give an identical claim', () => {
    const a = simulate(start(), HOUR, seed)
    const b = simulate(start(), HOUR, seed)
    assert.deepStrictEqual(a, b)
})

test('simulate never mutates the save it was given', () => {
    const save = start()
    const before = structuredClone(save)
    simulate(save, HOUR, seed)
    assert.deepStrictEqual(save, before)
})

test('an hour of Stage 1 earns kills, XP, gold and at least one level', () => {
    const { result, save } = simulate(start(), HOUR, seed)
    assert.ok(result.kills > 0, 'no kills')
    assert.ok(result.xp > 0 && result.gold > 0)
    assert.ok(result.levelsGained >= 1, `only ${result.levelsGained} levels`)
    assert.equal(save.hero.xp, result.xp)
    assert.ok(result.elapsedSec <= 3600)
})

test('elapsed time is capped at 8 hours, however long the player was away', () => {
    const week = simulate(start(), 7 * 24 * HOUR, seed)
    const capped = simulate(start(), OFFLINE_CAP_MS, seed)
    assert.deepStrictEqual(week, capped)
})

test('a claim covering the offline cap is fast', () => {
    const began = performance.now()
    simulate(start(), OFFLINE_CAP_MS, seed)
    const took = performance.now() - began
    assert.ok(took < 1000, `8h took ${took.toFixed(0)}ms — something is stepping frames`)
})

test('splitting a claim neither creates nor loses progress', () => {
    // Every claim reseeds, so pack rolls differ and exact equality is impossible. What must
    // hold is that two half-claims are worth about as much as one whole one — if a claim
    // boundary ever paid double or ate an hour, this is what would catch it.
    const once = simulate(start(), 2 * HOUR, seed)
    const first = simulate(start(), HOUR, seed)
    const second = simulate(first.save, HOUR, hash('test-save', HOUR))

    const split = first.result.kills + second.result.kills
    const drift = Math.abs(split - once.result.kills) / once.result.kills
    assert.ok(drift < 0.05, `split claims drifted ${(drift * 100).toFixed(1)}% from one long claim`)
    assert.equal(first.result.xp + second.result.xp, second.save.hero.xp)
})

test('a claim never simulates more time than it was given', () => {
    for (const elapsed of [0, 1_000, 60_000, HOUR]) {
        const { result } = simulate(start(), elapsed, seed)
        assert.ok(result.elapsedSec <= Math.ceil(elapsed / 1000), `${elapsed}ms → ${result.elapsedSec}s`)
    }
})

test('a Broken item gives no stats at all', () => {
    const save = start()
    const sword = save.hero.equipped.mainhand
    assert.ok(sword)
    sword.mods = [{ modId: 'life', tier: 3, value: 20 }]
    const healthy = heroStats(save.hero).maxLife

    sword.durability = 0
    assert.ok(isBroken(sword))
    assert.equal(heroStats(save.hero).maxLife, healthy - 20)
})

test('Auto-repair never spends gold the Account does not have', () => {
    const save = start()
    save.gold = 0
    const { result, save: after } = simulate(save, OFFLINE_CAP_MS, seed)
    assert.ok(after.gold >= 0, 'gold went negative')
    // It may only ever repair with gold earned during the claim itself.
    assert.ok(result.repairGold <= result.gold, `spent ${result.repairGold} of ${result.gold}`)
})

test('with no gold an item keeps wearing, and bottoms out Broken', () => {
    const worn = item('normal', 1)
    worn.durability = 2
    assert.deepEqual(wearAndRepair(worn, 20, 0), { durability: 1, spent: 0 })
    assert.deepEqual(wearAndRepair(worn, 1000, 0), { durability: 0, spent: 0 })
})

test('Auto-repair tops an item up and charges for exactly what it restored', () => {
    const worn = item('normal', 1)
    worn.durability = MAX_DURABILITY - 10
    const perPoint = repairCost(worn)

    const rich = wearAndRepair(worn, 0, 10_000)
    assert.equal(rich.durability, MAX_DURABILITY)
    assert.ok(Math.abs(rich.spent - 10 * perPoint) < 1e-9)

    // Only enough gold for half the missing durability.
    const poor = wearAndRepair(worn, 0, 5 * perPoint)
    assert.ok(Math.abs(poor.durability - (MAX_DURABILITY - 5)) < 1e-9)
    assert.ok(Math.abs(poor.spent - 5 * perPoint) < 1e-9)
})

test('gold is spent on Auto-repair and is reported', () => {
    const save = start()
    save.gold = 100_000
    const { result, save: after } = simulate(save, OFFLINE_CAP_MS, seed)
    assert.ok(result.repairGold > 0, 'nothing was repaired')
    assert.equal(after.hero.equipped.mainhand?.durability, MAX_DURABILITY)
    assert.ok(result.broken.length === 0)
})

test('a hero that cannot win loses time, not items or XP', () => {
    const save = start()
    delete save.hero.equipped.mainhand // bare hands on a level 1 Knight
    save.hero.stage = 10 // monster level 30
    const { result } = simulate(save, HOUR, seed)
    assert.ok(result.deaths > 0, 'should have died')
    assert.equal(result.kills, 0)
    assert.equal(result.xp, 0)
    assert.equal(result.items.length, 0)
})

test('repairCost rises with rarity and item level', () => {
    assert.ok(repairCost(item('rare', 10)) > repairCost(item('magic', 10)))
    assert.ok(repairCost(item('magic', 30)) > repairCost(item('magic', 3)))
})

test('items are never created: everything stored was reported as a drop', () => {
    const save = start()
    save.gold = 100_000
    const { result, save: after } = simulate(save, OFFLINE_CAP_MS, seed)
    assert.ok(result.items.length > 0, 'eight hours and no drops')

    const reported = new Set(result.items.map((drop) => drop.id))
    const stored = [...after.hero.inventory, ...after.hero.overflow].filter((slot) => slot !== null)
    for (const item of stored) {
        assert.ok(reported.has(item.id), `${item.id} appeared without being reported as a drop`)
    }
    // Capacity is never exceeded, so a drop can only ever land in a slot that exists.
    assert.equal(after.hero.inventory.length, SLOTS_PER_TAB)
    assert.equal(after.hero.overflow.length, OVERFLOW_SLOTS)
    assert.ok(stored.length <= SLOTS_PER_TAB + OVERFLOW_SLOTS)
})

test('a full Inventory keeps earning, and the Overflow reports what it destroyed', () => {
    const save = start()
    save.gold = 100_000
    save.hero.inventory = save.hero.inventory.map(() => item('rare', 30, 'filler'))
    const { result } = simulate(save, OFFLINE_CAP_MS, seed)
    assert.ok(result.kills > 0)
    assert.ok(result.destroyed > 0, 'a full Inventory over 8h should have destroyed drops')
    assert.ok(result.overflowKept + result.destroyed >= result.items.length)
})

// --- DEI-031: item actions ---------------------------------------------------------------

function withInventory(...items: Item[]): SaveState {
    const save = start()
    items.forEach((entry, index) => { save.hero.inventory[index] = entry })
    return save
}

const based = (baseId: string, id: string): Item => ({
    ...item('normal', 1, id), baseId,
})

test('equipping swaps with what is already in the slot', () => {
    const save = withInventory(based('notched_axe', 'axe'))
    assert.deepEqual(equip(save, 'axe'), { ok: true })
    assert.equal(save.hero.equipped.mainhand?.id, 'axe')
    assert.ok(save.hero.inventory.some((slot) => slot?.id === 'starter-sword'))
})

test('a two-handed weapon pushes the Off-hand into the Inventory', () => {
    const save = withInventory(based('short_bow', 'bow'))
    save.hero.equipped.offhand = based('battered_shield', 'shield')

    assert.deepEqual(equip(save, 'bow'), { ok: true })
    assert.equal(save.hero.equipped.mainhand?.id, 'bow')
    assert.equal(save.hero.equipped.offhand, undefined, 'the Off-hand must be locked')
    assert.ok(save.hero.inventory.some((slot) => slot?.id === 'shield'))
    assert.ok(save.hero.inventory.some((slot) => slot?.id === 'starter-sword'))
})

test('the equip is refused when the Inventory cannot hold what it displaces', () => {
    const save = withInventory(based('short_bow', 'bow'))
    save.hero.equipped.offhand = based('battered_shield', 'shield')
    // Fill every slot except the one the bow itself is leaving.
    for (let i = 1; i < save.hero.inventory.length; i++) save.hero.inventory[i] = item('normal', 1, `f${i}`)

    const refused = equip(save, 'bow')
    assert.equal(refused.ok, false)
    // Nothing moved: a refused action must leave the save exactly as it was.
    assert.equal(save.hero.equipped.mainhand?.id, 'starter-sword')
    assert.equal(save.hero.equipped.offhand?.id, 'shield')
    assert.equal(save.hero.inventory[0]?.id, 'bow')
})

test('equipping an Off-hand pushes out a two-handed weapon', () => {
    const save = withInventory(based('battered_shield', 'shield'))
    save.hero.equipped.mainhand = based('short_bow', 'bow')
    assert.deepEqual(equip(save, 'shield'), { ok: true })
    assert.equal(save.hero.equipped.offhand?.id, 'shield')
    assert.equal(save.hero.equipped.mainhand, undefined)
    assert.ok(save.hero.inventory.some((slot) => slot?.id === 'bow'))
})

test('selling pays gold and frees the slot; rescuing empties an Overflow slot', () => {
    const save = withInventory(item('rare', 10, 'loot'))
    const before = save.gold
    assert.deepEqual(sell(save, 'loot'), { ok: true })
    assert.ok(save.gold > before)
    assert.equal(save.hero.inventory[0], null)

    save.hero.overflow[0] = item('rare', 12, 'stuck')
    assert.deepEqual(rescue(save, 'stuck'), { ok: true })
    assert.equal(save.hero.overflow[0], null)
    assert.ok(save.hero.inventory.some((slot) => slot?.id === 'stuck'))
})

test('unequip is refused when the Inventory is full', () => {
    const save = start()
    save.hero.inventory = save.hero.inventory.map((_, i) => item('normal', 1, `f${i}`))
    assert.equal(unequip(save, 'mainhand').ok, false)
    assert.equal(save.hero.equipped.mainhand?.id, 'starter-sword')
})

test('a hero grows stronger in attack as well as defence with level (PLAN §3)', () => {
    const save = start()
    const low = heroStats(save.hero)
    save.hero.xp = xpForLevel(LEVEL_CAP)
    const high = heroStats(save.hero)

    assert.ok(high.maxLife > low.maxLife, 'life should grow')
    assert.ok(high.hitDamage > low.hitDamage * 2,
        `damage must grow with level: ${low.hitDamage.toFixed(1)} → ${high.hitDamage.toFixed(1)}`)
    assert.ok(high.cleaveDamage > high.hitDamage, 'Cleave should out-hit a basic attack')
})
