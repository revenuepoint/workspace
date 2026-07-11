import { Link, Outlet, useNavigate } from 'react-router-dom'
import { RETURN_TO_KEY, useSessionStore } from '@/stores/session'
import { clearUser } from '@/lib/observability'
import { Wordmark } from '@/components/wordmark'

/**
 * Signed-in chrome: hairline header with the wordmark, account name, and
 * sign-out. Deliberately minimal — the work lives in the page, not the frame.
 */
export function AppShell() {
  const contact = useSessionStore((s) => s.contact)
  const logout = useSessionStore((s) => s.logout)
  const navigate = useNavigate()

  function signOut() {
    try {
      window.localStorage.removeItem(RETURN_TO_KEY)
    } catch {
      // non-fatal
    }
    logout()
    clearUser()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen flex-col bg-snow">
      <header className="border-b border-rule/50">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6">
          <Link
            to="/cases"
            className="flex items-baseline gap-2.5 rounded-sm no-underline"
            aria-label="RevenuePoint Workspace — your cases"
          >
            <Wordmark />
            <span className="micro-label hidden sm:inline">Workspace</span>
          </Link>
          <div className="flex items-center gap-5">
            {contact ? <span className="micro-label hidden md:inline">{contact.accountName}</span> : null}
            <button
              type="button"
              onClick={signOut}
              className="rounded-sm text-sm text-inkMid underline-offset-4 transition-colors duration-[180ms] ease-editorial hover:text-crimson hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {contact?.impersonated ? (
        // Crimson, not amber — amber is reserved for waiting-on-you. This is
        // the "you are in a powerful mode" stripe: writes work and are
        // attributed to the actor.
        <div role="status" className="border-b border-crimson/30 bg-crimsonTint/50">
          <p className="mx-auto w-full max-w-5xl px-6 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-crimsonDeep">
            Acting as {contact.firstName} {contact.lastName} ({contact.accountName}) — you are{' '}
            {contact.actorName ?? 'RevenuePoint staff'}; actions are recorded as RevenuePoint
          </p>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Outlet />
      </main>

      <footer className="border-t border-rule/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <span className="micro-label">RevenuePoint · Workspace</span>
          <a
            href="mailto:support@revenuepoint.com"
            className="micro-label rounded-sm transition-colors duration-[180ms] ease-editorial hover:text-crimson"
          >
            support@revenuepoint.com
          </a>
        </div>
      </footer>
    </div>
  )
}
