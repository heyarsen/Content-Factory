import { useEffect, useState } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Badge } from '../components/ui/Badge'
import { Skeleton } from '../components/ui/Skeleton'
import { MessageSquare, Plus, Send, Clock, CheckCircle2, ChevronRight } from 'lucide-react'
import api from '../lib/api'
import { useNotification } from '../contexts/NotificationContext'

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
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedTicket, setSelectedTicket] = useState<{ ticket: Ticket, messages: Message[] } | null>(null)
    const [loadingTicket, setLoadingTicket] = useState(false)
    const [showCreate, setShowCreate] = useState(false)
    const [subject, setSubject] = useState('')
    const [message, setMessage] = useState('')
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const { addNotification } = useNotification()

    useEffect(() => {
        loadTickets()
    }, [])

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
        setLoadingTicket(true)
        try {
            const response = await api.get(`/api/support/tickets/${id}`)
            setSelectedTicket(response.data)
            setShowCreate(false)
        } catch (error) {
            console.error('Failed to load ticket details:', error)
        } finally {
            setLoadingTicket(false)
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
                title: 'Ticket Created',
                message: 'Your support ticket has been created successfully.',
            })
            setSubject('')
            setMessage('')
            setShowCreate(false)
            loadTickets()
        } catch (error) {
            console.error('Failed to create ticket:', error)
            addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to create support ticket.',
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
            case 'open': return <Badge variant="info">Open</Badge>
            case 'in_progress': return <Badge variant="warning">In Progress</Badge>
            case 'resolved': return <Badge variant="success">Resolved</Badge>
            case 'closed': return <Badge variant="secondary">Closed</Badge>
            default: return <Badge variant="default">{status}</Badge>
        }
    }

    return (
        <Layout>
            <div className="flex h-[calc(100vh-160px)] gap-6 overflow-hidden">
                {/* Sidebar - Ticket List */}
                <div className="flex w-1/3 flex-col gap-4 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-primary">Support Tickets</h2>
                        <Button size="sm" onClick={() => { setShowCreate(true); setSelectedTicket(null); }}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Ticket
                        </Button>
                    </div>

                    <Card className="flex-1 overflow-y-auto p-0">
                        {loading ? (
                            <div className="space-y-4 p-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
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
                                            <span className="text-xs text-slate-400">{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            {getStatusBadge(ticket.status)}
                                        </div>
                                        <p className="font-medium text-slate-900 line-clamp-1">{ticket.subject}</p>
                                        <div className="mt-2 flex items-center text-xs text-slate-400">
                                            <Clock className="mr-1 h-3 w-3" />
                                            Updated {new Date(ticket.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>

                {/* Main Content - Chat or Create */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {showCreate ? (
                        <Card className="flex h-full flex-col">
                            <h3 className="mb-6 text-xl font-semibold text-primary">Create Support Ticket</h3>
                            <form onSubmit={handleCreateTicket} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">Subject</label>
                                    <Input
                                        placeholder="Briefly describe your issue"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <label className="text-sm font-medium text-slate-700">Message</label>
                                    <Textarea
                                        placeholder="Tell us more details about what's happening..."
                                        value={message}
                                        onChange={e => setMessage(e.target.value)}
                                        className="min-h-[200px]"
                                        required
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                                    <Button type="submit" loading={sending}>Submit Ticket</Button>
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
                                        <p className="text-xs text-slate-400">Ticket ID: {selectedTicket.ticket.id}</p>
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
                                        placeholder="Type your reply here..."
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        disabled={selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed'}
                                    />
                                    <Button type="submit" size="icon" disabled={!reply || selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed'} loading={sending}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                </form>
                                {(selectedTicket.ticket.status === 'resolved' || selectedTicket.ticket.status === 'closed') && (
                                    <p className="mt-2 text-center text-xs text-slate-400 italic">
                                        This ticket is {selectedTicket.ticket.status} and cannot be replied to.
                                    </p>
                                )}
                            </div>
                        </Card>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-10 text-center">
                            <div className="rounded-full bg-slate-50 p-6">
                                <MessageSquare className="h-12 w-12 text-slate-300" />
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-primary">Select a ticket</h3>
                            <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
                                Choose a ticket from the left or create a new one to communicate with our support team.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    )
}
