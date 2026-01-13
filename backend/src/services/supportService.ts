import { supabase } from '../lib/supabase.js'

export interface SupportTicket {
    id: string
    user_id: string
    subject: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    created_at: string
    updated_at: string
    user_email?: string
}

export interface SupportMessage {
    id: string
    ticket_id: string
    sender_id: string
    message: string
    is_admin_reply: boolean
    created_at: string
}

export class SupportService {
    /**
     * Create a new support ticket
     */
    static async createTicket(userId: string, subject: string, initialMessage: string, priority: string = 'medium'): Promise<SupportTicket> {
        console.log('[Support] Creating ticket for user:', userId)

        // 1. Create ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('support_tickets')
            .insert({
                user_id: userId,
                subject,
                priority
            })
            .select()
            .single()

        if (ticketError) {
            console.error('[Support] Error creating ticket:', ticketError)
            throw new Error('Failed to create support ticket')
        }

        // 2. Add initial message
        const { error: messageError } = await supabase
            .from('support_messages')
            .insert({
                ticket_id: ticket.id,
                sender_id: userId,
                message: initialMessage,
                is_admin_reply: false
            })

        if (messageError) {
            console.error('[Support] Error adding initial message:', messageError)
            // We don't throw here to avoid failing the whole request, but it's bad
        }

        return ticket
    }

    /**
     * Add a message to an existing ticket
     */
    static async addMessage(ticketId: string, senderId: string, message: string, isAdminReply: boolean = false): Promise<SupportMessage> {
        console.log('[Support] Adding message to ticket:', ticketId)

        const { data: supportMessage, error } = await supabase
            .from('support_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: senderId,
                message,
                is_admin_reply: isAdminReply
            })
            .select()
            .single()

        if (error) {
            console.error('[Support] Error adding message:', error)
            throw new Error('Failed to add message to support ticket')
        }

        // Update ticket status if it's an admin reply
        if (isAdminReply) {
            await supabase
                .from('support_tickets')
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', ticketId)
        } else {
            await supabase
                .from('support_tickets')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', ticketId)
        }

        return supportMessage
    }

    /**
     * Get tickets for a user
     */
    static async getUserTickets(userId: string): Promise<SupportTicket[]> {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('[Support] Error fetching user tickets:', error)
            return []
        }

        return data || []
    }

    /**
     * Get all tickets (for admins)
     */
    static async getAllTickets(): Promise<SupportTicket[]> {
        const { data, error } = await supabase
            .from('support_tickets')
            .select('*, user:auth.users(email)')
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('[Support] Error fetching all tickets:', error)
            return []
        }

        return data.map((t: any) => ({
            ...t,
            user_email: t.user?.email
        }))
    }

    /**
     * Get ticket details and messages
     */
    static async getTicketDetails(ticketId: string): Promise<{ ticket: SupportTicket, messages: SupportMessage[] } | null> {
        const { data: ticket, error: ticketError } = await supabase
            .from('support_tickets')
            .select('*, user:auth.users(email)')
            .eq('id', ticketId)
            .single()

        if (ticketError || !ticket) {
            console.error('[Support] Error fetching ticket details:', ticketError)
            return null
        }

        const { data: messages, error: messageError } = await supabase
            .from('support_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true })

        if (messageError) {
            console.error('[Support] Error fetching messages:', messageError)
            return { ticket: { ...ticket, user_email: (ticket as any).user?.email }, messages: [] }
        }

        return {
            ticket: { ...ticket, user_email: (ticket as any).user?.email },
            messages: messages || []
        }
    }

    /**
     * Resolve a ticket
     */
    static async resolveTicket(ticketId: string): Promise<void> {
        const { error } = await supabase
            .from('support_tickets')
            .update({ status: 'resolved', updated_at: new Date().toISOString() })
            .eq('id', ticketId)

        if (error) {
            console.error('[Support] Error resolving ticket:', error)
            throw new Error('Failed to resolve ticket')
        }
    }
}
