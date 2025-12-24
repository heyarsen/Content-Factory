import type {
  PostgrestBuilder,
  PostgrestSingleResponse,
} from '@supabase/postgrest-js'

const MISSING_COLUMN_PATTERN = /column\s+'([^']+)'\s+of\s+relation\s+'([^']+)'\s+does\s+not\s+exist|Could\s+not\s+find\s+the\s+'([^']+)'\s+column/i

let enabledColumns: Record<string, boolean> = {
  source: true,
  age: true,
  ethnicity: true,
}

const getMissingColumn = (error: any): string | null => {
  if (!error) return null
  const message = typeof error.message === 'string' ? error.message : ''
  const match = message.match(MISSING_COLUMN_PATTERN)
  if (match) {
    return match[1] || match[3]
  }
  return null
}

export type AvatarSource = 'synced' | 'user_photo' | 'ai_generated'

export function assignAvatarSource(payload: Record<string, any>, source: AvatarSource): void {
  if (enabledColumns.source) {
    payload.source = source
  } else {
    delete payload.source
  }
}

export function isAvatarSourceColumnEnabled(): boolean {
  return enabledColumns.source
}

export async function executeWithAvatarSourceFallback<T>(
  payload: Record<string, any>,
  executor: () => PostgrestBuilder<
    Record<string, any>,
    PostgrestSingleResponse<T>,
    false
  >
): Promise<PostgrestSingleResponse<T>> {
  const executeOnce = (): PromiseLike<PostgrestSingleResponse<T>> =>
    executor().then((response) => response as PostgrestSingleResponse<T>)

  const result = await executeOnce()

  if (result.error) {
    const missingColumn = getMissingColumn(result.error)
    if (missingColumn && enabledColumns[missingColumn] !== undefined) {
      console.warn(`[Supabase Fallback] Column '${missingColumn}' is missing from database. Disabling it for this session.`)
      enabledColumns[missingColumn] = false
      delete payload[missingColumn]
      return executeOnce()
    }
  }

  return result
}

