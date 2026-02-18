import { useCallback, useEffect, useMemo, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { Badge } from '../components/ui/Badge'
import { MessageCircle, RefreshCw, CalendarRange, Send } from 'lucide-react'
import api from '../lib/api'

interface InstagramDM {
  id: string
  text?: string
  timestamp?: string
  senderId?: string
  recipientId?: string
  threadId?: string
}

interface ListResponse<T> {
  status: string
  data: T[]
  page?: number
  perPage?: number
  total?: number
  hasMore?: boolean
}

const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function InstagramDMs() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [dms, setDms] = useState<InstagramDM[]>([])
  const [recipientId, setRecipientId] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const dmsResponse = await api.get<ListResponse<InstagramDM>>('/api/social/instagram/dms', {
        params: { per_page: 50 },
      })

      setDms(dmsResponse.data.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load Instagram DMs')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const uniqueParticipants = useMemo(() => {
    const ids = new Set<string>()
    dms.forEach((dm) => {
      if (dm.senderId) ids.add(dm.senderId)
      if (dm.recipientId) ids.add(dm.recipientId)
    })
    return ids.size
  }, [dms])

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleSend = async () => {
    try {
      setSendError(null)
      setSendSuccess(null)

      if (!recipientId.trim() || !message.trim()) {
        setSendError('Recipient ID and message are required.')
        return
      }

      setSending(true)
      const response = await api.post('/api/social/instagram/dms/send', {
        recipient_id: recipientId.trim(),
        message: message.trim(),
      })

      setSendSuccess(response?.data?.message || 'DM sent successfully.')
      setMessage('')
      await loadData()
    } catch (err: any) {
      setSendError(err?.response?.data?.error || err?.message || 'Failed to send direct message')
    } finally {
      setSending(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Instagram DMs</h1>
          <p className="mt-1 text-sm text-slate-600">Manage direct messages in one inbox.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
            <CalendarRange className="h-4 w-4" />
            Data source: Upload-Post Instagram DMs
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="secondary" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, idx) => (
              <Card key={idx}>
                <Skeleton className="h-24 w-full" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Messages</p>
              <p className="text-3xl font-bold text-primary">{dms.length}</p>
              <Badge variant="default" className="w-fit">DM inbox</Badge>
            </Card>
            <Card className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Participants</p>
              <p className="text-3xl font-bold text-primary">{uniqueParticipants}</p>
              <Badge variant="default" className="w-fit">User IDs detected</Badge>
            </Card>
          </div>
        )}

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-primary">Send Direct Message</h2>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr,2fr,auto]">
            <input
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="Recipient ID (e.g. 17841400123456789)"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
            />
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              <Send className={`h-4 w-4 ${sending ? 'animate-pulse' : ''}`} />
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>

          {sendError && <p className="text-sm text-red-600">{sendError}</p>}
          {sendSuccess && <p className="text-sm text-green-600">{sendSuccess}</p>}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-brand-600" />
            <h2 className="text-lg font-semibold text-primary">Inbox</h2>
          </div>

          {error ? (
            <EmptyState
              icon={<MessageCircle className="h-8 w-8" />}
              title="Unable to load DMs"
              description={error}
            />
          ) : loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-14 w-full" />
              ))}
            </div>
          ) : dms.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="h-8 w-8" />}
              title="No direct messages found"
              description="Connect Instagram and receive DMs to see them here."
            />
          ) : (
            <div className="space-y-3">
              {dms.map((dm) => (
                <div key={dm.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="default">Thread {dm.threadId || 'N/A'}</Badge>
                    <span className="text-xs text-slate-500">{formatDate(dm.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-700">{dm.text || '—'}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Sender: {dm.senderId || 'unknown'} · Recipient: {dm.recipientId || 'unknown'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  )
}
