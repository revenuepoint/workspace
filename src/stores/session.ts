import { create } from 'zustand'
import type { Contact } from '@/lib/api-types'

/** localStorage key for the persisted session — JSON `{ jwt, contact }`. */
export const SESSION_STORAGE_KEY = 'rp:workspace:session-jwt'
/** localStorage key for where to send someone after they sign back in. */
export const RETURN_TO_KEY = 'rp:workspace:returnTo'

interface PersistedSession {
  jwt: string
  contact: Contact
}

interface SessionState {
  jwt: string | null
  contact: Contact | null
  login: (jwt: string, contact: Contact) => void
  /** Rotate the JWT in place (X-Session-Refresh) without touching the contact. */
  setJwt: (jwt: string) => void
  logout: () => void
}

function readPersistedSession(): PersistedSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedSession>
    if (typeof parsed.jwt !== 'string' || typeof parsed.contact?.email !== 'string') return null
    return { jwt: parsed.jwt, contact: parsed.contact as Contact }
  } catch {
    return null
  }
}

function persistSession(session: PersistedSession | null): void {
  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY)
    }
  } catch {
    // Storage can be unavailable (private mode quotas); the in-memory session still works.
  }
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  ...(readPersistedSession() ?? { jwt: null, contact: null }),

  login: (jwt, contact) => {
    persistSession({ jwt, contact })
    set({ jwt, contact })
  },

  setJwt: (jwt) => {
    const contact = get().contact
    if (contact) persistSession({ jwt, contact })
    set({ jwt })
  },

  logout: () => {
    persistSession(null)
    set({ jwt: null, contact: null })
  },
}))
