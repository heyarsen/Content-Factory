import { AlertTriangle, Clock3, RefreshCw } from 'lucide-react'
import { Button } from './Button'
import type { RequestStatus } from '../../hooks/useRequestState'

interface RequestStatePanelProps {
  status: RequestStatus
  onRetry: () => void
  lastAttemptedAt: Date | null
  statusLink?: string
}

export function RequestStatePanel({ status, onRetry, lastAttemptedAt, statusLink }: RequestStatePanelProps) {
  if (status !== 'error' && status !== 'timeout') {
    return null
  }

  const isTimeout = status === 'timeout'

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {isTimeout ? <Clock3 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {isTimeout ? 'This request timed out.' : 'We hit an error loading this section.'}
          </p>
          {lastAttemptedAt && (
            <p className="text-xs text-amber-800/90">Last attempted: {lastAttemptedAt.toLocaleTimeString()}</p>
          )}
          {statusLink && (
            <a href={statusLink} target="_blank" rel="noreferrer" className="text-xs font-medium underline decoration-amber-400 underline-offset-2 hover:text-amber-950">
              View system status
            </a>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry now
        </Button>
      </div>
    </div>
  )
}
