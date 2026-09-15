import { useState, useEffect } from 'react'
import { mulberry32 } from "@dei/game"

function App() {
  const [server, setServer] = useState('checking...');
  const [serverRoll, setServerRoll] = useState<number | null>(null);

  const browserRoll = mulberry32(42)();

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data: { ok: boolean, roll: number }) => {
        setServer(data.ok ? 'server ok' : 'server error');
        setServerRoll(data.roll);
      }).catch(() => setServer('server down'))
  }, [])

  return (
    <main>
      <h1>Darkest Eden Idle</h1>
      <p>{server}</p>
      <p>server roll: {serverRoll}</p>
      <p>browser roll: {browserRoll}</p>
      <p>{serverRoll === browserRoll ? '✅ same code, same result' : '…'}</p>
    </main>
  )
}

export default App
