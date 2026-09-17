import { readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from './db.ts'

/**
 * Applies every migration file that has not run yet, in filename order.
 *
 * Migrations are append-only: once a file has run anywhere, it is never edited — the next change
 * is a new numbered file. Nothing warns you when a file and the database disagree.
 */
const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), '../migrations')

await sql`create table if not exists migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
)`

const alreadyApplied = new Set(
    (await sql<{ name: string }[]>`select name from migrations`).map((row) => row.name),
)

let migrationsAppliedNow = 0
for (const fileName of readdirSync(migrationsDirectory).filter((file) => file.endsWith('.sql')).sort()) {
    if (alreadyApplied.has(fileName)) continue
    // The file and its bookkeeping row go in one transaction, so a migration that fails halfway
    // can never be recorded as done. `sql.file` runs the whole file as one simple query, which
    // is what lets a single file hold several statements.
    await sql.begin(async (tx) => {
        await tx.file(join(migrationsDirectory, fileName))
        await tx`insert into migrations (name) values (${fileName})`
    })
    console.log('applied', fileName)
    migrationsAppliedNow++
}

console.log(migrationsAppliedNow === 0
    ? 'migrations: already up to date'
    : `migrations: applied ${migrationsAppliedNow}`)
await sql.end()
