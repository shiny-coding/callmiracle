export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  // Less than a minute
  if (diff < 60 * 1000) {
    return 'just now'
  }
  
  // Minutes
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes}m ago`
  }
  
  // Hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}h ago`
  }
  
  // Days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return `${days}d ago`
  }
  
  // Fallback to date
  const date = new Date(timestamp)
  return date.toLocaleDateString()
} 