import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Download, Paperclip, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError, saveCaseFile } from '@/lib/api'
import type { CaseDetail, FileMeta } from '@/lib/api-types'
import { formatBytes, formatDate, relativeTime } from '@/lib/format'
import { useSessionStore } from '@/stores/session'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { StatusChip } from '@/components/ui/status-chip'
import { CommentComposer } from './comment-composer'
import { Timeline } from './timeline'

export function CaseDetailPage() {
  const { id = '' } = useParams()

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['case', id],
    queryFn: () => api.getCase(id),
    staleTime: 15_000,
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
        {detail.submittedBy ? (
          <>
            <MetaDot />
            <span>Submitted by {detail.submittedBy.name}</span>
          </>
        ) : null}
      </div>

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

      {/* Description */}
      <section aria-labelledby="case-description-heading" className="mt-8">
        <h2 id="case-description-heading" className="micro-label">
          Description
        </h2>
        <p className="mt-2.5 max-w-prose whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-inkSoft">
          {detail.description}
        </p>
      </section>

      {/* Files */}
      {detail.files.length > 0 ? (
        <section aria-labelledby="case-files-heading" className="mt-8">
          <h2 id="case-files-heading" className="micro-label">
            Files
          </h2>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {detail.files.map((file) => (
              <li key={file.contentDocumentId}>
                <FileChip caseId={detail.id} file={file} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Timeline */}
      <section aria-labelledby="case-activity-heading" className="mt-10 border-t border-rule/50 pt-8">
        <h2 id="case-activity-heading" className="micro-label">
          Activity
        </h2>
        <div className="mt-5">
          <Timeline entries={detail.timeline} />
        </div>
      </section>

      <ComposerSection caseId={detail.id} />
    </article>
  )
}

function ComposerSection({ caseId }: { caseId: string }) {
  // Impersonation sessions are read-only server-side; don't render an
  // affordance that can only fail.
  const impersonated = useSessionStore((s) => s.contact?.impersonated === true)
  if (impersonated) return null
  return (
    <section className="mt-8 border-t border-rule/50 pt-6">
      <CommentComposer caseId={caseId} />
    </section>
  )
}

function MetaDot() {
  return (
    <span aria-hidden="true" className="text-muteSoft">
      ·
    </span>
  )
}

function FileChip({ caseId, file }: { caseId: string; file: FileMeta }) {
  const [downloading, setDownloading] = useState(false)

  async function download() {
    setDownloading(true)
    try {
      await saveCaseFile(caseId, file.contentDocumentId, file.title)
    } catch {
      toast.error(`${file.title} didn’t download. Give it another try.`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={downloading}
      title={`Download ${file.title}`}
      className="group inline-flex items-center gap-2 rounded-md border border-rule/80 bg-white px-3 py-2 text-sm text-inkSoft transition-all duration-[180ms] ease-editorial hover:-translate-y-[2px] hover:border-mute hover:shadow-lift disabled:opacity-60"
    >
      <Paperclip aria-hidden="true" className="size-4 shrink-0 text-mute" />
      <span className="max-w-56 truncate font-medium">{file.title}</span>
      <span className="font-mono text-xs text-mute">{formatBytes(file.sizeBytes)}</span>
      <Download
        aria-hidden="true"
        className="size-4 shrink-0 text-muteSoft transition-colors duration-[180ms] ease-editorial group-hover:text-crimson"
      />
      <span className="sr-only">Download {file.title}</span>
    </button>
  )
}
