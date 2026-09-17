import { useRef, useEffect, useCallback } from 'react'
import { useApplication, useTick } from '@pixi/react'
import type { Ticker } from 'pixi.js'
import type { SaveState } from '@dei/game'
import { createWorld, type World } from './world'
import { loadTextures } from './textures'

const RESIZE_DEBOUNCE_MS = 200

export function Scene({ save, drops, onFps }: {
    save: SaveState
    /** Items the last claim granted; the Performance shows one light pillar each. */
    drops: number
    onFps: (fps: number) => void
}) {
    const { app, isInitialised } = useApplication()
    const world = useRef<World | null>(null)
    // Refs, not state: the loop reads the latest values without re-rendering React at 60fps.
    const latestSave = useRef(save)

    useEffect(() => {
        if (!isInitialised) return
        let cancelled = false
        loadTextures().then((textures) => {
            if (cancelled) return
            world.current = createWorld(
                textures, latestSave.current, app.screen.width, app.screen.height,
            )
            app.stage.addChild(world.current.root)
        })

        // The ground is baked to the window and cached as one texture, so a window that grows
        // would show bare corners until it is rebaked. Debounced: a drag-resize fires
        // continuously and re-caching is the expensive part.
        let rebakeTimer: ReturnType<typeof setTimeout>
        const onResize = (width: number, height: number) => {
            clearTimeout(rebakeTimer)
            rebakeTimer = setTimeout(() => world.current?.resize(width, height), RESIZE_DEBOUNCE_MS)
        }
        app.renderer.on('resize', onResize)

        return () => {
            cancelled = true
            clearTimeout(rebakeTimer)
            app.renderer.off('resize', onResize)
            world.current?.root.destroy({ children: true })
            world.current = null
        }
    }, [app, isInitialised])

    useEffect(() => {
        latestSave.current = save
        world.current?.setSave(save)
    }, [save])

    // `drops` is a running total, so queue only what has not been performed yet.
    const dropsAlreadyQueued = useRef(0)
    useEffect(() => {
        const dropsNotYetPerformed = drops - dropsAlreadyQueued.current
        if (dropsNotYetPerformed <= 0) return
        dropsAlreadyQueued.current = drops
        world.current?.queueDrops(dropsNotYetPerformed)
    }, [drops])

    useTick(
        useCallback((ticker: Ticker) => {
            const current = world.current
            if (!current) return
            onFps(ticker.FPS)
            current.root.position.set(app.screen.width / 2, app.screen.height / 2)
            current.update(ticker.deltaMS)
        }, [app, onFps]),
    )

    return null
}
