import { useState, type FormEvent } from 'react'
import { login, signup } from '../api'

/**
 * The second of the two screens PLAN §4 describes, chosen by a conditional render on `/api/me`.
 * Still no router: there are two screens and one of them is this.
 */
export function Login({ onSignedIn }: { onSignedIn: () => void }) {
    const [isSignup, setIsSignup] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function submit(event: FormEvent) {
        event.preventDefault()
        setBusy(true)
        setError('')
        try {
            // Trimmed here as well as on the server: a pasted address often carries a trailing
            // space, and the schema's `format: email` would reject it before the server's own
            // normalisation ever ran.
            await (isSignup ? signup : login)(email.trim(), password)
            // Re-fetch /api/me rather than trusting this response: one code path for "who am I"
            // is one thing to debug.
            onSignedIn()
        } catch (problem) {
            setError((problem as Error).message)
            setBusy(false)
        }
    }

    return (
        <main className="login">
            <h1>Darkest Eden Idle</h1>
            <form onSubmit={submit}>
                <label>
                    Email
                    <input
                        type="email" value={email} autoComplete="username" required
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>
                <label>
                    Password
                    <input
                        type="password" value={password} required minLength={8}
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
                {error && <p className="refusal">{error}</p>}
                <button type="submit" disabled={busy}>
                    {isSignup ? 'Create account' : 'Enter'}
                </button>
            </form>
            <button
                type="button" className="ghost"
                onClick={() => { setIsSignup(!isSignup); setError('') }}
            >
                {isSignup ? 'I already have an account' : 'Create an account'}
            </button>
        </main>
    )
}
