import Fastify from "fastify";
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { mulberry32 } from "@dei/game";
import { authRoutes } from './auth.ts'

const app = Fastify({
    // pino does not log request bodies by default, but a password must never reach a log file
    // even if something later starts logging one.
    logger: { redact: ['req.body.password', 'body.password', 'password'] },
})

await app.register(cookie)
await app.register(rateLimit, { global: false }) // opt in per route, see auth.ts
await app.register(authRoutes)

app.get('/api/health', async () => {
    return { ok: true, roll: mulberry32(42)() }
})

await app.listen({ port: 3000 })
