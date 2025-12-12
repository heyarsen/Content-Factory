import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { AvatarService } from '../services/avatarService.js'
import { AvatarController } from '../controllers/avatarController.js'
import { createErrorResponse, logError, ErrorCode } from '../lib/apiErrorHandler.js'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================
// Avatar Collection Routes
// ============================================

/**
 * GET /api/avatars
 * Get all avatars for the current user
 * Query params: 
 *   - ?all=true to include synced avatars
 *   - ?public=true to get public HeyGen avatars
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    
    // If public=true, return public avatars from HeyGen
    if (req.query.public === 'true') {
      const result = await AvatarController.getPublicAvatars()
      return res.json(result)
    }
    
    // Otherwise, return user's avatars
    const showAll = req.query.all === 'true'
    const result = await AvatarController.listAvatars(userId, { includeSynced: showAll })
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'list_avatars' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to fetch avatars', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars
 * Create a new avatar from photo upload
 */
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const result = await AvatarController.createFromPhoto(req, userId)
    return res.status(201).json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'create_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to create avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/sync
 * Sync avatars from HeyGen API
 */
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const result = await AvatarController.syncFromHeyGen(userId)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'sync_avatars' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to sync avatars', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/public
 * Add a public avatar from HeyGen to user's avatar list
 * Body: { heygen_avatar_id: string, avatar_name?: string, avatar_url?: string }
 */
router.post('/public', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { heygen_avatar_id, avatar_name, avatar_url } = req.body
    
    if (!heygen_avatar_id) {
      return res.status(400).json({ error: 'heygen_avatar_id is required' })
    }
    
    const result = await AvatarController.addPublicAvatar(userId, heygen_avatar_id, avatar_name, avatar_url)
    return res.status(201).json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'add_public_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to add public avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/generate-ai
 * Generate an AI avatar
 */
router.post('/generate-ai', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    
    // Check and deduct credits
    const { CreditsService } = await import('../services/creditsService.js')
    try {
      await CreditsService.checkAndDeduct(userId, CreditsService.COSTS.AVATAR_GENERATION, 'avatar generation')
    } catch (creditError: any) {
      return res.status(402).json({ error: creditError.message || 'Insufficient credits' })
    }
    
    const result = await AvatarController.generateAI(userId, req.body)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'generate_ai_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to generate AI avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

// ============================================
// Single Avatar Routes
// ============================================

/**
 * GET /api/avatars/:id
 * Get a specific avatar by ID
 */
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const result = await AvatarController.getAvatar(userId, id)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'get_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to fetch avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * PATCH /api/avatars/:id
 * Update avatar metadata
 */
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const result = await AvatarController.updateAvatar(userId, id, req.body)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'update_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to update avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * DELETE /api/avatars/:id
 * Delete an avatar
 */
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const removeRemote = req.query.remove_remote === 'true' || req.body?.remove_remote === true
    await AvatarController.deleteAvatar(userId, id, { removeRemote })
    return res.status(204).send()
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'delete_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to delete avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/:id/set-default
 * Set avatar as default
 */
router.post('/:id/set-default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const result = await AvatarController.setDefault(userId, id)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'set_default_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to set default avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/:id/train
 * Start training for an avatar
 */
router.post('/:id/train', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const result = await AvatarController.trainAvatar(userId, id)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'train_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to train avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

// ============================================
// Avatar Details & Looks Routes
// ============================================

/**
 * GET /api/avatars/:id/details
 * Get detailed information about an avatar including looks
 */
router.get('/:id/details', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const result = await AvatarController.getDetails(userId, id)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'get_avatar_details' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to fetch avatar details', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/:id/set-default-look
 * Set the default look for an avatar
 */
router.post('/:id/set-default-look', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const { look_id } = req.body
    const result = await AvatarController.setDefaultLook(userId, id, look_id)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'set_default_look' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to set default look', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/:id/looks/:lookId/add-motion
 * Add motion to a specific look
 * Body: { prompt?: string, motion_type?: 'consistent' | 'expressive' | ... }
 */
router.post('/:id/looks/:lookId/add-motion', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const avatarId = req.params.id
    const lookId = req.params.lookId
    const { prompt, motion_type = 'expressive' } = req.body

    // Verify the avatar belongs to the user
    const { supabase } = await import('../lib/supabase.js')
    const { data: avatar, error: avatarError } = await supabase
      .from('avatars')
      .select('id, heygen_avatar_id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      return res.status(404).json({ error: 'Avatar not found' })
    }

    // Add motion to the look using HeyGen API
    const { addMotionToPhotoAvatar } = await import('../lib/heygen.js')
    const defaultPrompt = 'Full body motion with expressive hand gestures, natural head movements, engaging body language, waving, pointing, and emphasis gestures throughout'
    const motionResult = await addMotionToPhotoAvatar(lookId, prompt || defaultPrompt, motion_type)

    if (!motionResult) {
      return res.status(500).json({ error: 'Failed to add motion to look' })
    }

    return res.json({
      success: true,
      look_id: lookId,
      motion_result: motionResult,
      message: 'Motion added successfully to look',
    })
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'add_motion_to_look' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to add motion to look', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * DELETE /api/avatars/:id/looks/:lookId
 * Delete a look from an avatar
 */
router.delete('/:id/looks/:lookId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id, lookId } = req.params
    await AvatarController.deleteLook(userId, id, lookId)
    return res.json({ message: 'Look deleted successfully' })
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, lookId: req.params.lookId, operation: 'delete_look' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to delete look', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

// ============================================
// Look Management Routes
// ============================================

/**
 * GET /api/avatars/looks/batch
 * Batch fetch looks for multiple avatars
 */
router.get('/looks/batch', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { avatarIds } = req.query
    const result = await AvatarController.batchFetchLooks(userId, avatarIds as string)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'batch_fetch_looks' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to fetch looks', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/add-looks
 * Add looks to an avatar group
 */
router.post('/add-looks', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const result = await AvatarController.addLooks(userId, req.body)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'add_looks' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to add looks', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/generate-look
 * Generate a new look for an avatar
 */
router.post('/generate-look', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    
    // Check and deduct credits
    const { CreditsService } = await import('../services/creditsService.js')
    try {
      await CreditsService.checkAndDeduct(userId, CreditsService.COSTS.LOOK_GENERATION, 'look generation')
    } catch (creditError: any) {
      return res.status(402).json({ error: creditError.message || 'Insufficient credits' })
    }
    
    const result = await AvatarController.generateLook(userId, req.body)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'generate_look' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to generate look', ErrorCode.LOOK_GENERATION_FAILED)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/upload-look-image
 * Upload an image for a look and get image_key
 */
router.post('/upload-look-image', async (req: AuthRequest, res: Response) => {
  try {
    const result = await AvatarController.uploadLookImage(req.body)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'upload_look_image' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to upload look image', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

// ============================================
// Generation & Training Status Routes
// ============================================

/**
 * GET /api/avatars/generation-status/:generationId
 * Check the status of an AI avatar generation
 */
router.get('/generation-status/:generationId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { generationId } = req.params
    const result = await AvatarController.getGenerationStatus(generationId, userId)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, generationId: req.params.generationId, operation: 'get_generation_status' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to check generation status', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * GET /api/avatars/training-status/:groupId
 * Check the training status of an avatar
 */
router.get('/training-status/:groupId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { groupId } = req.params
    const result = await AvatarController.getTrainingStatus(userId, groupId)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, groupId: req.params.groupId, operation: 'get_training_status' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to check training status', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/complete-ai-generation
 * Complete AI avatar generation by creating avatar group
 */
router.post('/complete-ai-generation', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const result = await AvatarController.completeAIGeneration(userId, req.body)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'complete_ai_generation' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to complete AI generation', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

// ============================================
// Job Management Routes
// ============================================

/**
 * GET /api/avatars/jobs
 * Get all jobs for the current user
 */
router.get('/jobs', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { type } = req.query
    const result = await AvatarController.getJobs(userId, type as string)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'get_jobs' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to get jobs', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * GET /api/avatars/jobs/:jobId
 * Get a specific job by ID
 */
router.get('/jobs/:jobId', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { jobId } = req.params
    const result = await AvatarController.getJob(userId, jobId)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, jobId: req.params.jobId, operation: 'get_job' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to get job', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/jobs/:jobId/cancel
 * Cancel a job
 */
router.post('/jobs/:jobId/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { jobId } = req.params
    const result = await AvatarController.cancelJob(userId, jobId)
    return res.json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, jobId: req.params.jobId, operation: 'cancel_job' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to cancel job', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

// ============================================
// Legacy Routes (for backward compatibility)
// ============================================

/**
 * GET /api/avatars/default
 * Get default avatar (legacy)
 */
router.get('/default', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const avatar = await AvatarService.getDefaultAvatar(userId)
    if (!avatar) {
      return res.status(404).json({ error: 'No default avatar set' })
    }
    return res.json({ avatar })
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'get_default_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to get default avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/upload-photo
 * Upload photo and create avatar (legacy - redirects to POST /)
 */
router.post('/upload-photo', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const result = await AvatarController.createFromPhoto(req, userId)
    return res.status(201).json(result)
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'upload_photo' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to upload photo and create avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/create-from-photo
 * Create avatar from photo URL (legacy)
 */
router.post('/create-from-photo', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { photo_url, avatar_name } = req.body
    if (!photo_url || !avatar_name) {
      return res.status(400).json({ error: 'photo_url and avatar_name are required' })
    }
    const avatar = await AvatarService.createAvatarFromPhoto(userId, photo_url, avatar_name)
    return res.status(201).json({
      message: 'Avatar creation started. It may take a few minutes to train.',
      avatar,
    })
  } catch (error: any) {
    logError(error, { userId: req.userId!, operation: 'create_from_photo' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to create avatar from photo', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

/**
 * POST /api/avatars/:id/upscale
 * Upscale an avatar (legacy)
 */
router.post('/:id/upscale', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { id } = req.params
    const result = await AvatarService.upscaleAvatar(id, userId)
    return res.json({
      message: 'Upscale requested successfully',
      result,
    })
  } catch (error: any) {
    logError(error, { userId: req.userId!, avatarId: req.params.id, operation: 'upscale_avatar' })
    const { statusCode, response } = createErrorResponse(error, 'Failed to upscale avatar', ErrorCode.INTERNAL_SERVER_ERROR)
    return res.status(statusCode).json(response)
  }
})

export default router
