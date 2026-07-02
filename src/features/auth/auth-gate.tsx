import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { RETURN_TO_KEY, useSessionStore } from '@/stores/session'

/**
 * Wraps every /cases* route. No session → remember where they were headed
 * (rp:workspace:returnTo) and send them to /login.
 */
export function AuthGate() {
  const jwt = useSessionStore((s) => s.jwt)
  const location = useLocation()

  if (!jwt) {
    try {
      window.localStorage.setItem(RETURN_TO_KEY, location.pathname + location.search)
    } catch {
      // non-fatal — they just land on /cases after sign-in
    }
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
