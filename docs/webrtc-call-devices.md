WebRTC call + device flow (mid-call video enable analysis)
==========================================================

Goal
----
- Understand how media (camera/mic) is wired through the WebRTC stack and why turning video on mid-call (after starting with video off) shows a black screen to the peer.

State + toggles
---------------
- `useStore` holds `localVideoEnabled` / `localAudioEnabled` (persisted) and call metadata (`callId`, `role`, `targetUser`, `quality*`).
- UI toggles (MediaControls, ConnectedCallLayout, DeviceSettingsDialog, etc.) flip the store and immediately call `sendWantedMediaState` from `WebRTCProvider`.

Stream acquisition
------------------
- `ensureMediaStream(currentStream, setLocalStream, localVideoEnabled, localAudioEnabled)` (in `useWebRTCCommon`) returns:
  - New `MediaStream` from `getUserMedia` when either flag is true.
  - An **empty** `MediaStream` when both flags are false.
  - Reuses `currentStream` unless tracks ended or the track mix does not match the enabled flags, otherwise stops old tracks and recreates.
- Callers:
  - Caller: `useWebRTCCaller.doCall` before creating offer.
  - Callee: `useWebRTCCallee.handleAcceptCall` before creating answer.
  - **Not** called when the user later flips video/audio during an active call.

Peer connection + tracks at call start
--------------------------------------
- `addLocalStream(pc, stream, isInitiator, localVideoEnabled, localAudioEnabled, quality)`:
  - Initiator adds transceivers once:
    - Audio: `sendrecv` if enabled else `recvonly`.
    - Video: `sendrecv` if enabled else `recvonly`.
  - Iterates `stream.getTracks()`:
    - If a sender with the same kind exists, replaces its track (unless the local flag is false, in which case the track is stopped).
    - Else, adds the track only when the corresponding local flag is true.
  - Calls `configureTransceivers` to flip directions again to match flags, then applies quality.
- When the call is started with **video off**, we typically pass an **empty stream**:
  - Video transceiver is created as `recvonly`.
  - There is **no video sender track** attached to the PC.

Media updates after call start
------------------------------
- `sendWantedMediaState` (in `WebRTCProvider`):
  - Reads flags from `syncStore`.
  - Calls `sendWantedMediaStateImpl`:
    - Iterates existing senders and toggles `track.enabled` to the desired flag.
    - Calls `configureTransceivers` to switch directions (e.g., to `sendrecv` if video is now enabled).
    - Sends a signaling message of type `updateMediaState` to the peer.
  - **Does not create a new stream or add a missing track.**
- Track replacement effect in `WebRTCProvider` runs when `localStream` changes:
  - For each track in `localStream`, finds a sender where `sender.track?.kind === track.kind` and calls `replaceTrack`.
  - If no sender is found, it logs a warning and does nothing.
  - When a transceiver was created `recvonly`, `sender.track` is `null`, so the lookup does not match any sender and the new track is never attached.

Failure path (black video when enabling mid-call)
-------------------------------------------------
1) User starts call with video off:
   - `ensureMediaStream` returns an empty stream.
   - PC has a video transceiver in `recvonly` with no sender track.
2) User later toggles video on:
   - UI flips `localVideoEnabled` and calls `sendWantedMediaState`.
   - That sets transceiver direction to `sendrecv` but still has **no track** to send.
   - No new `getUserMedia` call is made, and `localStream` is unchanged.
   - Even if a new stream were set later, the replacement effect would not find a sender because `sender.track` was null.
3) Result: offer/answer directions change, but no video is ever sent; the peer sees a black screen.

Implications
------------
- We must both (a) create/refresh a stream when enabling a previously absent track, and (b) attach the new track to the existing transceiver/sender even when it currently has no track (recvonly case).
- Without these two pieces, toggling from off→on cannot produce outgoing video.

Fix direction (minimal, data-driven)
------------------------------------
- On media toggles that enable a previously missing track:
  - Call `ensureMediaStream(...local flags...)` to guarantee the needed tracks exist and update `localStream`.
  - In the track replacement effect (or adjacent helper), when no sender with `track?.kind` is found, fall back to:
    - Find a transceiver for that kind (by `sender`, `receiver`, or `mid`) and call `transceiver.sender.replaceTrack(newTrack)` even if the sender had no track.
    - If no transceiver exists, `addTrack` as a last resort.
- Keep `configureTransceivers` + `updateMediaState` signaling as-is so the peer knows directions/quality, but ensure an actual track is bound before/after signaling.

Optional instrumentation (if we want more certainty first)
---------------------------------------------------------
- Add `clientLogger` breadcrumbs around:
  - `sendWantedMediaState` entry with flags, `pc` states, and whether a matching sender/track was found.
  - Track replacement effect: list senders (including `null` tracks) and which transceiver/sender each new track binds to.
  - `ensureMediaStream` call sites when triggered by toggles (not just during call start).

Key files
---------
- `src/hooks/webrtc/useWebRTCCommon.ts` — `ensureMediaStream`, `addLocalStream`, `configureTransceivers`, signaling helpers.
  - See especially `addLocalStream` sender selection and `configureTransceivers`.
- `src/hooks/webrtc/WebRTCProvider.tsx` — `sendWantedMediaState` and the `localStream` replacement effect.
- UI toggles: `src/components/MediaControls.tsx`, `ConnectedCallLayout.tsx`, `DeviceSettingsDialog.tsx`, etc.
