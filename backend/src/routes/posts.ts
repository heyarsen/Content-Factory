import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { postVideo, getPostStatus } from '../lib/uploadpost.js'

const router = Router()

// Schedule/Queue video for posting
router.post('/schedule', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { video_id, platforms, scheduled_time, caption } = req.body
    const userId = req.userId!

    if (!video_id || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'Video ID and at least one platform are required' })
    }

    // Verify video exists and belongs to user
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', video_id)
      .eq('user_id', userId)
      .single()

    if (videoError || !video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    if (video.status !== 'completed' || !video.video_url) {
      return res.status(400).json({ error: 'Video must be completed before posting' })
    }

    // Get user's connected social accounts for requested platforms
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .in('platform', platforms)
      .eq('status', 'connected')

    if (!accounts || accounts.length === 0) {
      return res.status(400).json({ error: 'No connected accounts found for selected platforms' })
    }

    const scheduledPosts = []

    // Create scheduled post for each platform
    for (const account of accounts) {
      try {
        // Call upload-post.com API
        const postResponse = await postVideo({
          videoUrl: video.video_url,
          platform: account.platform,
          caption: caption || video.topic,
          scheduledTime: scheduled_time || undefined,
          accountId: account.platform_account_id,
        })

        // Create scheduled_post record
        const { data: postData, error: postError } = await supabase
          .from('scheduled_posts')
          .insert({
            video_id: video_id,
            user_id: userId,
            platform: account.platform,
            scheduled_time: scheduled_time || null,
            status: postResponse.status === 'posted' ? 'posted' : 'pending',
            upload_post_id: postResponse.post_id,
            posted_at: postResponse.status === 'posted' ? new Date().toISOString() : null,
          })
          .select()
          .single()

        if (postError) {
          console.error('Database error:', postError)
          continue
        }

        scheduledPosts.push(postData)
      } catch (error: any) {
        console.error(`Error posting to ${account.platform}:`, error)
        // Still create the record but mark as failed
        const { data: postData } = await supabase
          .from('scheduled_posts')
          .insert({
            video_id: video_id,
            user_id: userId,
            platform: account.platform,
            scheduled_time: scheduled_time || null,
            status: 'failed',
            error_message: error.message,
          })
          .select()
          .single()

        if (postData) {
          scheduledPosts.push(postData)
        }
      }
    }

    res.json({ posts: scheduledPosts })
  } catch (error: any) {
    console.error('Schedule post error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// List scheduled/published posts
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { status, video_id } = req.query

    let query = supabase
      .from('scheduled_posts')
      .select('*, videos(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (video_id) {
      query = query.eq('video_id', video_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ error: 'Failed to fetch posts' })
    }

    res.json({ posts: data || [] })
  } catch (error: any) {
    console.error('List posts error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get post status
router.get('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { data: post, error: dbError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (dbError || !post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // If post has upload_post_id and is still pending, check status
    if (post.upload_post_id && (post.status === 'pending' || post.status === 'failed')) {
      try {
        const uploadPostStatus = await getPostStatus(post.upload_post_id)
        
        const status = uploadPostStatus.status === 'posted' ? 'posted' :
                     uploadPostStatus.status === 'failed' ? 'failed' :
                     'pending'

        await supabase
          .from('scheduled_posts')
          .update({
            status,
            posted_at: status === 'posted' ? new Date().toISOString() : post.posted_at,
            error_message: uploadPostStatus.error || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        post.status = status
        post.posted_at = status === 'posted' ? new Date().toISOString() : post.posted_at
        post.error_message = uploadPostStatus.error || null
      } catch (uploadPostError) {
        console.error('Upload-post status check error:', uploadPostError)
      }
    }

    res.json({ post })
  } catch (error: any) {
    console.error('Get post status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Cancel scheduled post
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { data: post, error: fetchError } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    if (post.status === 'posted') {
      return res.status(400).json({ error: 'Cannot cancel already posted content' })
    }

    const { error } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Cancel error:', error)
      return res.status(500).json({ error: 'Failed to cancel post' })
    }

    res.json({ message: 'Post cancelled successfully' })
  } catch (error: any) {
    console.error('Cancel post error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

