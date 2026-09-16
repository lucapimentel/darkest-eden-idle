import { test } from 'node:test';
import assert from 'node:assert/strict'
import { facingRow } from './sheet.ts';

test('facingRow maps screen directions to sheet row', () => {
    assert.equal(facingRow(1, 0), 0);
    assert.equal(facingRow(1, 1), 1);
    assert.equal(facingRow(-1, 0), 4);
});