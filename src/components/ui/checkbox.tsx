import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Native checkbox — crimson check via accent-color, rule border, the shared
 * focus-visible ring. Label association happens at the call site (wrap it in
 * a real <label>), matching how Input/Field compose.
 */
export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded-sm border border-rule accent-crimson transition-colors duration-[180ms] ease-editorial focus-visible:outline-2 focus-visible:outline-crimson focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  ),
)
Checkbox.displayName = 'Checkbox'
