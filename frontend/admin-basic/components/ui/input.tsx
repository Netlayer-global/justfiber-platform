'use client'

import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, iconLeft, iconRight, className, id, ...props },
  ref
) {
  const inputId = id || props.name
  return (
    <div className="w-full">
      {label ? <label htmlFor={inputId} className="label">{label}</label> : null}
      <div className="relative">
        {iconLeft ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{iconLeft}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={cn('input', iconLeft && 'pl-10', iconRight && 'pr-10', error && 'border-rose-300 focus:border-rose-400', className)}
          {...props}
        />
        {iconRight ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{iconRight}</span> : null}
      </div>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, children, id, ...props },
  ref
) {
  const inputId = id || props.name
  return (
    <div className="w-full">
      {label ? <label htmlFor={inputId} className="label">{label}</label> : null}
      <select ref={ref} id={inputId} className={cn('select', error && 'border-rose-300', className)} {...props}>
        {children}
      </select>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, id, ...props },
  ref
) {
  const inputId = id || props.name
  return (
    <div className="w-full">
      {label ? <label htmlFor={inputId} className="label">{label}</label> : null}
      <textarea ref={ref} id={inputId} className={cn('input min-h-[80px] resize-y', error && 'border-rose-300', className)} {...props} />
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
})
