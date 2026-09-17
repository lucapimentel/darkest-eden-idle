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
export function bakeGround(tileTextures: Texture[], screenWidth: number, screenHeight: number,
    seed: number): Container {
    const nextRandom = mulberry32(seed);
    const groundContainer = new Container();
    // One tile of margin past the edge, so no half tile shows at the border.
    const halfStepsAcross = Math.ceil((screenWidth / 2 + TILE_W) / (TILE_W / 2))
    const halfStepsDown = Math.ceil((screenHeight / 2 + TILE_H) / (TILE_H / 2))

    for (let stepsDown = -halfStepsDown; stepsDown <= halfStepsDown; stepsDown++) {
        for (let stepsAcross = -halfStepsAcross; stepsAcross <= halfStepsAcross; stepsAcross++) {
            // Both steps must share parity to land on a real cell.
            if (((stepsAcross + stepsDown) & 1) !== 0) continue
            const tileSprite = new Sprite(tileTextures[Math.floor(nextRandom() * tileTextures.length)])
            tileSprite.anchor.set(0.5)
            tileSprite.position.set(stepsAcross * (TILE_W / 2), stepsDown * (TILE_H / 2))
            groundContainer.addChild(tileSprite)
        }
    }

    // A few hundred sprites become one draw call. Costs a GPU texture the size of the window.
    groundContainer.cacheAsTexture(true)
    return groundContainer
}
