import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { Bug, CircleCheck, HelpCircle, Sparkles, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { CreateCaseResponse } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { useSessionStore } from '@/stores/session'
import { Button, buttonVariants } from '@/components/ui/button'
import { Field, FieldError, FieldHint, MicroLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FileDropZone } from './file-drop-zone'

const createCaseSchema = z.object({
  recordType: z.enum(['support', 'problem', 'change']),
  subject: z
    .string()
    .trim()
    .min(1, 'Give this case a subject — one line is plenty.')
    .max(255, 'Keep the subject under 255 characters; the details go below.'),
  description: z.string().trim().min(1, 'Tell us what’s going on — the more specific, the faster we can help.'),
  impact: z.string().optional(),
  urgency: z.string().optional(),
  businessJustification: z.string().optional(),
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
  const impersonated = useSessionStore((s) => s.contact?.impersonated === true)
  const [files, setFiles] = useState<File[]>([])
  const [created, setCreated] = useState<CreateCaseResponse | null>(null)

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCaseForm>({
    resolver: zodResolver(createCaseSchema),
    defaultValues: { recordType: 'support', subject: '', description: '' },
  })

  const recordType = useWatch({ control, name: 'recordType' })

  const mutation = useMutation({
    mutationFn: (values: CreateCaseForm) =>
      api.createCase({
        recordType: values.recordType,
        subject: values.subject,
        description: values.description,
        impact: values.recordType === 'problem' ? values.impact : undefined,
        urgency: values.recordType === 'problem' ? values.urgency : undefined,
        businessJustification:
          values.recordType === 'change' ? values.businessJustification?.trim() || undefined : undefined,
        files,
      }),
    onSuccess: (result) => {
      setCreated(result)
      void queryClient.invalidateQueries({ queryKey: ['cases'] })
      window.scrollTo({ top: 0 })
    },
    onError: () => {
      toast.error('That didn’t go through. Your draft is still here — try again.')
    },
  })

  // Impersonation sessions are read-only server-side; don't render a form
  // that can only 403 (page-level twin of the detail page's ComposerSection).
  if (impersonated) {
    return <Navigate to="/cases" replace />
  }

  if (created) {
    return <CreateSuccess result={created} />
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

        {/* Description */}
        <Field>
          <MicroLabel htmlFor="case-description">Description</MicroLabel>
          <Textarea
            id="case-description"
            rows={6}
            placeholder="What happened, what you expected, and anything you’ve already tried."
            aria-invalid={errors.description ? true : undefined}
            aria-describedby={errors.description ? 'case-description-error' : undefined}
            {...register('description')}
          />
          {errors.description ? (
            <FieldError id="case-description-error">{errors.description.message}</FieldError>
          ) : null}
        </Field>

        {/* Problem-only: impact + urgency */}
        {recordType === 'problem' ? (
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
        ) : null}

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

        {/* Files */}
        <Field>
          <MicroLabel>Attachments</MicroLabel>
          <FileDropZone files={files} onChange={setFiles} />
        </Field>

        <div className="flex items-center justify-between border-t border-rule/50 pt-6">
          <Button type="button" variant="quiet" onClick={() => navigate('/cases')}>
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending…' : 'Send to RevenuePoint'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function CreateSuccess({ result }: { result: CreateCaseResponse }) {
  const failedFiles = result.files.filter((f) => !f.ok)

  return (
    <div className="mx-auto max-w-2xl py-10 text-center">
      <CircleCheck aria-hidden="true" className="mx-auto size-8 text-navy" />
      <p className="micro-label mt-6">Case created</p>
      <h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight text-ink">
        #{result.caseNumber}
      </h1>
      <p className="mx-auto mt-4 max-w-sm text-[0.9375rem] leading-relaxed text-inkMid">
        It&rsquo;s with our team. We&rsquo;ll reply by email, and every update lands on the case page too.
      </p>

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
