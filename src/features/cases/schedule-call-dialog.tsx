import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, X } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import type { CaseBooking } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

/**
 * Book / reschedule a Case Escalation Call. Slots come back as absolute UTC
 * instants; we render them in the VIEWER's local zone (detected, with an
 * override) and group by the viewer's local day — an Eastern 9:00 slot is a
 * 6:00 slot for a Pacific client, so day buckets follow the viewer, not the
 * host. Native <dialog> (focus trap + Escape built in), mirroring file-preview.
 */
const COMMON_ZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

function detectZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York'
  } catch {
    return 'America/New_York'
  }
}

export function ScheduleCallDialog({
  caseId,
  booking,
  onClose,
}: {
  caseId: string
  /** Present → reschedule an existing call; absent → book a new one. */
  booking?: CaseBooking | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const isReschedule = Boolean(booking)
  const [zone, setZone] = useState(detectZone)
  const [selected, setSelected] = useState('')
  const [booked, setBooked] = useState<CaseBooking | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    const onNativeClose = () => onClose()
    dialog?.addEventListener('close', onNativeClose)
    return () => dialog?.removeEventListener('close', onNativeClose)
  }, [onClose])

  const availQuery = useQuery({
    queryKey: ['case-availability', caseId],
    queryFn: ({ signal }) => api.getCaseAvailability(caseId, { signal }),
    staleTime: 30_000,
  })

  const zoneOptions = useMemo(() => [...new Set([zone, ...COMMON_ZONES])], [zone])

  const tzShort = useMemo(() => {
    try {
      return (
        new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
          .formatToParts(new Date())
          .find((p) => p.type === 'timeZoneName')?.value ?? zone
      )
    } catch {
      return zone
    }
  }, [zone])

  const grouped = useMemo(() => {
    const slots = availQuery.data?.slots ?? []
    const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: zone })
    const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })
    const map = new Map<string, { label: string; slots: { startUtc: string; time: string }[] }>()
    for (const s of slots) {
      const d = new Date(s.startUtc)
      const key = dayFmt.format(d)
      if (!map.has(key)) map.set(key, { label: key, slots: [] })
      map.get(key)!.slots.push({ startUtc: s.startUtc, time: timeFmt.format(d) })
    }
    return [...map.values()]
  }, [availQuery.data, zone])

  const mutation = useMutation({
    mutationFn: (startUtc: string) =>
      isReschedule ? api.rescheduleBooking(caseId, booking!.ref, startUtc) : api.bookCall(caseId, startUtc),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['case-booking', caseId] })
      if (isReschedule) {
        toast.success('Your call was rescheduled.')
        dialogRef.current?.close()
      } else {
        setBooked(result)
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'slot_taken') {
        toast.error('That time was just taken — pick another.')
        setSelected('')
        void availQuery.refetch()
      } else {
        toast.error('We couldn’t book that call. Give it another try.')
      }
    },
  })

  const formatFull = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short', timeZone: zone }).format(new Date(iso))

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      aria-label={isReschedule ? 'Reschedule your call' : 'Schedule a call'}
      className="fixed left-1/2 top-1/2 max-h-[85vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-rule/70 bg-card p-0 text-ink shadow-lift backdrop:bg-ink/40"
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close()
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-rule/60 px-5 py-3.5">
        <h2 className="text-[0.9375rem] font-semibold text-ink">
          {booked ? 'Your call is booked' : isReschedule ? 'Reschedule your call' : 'Schedule a call'}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
          className="rounded-md p-1.5 text-mute transition-colors duration-[180ms] ease-editorial hover:text-crimson"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="max-h-[calc(85vh-3.5rem)] overflow-auto px-5 py-4">
        {booked ? (
          <div className="py-4 text-center">
            <p className="text-[0.9375rem] text-ink">{formatFull(booked.startUtc)}</p>
            <p className="mt-1 font-mono text-xs text-mute">Times shown in {tzShort}</p>
            {booked.joinUrl ? (
              <a
                href={booked.joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-crimson px-3.5 py-2 text-sm font-semibold text-crimson no-underline transition-colors duration-[180ms] ease-editorial hover:bg-crimsonTint/50"
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Join link
              </a>
            ) : null}
            <p className="mt-4 text-sm text-mute">A calendar invite is on its way to your inbox.</p>
            <div className="mt-5">
              <Button variant="neutral" size="sm" onClick={() => dialogRef.current?.close()}>
                Done
              </Button>
            </div>
          </div>
        ) : availQuery.isPending ? (
          <div className="flex justify-center py-12">
            <Spinner label="Loading open times…" />
          </div>
        ) : availQuery.isError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-inkMid">We couldn’t load open times.</p>
            <Button variant="neutral" size="sm" className="mt-4" onClick={() => availQuery.refetch()}>
              Try again
            </Button>
          </div>
        ) : grouped.length === 0 ? (
          <p className="py-10 text-center text-sm text-inkMid">No open times in the next two weeks.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-mute">Pick a time that works for you.</p>
              <label className="flex items-center gap-1.5">
                <span className="micro-label">Zone</span>
                <select
                  value={zone}
                  onChange={(e) => {
                    setZone(e.target.value)
                    setSelected('')
                  }}
                  className="rounded-md border border-rule/80 bg-paper px-2 py-1 font-mono text-[0.6875rem] text-inkMid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-crimson focus-visible:ring-offset-2"
                >
                  {zoneOptions.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="mt-1 font-mono text-[0.6875rem] text-mute">Times shown in {tzShort}</p>

            <div className="mt-4 space-y-4">
              {grouped.map((day) => (
                <div key={day.label}>
                  <h3 className="micro-label">{day.label}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {day.slots.map((slot) => (
                      <button
                        key={slot.startUtc}
                        type="button"
                        aria-pressed={selected === slot.startUtc}
                        onClick={() => setSelected(slot.startUtc)}
                        className={cn(
                          'rounded-md border px-3 py-1.5 font-mono text-[0.8125rem] tabular-nums transition-colors duration-[180ms] ease-editorial',
                          selected === slot.startUtc
                            ? 'border-crimson bg-crimsonTint/60 text-crimsonDeep'
                            : 'border-rule/80 text-inkMid hover:border-mute hover:bg-paper',
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-rule/50 pt-4">
              <Button variant="quiet" size="sm" onClick={() => dialogRef.current?.close()}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selected || mutation.isPending}
                onClick={() => selected && mutation.mutate(selected)}
              >
                {isReschedule ? 'Reschedule call' : 'Book call'}
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}
