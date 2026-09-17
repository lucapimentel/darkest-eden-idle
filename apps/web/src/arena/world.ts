import { AnimatedSprite, Container, Sprite } from 'pixi.js'
import { ENEMIES, heroStats, monsterLevel, type SaveState } from '@dei/game'
import { bakeGround } from './ground.ts'
import { FPS } from './sheet.ts'
import { foesInRadius } from './combat.ts'
import { createUnit, setState, updateUnit, type Stats, type Unit } from './units.ts'
import type { loadTextures } from './textures.ts'

export type Textures = Awaited<ReturnType<typeof loadTextures>>

export interface World {
    root: Container
    update: (dtMs: number) => void
    /** The claim decides what dropped; the Performance only shows it. */
    queueDrops: (count: number) => void
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
        cleave: {
            damage: stats.cleaveDamage,
            radius: CLEAVE_RADIUS,
            cooldownMs: stats.cleaveCooldownSec * 1000,
            hitFrame: 8,
            minFoes: 2,
        },
    }
}

function enemyPerformanceStats(enemyId: string, level: number): Stats {
    const def = ENEMIES.find((enemy) => enemy.enemyId === enemyId) ?? ENEMIES[0]
    return {
        hp: Math.round(def.life * (1 + 0.35 * (level - 1))),
        speed: ENEMY_WALK_SPEED,
        range: def.ranged ? RANGED_RANGE : MELEE_RANGE,
        damage: def.damage * (1 + 0.3 * (level - 1)),
        attackMs: def.attackMs,
        hitFrame: def.ranged ? 9 : 7,
        ranged: def.ranged,
    }
}

export function createWorld(textures: Textures, initial: SaveState): World {
    const root = new Container()
    root.addChild(bakeGround(textures.tiles, 14, 7)) // first child = drawn underneath
    const units = new Container()
    units.sortableChildren = true // DEI-016: children are y-sorted by zIndex every frame
    root.addChild(units)

    let save = initial
    let level = monsterLevel(save.hero.stage)
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
        const size = 1 + Math.floor(Math.random() * 4)
        for (let i = 0; i < size; i++) {
            const angle = Math.random() * Math.PI * 2
            const archer = Math.random() < 0.4
            const enemy = createUnit(
                'enemy',
                enemyPerformanceStats(archer ? 'archer' : 'warrior', level),
                archer ? textures.archer : textures.warrior,
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
        const cleave = attacker.stats.cleave
        if (attacker.state === 'cleave' && cleave) {
            const swing = new AnimatedSprite({
                textures: textures.swordAoE, animationSpeed: FPS / 60, loop: false,
            })
            swing.anchor.set(0.5)
            swing.setSize(cleave.radius * 2, cleave.radius) // squashed, so it lies on the iso floor
            swing.position.set(attacker.x, attacker.y)
            swing.zIndex = attacker.y - 1 // under the swinging Knight
            swing.onComplete = () => swing.destroy()
            swing.play()
            units.addChild(swing)
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
        queueDrops(count) {
            pendingDrops += count
        },
        setSave(next) {
            save = next
            level = monsterLevel(save.hero.stage)
            // Stats can change mid-Performance (a level-up, an equip), exactly as in a claim.
            const restored = knight.hp / knight.stats.hp
            knight.stats = heroPerformanceStats(save)
            knight.hp = knight.stats.hp * restored
        },
        update(dtMs) {
            updateUnit(knight, dtMs, enemies, onHit)
            for (const enemy of enemies) updateUnit(enemy, dtMs, [knight], onHit)

            for (let i = arrows.length - 1; i >= 0; i--) {
                const arrow = arrows[i]
                const dx = arrow.target.x - arrow.sprite.x
                const dy = arrow.target.y - CHEST - arrow.sprite.y
                const dist = Math.hypot(dx, dy)
                const step = (ARROW_SPEED * dtMs) / 1000
                if (dist <= step || arrow.target.state === 'dead') {
                    damage(arrow.target, arrow.damage)
                    arrow.sprite.destroy()
                    arrows.splice(i, 1)
                    continue
                }
                arrow.sprite.x += (dx / dist) * step
                arrow.sprite.y += (dy / dist) * step
                arrow.sprite.rotation = Math.atan2(dy, dx)
                arrow.sprite.zIndex = arrow.sprite.y
            }

            for (let i = pillars.length - 1; i >= 0; i--) {
                const pillar = pillars[i]
                pillar.ms += dtMs
                const life = pillar.ms / PILLAR_MS
                if (life >= 1) {
                    pillar.sprite.destroy()
                    pillars.splice(i, 1)
                    continue
                }
                pillar.sprite.alpha = 1 - life
                pillar.sprite.y -= (PILLAR_RISE * dtMs) / PILLAR_MS
            }

            if (knight.state === 'dead') {
                knightDeadMs += dtMs
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
                nextWaveMs -= dtMs
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

