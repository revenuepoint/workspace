import type { ReactNode } from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

/** JetBrains Mono micro-label above form inputs (uppercase, 0.16em tracking, mute). */
export function MicroLabel({
  htmlFor,
  className,
  children,
}: {
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <LabelPrimitive.Root htmlFor={htmlFor} className={cn('micro-label block', className)}>
      {children}
    </LabelPrimitive.Root>
  )
}

export function FieldHint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs leading-relaxed text-mute">
      {children}
    </p>
  )
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs font-medium text-rust">
      {children}
    </p>
  )
}

/** Standard vertical rhythm for a labeled field. */
export function Field({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('space-y-1.5', className)}>{children}</div>
}
