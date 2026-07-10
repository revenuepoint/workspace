import type { ReactNode } from 'react'
import { ErrorBoundary as RumErrorBoundary } from '@datadog/browser-rum-react'
import { buttonVariants } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'

/**
 * Last-resort boundary around the whole app: a render error shows a branded
 * recovery screen instead of a blank page (the 2026-07-02 prod failure mode),
 * and the RUM react plugin reports the error when observability is enabled.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <RumErrorBoundary fallback={ErrorFallback}>{children}</RumErrorBoundary>
}

function ErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col bg-snow">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
        <Wordmark />
        <span className="micro-label ml-2.5">Workspace</span>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.16em] text-mute">Something went wrong</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.012em] text-ink">
          This page hit an error it couldn&rsquo;t recover from.
        </h1>
        <p className="mt-2 max-w-md text-[0.9375rem] leading-relaxed text-inkMid">
          Reload to pick up where you left off. If it keeps happening, email{' '}
          <a
            href="mailto:support@revenuepoint.com"
            className="rounded-sm font-semibold text-crimson underline-offset-4 hover:underline"
          >
            support@revenuepoint.com
          </a>{' '}
          and we&rsquo;ll dig in.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={`${buttonVariants({ size: 'md' })} mt-8`}
        >
          Reload the page
        </button>
      </main>
    </div>
  )
}
