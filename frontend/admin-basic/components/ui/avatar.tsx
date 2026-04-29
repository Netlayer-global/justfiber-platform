import { cn, initials } from '@/lib/utils'

const colors = [
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-indigo-100 text-indigo-700',
]

function colorFromName(name?: string) {
  const text = (name || '').trim()
  if (!text) return colors[0]
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash << 5) - hash + text.charCodeAt(i)
  return colors[Math.abs(hash) % colors.length]
}

const sizeMap = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  status,
}: {
  name?: string
  src?: string
  size?: keyof typeof sizeMap
  className?: string
  status?: 'online' | 'offline' | 'busy' | 'away'
}) {
  const statusColor = {
    online: 'bg-emerald-500',
    offline: 'bg-slate-400',
    busy: 'bg-rose-500',
    away: 'bg-amber-500',
  }
  return (
    <div className={cn('relative inline-flex shrink-0', className)}>
      <div className={cn('flex items-center justify-center rounded-full font-semibold', sizeMap[size], colorFromName(name))}>
        {src ? (
          <img src={src} alt={name || 'avatar'} className="h-full w-full rounded-full object-cover" />
        ) : (
          initials(name)
        )}
      </div>
      {status ? (
        <span
          className={cn(
            'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white',
            statusColor[status]
          )}
        />
      ) : null}
    </div>
  )
}
