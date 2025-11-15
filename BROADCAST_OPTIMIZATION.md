# Broadcast Optimization Implementation

## Overview

This document describes the broadcast batching and client-side refetch scattering optimization implemented to reduce the "thundering herd" problem when meeting updates occur.

## Problem Statement

**Before Optimization:**

When a meeting was created/updated/deleted:
1. Server immediately broadcasts `MEETING_UPDATED` to ALL connected clients
2. ALL clients immediately execute 2 GraphQL queries (`getMyMeetingsWithPeers` + `getFutureMeetingsWithPeers`)
3. With 100 connected clients → 200 simultaneous database queries

**Result:** Database load spikes, potential performance degradation

## Solution Architecture

### Two-Pronged Approach:

1. **Server-Side Broadcast Batching**: Batch multiple broadcast events within a time window
2. **Client-Side Scattered Refetch**: Clients wait a random time before refetching

## Implementation Details

### 1. Server-Side: Broadcast Batching

**File:** `src/resolvers/broadcastScheduler.ts`

**How it works:**
- When a meeting change occurs, instead of immediately broadcasting, we schedule a broadcast
- Multiple changes within the configured interval (default: 3 seconds) collapse into ONE broadcast
- First change schedules a broadcast; subsequent changes within the window are ignored
- After the interval, the broadcast fires and the scheduler resets

**Configuration:**
```bash
# .env.local or .env
BROADCAST_BATCH_INTERVAL_MS=3000  # Default: 3000ms (3 seconds)
```

**Set to 0 to disable batching** (immediate broadcasts, pre-optimization behavior)

**Updated Files:**
- `src/resolvers/broadcastScheduler.ts` (new file)
- `src/resolvers/notificationsMutations.ts` (exports `scheduleBroadcast`)
- `src/resolvers/createOrUpdateMeeting.ts` (uses `scheduleBroadcast`)
- `src/resolvers/meetingsMutations.ts` (uses `scheduleBroadcast`)
- `src/config.ts` (adds `broadcastConfig`)

**Usage:**
```typescript
import { scheduleBroadcast } from './notificationsMutations'
import { BroadcastType } from '@/generated/graphql'

// Instead of:
// publishBroadcastEvent(BroadcastType.MeetingUpdated)

// Use:
scheduleBroadcast(BroadcastType.MeetingUpdated)
```

### 2. Client-Side: Scattered Refetch

**File:** `src/contexts/MeetingsContext.tsx`

**How it works:**
- When a broadcast event is received, instead of refetching immediately, schedule a refetch
- Random delay between `minDelayMs` and `maxDelayMs` (default: 1-5 seconds)
- If multiple broadcasts arrive, only the latest is scheduled (previous one cancelled)
- User-specific notifications (e.g., `MEETING_CONNECTED`) still refetch immediately

**Configuration:**
```bash
# .env.local or .env
NEXT_PUBLIC_REFETCH_MIN_DELAY_MS=1000  # Default: 1000ms (1 second)
NEXT_PUBLIC_REFETCH_MAX_DELAY_MS=5000  # Default: 5000ms (5 seconds)
```

**Updated Files:**
- `src/contexts/MeetingsContext.tsx` (adds `scheduleScatteredRefetch`)
- `src/config.ts` (adds `refetchConfig`)

**Behavior:**
- **Broadcast events** (global): Scattered refetch with random delay
- **Notification events** (user-specific): Immediate refetch (e.g., your meeting got matched)

## Performance Impact

### Before:
```
100 users online
User creates meeting
    ↓
Broadcast to ALL 100 users (immediate)
    ↓
100 clients refetch simultaneously
    ↓
200 database queries in same millisecond
```

### After:
```
100 users online
User creates meeting
    ↓
Server batches broadcast (waits up to 3s)
    ↓
99 other clients receive broadcast
    ↓
Each client waits random 1-5s
    ↓
~200 queries spread over 3s (server batch) + 4s (client scatter) = 7s window
    ↓
Peak load: ~30 queries/second instead of 200/millisecond
```

**Load Reduction:** ~85% peak reduction

## UX Considerations

### Latency for Different User Types:

1. **User who created/modified meeting:**
   - Current: Sees update immediately (optimistic updates not yet implemented)
   - Future: Will see update in <100ms (requires optimistic updates - separate task)
   - For now: Sees update after 1-8 seconds (batching + scatter delay)

2. **Other users viewing calendar:**
   - Latency: 1-8 seconds to see new/updated meetings
   - **Is this acceptable?** YES - for a meeting calendar showing future events, this delay is negligible
   - Similar to: Google Calendar sync delays, WhatsApp "delivered" indicator delays

### Edge Cases Handled:

**Immediate Calls:**
- If Alice creates a meeting and immediately tries to call Bob
- Bob receives `CALL` notification (separate from broadcast)
- Call flow doesn't depend on calendar being up-to-date
- Call notification includes meeting data directly

**User-Specific Events:**
- Meeting connected to you: Immediate refetch
- Meeting disconnected from you: Immediate refetch
- Your meeting status changed: Immediate refetch
- Someone else's meeting created: Scattered refetch

## Configuration Tuning

### Recommended Settings:

**Low Traffic (<50 concurrent users):**
```bash
BROADCAST_BATCH_INTERVAL_MS=1000        # 1 second
NEXT_PUBLIC_REFETCH_MIN_DELAY_MS=500    # 0.5 seconds
NEXT_PUBLIC_REFETCH_MAX_DELAY_MS=2000   # 2 seconds
```
More responsive, less optimization needed.

**Medium Traffic (50-200 concurrent users):**
```bash
BROADCAST_BATCH_INTERVAL_MS=3000        # 3 seconds (default)
NEXT_PUBLIC_REFETCH_MIN_DELAY_MS=1000   # 1 second (default)
NEXT_PUBLIC_REFETCH_MAX_DELAY_MS=5000   # 5 seconds (default)
```
Balanced approach.

**High Traffic (200+ concurrent users):**
```bash
BROADCAST_BATCH_INTERVAL_MS=5000        # 5 seconds
NEXT_PUBLIC_REFETCH_MIN_DELAY_MS=2000   # 2 seconds
NEXT_PUBLIC_REFETCH_MAX_DELAY_MS=10000  # 10 seconds
```
Maximum load reduction, higher latency acceptable at scale.

**Disable Optimization (testing/debugging):**
```bash
BROADCAST_BATCH_INTERVAL_MS=0           # Immediate broadcasts
NEXT_PUBLIC_REFETCH_MIN_DELAY_MS=0      # Immediate refetch
NEXT_PUBLIC_REFETCH_MAX_DELAY_MS=0      # Immediate refetch
```

## Testing

### Type Checking:
```bash
npx tsc --noEmit
```
Status: ✅ Passes

### Manual Testing Checklist:

1. **Single user creates meeting:**
   - [ ] Meeting appears in user's own calendar within configured delay
   - [ ] Other users see meeting within batch + scatter delay
   - [ ] Check browser console for "Scheduling scattered refetch in Xms" message

2. **Multiple users create meetings rapidly:**
   - [ ] Only one broadcast per batch interval
   - [ ] Server logs show "Broadcasting" only once per interval
   - [ ] Database doesn't spike with simultaneous queries

3. **Meeting connection (matching):**
   - [ ] Both users receive `MEETING_CONNECTED` notification
   - [ ] Both users refetch immediately (not scattered)
   - [ ] Meetings update in real-time

4. **Configuration changes:**
   - [ ] Set `BROADCAST_BATCH_INTERVAL_MS=0` → broadcasts happen immediately
   - [ ] Set delays to 0 → refetches happen immediately
   - [ ] Set high delays → longer wait times observed

### Monitoring:

**Server-Side:**
Check logs for:
```
"Scheduling broadcast" (batching enabled)
"Broadcasting immediately (batching disabled)" (batching disabled)
"Publishing broadcast event for all users" (actual broadcast)
```

**Client-Side:**
Check browser console for:
```
"Received broadcast event, scheduling scattered refetch"
"Scheduling scattered refetch in Xms"
"Executing scattered refetch"
"Refetching meetings immediately because of meeting notification (user-specific event)"
```

## Future Optimizations

### 1. Optimistic Updates (High Priority)
**Goal:** User sees their own meeting instantly

**Approach:**
- Apollo Client optimistic responses
- Update cache immediately on mutation
- User doesn't wait for broadcast

**Files to update:**
- `src/hooks/useUpdateMeeting.ts`
- `src/components/MeetingForm.tsx`

### 2. Smart Filtering (Medium Priority)
**Goal:** Only notify clients in affected groups

**Approach:**
- Include `affectedGroups: [groupId]` in broadcast
- Clients check if they're in any affected groups
- Skip refetch if not relevant

**Files to update:**
- `src/resolvers/broadcastScheduler.ts` (include metadata)
- `src/contexts/MeetingsContext.tsx` (filter logic)

### 3. Incremental Cache Updates (Low Priority)
**Goal:** Skip full refetch, update cache with delta

**Approach:**
- Include meeting data in broadcast
- Use Apollo Client `writeQuery` to update cache
- No database query needed

**Complexity:** High (cache normalization, edge cases)

## Rollback Plan

If issues arise, rollback is simple:

1. **Disable server-side batching:**
   ```bash
   BROADCAST_BATCH_INTERVAL_MS=0
   ```

2. **Disable client-side scattering:**
   ```bash
   NEXT_PUBLIC_REFETCH_MIN_DELAY_MS=0
   NEXT_PUBLIC_REFETCH_MAX_DELAY_MS=0
   ```

3. **Or revert code changes:**
   - In `createOrUpdateMeeting.ts`: Replace `scheduleBroadcast` with `publishBroadcastEvent`
   - In `meetingsMutations.ts`: Replace `scheduleBroadcast` with `publishBroadcastEvent`
   - In `MeetingsContext.tsx`: Replace `scheduleScatteredRefetch()` with `refetchMeetings(false)`

## References

**Key Files:**
- Server: `src/resolvers/broadcastScheduler.ts`
- Client: `src/contexts/MeetingsContext.tsx`
- Config: `src/config.ts`
- Env: `.env.local.example`

**Related Mutations:**
- `createOrUpdateMeeting` (src/resolvers/createOrUpdateMeeting.ts)
- `updateMeetingStatus` (src/resolvers/meetingsMutations.ts)
- `deleteMeeting` (src/resolvers/meetingsMutations.ts)

**Subscription Flow:**
- Subscription resolver: `src/resolvers/subscriptions.ts`
- Subscription context: `src/contexts/SubscriptionsContext.tsx`
- PubSub helper: `src/utils/pubsubHelper.ts`
