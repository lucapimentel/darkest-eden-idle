import {
    SAVE_VERSION, hash, newSave, simulate, type ClaimResult, type SaveState,
} from '@dei/game'

const KEY = 'dei.save.v1'

// The only file in the project that knows what time it is. In M4 `claim()` becomes
// `fetch('/api/hero/claim')` and this file shrinks to nothing.

function readStoredSave(): SaveState | null {
    try {
        const rawJson = localStorage.getItem(KEY)
        if (!rawJson) return null
        const save = JSON.parse(rawJson) as SaveState
        // During M2 the shape changes often. A save that predates the change is wiped, not
        // migrated: it is going away in M4 anyway.
        if (save.version !== SAVE_VERSION) return null
        return save
    } catch {
        return null
    }
}

export function write(save: SaveState) {
    localStorage.setItem(KEY, JSON.stringify(save))
}

export function load(): SaveState {
    return readStoredSave() ?? newSave(crypto.randomUUID(), Date.now())
}

export function wipe() {
    localStorage.removeItem(KEY)
}

/**
 * Turn elapsed time into rewards. Online and offline are the same path: being away just means
 * a bigger `elapsed`.
 *
 * Moving the PC clock forward makes this pay out a week's rewards at once. That is the whole
 * point of M2 — it is the demo that motivates the server-authoritative claim in M4.
 */
export function claim(save: SaveState, now = Date.now()): { save: SaveState; result: ClaimResult } {
    const elapsedMs = Math.max(0, now - save.lastClaimAt)
    const seed = hash(save.saveId, save.lastClaimAt)
    const { save: nextSave, result } = simulate(save, elapsedMs, seed)
    nextSave.lastClaimAt = now
    write(nextSave)
    return { save: nextSave, result }
}
