# SSE Connection Lifecycle & Stream Management

## Overview

This document explains when and why SSE streams close, server vs client control, and reconnection behavior in CallMiracle.

---

## 1. When Does the Stream Close?

### 1.1 Server-Side Closure Scenarios

The server closes the SSE stream in these cases:

#### A. Normal Completion
```typescript
// sse-optimized.ts:60-67
processSubscriptionOptimized(subscription)
  .then(() => {
    sendSSEEvent({ event: 'complete', data: JSON.stringify({ type: 'complete' }) })
    closeStream()  // ✅ Graceful closure
  })
```

**When it happens:**
- GraphQL subscription completes naturally (rare for long-lived subscriptions)
- PubSub topic is closed
- Server explicitly completes the async iterator

#### B. Error Conditions
```typescript
// sse-optimized.ts:69-80
.catch((error) => {
  console.error('Optimized SSE subscription error:', error)
  sendSSEEvent({ event: 'error', data: JSON.stringify({ type: 'error', message: error.message }) })
  closeStream(error)  // ❌ Error closure
})
```

**When it happens:**
- Database connection lost
- GraphQL resolver throws unhandled error
- PubSub connection fails (Redis disconnection)
- Server-side validation errors

#### C. Client Disconnection Detection
```typescript
// sse-optimized.ts:89-92
cancel() {
  closeStream()
  console.log('🛑 Optimized SSE connection cancelled')
}
```

**When it happens:**
- Client closes the connection (tab close, navigation, manual disconnect)
- Network interruption detected by server
- HTTP connection timeout

#### D. Subscription Processing Errors
```typescript
// sse-optimized.ts:160-164
try {
  controller.enqueue(chunk)
} catch (error) {
  console.error('Error sending optimized SSE event:', error)
  isClosed = true  // Mark as closed on error
}
```

**When it happens:**
- "Controller is already closed" errors (now prevented)
- Stream write failures
- Encoding errors

---

## 2. Can the Server Close the Stream?

**Yes, absolutely!** The server has full control to close the SSE stream at any time.

### Server Closure Mechanisms

#### Explicit Closure
```typescript
// Server can call these at any time:
controller.close()     // Normal closure
controller.error(err)  // Error closure
```

#### Implicit Closure
- Server process termination
- Network socket closure
- HTTP connection timeout
- Load balancer timeout (nginx/cloudflare)

### Current Implementation Protection

```typescript
// sse-optimized.ts:98-117
function closeStream(error?: Error): void {
  if (isClosed) return  // ✅ Idempotent - prevents double-close

  isClosed = true

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)  // ✅ Cleanup
  }

  try {
    if (error) {
      controller.error(error)
    } else {
      controller.close()
    }
  } catch (e) {
    // Stream already closed, ignore  // ✅ Safe
  }
}
```

**Key Protection:** The `isClosed` flag prevents multiple closure attempts that caused the "Controller is already closed" error.

---

## 3. Client-Side Connection Management

### 3.1 EventSource (Browser Native SSE)

**File:** `src/lib/apollo.ts:71-130`

```typescript
const sseLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    let eventSource: EventSource | null = null

    // Create EventSource connection
    eventSource = new EventSource(`/api/graphql?${params.toString()}`, {
      withCredentials: true
    })

    eventSource.onopen = () => {
      console.log(`SSE: Connection opened for ${operationName}`)
    }

    // Listen for data events
    eventSource.addEventListener('next', (event) => {
      const data = JSON.parse(event.data)
      observer.next(data)  // ✅ Deliver to Apollo Client
    })

    // Listen for completion
    eventSource.addEventListener('complete', () => {
      console.log(`SSE: Subscription completed for ${operationName}`)
      observer.complete()
      eventSource?.close()  // ✅ Close on server completion
    })

    // Listen for errors
    eventSource.addEventListener('error', (event) => {
      console.error(`SSE: Error event for ${operationName}:`, event)
      observer.error(event)
    })

    // Cleanup function (called on unsubscribe)
    return () => {
      if (eventSource) {
        console.log(`SSE: Closing connection for ${operationName}`)
        eventSource.close()  // ✅ Clean closure
      }
    }
  })
})
```

### 3.2 Long-Lived Connection Characteristics

**EventSource Behavior:**
- ✅ **Long-lived**: Connection stays open indefinitely
- ✅ **Persistent**: Designed for hours/days of connectivity
- ✅ **Automatic reconnection**: Browser automatically reconnects on failure
- ✅ **Last-Event-ID**: Browser sends last received event ID on reconnect

**From SSE Specification (RFC 6202):**
```
The EventSource API provides a persistent HTTP connection that the server
can use to send events to the client. Connections are automatically
re-established if they are closed unexpectedly.
```

---

## 4. Do We Reopen the Connection?

### 4.1 Automatic Reconnection (Browser Native)

**Yes, EventSource automatically reconnects!**

```typescript
// Browser behavior (automatic):
eventSource.addEventListener('error', (event) => {
  // Browser automatically:
  // 1. Closes the failed connection
  // 2. Waits a few seconds (configurable via 'retry' event)
  // 3. Creates a new EventSource connection
  // 4. Sends Last-Event-ID header if available
})
```

**Reconnection Strategy:**
```
Attempt 1: Immediate
Attempt 2: 3 seconds delay
Attempt 3: 9 seconds delay  (exponential backoff)
Attempt N: Up to ~30 seconds delay
```

**Server-Side Retry Control:**
```typescript
// Server can suggest retry interval (sse-optimized.ts SSEEvent interface)
interface SSEEvent {
  id?: string
  event?: string
  data: string
  retry?: number  // Milliseconds to wait before reconnecting
}

// Example usage:
sendSSEEvent({
  event: 'error',
  data: JSON.stringify({ message: 'Temporary failure' }),
  retry: 5000  // Tell browser to retry in 5 seconds
})
```

### 4.2 Apollo Client Subscription Lifecycle

**File:** `src/contexts/SubscriptionsContext.tsx:83-115`

```typescript
useSubscription(ON_SUBSCRIPTION_EVENT, {
  variables: { userId: currentUser?._id || '' },
  skip: !currentUser?._id,  // ✅ Don't subscribe without user
  onData: ({ data: subscriptionData }) => {
    // Process events
  }
})
```

**Apollo Client Behavior:**
1. **Component Mount**: Creates EventSource connection
2. **Component Unmount**: Calls cleanup function → `eventSource.close()`
3. **Variable Change**: Closes old connection, opens new one with new variables
4. **Skip Toggle**: Opens/closes connection based on `skip` value

### 4.3 Connection Lifecycle Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Logs In                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  SubscriptionsProvider Mounts (currentUser._id available)   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Apollo Client: useSubscription() Called              │
│         skip: false (userId exists)                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│   Apollo sseLink: Creates new EventSource connection        │
│   GET /api/graphql?operationName=OnSubscriptionEvent&...    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Server: handleOptimizedSSE()                      │
│     - Parse query                                            │
│     - Validate                                               │
│     - subscribe() → AsyncIterable                            │
│     - createOptimizedSSEResponse()                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│          Stream Active: Long-Lived Connection                │
│  ┌───────────────────────────────────────────────┐          │
│  │  • Heartbeat every 30 seconds                 │          │
│  │  • Events sent immediately (0ms buffering)    │          │
│  │  • Connection stays open indefinitely         │          │
│  └───────────────────────────────────────────────┘          │
└────────────────────────┬────────────────────────────────────┘
                         │
                    Network Error
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│        Browser: Automatic Reconnection                       │
│  1. EventSource detects connection failure                   │
│  2. Fires 'error' event                                      │
│  3. Waits exponential backoff period                         │
│  4. Creates new EventSource with same URL                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│         Server: New handleOptimizedSSE() Call                │
│         (Fresh subscription, fresh stream)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. When Does the Stream Stay Open Forever?

### 5.1 Expected Behavior

**For CallMiracle's WebRTC use case, the stream SHOULD stay open for the entire user session.**

```typescript
// SubscriptionsContext.tsx - Subscription is active while user is logged in
useSubscription(ON_SUBSCRIPTION_EVENT, {
  variables: { userId: currentUser?._id || '' },
  skip: !currentUser?._id,  // Only close if user logs out
  // ...
})
```

**Lifecycle:**
```
User Login → Subscription Opens → Stays Open → User Logout → Subscription Closes
              ↑                                      ↓
              └──────── Automatic Reconnect ─────────┘
                     (if connection drops)
```

### 5.2 Heartbeat Mechanism

**Purpose:** Keep connection alive and detect dead connections

```typescript
// sse-optimized.ts:48-56
if (sseConfig.optimized.heartbeatInterval > 0) {
  heartbeatInterval = setInterval(() => {
    sendSSEEvent({
      event: 'ping',
      data: JSON.stringify({ type: 'ping', timestamp: Date.now() }),
      id: String(++eventId)
    })
  }, sseConfig.optimized.heartbeatInterval)  // Default: 30000ms (30s)
}
```

**Benefits:**
- ✅ Prevents proxy/load balancer timeout
- ✅ Detects dead connections (if write fails, stream closes)
- ✅ Keeps NAT mappings alive
- ✅ Client can verify server is still responsive

---

## 6. Common Closure Scenarios & Resolutions

### 6.1 Scenario: User Closes Tab

**What Happens:**
```
1. Browser: window.onbeforeunload
2. React: Component cleanup (useEffect return functions)
3. Apollo Client: Subscription cleanup
4. EventSource: close() called
5. Server: ReadableStream cancel() triggered
6. Server: closeStream() called → isClosed = true
```

**Result:** Clean closure, no reconnection needed

### 6.2 Scenario: Network Interruption

**What Happens:**
```
1. Network: TCP connection breaks
2. Browser: EventSource detects failure (no heartbeat received)
3. Browser: Fires 'error' event
4. Browser: Waits backoff period (3s, 9s, 27s...)
5. Browser: Creates new EventSource with same URL
6. Server: New SSE stream created
7. Client: Receives connection_ack event
8. Normal operation resumes
```

**Result:** Automatic reconnection, transparent to user

### 6.3 Scenario: Server Restart/Deploy

**What Happens:**
```
1. Server: Process terminates
2. All SSE streams: Forcibly closed
3. Browser: Detects connection failure
4. Browser: Automatic reconnection attempts
5. Server: New process starts
6. Browser: Successfully reconnects
7. New subscription created with same userId
```

**Result:** Automatic recovery, brief interruption

### 6.4 Scenario: Database Connection Lost

**What Happens:**
```typescript
// Subscription resolver fails
const userTopic = `SUBSCRIPTION_EVENT:${userId}`
pubSub.subscribe(userTopic)  // ❌ Throws error if Redis down

// Error caught in processSubscriptionOptimized
// sse-optimized.ts:191-194
catch (error) {
  console.error('Optimized subscription processing error:', error)
  throw error  // Propagates to .catch() handler
}

// Stream closed with error event
sendSSEEvent({ event: 'error', data: JSON.stringify({ message: 'Database connection lost' }) })
closeStream(error)

// Client receives 'error' event
// Browser automatically reconnects
```

**Result:** Error logged, automatic reconnection attempts

---

## 7. Current Implementation Issues & Solutions

### 7.1 Issue: "Controller is already closed"

**Root Cause:** Events sent after stream closed

**Why It Happened:**
```typescript
// Scenario that caused the error:
1. PubSub sends event → processSubscriptionOptimized() receives it
2. sendSSEEvent() starts encoding event
3. Meanwhile, client disconnects → cancel() called → closeStream()
4. sendSSEEvent() tries controller.enqueue(chunk)
5. ❌ Error: "Controller is already closed"
```

**Solution:** Added `isClosed` flag

```typescript
// sse-optimized.ts:35, 124-127
let isClosed = false

function sendSSEEvent(event: SSEEvent): void {
  if (isClosed) {  // ✅ Guard check
    console.log('Skipping event - stream is closed:', event.event)
    return  // ✅ Safe early exit
  }

  try {
    controller.enqueue(chunk)
  } catch (error) {
    isClosed = true  // ✅ Mark closed on error
  }
}

// Also checks during processing
async function processSubscriptionOptimized(asyncIterable) {
  for await (const result of asyncIterable) {
    if (isClosed) {  // ✅ Check before processing
      console.log('Stream closed, stopping subscription processing')
      break
    }
    sendSSEEvent({ ... })
  }
}
```

**Result:** No more "Controller is already closed" errors ✅

### 7.2 Potential Issue: Orphaned Subscriptions

**Problem:** Server-side subscriptions not cleaning up properly

**Mitigation:**
```typescript
// sse-optimized.ts:82-86
.finally(() => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)  // ✅ Always cleanup
  }
})
```

**Additional Safety:** Heartbeat mechanism detects dead connections
- If `sendSSEEvent()` fails during heartbeat, `isClosed = true` is set
- Subscription processing stops: `if (isClosed) break`

---

## 8. Monitoring & Debugging

### 8.1 Server-Side Logs

**Connection Lifecycle:**
```
🚀 Creating OPTIMIZED SSE response with immediate flushing
⚡ Optimized SSE: Event flushed immediately (id: 2)
⚡ Optimized SSE: Event flushed immediately (id: 3)
🛑 Optimized SSE connection cancelled
```

**Error Scenarios:**
```
Error sending optimized SSE event: TypeError: Invalid state: Controller is already closed
Optimized SSE subscription error: Error: Database connection lost
Stream closed, stopping subscription processing
```

### 8.2 Client-Side Logs

**Connection Lifecycle:**
```
SSE: Connection opened for OnSubscriptionEvent
SSE: Subscription completed for OnSubscriptionEvent
SSE: Closing connection for OnSubscriptionEvent
```

**Error Scenarios:**
```
SSE: Error event for OnSubscriptionEvent: [Event object]
SSE: Closing connection for OnSubscriptionEvent
```

### 8.3 Recommended Monitoring

**Metrics to Track:**
1. **Active SSE Connections**: Count of open streams per server instance
2. **Connection Duration**: How long streams stay open (should be hours/days)
3. **Reconnection Rate**: How often browsers reconnect
4. **Event Delivery Latency**: Time from PubSub publish to client receive
5. **Failed Events**: Count of events skipped due to closed streams

**Implementation Suggestion:**
```typescript
// Add to sse-optimized.ts
let activeConnections = 0
let totalEvents = 0
let skippedEvents = 0

export function getSSEMetrics() {
  return {
    activeConnections,
    totalEvents,
    skippedEvents,
    successRate: (totalEvents - skippedEvents) / totalEvents
  }
}
```

---

## 9. Best Practices

### 9.1 Server-Side

✅ **DO:**
- Always use `isClosed` checks before sending events
- Clean up resources in `.finally()` blocks
- Log connection lifecycle events
- Implement heartbeat mechanism
- Handle PubSub disconnections gracefully

❌ **DON'T:**
- Assume streams stay open forever
- Ignore errors during event sending
- Skip cleanup on error paths
- Send events without checking stream state

### 9.2 Client-Side

✅ **DO:**
- Trust EventSource automatic reconnection
- Implement exponential backoff for manual retries
- Log connection events for debugging
- Handle missing events gracefully (use Last-Event-ID)

❌ **DON'T:**
- Manually manage reconnection (EventSource handles it)
- Create multiple subscriptions for same data
- Ignore 'error' events
- Assume events are never lost

---

## 10. Summary: Stream Closure Q&A

### Q: When does the stream close?

**A:** Stream closes when:
1. Server explicitly calls `closeStream()` (completion or error)
2. Client disconnects (tab close, navigation, manual disconnect)
3. Network interruption detected
4. Server process terminates
5. Timeout reached (proxy/load balancer)

### Q: Can the server close the stream?

**A:** Yes, absolutely! Server has full control via:
- `controller.close()` (normal)
- `controller.error(err)` (error)
- Process termination
- Timeout enforcement

### Q: Do we reopen the connection?

**A:** Yes, automatically! EventSource (browser) handles reconnection:
- Automatic exponential backoff
- Last-Event-ID support for resuming
- No manual intervention needed
- Works transparently for user

### Q: Is it a long-held connection?

**A:** Yes! SSE connections are designed to:
- Stay open for hours/days
- Persist across browser tab switches
- Survive network interruptions
- Only close on logout or explicit termination

### Q: Key Takeaway

**CallMiracle's SSE implementation is designed for persistent, long-lived connections that automatically recover from failures. The `isClosed` flag prevents edge cases where events arrive after stream closure, making the system robust and reliable for real-time WebRTC signaling.**

---

## 11. Critical Memory Leak Fix (2025-10-01)

### Issue: Redis Subscription Cleanup Failure

**Problem:** When clients reconnect, old Redis subscriptions were NOT being cleaned up, causing memory leaks.

**Root Cause:** The `mergeAsyncIterators()` function didn't have cleanup logic in a finally block, so breaking from the for-await loop wouldn't call `return()` on underlying iterators.

**Impact:**
- Each reconnection leaked 2 Redis subscriptions per user
- 1000 users with 10 reconnections = 20,000 leaked subscriptions
- Progressive memory exhaustion on both Redis and server
- Degraded performance over time

**Fix Applied (src/utils.ts:29-67):**
```typescript
export async function* mergeAsyncIterators(iterables: AsyncIterable<any>[]) {
  const iterators = iterables.map(iterable => iterable[Symbol.asyncIterator]())
  const nexts = iterators.map(iterator => iterator.next())

  try {
    while (nexts.length > 0) {
      // ... existing logic ...
    }
  } finally {
    // CRITICAL: Cleanup all underlying iterators when generator exits
    console.log('🧹 Cleaning up merged async iterators')
    await Promise.all(
      iterators.map(async (iterator) => {
        try {
          if (iterator.return) {
            await iterator.return()
            console.log('✅ Iterator cleanup completed')
          }
        } catch (error) {
          console.error('❌ Error cleaning up iterator:', error)
        }
      })
    )
  }
}
```

**Verification:**
```bash
# Monitor Redis subscriptions (should be 0 when no active connections)
redis-cli CLIENT LIST | grep subscribe | wc -l

# Check for cleanup logs in server output
🧹 Cleaning up merged async iterators
✅ Iterator cleanup completed
```

**See also:** `docs/sse-memory-leak-analysis.md` for complete analysis

---

**Last Updated:** 2025-10-01
**Related Files:**
- `src/lib/sse-optimized.ts` - Server SSE implementation
- `src/lib/apollo.ts` - Client EventSource management
- `src/contexts/SubscriptionsContext.tsx` - React subscription lifecycle
- `src/app/api/graphql/route.ts` - SSE route handler
