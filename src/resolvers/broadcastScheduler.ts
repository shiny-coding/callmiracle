import { BroadcastType } from '@/generated/graphql'
import { broadcastConfig } from '@/config'
import { getLogger } from '@/utils/logger'
import { publishSubscriptionEvent } from '@/utils/pubsubHelper'

/**
 * Server-side broadcast batching mechanism
 *
 * Batches multiple broadcast events within a configured time window to reduce
 * thundering herd problem where all clients refetch simultaneously.
 *
 * Usage:
 *   scheduleBroadcast(BroadcastType.MeetingUpdated)
 *
 * Instead of immediately broadcasting to all clients, this schedules a broadcast
 * to occur after BROADCAST_BATCH_INTERVAL_MS. If multiple broadcasts are requested
 * within that window, only one broadcast will be sent.
 */

// Track scheduled broadcasts per type
const scheduledBroadcasts = new Map<BroadcastType, NodeJS.Timeout>()

/**
 * Schedule a broadcast event with batching
 *
 * If batching is disabled (batchIntervalMs = 0), broadcasts immediately.
 * Otherwise, schedules a broadcast to occur after the configured interval.
 * Multiple calls within the interval will be collapsed into a single broadcast.
 *
 * @param broadcastType - The type of broadcast event to send
 */
export async function scheduleBroadcast(broadcastType: BroadcastType): Promise<void> {
  const logger = await getLogger()
  const { batchIntervalMs } = broadcastConfig

  // If batching is disabled, publish immediately
  if (batchIntervalMs === 0) {
    logger.debug('Broadcasting immediately (batching disabled)', { broadcastType })
    await publishBroadcastEventNow(broadcastType)
    return
  }

  // Check if broadcast is already scheduled
  if (scheduledBroadcasts.has(broadcastType)) {
    logger.debug('Broadcast already scheduled, skipping duplicate', {
      broadcastType,
      batchIntervalMs
    })
    return
  }

  // Schedule the broadcast
  logger.debug('Scheduling broadcast', {
    broadcastType,
    batchIntervalMs
  })

  const timeoutId = setTimeout(async () => {
    scheduledBroadcasts.delete(broadcastType)
    await publishBroadcastEventNow(broadcastType)
  }, batchIntervalMs)

  scheduledBroadcasts.set(broadcastType, timeoutId)
}

/**
 * Internal function to actually publish the broadcast event
 * This is the same as the original publishBroadcastEvent
 */
async function publishBroadcastEventNow(broadcastType: BroadcastType): Promise<void> {
  const logger = await getLogger()
  const topic = `SUBSCRIPTION_EVENT:ALL`

  publishSubscriptionEvent(topic, {
    broadcastEvent: { type: broadcastType },
    logger
  })

  logger.info('Publishing broadcast event for all users', {
    broadcastType,
    topic,
    batchIntervalMs: broadcastConfig.batchIntervalMs
  })
}

/**
 * Cancel all scheduled broadcasts (useful for testing or shutdown)
 */
export function cancelAllScheduledBroadcasts(): void {
  for (const [type, timeoutId] of scheduledBroadcasts.entries()) {
    clearTimeout(timeoutId)
  }
  scheduledBroadcasts.clear()
}
