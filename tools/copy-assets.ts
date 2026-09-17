import { dirname, join } from 'node:path'
import { copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { BASES } from '../packages/game/src/data/bases.ts'

const SRC = 'assets-src';
const DEST = 'apps/web/public/assets';

const sheets = (dir: string, animations: string[]) => animations.map((animation) => `${dir}/${animation}.png`);
// Loose effect frames are numbered 0001, 0003, … 0029
const frames = (dir: string, count = 15) => Array.from({ length: count }, (_, index) => `${dir}/${String(index * 2 + 1).padStart(4, '0')}.png`);

const ALLOW = [
    ...sheets('heroes/spritesheets/1Knight', ['Idle', 'Run', 'Melee', 'Melee2', 'TakeDamage', 'Die']),
    ...sheets('enemies/undead/spritesheets/6Warrior', ['Idle', 'Run', 'Attack1', 'TakeDamage', 'Die']),
    ...sheets('enemies/undead/spritesheets/5Archer', ['Idle', 'Run', 'Attack1', 'TakeDamage', 'Die']),
    ...frames('heroes/effects/projectiles/AoE/SwordAoE'),
    ...frames('heroes/effects/projectiles/Arrows/Arrow'),
    'environment/tiles/tiles_brown_01.png',
    'ui/effects/Light.png',

    // M2 UI: PONETI frames, plus the item icons named by packages/game's item bases.
    'ui/elements/InventoryItemSlot_1.png',
    'ui/elements/RarityFrame_Gray.png',
    'ui/elements/RarityFrame_Blue.png',
    'ui/elements/RarityFrame_Purple.png',
    'ui/elements/BarLittle_Description.png',
    ...BASES.map((base) => `icons/items/${base.icon}`),
]

// Start clean, so files removed from ALLOW disappear from public/ too
rmSync(DEST, { recursive: true, force: true })

for (const file of ALLOW) {
    const to = join(DEST, file);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(SRC, file), to)
    console.log('copied', file);
}
