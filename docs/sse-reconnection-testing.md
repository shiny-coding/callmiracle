# SSE Reconnection Testing Guide

## How EventSource Reconnection Works

### The Mechanism

**EventSource auto-reconnection is built into the browser** - you don't need to implement it:

1. **Connection drops** (network loss, server restart, etc.)
2. Browser detects dead connection via:
   - TCP timeout
   - Missing heartbeat (we send every 30s)
   - Failed write attempt
3. **Browser automatically reconnects**:
   - Waits exponential backoff: 3s → 9s → 27s...
   - Creates **brand new HTTP GET request** to `/api/graphql`
   - Not a resume - completely fresh connection
4. **Server handles as new subscription**:
   - New `ReadableStream`
   - New GraphQL `subscribe()` call
   - New Redis subscriptions
5. **Old connection cleanup**:
   - `finally` blocks execute
   - `iterator.return()` called on Redis subscriptions
   - Redis sends UNSUBSCRIBE commands

### Client-Side Observable Behavior

**Console logs you'll see**:

```
// Initial connection
SSE: Connection opened for OnSubscriptionEvent

// Network drops
SSE: Connection lost for OnSubscriptionEvent, reconnecting...

// After 3 seconds (first retry)
SSE: Reconnected for OnSubscriptionEvent (attempt 1)

// If fails again, waits 9 seconds
SSE: Connection lost for OnSubscriptionEvent, reconnecting...
SSE: Reconnected for OnSubscriptionEvent (attempt 2)
```

**What happens in the code**:

```typescript
eventSource.addEventListener('error', (event: Event) => {
  const target = event.target as EventSource

  if (target.readyState === EventSource.CONNECTING) {
    // Browser is already reconnecting - just log it
    console.warn('SSE: Connection lost, reconnecting...')
    // Don't call observer.error() - let reconnection happen
  } else if (target.readyState === EventSource.CLOSED) {
    // Fatal error - connection won't reconnect
    console.error('SSE: Connection permanently closed')
    observer.error(new Error('SSE connection permanently closed'))
  }
})
```

---

## Testing Scenarios

### Test 1: Network Interruption (Chrome DevTools)

**Easiest and most reliable test method**

1. Open application in Chrome
2. Log in (subscription starts)
3. Open DevTools (F12) → Network tab
4. Click **Offline** checkbox (or throttle to "Offline")
5. Wait 5 seconds
6. **Watch console for**: `SSE: Connection lost for OnSubscriptionEvent, reconnecting...`
7. Uncheck **Offline**
8. **Watch console for**: `SSE: Reconnected for OnSubscriptionEvent (attempt 1)`

**Expected Result**:
- ✅ Reconnection happens automatically
- ✅ Subscription continues working
- ✅ Can receive new call events

**Verification**:
```javascript
// In browser console, check EventSource state
window.eventSourceState = 'reconnected'
```

---

### Test 2: Physical Network Disconnect

**Tests real-world scenario**

1. Open application, log in
2. **Turn off WiFi** or unplug ethernet cable
3. Wait 1 minute
4. Watch console: `SSE: Connection lost...`
5. **Turn on WiFi** or plug cable back in
6. Watch console: `SSE: Reconnected... (attempt N)`

**Expected Result**:
- ✅ Reconnects after network returns
- ✅ Multiple retry attempts visible
- ✅ Eventually succeeds

**What to watch for**:
- Retry count increases: attempt 1, 2, 3...
- Exponential backoff visible in timing

---

### Test 3: Server Restart

**Tests cleanup and reconnection**

1. Open application, log in
2. Note server logs: `🚀 Creating OPTIMIZED SSE response`
3. **Restart dev server** (`Ctrl+C`, then `yarn dev`)
4. Watch browser console:
   ```
   SSE: Connection lost for OnSubscriptionEvent, reconnecting...
   SSE: Reconnected for OnSubscriptionEvent (attempt 1)
   ```
5. Watch new server logs: New `🚀 Creating OPTIMIZED SSE response`

**Expected Result**:
- ✅ Client detects server down
- ✅ Client reconnects when server is back up
- ✅ New subscription created on server
- ✅ Old subscription resources cleaned up

**Verification** (check Redis):
```bash
# While server is running with 1 connected user
redis-cli CLIENT LIST | grep subscribe | wc -l
# Should show: 2 (user topic + global topic)

# After server restart and reconnection
redis-cli CLIENT LIST | grep subscribe | wc -l
# Should still show: 2 (not 4 - proves cleanup worked)
```

---

### Test 4: Redis Connection Drop

**Tests infrastructure failure handling**

1. Open application, log in
2. **Stop Redis**:
   ```bash
   docker-compose -f docker-compose.redis.yml down
   ```
3. Watch server logs: `SSE subscription error` with Redis error
4. Watch browser console: `SSE: Connection lost...`
5. **Start Redis**:
   ```bash
   docker-compose -f docker-compose.redis.yml up -d
   ```
6. Watch reconnection happen

**Expected Result**:
- ✅ Server sends error event with retry interval
- ✅ Client respects retry interval (10s for DB errors)
- ✅ Connection restored after Redis is back

---

### Test 5: Long-Duration Connection (Heartbeat Test)

**Tests proxy timeout prevention**

1. Open application, log in
2. **Don't interact for 5 minutes**
3. Watch browser Network tab → EventStream:
   - See heartbeat comments every 30 seconds: `: heartbeat`
4. After 5 minutes, **make a test call**

**Expected Result**:
- ✅ Connection stays alive entire time
- ✅ Heartbeats visible in Network tab
- ✅ Call event received immediately (proves connection is live)

**What you'll see in Network tab**:
```
: heartbeat

: heartbeat

event: next
data: {"callEvent":{...}}
id: 5

: heartbeat
```

---

## What to Monitor

### Browser Console

**Success indicators**:
```
✅ SSE: Connection opened for OnSubscriptionEvent
✅ SSE: Reconnected for OnSubscriptionEvent (attempt N)
```

**Warning indicators**:
```
⚠️ SSE: Connection lost for OnSubscriptionEvent, reconnecting...
```

**Error indicators**:
```
❌ SSE: Connection permanently closed for OnSubscriptionEvent
❌ SSE: Error parsing event for OnSubscriptionEvent
```

### Server Logs

**Connection lifecycle**:
```
🚀 Creating OPTIMIZED SSE response with immediate flushing
⚡ Optimized SSE: Event flushed immediately (id: 2)
```

**Cleanup logs** (when client disconnects):
```
🧹 Cleaning up merged async iterators
✅ Iterator cleanup completed
```

**Error logs**:
```
❌ SSE subscription error: Redis connection failed
```

### Browser Network Tab

1. Filter: `graphql?operationName=OnSubscriptionEvent`
2. Click request → **EventStream** tab
3. Watch for:
   - `event: next` - real events
   - `: heartbeat` - keepalive comments (every 30s)
   - Connection status (green = active, red = failed)

### Redis Monitoring

**Active subscriptions** (should be constant, not growing):
```bash
# Watch subscription count in real-time
watch -n 1 'redis-cli CLIENT LIST | grep subscribe | wc -l'

# Expected: (active_users * 2)
# Example: 3 users = 6 subscriptions
```

**After reconnection test**:
```bash
# Count should return to same number, proving cleanup works
redis-cli CLIENT LIST | grep subscribe | wc -l
```

---

## Common Issues & Solutions

### Issue: Connection doesn't reconnect

**Symptoms**:
- Console shows: `SSE: Connection permanently closed`
- readyState = 2 (CLOSED)

**Causes**:
- Server returned HTTP 204 No Content
- Server returned HTTP error status (401, 403, 500)
- Browser hit max retry limit (rare)

**Solution**:
- Check server logs for errors
- Verify authentication is valid
- Check server isn't explicitly closing connections

### Issue: Multiple reconnections in rapid succession

**Symptoms**:
- Reconnect attempts every few seconds
- Never stays connected

**Causes**:
- Server immediately closing connections (check server logs)
- GraphQL validation errors (malformed query)
- Middleware blocking requests

**Solution**:
```bash
# Check server logs
grep "SSE" server.log | tail -20

# Check for validation errors
grep "GraphQL validation" server.log
```

### Issue: Old subscriptions not cleaning up

**Symptoms**:
- Redis subscription count grows with each reconnection
- Memory usage increases over time

**Verification**:
```bash
# Before reconnection
redis-cli CLIENT LIST | grep subscribe | wc -l  # e.g., 2

# After 5 reconnections
redis-cli CLIENT LIST | grep subscribe | wc -l  # Should still be 2, not 12
```

**If growing**: Check server logs for:
```
🧹 Cleaning up merged async iterators
✅ Iterator cleanup completed
```

If missing, the `finally` blocks aren't executing.

---

## Testing Checklist

### Quick Test (5 minutes)
- [ ] Open app, log in
- [ ] DevTools → Network → Offline
- [ ] Wait 5 seconds
- [ ] DevTools → Online
- [ ] Verify: `SSE: Reconnected` in console
- [ ] Make test call, verify it works

### Comprehensive Test (30 minutes)
- [ ] Test 1: Chrome DevTools offline mode
- [ ] Test 2: Physical network disconnect (WiFi off/on)
- [ ] Test 3: Server restart
- [ ] Test 4: Redis restart
- [ ] Test 5: Long-duration connection (5+ minutes)
- [ ] Verify Redis subscription count stable
- [ ] Verify no memory leaks (check cleanup logs)

### Production Readiness Test
- [ ] All 5 tests pass
- [ ] No console errors during normal operation
- [ ] Heartbeats visible in Network tab
- [ ] Redis subscriptions don't accumulate
- [ ] Server cleanup logs appear on disconnect
- [ ] Reconnection happens within expected timeframe
- [ ] Application continues working after reconnection

---

## Advanced: Manual EventSource Testing

If you want to test EventSource behavior directly in the browser console:

```javascript
// Create test EventSource
const testSSE = new EventSource('/api/graphql?operationName=OnSubscriptionEvent&query=...', {
  withCredentials: true
})

// Monitor state
console.log('State:', testSSE.readyState)
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSED

// Listen to events
testSSE.addEventListener('next', (e) => {
  console.log('Event:', JSON.parse(e.data))
})

testSSE.addEventListener('error', (e) => {
  console.log('Error, readyState:', testSSE.readyState)
})

// Close it
testSSE.close()
```

---

**Last Updated**: 2025-01-04
**Related Files**:
- `src/lib/apollo.ts` - Client-side EventSource handling
- `src/lib/sse-optimized.ts` - Server-side SSE implementation
- `src/utils.ts` - `mergeAsyncIterators` cleanup logic
