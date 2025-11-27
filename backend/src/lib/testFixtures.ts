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
 * Save an untrained avatar to test fixtures
 * Untrained avatars are those with status 'generating', 'training', or 'pending'
 */
export function saveUntrainedAvatarToTest(avatar: Avatar, requestData?: any): void {
  try {
    ensureTestFixturesDir()

    // Only save untrained avatars
    const untrainedStatuses = ['generating', 'training', 'pending']
    if (!untrainedStatuses.includes(avatar.status)) {
      console.log(`[Test Fixtures] Skipping avatar ${avatar.id} - status is '${avatar.status}', not untrained`)
      return
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
 * Sync existing untrained avatars from database to test fixtures
 */
export async function syncUntrainedAvatarsFromDatabase(userId: string): Promise<number> {
  try {
    const { supabase } = await import('../lib/supabase.js')
    const untrainedStatuses = ['generating', 'training', 'pending']

    // Get all untrained avatars for this user
    const { data: avatars, error } = await supabase
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .in('status', untrainedStatuses)

    if (error) {
      console.error('[Test Fixtures] Failed to query untrained avatars:', error)
      throw error
    }

    if (!avatars || avatars.length === 0) {
      console.log('[Test Fixtures] No untrained avatars found in database')
      return 0
    }

    let savedCount = 0
    for (const avatar of avatars) {
      // Check if already saved
      const existing = getUntrainedAvatarFromTest(avatar.id)
      if (!existing) {
        saveUntrainedAvatarToTest(avatar as any)
        savedCount++
      }
    }

    console.log(`[Test Fixtures] Synced ${savedCount} new untrained avatars from database (${avatars.length} total found)`)
    return savedCount
  } catch (error: any) {
    console.error('[Test Fixtures] Failed to sync untrained avatars from database:', error.message)
    throw error
  }
}

