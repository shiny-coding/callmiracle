// Simple in-memory cache for user context during request lifecycle
const userContextCache = new Map<string, { userId: string; timestamp: number }>()

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000

export function setUserContextForRequest(requestId: string, userId: string) {
  userContextCache.set(requestId, {
    userId,
    timestamp: Date.now()
  })
}

export function getUserContextForRequest(requestId: string): string | null {
  const cached = userContextCache.get(requestId)
  
  if (!cached) return null
  
  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    userContextCache.delete(requestId)
    return null
  }
  
  return cached.userId
}

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of userContextCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      userContextCache.delete(key)
    }
  }
}, CACHE_TTL)