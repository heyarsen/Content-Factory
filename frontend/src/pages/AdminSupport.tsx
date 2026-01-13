import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { MessageSquare, Send, Clock, CheckCircle2, User, Mail } from 'lucide-react'
import api from '../lib/api'
import { useNotification } from '../contexts/NotificationContext'

interface Ticket {
    id: string
    user_id: string
    subject: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    created_at: string
    updated_at: string
    user_email?: string
}

interface Message {
    id: string
    ticket_id: string
    sender_id: string
    message: string
    is_admin_reply: boolean
    created_at: string
}

export function AdminSupport() {
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTicket, setSelectedTicket] = useState<{ ticket: Ticket, messages: Message[] } | null>(null)
    const [loadingTicket, setLoadingTicket] = useState(false)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const { addNotification } = useNotification()

    useEffect(() => {
        loadTickets()
    }, [])

    const loadTickets = async () => {
        try {
            const response = await api.get('/api/admin/tickets')
            setTickets(response.data.tickets || [])
        } catch (error) {
            console.error('Failed to load tickets:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadTicketDetails = async (id: string) => {
        setLoadingTicket(true)
        try {
            const response = await api.get(`/api/admin/tickets/${id}`)
            setSelectedTicket(response.data)
        } catch (error) {
            console.error('Failed to load ticket details:', error)
        } finally {
            setLoadingTicket(false)
        }
    }

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reply || !selectedTicket) return

        setSending(true)
        try {
            const response = await api.post(`/api/admin/tickets/${selectedTicket.ticket.id}/message`, { message: reply })
            setSelectedTicket({
                ...selectedTicket,
                messages: [...selectedTicket.messages, response.data]
            })
            setReply('')
            // Update ticket in list as well
            setTickets((prev: Ticket[]) => prev.map((t: Ticket) => t.id === selectedTicket.ticket.id ? { ...t, status: 'in_progress', updated_at: new Date().toISOString() } : t))
        } catch (error) {
            console.error('Failed to send reply:', error)
        } finally {
            setSending(false)
        }
    }

    const handleResolveTicket = async () => {
        if (!selectedTicket) return
        try {
            await api.post(`/api/admin/tickets/${selectedTicket.ticket.id}/resolve`)
            setSelectedTicket({
                ...selectedTicket,
                ticket: { ...selectedTicket.ticket, status: 'resolved' }
            })
            setTickets((prev: Ticket[]) => prev.map((t: Ticket) => t.id === selectedTicket.ticket.id ? { ...t, status: 'resolved' } : t))
            addNotification({
                type: 'success',
                title: 'Ticket Resolved',
                message: 'The ticket has been marked as resolved.',
            })
        } catch (error) {
            console.error('Failed to resolve ticket:', error)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open': return <Badge variant="info">Open</Badge>
            case 'in_progress': return <Badge variant="warning">In Progress</Badge>
            case 'resolved': return <Badge variant="success">Resolved</Badge>
            case 'closed': return <Badge variant="default">Closed</Badge>
            default: return <Badge variant="default">{status}</Badge>
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'text-rose-600 bg-rose-50'
            case 'high': return 'text-orange-600 bg-orange-50'
            case 'medium': return 'text-amber-600 bg-amber-50'
            case 'low': return 'text-blue-600 bg-blue-50'
            default: return 'text-slate-600 bg-slate-50'
        }
    }

    return (
        <Layout>
            <div className="flex h-[calc(100vh-160px)] gap-6 overflow-hidden">
                {/* Sidebar - Ticket Inbox */}
                <div className="flex w-1/3 flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-primary">Support Inbox</h2>
                        <Button variant="ghost" size="sm" onClick={loadTickets}>Refresh</Button>
                    </div>

                    <Card className="flex-1 overflow-y-auto p-0">
                        {loading ? (
                            <div className="space-y-4 p-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-10 text-center">
                                <MessageSquare className="mb-4 h-12 w-12 text-slate-200" />
                                <p className="text-sm text-slate-500">No support tickets found.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {tickets.map(ticket => (
                                    <button
                                        key={ticket.id}
                                        onClick={() => loadTicketDetails(ticket.id)}
                                        className={`flex w-full flex-col p-4 text-left transition-colors hover:bg-slate-50 ${selectedTicket?.ticket.id === ticket.id ? 'bg-brand-50/50' : ''}`}
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(ticket.priority)}`}>
                                                {ticket.priority}
                                            </div>
                                            {getStatusBadge(ticket.status)}
                                        </div>
                                        <p className="font-semibold text-slate-900 line-clamp-1">{ticket.subject}</p>
                                        <div className="mt-1 flex items-center text-xs text-slate-500">
                                            <Mail className="mr-1 h-3 w-3" />
                                            {ticket.user_email}
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                                            <div className="flex items-center">
                                                <Clock className="mr-1 h-3 w-3" />
                                                {new Date(ticket.created_at).toLocaleDateString()}
                                            </div>
                                            <span>Updated {new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Main Content - Ticket Management */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {selectedTicket ? (
                        <Card className="flex h-full flex-col overflow-hidden p-0">
                            {/* Header */}
                            <div className="border-b border-slate-100 p-6 bg-slate-50/30">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-semibold text-primary">{selectedTicket.ticket.subject}</h3>
                                        <div className="mt-2 flex items-center gap-4">
                                            <div className="flex items-center text-sm text-slate-600">
                                                <User className="mr-2 h-4 w-4 text-slate-400" />
                                                {selectedTicket.ticket.user_email}
                                            </div>
                                            <div className="flex items-center text-sm text-slate-600">
                                                <Clock className="mr-2 h-4 w-4 text-slate-400" />
                                                Started {new Date(selectedTicket.ticket.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {selectedTicket.ticket.status !== 'resolved' && (
                                            <Button variant="primary" size="sm" onClick={handleResolveTicket}>
                                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                                Resolve
                                            </Button>
                                        )}
                                        {getStatusBadge(selectedTicket.ticket.status)}
                                    </div>
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 space-y-6">
                                {selectedTicket.messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.is_admin_reply ? 'justify-end' : 'justify-start'}`}>
                                        <div className="flex max-w-[85%] flex-col">
                                            <div className={`flex items-center mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 ${msg.is_admin_reply ? 'justify-end' : 'justify-start'}`}>
                                                {msg.is_admin_reply ? 'Your Reply' : 'User Message'}
                                            </div>
                                            <div className={`rounded-2xl p-4 shadow-sm ${msg.is_admin_reply ? 'bg-brand-600 text-white' : 'bg-white border border-slate-100 text-slate-800'}`}>
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                            </div>
                                            <p className={`mt-1 text-[10px] text-slate-400 ${msg.is_admin_reply ? 'text-right' : 'text-left'}`}>
                                                {new Date(msg.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Reply Input */}
                            <div className="border-t border-slate-200 p-6 bg-white">
                                <form onSubmit={handleSendReply} className="relative">
                                    <textarea
                                        rows={3}
                                        placeholder="Type your response to the user..."
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        className="w-full resize-none rounded-2xl border-slate-200 bg-slate-50 p-4 pr-16 text-sm focus:border-brand-500 focus:ring-brand-500"
                                        disabled={selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed'}
                                    />
                                    <div className="absolute right-3 bottom-3">
                                        <Button
                                            type="submit"
                                            size="sm"
                                            disabled={!reply || selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed'}
                                            loading={sending}
                                        >
                                            <Send className="mr-2 h-4 w-4" />
                                            Send Reply
                                        </Button>
                                    </div>
                                </form>
                                {selectedTicket.ticket.status === 'resolved' && (
                                    <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-green-50 p-3 text-xs text-green-700">
                                        <CheckCircle2 className="h-4 w-4" />
                                        This ticket has been marked as resolved.
                                    </div>
                                )}
                            </div>
                        </Card>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                            <div className="rounded-full bg-slate-50 p-8 shadow-inner">
                                <MessageSquare className="h-16 w-16 text-slate-200" />
                            </div>
                            <h3 className="mt-6 text-xl font-semibold text-primary">Admin Support View</h3>
                            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                                Select a ticket from the inbox to start communicating with users and resolving their issues.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
