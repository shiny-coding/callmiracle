# CallMiracle: Push Notifications, Call Handling, and Device Wake Implementation Analysis

## Executive Summary

CallMiracle has a functional push notification system based on Web Push API and service workers, but currently **lacks any mechanism to wake locked devices or handle calls when the app is in the background**. The incoming call notification flow relies entirely on the browser being active and the app remaining in the foreground.

---

## 1. PUSH NOTIFICATION SETUP

### Current Implementation

#### Service Worker (`/public/sw.js`)
- **Version Control**: Manual versioning (1.0.4) with `skipWaiting()` for immediate activation
- **Push Event Handler**:
  ```javascript
  self.addEventListener('push', event => {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/logo-192.png',
      badge: '/logo-72.png',
      data: { url: data.data.url, notificationId: data.data.notificationId }
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  })
  ```
- **Notification Click Handling**: 
  - Tracks notification clicks via `/api/track-notification-click`
  - Marks notifications as seen via `/api/mark-notification-seen`
  - Navigates to target URL or opens new window
  - Supports focus of existing windows to the app's domain

#### VAPID Configuration (`/src/resolvers/pushNotifications.ts`)
- Uses `web-push` npm package
- VAPID keys from environment variables:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (public key)
  - `VAPID_PRIVATE_KEY` (private key)
  - `VAPID_SUBJECT_EMAIL` (service email)
- Handles 410 (Gone) status codes by removing expired subscriptions

#### Client-Side Registration (`/src/hooks/useClientPushNotifications.ts`)
- Service worker registered with `updateViaCache: 'none'`
- Updates checked when page becomes visible
- Subscription to push notifications requires `Notification.permission === 'granted'`
- Device selection for video/audio stored in localStorage
- Platform detection (iOS, Android, Desktop) but no platform-specific handling for calls

#### FCM Token Storage (`/src/app/api/save-fcm-token/route.ts`)
- Stores push subscriptions in MongoDB `users.pushSubscriptions` array
- Deduplicates by endpoint (removes old, adds new)
- Metrics tracked:
  - `fcmTokenRegistrationsMetric`
  - `fcmTokenRegistrationFailuresMetric`

### Notification Payloads

#### Notification Types (GraphQL enum)
```
- MEETING_CONNECTED
- MEETING_DISCONNECTED
- MEETING_FINISHED
- MESSAGE_RECEIVED
- MISSED_CALL (generated after call expires)
```

#### Payload Structure
```json
{
  "title": "User Name or 'CallMiracle'",
  "body": "Translated message",
  "data": {
    "url": "/conversations?with=... or /list?meetingId=...",
    "notificationId": "ObjectId of notification record"
  }
}
```

### Metrics
- `pushNotificationsSentMetric`: Incremented before sending
- `pushNotificationsDeliveredMetric`: On successful send
- `pushNotificationsFailedMetric`: On send failure
- `pushNotificationsClickedMetric`: Tracked in service worker click handler

---

## 2. INCOMING CALL HANDLING

### Call Flow Architecture

#### Call Initiation (`/src/resolvers/callUserMutation.ts`)
1. **Type: 'initiate'**
   - Creates new call record with status `initiated`
   - Returns `callId` to caller
   - No push notification sent at this stage
   - **ISSUE**: No mechanism to notify the target user if they're offline/device locked

2. **Type: 'offer'**
   - Caller sends WebRTC offer
   - Publishes `CallEvent` via GraphQL subscription

3. **Type: 'answer'**
   - Updates call status to `connected`

4. **Type: 'expired'**
   - Call times out (no answer)
   - If call was never connected: publishes `MISSED_CALL` notification
   - Checks meeting transparency to determine if initiator's name should be shown

#### Notification Publishing
- **No automatic push notification on incoming call**
- Only `MISSED_CALL` notification sent after call expires
- Push notifications are sent for:
  - Meeting connection/disconnection events
  - Messages
  - Missed calls (but device must check by then)

### Real-time Event Flow

#### Subscription System (`/src/resolvers/subscriptions.ts`)
- **Topic Structure**: 
  - User-specific: `SUBSCRIPTION_EVENT:{userId}`
  - Global: `SUBSCRIPTION_EVENT:ALL`
- **Event Types**:
  - `callEvent`: WebRTC signaling
  - `notificationEvent`: Notification updates
  - `broadcastEvent`: System broadcasts
- **Dependency**: App must have active WebSocket/subscription connection

#### WebRTC Event Handler (`/src/hooks/webrtc/WebRTCProvider.tsx`)
When `callEvent.type === 'initiate'`:
```typescript
if (callId) {
  // Already in call, send busy response
} else {
  // Set up for receiving
  setCallId(callEvent.callId ?? null)
  setTargetUser(callEvent.from)
  setRole('callee')
  setConnectionStatus('receiving-call')
}
```

**CRITICAL ISSUE**: This only works if:
1. App is in foreground
2. WebSocket subscription is active
3. User hasn't terminated the browser/tab

### Missed Call Notification (`/src/resolvers/callUserMutation.ts`)

Only triggered on call expiration:
```typescript
if (type === 'expired' && call?.type !== 'connected') {
  let showInitiatorName = true
  if (_meetingId) {
    const meeting = await db.collection('meetings').findOne<Meeting>({ _id: _meetingId })
    showInitiatorName = !!meeting?.lastCallTime || meeting?.transparency === MeetingTransparency.Transparent
  }
  await publishCallNotification(NotificationType.MissedCall, db, initiator, targetUser, call as Call, showInitiatorName)
}
```

**PROBLEMS**:
1. Only sent after call expires (not immediately on incoming call)
2. User can't see missed call until checking the app
3. No audio/vibration alert configured
4. No wake lock to activate device

---

## 3. WEBRTC SIGNALING & CALL INITIATION

### Connection Setup (`/src/hooks/webrtc/useWebRTCCaller.ts` & `useWebRTCCallee.ts`)

#### For Caller:
1. Call `doCall()` with target user
2. Initialize `callUser()` mutation with type 'initiate'
3. Get `callId` from response
4. Create RTCPeerConnection with ICE servers
5. Add local stream (audio/video based on user settings)
6. Create offer
7. Send offer via `callUser()` mutation with type 'offer'

#### For Callee:
1. Receive `callEvent` with type 'offer' via subscription
2. Store incoming request
3. User taps accept button
4. Create RTCPeerConnection
5. Add local stream
6. Set remote description (offer)
7. Create answer
8. Send answer via `callUser()` mutation
9. Setup ICE handlers

#### Media Constraints
- Video: Uses selected device from localStorage
- Audio: System default
- Quality settings enforced:
  - Low: 320x180, 15fps, 500kbps
  - Medium: 640x480, 24fps, 1500kbps
  - High: 1280x720, 30fps, 2500kbps

### ICE Candidates
- Gathered during offer/answer phase
- Sent immediately via 'ice-candidate' type messages
- Buffered if remote description not yet set
- No STUN/TURN server configuration details in code (likely in `ICE_SERVERS` constant)

---

## 4. EXISTING WAKE LOCK & NOTIFICATION APIS

### Currently NOT Used:

1. **Wake Lock API** (`navigator.wakeLock`)
   - ❌ No implementation found
   - Would keep device awake during calls
   - Especially needed on mobile

2. **Screen Wake Lock for Calls**
   - ❌ Not implemented
   - Could use `WakeLock.request('screen')`

3. **Badge API** (`navigator.setAppBadge()`)
   - ❌ Not implemented
   - Could show notification count on app icon

4. **Vibration API** (`navigator.vibrate()`)
   - ❌ Not triggered for incoming calls
   - Could provide haptic feedback

5. **Notification.permission** Checks
   - ✅ Partially implemented
   - Used to gate push subscription
   - But no permission request on incoming call

6. **Background Sync API**
   - ❌ No service worker background sync configured
   - No `backgroundSync` in manifest.json
   - Could retry failed calls when app returns to foreground

7. **Periodic Background Sync**
   - ❌ Not implemented
   - No periodic sync tags in service worker

8. **Service Worker Lifecycle**
   - ✅ Basic implementation
   - `skipWaiting()` and `clients.claim()` for immediate activation
   - But no background message handling

### Available but Underutilized:

1. **Notification API** (in service worker)
   - ✅ Works in service worker
   - ❌ Not used for incoming calls
   - ❌ No sound/vibration/actions configured

---

## 5. SERVICE WORKER IMPLEMENTATION

### Current Capabilities (`/public/sw.js`)

**Install Event**:
- Forces immediate activation with `skipWaiting()`

**Activate Event**:
- Claims all clients with `clients.claim()`

**Push Event**:
- Receives push messages from server
- Creates notification with icon/badge
- Works even if app tab is closed

**Notification Click**:
- Closes notification
- Tracks click
- Marks as seen
- Navigates/opens window to target URL
- Supports 3 fallback strategies for focusing existing window

### Gaps

- ❌ No background message handler
- ❌ No service worker timeout handling
- ❌ No audio notification playback in service worker
- ❌ No vibration on push receipt
- ❌ No data-only push message handler
- ❌ No `message` event listener from client to service worker
- ❌ No periodic background tasks

---

## 6. MANIFEST CONFIGURATION

Current `/public/manifest.json`:
```json
{
  "name": "CallMiracle",
  "short_name": "CallMiracle",
  "description": "A miracle communication platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#2563eb",
  "orientation": "any",
  "scope": "/",
  "icons": [
    { "src": "/logo-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/logo-192.png", "sizes": "192x192", "type": "image/png" }
  ]
}
```

**Missing Features**:
- ❌ `screenshots` (for app store listing)
- ❌ `categories` (for discovery)
- ❌ `shortcuts` (for quick actions)
- ❌ `share_target` (for share intent)
- ❌ No `background_sync` hook
- ❌ No `share_target_url_template`

---

## 7. CALL NOTIFICATION FLOW - DETAILED

### When Device is Locked (Current Behavior):

```
1. Caller initiates call
   ↓
2. callUserMutation called with type 'initiate'
   ↓
3. Call record created in MongoDB
   ↓
4. publishSubscriptionEvent sent (GraphQL subscription)
   ↓
5. Callee's app NOT receiving (no WebSocket if app killed or device locked)
   ↓
6. Caller sends 'offer' message
   ↓
7. Still no subscription event on callee's app
   ↓
8. 30s timeout (assumption based on typical implementations)
   ↓
9. Call expires - callUserMutation called with type 'expired'
   ↓
10. publishCallNotification called for MISSED_CALL
    ↓
11. publishPushNotification sends via web-push
    ↓
12. Push notification arrives (if subscribed)
    ↓
13. User sees missed call (already missed!)
```

---

## 8. SUMMARY OF GAPS

### Critical Issues for Device Wake/Locked Screen:

1. **No Push on Incoming Call**
   - Only on missed call (too late)
   - User never knows device locked

2. **No Wake Lock**
   - Screen can turn off during call setup
   - No way to keep device awake

3. **No Device Activation**
   - No vibration on incoming call
   - No audio alert (beyond system notification sound)
   - Screen stays locked

4. **No Offline Capability**
   - Relies entirely on active WebSocket
   - If app killed or subscriptions dropped, no notification
   - No background sync to reconnect

5. **Missing Mobile Optimizations**
   - No platform-specific handling
   - No Android notification channels
   - No iOS VoIP push support
   - No background mode capability

6. **Call Timeout**
   - No configurable timeout
   - No caller notification that callee device is locked
   - No retry mechanism

7. **No Subscription Reliability**
   - No health checks on subscriptions
   - No retry if subscription fails
   - Expired subscriptions only discovered on send failure

---

## 9. FILES INVOLVED

### Core Files:
- `/public/sw.js` - Service worker (notifications)
- `/public/manifest.json` - PWA manifest
- `/src/hooks/useClientPushNotifications.ts` - Client registration
- `/src/app/api/save-fcm-token/route.ts` - Subscription storage
- `/src/resolvers/pushNotifications.ts` - Send push notifications
- `/src/resolvers/callUserMutation.ts` - Call signaling
- `/src/resolvers/subscriptions.ts` - GraphQL subscriptions
- `/src/hooks/webrtc/useWebRTCCaller.ts` - Caller flow
- `/src/hooks/webrtc/useWebRTCCallee.ts` - Callee flow
- `/src/hooks/webrtc/WebRTCProvider.tsx` - Event coordination
- `/src/resolvers/publishNotifications.ts` - Notification creation
- `/src/app/api/track-notification-click/route.ts` - Click tracking

---

## 10. RECOMMENDATIONS

### For Device Wake on Locked Screen:

1. **Send Push on Incoming Call** (not just missed calls)
   - New notification type: `INCOMING_CALL`
   - Include caller info and call ID
   - Trigger immediately on 'initiate'

2. **Implement Wake Lock**
   - Request screen wake lock when call connects
   - Request CPU wake lock for background calls
   - Release on call end

3. **Enhance Service Worker**
   - Add background message handler
   - Play audio notification on push
   - Use badge API for notification count
   - Support action buttons on notification

4. **Mobile-Specific**
   - Detect iOS/Android with better accuracy
   - Use platform-specific push (FCM for Android)
   - Consider native app bridge for locked screen

5. **Reliability**
   - Implement subscription health checks
   - Add retry logic for failed notifications
   - Background sync for reconnection

6. **UX Enhancements**
   - Vibration on incoming call
   - Ringtone during call setup
   - Visible full-screen notification on Android
   - Action buttons (Answer/Decline) on notification

