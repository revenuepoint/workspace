import { useMemo, useState } from 'react'
import { Mail } from 'lucide-react'
import type { TimelineEntry } from '@/lib/api-types'
import { formatDateTime, relativeTime } from '@/lib/format'
import { sanitizeEmailHtml } from '@/lib/sanitize'
import { cn } from '@/lib/utils'
import { FileChip } from './file-chip'

/**
 * Case timeline — chronological, newest LAST (chat order). Client entries
 * sit right in navyTint bubbles, RevenuePoint entries left in paper bubbles,
 * system events are centered mono pills.
 */
export function Timeline({ entries, caseId }: { entries: TimelineEntry[]; caseId: string }) {
  const ordered = useMemo(() => [...entries].sort((a, b) => a.at.localeCompare(b.at)), [entries])

  if (ordered.length === 0) {
    return (
      <p className="border-t border-rule/50 py-10 text-center text-sm text-mute">
        No activity yet. When RevenuePoint replies or the status changes, it&rsquo;ll show up here.
      </p>
    )
  }

  return (
    <ol className="space-y-5">
      {ordered.map((entry) => (
        <li key={entry.id}>
          <TimelineItem entry={entry} caseId={caseId} />
        </li>
      ))}
    </ol>
  )
}

function TimelineItem({ entry, caseId }: { entry: TimelineEntry; caseId: string }) {
  switch (entry.kind) {
    case 'created':
      return (
        <SystemPill at={entry.at}>
          Case created{entry.author ? ` by ${entry.author.name}` : ''}
        </SystemPill>
      )
    case 'status':
      return (
        <SystemPill at={entry.at}>
          {entry.status ? `${entry.status.fromLabel} → ${entry.status.toLabel}` : 'Status changed'}
        </SystemPill>
      )
    case 'comment':
      return (
        <Bubble entry={entry}>
          {entry.bodyText ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-inkSoft">{entry.bodyText}</p>
          ) : null}
        </Bubble>
      )
    case 'email':
      return (
        <Bubble entry={entry}>
          <EmailBody entry={entry} />
        </Bubble>
      )
    case 'file':
      return (
        <Bubble entry={entry}>
          {entry.file ? <FileChip caseId={caseId} file={entry.file} /> : null}
        </Bubble>
      )
  }
}

function SystemPill({ at, children }: { at: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-baseline gap-2 rounded-full border border-rule/60 bg-paper px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-inkMid">
      {children}
        <time dateTime={at} title={formatDateTime(at)} className="normal-case tracking-normal text-mute">
          {relativeTime(at)}
        </time>
      </span>
    </div>
  )
}

function Bubble({ entry, children }: { entry: TimelineEntry; children: React.ReactNode }) {
  const isClient = entry.side === 'client'
  return (
    <div className={cn('flex', isClient ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] sm:max-w-[75%]', isClient ? 'items-end' : 'items-start')}>
        <p className={cn('mb-1 flex items-baseline gap-2 px-1', isClient && 'flex-row-reverse')}>
          <span className="text-xs font-semibold text-inkMid">
            {entry.author?.name ?? (isClient ? 'You' : 'RevenuePoint')}
          </span>
          {!isClient && entry.author ? <span className="micro-label">RevenuePoint</span> : null}
          <time dateTime={entry.at} title={formatDateTime(entry.at)} className="font-mono text-[11px] text-mute">
            {relativeTime(entry.at)}
          </time>
        </p>
        <div
          className={cn(
            'rounded-lg border px-4 py-3',
            isClient
              ? 'rounded-br-sm border-navyTint bg-navyTint/60'
              : 'rounded-bl-sm border-rule/60 bg-paper',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** Sanitized email HTML in a clamped, expandable panel. */
function EmailBody({ entry }: { entry: TimelineEntry }) {
  const [expanded, setExpanded] = useState(false)
  const cleanHtml = useMemo(
    () => (entry.bodyHtml ? sanitizeEmailHtml(entry.bodyHtml) : ''),
    [entry.bodyHtml],
  )
  const bodyId = `email-body-${entry.id}`

  return (
    <div>
      <p className="flex items-center gap-2 border-b border-rule/50 pb-2 text-sm font-semibold text-ink">
        <Mail aria-hidden="true" className="size-4 shrink-0 text-mute" />
        {entry.emailSubject ?? 'Email'}
      </p>
      {cleanHtml ? (
        <>
          <div
            id={bodyId}
            className={cn(
              'email-body relative mt-2 overflow-hidden',
              !expanded &&
                'max-h-36 [mask-image:linear-gradient(to_bottom,black_60%,transparent)]',
            )}
            // Sanitized via sanitizeEmailHtml — the only dangerouslySetInnerHTML in the app.
            dangerouslySetInnerHTML={{ __html: cleanHtml }}
          />
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => setExpanded((v) => !v)}
            className="mt-2 rounded-sm text-xs font-semibold text-crimson underline-offset-4 transition-colors duration-[180ms] ease-editorial hover:underline"
          >
            {expanded ? 'Show less' : 'Show full email'}
          </button>
        </>
      ) : null}
    </div>
  )
}
