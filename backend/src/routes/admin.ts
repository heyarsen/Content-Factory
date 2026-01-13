import { Router, Response } from 'express'
import { authenticate, AuthRequest, isAdmin } from '../middleware/auth.js'
import { AdminService } from '../services/adminService.js'
import { SupportService } from '../services/supportService.js'

const router = Router()

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get('/stats', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const range = (req.query.range as string) || '24h'
        const stats = await AdminService.getDashboardStats(range)
        res.json(stats)
    } catch (error: any) {
        console.error('Admin stats error:', error)
        res.status(500).json({ error: 'Failed to get dashboard stats' })
    }
})

/**
 * GET /api/admin/tickets
 * Get all support tickets
 */
router.get('/tickets', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const tickets = await SupportService.getAllTickets()
        res.json({ tickets })
    } catch (error: any) {
        console.error('Admin tickets error:', error)
        res.status(500).json({ error: 'Failed to get support tickets' })
    }
})

/**
 * GET /api/admin/tickets/:id
 * Get ticket details
 */
router.get('/tickets/:id', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const details = await SupportService.getTicketDetails(req.params.id)
        if (!details) {
            return res.status(404).json({ error: 'Ticket not found' })
        }
        res.json(details)
    } catch (error: any) {
        console.error('Admin ticket details error:', error)
        res.status(500).json({ error: 'Failed to get ticket details' })
    }
})

/**
 * POST /api/admin/tickets/:id/message
 * Add message as admin
 */
router.post('/tickets/:id/message', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { message } = req.body as { message: string }
        if (!message) {
            return res.status(400).json({ error: 'Message is required' })
        }
        const newMessage = await SupportService.addMessage(req.params.id, req.userId!, message, true)
        res.json(newMessage)
    } catch (error: any) {
        console.error('Admin ticket message error:', error)
        res.status(500).json({ error: 'Failed to add message' })
    }
})

/**
 * POST /api/admin/tickets/:id/resolve
 * Resolve ticket
 */
router.post('/tickets/:id/resolve', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await SupportService.resolveTicket(req.params.id)
        res.json({ success: true })
    } catch (error: any) {
        console.error('Admin resolve ticket error:', error)
        res.status(500).json({ error: 'Failed to resolve ticket' })
    }
})

export default router
