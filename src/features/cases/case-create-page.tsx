import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { Bug, CircleCheck, EyeOff, HelpCircle, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { CreateCaseResponse } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'
import { Button, buttonVariants } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldHint, MicroLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FileDropZone } from './file-drop-zone'
import { ParticipantPicker } from './participant-picker'

/**
 * Draft safety: text fields autosave to sessionStorage on change and restore
 * on return, so navigating away never loses a half-written case. Files are
 * never persisted (browsers can't re-hydrate File objects).
 */
const DRAFT_KEY = 'rp:workspace:case-draft'

const EMPTY_FORM: CreateCaseForm = {
  recordType: 'support',
  subject: '',
  description: '',
  impact: '',
  urgency: '',
  businessJustification: '',
  sensitive: false,
}

function readDraft(): CreateCaseForm | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CreateCaseForm>
    if (parsed.recordType !== 'support' && parsed.recordType !== 'problem' && parsed.recordType !== 'change') {
      return null
    }
    const str = (v: unknown): string => (typeof v === 'string' ? v : '')
    return {
      recordType: parsed.recordType,
      subject: str(parsed.subject),
      description: str(parsed.description),
      impact: str(parsed.impact),
      urgency: str(parsed.urgency),
      businessJustification: str(parsed.businessJustification),
      sensitive: parsed.sensitive === true,
    }
  } catch {
    return null
  }
}

function writeDraft(draft: Partial<CreateCaseForm>): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Storage unavailable — the form still works, it just won't survive navigation.
  }
}

function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // non-fatal
  }
}

function draftHasContent(draft: CreateCaseForm | null): boolean {
  if (!draft) return false
  return Boolean(
    draft.subject.trim() ||
      draft.description.trim() ||
      draft.impact ||
      draft.urgency ||
      draft.businessJustification?.trim(),
  )
}

const createCaseSchema = z.object({
  recordType: z.enum(['support', 'problem', 'change']),
  subject: z
    .string()
    .trim()
    .min(1, 'Give this case a subject — one line is plenty.')
    .max(255, 'Keep the subject under 255 characters; the details go below.'),
  description: z.string().trim().min(1, 'Tell us what’s going on — the more specific, the faster we can help.'),
  impact: z.string(),
  urgency: z.string(),
  businessJustification: z.string().optional(),
  sensitive: z.boolean(),
})

type CreateCaseForm = z.infer<typeof createCaseSchema>

const RECORD_TYPES = [
  {
    value: 'support',
    icon: HelpCircle,
    title: 'Support request',
    hint: 'A question, or a hand with something.',
  },
  {
    value: 'problem',
    icon: Bug,
    title: 'Something’s broken',
    hint: 'It worked before. Now it doesn’t.',
  },
  {
    value: 'change',
    icon: Sparkles,
    title: 'Change or new feature',
    hint: 'A tweak, an improvement, something new.',
  },
] as const

const IMPACT_OPTIONS = [
  'Extensive / Widespread',
  'Significant / Large',
  'Moderate / Limited',
  'Minor / Localized',
]

const URGENCY_OPTIONS = ['Critical', 'High', 'Medium', 'Low', 'Lowest']

export function CaseCreatePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const selfEmail = useSessionStore((s) => s.contact?.email ?? '')
  const accountName = useSessionStore((s) => s.contact?.accountName)
  const [files, setFiles] = useState<File[]>([])
  const [participantIds, setParticipantIds] = useState<string[]>([])
  // The response carries no sensitive flag, so the success screen gets it
  // from the submitted form values instead.
  const [created, setCreated] = useState<{ result: CreateCaseResponse; sensitive: boolean } | null>(
    null,
  )

  // Colleagues at the account (minus yourself — you're the submitter, always added).
  const contactsQuery = useQuery({
    queryKey: ['account-contacts'],
    queryFn: () => api.listAccountContacts(),
    staleTime: 5 * 60_000,
  })
  const colleagues = (contactsQuery.data?.contacts ?? []).filter(
    (c) => c.email.toLowerCase() !== selfEmail.toLowerCase(),
  )
  const chosenParticipants = colleagues.filter((c) => participantIds.includes(c.contactId))
  // Read once on mount; the note offers "start fresh" when content came back.
  const [restoredDraft] = useState(() => readDraft())
  const [showRestoredNote, setShowRestoredNote] = useState(() => draftHasContent(restoredDraft))
  const [confirmingLeave, setConfirmingLeave] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateCaseForm>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: restoredDraft ?? EMPTY_FORM,
  })

  const recordType = useWatch({ control, name: 'recordType' })
  const formValues = useWatch({ control })

  // Autosave: every change lands in sessionStorage, so nothing typed here is
  // ever lost to navigation. Cleared on successful create / "start fresh".
  useEffect(() => {
    writeDraft(formValues)
  }, [formValues])

  function startFresh() {
    clearDraft()
    reset(EMPTY_FORM)
    setFiles([])
    setShowRestoredNote(false)
  }

  const mutation = useMutation({
    mutationFn: (values: CreateCaseForm) =>
      api.createCase(
        {
          recordType: values.recordType,
          subject: values.subject,
          description: values.description,
          impact: values.impact || undefined,
          urgency: values.urgency || undefined,
          businessJustification:
            values.recordType === 'change' ? values.businessJustification?.trim() || undefined : undefined,
          participants: participantIds.length ? participantIds : undefined,
          sensitive: values.sensitive || undefined,
          files,
        },
        files.length > 0 ? setUploadProgress : undefined,
      ),
    onSettled: () => setUploadProgress(null),
    onSuccess: (result, values) => {
      clearDraft()
      setCreated({ result, sensitive: values.sensitive })
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
      window.scrollTo({ top: 0 })
    },
    onError: () => {
      toast.error('That didn’t go through. Your draft is still here — try again.')
    },
  })

  function handleCancel() {
    // Text fields live on in the draft; attached files can't. Only a leave
    // that would drop files needs a confirmation.
    if (files.length > 0) {
      setConfirmingLeave(true)
      return
    }
    navigate('/cases')
  }

  if (created) {
    return <CreateSuccess result={created.result} sensitive={created.sensitive} />
  }

  return (
    <div className="mx-auto max-w-2xl">
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
          New case
        </span>
      </nav>

      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.012em] text-ink">Create a case</h1>
      <p className="mt-1.5 text-sm text-mute">
        Tell us once, properly — it goes straight to the team, no triage inbox.
      </p>

      {showRestoredNote ? (
        <p
          role="status"
          className="mt-6 flex flex-wrap items-baseline gap-x-2 rounded-md border border-rule/60 bg-paper px-4 py-3 text-sm leading-relaxed text-inkMid"
        >
          Picked up where you left off — this draft was saved automatically.
          <button
            type="button"
            onClick={startFresh}
            className="rounded-sm font-semibold text-crimson underline-offset-4 hover:underline"
          >
            Start fresh
          </button>
        </p>
      ) : null}

      <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate className="mt-8 space-y-8">
        {/* Record type */}
        <Field>
          <MicroLabel>What kind of case is this?</MicroLabel>
          <Controller
            control={control}
            name="recordType"
            render={({ field }) => (
              <RadioGroup.Root
                value={field.value}
                onValueChange={field.onChange}
                aria-label="What kind of case is this?"
                className="grid gap-3 sm:grid-cols-3"
              >
                {RECORD_TYPES.map(({ value, icon: Icon, title, hint }) => (
                  <RadioGroup.Item
                    key={value}
                    value={value}
                    className={cn(
                      'rounded-lg border bg-card px-4 py-4 text-left transition-all duration-[180ms] ease-editorial hover:-translate-y-[2px] hover:shadow-lift',
                      'data-[state=checked]:border-crimson data-[state=checked]:bg-crimsonTint/40',
                      'data-[state=unchecked]:border-rule/80',
                    )}
                  >
                    <Icon aria-hidden="true" className="size-5 text-crimson" />
                    <span className="mt-2.5 block text-sm font-semibold text-ink">{title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-mute">{hint}</span>
                  </RadioGroup.Item>
                ))}
              </RadioGroup.Root>
            )}
          />
        </Field>

        {/* Subject */}
        <Field>
          <MicroLabel htmlFor="case-subject">Subject</MicroLabel>
          <Input
            id="case-subject"
            placeholder="One line — what’s this about?"
            aria-invalid={errors.subject ? true : undefined}
            aria-describedby={errors.subject ? 'case-subject-error' : undefined}
            {...register('subject')}
          />
          {errors.subject ? <FieldError id="case-subject-error">{errors.subject.message}</FieldError> : null}
        </Field>

        {/* Description — guided toward the structure triage rewrites tickets into. */}
        <Field>
          <MicroLabel htmlFor="case-description">Description</MicroLabel>
          <Textarea
            id="case-description"
            rows={8}
            placeholder={
              'What’s going on?\n\n' +
              'Context — where this happens and what you were doing.\n' +
              'The ask — what you need from us.\n' +
              'Done looks like — how we’ll both know it’s sorted.'
            }
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={
              errors.description ? 'case-description-error case-description-hint' : 'case-description-hint'
            }
            {...register('description')}
          />
          {errors.description ? (
            <FieldError id="case-description-error">{errors.description.message}</FieldError>
          ) : null}
          <FieldHint id="case-description-hint">
            The clearer the context and the ask, the faster this reaches the right person.
          </FieldHint>
        </Field>

        {/* Impact + urgency — every record type; triage sets them anyway, so a
            good first guess from the person who feels it saves a round trip. */}
        <div className="grid gap-6 rounded-lg border border-rule/60 bg-cream/60 p-5 sm:grid-cols-2">
          <Field>
            <MicroLabel htmlFor="case-impact">Impact</MicroLabel>
            <Select id="case-impact" aria-describedby="case-impact-hint" {...register('impact')}>
              <option value="">Not sure — skip it</option>
              {IMPACT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <FieldHint id="case-impact-hint">How widely is this felt? Optional — your best guess helps us triage.</FieldHint>
          </Field>
          <Field>
            <MicroLabel htmlFor="case-urgency">Urgency</MicroLabel>
            <Select id="case-urgency" aria-describedby="case-urgency-hint" {...register('urgency')}>
              <option value="">Not sure — skip it</option>
              {URGENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <FieldHint id="case-urgency-hint">How soon does this bite? Optional too.</FieldHint>
          </Field>
        </div>

        {/* Change-only: business justification */}
        {recordType === 'change' ? (
          <Field>
            <MicroLabel htmlFor="case-justification">Business justification</MicroLabel>
            <Textarea
              id="case-justification"
              rows={4}
              placeholder="What does this unlock for your team?"
              aria-describedby="case-justification-hint"
              {...register('businessJustification')}
            />
            <FieldHint id="case-justification-hint">
              Optional, but it helps us weigh the change against everything else in flight.
            </FieldHint>
          </Field>
        ) : null}

        {/* Participants — colleagues to keep in the loop (CC'd on replies) */}
        <Field>
          <MicroLabel>Keep colleagues in the loop</MicroLabel>
          <ParticipantPicker
            contacts={colleagues}
            participants={chosenParticipants}
            onAdd={(id) => setParticipantIds((ids) => [...new Set([...ids, id])])}
            onRemove={(id) => setParticipantIds((ids) => ids.filter((x) => x !== id))}
          />
          <FieldHint>
            They&rsquo;ll be copied on updates and can see the case in their own workspace. Optional.
          </FieldHint>
        </Field>

        {/* Visibility — a sensitive case stays between the circle above and RevenuePoint */}
        <Field>
          <MicroLabel>Visibility</MicroLabel>
          <label
            htmlFor="case-sensitive"
            className="flex cursor-pointer items-start gap-3 rounded-md border border-rule/60 bg-cream/60 px-4 py-3"
          >
            <Checkbox
              id="case-sensitive"
              aria-describedby="case-sensitive-hint"
              className="mt-0.5"
              {...register('sensitive')}
            />
            <span className="text-sm font-medium text-ink">Sensitive case</span>
          </label>
          <FieldHint id="case-sensitive-hint">
            Only you, the participants you add above, and RevenuePoint will see this case. Other
            colleagues at {accountName ?? 'your account'} won&rsquo;t.
          </FieldHint>
        </Field>

        {/* Files */}
        <Field>
          <MicroLabel>Attachments</MicroLabel>
          <FileDropZone files={files} onChange={setFiles} />
          {uploadProgress !== null ? (
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(uploadProgress * 100)}
              className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-rule/40"
            >
              <div className="h-full bg-crimson" style={{ width: `${Math.round(uploadProgress * 100)}%` }} />
            </div>
          ) : null}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule/50 pt-6">
          {confirmingLeave ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-inkMid">Attached files aren&rsquo;t saved with drafts.</p>
              <Button type="button" variant="neutral" size="sm" onClick={() => navigate('/cases')}>
                Leave anyway
              </Button>
              <Button type="button" variant="quiet" size="sm" onClick={() => setConfirmingLeave(false)}>
                Keep writing
              </Button>
            </div>
          ) : (
            <Button type="button" variant="quiet" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending…' : 'Send to RevenuePoint'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function CreateSuccess({ result, sensitive }: { result: CreateCaseResponse; sensitive: boolean }) {
  const failedFiles = result.files.filter((f) => !f.ok)

  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <CircleCheck aria-hidden="true" className="mx-auto size-8 text-navy" />
      <p className="micro-label mt-6">Case created</p>
      <h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight text-ink">
        #{result.caseNumber}
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
        It&rsquo;s with our team — new cases are triaged within one business day. We&rsquo;ll reply
        by email, and every update lands on the case page too.
      </p>

      {sensitive ? (
        <p className="mx-auto mt-4 flex max-w-sm items-start justify-center gap-2 text-sm leading-relaxed text-inkMid">
          <EyeOff aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-navy" />
          Marked sensitive — only you, the participants you added, and RevenuePoint can see this
          case.
        </p>
      ) : null}

      {failedFiles.length > 0 ? (
        <div className="mx-auto mt-6 max-w-sm rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <TriangleAlert aria-hidden="true" className="size-4 text-amber" />
            Some files didn&rsquo;t make it
          </p>
          <ul className="mt-2 space-y-1">
            {failedFiles.map((f) => (
              <li key={f.name} className="text-xs text-inkMid">
                {f.name}
                {f.error ? ` — ${f.error}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-mute">You can attach them again from the case page.</p>
        </div>
      ) : null}

      <div className="mt-8 flex justify-center gap-3">
        <Link to={`/cases/${result.id}`} className={buttonVariants({ size: 'md' })}>
          View case
        </Link>
        <Link to="/cases" className={buttonVariants({ variant: 'quiet', size: 'md' })}>
          Back to cases
        </Link>
      </div>
    </div>
  )
}
