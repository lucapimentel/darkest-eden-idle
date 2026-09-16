import { mulberry32 } from "@dei/game";
import { Container, Rectangle, Texture, Sprite } from "pixi.js"

const TILE_W = 128
const TILE_H = 64
const CELLS_PER_ROW = [8, 8, 4, 8, 4]

export function bakeGround(sheet: Texture, size: number, seed: number): Container {
    const cells: Texture[] = [];
    CELLS_PER_ROW.forEach((count, row) => {
        for (let col = 0; col < count; col++) {
            const frame = new Rectangle(col * TILE_W, row * TILE_H, TILE_W, TILE_H)
            cells.push(new Texture({ source: sheet.source, frame }))
        }
    })

    const rand = mulberry32(seed);
    const ground = new Container();
    const middleY = (size - 1) * (TILE_H / 2);

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const tile = new Sprite(cells[Math.floor(rand() * cells.length)])
            tile.anchor.set(0.5)
            tile.position.set((c - r) * (TILE_W / 2), (c + r) * (TILE_H / 2) - middleY)
            ground.addChild(tile)
        }
    }

    ground.cacheAsTexture(true)
    return ground
}