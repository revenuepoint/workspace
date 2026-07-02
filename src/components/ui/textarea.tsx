import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { inputClasses } from './input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 5, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(inputClasses, 'min-h-24 resize-y leading-relaxed', className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'
