import type {
  PostgrestBuilder,
  PostgrestSingleResponse,
} from '@supabase/postgrest-js'

const MISSING_SOURCE_COLUMN_CODE = 'PGRST204'
const SOURCE_COLUMN_PATTERN = /'source'\s+column/i

let avatarSourceColumnEnabled = true

const isMissingSourceColumnError = (error: any): boolean => {
  if (!error) return false
  const message = typeof error.message === 'string' ? error.message : ''
  return error.code === MISSING_SOURCE_COLUMN_CODE && SOURCE_COLUMN_PATTERN.test(message)
}

export type AvatarSource = 'synced' | 'user_photo' | 'ai_generated'

export function assignAvatarSource(payload: Record<string, any>, source: AvatarSource): void {
  if (avatarSourceColumnEnabled) {
    payload.source = source
  } else {
    delete payload.source
  }
}

export async function executeWithAvatarSourceFallback<T>(
  payload: Record<string, any>,
  executor: () => PostgrestBuilder<
    Record<string, any>,
    PostgrestSingleResponse<T>,
    false
  >
): Promise<PostgrestSingleResponse<T>> {
  const result = await executor()

  if (
    avatarSourceColumnEnabled &&
    result.error &&
    isMissingSourceColumnError(result.error)
  ) {
    avatarSourceColumnEnabled = false
    delete payload.source
    return await executor()
  }

  return result
}

