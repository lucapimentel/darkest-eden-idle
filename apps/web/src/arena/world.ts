import { Container, Sprite } from 'pixi.js'
import { COLUMNS, DIRECTIONS, FPS } from './sheet.ts'
import { loadTextures } from './textures'


export type Textures = Awaited<ReturnType<typeof loadTextures>>
export interface World {
    root: Container,
    update: (dtMs: number) => void
}

const FRAME_MS = 1000 / FPS // 100ms per frame at 10fps

export function createWorld(textures: Textures): World {
    const root = new Container();
    const idle = textures.knight.idle;

    const knights = DIRECTIONS.map((_, row) => {
        const sprite = new Sprite(idle[row][0]);
        sprite.anchor.set(0.5, 105 / 128);
        sprite.x = (row - (DIRECTIONS.length - 1) / 2) * 100;
        root.addChild(sprite);
        return sprite;
    })

    let elapsedMs = 0;
    let frame = 0;

    return {
        root,
        update(dtMs) {
            elapsedMs += dtMs
            while (elapsedMs >= FRAME_MS) {
                elapsedMs -= FRAME_MS
                frame = (frame + 1) % COLUMNS
            }
            knights.forEach((sprite, row) => (sprite.texture = idle[row][frame]))
        }
    }
}