import { dirname, join } from 'node:path'
import { copyFileSync, mkdirSync } from 'node:fs'

const SRC = 'assets-src';
const DEST = 'apps/web/public/assets';

const ALLOW = [
    'heroes/spritesheets/1Knight/Idle.png',
    'ui/elements/RarityFrame_Purple.png',
]

for (const file of ALLOW) {
    const to = join(DEST, file);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(SRC, file), to)
    console.log('copied', file);
}