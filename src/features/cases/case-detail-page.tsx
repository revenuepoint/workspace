import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { CaseDetail } from '@/lib/api-types'
import { formatDate, relativeTime } from '@/lib/format'
import { priorityLabelFor } from '@/lib/priority'
import { renderMarkdown } from '@/lib/sanitize'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { StatusChip } from '@/components/ui/status-chip'
import { CasePath } from './case-path'
import { CommentComposer } from './comment-composer'
import { FileChip } from './file-chip'
import { Timeline } from './timeline'

export function CaseDetailPage() {
  const { id = '' } = useParams()

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['case', id],
    queryFn: ({ signal }) => api.getCase(id, { signal }),
    staleTime: 15_000,
    // Fresh replies matter most on an open case page — poll gently while
    // the tab is visible (TanStack pauses the interval in background tabs).
    refetchInterval: 60_000,
  })

  if (isPending) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading this case…" />
      </div>
    )
  }

  if (error) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <div className="py-24 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-mute">
          {missing ? 'Not found' : 'Something went wrong'}
        </p>
        <p className="mt-3 text-[0.9375rem] text-inkMid">
          {missing
            ? 'This case doesn’t exist — or it belongs to another account.'
            : 'We couldn’t load this case.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {!missing ? (
            <Button variant="neutral" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          ) : null}
          <Button asChild variant="quiet" size="sm">
            <Link to="/cases">Back to cases</Link>
          </Button>
        </div>
      </div>
    )
  }

  return <CaseDetailView detail={data} />
}

function CaseDetailView({ detail }: { detail: CaseDetail }) {
  return (
    <article>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-baseline gap-2 font-mono text-[0.8125rem]">
        <Link
          to="/cases"
          className="rounded-sm text-mute underline-offset-4 transition-colors duration-[180ms] ease-editorial hover:text-crimson hover:underline"
        >
          Cases
        </Link>
        <span aria-hidden="true" className="text-muteSoft">
          ·
        </span>
        <span aria-current="page" className="text-inkMid">
          #{detail.caseNumber}
        </span>
      </nav>

      <h1 className="mt-3 max-w-prose text-[1.75rem] font-semibold leading-snug tracking-[-0.012em] text-ink">
        {detail.subject}
      </h1>

      {/* Meta row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-mute">
        <StatusChip status={detail.status} />
        <MetaDot />
        <span className="text-inkMid">{detail.recordTypeLabel}</span>
        <MetaDot />
        <span>
          Created <time dateTime={detail.createdAt}>{formatDate(detail.createdAt)}</time>
        </span>
        <MetaDot />
        <span>
          Updated{' '}
          <time dateTime={detail.lastModifiedAt} className="font-mono">
            {relativeTime(detail.lastModifiedAt)}
          </time>
        </span>
        {detail.urgency ? (
          <>
            <MetaDot />
            <span>
              Urgency <span className="text-inkMid">{detail.urgency}</span>
            </span>
          </>
        ) : null}
        {priorityLabelFor(detail.priority) ? (
          <>
            <MetaDot />
            <span>
              Priority <span className="text-inkMid">{priorityLabelFor(detail.priority)}</span>
            </span>
          </>
        ) : null}
        {!detail.owner.isQueue ? (
          <>
            <MetaDot />
            <span className="text-inkMid">With {detail.owner.name}</span>
          </>
        ) : null}
        {detail.submittedBy ? (
          <>
            <MetaDot />
            <span>Submitted by {detail.submittedBy.name}</span>
          </>
        ) : null}
      </div>

      <CasePath status={detail.status} recordType={detail.recordType} />

      {detail.waitingOnYou ? (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3.5"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber" />
          <div>
            <p className="text-sm font-semibold text-ink">Waiting on you</p>
            <p className="mt-0.5 text-sm leading-relaxed text-inkMid">
              RevenuePoint needs something from you before this can move. Check the latest note below
              and reply when you&rsquo;re ready.
            </p>
          </div>
        </div>
      ) : null}

      {/* Description + Files — two columns on wide screens; Files (usually
          important) ride a sticky right rail instead of the page bottom.
          Description is client-authored Markdown, sanitized before render. */}
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start lg:gap-10">
        <section aria-labelledby="case-description-heading">
          <h2 id="case-description-heading" className="micro-label">
            Description
          </h2>
          <CaseDescription markdown={detail.description} />
        </section>

        {detail.files.length > 0 ? (
          <section
            aria-labelledby="case-files-heading"
            className="mt-8 lg:sticky lg:top-6 lg:mt-0"
          >
            <h2 id="case-files-heading" className="micro-label">
              Files
            </h2>
            <ul className="mt-2.5 flex flex-wrap gap-2 lg:flex-col">
              {detail.files.map((file) => (
                <li key={file.contentDocumentId}>
                  <FileChip caseId={detail.id} file={file} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* Composer + resolve lead the activity block, so the newest entries
          (feed is newest-first) sit right under the reply box. */}
      <section
        aria-labelledby="case-activity-heading"
        className="mt-10 border-t border-rule/50 pt-8"
      >
        <h2 id="case-activity-heading" className="micro-label">
          Activity
        </h2>
        <ComposerSection detail={detail} />
        <div className="mt-8">
          <Timeline entries={detail.timeline} caseId={detail.id} />
        </div>
      </section>
    </article>
  )
}

function ComposerSection({ detail }: { detail: CaseDetail }) {
  // Impersonated sessions write too — the API attributes their entries to
  // the actor and renders them RevenuePoint-side. Sits inside the Activity
  // section (above the feed), so no divider of its own.
  return (
    <div className="mt-5">
      <CommentComposer caseId={detail.id} />
      {detail.statusGroup === 'open' ? <ResolveRow caseId={detail.id} /> : null}
    </div>
  )
}

/**
 * "Mark as resolved" ships inside the frozen contract: it posts a fixed,
 * parseable note through the normal comments endpoint. The team still closes
 * the case in Salesforce; agents and Nexus see the marker up front.
 */
const RESOLVED_COMMENT = '[Client marks resolved] Resolved on our side — please close this case.'

function ResolveRow({ caseId }: { caseId: string }) {
  const [confirming, setConfirming] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => api.addComment(caseId, RESOLVED_COMMENT),
    onSuccess: (result) => {
      queryClient.setQueryData<CaseDetail>(['case', caseId], (old) =>
        old
          ? { ...old, lastActivityAt: result.entry.at, timeline: [...old.timeline, result.entry] }
          : old,
      )
      setConfirming(false)
      toast('Noted — we’ll close it out.')
    },
    onError: () => toast.error('That didn’t send. Give it another try.'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
    },
  })

  return (
    <div className="mt-5 flex min-h-14 flex-wrap items-center justify-between gap-3 rounded-lg border border-rule/60 bg-paper/60 px-4 py-3">
      {confirming ? (
        <>
          <p className="text-sm text-inkMid">Post a note asking us to close this case?</p>
          <div className="flex gap-2">
            <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending ? 'Posting…' : 'Post the note'}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => setConfirming(false)}
            >
              Keep it open
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-inkMid">All set on your side?</p>
          <Button variant="neutral" size="sm" onClick={() => setConfirming(true)}>
            <CircleCheck aria-hidden="true" />
            Mark as resolved
          </Button>
        </>
      )}
    </div>
  )
}

function MetaDot() {
  return (
    <span aria-hidden="true" className="text-muteSoft">
      ·
    </span>
  )
}

function CaseDescription({ markdown }: { markdown: string }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown])
  return (
    <div
      className="rich-text mt-2.5 max-w-prose text-[0.9375rem] leading-relaxed text-inkSoft"
      // Rendered from Markdown and sanitized in renderMarkdown (DOMPurify).
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
