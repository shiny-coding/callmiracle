/**
 * Tracks active GraphQL subscriptions per user and their current page
 * Used to determine if a user is actively connected to the app
 * and on a specific page (e.g., conversations)
 */

interface UserSubscriptionInfo {
  count: number
  currentPage?: string
}

// Use global to ensure true singleton across webpack bundles
const globalKey = Symbol.for('callmiracle.activeSubscriptions.v2')

function getActiveSubscriptionsMap(): Map<string, UserSubscriptionInfo> {
  if (!(global as any)[globalKey]) {
    (global as any)[globalKey] = new Map<string, UserSubscriptionInfo>()
  }
  return (global as any)[globalKey]
}

/**
 * Increment active subscription count for a user
 */
export function addActiveSubscription(userId: string): void {
  const map = getActiveSubscriptionsMap()
  const current = map.get(userId)
  if (current && typeof current === 'object') {
    current.count++
  } else {
    map.set(userId, { count: 1 })
  }
}

/**
 * Decrement active subscription count for a user
 */
export function removeActiveSubscription(userId: string): void {
  const map = getActiveSubscriptionsMap()
  const current = map.get(userId)
  if (!current || typeof current !== 'object') {
    map.delete(userId)
    return
  }

  if (current.count <= 1) {
    map.delete(userId)
  } else {
    current.count--
  }
}

/**
 * Update the current page for a user
 */
export function setUserCurrentPage(userId: string, page: string): void {
  const map = getActiveSubscriptionsMap()
  const current = map.get(userId)
  if (current) {
    current.currentPage = page
  }
}

/**
 * Check if a user has any active subscriptions
 */
export function hasActiveSubscription(userId: string): boolean {
  const map = getActiveSubscriptionsMap()
  return (map.get(userId)?.count || 0) > 0
}

/**
 * Check if a user is on a specific page
 */
export function isUserOnPage(userId: string, page: string): boolean {
  const map = getActiveSubscriptionsMap()
  const info = map.get(userId)
  return info?.currentPage?.includes(page) || false
}

/**
 * Check if user is active and on the conversations page
 */
export function isUserOnConversationsPage(userId: string): boolean {
  return hasActiveSubscription(userId) && isUserOnPage(userId, '/conversations')
}

/**
 * Get the count of active subscriptions for a user
 */
export function getActiveSubscriptionCount(userId: string): number {
  const map = getActiveSubscriptionsMap()
  return map.get(userId)?.count || 0
}
