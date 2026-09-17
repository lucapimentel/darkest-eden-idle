import { mulberry32 } from "@dei/game";
import { Container, Texture, Sprite } from "pixi.js"

export const TILE_W = 128
export const TILE_H = 64

/**
 * An iso ground that fills the window (DEI-034).
 *
 * Iterating rows and columns gives a diamond with bare corners. Iterating the *diagonals*
 * instead fills a rectangle: with `u = col - row` and `v = col + row`, a cell sits at
 * `(u * TILE_W/2, v * TILE_H/2)` — and only the (u,v) pairs of equal parity are real cells.
 * The container is centred on (0,0), which is where the root sits every frame.
 */
export function bakeGround(cells: Texture[], width: number, height: number, seed: number): Container {
    const rand = mulberry32(seed);
    const ground = new Container();
    // One tile of margin past the edge, so no half tile shows at the border.
    const halfU = Math.ceil((width / 2 + TILE_W) / (TILE_W / 2))
    const halfV = Math.ceil((height / 2 + TILE_H) / (TILE_H / 2))

    for (let v = -halfV; v <= halfV; v++) {
        for (let u = -halfU; u <= halfU; u++) {
            if (((u + v) & 1) !== 0) continue // u and v must share parity to land on a cell
            const tile = new Sprite(cells[Math.floor(rand() * cells.length)])
            tile.anchor.set(0.5)
            tile.position.set(u * (TILE_W / 2), v * (TILE_H / 2))
            ground.addChild(tile)
        }
    }

    // A few hundred sprites become one draw call. Costs a GPU texture the size of the window.
    ground.cacheAsTexture(true)
    return ground
}
