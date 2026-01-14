import { supabase, getSupabaseClientForUser } from '../lib/supabase.js'

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
    private static getClient(userToken?: string) {
        // Use the caller's token for RLS-aware operations when available,
        // otherwise fall back to the service role client
        return userToken ? getSupabaseClientForUser(userToken) : supabase
    }

    /**
     * Create a new support ticket
     */
    static async createTicket(
        userId: string,
        subject: string,
        initialMessage: string,
        priority: string = 'medium',
        userToken?: string
    ): Promise<SupportTicket> {
        console.log('[Support] Creating ticket for user:', userId)

        const client = this.getClient(userToken)

        // 1. Create ticket
        const { data: ticket, error: ticketError } = await client
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
            throw new Error(ticketError?.message || 'Failed to create support ticket')
        }

        // 2. Add initial message
        const { error: messageError } = await client
            .from('support_messages')
            .insert({
                ticket_id: ticket.id,
                sender_id: userId,
                ticket_owner_id: userId, // Set owner for RLS
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
    static async addMessage(
        ticketId: string,
        senderId: string,
        message: string,
        isAdminReply: boolean = false,
        userToken?: string
    ): Promise<SupportMessage> {
        console.log('[Support] Adding message to ticket:', ticketId)

        const client = this.getClient(userToken)

        // Need ticket details to know the owner for RLS
        const { data: ticket, error: ticketError } = await client
            .from('support_tickets')
            .select('user_id')
            .eq('id', ticketId)
            .single()

        if (ticketError || !ticket) {
            throw new Error('Ticket not found')
        }

        const { data: supportMessage, error } = await client
            .from('support_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: senderId,
                ticket_owner_id: ticket.user_id, // Set owner for RLS
                message,
                is_admin_reply: isAdminReply
            })
            .select()
            .single()

        if (error) {
            console.error('[Support] Error adding message:', error)
            throw new Error(error?.message || 'Failed to add message to support ticket')
        }

        // Update ticket status if it's an admin reply
        if (isAdminReply) {
            await client
                .from('support_tickets')
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', ticketId)
        } else {
            await client
                .from('support_tickets')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', ticketId)
        }

        return supportMessage
    }

    /**
     * Get tickets for a user
     */
    static async getUserTickets(userId: string, userToken?: string): Promise<SupportTicket[]> {
        const client = this.getClient(userToken)

        const { data, error } = await client
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
            .select('*')
            .order('updated_at', { ascending: false })

        if (error) {
            console.error('[Support] Error fetching all tickets:', error)
            return []
        }

        return data as any
    }

    /**
     * Get ticket details and messages
     */
    static async getTicketDetails(ticketId: string, userToken?: string): Promise<{ ticket: SupportTicket, messages: SupportMessage[] } | null> {
        const client = this.getClient(userToken)

        const { data: ticket, error: ticketError } = await client
            .from('support_tickets')
            .select('*')
            .eq('id', ticketId)
            .single()

        if (ticketError || !ticket) {
            console.error('[Support] Error fetching ticket details:', ticketError)
            return null
        }

        const { data: messages, error: messageError } = await client
            .from('support_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true })

        if (messageError) {
            console.error('[Support] Error fetching messages:', messageError)
            return { ticket: ticket as any, messages: [] }
        }

        return {
            ticket: ticket as any,
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

    /**
     * Mark messages as read
     */
    static async markAsRead(ticketId: string, userId: string, userToken?: string): Promise<void> {
        const client = this.getClient(userToken)

        // If user is reading, mark admin replies as read
        // If admin is reading, mark user messages as read (logic needs to know who is reading)
        // For simplicity: Mark all messages in this ticket NOT sent by me as read.

        const { error } = await client
            .from('support_messages')
            .update({ is_read: true })
            .eq('ticket_id', ticketId)
            .neq('sender_id', userId)
            .eq('is_read', false)

        if (error) {
            console.error('[Support] Error marking messages as read:', error)
            // Don't throw, just log
        }
    }
}
