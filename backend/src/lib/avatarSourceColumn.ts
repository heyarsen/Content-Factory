const MISSING_SOURCE_COLUMN_CODE = 'PGRST204'
const SOURCE_COLUMN_PATTERN = /'source'\s+column/i

let avatarSourceColumnEnabled = true

const isMissingSourceColumnError = (error: any): boolean => {
  if (!error) return false
  const message = typeof error.message === 'string' ? error.message : ''
  return error.code === MISSING_SOURCE_COLUMN_CODE && SOURCE_COLUMN_PATTERN.test(message)
}

export type AvatarSource = 'synced' | 'user_photo' | 'ai_generated'

export function assignAvatarSource<T extends Record<string, any>>(payload: T, source: AvatarSource): T {
  if (avatarSourceColumnEnabled) {
    payload.source = source
  } else {
    delete payload.source
  }
  return payload
}

export async function executeWithAvatarSourceFallback<T>(
  payload: Record<string, any>,
  executor: () => Promise<{ data: T; error: any }>
): Promise<{ data: T; error: any }> {
  const result = await executor()

  if (
    avatarSourceColumnEnabled &&
    result.error &&
    isMissingSourceColumnError(result.error)
  ) {
    avatarSourceColumnEnabled = false
    delete payload.source
    return executor()
  }

  return result
}

