import { X } from 'lucide-react'
import type { CaseParticipant } from '@/lib/api-types'
import { Select } from '@/components/ui/select'

/**
 * Add/see case participants (CC'd colleagues). Presentational + controlled:
 * the parent owns the participant list (local state on create, server state on
 * a case record) and supplies the pool of addable account contacts. Chips reuse
 * the FileDropZone pill idiom; the "you" chip (matched by email) can't be
 * removed — you can't take yourself off your own case here.
 */
export function ParticipantPicker({
  contacts,
  participants,
  onAdd,
  onRemove,
  lockedEmail,
  busy = false,
}: {
  contacts: CaseParticipant[]
  participants: CaseParticipant[]
  onAdd: (contactId: string) => void
  onRemove: (contactId: string) => void
  lockedEmail?: string
  busy?: boolean
}) {
  const chosen = new Set(participants.map((p) => p.contactId))
  const addable = contacts.filter((c) => !chosen.has(c.contactId))

  return (
    <div className="space-y-2.5">
      {participants.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {participants.map((p) => {
            const isYou = lockedEmail !== undefined && p.email.toLowerCase() === lockedEmail.toLowerCase()
            return (
              <li
                key={p.contactId}
                className="inline-flex items-center gap-2 rounded-md border border-rule/80 bg-card px-3 py-1.5 text-sm text-inkSoft"
                title={p.email}
              >
                <span className="max-w-48 truncate font-medium">{p.name || p.email}</span>
                {isYou ? (
                  <span className="micro-label">you</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRemove(p.contactId)}
                    disabled={busy}
                    aria-label={`Remove ${p.name || p.email}`}
                    className="rounded-sm p-0.5 text-mute transition-colors duration-[180ms] ease-editorial hover:text-rust disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {addable.length > 0 ? (
        <div className="relative">
          <Select
            aria-label="Add a colleague"
            value=""
            disabled={busy}
            onChange={(event) => {
              const id = event.target.value
              if (id) onAdd(id)
            }}
          >
            <option value="">Add a colleague…</option>
            {addable.map((c) => (
              <option key={c.contactId} value={c.contactId}>
                {c.name || c.email} — {c.email}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-xs text-mute">
          {contacts.length === 0
            ? 'No other colleagues at your account to add.'
            : 'Everyone at your account is already on this case.'}
        </p>
      )}
    </div>
  )
}
