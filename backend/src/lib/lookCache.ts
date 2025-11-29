/**
 * Look Cache - In-memory caching for avatar looks
 * Can be replaced with Redis in production
 */

interface CachedLook {
  looks: any[]
  timestamp: number
  avatarId: string
}

class LookCache {
  private cache = new Map<string, CachedLook>()
  private readonly TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get looks for an avatar
   */
  get(avatarId: string): any[] | null {
    const cached = this.cache.get(avatarId)
    if (!cached) {
      return null
    }

    // Check if expired
    if (Date.now() - cached.timestamp > this.TTL) {
      this.cache.delete(avatarId)
      return null
    }

    return cached.looks
  }

  /**
   * Set looks for an avatar
   */
  set(avatarId: string, looks: any[]): void {
    this.cache.set(avatarId, {
      looks,
      timestamp: Date.now(),
      avatarId,
    })
  }

  /**
   * Invalidate cache for an avatar
   */
  invalidate(avatarId: string): void {
    this.cache.delete(avatarId)
  }

  /**
   * Invalidate all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.TTL) {
        this.cache.delete(key)
      }
    }
  }
}

// Singleton instance
export const lookCache = new LookCache()

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    lookCache.cleanup()
  }, 10 * 60 * 1000)
}

