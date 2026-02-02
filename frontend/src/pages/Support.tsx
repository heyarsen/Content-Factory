import React, { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { MessageSquare, Plus, Send, Clock } from 'lucide-react'
import api from '../lib/api'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'

interface Ticket {
    id: string
    subject: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    created_at: string
    updated_at: string
}

interface Message {
    id: string
    ticket_id: string
    sender_id: string
    message: string
    is_admin_reply: boolean
    created_at: string
}

export function Support() {
    const { t } = useLanguage()
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTicket, setSelectedTicket] = useState<{ ticket: Ticket, messages: Message[] } | null>(null)
    // const [loadingTicket, setLoadingTicket] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [subject, setSubject] = useState('')
    const [message, setMessage] = useState('')
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [view, setView] = useState<'list' | 'chat'>('list')
    const { addNotification, refreshSupportCount, markAllSupportAsRead } = useNotifications()
    const { user } = useAuth() // Need user ID for subscription filtering if desired, or just use ticket ID
    const handleBackToList = () => {
        setShowCreate(false)
        setSelectedTicket(null)
        setView('list')
    }

    // Use a ref to track the currently selected ticket without triggering re-renders or stale closures in the effect
    const selectedTicketRef = React.useRef<{ ticket: Ticket, messages: Message[] } | null>(null)

    // Keep the ref in sync with state
    useEffect(() => {
        selectedTicketRef.current = selectedTicket
    }, [selectedTicket])

    useEffect(() => {
        if (!user) return

        loadTickets()

        // Real-time subscription for chat messages
        const channelName = `support_chat_${user.id}`
        const subscription = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'support_messages',
                },
                async (payload) => {
                    console.log('Realtime payload received (Support):', payload)
                    const newMessage = payload.new as Message

                    // Always reload tickets to update the "sidebar" list (unread status, last message time)
                    loadTickets()

                    const currentTicket = selectedTicketRef.current

                    // If looking at this ticket, append message
                    if (currentTicket && currentTicket.ticket.id === newMessage.ticket_id) {
                        setSelectedTicket(prev => {
                            if (!prev) return null
                            // Avoid duplicates
                            if (prev.messages.find(m => m.id === newMessage.id)) return prev

                            return {
                                ...prev,
                                messages: [...prev.messages, newMessage]
                            }
                        })

                        // Mark as read immediately if it's not from me
                        if (newMessage.sender_id !== user.id) {
                            try {
                                await api.post(`/api/support/tickets/${newMessage.ticket_id}/read`)
                                // Update badge count
                                refreshSupportCount()
                            } catch (e) {
                                console.error('Failed to mark read on new message', e)
                            }
                        }
                    }
                }
            )
            .subscribe((status) => {
                console.log(`Support Chat Subscription status: ${status}`)
            })

        return () => {
            subscription.unsubscribe()
        }
    }, [user?.id]) // Removed selectedTicket dependency to avoid churn, relying on ref instead

    const loadTickets = async () => {
        try {
            const response = await api.get('/api/support/tickets')
            setTickets(response.data.tickets || [])
        } catch (error) {
            console.error('Failed to load tickets:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadTicketDetails = async (id: string) => {
        // setLoadingTicket(true)
        try {
            const response = await api.get(`/api/support/tickets/${id}`)
            setSelectedTicket(response.data)
            setShowCreate(false)
            setView('chat')

            // Mark as read
            await api.post(`/api/support/tickets/${id}/read`)
            refreshSupportCount()

        } catch (error) {
            console.error('Failed to load ticket details:', error)
        } finally {
            // setLoadingTicket(false)
        }
    }

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!subject || !message) return

        setSending(true)
        try {
            await api.post('/api/support/tickets', { subject, message, priority: 'medium' })
            addNotification({
                type: 'success',
                title: t('support.ticket_created_title'),
                message: t('support.ticket_created_msg'),
            })
            setSubject('')
            setMessage('')
            setShowCreate(false)
            loadTickets()
        } catch (error) {
            console.error('Failed to create ticket:', error)
            addNotification({
                type: 'error',
                title: t('support.error_title'),
                message: t('support.error_msg'),
            })
        } finally {
            setSending(false)
        }
    }

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reply || !selectedTicket) return

        setSending(true)
        try {
            const response = await api.post(`/api/support/tickets/${selectedTicket.ticket.id}/message`, { message: reply })
            setSelectedTicket({
                ...selectedTicket,
                messages: [...selectedTicket.messages, response.data]
            })
            setReply('')
        } catch (error) {
            console.error('Failed to send reply:', error)
        } finally {
            setSending(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open': return <Badge variant="info">{t('support.status_open')}</Badge>
            case 'in_progress': return <Badge variant="warning">{t('support.status_in_progress')}</Badge>
            case 'resolved': return <Badge variant="success">{t('support.status_resolved')}</Badge>
            case 'closed': return <Badge variant="default">{t('support.status_closed')}</Badge>
            default: return <Badge variant="default">{status}</Badge>
        }
    }

    return (
        <Layout>
            <div className="flex h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)] gap-6 overflow-hidden relative">
                {/* Sidebar - Ticket List */}
                <div className={`${view === 'chat' || showCreate ? 'hidden' : 'flex'} w-full lg:flex lg:w-1/3 flex-col gap-4 overflow-hidden`}>
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-primary">{t('support.title')}</h2>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={markAllSupportAsRead}>{t('support.mark_all_read')}</Button>
                            <Button size="sm" onClick={() => { setShowCreate(true); setSelectedTicket(null); setView('chat') }}>
                                <Plus className="mr-2 h-4 w-4" />
                                {t('support.new_ticket')}
                            </Button>
                        </div>
                    </div>

                    <Card className="flex-1 overflow-y-auto p-0">
                        {loading ? (
                            <div className="space-y-4 p-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center">
                                <MessageSquare className="mb-4 h-12 w-12 text-slate-200" />
                                <p className="text-sm text-slate-500">{t('support.no_tickets')}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {tickets.map((ticket: Ticket) => (
                                    <button
                                        key={ticket.id}
                                        onClick={() => loadTicketDetails(ticket.id)}
                                        className={`flex w-full flex-col p-4 text-left transition-colors hover:bg-slate-50 ${selectedTicket?.ticket.id === ticket.id ? 'bg-brand-50/50' : ''}`}
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-xs text-slate-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            {getStatusBadge(ticket.status)}
                                        </div>
                                        <p className="font-medium text-slate-900 line-clamp-1">{ticket.subject}</p>
                                        <div className="mt-2 flex items-center text-xs text-slate-400">
                                            <Clock className="mr-1 h-3 w-3" />
                                            {t('support.updated')} {new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Main Content - Chat or Create */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {(showCreate || selectedTicket) && (
                        <div className="mb-4 flex items-center gap-2 lg:hidden">
                            <Button variant="ghost" size="sm" onClick={handleBackToList}>
                                {t('common.back')}
                            </Button>
                            <span className="text-sm font-semibold text-slate-700">
                                {showCreate ? t('support.new_ticket') : t('support.title')}
                            </span>
                        </div>
                    )}
                    {showCreate ? (
                        <Card className="flex h-full flex-col">
                            <h3 className="mb-6 text-xl font-semibold text-primary">{t('support.new_ticket')}</h3>
                            <form onSubmit={handleCreateTicket} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">{t('support.subject')}</label>
                                    <Input
                                        placeholder={t('support.subject_placeholder')}
                                        value={subject}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-sm font-medium text-slate-700">{t('support.message')}</label>
                                    <Textarea
                                        placeholder={t('support.message_placeholder')}
                                        value={message}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                                        className="min-h-[200px]"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="ghost" onClick={handleBackToList}>{t('common.cancel')}</Button>
                                    <Button type="submit" loading={sending}>{t('support.submit_ticket')}</Button>
                                </div>
                            </form>
                        </Card>
                    ) : selectedTicket ? (
                        <Card className="flex h-full flex-col overflow-hidden p-0">
                            {/* Header */}
                            <div className="border-b border-slate-100 p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-lg font-semibold text-primary">{selectedTicket.ticket.subject}</h3>
                                        <p className="text-xs text-slate-400">{t('support.ticket_id')}: {selectedTicket.ticket.id}</p>
                                    </div>
                                    {getStatusBadge(selectedTicket.ticket.status)}
                                </div>
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 space-y-4">
                                {selectedTicket.messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.is_admin_reply ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[80%] rounded-2xl p-4 ${msg.is_admin_reply ? 'bg-white border border-slate-100 text-slate-800' : 'bg-brand-600 text-white'}`}>
                                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                            <p className={`mt-1 text-[10px] ${msg.is_admin_reply ? 'text-slate-400' : 'text-brand-100'}`}>
                                                {new Date(msg.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input */}
                            <div className="border-t border-slate-100 p-4">
                                <form onSubmit={handleSendReply} className="flex gap-2">
                                    <Input
                                        placeholder={t('support.reply_placeholder')}
                                        value={reply}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReply(e.target.value)}
                                        disabled={selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed'}
                                    />
                                    <Button type="submit" size="sm" disabled={!reply || selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed'} loading={sending}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                                {(selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed') && (
                                    <p className="mt-2 text-center text-xs text-slate-400 italic">
                                        {t('support.closed_message').replace('{status}', t(`support.status_${selectedTicket.ticket.status}`))}
                                    </p>
                                )}
                            </div>
                        </Card>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                            <div className="rounded-full bg-slate-50 p-6">
                                <MessageSquare className="h-12 w-12 text-slate-300" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-primary">{t('support.select_ticket')}</h3>
                            <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                                {t('support.select_ticket_desc')}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
