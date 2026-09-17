import { Assets, Rectangle, Texture } from "pixi.js";
import { COLUMNS, frameRect, ROWS } from "./sheet";
import type { State } from './units';

// anim[row][frame]
export type Anim = Texture[][];

export async function loadSheet(url: string): Promise<Anim> {
    const sheet = await Assets.load<Texture>(url);

    const cell = sheet.height / ROWS // 128, or 192 for Brute/DeathLord later
    const rows: Anim = [];

    for (let row = 0; row < ROWS; row++) {
        const frames: Texture[] = [];
        for (let col = 0; col < COLUMNS; col++) {
            const rectangle = frameRect(col, row, cell);
            frames.push(new Texture({ source: sheet.source, frame: new Rectangle(rectangle.x, rectangle.y, rectangle.w, rectangle.h) }))
        }
        rows.push(frames);
    }
    return rows;
}

// State name → sheet file. `satisfies` makes TypeScript check that every unit state has a sheet.
const KNIGHT_ANIMS = {
    idle: 'Idle',
    run: 'Run',
    attack: 'Melee2', // basic attack (PLAN §3)
    cleave: 'Melee', // the Cleave swing, used in DEI-017
    hurt: 'TakeDamage',
    dead: 'Die',
} satisfies Record<State, string>

const ENEMY_ANIMS = {
    idle: 'Idle',
    run: 'Run',
    attack: 'Attack1',
    cleave: 'Attack1', // skeletons never cleave; this only keeps every unit the same shape
    hurt: 'TakeDamage',
    dead: 'Die',
} satisfies Record<State, string>

async function loadUnit<K extends string>(dir: string, files: Record<K, string>): Promise<Record<K, Anim>> {
    const keys = Object.keys(files) as K[];
    const anims = await Promise.all(keys.map((key) => loadSheet(`${dir}/${files[key]}.png`)));

    return Object.fromEntries(keys.map((key, index) => [key, anims[index]])) as Record<K, Anim>;
}

export async function loadFrames(dir: string, count = 15): Promise<Texture[]> {
    const urls = Array.from({ length: count }, (_, i) => `${dir}/${String(i * 2 + 1).padStart(4,
        '0')}.png`)
    const loaded = await Assets.load<Texture>(urls)
    return urls.map((url) => loaded[url])
}

interface Cell { x: number; y: number; w: number; h: number }

/**
 * Tile sheets do not share a layout (brown_01 has 5 rows with gaps, green_01 has 7, grey_01 has
 * 3), so the cell rects come from tiles.json, which tools/copy-assets.ts generates from each
 * sheet's Unity .meta. Nothing here hardcodes a grid.
 */
async function loadTiles(file: string): Promise<Texture[]> {
    const [sheet, cells] = await Promise.all([
        Assets.load<Texture>(`/assets/${file}`),
        Assets.load<Record<string, Cell[]>>('/assets/environment/tiles/tiles.json'),
    ])
    return cells[file].map(({ x, y, w, h }) =>
        new Texture({ source: sheet.source, frame: new Rectangle(x, y, w, h) }))
}

// DEI-034: town props. Order does not matter; the layout picks from them at random per Stage.
const TOWN_PROPS = [
    'crypt/crypt_1', 'crypt/crypt_2', 'crypt/crypt_3',
    'dungeon/dungeon_1', 'dungeon/dungeon_2',
    'forge/forge_1', 'forge/forge_2', 'forge/forge_3',
    'camp/camp_1', 'camp/camp_2',
    'ramparts/ramparts_1', 'ramparts/ramparts_2', 'ramparts/ramparts_3',
    'soul_well/soul_well_1',
    'trees/trees_01', 'trees/trees_05', 'trees/trees_09', 'trees/trees_14',
]

async function loadTown(): Promise<Texture[]> {
    const urls = TOWN_PROPS.map((name) => `/assets/environment/buildings/${name}.png`)
    const loaded = await Assets.load<Texture>(urls)
    return urls.map((url) => loaded[url])
}

export async function loadTextures() {
    const [knight, warrior, archer, tiles, town, arrow, swordAoE, light] = await Promise.all([
        loadUnit('/assets/heroes/spritesheets/1Knight', KNIGHT_ANIMS),
        loadUnit('/assets/enemies/undead/spritesheets/6Warrior', ENEMY_ANIMS),
        loadUnit('/assets/enemies/undead/spritesheets/5Archer', ENEMY_ANIMS),
        loadTiles('environment/tiles/tiles_brown_01.png'),
        loadTown(),
        loadFrames('/assets/heroes/effects/projectiles/Arrows/Arrow'),
        loadFrames('/assets/heroes/effects/projectiles/AoE/SwordAoE'),
        Assets.load<Texture>('/assets/ui/effects/Light.png'),
    ])

    return { knight, warrior, archer, tiles, town, arrow, swordAoE, light }
}