import { test } from 'node:test';
import assert from 'node:assert/strict'
import { mulberry32 } from './rng.ts';

test("same seed gives the same sequence", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    console.log({ a: a(), b: b() })
    for (let i = 0; i < 1000; i++) {
        assert.equal(a(), b())
    }
})

test('values are in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
        const value = r();
        assert.ok(value >= 0 && value < 1)
    }
})

test('different seeds give different first values', () => {
    const a = mulberry32(5);
    const b = mulberry32(4);

    const valueA = a();
    const valueB = b();

    assert.notEqual(valueA, valueB)
})