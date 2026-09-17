import { dirname, join } from 'node:path'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { BASES } from '../packages/game/src/data/bases.ts'

const SRC = 'assets-src';
const DEST = 'apps/web/public/assets';

const sheets = (dir: string, animations: string[]) => animations.map((animation) => `${dir}/${animation}.png`);
// Loose effect frames are numbered 0001, 0003, … 0029
const frames = (dir: string, count = 15) => Array.from({ length: count }, (_, index) => `${dir}/${String(index * 2 + 1).padStart(4, '0')}.png`);
const buildings = (set: string, names: string[]) => names.map((name) => `environment/buildings/${set}/${name}.png`);

// Tile sheets get their cell rects exported to tiles.json (see below), so the client never
// hardcodes a per-sheet table again (DEI-034).
const TILE_SHEETS = [
    'environment/tiles/tiles_brown_01.png',
]

// DEI-034: the town around the Arena. Props only — they decide nothing.
const TOWN = [
    ...buildings('crypt', ['crypt_1', 'crypt_2', 'crypt_3']),
    ...buildings('dungeon', ['dungeon_1', 'dungeon_2']),
    ...buildings('forge', ['forge_1', 'forge_2', 'forge_3']),
    ...buildings('camp', ['camp_1', 'camp_2']),
    ...buildings('ramparts', ['ramparts_1', 'ramparts_2', 'ramparts_3']),
    ...buildings('soul_well', ['soul_well_1']),
    ...buildings('trees', ['trees_01', 'trees_05', 'trees_09', 'trees_14']),
]

const ALLOW = [
    ...sheets('heroes/spritesheets/1Knight', ['Idle', 'Run', 'Melee', 'Melee2', 'TakeDamage', 'Die']),
    ...sheets('enemies/undead/spritesheets/6Warrior', ['Idle', 'Run', 'Attack1', 'TakeDamage', 'Die']),
    ...sheets('enemies/undead/spritesheets/5Archer', ['Idle', 'Run', 'Attack1', 'TakeDamage', 'Die']),
    ...frames('heroes/effects/projectiles/AoE/SwordAoE'),
    ...frames('heroes/effects/projectiles/Arrows/Arrow'),
    ...TILE_SHEETS,
    ...TOWN,
    'ui/effects/Light.png',

    // M2 UI: PONETI frames, plus the item icons named by packages/game's item bases.
    'ui/elements/InventoryItemSlot_1.png',
    'ui/elements/RarityFrame_Gray.png',
    'ui/elements/RarityFrame_Blue.png',
    'ui/elements/RarityFrame_Purple.png',
    'ui/elements/BarLittle_Description.png',
    ...BASES.map((base) => `icons/items/${base.icon}`),
]

/** PNG header: width and height are big-endian uint32s at byte 16 and 20 (IHDR). */
function pngHeight(file: string): number {
    return readFileSync(file).readUInt32BE(20)
}

/**
 * Every tile sheet ships a Unity `.meta` listing the rect of each cell it contains — which is
 * the only honest source for "where are the tiles", since the sheets differ (brown_01 is 5 rows
 * with gaps, green_01 has 7, grey_01 has 3).
 *
 * The trap: Unity rects are bottom-up. Convert to Pixi's top-down here, once.
 */
function tileCells(file: string) {
    const meta = readFileSync(join(SRC, `${file}.meta`), 'utf8')
    const height = pngHeight(join(SRC, file))
    const rects = [...meta.matchAll(/x: (\d+)\s+y: (\d+)\s+width: (\d+)\s+height: (\d+)/g)]
        .map(([, x, y, w, h]) => ({ x: +x, y: height - +y - +h, w: +w, h: +h }))
    rects.sort((a, b) => a.y - b.y || a.x - b.x)
    return rects
}

// Start clean, so files removed from ALLOW disappear from public/ too
rmSync(DEST, { recursive: true, force: true })

for (const file of ALLOW) {
    const to = join(DEST, file);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(SRC, file), to)
    console.log('copied', file);
}

const tiles = Object.fromEntries(TILE_SHEETS.map((file) => [file, tileCells(file)]))
writeFileSync(join(DEST, 'environment/tiles/tiles.json'), JSON.stringify(tiles))
console.log('wrote tiles.json', Object.entries(tiles).map(([k, v]) => `${k}: ${v.length} cells`).join(', '))
