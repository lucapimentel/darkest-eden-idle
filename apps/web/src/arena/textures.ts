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

export async function loadTextures() {
    const [knight, warrior, archer] = await Promise.all([
        loadUnit('/assets/heroes/spritesheets/1Knight', KNIGHT_ANIMS),
        loadUnit('/assets/enemies/undead/spritesheets/6Warrior', ENEMY_ANIMS),
        loadUnit('/assets/enemies/undead/spritesheets/5Archer', ENEMY_ANIMS),
    ])

    return { knight, warrior, archer }
}