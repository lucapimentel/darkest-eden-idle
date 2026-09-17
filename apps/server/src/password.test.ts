import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, verifyPassword } from './password.ts'

test('the same password hashes differently every time', async () => {
    const a = await hashPassword('correct horse battery')
    const b = await hashPassword('correct horse battery')

    // The assertion that catches a missing salt: equal hashes would mean one table cracks all.
    assert.notEqual(a, b)
    assert.ok(await verifyPassword('correct horse battery', a))
    assert.ok(await verifyPassword('correct horse battery', b))
})

test('a wrong password fails', async () => {
    const stored = await hashPassword('correct horse battery')
    assert.equal(await verifyPassword('correct horse batteru', stored), false)
    assert.equal(await verifyPassword('', stored), false)
})

test('a stored value that is not a scrypt hash fails instead of throwing', async () => {
    assert.equal(await verifyPassword('anything', 'plaintext'), false)
    assert.equal(await verifyPassword('anything', 'bcrypt$abc$def'), false)
})
