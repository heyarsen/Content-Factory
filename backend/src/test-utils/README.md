# Avatar Test Utilities

This directory contains utilities for testing avatar creation and management, specifically designed to save and reuse untrained avatars during testing to avoid repeatedly generating new avatars.

## Overview

When testing avatar creation, you often need to create untrained avatars. However, creating new avatars via the HeyGen API repeatedly can be:
- Slow (API calls take time)
- Expensive (API usage costs)
- Unnecessary (for testing purposes, you often just need an avatar with a specific status)

The avatar test utilities solve this by:
1. **Saving** untrained avatar data to a fixture file (`backend/test-fixtures/untrained-avatars.json`)
2. **Reusing** saved avatars instead of creating new ones
3. **Managing** saved avatars (list, find, clear)

## Usage

### Basic Usage: Get or Create Test Avatar

The main function you'll use is `getOrCreateTestAvatar()`. It will:
- Check if a saved avatar with the same name exists
- If found, try to reuse it from the database
- If not found, create a new avatar and save it to fixtures

```typescript
import { getOrCreateTestAvatar } from './test-utils/avatarTestUtils.js'

const avatar = await getOrCreateTestAvatar(
  userId,
  photoUrl,
  'My Test Avatar',
  [], // additional photo URLs
  true // reuse existing (default: true)
)
```

### Example: First Run vs Subsequent Runs

**First run** (creates new avatar):
```typescript
const avatar1 = await getOrCreateTestAvatar(
  'user-123',
  'https://example.com/photo.jpg',
  'Test Avatar'
)
// ✅ Creates new avatar via HeyGen API
// ✅ Saves avatar data to test-fixtures/untrained-avatars.json
```

**Second run** (reuses saved avatar):
```typescript
const avatar2 = await getOrCreateTestAvatar(
  'user-123',
  'https://example.com/photo.jpg',
  'Test Avatar'
)
// ♻️  Finds saved avatar in fixtures
// ✅ Reuses existing avatar from database (if exists)
// ⚡ No new API call to HeyGen!
```

### Force Create New Avatar

If you want to always create a new avatar (don't reuse):

```typescript
const avatar = await getOrCreateTestAvatar(
  userId,
  photoUrl,
  'New Avatar',
  [],
  false // Don't reuse, always create new
)
```

### List All Saved Avatars

```typescript
import { listUntrainedAvatars } from './test-utils/avatarTestUtils.js'

const avatars = await listUntrainedAvatars()
console.log(`Found ${avatars.length} saved avatars`)
avatars.forEach(avatar => {
  console.log(`- ${avatar.avatar_name} (${avatar.heygen_avatar_id})`)
})
```

### Find Specific Avatar

```typescript
import { findUntrainedAvatar } from './test-utils/avatarTestUtils.js'

const avatar = await findUntrainedAvatar('Test Avatar')
// or
const avatar = await findUntrainedAvatar('heygen-avatar-id-123')
```

### Save Avatar Manually

If you create an avatar outside of `getOrCreateTestAvatar()`, you can save it manually:

```typescript
import { saveUntrainedAvatar } from './test-utils/avatarTestUtils.js'
import { AvatarService } from '../services/avatarService.js'

const avatar = await AvatarService.createAvatarFromPhoto(
  userId,
  photoUrl,
  'My Avatar'
)

await saveUntrainedAvatar(avatar, photoUrl, [])
```

### Clear Saved Avatars

```typescript
import { clearUntrainedAvatars } from './test-utils/avatarTestUtils.js'

await clearUntrainedAvatars()
```

### Remove Specific Avatar

```typescript
import { removeUntrainedAvatar } from './test-utils/avatarTestUtils.js'

await removeUntrainedAvatar('Test Avatar')
// or
await removeUntrainedAvatar('heygen-avatar-id-123')
```

## Fixture File Structure

The fixture file is located at: `backend/test-fixtures/untrained-avatars.json`

Each saved avatar has the following structure:

```json
{
  "id": "database-uuid",
  "heygen_avatar_id": "heygen-group-id",
  "avatar_name": "Test Avatar",
  "photo_url": "https://example.com/photo.jpg",
  "additional_photo_urls": [],
  "status": "training",
  "user_id": "user-uuid",
  "created_at": "2024-01-01T00:00:00.000Z",
  "saved_at": "2024-01-01T00:00:00.000Z"
}
```

## Integration with Tests

### Example Test File

```typescript
import { getOrCreateTestAvatar } from '../test-utils/avatarTestUtils.js'

describe('Avatar Service Tests', () => {
  it('should create or reuse test avatar', async () => {
    const avatar = await getOrCreateTestAvatar(
      'test-user-id',
      'https://example.com/test-photo.jpg',
      'Test Avatar'
    )
    
    expect(avatar).toBeDefined()
    expect(avatar.avatar_name).toBe('Test Avatar')
    expect(avatar.status).toBe('training')
  })
})
```

## Benefits

1. **Faster Tests**: Reusing saved avatars avoids API calls
2. **Cost Savings**: Reduces HeyGen API usage during testing
3. **Consistency**: Same avatar data across test runs
4. **Flexibility**: Can still force new avatar creation when needed

## Notes

- The fixture file is stored in `backend/test-fixtures/untrained-avatars.json`
- Saved avatars are matched by name, `heygen_avatar_id`, or database `id`
- The utility checks the database first before creating a new avatar
- If an avatar exists in the database with the same `heygen_avatar_id`, it will be reused

## Troubleshooting

**Avatar not being reused?**
- Check that the avatar name matches exactly (case-insensitive)
- Verify the fixture file exists and contains the avatar
- Check database to see if avatar exists for the user

**Want to force a fresh avatar?**
- Set `reuseExisting: false` in `getOrCreateTestAvatar()`
- Or delete the specific avatar from fixtures using `removeUntrainedAvatar()`

**Fixture file corrupted?**
- Delete `backend/test-fixtures/untrained-avatars.json`
- It will be recreated automatically with an empty array

