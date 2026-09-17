import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { sql } from './db.ts'
import { hashPassword, verifyPassword } from './password.ts'
import {
    SESSION_COOKIE, SESSION_MAX_AGE_SEC, createSession, deleteSession, userForToken,
    type SessionUser,
} from './session.ts'

declare module 'fastify' {
    interface FastifyRequest {
        user?: SessionUser
    }
}

const isProd = process.env.NODE_ENV === 'production'

const COOKIE = {
    httpOnly: true, // JavaScript cannot read it, so an XSS bug cannot steal it
    sameSite: 'lax', // not sent on cross-site POSTs: CSRF protection for free
    // HTTPS only in production. Locally there is no HTTPS, and a browser drops a `secure` cookie
    // silently — which looks exactly like a broken login.
    secure: isProd,
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
} as const

// Login is the one endpoint with unlimited free guesses, and scrypt is deliberately slow, so it
// is also the cheapest way to exhaust the server's CPU. Tight, and per route: the claim endpoint
// in M4 runs every 30s for every player and must not share this budget.
// The in-memory store counts per instance — correct for M5's single machine, and not worth Redis.
const AUTH_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: '15 minutes' } }

// Fastify's own JSON-schema validation (PLAN §4), so no validation library.
const credentials = {
    body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
            email: { type: 'string', format: 'email', maxLength: 254 },
            // maxLength is not fussiness: scrypt over a 10MB string is free CPU for an attacker.
            password: { type: 'string', minLength: 8, maxLength: 200 },
        },
    },
}

interface Credentials {
    email: string
    password: string
}

/** Every protected route gets this, so no future endpoint can forget the check. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const token = request.cookies[SESSION_COOKIE]
    const user = token ? await userForToken(token) : null
    // The client reads 401 as "show the login screen", not as an error worth logging.
    if (!user) return reply.code(401).send({ message: 'Not signed in.' })
    request.user = user
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
    async function startSession(reply: FastifyReply, userId: string) {
        reply.setCookie(SESSION_COOKIE, await createSession(userId), COOKIE)
    }

    app.post('/api/auth/signup', { schema: credentials, config: AUTH_RATE_LIMIT }, async (request, reply) => {
        const { email, password } = request.body as Credentials
        const normalised = email.trim().toLowerCase()
        const passwordHash = await hashPassword(password)
        try {
            // No select-then-insert: two simultaneous signups would both pass the check. The
            // unique constraint is the arbiter, and 23505 is Postgres' unique_violation.
            const [user] = await sql<{ id: string }[]>`
                insert into users (email, password_hash) values (${normalised}, ${passwordHash})
                returning id`
            await startSession(reply, user.id)
            return { id: user.id, email: normalised }
        } catch (error) {
            if ((error as { code?: string }).code !== '23505') throw error
            return reply.code(409).send({ message: 'That email already has an account.' })
        }
    })

    app.post('/api/auth/login', { schema: credentials, config: AUTH_RATE_LIMIT }, async (request, reply) => {
        const { email, password } = request.body as Credentials
        // Columns by name, never `select *`: a password hash cannot leak out of an endpoint that
        // never selects it.
        const [user] = await sql<{ id: string; email: string; password_hash: string }[]>`
            select id, email, password_hash from users where email = ${email.trim().toLowerCase()}`
        // One message for both failures: telling them apart tells an attacker which emails exist.
        if (!user || !await verifyPassword(password, user.password_hash)) {
            return reply.code(401).send({ message: 'Wrong email or password.' })
        }
        await startSession(reply, user.id)
        return { id: user.id, email: user.email }
    })

    app.post('/api/auth/logout', async (request, reply) => {
        const token = request.cookies[SESSION_COOKIE]
        // Deleting the row is the part that matters; clearing the cookie is tidiness.
        if (token) await deleteSession(token)
        reply.clearCookie(SESSION_COOKIE, { path: '/' })
        return { ok: true }
    })

    // The account. In M4 it grows heroes and the active hero's items (PLAN §4).
    app.get('/api/me', { preHandler: requireAuth }, async (request) => {
        const user = request.user as SessionUser
        const [account] = await sql<{ gold: number }[]>`select gold from users where id = ${user.id}`
        return { id: user.id, email: user.email, gold: account.gold }
    })
}
