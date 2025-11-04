import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { getSupabaseClientForUser } from '../lib/supabase.js'
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js'

const router = Router()

// Get admin dashboard stats
router.get('/stats', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // Get total users - use auth.admin API instead of direct table access
    let totalUsers = 0
    try {
      const { data: usersData } = await supabase.auth.admin.listUsers()
      totalUsers = usersData?.users?.length || 0
    } catch (error) {
      console.warn('Failed to get user count, using 0:', error)
      totalUsers = 0
    }

    // Get total videos
    const { count: totalVideos } = await supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })

    // Get videos by status
    const { data: videosByStatus } = await supabase
      .from('videos')
      .select('status')

    const statusCounts = videosByStatus?.reduce((acc: any, video: any) => {
      acc[video.status] = (acc[video.status] || 0) + 1
      return acc
    }, {}) || {}

    // Get total social accounts
    const { count: totalSocialAccounts } = await supabase
      .from('social_accounts')
      .select('*', { count: 'exact', head: true })

    // Get social accounts by platform
    const { data: socialAccountsByPlatform } = await supabase
      .from('social_accounts')
      .select('platform, status')

    const platformCounts = socialAccountsByPlatform?.reduce((acc: any, account: any) => {
      if (!acc[account.platform]) {
        acc[account.platform] = { total: 0, connected: 0 }
      }
      acc[account.platform].total++
      if (account.status === 'connected') {
        acc[account.platform].connected++
      }
      return acc
    }, {}) || {}

    // Get total scheduled posts
    const { count: totalPosts } = await supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })

    // Get posts by status
    const { data: postsByStatus } = await supabase
      .from('scheduled_posts')
      .select('status')

    const postStatusCounts = postsByStatus?.reduce((acc: any, post: any) => {
      acc[post.status] = (acc[post.status] || 0) + 1
      return acc
    }, {}) || {}

    res.json({
      users: {
        total: totalUsers || 0,
      },
      videos: {
        total: totalVideos || 0,
        byStatus: statusCounts,
      },
      socialAccounts: {
        total: totalSocialAccounts || 0,
        byPlatform: platformCounts,
      },
      posts: {
        total: totalPosts || 0,
        byStatus: postStatusCounts,
      },
    })
  } catch (error: any) {
    console.error('Admin stats error:', error)
    res.status(500).json({ error: 'Failed to fetch admin stats' })
  }
})

// Get all users
router.get('/users', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers()

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch users' })
    }

    // Get user roles for each user
    const usersWithRoles = await Promise.all(
      (users.users || []).map(async (user) => {
        const { data: roles } = await supabase.rpc('get_user_roles', {
          user_uuid: user.id,
        })
        return {
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          emailConfirmed: !!user.email_confirmed_at,
          roles: roles || [],
        }
      })
    )

    res.json({ users: usersWithRoles })
  } catch (error: any) {
    console.error('Admin users error:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// Assign admin role to user
router.post('/users/:userId/assign-admin', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params

    // Get admin role ID
    const { data: adminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .single()

    if (!adminRole) {
      return res.status(500).json({ error: 'Admin role not found' })
    }

    // Assign role
    const { error } = await supabase
      .from('user_roles')
      .insert({
        user_id: userId,
        role_id: adminRole.id,
      })

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'User already has admin role' })
      }
      return res.status(500).json({ error: 'Failed to assign admin role' })
    }

    res.json({ message: 'Admin role assigned successfully' })
  } catch (error: any) {
    console.error('Assign admin error:', error)
    res.status(500).json({ error: 'Failed to assign admin role' })
  }
})

// Remove admin role from user
router.post('/users/:userId/remove-admin', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params

    // Get admin role ID
    const { data: adminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'admin')
      .single()

    if (!adminRole) {
      return res.status(500).json({ error: 'Admin role not found' })
    }

    // Remove role
    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role_id', adminRole.id)

    if (error) {
      return res.status(500).json({ error: 'Failed to remove admin role' })
    }

    res.json({ message: 'Admin role removed successfully' })
  } catch (error: any) {
    console.error('Remove admin error:', error)
    res.status(500).json({ error: 'Failed to remove admin role' })
  }
})

// Check if current user is admin
router.get('/check', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Double-check admin status using user-specific client
    const userSupabase = req.userToken ? getSupabaseClientForUser(req.userToken) : supabase
    
    const { data: adminCheck, error } = await userSupabase.rpc('is_admin', { 
      user_uuid: req.userId 
    })
    
    if (error) {
      console.error('[Admin Check] RPC error:', error)
      // Fall back to middleware check
      return res.json({ isAdmin: req.isAdmin || false })
    }
    
    const isAdmin = adminCheck === true
    console.log('[Admin Check] User:', req.userId, 'Admin status:', isAdmin)
    
    res.json({ isAdmin })
  } catch (error: any) {
    console.error('[Admin Check] Error:', error)
    // Fall back to middleware check
    res.json({ isAdmin: req.isAdmin || false })
  }
})

export default router

