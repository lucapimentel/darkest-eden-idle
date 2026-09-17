import { Container, Sprite, Texture } from 'pixi.js'
import { hash, mulberry32 } from '@dei/game'

// The fight spawns on an ellipse of 460×230 (world.ts). Keep a wider ring clear, so nothing can
// ever spawn inside a wall — and so the buildings frame the fight instead of crowding it.
const CLEAR_RX = 620
const CLEAR_RY = 330
// These sprites are 400–1100px, and a unit only fills about half of its 128px cell. Tuned by eye
// against the Knight: a town the hero could walk into, not a diorama it is lost in.
const SCALE = 0.3
const COUNT = 12

/**
 * The town around the Arena (DEI-034). Pure Performance: it decides nothing.
 *
 * Buildings are props in the y-sorted `units` container, not paint on the baked ground — that is
 * what makes the Knight walk behind the ones further down the screen and in front of the rest.
 *
 * Seeded per Stage, so a Stage looks the same every visit and Stage 1 is not Stage 7. That is
 * stability, not fairness: nothing here is an outcome.
 */
export function placeTown(parent: Container, props: Texture[], stage: number): Sprite[] {
    const rand = mulberry32(hash('town', stage))
    const placed: Sprite[] = []
    for (let i = 0; i < COUNT; i++) {
        const angle = ((i + rand() * 0.7) / COUNT) * Math.PI * 2
        const spread = 1 + rand() * 0.45
        const sprite = new Sprite(props[Math.floor(rand() * props.length)])
        sprite.anchor.set(0.5, 1) // bottom-centre: the sprite's feet sit on the tile
        sprite.scale.set(SCALE)
        sprite.position.set(Math.cos(angle) * CLEAR_RX * spread, Math.sin(angle) * CLEAR_RY * spread)
        sprite.zIndex = sprite.y
        parent.addChild(sprite)
        placed.push(sprite)
    }
    return placed
}
