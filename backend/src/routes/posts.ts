import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireSubscription } from '../middleware/auth.js'
import { postVideo, getUploadStatus, getUserProfile } from '../lib/uploadpost.js'
import { generateVideoCaption } from '../services/captionService.js'

const router = Router()

const PLATFORM_ALIASES: Record<string, string> = {
  twitter: 'x',
}

function normalizePlatform(platform: string): string {
  const normalized = platform.toLowerCase().trim()
  return PLATFORM_ALIASES[normalized] || normalized
}

function isPlatformConnectedOnUploadPost(profile: any, platform: string): boolean {
  const normalizedPlatform = normalizePlatform(platform)
  const actualProfile = profile?.profile || profile
  const socialAccounts = actualProfile?.social_accounts

  if (!socialAccounts || typeof socialAccounts !== 'object') {
    return false
  }

  const platformAccount = socialAccounts[normalizedPlatform] || socialAccounts[platform]
  if (!platformAccount || typeof platformAccount !== 'object') {
    return false
  }

  return Boolean(platformAccount.display_name || platformAccount.username || Object.keys(platformAccount).length > 0)
}

// Schedule/Queue video for posting
router.post('/schedule', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
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

    const normalizedPlatforms = [...new Set(platforms.map((platform: string) => normalizePlatform(platform)))]
    const accountLookupPlatforms = [...new Set([...normalizedPlatforms, 'twitter'])]

    // Get user's connected social accounts for requested platforms
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', userId)
      .in('platform', accountLookupPlatforms)
      .in('status', ['connected', 'pending'])

    const availablePlatforms = new Set((accounts || []).map((account: any) => normalizePlatform(account.platform)))
    const missingPlatforms = normalizedPlatforms.filter((platform: string) => !availablePlatforms.has(platform))

    if (!accounts || accounts.length === 0 || missingPlatforms.length > 0) {
      return res.status(400).json({ error: 'No connected accounts found for selected platforms' })
    }

    const scheduledPosts = []

    // Group accounts by Upload-Post user ID (platform_account_id stores the Upload-Post user ID)
    const uploadPostUserId = accounts.find((account: any) => account.platform_account_id)?.platform_account_id

    if (!uploadPostUserId) {
      return res.status(400).json({ error: 'No Upload-Post user ID found. Please connect your social accounts first.' })
    }

    // Validate that requested platforms are still connected in Upload-Post itself.
    // This keeps local DB state in sync when a user disconnects externally.
    const uploadPostProfile = await getUserProfile(uploadPostUserId)
    const unavailablePlatforms = normalizedPlatforms.filter((platform: string) => {
      return !isPlatformConnectedOnUploadPost(uploadPostProfile, platform)
    })

    const availablePlatformsOnUploadPost = normalizedPlatforms.filter((platform: string) => {
      return isPlatformConnectedOnUploadPost(uploadPostProfile, platform)
    })

    const platformsToMarkConnected = [...new Set(
      (accounts || [])
        .filter((account: any) => availablePlatformsOnUploadPost.includes(normalizePlatform(account.platform)))
        .map((account: any) => account.platform)
    )]

    const platformsToMarkPending = [...new Set(
      (accounts || [])
        .filter((account: any) => unavailablePlatforms.includes(normalizePlatform(account.platform)))
        .map((account: any) => account.platform)
    )]

    if (platformsToMarkConnected.length > 0) {
      await supabase
        .from('social_accounts')
        .update({
          status: 'connected',
          connected_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .in('platform', platformsToMarkConnected)
    }

    if (platformsToMarkPending.length > 0) {
      await supabase
        .from('social_accounts')
        .update({
          status: 'pending',
          connected_at: null,
        })
        .eq('user_id', userId)
        .in('platform', platformsToMarkPending)

      return res.status(400).json({
        error: `The following account(s) are not connected in Upload-Post: ${unavailablePlatforms.join(', ')}. Please reconnect them and try again.`,
        missingPlatforms: unavailablePlatforms,
      })
    }

    // Call upload-post.com API once for all platforms
    try {
      const videoUrlToUse = video.video_url

      let captionToUse = typeof caption === 'string' ? caption.trim() : ''
      if (!captionToUse) {
        try {
          captionToUse = await generateVideoCaption({
            topic: video.topic,
            script: video.script || null,
          })
        } catch (captionError) {
          console.warn('Failed to auto-generate caption, using topic fallback:', captionError)
        }
      }
      if (!captionToUse) {
        captionToUse = video.topic || ''
      }

      console.log('Posting video to Upload-Post:', {
        videoUrl: videoUrlToUse,
        originalUrl: video.video_url,
        platforms: normalizedPlatforms,
        userId: uploadPostUserId,
        caption: captionToUse,
      })

      const postResponse = await postVideo({
        videoUrl: videoUrlToUse,
        platforms: normalizedPlatforms, // Array of platform names
        caption: captionToUse,
        scheduledTime: scheduled_time || undefined,
        userId: uploadPostUserId,
        asyncUpload: true, // Use async upload to handle multiple platforms
      })

      console.log('Upload-Post response:', postResponse)

      // If async upload, start polling for status updates
      const isAsync = postResponse.status === 'pending' && postResponse.upload_id

      // Create scheduled_post record for each platform
      for (const platform of normalizedPlatforms) {
        const platformResult = postResponse.results?.find((r: any) => r.platform === platform)

        // For async uploads, always start as pending
        const status = isAsync ? 'pending' :
          platformResult?.status === 'success' || postResponse.status === 'success' ? 'posted' :
            platformResult?.status === 'failed' ? 'failed' : 'pending'

        const { data: postData, error: postError } = await supabase
          .from('scheduled_posts')
          .insert({
            video_id: video_id,
            user_id: userId,
            platform: platform,
            scheduled_time: scheduled_time || null,
            status: status,
            upload_post_id: postResponse.upload_id || platformResult?.post_id,
            posted_at: platformResult?.status === 'success' ? new Date().toISOString() : null,
            error_message: platformResult?.error || postResponse.error || null,
          })
          .select()
          .single()

        if (postError) {
          console.error(`Database error for ${platform}:`, postError)
          continue
        }

        scheduledPosts.push(postData)
      }

      // If async upload, start background polling
      if (isAsync && postResponse.upload_id) {
        // Poll for status updates in the background (don't await)
        pollUploadStatus(postResponse.upload_id, normalizedPlatforms, scheduledPosts.map((p: any) => p.id))
          .catch(err => console.error('Background status polling error:', err))
      }

      // Check if any posts failed
      const hasFailures = scheduledPosts.some((p: any) => p.status === 'failed')
      if (hasFailures) {
        const failedPosts = scheduledPosts.filter((p: any) => p.status === 'failed')
        const errorMessages = failedPosts.map((p: any) => `${p.platform}: ${p.error_message || 'Unknown error'}`).join('; ')
        return res.status(400).json({
          error: `Some posts failed: ${errorMessages}`,
          posts: scheduledPosts
        })
      }
    } catch (error: any) {
      console.error('Error posting video:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        stack: error.stack,
      })

      const errorMessage = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Failed to post video'

      // Create failed records for all platforms
      for (const platform of normalizedPlatforms) {
        const { data: postData } = await supabase
          .from('scheduled_posts')
          .insert({
            video_id: video_id,
            user_id: userId,
            platform: platform,
            scheduled_time: scheduled_time || null,
            status: 'failed',
            error_message: errorMessage,
          })
          .select()
          .single()

        if (postData) {
          scheduledPosts.push(postData)
        }
      }

      // Return error response so frontend knows it failed
      return res.status(500).json({
        error: errorMessage,
        posts: scheduledPosts
      })
    }

    res.json({ posts: scheduledPosts })
  } catch (error: any) {
    console.error('Schedule post error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// List scheduled/published posts
router.get('/', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
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
router.get('/:id/status', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
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
        const uploadPostStatus = await getUploadStatus(post.upload_post_id)

        // Find the platform-specific result
        const platformResult = uploadPostStatus.results?.find((r: any) =>
          r.platform === post.platform
        )

        const status = platformResult?.status === 'success' || uploadPostStatus.status === 'success' ? 'posted' :
          platformResult?.status === 'failed' || uploadPostStatus.status === 'failed' ? 'failed' :
            'pending'

        await supabase
          .from('scheduled_posts')
          .update({
            status,
            posted_at: status === 'posted' ? new Date().toISOString() : post.posted_at,
            error_message: platformResult?.error || uploadPostStatus.error || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        post.status = status
        post.posted_at = status === 'posted' ? new Date().toISOString() : post.posted_at
        post.error_message = platformResult?.error || uploadPostStatus.error || null
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
router.delete('/:id', authenticate, requireSubscription, async (req: AuthRequest, res: Response) => {
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

// Background function to poll upload status
async function pollUploadStatus(
  uploadId: string,
  platforms: string[],
  postIds: string[]
): Promise<void> {
  const maxAttempts = 30 // Poll for up to 5 minutes (30 * 10s)
  let attempts = 0

  while (attempts < maxAttempts) {
    try {
      await new Promise(resolve => setTimeout(resolve, 10000)) // Wait 10 seconds between polls
      attempts++

      const uploadStatus = await getUploadStatus(uploadId)
      console.log(`Polling upload status (attempt ${attempts}/${maxAttempts}):`, uploadStatus)

      // Update each post based on platform-specific results
      for (let i = 0; i < platforms.length && i < postIds.length; i++) {
        const platform = platforms[i]
        const postId = postIds[i]

        const platformResult = uploadStatus.results?.find((r: any) => r.platform === platform)

        if (platformResult) {
          const status = platformResult.status === 'success' ? 'posted' :
            platformResult.status === 'failed' ? 'failed' :
              'pending'

          await supabase
            .from('scheduled_posts')
            .update({
              status,
              posted_at: status === 'posted' ? new Date().toISOString() : null,
              error_message: platformResult.error || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', postId)

          console.log(`Updated post ${postId} (${platform}) to status: ${status}`)
        }
      }

      // If all platforms are done (success or failed), stop polling
      const allDone = uploadStatus.results?.every((r: any) =>
        r.status === 'success' || r.status === 'failed'
      ) || uploadStatus.status === 'success' || uploadStatus.status === 'failed'

      if (allDone) {
        console.log('All uploads completed, stopping polling')
        break
      }
    } catch (error: any) {
      console.error(`Error polling upload status (attempt ${attempts}):`, error)
      // Continue polling on error
    }
  }

  if (attempts >= maxAttempts) {
    console.warn(`Stopped polling after ${maxAttempts} attempts. Some posts may still be pending.`)
  }
}

export default router
