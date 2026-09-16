import { Application, extend } from '@pixi/react'
import { Container, Graphics } from 'pixi.js'
import { Scene } from './Scene';
import { Hud } from './Hud';

// Only extended classes can be used as JSX (<pixiContainer>, <pixiGraphics>)
extend({ Container, Graphics });

export function Arena() {
    return (
        <>
            <Hud />
            <Application resizeTo={window} background='#0d0b0a'>
                <Scene />
            </Application>
        </>
    )
}