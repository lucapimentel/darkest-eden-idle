import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

// scrypt is callback-based, and it is in the standard library: no bcrypt dependency (PLAN §4).
const deriveKey = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>
const KEY_LEN = 64
const SALT_LEN = 16

/**
 * Stored as `scrypt$<salt hex>$<hash hex>`.
 *
 * The salt is random **per password** — that is what stops one leaked rainbow table from
 * cracking every account at once. The algorithm name rides along so a future change of
 * algorithm can tell old rows apart instead of guessing.
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(SALT_LEN)
    const derivedKey = await deriveKey(password, salt, KEY_LEN)
    return `scrypt$${salt.toString('hex')}$${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedValue: string): Promise<boolean> {
    const [storedScheme, saltAsHex, hashAsHex] = storedValue.split('$')
    if (storedScheme !== 'scrypt' || !saltAsHex || !hashAsHex) return false

    const derivedKey = await deriveKey(password, Buffer.from(saltAsHex, 'hex'), KEY_LEN)
    const expectedKey = Buffer.from(hashAsHex, 'hex')
    // Never `===`: string comparison stops at the first differing byte and leaks how much of a
    // hash was right. timingSafeEqual throws on a length mismatch, hence the length check.
    return derivedKey.length === expectedKey.length && timingSafeEqual(derivedKey, expectedKey)
}
