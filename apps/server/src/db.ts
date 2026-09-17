import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
// Fail at startup, not on the first request: a server that boots without a database is far
// harder to diagnose than one that refuses to boot.
if (!databaseUrl) throw new Error('DATABASE_URL is not set (see .env.example)')

/**
 * Hand-written SQL, no ORM: this project exists to learn SQL (PLAN §4, docs/adr/0005).
 *
 * Always interpolate values through the tagged template — `sql\`… where email = ${email}\`` sends
 * the value as a bound parameter and never as part of the query string. Building a query by
 * string concatenation is how SQL injection happens, and it is the one shortcut never to take.
 */
export const sql = postgres(databaseUrl, {
    // postgres.js dumps the whole NOTICE object by default, and `create table if not exists`
    // raises one on every migrate run. Keep the message, drop the eight lines of metadata.
    onnotice: (notice) => console.log('postgres:', notice.message),
})
