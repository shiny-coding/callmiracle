import { useEffect, useRef, useState, useCallback, type MutableRefObject } from 'react'
import clientLogger from '@/utils/clientLogger'

interface PlaySoundOptions {
  loop?: boolean
  volume?: number
  resumeOnVisibilityChange?: boolean // Resume playing when page becomes visible again
}

// Detect iOS
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

clientLogger.info('[usePlaySound] Module loaded', { isIOS, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A' })

// Shared AudioContext for all sounds (created on first user interaction)
let sharedAudioContext: AudioContext | null = null
let audioContextUnlocked = false
type PendingUnlockState = {
  active: boolean
  handler: ((event: Event) => void) | null
}
const pendingUnlockPlayRef: PendingUnlockState = { active: false, handler: null }
const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown']

function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    clientLogger.info('[usePlaySound] Created new AudioContext', { state: sharedAudioContext.state })
  }
  return sharedAudioContext
}

// Resume AudioContext if it's suspended (required after user interaction on some browsers)
async function ensureAudioContextRunning(): Promise<void> {
  const ctx = getAudioContext()
  clientLogger.info('[usePlaySound] ensureAudioContextRunning', { currentState: ctx.state })
  if (ctx.state === 'suspended') {
    clientLogger.info('[usePlaySound] Resuming suspended AudioContext')
    await ctx.resume()
    clientLogger.info('[usePlaySound] AudioContext resumed', { newState: ctx.state })
  }
}

// Unlock audio on iOS - must be called from user interaction
function unlockAudioContext(): void {
  if (audioContextUnlocked) {
    clientLogger.info('[usePlaySound] AudioContext already unlocked')
    return
  }

  clientLogger.info('[usePlaySound] Unlocking AudioContext')
  const ctx = getAudioContext()

  // Create and play a silent buffer to unlock
  const buffer = ctx.createBuffer(1, 1, 22050)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(0)
  clientLogger.info('[usePlaySound] Played silent buffer to unlock')

  // Also resume if suspended
  if (ctx.state === 'suspended') {
    ctx.resume()
    clientLogger.info('[usePlaySound] Resumed suspended context during unlock')
  }

  audioContextUnlocked = true
  clientLogger.info('[usePlaySound] AudioContext unlocked successfully', { state: ctx.state })
}

// Cancel any pending unlock-triggered playback (e.g., when stopping sound)
function cancelPendingUnlockPlay() {
  if (!pendingUnlockPlayRef.active || !pendingUnlockPlayRef.handler) return
  unlockEvents.forEach(evt => document.removeEventListener(evt, pendingUnlockPlayRef.handler!, true))
  pendingUnlockPlayRef.active = false
  pendingUnlockPlayRef.handler = null
  clientLogger.info('[usePlaySound] cancelPendingUnlockPlay: listeners removed')
}

// Queue a play attempt to run right after the next user interaction unlocks audio on iOS
function schedulePlayAfterUnlock(playFallback: () => void, soundPath: string, shouldBePlayingRef: MutableRefObject<boolean>) {
  if (pendingUnlockPlayRef.active) {
    clientLogger.info('[usePlaySound] schedulePlayAfterUnlock skipped (already pending)', { soundPath })
    return
  }

  const handler = (event: Event) => {
    clientLogger.info('[usePlaySound] schedulePlayAfterUnlock: user interaction', { eventType: event.type, soundPath, shouldBePlaying: shouldBePlayingRef.current })
    if (!shouldBePlayingRef.current) {
      clientLogger.info('[usePlaySound] schedulePlayAfterUnlock: skipping play because shouldBePlayingRef=false', { soundPath })
      cancelPendingUnlockPlay()
      return
    }

    unlockAudioContext()
    playFallback()
    cancelPendingUnlockPlay()
  }

  pendingUnlockPlayRef.active = true
  pendingUnlockPlayRef.handler = handler
  unlockEvents.forEach(evt => document.addEventListener(evt, handler, true))
  clientLogger.info('[usePlaySound] schedulePlayAfterUnlock: listeners registered', { soundPath, events: unlockEvents })
}

// Set up global unlock listener for iOS
if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown']
  const unlockHandler = (event: Event) => {
    clientLogger.info('[usePlaySound] User interaction detected, unlocking audio', { eventType: event.type })
    unlockAudioContext()
    // Remove listeners after first interaction
    unlockEvents.forEach(evt => {
      document.removeEventListener(evt, unlockHandler, true)
    })
    clientLogger.info('[usePlaySound] Removed unlock event listeners')
  }
  unlockEvents.forEach(event => {
    document.addEventListener(event, unlockHandler, true)
  })
  clientLogger.info('[usePlaySound] Registered unlock event listeners', { events: unlockEvents })
}

export function usePlaySound(soundPath: string, options: PlaySoundOptions = {}) {
  const { loop = false, volume = 1, resumeOnVisibilityChange = false } = options
  const [isPlaying, setIsPlaying] = useState(false)
  const shouldBePlayingRef = useRef(false)
  const audioBufferRef = useRef<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const isLoadingRef = useRef(false)

  // Fallback HTMLAudioElement for iOS if Web Audio fails
  const audioElementRef = useRef<HTMLAudioElement | null>(null)

  // Load audio file into buffer
  const loadAudio = useCallback(async () => {
    if (audioBufferRef.current || isLoadingRef.current) {
      clientLogger.info('[usePlaySound] loadAudio skipped', {
        soundPath,
        hasBuffer: !!audioBufferRef.current,
        isLoading: isLoadingRef.current
      })
      return
    }

    isLoadingRef.current = true
    clientLogger.info('[usePlaySound] loadAudio starting', { soundPath })
    try {
      const response = await fetch(soundPath)
      clientLogger.info('[usePlaySound] fetch response', { soundPath, status: response.status, ok: response.ok })
      const arrayBuffer = await response.arrayBuffer()
      clientLogger.info('[usePlaySound] arrayBuffer received', { soundPath, byteLength: arrayBuffer.byteLength })
      const audioContext = getAudioContext()
      clientLogger.info('[usePlaySound] decoding audio data', { soundPath, contextState: audioContext.state })
      audioBufferRef.current = await audioContext.decodeAudioData(arrayBuffer)
      clientLogger.info('[usePlaySound] audio decoded successfully', {
        soundPath,
        duration: audioBufferRef.current.duration,
        numberOfChannels: audioBufferRef.current.numberOfChannels,
        sampleRate: audioBufferRef.current.sampleRate
      })
    } catch (err) {
      clientLogger.error('[usePlaySound] Error loading sound', { soundPath, error: String(err) })
    } finally {
      isLoadingRef.current = false
    }
  }, [soundPath])

  // Preload audio on mount
  useEffect(() => {
    clientLogger.info('[usePlaySound] useEffect mount - preloading audio', { soundPath, isIOS })
    loadAudio()

    // Also create HTMLAudioElement as fallback for iOS
    if (isIOS && !audioElementRef.current) {
      clientLogger.info('[usePlaySound] Creating iOS fallback HTMLAudioElement', { soundPath })
      audioElementRef.current = new Audio(soundPath)
      audioElementRef.current.loop = loop
      audioElementRef.current.volume = volume
      // Preload
      audioElementRef.current.load()
      clientLogger.info('[usePlaySound] iOS fallback HTMLAudioElement created and loading', { soundPath })
    }

    return () => {
      clientLogger.info('[usePlaySound] useEffect cleanup', { soundPath })
      // Cleanup: stop any playing sound
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.stop()
          sourceNodeRef.current.disconnect()
        } catch {
          // Ignore errors if already stopped
        }
        sourceNodeRef.current = null
      }
      if (gainNodeRef.current) {
        gainNodeRef.current.disconnect()
        gainNodeRef.current = null
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
    }
  }, [loadAudio, loop, volume, soundPath])

  // Handle visibility change - resume playing when page becomes visible
  useEffect(() => {
    if (!resumeOnVisibilityChange) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldBePlayingRef.current) {
        // Page became visible and sound should be playing - try to resume
        ensureAudioContextRunning().then(() => {
          if (shouldBePlayingRef.current && !sourceNodeRef.current) {
            playInternal()
          }
        }).catch(() => {
          // Ignore errors
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [resumeOnVisibilityChange])

  // Internal play function using Web Audio API
  const playInternal = useCallback(() => {
    clientLogger.info('[usePlaySound] playInternal called', {
      soundPath,
      hasBuffer: !!audioBufferRef.current,
      isIOS
    })
    if (!audioBufferRef.current) {
      clientLogger.warn('[usePlaySound] playInternal: no audio buffer available')
      return false
    }

    try {
      const audioContext = getAudioContext()
      clientLogger.info('[usePlaySound] playInternal: got AudioContext', { state: audioContext.state })

      // Stop any currently playing source
      if (sourceNodeRef.current) {
        clientLogger.info('[usePlaySound] playInternal: stopping existing source')
        try {
          sourceNodeRef.current.stop()
          sourceNodeRef.current.disconnect()
        } catch {
          // Ignore if already stopped
        }
      }

      // Create new source node
      const sourceNode = audioContext.createBufferSource()
      sourceNode.buffer = audioBufferRef.current
      sourceNode.loop = loop

      // Create gain node for volume control
      const gainNode = audioContext.createGain()
      gainNode.gain.value = volume

      // Connect: source -> gain -> destination
      sourceNode.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Handle end of playback
      sourceNode.onended = () => {
        clientLogger.info('[usePlaySound] playInternal: source ended', { soundPath, loop })
        if (!loop) {
          setIsPlaying(false)
          sourceNodeRef.current = null
        }
      }

      // Start playback
      clientLogger.info('[usePlaySound] playInternal: starting source.start(0)', { soundPath })
      sourceNode.start(0)
      sourceNodeRef.current = sourceNode
      gainNodeRef.current = gainNode
      setIsPlaying(true)
      clientLogger.info('[usePlaySound] playInternal: playback started successfully', { soundPath })
      return true
    } catch (err) {
      clientLogger.error('[usePlaySound] playInternal error', { soundPath, error: String(err) })
      return false
    }
  }, [loop, volume, soundPath])

  // Fallback play using HTMLAudioElement (for iOS)
  const playFallback = useCallback(() => {
    clientLogger.info('[usePlaySound] playFallback called', { soundPath, hasAudioElement: !!audioElementRef.current })
    if (!audioElementRef.current) {
      clientLogger.info('[usePlaySound] playFallback: creating new Audio element')
      audioElementRef.current = new Audio(soundPath)
      audioElementRef.current.loop = loop
      audioElementRef.current.volume = volume
    }

    audioElementRef.current.currentTime = 0
    clientLogger.info('[usePlaySound] playFallback: calling play()', { soundPath })
    const playPromise = audioElementRef.current.play()

    if (playPromise) {
      playPromise
        .then(() => {
          clientLogger.info('[usePlaySound] playFallback: play() succeeded', { soundPath })
          setIsPlaying(true)
        })
        .catch(err => {
          if (err.name === 'NotAllowedError') {
            clientLogger.info('[usePlaySound] playFallback blocked by autoplay (NotAllowedError)', { soundPath })
            // If iOS blocks autoplay, retry right after user interaction unlocks audio
            if (isIOS && shouldBePlayingRef.current) {
              schedulePlayAfterUnlock(playFallback, soundPath, shouldBePlayingRef)
            }
          } else if (err.name !== 'AbortError') {
            clientLogger.error('[usePlaySound] playFallback: play() failed', {
              soundPath,
              errorName: err.name,
              errorMessage: err.message
            })
          }
          setIsPlaying(false)
        })
    } else {
      clientLogger.warn('[usePlaySound] playFallback: play() returned no promise', { soundPath })
    }
  }, [soundPath, loop, volume])

  // Play sound function
  const play = useCallback(async () => {
    clientLogger.info('[usePlaySound] play() called', {
      soundPath,
      isIOS,
      hasBuffer: !!audioBufferRef.current,
      hasSourceNode: !!sourceNodeRef.current,
      audioContextUnlocked
    })
    shouldBePlayingRef.current = true

    // Ensure audio is loaded
    if (!audioBufferRef.current) {
      clientLogger.info('[usePlaySound] play(): no buffer, loading audio', { soundPath })
      await loadAudio()
    }

    // Check if already playing
    if (sourceNodeRef.current) {
      clientLogger.info('[usePlaySound] play(): already playing, skipping', { soundPath })
      return
    }

    // On iOS, check if AudioContext is suspended - if so, use HTMLAudioElement fallback immediately
    // because ctx.resume() only works during user interaction and will hang otherwise
    if (isIOS) {
      const ctx = getAudioContext()
      clientLogger.info('[usePlaySound] play(): iOS detected, checking AudioContext state', {
        soundPath,
        contextState: ctx.state
      })

      if (ctx.state === 'suspended') {
        clientLogger.info('[usePlaySound] play(): iOS AudioContext suspended, using HTMLAudioElement fallback', { soundPath })
        playFallback()
        return
      }
    }

    try {
      clientLogger.info('[usePlaySound] play(): ensuring AudioContext is running')
      await ensureAudioContextRunning()

      // Try Web Audio first
      clientLogger.info('[usePlaySound] play(): trying Web Audio API', {
        soundPath,
        hasBuffer: !!audioBufferRef.current
      })
      const webAudioSuccess = audioBufferRef.current && playInternal()
      clientLogger.info('[usePlaySound] play(): Web Audio result', { soundPath, webAudioSuccess, isIOS })

      // If Web Audio failed on iOS, use fallback
      if (!webAudioSuccess && isIOS) {
        clientLogger.info('[usePlaySound] play(): Web Audio failed on iOS, trying fallback', { soundPath })
        playFallback()
      }
    } catch (err) {
      const errorName = (err as Error).name
      const errorMessage = (err as Error).message
      if (errorName === 'NotAllowedError') {
        clientLogger.info('[usePlaySound] play() blocked by autoplay (NotAllowedError)', { soundPath, isIOS })
      } else {
        clientLogger.error('[usePlaySound] play() error', {
          soundPath,
          isIOS,
          errorName,
          errorMessage
        })
      }
      // Web Audio failed, try fallback on iOS
      if (isIOS) {
        clientLogger.info('[usePlaySound] play(): exception on iOS, trying fallback', { soundPath })
        playFallback()
      }
      setIsPlaying(false)
    }
  }, [loadAudio, playInternal, playFallback, soundPath])

  // Stop sound function
  const stop = useCallback(() => {
    clientLogger.info('[usePlaySound] stop() called', {
      soundPath,
      hasSourceNode: !!sourceNodeRef.current,
      hasAudioElement: !!audioElementRef.current
    })
    shouldBePlayingRef.current = false

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
        clientLogger.info('[usePlaySound] stop(): Web Audio source stopped', { soundPath })
      } catch {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current = null
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect()
      gainNodeRef.current = null
    }

    // Also stop fallback audio element
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current.currentTime = 0
      clientLogger.info('[usePlaySound] stop(): HTMLAudioElement paused', { soundPath })
    }
    cancelPendingUnlockPlay()

    setIsPlaying(false)
  }, [soundPath])

  return { play, stop, isPlaying }
} 
