import * as fs from 'fs'
import * as path from 'path'
import type { Avatar } from '../services/avatarService.js'

const TEST_FIXTURES_DIR = path.join(process.cwd(), 'test', 'fixtures', 'avatars')

/**
 * Ensure the test fixtures directory exists
 */
function ensureTestFixturesDir(): void {
  if (!fs.existsSync(TEST_FIXTURES_DIR)) {
    fs.mkdirSync(TEST_FIXTURES_DIR, { recursive: true })
  }
}

/**
 * Save an avatar to test fixtures
 * @param avatar - Avatar to save
 * @param requestData - Optional request data used to create the avatar
 * @param forceSave - If true, save regardless of status (default: false, only saves untrained avatars)
 */
export function saveUntrainedAvatarToTest(avatar: Avatar, requestData?: any, forceSave: boolean = false): void {
  try {
    ensureTestFixturesDir()

    // Only save untrained avatars by default, unless forceSave is true
    if (!forceSave) {
      const untrainedStatuses = ['generating', 'training', 'pending']
      if (!untrainedStatuses.includes(avatar.status)) {
        console.log(`[Test Fixtures] Skipping avatar ${avatar.id} - status is '${avatar.status}', not untrained`)
        return
      }
    }

    const fileName = `untrained-avatar-${avatar.id}.json`
    const filePath = path.join(TEST_FIXTURES_DIR, fileName)

    const fixtureData = {
      avatar: {
        id: avatar.id,
        user_id: avatar.user_id,
        heygen_avatar_id: avatar.heygen_avatar_id,
        avatar_name: avatar.avatar_name,
        avatar_url: avatar.avatar_url,
        preview_url: avatar.preview_url,
        thumbnail_url: avatar.thumbnail_url,
        gender: avatar.gender,
        status: avatar.status,
        is_default: avatar.is_default,
        source: avatar.source,
        created_at: avatar.created_at,
        updated_at: avatar.updated_at,
      },
      request_data: requestData || null,
      saved_at: new Date().toISOString(),
    }

    fs.writeFileSync(filePath, JSON.stringify(fixtureData, null, 2), 'utf-8')
    console.log(`[Test Fixtures] ✅ Saved untrained avatar to: ${filePath}`)
  } catch (error: any) {
    console.error('[Test Fixtures] Failed to save untrained avatar:', error.message)
    // Don't throw - this is a test utility, shouldn't break the main flow
  }
}

/**
 * Load all saved untrained avatars from test fixtures
 */
export function loadUntrainedAvatarsFromTest(): Array<{ avatar: Avatar; request_data: any; saved_at: string }> {
  try {
    ensureTestFixturesDir()

    if (!fs.existsSync(TEST_FIXTURES_DIR)) {
      return []
    }

    const files = fs.readdirSync(TEST_FIXTURES_DIR)
    const avatarFiles = files.filter((f) => f.startsWith('untrained-avatar-') && f.endsWith('.json'))

    const avatars = avatarFiles.map((file) => {
      const filePath = path.join(TEST_FIXTURES_DIR, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    })

    console.log(`[Test Fixtures] Loaded ${avatars.length} untrained avatars from test fixtures`)
    return avatars
  } catch (error: any) {
    console.error('[Test Fixtures] Failed to load untrained avatars:', error.message)
    return []
  }
}

/**
 * Get a specific untrained avatar by ID from test fixtures
 */
export function getUntrainedAvatarFromTest(avatarId: string): { avatar: Avatar; request_data: any; saved_at: string } | null {
  try {
    ensureTestFixturesDir()

    const fileName = `untrained-avatar-${avatarId}.json`
    const filePath = path.join(TEST_FIXTURES_DIR, fileName)

    if (!fs.existsSync(filePath)) {
      return null
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error: any) {
    console.error(`[Test Fixtures] Failed to load untrained avatar ${avatarId}:`, error.message)
    return null
  }
}

/**
 * Clear all test fixture avatars
 */
export function clearTestAvatars(): void {
  try {
    if (!fs.existsSync(TEST_FIXTURES_DIR)) {
      return
    }

    const files = fs.readdirSync(TEST_FIXTURES_DIR)
    const avatarFiles = files.filter((f) => f.startsWith('untrained-avatar-') && f.endsWith('.json'))

    avatarFiles.forEach((file) => {
      const filePath = path.join(TEST_FIXTURES_DIR, file)
      fs.unlinkSync(filePath)
    })

    console.log(`[Test Fixtures] Cleared ${avatarFiles.length} test avatar fixtures`)
  } catch (error: any) {
    console.error('[Test Fixtures] Failed to clear test avatars:', error.message)
  }
}

/**
 * Sync existing avatars from database to test fixtures
 * @param userId - User ID to sync avatars for
 * @param allAvatars - If true, sync ALL user-created avatars. If false, only sync untrained ones (default: true)
 */
export async function syncUntrainedAvatarsFromDatabase(userId: string, allAvatars: boolean = true): Promise<{ saved: number; total: number; byStatus: Record<string, number> }> {
  try {
    const { supabase } = await import('../lib/supabase.js')
    
    let query = supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)

    // If allAvatars is true, get all user-created avatars (not synced from HeyGen)
    if (allAvatars) {
      query = query.in('source', ['user_photo', 'ai_generated'])
    } else {
      // Only get untrained avatars
      const untrainedStatuses = ['generating', 'training', 'pending']
      query = query.in('status', untrainedStatuses)
    }

    const { data: avatars, error } = await query

    if (error) {
      console.error('[Test Fixtures] Failed to query avatars:', error)
      throw error
    }

    if (!avatars || avatars.length === 0) {
      console.log(`[Test Fixtures] No avatars found in database (allAvatars=${allAvatars})`)
      return { saved: 0, total: 0, byStatus: {} }
    }

    const byStatus: Record<string, number> = {}
    let savedCount = 0
    
    for (const avatar of avatars) {
      // Track status distribution
      const status = avatar.status || 'unknown'
      byStatus[status] = (byStatus[status] || 0) + 1

      // Check if already saved
      const existing = getUntrainedAvatarFromTest(avatar.id)
      if (!existing) {
        // Use forceSave=true if allAvatars is true, so we save regardless of status
        saveUntrainedAvatarToTest(avatar as any, null, allAvatars)
        savedCount++
      }
    }

    console.log(`[Test Fixtures] Synced ${savedCount} new avatars from database (${avatars.length} total found)`, {
      byStatus,
      allAvatars,
    })
    
    return { saved: savedCount, total: avatars.length, byStatus }
  } catch (error: any) {
    console.error('[Test Fixtures] Failed to sync avatars from database:', error.message)
    throw error
  }
}

