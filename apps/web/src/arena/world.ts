import { AnimatedSprite, Container, Sprite } from 'pixi.js'
import { ENEMIES, heroStats, monsterLevel, type SaveState } from '@dei/game'
import { bakeGround } from './ground.ts'
import { placeTown } from './town.ts'
import { FPS } from './sheet.ts'
import { foesInRadius } from './combat.ts'
import { createUnit, setState, updateUnit, type Stats, type Unit } from './units.ts'
import type { loadTextures } from './textures.ts'

export type Textures = Awaited<ReturnType<typeof loadTextures>>

export interface World {
    root: Container
    update: (msSinceLastFrame: number) => void
    /** The ground is baked to the window, so a resized window needs a new one. */
    resize: (width: number, height: number) => void
    /** The claim decides what dropped; the Performance only shows it. */
    queueDrops: (itemCount: number) => void
    setSave: (save: SaveState) => void
}

// --- pacing: pictures, not rules. These belong in apps/web (DEI-033). ---
const NEXT_WAVE_MS = 1500 // a breather, so a cleared Wave reads as cleared
const RESPAWN_MS = 3000 // the Performance's stand-in for the claim's 30s respawn
const ARROW_SPEED = 700 // px/s: fast enough to read as an arrow, slow enough to see
const CHEST = 40 // px above the feet: arrows leave from and aim at chest height
const CORPSE_MS = 2500 // Die runs 1.5s (15 frames × 100ms), then the body lies there for 1s
const PILLAR_MS = 1200
const PILLAR_W = 44
const PILLAR_H = 260
const PILLAR_RISE = 40 // px it drifts up over its life

const GROUND_SEED = 7 // the ground decides nothing; one seed keeps it stable across rebakes

const WALK_SPEED = 150 // px/s; how fast the sprite crosses the screen, nothing more
const ENEMY_WALK_SPEED = 95
const MELEE_RANGE = 70
const RANGED_RANGE = 280
const CLEAVE_RADIUS = 130

interface Arrow { sprite: AnimatedSprite; target: Unit; damage: number }
interface Pillar { sprite: Sprite; ms: number }

/**
 * Combat stats for the Performance, derived from packages/game so the fight on screen matches
 * the fight the claim resolved. The Arena never invents a number that decides an outcome.
 */
function heroPerformanceStats(save: SaveState): Stats {
    const stats = heroStats(save.hero)
    return {
        hp: stats.maxLife + stats.maxEnergyShield,
        speed: WALK_SPEED,
        range: MELEE_RANGE,
        damage: stats.hitDamage,
        attackMs: 1000 / stats.attacksPerSecond,
        hitFrame: 8,
        cleaveStats: {
            damage: stats.cleaveDamage,
            radius: CLEAVE_RADIUS,
            cooldownMs: stats.cleaveCooldownSec * 1000,
            hitFrame: 8,
            minFoes: 2,
        },
    }
}

function enemyPerformanceStats(enemyId: string, monsterLevelForStage: number): Stats {
    const enemyDefinition = ENEMIES.find((enemy) => enemy.enemyId === enemyId) ?? ENEMIES[0]
    return {
        hp: Math.round(enemyDefinition.life * (1 + 0.35 * (monsterLevelForStage - 1))),
        speed: ENEMY_WALK_SPEED,
        range: enemyDefinition.ranged ? RANGED_RANGE : MELEE_RANGE,
        damage: enemyDefinition.damage * (1 + 0.3 * (monsterLevelForStage - 1)),
        attackMs: enemyDefinition.attackMs,
        hitFrame: enemyDefinition.ranged ? 9 : 7,
        ranged: enemyDefinition.ranged,
    }
}

export function createWorld(textures: Textures, initial: SaveState, width: number, height: number): World {
    const root = new Container()
    let ground = bakeGround(textures.tiles, width, height, GROUND_SEED)
    root.addChild(ground) // first child = drawn underneath
    const units = new Container()
    units.sortableChildren = true // DEI-016: children are y-sorted by zIndex every frame
    root.addChild(units)

    let save = initial
    let monsterLevelForStage = monsterLevel(save.hero.stage)
    // Props, not scenery: they y-sort with the units, so the Knight walks behind them.
    let town = placeTown(units, textures.town, save.hero.stage)
    const knight = createUnit('hero', heroPerformanceStats(save), textures.knight, 0, 0)
    units.addChild(knight.view)

    let enemies: Unit[] = [] // `let`, because a Knight death replaces the whole array
    const arrows: Arrow[] = []
    const pillars: Pillar[] = []
    let waitingForWave = true
    let nextWaveMs = 0
    let knightDeadMs = 0
    let pendingDrops = 0 // granted by a claim, spent on the next visual kills

    function spawnWave() {
        const packSize = 1 + Math.floor(Math.random() * 4)
        for (let i = 0; i < packSize; i++) {
            const angle = Math.random() * Math.PI * 2
            const isArcher = Math.random() < 0.4
            const enemy = createUnit(
                'enemy',
                enemyPerformanceStats(isArcher ? 'archer' : 'warrior', monsterLevelForStage),
                isArcher ? textures.archer : textures.warrior,
                Math.cos(angle) * 460, Math.sin(angle) * 230,
            )
            enemies.push(enemy)
            units.addChild(enemy.view)
        }
        waitingForWave = false
    }

    /** A pillar of light marks a kill that dropped something the claim already granted. */
    function spawnPillar(x: number, y: number) {
        const sprite = new Sprite(textures.light)
        sprite.anchor.set(0.5, 1)
        sprite.setSize(PILLAR_W, PILLAR_H)
        sprite.position.set(x, y)
        sprite.tint = 0xffd9a0
        sprite.blendMode = 'add'
        sprite.zIndex = y
        units.addChild(sprite)
        pillars.push({ sprite, ms: 0 })
    }

    function damage(target: Unit, amount: number) {
        if (target.state === 'dead') return
        target.hp -= amount
        if (target.hp > 0) {
            if (target.team === 'enemy') setState(target, 'hurt')
            return
        }
        setState(target, 'dead')
        if (target.team !== 'enemy') return
        // No Math.random() here: the claim decided the drops, this only performs them.
        if (pendingDrops > 0) {
            pendingDrops--
            spawnPillar(target.x, target.y)
        }
    }

    function onHit(attacker: Unit, target: Unit) {
        const cleave = attacker.stats.cleaveStats
        if (attacker.state === 'cleave' && cleave) {
            const swingSprite = new AnimatedSprite({
                textures: textures.swordAoE, animationSpeed: FPS / 60, loop: false,
            })
            swingSprite.anchor.set(0.5)
            swingSprite.setSize(cleave.radius * 2, cleave.radius) // squashed, so it lies on the iso floor
            swingSprite.position.set(attacker.x, attacker.y)
            swingSprite.zIndex = attacker.y - 1 // under the swinging Knight
            swingSprite.onComplete = () => swingSprite.destroy()
            swingSprite.play()
            units.addChild(swingSprite)
            for (const foe of foesInRadius(attacker.x, attacker.y, enemies, cleave.radius)) {
                damage(foe, cleave.damage)
            }
            return
        }
        if (!attacker.stats.ranged) return damage(target, attacker.stats.damage)
        const sprite = new AnimatedSprite({ textures: textures.arrow, animationSpeed: FPS / 60 })
        sprite.anchor.set(0.5)
        sprite.scale.set(0.35)
        sprite.position.set(attacker.x, attacker.y - CHEST)
        sprite.play()
        units.addChild(sprite)
        arrows.push({ sprite, target, damage: attacker.stats.damage })
    }

    return {
        root,
        queueDrops(itemCount) {
            pendingDrops += itemCount
        },
        resize(newScreenWidth, newScreenHeight) {
            ground.destroy({ children: true })
            ground = bakeGround(textures.tiles, newScreenWidth, newScreenHeight, GROUND_SEED)
            root.addChildAt(ground, 0)
        },
        setSave(nextSave) {
            const stage = save.hero.stage
            save = nextSave
            monsterLevelForStage = monsterLevel(save.hero.stage)
            if (save.hero.stage !== stage) {
                for (const prop of town) prop.destroy()
                town = placeTown(units, textures.town, save.hero.stage)
            }
            // Stats can change mid-Performance (a level-up, an equip), exactly as in a claim.
            const lifeFractionBeforeTheChange = knight.hp / knight.stats.hp
            knight.stats = heroPerformanceStats(save)
            knight.hp = knight.stats.hp * lifeFractionBeforeTheChange
        },
        update(msSinceLastFrame) {
            updateUnit(knight, msSinceLastFrame, enemies, onHit)
            for (const enemy of enemies) updateUnit(enemy, msSinceLastFrame, [knight], onHit)

            for (let i = arrows.length - 1; i >= 0; i--) {
                const arrow = arrows[i]
                const deltaX = arrow.target.x - arrow.sprite.x
                const deltaY = arrow.target.y - CHEST - arrow.sprite.y
                const distanceToTarget = Math.hypot(deltaX, deltaY)
                const step = (ARROW_SPEED * msSinceLastFrame) / 1000
                if (distanceToTarget <= step || arrow.target.state === 'dead') {
                    damage(arrow.target, arrow.damage)
                    arrow.sprite.destroy()
                    arrows.splice(i, 1)
                    continue
                }
                arrow.sprite.x += (deltaX / distanceToTarget) * step
                arrow.sprite.y += (deltaY / distanceToTarget) * step
                arrow.sprite.rotation = Math.atan2(deltaY, deltaX)
                arrow.sprite.zIndex = arrow.sprite.y
            }

            for (let i = pillars.length - 1; i >= 0; i--) {
                const pillar = pillars[i]
                pillar.ms += msSinceLastFrame
                const life = pillar.ms / PILLAR_MS
                if (life >= 1) {
                    pillar.sprite.destroy()
                    pillars.splice(i, 1)
                    continue
                }
                pillar.sprite.alpha = 1 - life
                pillar.sprite.y -= (PILLAR_RISE * msSinceLastFrame) / PILLAR_MS
            }

            if (knight.state === 'dead') {
                knightDeadMs += msSinceLastFrame
                if (knightDeadMs >= RESPAWN_MS) {
                    for (const enemy of enemies) enemy.view.destroy({ children: true })
                    enemies = []
                    for (const arrow of arrows) arrow.sprite.destroy()
                    arrows.length = 0
                    Object.assign(knight, { hp: knight.stats.hp, x: 0, y: 0, cooldownMs: 0, cleaveMs: 0 })
                    setState(knight, 'idle')
                    knightDeadMs = 0
                    waitingForWave = true
                    nextWaveMs = RESPAWN_MS / 2
                }
            }

            const anyAlive = enemies.some((enemy) => enemy.state !== 'dead')
            if (!waitingForWave && !anyAlive && knight.state !== 'dead') {
                // The Performance's life regen mirrors the claim's 20% between Waves.
                knight.hp = Math.min(knight.stats.hp, knight.hp + knight.stats.hp * 0.2)
                waitingForWave = true
                nextWaveMs = NEXT_WAVE_MS
            }
            if (waitingForWave) {
                nextWaveMs -= msSinceLastFrame
                if (nextWaveMs <= 0) spawnWave()
            }

            // corpse cleanup: backwards, because removing an item would skip the next one
            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i]
                if (enemy.state !== 'dead' || enemy.deadMs < CORPSE_MS) continue
                enemy.view.destroy({ children: true })
                enemies.splice(i, 1)
            }
        },
    }
}

