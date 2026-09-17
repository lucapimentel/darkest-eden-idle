import { Container, Sprite, Texture } from 'pixi.js'
import { foesInRadius } from './combat.ts'
import { COLUMNS, FPS, facingRow } from './sheet.ts'
import type { Anim } from './textures.ts'


export type State = 'idle' | 'run' | 'attack' | 'cleave' | 'hurt' | 'dead'

export interface Cleave {
    damage: number
    radius: number
    cooldownMs: number
    hitFrame: number
    minFoes: number // not worth the cooldown on a single target
}

export interface Stats {
    hp: number
    speed: number
    range: number
    damage: number
    attackMs: number
    hitFrame: number
    ranged?: boolean // DEI-015: the hit frame fires an arrow instead of dealing damage
    cleaveStats?: Cleave // DEI-017: only the Knight has one in M1
}

export interface Unit {
    team: 'hero' | 'enemy'
    stats: Stats
    animationsByState: Record<State, Anim>
    x: number
    y: number
    hp: number
    state: State
    row: number
    frame: number
    frameMs: number
    deadMs: number
    cooldownMs: number
    cleaveMs: number
    target: Unit | null
    view: Container
    sprite: Sprite
    bars: Container // hidden on death
    bar: Sprite // the life bar's fill; scaled, never redrawn
}

const FRAME_MS = 1000 / FPS
const BAR_W = 38
const BAR_H = 4
const BAR_Y = -72 // px above the feet: just over the head (the sprite does not fill its 128px cell)

// Texture.WHITE + tint + size is a 1px texture stretched, so a life bar costs no redraw.
function makeLifeBar(parentContainer: Container, tint: number): Sprite {
    const bar = new Sprite(Texture.WHITE)
    bar.tint = tint
    bar.anchor.set(0, 0.5)
    bar.setSize(BAR_W, BAR_H)
    bar.position.set(-BAR_W / 2, BAR_Y)
    parentContainer.addChild(bar)
    return bar
}

export function createUnit(team: Unit['team'], stats: Stats, animationsByState: Record<State, Anim>, x:
    number, y: number): Unit {
    const sprite = new Sprite(animationsByState.idle[2][0])
    sprite.anchor.set(0.5, 105 / 128)
    const view = new Container()
    view.addChild(sprite)
    const bars = new Container()
    view.addChild(bars)
    makeLifeBar(bars, 0x000000) // the empty track, drawn under the fill
    const bar = makeLifeBar(bars, team === 'hero' ? 0x4c9a4c : 0xa33a3a)
    view.position.set(x, y)
    return {
        team, stats, animationsByState, x, y,
        hp: stats.hp,
        state: 'idle', row: 2, frame: 0, frameMs: 0, deadMs: 0,
        cooldownMs: 0, cleaveMs: 0,
        target: null, view, sprite, bars, bar,
    }
}

export function setState(unit: Unit, state: State) {
    if (unit.state === state) return
    unit.state = state
    unit.frame = 0
    unit.frameMs = 0
}

function advanceAnimationFrame(unit: Unit, msSinceLastFrame: number, loop: boolean): boolean {
    unit.frameMs += msSinceLastFrame
    while (unit.frameMs >= FRAME_MS) {
        unit.frameMs -= FRAME_MS
        if (unit.frame < COLUMNS - 1) unit.frame++
        else if (loop) unit.frame = 0
        else return true
    }
    return false
}

export function nearestAlive(unit: Unit, foes: Unit[]): Unit | null {
    let nearestFoe: Unit | null = null
    let distanceToNearestFoe = Infinity
    for (const foe of foes) {
        if (foe.state === 'dead') continue
        const distanceToFoe = Math.hypot(foe.x - unit.x, foe.y - unit.y)
        if (distanceToFoe < distanceToNearestFoe) {
            nearestFoe = foe
            distanceToNearestFoe = distanceToFoe
        }
    }
    return nearestFoe
}

export function updateUnit(unit: Unit, msSinceLastFrame: number, foes: Unit[],
    onHit: (attacker: Unit, target: Unit) => void) {
    unit.cooldownMs -= msSinceLastFrame
    unit.cleaveMs -= msSinceLastFrame
    const cleaveStats = unit.stats.cleaveStats
    if (unit.state === 'dead') {
        unit.deadMs += msSinceLastFrame
        advanceAnimationFrame(unit, msSinceLastFrame, false)
    } else if (unit.state === 'attack' || unit.state === 'cleave' || unit.state === 'hurt') {
        const frameBeforeAdvancing = unit.frame
        const animationFinished = advanceAnimationFrame(unit, msSinceLastFrame, false)
        const hitFrameForThisState = unit.state === 'cleave' && cleaveStats
            ? cleaveStats.hitFrame
            : unit.stats.hitFrame
        const crossedTheHitFrame = frameBeforeAdvancing < hitFrameForThisState
            && unit.frame >= hitFrameForThisState
        if (unit.state !== 'hurt' && unit.target && crossedTheHitFrame) onHit(unit, unit.target)
        if (animationFinished) setState(unit, 'idle')
    } else {
        const target = nearestAlive(unit, foes)
        if (!target) {
            setState(unit, 'idle')
        } else {
            const deltaX = target.x - unit.x
            const deltaY = target.y - unit.y
            const distanceToFoe = Math.hypot(deltaX, deltaY)
            unit.row = facingRow(deltaX, deltaY)
            if (distanceToFoe > unit.stats.range) {
                setState(unit, 'run')
                const stepDistance = Math.min(distanceToFoe - unit.stats.range,
                    (unit.stats.speed * msSinceLastFrame) / 1000)
                unit.x += (deltaX / distanceToFoe) * stepDistance
                unit.y += (deltaY / distanceToFoe) * stepDistance
            } else if (unit.cooldownMs <= 0) {
                unit.target = target
                unit.cooldownMs = unit.stats.attackMs
                const enoughFoesToCleave = cleaveStats && unit.cleaveMs <= 0 &&
                    foesInRadius(unit.x, unit.y, foes, cleaveStats.radius).length >= cleaveStats.minFoes
                if (enoughFoesToCleave && cleaveStats) {
                    unit.cleaveMs = cleaveStats.cooldownMs
                    setState(unit, 'cleave')
                } else {
                    setState(unit, 'attack')
                }
            } else {
                setState(unit, 'idle')
            }
        }
        if (unit.state === 'idle' || unit.state === 'run') {
            advanceAnimationFrame(unit, msSinceLastFrame, true)
        }
    }
    unit.sprite.texture = unit.animationsByState[unit.state][unit.row][unit.frame]
    unit.view.position.set(unit.x, unit.y)
    unit.view.zIndex = unit.y // DEI-016: painter's order, so units in front cover units behind
    unit.bar.setSize(Math.max(0, (unit.hp / unit.stats.hp) * BAR_W), BAR_H)
    unit.bars.visible = unit.state !== 'dead'
}
