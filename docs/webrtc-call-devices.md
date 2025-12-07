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

Recent fixes/outcome (2025-07-28)
---------------------------------
- Fixed: initial call with both sides video-on now works by avoiding callee bootstrap transceivers (callee relies on offer-created transceivers).
- Fixed: mid-call callee video-on now works by:
  - Retrying renegotiation until signaling is stable.
  - Allowing renegotiate/update events even if callId drifts during SSE reconnects.
  - Handling track events with no `event.streams` (create a MediaStream from the track so the caller can bind it).
- Remaining fragility: SSE disconnects still occur; if both sides miss renegotiate/update events, we would need a retry/backfill (e.g., small watchdog).

Simplification opportunities
----------------------------
[] 1) Event handling
   - Keep a single gate: process all call events when either caller/callee is active; only drop when truly idle. Current partial callId logic is brittle.
   - Add a tiny “last event seen” watchdog to auto-refresh subscription if silent for N seconds.

[] 2) Renegotiation
   - Single entry: always use `sendWantedMediaState` as the only place to trigger renegotiate. Remove duplicated triggers elsewhere; keep a retry loop while signaling is not stable.
   - Caller-side fallback: if remoteVideoEnabled becomes true but no remote stream after a grace period, fire one renegotiate attempt (already partially done).

[] 3) Track/stream handling
   - Normalize all track events: if `event.streams` is empty, always wrap in `new MediaStream([track])`. Do this in one utility.
   - Remove duplicate track-replacement logic: consolidate attach/replace into `attachTracksToPeer` and the `localStream` effect; avoid reimplementing per hook.

[] 4) Transceiver strategy
   - Initiator pre-adds video `sendrecv`; callee relies on offer transceivers. Keep audio `sendrecv` only when enabled, otherwise `recvonly`.
   - After toggles, `configureTransceivers` should only flip audio based on flag; video stays `sendrecv` and we depend on `track.enabled` for mute.

[] 5) Signaling noise
   - Reduce repeated ICE/log spam: coalesce duplicate ICE logs and keep only essential callId/type/size.
   - Consider batching `updateMediaState` if multiple toggles happen quickly (debounce).

[] 6) Autoplay/binding
   - Centralize remote binding (one place to set `videoEl.srcObject` and `play()`), driven by `remoteStreamVersion`.
   - Add a small “play guard” to retry `videoEl.play()` if it fails due to autoplay.
