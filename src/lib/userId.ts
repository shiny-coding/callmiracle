export function getUserId(): string {
  if (typeof window === 'undefined') return ''
  
  let userId = localStorage.getItem('userId')
  if (!userId) {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      userId = crypto.randomUUID()
    } else {
      // Fallback to a less secure method if crypto.randomUUID is not available
      userId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }
    localStorage.setItem('userId', userId)
  }
  return userId
} 