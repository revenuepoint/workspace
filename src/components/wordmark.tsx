import { cn } from '@/lib/utils'

/**
 * The RevenuePoint wordmark is typographic — no logo image exists.
 * Fraunces 700, tracking -0.02em, crimson on light. Never below 14px.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-serif text-xl font-bold tracking-wordmark text-crimson', className)}>
      RevenuePoint
    </span>
  )
}
