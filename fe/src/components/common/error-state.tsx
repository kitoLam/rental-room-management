import { CircleAlert, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ErrorStateProps = {
  message: string
  onRetry?: () => void
  retrying?: boolean
  className?: string
}

/** Lỗi: nói rõ chuyện gì xảy ra và cho cách thử lại. */
export function ErrorState({ message, onRetry, retrying, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center',
        className,
      )}
    >
      <CircleAlert className="size-6 text-danger" aria-hidden="true" />
      <p className="max-w-sm text-sm text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} loading={retrying}>
          {!retrying && <RefreshCw aria-hidden="true" />}
          Thử lại
        </Button>
      )}
    </div>
  )
}
