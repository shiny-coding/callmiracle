/**
 * Optimized SSE Implementation for GraphQL Subscriptions
 * Based on GraphQL Yoga documentation: https://the-guild.dev/graphql/yoga-server/docs/features/subscriptions
 *
 * Key optimizations:
 * - Immediate event flushing (no 320ms buffering)
 * - Custom event stream handling
 * - Reduced overhead in subscription processing
 * - Direct stream management without buffering
 */

import { subscriptionsConfig } from '@/config'
import type { ExecutionResult } from 'graphql'
import {
  activeSubscriptionsMetric,
  subscriptionDurationHistogram
} from '@/utils/metrics'

interface SSEEvent {
  id?: string
  event?: string
  data: string
}

/**
 * Creates an optimized SSE response that bypasses GraphQL Yoga's buffering
 */
export function createOptimizedSSEResponse(
  subscription: AsyncIterable<any>,
  request: Request,
  logger: any
): Response {
  logger.info('Creating OPTIMIZED SSE response with immediate flushing')

  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array>
  let eventId = 0
  let heartbeatInterval: NodeJS.Timeout | undefined
  let isClosed = false
  const subscriptionStartTime = Date.now()

  // Track subscription metrics
  activeSubscriptionsMetric.add(1)

  const stream = new ReadableStream<Uint8Array>({
    start(controllerArg) {
      controller = controllerArg

      // Setup heartbeat to keep connection alive
      // Why needed:
      // - Prevents proxy/load balancer timeouts (nginx: 60s, AWS ALB: 60s)
      // - Detects dead connections (crashed clients, network failures)
      // - Critical for call signaling during idle periods
      // Uses SSE comments (lighter than events, invisible to client)
      if (subscriptionsConfig.sse.heartbeatInterval > 0) {
        heartbeatInterval = setInterval(() => {
          if (!isClosed) {
            try {
              // Send SSE comment - keeps connection alive without client-side processing
              controller.enqueue(encoder.encode(': heartbeat\n\n'))
            } catch (error) {
              logger.error('Heartbeat send error', { error })
              isClosed = true
            }
          }
        }, subscriptionsConfig.sse.heartbeatInterval)
      }

      // Process subscription with immediate delivery
      processSubscriptionOptimized(subscription)
        .then(() => {
          sendSSEEvent({
            event: 'complete',
            data: JSON.stringify({ type: 'complete' }),
            id: String(++eventId)
          })
          closeStream()
        })
        .catch((error) => {
          logger.error('SSE subscription error', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            errorType: error.constructor.name
          })

          sendSSEEvent({
            event: 'error',
            data: JSON.stringify({
              type: 'error',
              message: error.message,
              timestamp: Date.now()
            }),
            id: String(++eventId)
          })
          closeStream(error)
        })
        .finally(() => {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval)
          }
        })
    },

    cancel() {
      closeStream()
      logger.info('Optimized SSE connection cancelled')
    }
  })

  /**
   * Close the stream safely
   */
  function closeStream(error?: Error): void {
    if (isClosed) return

    isClosed = true

    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
    }

    // Track subscription metrics
    const subscriptionDuration = (Date.now() - subscriptionStartTime) / 1000
    activeSubscriptionsMetric.add(-1) // Decrement active count
    subscriptionDurationHistogram.record(subscriptionDuration)

    if (error) {
      logger.info('Subscription closed with error', {
        duration: subscriptionDuration,
        error: error.message
      })
    } else {
      logger.info('Subscription closed cleanly', {
        duration: subscriptionDuration
      })
    }

    try {
      if (error) {
        controller.error(error)
      } else {
        controller.close()
      }
    } catch (e) {
      // Stream already closed, ignore
      logger.debug('Stream already closed', { error: e })
    }
  }

  /**
   * Send SSE event with IMMEDIATE flushing - no buffering
   */
  function sendSSEEvent(event: SSEEvent): void {
    // Don't send if stream is closed
    if (isClosed) {
      logger.debug('Skipping event - stream is closed', { eventType: event.event })
      return
    }

    try {
      let sseData = ''

      if (event.id) {
        sseData += `id: ${event.id}\n`
      }

      if (event.event) {
        sseData += `event: ${event.event}\n`
      }

      // Handle multiline data
      const dataLines = event.data.split('\n')
      for (const line of dataLines) {
        sseData += `data: ${line}\n`
      }

      sseData += '\n' // End of event marker

      // IMMEDIATE FLUSH - no buffering delay
      const chunk = encoder.encode(sseData)
      controller.enqueue(chunk)

      // Log event delivery
      if (event.event === 'next') {
        logger.debug('Optimized SSE: Event flushed immediately', { eventId: event.id })
      }
    } catch (error) {
      logger.error('Error sending optimized SSE event', { error })
      // Mark as closed if we get an error
      isClosed = true
    }
  }

  /**
   * Process subscription with optimized handling - no buffering
   * CRITICAL: Properly cleanup async iterator to prevent memory leaks
   */
  async function processSubscriptionOptimized(asyncIterable: AsyncIterable<any>): Promise<void> {
    // Get the iterator directly so we can call cleanup methods
    const iterator = asyncIterable[Symbol.asyncIterator]()

    try {
      while (true) {
        // Check if stream is still open BEFORE getting next value
        if (isClosed) {
          logger.debug('Stream closed, stopping subscription processing')
          break
        }

        // Get next value from iterator
        const { value, done } = await iterator.next()

        if (done) {
          logger.debug('Subscription iterator completed naturally')
          break
        }

        // Send result IMMEDIATELY - zero buffering
        sendSSEEvent({
          event: 'next',
          data: JSON.stringify(value),
          id: String(++eventId)
        })

        // Optional minimal delay only if explicitly configured
        if (subscriptionsConfig.sse.bufferInterval > 0) {
          await new Promise(resolve => setTimeout(resolve, subscriptionsConfig.sse.bufferInterval))
        }
      }
    } catch (error) {
      // Error logging handled by caller's catch block
      throw error
    } finally {
      // CRITICAL: Cleanup iterator and remove EventEmitter listeners
      // This prevents the "MaxListenersExceededWarning" memory leak
      if (iterator.return) {
        try {
          await iterator.return()
          logger.debug('Subscription iterator cleaned up successfully')
        } catch (cleanupError) {
          logger.warn('Error during iterator cleanup', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          })
        }
      }
    }
  }

  // Return optimized response with performance headers
  return new Response(stream, {
    status: 200,
    headers: createOptimizedSSEHeaders()
  })
}

/**
 * Enhanced subscription executor with optimized async iterator handling
 */
export class OptimizedSubscriptionExecutor {
  private eventBuffer: ExecutionResult[] = []
  private bufferTimeout: NodeJS.Timeout | null = null

  constructor(
    private sendEvent: (event: SSEEvent) => void,
    private eventId: { current: number }
  ) {}

  async processResult(result: ExecutionResult): Promise<void> {
    if (subscriptionsConfig.sse.immediateFlush) {
      // Send immediately - no buffering
      this.sendEvent({
        event: 'next',
        data: JSON.stringify(result),
        id: String(++this.eventId.current)
      })
    } else {
      // Use minimal buffering if configured
      this.eventBuffer.push(result)
      
      if (this.eventBuffer.length >= subscriptionsConfig.sse.maxBufferSize) {
        this.flushBuffer()
      } else if (!this.bufferTimeout && subscriptionsConfig.sse.bufferInterval > 0) {
        this.bufferTimeout = setTimeout(() => {
          this.flushBuffer()
        }, subscriptionsConfig.sse.bufferInterval)
      }
    }
  }

  private flushBuffer(): void {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout)
      this.bufferTimeout = null
    }

    while (this.eventBuffer.length > 0) {
      const result = this.eventBuffer.shift()
      if (result) {
        this.sendEvent({
          event: 'next',
          data: JSON.stringify(result),
          id: String(++this.eventId.current)
        })
      }
    }
  }

  cleanup(): void {
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout)
      this.bufferTimeout = null
    }
    this.eventBuffer = []
  }
}

/**
 * Utility to create optimized SSE headers
 */
function createOptimizedSSEHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
  }
}