import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api'
import type { CaseListFilter, CaseSummary } from '@/lib/api-types'
import { relativeTime } from '@/lib/format'
import { useMediaQuery } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { StatusChip } from '@/components/ui/status-chip'

type SortKey = 'caseNumber' | 'subject' | 'contact' | 'status' | 'recordType' | 'lastActivity'
type SortDir = 'asc' | 'desc'

const SORT_ACCESSORS: Record<SortKey, (c: CaseSummary) => string> = {
  caseNumber: (c) => c.caseNumber,
  subject: (c) => c.subject.toLowerCase(),
  contact: (c) => (c.submittedBy?.name ?? '').toLowerCase(),
  status: (c) => c.statusLabel.toLowerCase(),
  recordType: (c) => c.recordTypeLabel.toLowerCase(),
  lastActivity: (c) => c.lastActivityAt,
}

const FILTERS: CaseListFilter[] = ['open', 'closed', 'all']

/** Whose cases: the signed-in contact's own ("mine", default) or everyone's. */
type Scope = 'mine' | 'all'

function parseFilter(raw: string | null): CaseListFilter {
  return raw === 'closed' || raw === 'all' ? raw : 'open'
}

function parseScope(raw: string | null): Scope {
  return raw === 'all' ? 'all' : 'mine'
}

export function CasesListPage() {
  const contact = useSessionStore((s) => s.contact)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseFilter(searchParams.get('status'))
  const scope = parseScope(searchParams.get('scope'))
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'lastActivity', dir: 'desc' })

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['cases', filter],
    queryFn: ({ signal }) => api.listCases(filter, { signal }),
    staleTime: 15_000,
  })

  const sorted = useMemo(() => {
    if (!data) return []
    const accessor = SORT_ACCESSORS[sort.key]
    const factor = sort.dir === 'asc' ? 1 : -1
    const inScope = scope === 'mine' ? data.cases.filter((c) => c.mine) : data.cases
    return [...inScope].sort((a, b) => {
      // Your-move cases surface first, whatever the sort.
      if (a.waitingOnYou !== b.waitingOnYou) return a.waitingOnYou ? -1 : 1
      return accessor(a).localeCompare(accessor(b)) * factor
    })
  }, [data, sort, scope])

  const waitingCount = useMemo(() => sorted.filter((c) => c.waitingOnYou).length, [sorted])

  // Below md the 5-column table can't breathe — swap to stacked cards.
  const narrow = useMediaQuery('(max-width: 767px)')

  function setFilter(next: CaseListFilter) {
    const params = new URLSearchParams(searchParams)
    if (next === 'open') params.delete('status')
    else params.set('status', next)
    setSearchParams(params, { replace: true })
  }

  function setScope(next: Scope) {
    const params = new URLSearchParams(searchParams)
    if (next === 'mine') params.delete('scope')
    else params.set('scope', next)
    setSearchParams(params, { replace: true })
  }

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'lastActivity' ? 'desc' : 'asc' },
    )
  }

  // Pill counts follow the scope: "My cases" uses mineCounts, "All" uses the
  // account-wide counts (falls back to counts if the API predates mineCounts).
  const counts = scope === 'mine' ? (data?.mineCounts ?? data?.counts) : data?.counts
  const filterLabel = (f: CaseListFilter): string => {
    if (!counts) return f === 'open' ? 'Open' : f === 'closed' ? 'Closed' : 'All'
    if (f === 'open') return `Open (${counts.open})`
    if (f === 'closed') return `Closed (${counts.closed})`
    return `All (${counts.open + counts.closed})`
  }
  const mineTotal = data?.mineCounts ? data.mineCounts.open + data.mineCounts.closed : undefined
  const allTotal = data?.counts ? data.counts.open + data.counts.closed : undefined

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.012em] text-ink">
            {contact?.accountName ?? 'Your account'} · Cases
          </h1>
          <p className="mt-1.5 text-sm text-mute">Everything you&rsquo;ve sent us, and where it stands.</p>
        </div>
        <Button asChild>
          <Link to="/cases/new">
            <Plus aria-hidden="true" />
            Create a case
          </Link>
        </Button>
      </div>

      {/* Scope — the signed-in person's own cases (default) vs the whole account */}
      <div
        role="group"
        aria-label="Whose cases"
        className="mt-8 inline-flex rounded-lg border border-rule/80 bg-paper p-0.5"
      >
        {(
          [
            ['mine', 'My cases', mineTotal],
            ['all', 'All cases', allTotal],
          ] as const
        ).map(([value, label, total]) => {
          const active = scope === value
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => setScope(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-1.5 text-sm font-semibold transition-colors duration-[180ms] ease-editorial',
                active ? 'bg-card text-ink shadow-editorial' : 'text-mute hover:text-inkMid',
              )}
            >
              {label}
              {total !== undefined ? (
                // Mono numerals ride high against the Geist label at this size — nudge down 1px.
                <span className="relative top-px font-mono text-[0.6875rem] text-mute">{total}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Status filter pills */}
      <div role="group" aria-label="Filter cases" className="mt-4 flex flex-wrap gap-2">
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

      {waitingCount > 0 ? (
        <div
          role="status"
          className="mt-6 flex items-center gap-3 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-amber" />
          <p className="text-sm leading-relaxed text-inkMid">
            <span className="font-semibold text-ink">
              {waitingCount === 1 ? '1 case is' : `${waitingCount} cases are`} waiting on you.
            </span>{' '}
            Reply when you&rsquo;re ready — they&rsquo;re pinned to the top.
          </p>
        </div>
      ) : null}

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
          <EmptyState
            filter={filter}
            scope={scope}
            counts={counts ?? { open: 0, closed: 0 }}
            accountHasCases={(allTotal ?? 0) > 0}
            onSeeAll={() => setScope('all')}
          />
        ) : narrow ? (
          <CasesCards cases={sorted} scope={scope} />
        ) : (
          <CasesTable
            cases={sorted}
            scope={scope}
            sort={sort}
            onSort={toggleSort}
            onOpen={(id) => navigate(`/cases/${id}`)}
          />
        )}
      </div>
    </div>
  )
}

function EmptyState({
  filter,
  scope,
  counts,
  accountHasCases,
  onSeeAll,
}: {
  filter: CaseListFilter
  scope: Scope
  counts: { open: number; closed: number }
  accountHasCases: boolean
  onSeeAll: () => void
}) {
  const nothingInScope = counts.open + counts.closed === 0

  // "My cases" is empty but the account has cases elsewhere → point them to All.
  if (scope === 'mine' && nothingInScope && accountHasCases) {
    return (
      <div className="border-t border-rule/50 py-20 text-center">
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
          You don&rsquo;t have any cases yet.{' '}
          <button
            type="button"
            onClick={onSeeAll}
            className="rounded-sm font-semibold text-crimson underline-offset-4 hover:underline"
          >
            See all cases at your account
          </button>
          , or{' '}
          <Link
            to="/cases/new"
            className="rounded-sm font-semibold text-crimson underline-offset-4 hover:underline"
          >
            create one
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-rule/50 py-20 text-center">
      {nothingInScope ? (
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
          Nothing here yet. When your team creates a case, it&rsquo;ll show up here.
        </p>
      ) : filter === 'open' ? (
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
      ) : (
        <p className="mx-auto max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
          No closed cases yet — everything&rsquo;s still in motion.
        </p>
      )}
    </div>
  )
}

/** Narrow-screen layout: one tappable card per case, newest first. */
function CasesCards({ cases, scope }: { cases: CaseSummary[]; scope: Scope }) {
  return (
    <ul className="space-y-3 border-t border-rule/50 pt-4">
      {cases.map((c) => (
        <li key={c.id}>
          <Link
            to={`/cases/${c.id}`}
            className={cn(
              'block rounded-lg border border-rule/60 bg-card px-4 py-3.5 no-underline transition-all duration-[180ms] ease-editorial hover:-translate-y-[2px] hover:border-mute hover:shadow-lift',
              c.waitingOnYou && 'border-l-2 border-l-amber',
            )}
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[0.8125rem] text-inkMid">{c.caseNumber}</span>
              <span className="font-mono text-[0.8125rem] text-mute">{relativeTime(c.lastActivityAt)}</span>
            </span>
            <span className="mt-1.5 block text-[0.9375rem] font-medium leading-snug text-ink">
              {c.subject}
            </span>
            <span className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusChip status={c.status} />
              <span className="text-xs text-mute">{c.recordTypeLabel}</span>
              {scope === 'all' && c.submittedBy ? (
                <span className="text-xs text-mute">· {c.submittedBy.name}</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

type Column = { key: SortKey; label: string; className?: string }

const BASE_COLUMNS: Column[] = [
  { key: 'caseNumber', label: 'Case #' },
  { key: 'subject', label: 'Subject', className: 'w-full' },
  { key: 'status', label: 'Status' },
  { key: 'recordType', label: 'Type' },
  { key: 'lastActivity', label: 'Last activity' },
]

// On "All cases" show who each case belongs to; under "My cases" that's always
// the signed-in person, so the column would just be dead weight.
function columnsFor(scope: Scope): Column[] {
  if (scope !== 'all') return BASE_COLUMNS
  const [caseNumber, subject, ...rest] = BASE_COLUMNS
  return [caseNumber, subject, { key: 'contact', label: 'Contact' }, ...rest]
}

function CasesTable({
  cases,
  scope,
  sort,
  onSort,
  onOpen,
}: {
  cases: CaseSummary[]
  scope: Scope
  sort: { key: SortKey; dir: SortDir }
  onSort: (key: SortKey) => void
  onOpen: (id: string) => void
}) {
  const showContact = scope === 'all'
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-rule/70">
          {columnsFor(scope).map((col) => {
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
            {showContact ? (
              <td className="whitespace-nowrap px-3 py-3.5 text-sm text-inkMid">
                {c.submittedBy?.name ?? '—'}
              </td>
            ) : null}
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
