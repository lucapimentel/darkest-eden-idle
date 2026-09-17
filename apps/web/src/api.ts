/**
 * The one place that talks to the server. Same origin (PLAN §4), so the session cookie rides
 * along on its own: no CORS, no Authorization header, nothing to forget.
 */

export interface Account {
    id: string
    email: string
    gold: number
}

async function postJson(url: string, body: unknown): Promise<unknown> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (response.ok) return response.json()
    // Fastify sends { message } for both its schema errors and ours, so the form can always show
    // the reason — a login that fails silently is the worst thing in M3 to debug by hand.
    const problemFromServer = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(problemFromServer?.message ?? 'Something went wrong. Try again.')
}

export const signup = (email: string, password: string) => postJson('/api/auth/signup', { email, password })
export const login = (email: string, password: string) => postJson('/api/auth/login', { email, password })
export const logout = () => postJson('/api/auth/logout', {})

/** 401 is not an error here: it is simply "nobody is signed in", so the app shows the login screen. */
export async function me(): Promise<Account | null> {
    const response = await fetch('/api/me')
    if (response.status === 401) return null
    if (!response.ok) throw new Error('The server is not answering.')
    return response.json() as Promise<Account>
}
