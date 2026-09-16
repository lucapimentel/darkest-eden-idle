import { useRef, useEffect, useCallback } from 'react';
import { createWorld, type World } from './world';
import { useApplication, useTick } from "@pixi/react";
import type { Ticker } from "pixi.js";
import { loadTextures } from './textures';

export function Scene() {
    const { app, isInitialised } = useApplication();
    const world = useRef<World | null>(null);

    useEffect(() => {
        if (!isInitialised) {
            return;
        }
        let cancelled = false;
        loadTextures().then((textures) => {
            if (cancelled) return
            world.current = createWorld(textures)
            app.stage.addChild(world.current.root)
        })
        return () => {
            cancelled = true
            world.current?.root.destroy({ children: true })
            world.current = null
        }
    }, [app, isInitialised]);

    useTick(
        useCallback((ticker: Ticker) => {
            const currentWorld = world.current
            if (!currentWorld) return
            currentWorld.root.position.set(app.screen.width / 2, app.screen.height / 2)
            currentWorld.update(ticker.deltaMS)
        }, [])
    )

    return null
}