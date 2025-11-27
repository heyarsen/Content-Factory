import { promises as fs } from 'fs'
import path from 'path'
import { AvatarService, type Avatar } from '../services/avatarService.js'

/**
 * Test fixture for storing untrained avatar data
 */
export interface UntrainedAvatarFixture {
  id: string
  heygen_avatar_id: string
  avatar_name: string
  photo_url: string
  additional_photo_urls: string[]
  status: string
  user_id?: string
  created_at: string
  saved_at: string
}

/**
 * Get the path to the test fixtures directory
 */
function getFixturesDir(): string {
  const projectRoot = path.resolve(__dirname, '../../..')
  return path.join(projectRoot, 'backend', 'test-fixtures')
}

/**
 * Get the path to the untrained avatars fixture file
 */
function getUntrainedAvatarsPath(): string {
  return path.join(getFixturesDir(), 'untrained-avatars.json')
}

/**
 * Ensure the fixtures directory exists
 */
async function ensureFixturesDir(): Promise<void> {
  const fixturesDir = getFixturesDir()
  try {
    await fs.access(fixturesDir)
  } catch {
    await fs.mkdir(fixturesDir, { recursive: true })
  }
}

/**
 * Load all saved untrained avatars from the fixture file
 */
export async function loadUntrainedAvatars(): Promise<UntrainedAvatarFixture[]> {
  try {
    await ensureFixturesDir()
    const filePath = getUntrainedAvatarsPath()
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const data = JSON.parse(content)
      return Array.isArray(data) ? data : []
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty array
        return []
      }
      throw error
    }
  } catch (error: any) {
    console.error('Error loading untrained avatars:', error.message)
    return []
  }
}

/**
 * Save an untrained avatar to the fixture file
 */
export async function saveUntrainedAvatar(avatar: Avatar, photoUrl: string, additionalPhotoUrls: string[] = []): Promise<void> {
  try {
    await ensureFixturesDir()
    const avatars = await loadUntrainedAvatars()
    
    const fixture: UntrainedAvatarFixture = {
      id: avatar.id,
      heygen_avatar_id: avatar.heygen_avatar_id,
      avatar_name: avatar.avatar_name,
      photo_url: photoUrl,
      additional_photo_urls: additionalPhotoUrls,
      status: avatar.status,
      user_id: avatar.user_id,
      created_at: avatar.created_at,
      saved_at: new Date().toISOString(),
    }
    
    // Check if avatar with same heygen_avatar_id already exists
    const existingIndex = avatars.findIndex(a => a.heygen_avatar_id === avatar.heygen_avatar_id)
    if (existingIndex >= 0) {
      avatars[existingIndex] = fixture
    } else {
      avatars.push(fixture)
    }
    
    const filePath = getUntrainedAvatarsPath()
    await fs.writeFile(filePath, JSON.stringify(avatars, null, 2), 'utf-8')
    
    console.log(`✅ Saved untrained avatar to fixture: ${avatar.avatar_name} (${avatar.heygen_avatar_id})`)
  } catch (error: any) {
    console.error('Error saving untrained avatar:', error.message)
    throw error
  }
}

/**
 * Find a saved untrained avatar by name or heygen_avatar_id
 */
export async function findUntrainedAvatar(
  searchTerm: string
): Promise<UntrainedAvatarFixture | null> {
  const avatars = await loadUntrainedAvatars()
  
  return (
    avatars.find(
      a =>
        a.avatar_name.toLowerCase() === searchTerm.toLowerCase() ||
        a.heygen_avatar_id === searchTerm ||
        a.id === searchTerm
    ) || null
  )
}

/**
 * Get or create a test avatar. If a saved avatar exists, it will be reused.
 * Otherwise, a new avatar will be created and saved.
 * 
 * @param userId - User ID for the avatar
 * @param photoUrl - URL of the photo to use for avatar creation
 * @param avatarName - Name for the avatar
 * @param additionalPhotoUrls - Optional additional photo URLs
 * @param reuseExisting - If true, will try to find and reuse an existing saved avatar (default: true)
 * @returns The avatar (either reused or newly created)
 */
export async function getOrCreateTestAvatar(
  userId: string,
  photoUrl: string,
  avatarName: string,
  additionalPhotoUrls: string[] = [],
  reuseExisting: boolean = true
): Promise<Avatar> {
  // Try to find existing saved avatar if reuse is enabled
  if (reuseExisting) {
    const saved = await findUntrainedAvatar(avatarName)
    if (saved) {
      console.log(`♻️  Reusing saved untrained avatar: ${saved.avatar_name} (${saved.heygen_avatar_id})`)
      
      // Check if avatar exists in database for this user
      try {
        const existing = await AvatarService.getAvatarById(saved.id, userId)
        if (existing) {
          console.log(`✅ Found existing avatar in database, reusing: ${existing.id}`)
          return existing
        }
      } catch (error) {
        // Avatar not found in database, will create new one
      }
      
      // Try to find by heygen_avatar_id
      try {
        const { supabase } = await import('../lib/supabase.js')
        const { data } = await supabase
          .from('avatars')
          .select('*')
          .eq('user_id', userId)
          .eq('heygen_avatar_id', saved.heygen_avatar_id)
          .single()
        
        if (data) {
          console.log(`✅ Found existing avatar in database by heygen_avatar_id, reusing: ${data.id}`)
          return data as Avatar
        }
      } catch (error) {
        // Not found, will create new
      }
    }
  }
  
  // Create new avatar
  console.log(`🆕 Creating new untrained avatar: ${avatarName}`)
  const avatar = await AvatarService.createAvatarFromPhoto(
    userId,
    photoUrl,
    avatarName,
    additionalPhotoUrls
  )
  
  // Save to fixture for future reuse
  await saveUntrainedAvatar(avatar, photoUrl, additionalPhotoUrls)
  
  return avatar
}

/**
 * List all saved untrained avatars
 */
export async function listUntrainedAvatars(): Promise<UntrainedAvatarFixture[]> {
  return await loadUntrainedAvatars()
}

/**
 * Clear all saved untrained avatars from the fixture file
 */
export async function clearUntrainedAvatars(): Promise<void> {
  try {
    const filePath = getUntrainedAvatarsPath()
    await fs.writeFile(filePath, JSON.stringify([], null, 2), 'utf-8')
    console.log('✅ Cleared all untrained avatars from fixture')
  } catch (error: any) {
    console.error('Error clearing untrained avatars:', error.message)
    throw error
  }
}

/**
 * Remove a specific untrained avatar from the fixture file
 */
export async function removeUntrainedAvatar(searchTerm: string): Promise<boolean> {
  try {
    const avatars = await loadUntrainedAvatars()
    const filtered = avatars.filter(
      a =>
        a.avatar_name.toLowerCase() !== searchTerm.toLowerCase() &&
        a.heygen_avatar_id !== searchTerm &&
        a.id !== searchTerm
    )
    
    if (filtered.length === avatars.length) {
      return false // Avatar not found
    }
    
    const filePath = getUntrainedAvatarsPath()
    await fs.writeFile(filePath, JSON.stringify(filtered, null, 2), 'utf-8')
    console.log(`✅ Removed untrained avatar: ${searchTerm}`)
    return true
  } catch (error: any) {
    console.error('Error removing untrained avatar:', error.message)
    throw error
  }
}

