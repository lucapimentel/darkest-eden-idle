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
    cleave?: Cleave // DEI-017: only the Knight has one in M1
}

export interface Unit {
    team: 'hero' | 'enemy'
    stats: Stats
    anims: Record<State, Anim>
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
function makeBar(parent: Container, tint: number): Sprite {
    const bar = new Sprite(Texture.WHITE)
    bar.tint = tint
    bar.anchor.set(0, 0.5)
    bar.setSize(BAR_W, BAR_H)
    bar.position.set(-BAR_W / 2, BAR_Y)
    parent.addChild(bar)
    return bar
}

export function createUnit(team: Unit['team'], stats: Stats, anims: Record<State, Anim>, x:
    number, y: number): Unit {
    const sprite = new Sprite(anims.idle[2][0])
    sprite.anchor.set(0.5, 105 / 128)
    const view = new Container()
    view.addChild(sprite)
    const bars = new Container()
    view.addChild(bars)
    makeBar(bars, 0x000000) // the empty track, drawn under the fill
    const bar = makeBar(bars, team === 'hero' ? 0x4c9a4c : 0xa33a3a)
    view.position.set(x, y)
    return {
        team, stats, anims, x, y,
        hp: stats.hp,
        state: 'idle', row: 2, frame: 0, frameMs: 0, deadMs: 0,
        cooldownMs: 0, cleaveMs: 0,
        target: null, view, sprite, bars, bar,
    }
}

export function setState(u: Unit, state: State) {
    if (u.state === state) return
    u.state = state
    u.frame = 0
    u.frameMs = 0
}

function advance(u: Unit, dtMs: number, loop: boolean): boolean {
    u.frameMs += dtMs
    while (u.frameMs >= FRAME_MS) {
        u.frameMs -= FRAME_MS
        if (u.frame < COLUMNS - 1) u.frame++
        else if (loop) u.frame = 0
        else return true
    }
    return false
}

export function nearestAlive(u: Unit, foes: Unit[]): Unit | null {
    let best: Unit | null = null
    let bestDist = Infinity
    for (const foe of foes) {
        if (foe.state === 'dead') continue
        const dist = Math.hypot(foe.x - u.x, foe.y - u.y)
        if (dist < bestDist) {
            best = foe
            bestDist = dist
        }
    }
    return best
}

export function updateUnit(u: Unit, dtMs: number, foes: Unit[], onHit: (attacker: Unit, target:
    Unit) => void) {
    u.cooldownMs -= dtMs
    u.cleaveMs -= dtMs
    const cleave = u.stats.cleave
    if (u.state === 'dead') {
        u.deadMs += dtMs
        advance(u, dtMs, false)
    } else if (u.state === 'attack' || u.state === 'cleave' || u.state === 'hurt') {
        const before = u.frame
        const done = advance(u, dtMs, false)
        const hit = u.state === 'cleave' && cleave ? cleave.hitFrame : u.stats.hitFrame
        if (u.state !== 'hurt' && u.target && before < hit && u.frame >= hit) onHit(u, u.target)
        if (done) setState(u, 'idle')
    } else {
        const target = nearestAlive(u, foes)
        if (!target) {
            setState(u, 'idle')
        } else {
            const dx = target.x - u.x
            const dy = target.y - u.y
            const dist = Math.hypot(dx, dy)
            u.row = facingRow(dx, dy)
            if (dist > u.stats.range) {
                setState(u, 'run')
                const step = Math.min(dist - u.stats.range, (u.stats.speed * dtMs) / 1000)
                u.x += (dx / dist) * step
                u.y += (dy / dist) * step
            } else if (u.cooldownMs <= 0) {
                u.target = target
                u.cooldownMs = u.stats.attackMs
                const pack = cleave && u.cleaveMs <= 0 &&
                    foesInRadius(u.x, u.y, foes, cleave.radius).length >= cleave.minFoes
                if (pack && cleave) {
                    u.cleaveMs = cleave.cooldownMs
                    setState(u, 'cleave')
                } else {
                    setState(u, 'attack')
                }
            } else {
                setState(u, 'idle')
            }
        }
        if (u.state === 'idle' || u.state === 'run') advance(u, dtMs, true)
    }
    u.sprite.texture = u.anims[u.state][u.row][u.frame]
    u.view.position.set(u.x, u.y)
    u.view.zIndex = u.y // DEI-016: painter's order, so units in front cover units behind
    u.bar.setSize(Math.max(0, (u.hp / u.stats.hp) * BAR_W), BAR_H)
    u.bars.visible = u.state !== 'dead'
}
