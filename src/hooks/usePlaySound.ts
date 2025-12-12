import { useEffect, useRef, useState, useCallback, type MutableRefObject } from 'react'
import clientLogger from '@/utils/clientLogger'

interface PlaySoundOptions {
  loop?: boolean
  volume?: number
  resumeOnVisibilityChange?: boolean // Resume playing when page becomes visible again
}

// Detect iOS
const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)

// Debug toggles to reduce noisy logging; set to true locally when investigating sound issues
const soundDebug = false
const soundLog = (message: string, meta: Record<string, any> = {}) => {
  if (!soundDebug) return
  clientLogger.info('Sound', message, meta)
}
const soundWarn = (message: string, meta: Record<string, any> = {}) => {
  if (!soundDebug) return
  clientLogger.warn('Sound', message, meta)
}
const soundError = (message: string, meta: Record<string, any> = {}) => {
  clientLogger.error('Sound', message, meta)
}

soundLog('Module loaded', { isIOS, userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A' })

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
    soundLog('Created new AudioContext', { state: sharedAudioContext.state })
  }
  return sharedAudioContext
}

// Resume AudioContext if it's suspended (required after user interaction on some browsers)
async function ensureAudioContextRunning(): Promise<void> {
  const ctx = getAudioContext()
  soundLog('ensureAudioContextRunning', { currentState: ctx.state })
  if (ctx.state === 'suspended') {
    soundLog('Resuming suspended AudioContext')
    await ctx.resume()
    soundLog('AudioContext resumed', { newState: ctx.state })
  }
}

// Unlock audio on iOS - must be called from user interaction
function unlockAudioContext(): void {
  if (audioContextUnlocked) {
    soundLog('AudioContext already unlocked')
    return
  }

  soundLog('Unlocking AudioContext')
  const ctx = getAudioContext()

  // Create and play a silent buffer to unlock
  const buffer = ctx.createBuffer(1, 1, 22050)
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.connect(ctx.destination)
  source.start(0)
  soundLog('Played silent buffer to unlock')

  // Also resume if suspended
  if (ctx.state === 'suspended') {
    ctx.resume()
    soundLog('Resumed suspended context during unlock')
  }

  audioContextUnlocked = true
  soundLog('AudioContext unlocked successfully', { state: ctx.state })
}

// Cancel any pending unlock-triggered playback (e.g., when stopping sound)
function cancelPendingUnlockPlay() {
  if (!pendingUnlockPlayRef.active || !pendingUnlockPlayRef.handler) return
  unlockEvents.forEach(evt => document.removeEventListener(evt, pendingUnlockPlayRef.handler!, true))
  pendingUnlockPlayRef.active = false
  pendingUnlockPlayRef.handler = null
  soundLog('cancelPendingUnlockPlay: listeners removed')
}

// Queue a play attempt to run right after the next user interaction unlocks audio on iOS
function schedulePlayAfterUnlock(playFallback: () => void, soundPath: string, shouldBePlayingRef: MutableRefObject<boolean>) {
  if (pendingUnlockPlayRef.active) {
    soundLog('schedulePlayAfterUnlock skipped (already pending)', { soundPath })
    return
  }

  const handler = (event: Event) => {
    soundLog('schedulePlayAfterUnlock: user interaction', { eventType: event.type, soundPath, shouldBePlaying: shouldBePlayingRef.current })
    if (!shouldBePlayingRef.current) {
      soundLog('schedulePlayAfterUnlock: skipping play because shouldBePlayingRef=false', { soundPath })
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
  soundLog('schedulePlayAfterUnlock: listeners registered', { soundPath, events: unlockEvents })
}

// Set up global unlock listener for iOS
if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown']
  const unlockHandler = (event: Event) => {
    soundLog('User interaction detected, unlocking audio', { eventType: event.type })
    unlockAudioContext()
    // Remove listeners after first interaction
    unlockEvents.forEach(evt => {
      document.removeEventListener(evt, unlockHandler, true)
    })
    soundLog('Removed unlock event listeners')
  }
  unlockEvents.forEach(event => {
    document.addEventListener(event, unlockHandler, true)
  })
  soundLog('Registered unlock event listeners', { events: unlockEvents })
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
      soundLog('loadAudio skipped', {
        soundPath,
        hasBuffer: !!audioBufferRef.current,
        isLoading: isLoadingRef.current
      })
      return
    }

    isLoadingRef.current = true
    soundLog('loadAudio starting', { soundPath })
    try {
      const response = await fetch(soundPath)
      soundLog('fetch response', { soundPath, status: response.status, ok: response.ok })
      const arrayBuffer = await response.arrayBuffer()
      soundLog('arrayBuffer received', { soundPath, byteLength: arrayBuffer.byteLength })
      const audioContext = getAudioContext()
      soundLog('decoding audio data', { soundPath, contextState: audioContext.state })
      audioBufferRef.current = await audioContext.decodeAudioData(arrayBuffer)
      soundLog('audio decoded successfully', {
        soundPath,
        duration: audioBufferRef.current.duration,
        numberOfChannels: audioBufferRef.current.numberOfChannels,
        sampleRate: audioBufferRef.current.sampleRate
      })
    } catch (err) {
      soundError('Error loading sound', { soundPath, error: String(err) })
    } finally {
      isLoadingRef.current = false
    }
  }, [soundPath])

  // Preload audio on mount
  useEffect(() => {
    soundLog('useEffect mount - preloading audio', { soundPath, isIOS })
    loadAudio()

    // Also create HTMLAudioElement as fallback for iOS
    if (isIOS && !audioElementRef.current) {
      soundLog('Creating iOS fallback HTMLAudioElement', { soundPath })
      audioElementRef.current = new Audio(soundPath)
      audioElementRef.current.loop = loop
      audioElementRef.current.volume = volume
      // Preload
      audioElementRef.current.load()
      soundLog('iOS fallback HTMLAudioElement created and loading', { soundPath })
    }

    return () => {
      soundLog('useEffect cleanup', { soundPath })
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
    soundLog('playInternal called', {
      soundPath,
      hasBuffer: !!audioBufferRef.current,
      isIOS
    })
    if (!audioBufferRef.current) {
      soundWarn('playInternal: no audio buffer available')
      return false
    }

    try {
      const audioContext = getAudioContext()
      soundLog('playInternal: got AudioContext', { state: audioContext.state })

      // Stop any currently playing source
      if (sourceNodeRef.current) {
        soundLog('playInternal: stopping existing source')
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
        soundLog('playInternal: source ended', { soundPath, loop })
        if (!loop) {
          setIsPlaying(false)
          sourceNodeRef.current = null
        }
      }

      // Start playback
      soundLog('playInternal: starting source.start(0)', { soundPath })
      sourceNode.start(0)
      sourceNodeRef.current = sourceNode
      gainNodeRef.current = gainNode
      setIsPlaying(true)
      soundLog('playInternal: playback started successfully', { soundPath })
      return true
    } catch (err) {
      soundError('playInternal error', { soundPath, error: String(err) })
      return false
    }
  }, [loop, volume, soundPath])

  // Fallback play using HTMLAudioElement (for iOS)
  const playFallback = useCallback(() => {
    soundLog('playFallback called', { soundPath, hasAudioElement: !!audioElementRef.current })
    if (!audioElementRef.current) {
      soundLog('playFallback: creating new Audio element')
      audioElementRef.current = new Audio(soundPath)
      audioElementRef.current.loop = loop
      audioElementRef.current.volume = volume
    }

    audioElementRef.current.currentTime = 0
    soundLog('playFallback: calling play()', { soundPath })
    const playPromise = audioElementRef.current.play()

    if (playPromise) {
      playPromise
        .then(() => {
          soundLog('playFallback: play() succeeded', { soundPath })
          setIsPlaying(true)
        })
        .catch(err => {
          if (err.name === 'NotAllowedError') {
            soundLog('playFallback blocked by autoplay (NotAllowedError)', { soundPath })
            // If iOS blocks autoplay, retry right after user interaction unlocks audio
            if (isIOS && shouldBePlayingRef.current) {
              schedulePlayAfterUnlock(playFallback, soundPath, shouldBePlayingRef)
            }
          } else if (err.name !== 'AbortError') {
            soundError('playFallback: play() failed', {
              soundPath,
              errorName: err.name,
              errorMessage: err.message
            })
          }
          setIsPlaying(false)
        })
    } else {
      soundWarn('playFallback: play() returned no promise', { soundPath })
    }
  }, [soundPath, loop, volume])

  // Play sound function
  const play = useCallback(async () => {
    soundLog('play() called', {
      soundPath,
      isIOS,
      hasBuffer: !!audioBufferRef.current,
      hasSourceNode: !!sourceNodeRef.current,
      audioContextUnlocked
    })
    shouldBePlayingRef.current = true

    // Ensure audio is loaded
    if (!audioBufferRef.current) {
      soundLog('play(): no buffer, loading audio', { soundPath })
      await loadAudio()
    }

    // Check if already playing
    if (sourceNodeRef.current) {
      soundLog('play(): already playing, skipping', { soundPath })
      return
    }

    // On iOS, check if AudioContext is suspended - if so, use HTMLAudioElement fallback immediately
    // because ctx.resume() only works during user interaction and will hang otherwise
    if (isIOS) {
      const ctx = getAudioContext()
      soundLog('play(): iOS detected, checking AudioContext state', {
        soundPath,
        contextState: ctx.state
      })

      if (ctx.state === 'suspended') {
        soundLog('play(): iOS AudioContext suspended, using HTMLAudioElement fallback', { soundPath })
        playFallback()
        return
      }
    }

    try {
      soundLog('play(): ensuring AudioContext is running')
      await ensureAudioContextRunning()

      // Try Web Audio first
      soundLog('play(): trying Web Audio API', {
        soundPath,
        hasBuffer: !!audioBufferRef.current
      })
      const webAudioSuccess = audioBufferRef.current && playInternal()
      soundLog('play(): Web Audio result', { soundPath, webAudioSuccess, isIOS })

      // If Web Audio failed on iOS, use fallback
      if (!webAudioSuccess && isIOS) {
        soundLog('play(): Web Audio failed on iOS, trying fallback', { soundPath })
        playFallback()
      }
    } catch (err) {
      const errorName = (err as Error).name
      const errorMessage = (err as Error).message
      if (errorName === 'NotAllowedError') {
        soundLog('play() blocked by autoplay (NotAllowedError)', { soundPath, isIOS })
      } else {
        soundError('play() error', {
          soundPath,
          isIOS,
          errorName,
          errorMessage
        })
      }
      // Web Audio failed, try fallback on iOS
      if (isIOS) {
        soundLog('play(): exception on iOS, trying fallback', { soundPath })
        playFallback()
      }
      setIsPlaying(false)
    }
  }, [loadAudio, playInternal, playFallback, soundPath])

  // Stop sound function
  const stop = useCallback(() => {
    soundLog('stop() called', {
      soundPath,
      hasSourceNode: !!sourceNodeRef.current,
      hasAudioElement: !!audioElementRef.current
    })
    shouldBePlayingRef.current = false

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop()
        sourceNodeRef.current.disconnect()
        soundLog('stop(): Web Audio source stopped', { soundPath })
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
      soundLog('stop(): HTMLAudioElement paused', { soundPath })
    }
    cancelPendingUnlockPlay()

    setIsPlaying(false)
  }, [soundPath])

  return { play, stop, isPlaying }
} 
