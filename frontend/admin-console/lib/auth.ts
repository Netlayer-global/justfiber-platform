import type { AdminSession } from './types'

const SESSION_KEY = 'admin_session'
const TOKEN_KEY = 'admin_token'

export function saveSession(session: AdminSession): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    localStorage.setItem(TOKEN_KEY, session.token)
  }
}

export function getSession(): AdminSession | null {
  if (typeof window === 'undefined') return null
  const session = localStorage.getItem(SESSION_KEY)
  return session ? JSON.parse(session) : null
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function isSessionValid(): boolean {
  const session = getSession()
  if (!session) return false
  return Date.now() < session.expiresAt
}
