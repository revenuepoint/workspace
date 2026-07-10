import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { AuthCompleteErrorCode } from '@/lib/api-types'
import { identifyUser } from '@/lib/observability'
import { RETURN_TO_KEY, useSessionStore } from '@/stores/session'
import { buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Wordmark } from '@/components/wordmark'

type ErrorCode = AuthCompleteErrorCode | 'missing_token'

const ERROR_COPY: Record<ErrorCode, { heading: string; body: string; cta: string }> = {
  expired_link: {
    heading: 'This link has expired.',
    body: 'Sign-in links only last 15 minutes. Request a fresh one and you’re back in.',
    cta: 'Send a new link',
  },
  invalid_link: {
    heading: 'This link isn’t valid.',
    body: 'It may have been trimmed by your email client. Open the newest email from RevenuePoint and use the full link — or request a fresh one.',
    cta: 'Back to sign in',
  },
  link_already_used: {
    heading: 'This link was already used.',
    body: 'Each sign-in link works exactly once. Request a new one to keep going.',
    cta: 'Send a new link',
  },
  missing_token: {
    heading: 'This link isn’t valid.',
    body: 'The sign-in token is missing from the address. Open the newest email from RevenuePoint and use the full link.',
    cta: 'Back to sign in',
  },
}

function consumeReturnTo(): string {
  try {
    const stored = window.localStorage.getItem(RETURN_TO_KEY)
    window.localStorage.removeItem(RETURN_TO_KEY)
    // Only ever return to an in-app path.
    if (stored && stored.startsWith('/') && !stored.startsWith('//')) return stored
  } catch {
    // fall through
  }
  return '/cases'
}

/**
 * /login/callback?token=… — completes the magic link. Distinct error states
 * for expired vs invalid vs already-used links; success stores the session
 * and returns people to wherever they were headed.
 */
export function LoginCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useSessionStore((s) => s.login)
  const [completeError, setCompleteError] = useState<AuthCompleteErrorCode | null>(null)
  // Magic-link tokens are single-use: guard against StrictMode's double
  // effect so we never burn the token twice.
  const attempted = useRef(false)

  // A present-but-empty token (?token=) counts as missing — otherwise nothing
  // ever attempts completion and the spinner never resolves.
  const token = params.get('token')?.trim() || null

  useEffect(() => {
    if (!token || attempted.current) return
    attempted.current = true

    api
      .authComplete(token)
      .then((result) => {
        login(result.sessionJwt, result.contact)
        identifyUser(result.contact)
        navigate(consumeReturnTo(), { replace: true })
      })
      .catch((error: unknown) => {
        if (
          error instanceof ApiError &&
          (error.code === 'expired_link' || error.code === 'invalid_link' || error.code === 'link_already_used')
        ) {
          setCompleteError(error.code)
        } else {
          setCompleteError('invalid_link')
        }
      })
  }, [token, login, navigate])

  const errorCode: ErrorCode | null = token === null ? 'missing_token' : completeError

  return (
    <div className="flex min-h-screen flex-col bg-snow">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
        <Wordmark />
        <span className="micro-label ml-2.5">Workspace</span>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-24 pt-[16vh]">
        {errorCode === null ? (
          <Spinner label="Signing you in…" />
        ) : (
          <div className="w-full max-w-md rounded-lg border border-rule/70 bg-cream p-8 shadow-editorial">
            <CircleAlert aria-hidden="true" className="size-6 text-rust" />
            <h1 className="mt-4 text-xl font-semibold tracking-[-0.012em] text-ink">
              {ERROR_COPY[errorCode].heading}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-inkMid">{ERROR_COPY[errorCode].body}</p>
            <Link to="/login" className={`${buttonVariants({ size: 'md' })} mt-6`}>
              {ERROR_COPY[errorCode].cta}
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
