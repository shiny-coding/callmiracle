WebRTC call + device flow (mid-call video enable analysis)
==========================================================

Goal
----
- Document how local media is acquired, attached, and signaled so we can debug the "peer enables video mid-call but I see black screen" case.

State + toggles
---------------
- `useStore` keeps `localVideoEnabled`/`localAudioEnabled`, call metadata (`callId`, `role`, `targetUser`), and quality preferences.
- UI toggles (MediaControls, ConnectedCallLayout, DeviceSettingsDialog, etc.) flip store flags and call `sendWantedMediaState` from `WebRTCProvider`.

Stream lifecycle (`ensureMediaStream`)
--------------------------------------
- Lives in `src/hooks/webrtc/useWebRTCCommon.ts`.
- Returns an empty `MediaStream` when both audio and video are disabled; otherwise calls `getUserMedia` for enabled kinds (respecting `selectedVideoDevice`).
- Reuses an existing stream unless:
  - Any track has `readyState === 'ended'`.
  - The track mix does not match enabled flags (e.g., video flag true but stream has no video track).
  - In these cases it stops old tracks and recreates the stream.
- Call sites:
  - Caller: before offer in `useWebRTCCaller.doCall`.
  - Callee: before answer in `useWebRTCCallee.handleAcceptCall`.
  - Mid-call: `sendWantedMediaState` now re-invokes `ensureMediaStream` when tracks are missing or ended.

Peer connection setup
---------------------
- `addLocalStream(pc, stream, isInitiator, localVideoEnabled, localAudioEnabled, quality)` (in `useWebRTCCommon`):
  - Initiator adds transceivers once:
    - Audio: `sendrecv` if enabled, else `recvonly`.
    - Video: always `sendrecv` so we can attach a track later without renegotiation.
  - Iterates stream tracks:
    - Replaces an existing sender's track when kinds match.
    - Adds a new sender only if the corresponding flag is enabled.
    - Disabled tracks are stopped (so a disabled video track is not kept alive).
  - `configureTransceivers` keeps video `sendrecv`; audio is `sendrecv`/`recvonly` based on the audio flag.
  - `applyLocalQuality` tunes sender params when a video sender exists.

Local track attachment/resync
-----------------------------
- `WebRTCProvider` keeps `localStreamRef` in sync with state and runs a replacement effect when `localStream` changes:
  - Finds matching sender and `replaceTrack`.
  - If none, falls back to transceiver sender or `addTrack` to create a sender.
- `sendWantedMediaState` (mid-call toggle handler):
  - Reads latest flags from `syncStore`.
  - Refreshes/creates a stream via `ensureMediaStream` when tracks are missing/ended.
  - Calls `attachTracksToPeer` to bind tracks even if the sender currently has no track (tries sender by kind -> transceiver by kind/mid -> `addTrack`).
  - Delegates to `sendWantedMediaStateImpl` to toggle `track.enabled`, re-run `configureTransceivers`, and signal `updateMediaState` to the peer.

Remote media handling
---------------------
- Incoming track events land in `handleTrack` (`useWebRTCCommon`):
  - Stores latest remote stream in `caller.remoteStreamRef` / `callee.remoteStreamRef`.
  - Binds to the provided `remoteVideoRef` element and logs via `clientLogger`.
  - Re-applies the remote-requested quality when a video track arrives.
- Provider-level binding safeguard re-applies the remote stream to the video element when `remoteStreamVersion` bumps.
- `updateMediaState` signaling handler updates `remoteVideoEnabled`/`remoteAudioEnabled`, applies quality, and (after added instrumentation) logs current receiver/transceiver state for debugging.

Black-screen hypothesis (mid-call video enable)
-----------------------------------------------
- Track creation now happens on toggles, and track attachment covers the no-sender/transceiver case, so the previous "no track bound" failure is addressed.
- Remaining risk areas:
  - Sender starts streaming but receiver never fires a `track` event (browser quirk or missing renegotiation) - watch for receiver/transceiver state after `updateMediaState`.
  - Remote video track arrives but fails to play/bind (autoplay rejection, element detached) - check `remoteStreamVersion` logs and video element `play()` results.
  - Video track created with constraints/device that produces black frames (e.g., denied camera, muted/ended track) - `ensureMediaStream` logs success/failure and track settings.

Key files
---------
- `src/hooks/webrtc/useWebRTCCommon.ts`: `ensureMediaStream`, `addLocalStream`, `configureTransceivers`, `handleTrack`, signaling helpers.
- `src/hooks/webrtc/WebRTCProvider.tsx`: `sendWantedMediaState`, `attachTracksToPeer`, stream replacement effect, `updateMediaState` handling.
- UI toggles live in `MediaControls`, `ConnectedCallLayout`, `DeviceSettingsDialog`, etc., and all route through `sendWantedMediaState`.

Current regression (2025-07-28, 18:13 run)
------------------------------------------
- Scenario: caller (Android) and callee (iOS) both start with video on. Callee sees caller; caller never sees callee video.
- Caller side evidence:
  - Offer sent with `localVideoEnabled: true`, transceivers logged as `sendrecv` before offer.
  - No caller log lines for `[WebRTC] Processing answer`, `Answer processed successfully`, or any remote `track`/`Remote stream received` events after 18:13:41. That implies the answer was never applied on the caller.
  - No `updateMediaState` received on caller either; remote video flags stay false.
- Callee side evidence:
  - Callee created multiple local streams with video, `getUserMedia success` and `addLocalStream adding new track` logged.
  - Subscription (`OnSubscriptionEvent`) was closed/restarted shortly after call start (13–130 seconds durations in logs), so call events may have dropped.
  - We see heavy ICE traffic but no clear confirmation that the answer/remote description reached the caller.
- Hypothesis:
  1) The answer never reaches the caller because the caller’s subscription disconnects/filters it (e.g., SSE close, callId mismatch, or we ignore events while `callId` is unset/stale). Without `setRemoteDescription(answer)`, no remote track events fire.
  2) Alternatively, the callee sent the answer but the caller was not in `have-local-offer` anymore when it arrived (signaling state mismatch), so we skipped applying it—again resulting in no remote tracks.
- Next instrumentation to confirm:
  - On caller `answer` handling: log at INFO before/after `setRemoteDescription`, including `callId`, `signalingState`, `current transceivers`, and whether `dispatchPendingIceCandidates` runs.
  - On callee after sending the answer: log the callId and ensure `callUser` mutation resolves; also log the answer payload size and `pc.signalingState`.
  - On subscription handler: log every incoming `callEvent.type` with `callId` and `connectionStatus` so we can see if the answer ever arrives or is filtered out.
  - Add a warning when the caller stays in `calling/connecting` for >5s without having applied an answer (timer-based), to catch the missing-answer path in the field.
