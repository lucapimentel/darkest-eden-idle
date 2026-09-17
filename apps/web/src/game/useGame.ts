import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClaimResult, SaveState } from '@dei/game'
import { claim, load, write } from './save'

const CLAIM_INTERVAL_MS = 30_000 // the cadence PLAN §2 specifies for the real thing
const AWAY_REPORT_THRESHOLD_SEC = 60

/**
 * Server state, pretending to be a server. Everything that mutates the save settles a claim
 * first, so rewards are always earned with the stats that earned them — a habit in M2, and a
 * correctness requirement from M4 on.
 */
export function useGame() {
    const [save, setSave] = useState<SaveState>(load)
    const [away, setAway] = useState<ClaimResult | null>(null)
    // Cumulative count of items claims have granted. The Arena shows one light pillar each,
    // so the Performance never invents a drop of its own.
    const [dropsGranted, setDropsGranted] = useState(0)
    // The claim reads the latest save without re-arming the interval on every state change.
    // Synced in an effect, not during render: `settle` only ever runs from a timer or an event,
    // so it always sees a save the DOM has already committed.
    const latestSave = useRef(save)
    useEffect(() => { latestSave.current = save }, [save])

    const settle = useCallback((): SaveState => {
        const { save: nextSave, result } = claim(latestSave.current)
        latestSave.current = nextSave
        setSave(nextSave)
        if (result.items.length > 0) setDropsGranted((previousTotal) => previousTotal + result.items.length)
        return nextSave
    }, [])

    /** Apply a change on top of a freshly settled claim. */
    const mutate = useCallback((applyChange: (save: SaveState) => void) => {
        const nextSave = structuredClone(settle())
        applyChange(nextSave)
        write(nextSave)
        latestSave.current = nextSave
        setSave(nextSave)
    }, [settle])

    useEffect(() => {
        // The claim on load is the one that pays out time spent away.
        const { save: nextSave, result } = claim(latestSave.current)
        latestSave.current = nextSave
        setSave(nextSave)
        setDropsGranted((previousTotal) => previousTotal + result.items.length)
        if (result.elapsedSec >= AWAY_REPORT_THRESHOLD_SEC) setAway(result)

        const claimIntervalId = setInterval(settle, CLAIM_INTERVAL_MS)
        const onTabBecameVisible = () => { if (document.visibilityState === 'visible') settle() }
        document.addEventListener('visibilitychange', onTabBecameVisible)
        return () => {
            clearInterval(claimIntervalId)
            document.removeEventListener('visibilitychange', onTabBecameVisible)
        }
    }, [settle])

    return { save, mutate, settle, away, dropsGranted, dismissAway: () => setAway(null) }
}
