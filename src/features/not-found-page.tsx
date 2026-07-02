import { Link } from 'react-router-dom'
import { buttonVariants } from '@/components/ui/button'
import { Wordmark } from '@/components/wordmark'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-snow">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
        <Link to="/cases" className="flex items-baseline gap-2.5 rounded-sm no-underline">
          <Wordmark />
          <span className="micro-label">Workspace</span>
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        <p className="font-mono text-sm uppercase tracking-[0.16em] text-mute">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.012em] text-ink">
          This page doesn&rsquo;t exist.
        </h1>
        <p className="mt-2 text-[0.9375rem] text-inkMid">Head back to your cases.</p>
        <Link to="/cases" className={`${buttonVariants({ size: 'md' })} mt-8`}>
          Back to cases
        </Link>
      </main>
    </div>
  )
}
