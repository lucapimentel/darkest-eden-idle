import { useEffect, useState } from 'react'
import { heroStats, levelFromXp, xpForLevel, xpToNext, type SaveState } from '@dei/game'

/**
 * Everything here is read from the save — the Arena no longer keeps counters of its own
 * (DEI-033). Only the fps is polled, because it is the one number the loop owns.
 */
export function Hud({ save, fpsRef, onOpenInventory }: {
    save: SaveState
    fpsRef: { current: number }
    onOpenInventory: () => void
}) {
    const [shownFps, setShownFps] = useState(0)
    useEffect(() => {
        const id = setInterval(() => setShownFps(fpsRef.current), 250)
        return () => clearInterval(id)
    }, [fpsRef])

    const stats = heroStats(save.hero)
    const level = levelFromXp(save.hero.xp)
    const into = save.hero.xp - xpForLevel(level)
    const next = xpToNext(level)
    const newItems = [...save.hero.inventory, ...save.hero.overflow]
        .filter((item) => item?.isNew).length
    const overflowUsed = save.hero.overflow.filter(Boolean).length
    const full = save.hero.inventory.every(Boolean)

    return (
        <aside className="hud">
            <h1>Darkest Eden Idle</h1>
            <p>Knight · level {level} <small>({into.toLocaleString()} / {next.toLocaleString()} xp)</small></p>
            <p className="bar"><span style={{ width: `${(into / next) * 100}%` }} /></p>
            <p>Stage {save.hero.stage} · Wave {save.hero.wave}</p>
            <p>{save.gold.toLocaleString()} gold · {stats.maxLife} life</p>

            <button type="button" onClick={onOpenInventory}>
                Inventory{newItems > 0 && <span className="badge">{newItems}</span>}
            </button>
            {full && (
                <p className="warn">
                    Inventory full — drops are going to the Overflow ({overflowUsed}/{save.hero.overflow.length}).
                </p>
            )}
            <p><small>{Math.round(shownFps)} fps</small></p>
        </aside>
    )
}
