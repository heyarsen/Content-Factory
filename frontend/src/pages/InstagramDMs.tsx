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
  raw?: any
}

interface ChatMessage {
  id: string
  text: string
  timestamp?: string
  senderId?: string
  recipientId?: string
  threadId: string
}

interface Conversation {
  id: string
  ownAccountId: string
  participantId: string
  participantLabel: string
  messages: ChatMessage[]
  lastTimestamp?: string
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

const formatTime = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const extractMessages = (dm: InstagramDM): ChatMessage[] => {
  const nestedMessages = dm.raw?.messages?.data

  if (Array.isArray(nestedMessages) && nestedMessages.length > 0) {
    return nestedMessages.map((entry: any, index: number) => ({
      id: String(entry?.id || `${dm.id}-${index}`),
      text: String(entry?.message || dm.text || '—'),
      timestamp: entry?.created_time || dm.timestamp,
      senderId: entry?.from?.id || dm.senderId,
      recipientId: entry?.to?.data?.[0]?.id || dm.recipientId,
      threadId: String(dm.threadId || dm.id || 'unknown-thread'),
    }))
  }

  return [
    {
      id: String(dm.id),
      text: dm.text || '—',
      timestamp: dm.timestamp,
      senderId: dm.senderId,
      recipientId: dm.recipientId,
      threadId: String(dm.threadId || dm.id || 'unknown-thread'),
    },
  ]
}

const isOutgoingMessage = (message: ChatMessage, participantId: string, ownAccountId: string) => {
  if (ownAccountId && message.senderId) {
    return message.senderId === ownAccountId
  }

  if (participantId && message.senderId) {
    return message.senderId !== participantId
  }

  if (participantId && message.recipientId) {
    return message.recipientId === participantId
  }

  return false
}

export function InstagramDMs() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [dms, setDms] = useState<InstagramDM[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [manualRecipientId, setManualRecipientId] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const dmsResponse = await api.get<ListResponse<InstagramDM>>('/api/social/instagram/dms', {
        params: { per_page: 50 },
      })

      setDms(dmsResponse.data.data || [])
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load DMs')
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

  const conversations = useMemo<Conversation[]>(() => {
    const threadCountByUserId = new Map<string, Set<string>>()

    dms.forEach((dm) => {
      const threadId = String(dm.threadId || dm.id || 'unknown-thread')
      const ids = new Set<string>()
      const messages = extractMessages(dm)

      messages.forEach((msg) => {
        if (msg.senderId) ids.add(msg.senderId)
        if (msg.recipientId) ids.add(msg.recipientId)
      })

      ids.forEach((id) => {
        if (!threadCountByUserId.has(id)) {
          threadCountByUserId.set(id, new Set<string>())
        }
        threadCountByUserId.get(id)!.add(threadId)
      })
    })

    const inferredOwnAccountId = Array.from(threadCountByUserId.entries())
      .sort((a, b) => b[1].size - a[1].size)[0]?.[0] || ''

    const map = new Map<string, Conversation>()

    dms.forEach((dm) => {
      const messages = extractMessages(dm)
      const threadId = String(dm.threadId || dm.id || 'unknown-thread')
      const participants = Array.isArray(dm.raw?.participants?.data) ? dm.raw.participants.data : []

      const threadIds = new Set<string>()
      messages.forEach((msg) => {
        if (msg.senderId) threadIds.add(msg.senderId)
        if (msg.recipientId) threadIds.add(msg.recipientId)
      })

      const participantFromMessages = Array.from(threadIds).find((id) => id && id !== inferredOwnAccountId) || ''

      const participantFromApi = participants.find((participant: any) => participant?.id && participant.id !== inferredOwnAccountId)
      const participantUsername = participantFromApi?.username
      const participantApiId = participantFromApi?.id

      if (!map.has(threadId)) {
        map.set(threadId, {
          id: threadId,
          ownAccountId: inferredOwnAccountId,
          participantId: participantFromMessages || participantApiId || dm.senderId || dm.recipientId || '',
          participantLabel: participantUsername || participantFromMessages || participantApiId || dm.senderId || dm.recipientId || 'Unknown user',
          messages: [],
          lastTimestamp: dm.timestamp,
        })
      }

      const existing = map.get(threadId)!
      existing.messages.push(...messages)
      existing.lastTimestamp = [existing.lastTimestamp, ...messages.map((msg) => msg.timestamp)]
        .filter(Boolean)
        .sort()
        .pop()

      if (!existing.participantId) {
        existing.participantId = participantFromMessages || participantApiId || dm.senderId || dm.recipientId || ''
      }

      if (existing.participantLabel === 'Unknown user') {
        existing.participantLabel = participantUsername || existing.participantId || 'Unknown user'
      }

      if (!existing.ownAccountId) {
        existing.ownAccountId = inferredOwnAccountId
      }
    })

    return Array.from(map.values())
      .map((conversation) => ({
        ...conversation,
        messages: conversation.messages
          .slice()
          .sort((a, b) => (new Date(a.timestamp || '').getTime() || 0) - (new Date(b.timestamp || '').getTime() || 0)),
      }))
      .sort((a, b) => (new Date(b.lastTimestamp || '').getTime() || 0) - (new Date(a.lastTimestamp || '').getTime() || 0))
  }, [dms])

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationId(null)
      return
    }

    if (!selectedConversationId || !conversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0].id)
    }
  }, [conversations, selectedConversationId])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId],
  )

  const handleRefresh = () => {
    setRefreshing(true)
    loadData()
  }

  const handleSend = async () => {
    try {
      setSendError(null)
      setSendSuccess(null)

      const resolvedRecipientId = selectedConversation?.participantId || manualRecipientId

      if (!resolvedRecipientId.trim() || !message.trim()) {
        setSendError('Recipient ID and message are required.')
        return
      }

      setSending(true)
      const response = await api.post('/api/social/instagram/dms/send', {
        recipient_id: resolvedRecipientId.trim(),
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
          <h1 className="text-3xl font-bold text-primary">AI Auto-DM</h1>
          <p className="mt-1 text-sm text-slate-600">Manage direct messages in a chat-style inbox.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
            <CalendarRange className="h-4 w-4" />
            Data source: Upload-Post social DMs
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

        <Card className="p-0">
          <div className="grid min-h-[640px] md:grid-cols-[320px,1fr]">
            <div className="border-b border-slate-200 bg-slate-50 p-4 md:border-b-0 md:border-r">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Conversations</h2>

              {error ? (
                <div className="mt-4">
                  <EmptyState
                    icon={<MessageCircle className="h-7 w-7" />}
                    title="Unable to load DMs"
                    description={error}
                  />
                </div>
              ) : loading ? (
                <div className="mt-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-16 w-full" />
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={<MessageCircle className="h-8 w-8" />}
                    title="No direct messages found"
                    description="Connect a social account and receive DMs to see them here."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {conversations.map((conversation) => {
                    const lastMessage = conversation.messages[conversation.messages.length - 1]
                    const isSelected = conversation.id === selectedConversationId

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => setSelectedConversationId(conversation.id)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-brand-300 bg-brand-50 shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-semibold text-slate-900">{conversation.participantLabel}</p>
                          <span className="text-xs text-slate-500">{formatTime(conversation.lastTimestamp)}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-600">{lastMessage?.text || 'No messages yet'}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex h-full flex-col">
              {selectedConversation ? (
                <>
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <p className="text-sm text-slate-500">Chatting with</p>
                      <h3 className="text-lg font-semibold text-primary">{selectedConversation.participantLabel}</h3>
                      <p className="text-xs text-slate-500">Recipient ID: {selectedConversation.participantId || 'Unknown'}</p>
                    </div>
                    <Badge variant="default">Thread {selectedConversation.id}</Badge>
                  </div>

                  <div className="max-h-[420px] flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-5">
                    {selectedConversation.messages.map((dm) => {
                      const isOutgoing = isOutgoingMessage(dm, selectedConversation.participantId, selectedConversation.ownAccountId)

                      return (
                        <div key={dm.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[78%] rounded-2xl px-4 py-3 shadow-sm ${
                              isOutgoing
                                ? 'rounded-br-md bg-brand-600 text-white'
                                : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                            }`}
                          >
                            <p className="text-sm leading-relaxed">{dm.text || '—'}</p>
                            <p className={`mt-2 text-[11px] ${isOutgoing ? 'text-brand-100' : 'text-slate-500'}`}>
                              {formatDate(dm.timestamp)}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center p-6">
                  <EmptyState
                    icon={<MessageCircle className="h-8 w-8" />}
                    title="Select a conversation"
                    description="Choose a conversation from the left to view messages in chat mode."
                  />
                </div>
              )}

              <div className="border-t border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Send className="h-4 w-4 text-brand-600" />
                  <h4 className="text-sm font-semibold text-slate-800">Reply</h4>
                </div>

                {!selectedConversation && (
                  <input
                    value={manualRecipientId}
                    onChange={(e) => setManualRecipientId(e.target.value)}
                    placeholder="Recipient ID (e.g. 17841400123456789)"
                    className="mb-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                  />
                )}

                <div className="grid gap-3 md:grid-cols-[1fr,auto]">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={selectedConversation ? 'Write a reply…' : 'Write your message'}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand-400 focus:outline-none"
                  />
                  <Button onClick={handleSend} disabled={sending} className="h-fit gap-2 md:self-end">
                    <Send className={`h-4 w-4 ${sending ? 'animate-pulse' : ''}`} />
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>

                {sendError && <p className="mt-2 text-sm text-red-600">{sendError}</p>}
                {sendSuccess && <p className="mt-2 text-sm text-green-600">{sendSuccess}</p>}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  )
}
