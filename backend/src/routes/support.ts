import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { SupportService } from '../services/supportService.js'

const router = Router()

/**
 * GET /api/support/tickets
 * Get user's tickets
 */
router.get('/tickets', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!
        const tickets = await SupportService.getUserTickets(userId, req.userToken)
        res.json({ tickets })
    } catch (error: any) {
        console.error('Support tickets error:', error)
        res.status(500).json({ error: 'Failed to get support tickets' })
    }
})

/**
 * POST /api/support/tickets
 * Create a new ticket
 */
router.post('/tickets', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!
        const { subject, message, priority } = req.body as { subject: string, message: string, priority?: 'low' | 'medium' | 'high' | 'urgent' }

        if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required' })
        }

        const ticket = await SupportService.createTicket(userId, subject, message, priority, req.userToken)
        res.json(ticket)
    } catch (error: any) {
        console.error('Create support ticket error:', error)
        res.status(500).json({ error: 'Failed to create support ticket' })
    }
})

/**
 * GET /api/support/tickets/:id
 * Get ticket details and messages
 */
router.get('/tickets/:id', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!
        const ticketId = req.params.id

        const details = await SupportService.getTicketDetails(ticketId, req.userToken)
        if (!details) {
            return res.status(404).json({ error: 'Ticket not found' })
        }

        // Security check: only own tickets or admin (though admin should use /api/admin/...)
        if (details.ticket.user_id !== userId && req.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' })
        }

        res.json(details)
    } catch (error: any) {
        console.error('Get support ticket details error:', error)
        res.status(500).json({ error: 'Failed to get ticket details' })
    }
})

/**
 * POST /api/support/tickets/:id/message
 * Add message to own ticket
 */
router.post('/tickets/:id/message', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!
        const ticketId = req.params.id
        const { message } = req.body as { message: string }

        if (!message) {
            return res.status(400).json({ error: 'Message is required' })
        }

        // Verify ownership
        const details = await SupportService.getTicketDetails(ticketId, req.userToken)
        if (!details) {
            return res.status(404).json({ error: 'Ticket not found' })
        }

        if (details.ticket.user_id !== userId && req.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' })
        }

        const newMessage = await SupportService.addMessage(
            ticketId,
            userId,
            message,
            req.role === 'admin' && details.ticket.user_id !== userId, // It's an admin reply if role is admin and not own ticket
            req.userToken
        )
        res.json(newMessage)
    } catch (error: any) {
        console.error('Add support message error:', error)
        res.status(500).json({ error: 'Failed to add message' })
    }
})

export default router
