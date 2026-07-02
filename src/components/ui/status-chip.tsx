import { cn } from '@/lib/utils'
import { statusChipClassesFor, statusLabelFor } from '@/lib/status'

/**
 * Status chip — JetBrains Mono 11px uppercase, tinted bg + darker text,
 * subtle border. All treatments come from src/lib/status.ts (single source).
 */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em]',
        statusChipClassesFor(status),
        className,
      )}
    >
      {statusLabelFor(status)}
    </span>
  )
}
