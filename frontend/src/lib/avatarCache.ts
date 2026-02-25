import api from './api'

export type CachedAvatarRecord = Record<string, unknown>

type AvatarCachePayload = {
  publicAvatars: CachedAvatarRecord[]
  myAvatars: CachedAvatarRecord[]
  updatedAt: number
}

const CACHE_KEY = 'avatars-cache-v1'
const CACHE_TTL_MS = 2 * 60 * 1000

export function readAvatarCache(): AvatarCachePayload | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AvatarCachePayload

    if (!parsed?.updatedAt || Date.now() - parsed.updatedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY)
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export function writeAvatarCache(payload: Omit<AvatarCachePayload, 'updatedAt'>): void {
  if (typeof window === 'undefined') return

  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      ...payload,
      updatedAt: Date.now(),
    })
  )
}

export async function preloadAvatarCache(): Promise<void> {
  if (readAvatarCache()) return

  const [publicResponse, myResponse] = await Promise.all([
    api.get('/api/avatars?public=true'),
    api.get('/api/avatars'),
  ])

  writeAvatarCache({
    publicAvatars: publicResponse.data?.avatars ?? [],
    myAvatars: myResponse.data?.avatars ?? [],
  })
}
