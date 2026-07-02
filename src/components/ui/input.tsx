import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** 1px rule border; focus turns the border crimson; aria-invalid turns it rust. */
export const inputClasses =
  'block w-full rounded-md border border-rule bg-white px-3 py-2 text-[0.9375rem] text-ink placeholder:text-muteSoft transition-colors duration-[180ms] ease-editorial focus:border-crimson focus:outline-none focus-visible:outline-2 focus-visible:outline-crimson focus-visible:outline-offset-2 aria-[invalid=true]:border-rust disabled:cursor-not-allowed disabled:bg-paper disabled:text-mute'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClasses, className)} {...props} />
  ),
)
Input.displayName = 'Input'
