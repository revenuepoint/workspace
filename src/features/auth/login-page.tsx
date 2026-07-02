import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MailCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldError, MicroLabel } from '@/components/ui/field'
import { Wordmark } from '@/components/wordmark'

const loginSchema = z.object({
  email: z.email('Enter your work email — the one your RevenuePoint invites go to.'),
})

type LoginForm = z.infer<typeof loginSchema>

/**
 * /login — magic-link start. POST auth/start always succeeds (no account
 * enumeration), so the confirmation panel is unconditional; "Send another
 * link" re-triggers quietly and shows the same confirmation either way.
 */
export function LoginPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function sendLink({ email }: LoginForm) {
    try {
      await api.authStart(email)
    } catch {
      // Contract: always 200. If the network itself hiccups, still show the
      // confirmation — resending is cheap and we never leak account state.
    }
    setSentTo(email)
  }

  async function resend() {
    setResending(true)
    try {
      await api.authStart(sentTo ?? getValues('email'))
    } catch {
      // Rate-limit tolerant: same confirmation no matter what.
    } finally {
      setResending(false)
      toast('Another link is on its way.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-snow">
      <header className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
        <Wordmark />
        <span className="micro-label ml-2.5">Workspace</span>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-24 pt-[14vh]">
        <div className="w-full max-w-md">
          {sentTo === null ? (
            <>
              {/* Fraunces is reserved for the wordmark and this hero headline. */}
              <h1 className="font-serif text-[2rem] font-semibold leading-tight tracking-[-0.018em] text-ink">
                Sign in to your workspace
              </h1>
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-inkMid">
                We&rsquo;ll email you a link to sign in. No password needed.
              </p>

              <form onSubmit={handleSubmit(sendLink)} noValidate className="mt-8 space-y-5">
                <Field>
                  <MicroLabel htmlFor="login-email">Email</MicroLabel>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@company.com"
                    aria-invalid={errors.email ? true : undefined}
                    aria-describedby={errors.email ? 'login-email-error' : undefined}
                    {...register('email')}
                  />
                  {errors.email ? (
                    <FieldError id="login-email-error">{errors.email.message}</FieldError>
                  ) : null}
                </Field>
                <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Sending…' : 'Send link'}
                </Button>
              </form>
            </>
          ) : (
            <div
              role="status"
              className="rounded-lg border border-rule/70 bg-cream p-8 shadow-editorial"
            >
              <MailCheck aria-hidden="true" className="size-6 text-navy" />
              <h1 className="mt-4 text-xl font-semibold tracking-[-0.012em] text-ink">
                Check your inbox at <span className="whitespace-nowrap">{sentTo}</span>.
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-inkMid">The link expires in 15 minutes.</p>
              <div className="mt-6 border-t border-rule/50 pt-5">
                <p className="text-sm text-mute">
                  Didn&rsquo;t get it?{' '}
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resending}
                    className="rounded-sm font-semibold text-crimson underline-offset-4 transition-colors duration-[180ms] ease-editorial hover:underline disabled:opacity-50"
                  >
                    Send another link
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
