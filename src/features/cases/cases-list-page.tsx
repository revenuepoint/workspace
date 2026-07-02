import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import type { CaseListFilter, CaseSummary } from '@/lib/api-types'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { StatusChip } from '@/components/ui/status-chip'

type SortKey = 'caseNumber' | 'subject' | 'status' | 'recordType' | 'lastActivity'
type SortDir = 'asc' | 'desc'

const SORT_ACCESSORS: Record<SortKey, (c: CaseSummary) => string> = {
  caseNumber: (c) => c.caseNumber,
  subject: (c) => c.subject.toLowerCase(),
  status: (c) => c.statusLabel.toLowerCase(),
  recordType: (c) => c.recordTypeLabel.toLowerCase(),
  lastActivity: (c) => c.lastActivityAt,
}

const FILTERS: CaseListFilter[] = ['open', 'closed', 'all']

function parseFilter(raw: string | null): CaseListFilter {
  return raw === 'closed' || raw === 'all' ? raw : 'open'
}

export function CasesListPage() {
  const contact = useSessionStore((s) => s.contact)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseFilter(searchParams.get('status'))
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'lastActivity', dir: 'desc' })

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['cases', filter],
    queryFn: () => api.listCases(filter),
    staleTime: 15_000,
  })

  const sorted = useMemo(() => {
    if (!data) return []
    const accessor = SORT_ACCESSORS[sort.key]
    const factor = sort.dir === 'asc' ? 1 : -1
    return [...data.cases].sort((a, b) => accessor(a).localeCompare(accessor(b)) * factor)
  }, [data, sort])

  function setFilter(next: CaseListFilter) {
    setSearchParams(next === 'open' ? {} : { status: next }, { replace: true })
  }

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'lastActivity' ? 'desc' : 'asc' },
    )
  }

  const counts = data?.counts
  const filterLabel = (f: CaseListFilter): string => {
    if (!counts) return f === 'open' ? 'Open' : f === 'closed' ? 'Closed' : 'All'
    if (f === 'open') return `Open (${counts.open})`
    if (f === 'closed') return `Closed (${counts.closed})`
    return `All (${counts.open + counts.closed})`
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.012em] text-ink">
            {contact?.accountName ?? 'Your account'} · Cases
          </h1>
          <p className="mt-1.5 text-sm text-mute">Everything you&rsquo;ve sent us, and where it stands.</p>
        </div>
        {contact?.impersonated ? null : (
          <Button asChild>
            <Link to="/cases/new">
              <Plus aria-hidden="true" />
              Create a case
            </Link>
          </Button>
        )}
      </div>

      {/* Filter pills */}
      <div role="group" aria-label="Filter cases" className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.08em] transition-colors duration-[180ms] ease-editorial',
                active
                  ? 'border-crimson bg-crimsonTint/60 text-crimsonDeep'
                  : 'border-rule/80 bg-transparent text-inkMid hover:border-mute hover:bg-paper',
              )}
            >
              {f === 'open' ? (
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', active ? 'bg-crimson' : 'bg-navySoft')}
                />
              ) : null}
              {filterLabel(f)}
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        {isPending ? (
          <div className="flex justify-center border-t border-rule/50 py-20">
            <Spinner label="Loading your cases…" />
          </div>
        ) : isError ? (
          <div className="border-t border-rule/50 py-20 text-center">
            <p className="text-sm text-inkMid">We couldn&rsquo;t load your cases.</p>
            <Button variant="neutral" size="sm" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState filter={filter} counts={counts ?? { open: 0, closed: 0 }} />
        ) : (
          <CasesTable cases={sorted} sort={sort} onSort={toggleSort} onOpen={(id) => navigate(`/cases/${id}`)} />
        )}
      </div>
    </div>
  )
}

function EmptyState({ filter, counts }: { filter: CaseListFilter; counts: { open: number; closed: number } }) {
  const nothingAtAll = counts.open + counts.closed === 0
  const impersonated = useSessionStore((s) => s.contact?.impersonated === true)

  return (
    <div className="border-t border-rule/50 py-20 text-center">
      {nothingAtAll ? (
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
          Nothing here yet. When your team creates a case, it&rsquo;ll show up here.
        </p>
      ) : filter === 'open' && !impersonated ? (
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
          No open cases. Need to start one?{' '}
          <Link
            to="/cases/new"
            className="rounded-sm font-semibold text-crimson underline-offset-4 hover:underline"
          >
            Create a case
          </Link>
          .
        </p>
      ) : filter === 'open' ? (
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
          No open cases.
        </p>
      ) : (
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
          No closed cases yet — everything&rsquo;s still in motion.
        </p>
      )}
    </div>
  )
}

const COLUMNS: Array<{ key: SortKey; label: string; className?: string }> = [
  { key: 'caseNumber', label: 'Case #' },
  { key: 'subject', label: 'Subject', className: 'w-full' },
  { key: 'status', label: 'Status' },
  { key: 'recordType', label: 'Type' },
  { key: 'lastActivity', label: 'Last activity' },
]

function CasesTable({
  cases,
  sort,
  onSort,
  onOpen,
}: {
  cases: CaseSummary[]
  sort: { key: SortKey; dir: SortDir }
  onSort: (key: SortKey) => void
  onOpen: (id: string) => void
}) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-rule/70">
          {COLUMNS.map((col) => {
            const active = sort.key === col.key
            return (
              <th
                key={col.key}
                scope="col"
                aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                className={cn('px-3 py-2.5 first:pl-2 last:pr-2', col.className)}
              >
                <button
                  type="button"
                  onClick={() => onSort(col.key)}
                  className="micro-label inline-flex items-center gap-1 rounded-sm transition-colors duration-[180ms] ease-editorial hover:text-ink"
                >
                  {col.label}
                  {active ? (
                    sort.dir === 'asc' ? (
                      <ArrowUp aria-hidden="true" className="size-3" />
                    ) : (
                      <ArrowDown aria-hidden="true" className="size-3" />
                    )
                  ) : null}
                </button>
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr
            key={c.id}
            onClick={() => onOpen(c.id)}
            className={cn(
              'cursor-pointer border-b border-rule/40 transition-colors duration-[180ms] ease-editorial hover:bg-cream',
              // Waiting-on-you: amber left-edge accent
              c.waitingOnYou && 'border-l-2 border-l-amber',
            )}
          >
            <td className="whitespace-nowrap px-3 py-3.5 font-mono text-[0.8125rem] text-inkMid first:pl-2">
              {c.caseNumber}
            </td>
            <td className="px-3 py-3.5">
              <Link
                to={`/cases/${c.id}`}
                onClick={(event) => event.stopPropagation()}
                className="rounded-sm text-[0.9375rem] font-medium text-ink underline-offset-4 hover:text-crimson hover:underline"
              >
                {c.subject}
              </Link>
            </td>
            <td className="whitespace-nowrap px-3 py-3.5">
              <StatusChip status={c.status} />
            </td>
            <td className="whitespace-nowrap px-3 py-3.5 text-sm text-inkMid">{c.recordTypeLabel}</td>
            <td className="whitespace-nowrap px-3 py-3.5 font-mono text-[0.8125rem] text-mute last:pr-2">
              {relativeTime(c.lastActivityAt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
