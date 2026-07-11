import { Check } from 'lucide-react'
import { casePathFor } from '@/lib/status'
import { cn } from '@/lib/utils'

/**
 * Horizontal progress path for a case: the stages it moves through, with the
 * current one marked. Completed stages are navy-filled (positive = navy, brand
 * rule — never green), the current stage is ringed, upcoming stages are muted.
 * A paused case (waiting on you / vendor / on hold) marks its current stage
 * amber-for-you / muted-otherwise and stops the fill there.
 */
export function CasePath({ status, recordType }: { status: string; recordType: string }) {
  const path = casePathFor(status, recordType)
  if (!path) return null
  const { stages, currentIndex, paused, done } = path

  return (
    <nav aria-label="Case progress" className="mt-6">
      <ol className="flex items-start">
        {stages.map((stage, i) => {
          const isDone = done || i < currentIndex
          const isCurrent = !done && i === currentIndex
          const pausedHere = isCurrent && paused !== null
          const connectorFilled = i < currentIndex || done

          return (
            <li
              key={stage.key}
              className={cn('flex min-w-0 flex-1 flex-col items-center', i === 0 && 'items-start', i === stages.length - 1 && 'items-end')}
            >
              <div className="flex w-full items-center">
                {/* Left connector */}
                {i > 0 ? (
                  <span
                    aria-hidden="true"
                    className={cn('h-px flex-1', connectorFilled ? 'bg-navy' : 'bg-rule/70')}
                  />
                ) : (
                  <span aria-hidden="true" className="flex-1" />
                )}

                {/* Node */}
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.6875rem] font-semibold transition-colors duration-[180ms] ease-editorial',
                    isDone && 'border-navy bg-navy text-snow',
                    isCurrent && !pausedHere && 'border-navy bg-navyTint text-navy ring-2 ring-navy/30',
                    pausedHere && paused === 'you' && 'border-amber bg-amber/15 text-amber ring-2 ring-amber/30',
                    pausedHere && paused !== 'you' && 'border-mute bg-paper text-mute ring-2 ring-mute/20',
                    !isDone && !isCurrent && 'border-rule/80 bg-paper text-muteSoft',
                  )}
                >
                  {isDone ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
                </span>

                {/* Right connector */}
                {i < stages.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className={cn('h-px flex-1', i < currentIndex || done ? 'bg-navy' : 'bg-rule/70')}
                  />
                ) : (
                  <span aria-hidden="true" className="flex-1" />
                )}
              </div>

              <span
                className={cn(
                  'mt-2 px-1 text-center font-mono text-[0.625rem] uppercase tracking-[0.08em]',
                  isCurrent ? (paused === 'you' ? 'text-amber' : 'text-ink') : 'text-mute',
                )}
              >
                {stage.label}
                {pausedHere ? (
                  <span className="mt-0.5 block normal-case tracking-normal text-[0.625rem] text-mute">
                    {paused === 'you' ? 'paused — your move' : paused === 'vendor' ? 'paused — vendor' : 'on hold'}
                  </span>
                ) : null}
              </span>

              {/* Screen-reader status for the current step */}
              {isCurrent ? <span className="sr-only">(current stage)</span> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
