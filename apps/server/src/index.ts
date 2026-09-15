import Fastify from "fastify";
import { mulberry32 } from "@dei/game";

const app = Fastify({ logger: true });

app.get('/api/health', async () => {
    return { ok: true, roll: mulberry32(42)() }
})

await app.listen({ port: 3000 })