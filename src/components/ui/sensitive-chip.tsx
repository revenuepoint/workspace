import { EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SENSITIVE_CHIP_CLASSES } from '@/lib/status'

/**
 * "Sensitive" marker — a visibility classification, deliberately not a
 * StatusChip variant (status keys off Case.Status; this rides next to it).
 * Only ever rendered on cases the viewer can see, so it reads as "yours,
 * hidden from colleagues", never as a lock they're outside of.
 */
export function SensitiveChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]',
        SENSITIVE_CHIP_CLASSES,
        className,
      )}
    >
      <EyeOff aria-hidden="true" className="size-3" />
      Sensitive
    </span>
  )
}
