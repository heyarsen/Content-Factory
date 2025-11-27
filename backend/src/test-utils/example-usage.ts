/**
 * Example usage of avatar test utilities
 * 
 * This file demonstrates how to use the avatar test utilities to save and reuse
 * untrained avatars during testing, avoiding the need to generate new avatars
 * repeatedly.
 */

import {
  getOrCreateTestAvatar,
  listUntrainedAvatars,
  findUntrainedAvatar,
  clearUntrainedAvatars,
} from './avatarTestUtils.js'

/**
 * Example: Create or reuse a test avatar
 */
export async function exampleCreateOrReuseAvatar() {
  const userId = 'test-user-id'
  const photoUrl = 'https://example.com/test-photo.jpg'
  const avatarName = 'Test Avatar'

  // This will:
  // 1. Check if a saved avatar with name "Test Avatar" exists
  // 2. If found, try to reuse it from the database
  // 3. If not found, create a new avatar and save it to fixtures
  const avatar = await getOrCreateTestAvatar(
    userId,
    photoUrl,
    avatarName,
    [], // additional photo URLs
    true // reuse existing (default)
  )

  console.log('Avatar:', avatar)
  return avatar
}

/**
 * Example: List all saved untrained avatars
 */
export async function exampleListSavedAvatars() {
  const avatars = await listUntrainedAvatars()
  console.log(`Found ${avatars.length} saved untrained avatars:`)
  avatars.forEach(avatar => {
    console.log(`- ${avatar.avatar_name} (${avatar.heygen_avatar_id}) - Status: ${avatar.status}`)
  })
  return avatars
}

/**
 * Example: Find a specific saved avatar
 */
export async function exampleFindAvatar() {
  const avatar = await findUntrainedAvatar('Test Avatar')
  if (avatar) {
    console.log('Found avatar:', avatar)
  } else {
    console.log('Avatar not found')
  }
  return avatar
}

/**
 * Example: Force create a new avatar (don't reuse)
 */
export async function exampleForceCreateNew() {
  const userId = 'test-user-id'
  const photoUrl = 'https://example.com/test-photo-2.jpg'
  const avatarName = 'New Test Avatar'

  // Set reuseExisting to false to always create new
  const avatar = await getOrCreateTestAvatar(
    userId,
    photoUrl,
    avatarName,
    [],
    false // Don't reuse, always create new
  )

  console.log('New avatar created:', avatar)
  return avatar
}

/**
 * Example: Clear all saved avatars (useful for cleanup)
 */
export async function exampleClearAvatars() {
  await clearUntrainedAvatars()
  console.log('All saved avatars cleared')
}

// Example usage in a test scenario:
/*
async function testScenario() {
  // First run: Creates new avatar and saves it
  const avatar1 = await getOrCreateTestAvatar(
    'user-123',
    'https://example.com/photo.jpg',
    'My Test Avatar'
  )
  
  // Second run: Reuses the saved avatar (no new API call to HeyGen)
  const avatar2 = await getOrCreateTestAvatar(
    'user-123',
    'https://example.com/photo.jpg',
    'My Test Avatar'
  )
  
  // avatar1 and avatar2 should be the same (or avatar2 should be from database)
}
*/

