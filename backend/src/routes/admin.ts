import { Router, Response } from 'express'
import { authenticate, AuthRequest, isAdmin } from '../middleware/auth.js'
import { AdminService } from '../services/adminService.js'
import { SupportService } from '../services/supportService.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

/**
 * GET /api/admin/check
 * Check if current user is admin (useful for troubleshooting)
 */
router.get('/check', authenticate, async (req: AuthRequest, res: Response) => {
    res.json({ isAdmin: req.role === 'admin' })
})

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

/**
 * POST /api/admin/tickets/:id/read
 * Mark ticket messages as read
 */
router.post('/tickets/:id/read', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await SupportService.markAsRead(req.params.id, req.userId!, req.userToken)
        res.json({ success: true })
    } catch (error: any) {
        console.error('Admin mark read error:', error)
        res.status(500).json({ error: 'Failed to mark messages as read' })
    }
})

/**
 * POST /api/admin/tickets/mark-all-read
 * Mark all support messages as read
 */
router.post('/tickets/mark-all-read', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        await SupportService.markAllAsRead(req.userId!, req.role!)
        res.json({ success: true })
    } catch (error: any) {
        console.error('Admin mark all read error:', error)
        res.status(500).json({ error: 'Failed to mark all as read' })
    }
})

/**
 * GET /api/admin/users
 * Get all users with pagination and search
 */
router.get('/users', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 50
        const search = req.query.search as string || ''
        const offset = (page - 1) * limit
        const cutoffDate = new Date('2026-02-05T00:00:00.000Z')

        let query = supabase
            .from('user_profiles')
            .select(`
                id,
                email,
                created_at,
                last_sign_in_at,
                email_confirmed_at,
                user_roles!inner(
                    role
                )
            `, { count: 'exact' })
            .order('created_at', { ascending: false })
            .gte('created_at', cutoffDate.toISOString())
            .range(offset, offset + limit - 1)

        if (search) {
            query = query.ilike('email', `%${search}%`)
        }

        const { data: users, count, error } = await query

        if (error) {
            console.error('Error fetching users:', error)
            return res.status(500).json({ error: 'Failed to fetch users' })
        }

        const formattedUsers = users?.map(user => ({
            id: user.id,
            email: user.email,
            createdAt: user.created_at,
            lastSignIn: user.last_sign_in_at,
            emailConfirmed: !!user.email_confirmed_at,
            roles: user.user_roles?.map((ur: any) => ur.role) || []
        })) || []

        res.json({
            users: formattedUsers,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        })
    } catch (error: any) {
        console.error('Admin users error:', error)
        res.status(500).json({ error: 'Failed to get users' })
    }
})

/**
 * POST /api/admin/users/:userId/assign-admin
 * Assign admin role to user
 */
router.post('/users/:userId/assign-admin', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params
        
        const { error } = await supabase
            .from('user_roles')
            .upsert({
                user_id: userId,
                role: 'admin'
            }, {
                onConflict: 'user_id,role'
            })

        if (error) {
            console.error('Error assigning admin role:', error)
            return res.status(500).json({ error: 'Failed to assign admin role' })
        }

        res.json({ success: true })
    } catch (error: any) {
        console.error('Admin assign role error:', error)
        res.status(500).json({ error: 'Failed to assign admin role' })
    }
})

/**
 * POST /api/admin/users/:userId/remove-admin
 * Remove admin role from user
 */
router.post('/users/:userId/remove-admin', authenticate, isAdmin, async (req: AuthRequest, res: Response) => {
    try {
        const { userId } = req.params
        
        const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role', 'admin')

        if (error) {
            console.error('Error removing admin role:', error)
            return res.status(500).json({ error: 'Failed to remove admin role' })
        }

        res.json({ success: true })
    } catch (error: any) {
        console.error('Admin remove role error:', error)
        res.status(500).json({ error: 'Failed to remove admin role' })
    }
})

/**
 * POST /api/admin/setup/make-admin/:email
 * Setup endpoint to make a user an admin (development only - no auth required for bootstrap)
 */
router.post('/setup/make-admin/:email', async (req: AuthRequest, res: Response) => {
    try {
        const { email } = req.params
        
        // Get user from auth
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
        if (listError || !users) {
            return res.status(500).json({ error: 'Failed to list users' })
        }

        const targetUser = users.find((u: any) => u.email === email)
        if (!targetUser) {
            return res.status(404).json({ error: `User ${email} not found` })
        }

        // Update user_profiles to set role as admin
        const { data, error } = await supabase
            .from('user_profiles')
            .update({ role: 'admin' })
            .eq('id', targetUser.id)
            .select()
            .single()

        if (error) {
            console.error('Error updating user role:', error)
            return res.status(500).json({ error: 'Failed to update user role', details: error.message })
        }

        res.json({ success: true, message: `User ${email} is now an admin`, data })
    } catch (error: any) {
        console.error('[Admin Setup] Error:', error)
        res.status(500).json({ error: 'Internal server error', details: error.message })
    }
})


export default router
