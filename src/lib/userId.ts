export function getUserId(): string {
  if (typeof window === 'undefined') return ''
  
  let userId = localStorage.getItem('userId')
  if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem('userId', userId)
  }
  return userId
} 