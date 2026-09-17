import { useRef, useState } from 'react'
import { Arena } from './arena/Arena'
import { Hud } from './arena/Hud'
import { Inventory } from './ui/Inventory'
import { AwayReport } from './ui/AwayReport'
import { useGame } from './game/useGame'

function App() {
    const { save, mutate, away, dropsGranted, dismissAway } = useGame()
    const [showInventory, setShowInventory] = useState(false)
    const fpsRef = useRef(0)

    return (
        <>
            <Hud save={save} fpsRef={fpsRef} onOpenInventory={() => setShowInventory(true)} />
            <Arena save={save} drops={dropsGranted} fpsRef={fpsRef} />
            {showInventory && (
                <Inventory save={save} mutate={mutate} onClose={() => setShowInventory(false)} />
            )}
            {away && <AwayReport result={away} onClose={dismissAway} />}
        </>
    )
}

export default App
