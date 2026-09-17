import { createHash, randomBytes } from 'node:crypto'
import { sql } from './db.ts'

export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60

/**
 * Opaque random tokens in Postgres, not JWT (PLAN §4, docs/adr/0004): a row can be deleted, so
 * "logout kills the session on the server" is one `delete` rather than a revocation list.
 *
 * The cookie holds the token; the database holds only its sha256. A leaked database therefore
 * cannot be used to log in. Plain sha256 is enough here — unlike a password, the token is
 * already 32 random bytes, so there is nothing to brute-force.
 */
const sha256Hex = (token: string) => createHash('sha256').update(token).digest('hex')

export interface SessionUser {
    id: string
    email: string
}

export async function createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url') // cookie-safe without escaping
    await sql`
        insert into sessions (token_hash, user_id, expires_at)
        values (${sha256Hex(token)}, ${userId}, now() + make_interval(secs => ${SESSION_MAX_AGE_SEC}))`
    return token
}

/** The `expires_at` filter is what makes an expired row stop working before anything deletes it. */
export async function userForToken(token: string): Promise<SessionUser | null> {
    const [sessionUser] = await sql<SessionUser[]>`
        select users.id, users.email
        from sessions
        join users on users.id = sessions.user_id
        where sessions.token_hash = ${sha256Hex(token)} and sessions.expires_at > now()`
    return sessionUser ?? null
}

export async function deleteSession(token: string): Promise<void> {
    await sql`delete from sessions where token_hash = ${sha256Hex(token)}`
}
