import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { generateVideo, getVideoStatus } from '../lib/heygen.js'
import { Video } from '../types/database.js'

const router = Router()

// Generate video
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { topic, script, style, duration } = req.body
    const userId = req.userId!

    if (!topic || !style || !duration) {
      return res.status(400).json({ error: 'Topic, style, and duration are required' })
    }

    if (duration < 15 || duration > 180) {
      return res.status(400).json({ error: 'Duration must be between 15 and 180 seconds' })
    }

    // Create video record in database
    const { data: videoData, error: dbError } = await supabase
      .from('videos')
      .insert({
        user_id: userId,
        topic,
        script: script || null,
        style,
        duration,
        status: 'pending',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return res.status(500).json({ error: 'Failed to create video record' })
    }

    // Call HeyGen API asynchronously
    generateVideo({ topic, script, style, duration })
      .then(async (heygenResponse) => {
        await supabase
          .from('videos')
          .update({
            heygen_video_id: heygenResponse.video_id,
            status: heygenResponse.status === 'completed' ? 'completed' : 'generating',
            video_url: heygenResponse.video_url || null,
          })
          .eq('id', videoData.id)
      })
      .catch(async (error) => {
        console.error('HeyGen generation error:', error)
        await supabase
          .from('videos')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', videoData.id)
      })

    res.json({ video: videoData })
  } catch (error: any) {
    console.error('Generate video error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// List videos
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { status, search } = req.query

    let query = supabase
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(`topic.ilike.%${search}%,script.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return res.status(500).json({ error: 'Failed to fetch videos' })
    }

    res.json({ videos: data || [] })
  } catch (error: any) {
    console.error('List videos error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get video by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return res.status(404).json({ error: 'Video not found' })
    }

    res.json({ video: data })
  } catch (error: any) {
    console.error('Get video error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get video status
router.get('/:id/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { data: video, error: dbError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (dbError || !video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    // If video is still generating and has heygen_video_id, check status
    if (video.heygen_video_id && (video.status === 'generating' || video.status === 'pending')) {
      try {
        const heygenStatus = await getVideoStatus(video.heygen_video_id)
        
        const status = heygenStatus.status === 'completed' ? 'completed' :
                     heygenStatus.status === 'failed' ? 'failed' :
                     'generating'

        await supabase
          .from('videos')
          .update({
            status,
            video_url: heygenStatus.video_url || video.video_url,
            error_message: heygenStatus.error || null,
          })
          .eq('id', id)

        video.status = status
        video.video_url = heygenStatus.video_url || video.video_url
        video.error_message = heygenStatus.error || null
      } catch (heygenError) {
        console.error('HeyGen status check error:', heygenError)
      }
    }

    res.json({ video })
  } catch (error: any) {
    console.error('Get video status error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete video
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Delete error:', error)
      return res.status(500).json({ error: 'Failed to delete video' })
    }

    res.json({ message: 'Video deleted successfully' })
  } catch (error: any) {
    console.error('Delete video error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Retry failed generation
router.post('/:id/retry', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params

    const { data: video, error: dbError } = await supabase
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (dbError || !video) {
      return res.status(404).json({ error: 'Video not found' })
    }

    if (video.status !== 'failed') {
      return res.status(400).json({ error: 'Can only retry failed videos' })
    }

    // Update status to pending
    await supabase
      .from('videos')
      .update({
        status: 'pending',
        error_message: null,
      })
      .eq('id', id)

    // Retry generation
    generateVideo({
      topic: video.topic,
      script: video.script || undefined,
      style: video.style,
      duration: video.duration,
    })
      .then(async (heygenResponse) => {
        await supabase
          .from('videos')
          .update({
            heygen_video_id: heygenResponse.video_id,
            status: heygenResponse.status === 'completed' ? 'completed' : 'generating',
            video_url: heygenResponse.video_url || null,
          })
          .eq('id', id)
      })
      .catch(async (error) => {
        console.error('HeyGen retry error:', error)
        await supabase
          .from('videos')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', id)
      })

    res.json({ message: 'Retry initiated' })
  } catch (error: any) {
    console.error('Retry video error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router

