import { pubsub } from '@/lib/pubsub'
import { SubscriptionEventPayload } from '@/resolvers/subscriptions'

/**
 * Type-safe wrapper for pubsub.publish that ensures logger is always included
 */
export function publishSubscriptionEvent(
  topic: string, 
  payload: SubscriptionEventPayload
): void {
  pubsub.publish(topic, payload)
}