import { Router, Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../middleware/auth.js'
import { CreditsService } from '../services/creditsService.js'

const router = Router()

/**
 * GET /api/referrals/info
 * Get current user's referral code, link, and statistics
 */
router.get('/info', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!

    // Get user's referral code
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('referral_code')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.error('[Referrals] Error fetching user profile:', profileError)
      return res.status(404).json({ error: 'User profile not found' })
    }

    // If no referral code exists, generate one
    let referralCode = profile.referral_code
    if (!referralCode) {
      referralCode = Math.random().toString(36).substring(2, 10)
      await supabase
        .from('user_profiles')
        .update({ referral_code: referralCode })
        .eq('id', userId)
    }

    // Get referral statistics
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select('id, credits_awarded, created_at, referred_id')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false })

    if (referralsError) {
      console.error('[Referrals] Error fetching referrals:', referralsError)
    }

    const referralsList = referrals || []
    const totalReferrals = referralsList.length
    const totalCreditsEarned = referralsList.reduce((sum, r) => sum + (r.credits_awarded || 0), 0)

    // Get referred users' emails (partially masked)
    const referredIds = referralsList.map(r => r.referred_id)
    let referredUsers: any[] = []

    if (referredIds.length > 0) {
      // Get emails from auth.users via admin API
      const usersPromises = referredIds.map(async (id) => {
        const { data } = await supabase.auth.admin.getUserById(id)
        return data?.user
      })
      const users = await Promise.all(usersPromises)

      referredUsers = referralsList.map((ref, index) => {
        const user = users[index]
        const email = user?.email || 'unknown'
        // Mask email: show first 2 chars + *** + domain
        const maskedEmail = email.length > 5
          ? email.substring(0, 2) + '***' + email.substring(email.indexOf('@'))
          : '***'

        return {
          id: ref.id,
          email: maskedEmail,
          credits_awarded: ref.credits_awarded,
          created_at: ref.created_at,
        }
      })
    }

    // Build referral link
    const frontendUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'https://app.ai-smm.co'
    const referralLink = `${frontendUrl}/signup?ref=${referralCode}`

    res.json({
      referral_code: referralCode,
      referral_link: referralLink,
      total_referrals: totalReferrals,
      total_credits_earned: totalCreditsEarned,
      referrals: referredUsers,
    })
  } catch (error: any) {
    console.error('[Referrals] Error in /info:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/referrals/apply
 * Apply a referral code after registration
 * Body: { referralCode: string }
 */
router.post('/apply', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { referralCode } = req.body

    if (!referralCode) {
      return res.status(400).json({ error: 'Referral code is required' })
    }

    // Check if user already has a referral record (was already referred)
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', userId)
      .single()

    if (existingReferral) {
      return res.status(400).json({ error: 'Referral already applied' })
    }

    // Find the referrer by referral code
    const { data: referrer, error: referrerError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('referral_code', referralCode)
      .single()

    if (referrerError || !referrer) {
      return res.status(404).json({ error: 'Invalid referral code' })
    }

    // Prevent self-referral
    if (referrer.id === userId) {
      return res.status(400).json({ error: 'Cannot use your own referral code' })
    }

    // Create referral record
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: userId,
        credits_awarded: 10,
        status: 'completed',
      })

    if (insertError) {
      console.error('[Referrals] Error creating referral:', insertError)
      return res.status(500).json({ error: 'Failed to apply referral' })
    }

    // Award 10 credits to the referrer
    try {
      await CreditsService.addCredits(referrer.id, 10, 'Referral bonus')
      console.log(`[Referrals] Awarded 10 credits to referrer ${referrer.id} for referred user ${userId}`)
    } catch (creditError) {
      console.error('[Referrals] Error awarding credits:', creditError)
      // Don't fail the whole operation if credit addition fails
    }

    res.json({
      message: 'Referral applied successfully',
      credits_awarded_to_referrer: 10,
    })
  } catch (error: any) {
    console.error('[Referrals] Error in /apply:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
