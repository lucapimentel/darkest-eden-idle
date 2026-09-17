import { useCallback, useEffect, useRef, useState } from 'react'
import { Arena } from './arena/Arena'
import { Hud } from './arena/Hud'
import { Inventory } from './ui/Inventory'
import { AwayReport } from './ui/AwayReport'
import { Login } from './ui/Login'
import { useGame } from './game/useGame'
import { logout, me, type Account } from './api'

function Game({ account, onLogout }: { account: Account; onLogout: () => void }) {
    const { save, mutate, away, dropsGranted, dismissAway } = useGame()
    const [showInventory, setShowInventory] = useState(false)
    const fpsRef = useRef(0)

    return (
        <>
            <Hud
                save={save} fpsRef={fpsRef} email={account.email}
                onOpenInventory={() => setShowInventory(true)} onLogout={onLogout}
            />
            <Arena save={save} drops={dropsGranted} fpsRef={fpsRef} />
            {showInventory && (
                <Inventory save={save} mutate={mutate} onClose={() => setShowInventory(false)} />
            )}
            {away && <AwayReport result={away} onClose={dismissAway} />}
        </>
    )
}

/**
 * Dev bypass: open `/?nologin` to play the localStorage game with no server and no Postgres.
 * `import.meta.env.DEV` is statically false in a production build, so the whole branch — and this
 * fake account — is dropped from the bundle. It never reaches M5.
 */
const BYPASS: Account | null =
    import.meta.env.DEV && new URLSearchParams(location.search).has('nologin')
        ? { id: 'nologin', email: 'nobody@localhost', gold: 0 }
        : null

/**
 * Two screens, chosen by `/api/me` (PLAN §4). `undefined` is the third state that matters: the
 * answer has not come back yet, and flashing the login screen at someone who is signed in is
 * exactly the bug that state prevents.
 *
 * The game itself is still saved in localStorage until M4 — the Account exists but owns nothing
 * yet, so two accounts on this browser share one save. Ugly, temporary, fixed in M4.
 */
function App() {
    const [account, setAccount] = useState<Account | null | undefined>(undefined)

    const refresh = useCallback(() => {
        // A 401 — or no server at all — falls back to the bypass, which is null unless asked for.
        me().then((account) => setAccount(account ?? BYPASS)).catch(() => setAccount(BYPASS))
    }, [])
    useEffect(refresh, [refresh])

    if (account === undefined) return null
    if (account === null) return <Login onSignedIn={refresh} />
    return (
        <Game
            account={account}
            onLogout={() => { logout().finally(() => setAccount(null)) }}
        />
    )
}

export default App
