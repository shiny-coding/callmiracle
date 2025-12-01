/**
 * Tracks active GraphQL subscriptions per user
 * Used to determine if a user is actively connected to the app
 * When a user has active subscriptions, we skip push notifications
 * and rely on real-time events instead
 */

// Use global to ensure true singleton across webpack bundles
const globalKey = Symbol.for('callmiracle.activeSubscriptions')

function getActiveSubscriptionsMap(): Map<string, number> {
  if (!(global as any)[globalKey]) {
    (global as any)[globalKey] = new Map<string, number>()
  }
  return (global as any)[globalKey]
}

/**
 * Increment active subscription count for a user
 */
export function addActiveSubscription(userId: string): void {
  const map = getActiveSubscriptionsMap()
  const current = map.get(userId) || 0
  map.set(userId, current + 1)
}

/**
 * Decrement active subscription count for a user
 */
export function removeActiveSubscription(userId: string): void {
  const map = getActiveSubscriptionsMap()
  const current = map.get(userId) || 0
  if (current <= 1) {
    map.delete(userId)
  } else {
    map.set(userId, current - 1)
  }
}

/**
 * Check if a user has any active subscriptions
 */
export function hasActiveSubscription(userId: string): boolean {
  const map = getActiveSubscriptionsMap()
  return (map.get(userId) || 0) > 0
}

/**
 * Get the count of active subscriptions for a user
 */
export function getActiveSubscriptionCount(userId: string): number {
  const map = getActiveSubscriptionsMap()
  return map.get(userId) || 0
}
