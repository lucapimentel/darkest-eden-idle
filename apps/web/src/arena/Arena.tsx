import { Application, extend } from '@pixi/react'
import { Container, Graphics } from 'pixi.js'
import type { SaveState } from '@dei/game'
import { Scene } from './Scene'

// Only extended classes can be used as JSX (<pixiContainer>, <pixiGraphics>)
extend({ Container, Graphics })

export function Arena({ save, drops, fpsRef }: {
    save: SaveState
    drops: number
    /** Written every frame, polled by the HUD: React never re-renders at 60fps. */
    fpsRef: { current: number }
}) {
    return (
        <Application resizeTo={window} background="#0d0b0a">
            <Scene save={save} drops={drops} onFps={(value) => { fpsRef.current = value }} />
        </Application>
    )
}
