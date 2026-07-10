import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RETURN_TO_KEY, useSessionStore } from '@/stores/session'

/**
 * Wraps every /cases* route, and is the ONLY thing that redirects to /login —
 * the 401 flow in api.ts just clears the session with the expired flag set,
 * and this gate turns that into /login?expired=1. A second navigation source
 * would race this one (a store update re-renders the gate synchronously,
 * ahead of any queued router navigation) and clobber the explanation.
 */
export function AuthGate() {
  const jwt = useSessionStore((s) => s.jwt)
  const expired = useSessionStore((s) => s.expired)
  const location = useLocation()

  if (!jwt) {
    try {
      window.localStorage.setItem(RETURN_TO_KEY, location.pathname + location.search)
    } catch {
      // non-fatal — they just land on /cases after sign-in
    }
    return <Navigate to={expired ? '/login?expired=1' : '/login'} replace />
  }

  return <Outlet />
}
