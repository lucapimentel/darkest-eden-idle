import { test } from 'node:test';
import assert from 'node:assert/strict'
import { foesInRadius } from './combat.ts';

test('foesInRadius keeps the live foes inside the circle', () => {
    const foes = [
        { x: 0, y: 0, state: 'idle' },
        { x: 100, y: 0, state: 'idle' }, // out of reach
        { x: 10, y: 10, state: 'dead' }, // a corpse is not a foe
    ];
    assert.deepEqual(foesInRadius(0, 0, foes, 50), [foes[0]]);
});
