import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClasses } from './input'

/**
 * Styled native <select> — fully keyboard/screen-reader accessible with the
 * brand input treatment. (Radix Select is deliberately not used for these
 * two optional triage fields; native semantics + react-hook-form register
 * keep the form simple and robust.)
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(inputClasses, 'appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-mute"
      />
    </div>
  ),
)
Select.displayName = 'Select'
