import { useEffect, useRef, useState } from 'react'

interface PlaySoundOptions {
  loop?: boolean
  volume?: number
  resumeOnVisibilityChange?: boolean // Resume playing when page becomes visible again
}

export function usePlaySound(soundPath: string, options: PlaySoundOptions = {}) {
  const { loop = false, volume = 1, resumeOnVisibilityChange = false } = options
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const playPromiseRef = useRef<Promise<void> | null>(null)
  const shouldBePlayingRef = useRef(false) // Track if sound should be playing (for visibility change handling)
  
  // Initialize audio on mount
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(soundPath)
      audioRef.current.loop = loop
      audioRef.current.volume = volume
      
      // Add ended event listener to update isPlaying state
      const handleEnded = () => {
        if (!loop) {
          setIsPlaying(false)
        }
      }
      
      audioRef.current.addEventListener('ended', handleEnded)
      
      // Cleanup on unmount
      return () => {
        if (audioRef.current) {
          // Safely stop audio
          safeStop()
          audioRef.current.removeEventListener('ended', handleEnded)
          audioRef.current = null
          setIsPlaying(false)
        }
      }
    }
  }, [soundPath, loop, volume])

  // Handle visibility change - resume playing when page becomes visible
  useEffect(() => {
    if (!resumeOnVisibilityChange) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && shouldBePlayingRef.current && audioRef.current) {
        // Page became visible and sound should be playing - try to resume
        const actuallyPlaying = !audioRef.current.paused && !audioRef.current.ended
        if (!actuallyPlaying) {
          audioRef.current.play().catch(() => {
            // Autoplay might be blocked, that's ok
          })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [resumeOnVisibilityChange])

  // Safely stop audio, handling any pending play promises
  const safeStop = () => {
    if (audioRef.current) {
      if (playPromiseRef.current) {
        // If there's a pending play promise, wait for it to resolve before pausing
        playPromiseRef.current
          .then(() => {
            if (audioRef.current) {
              audioRef.current.pause()
              audioRef.current.currentTime = 0
            }
            setIsPlaying(false)
            playPromiseRef.current = null
          })
          .catch(() => {
            // If play was aborted or failed, just reset state
            setIsPlaying(false)
            playPromiseRef.current = null
          })
      } else {
        // No pending play promise, safe to pause immediately
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        setIsPlaying(false)
      }
    }
  }
  
  // Play sound function
  const play = () => {
    shouldBePlayingRef.current = true

    if (audioRef.current) {
      // Check if audio is actually playing (not just state says so)
      // This handles cases where the OS paused the audio (e.g., screen lock/unlock)
      const actuallyPlaying = !audioRef.current.paused && !audioRef.current.ended

      if (actuallyPlaying) {
        // Already playing, nothing to do
        return
      }

      // Reset to beginning
      audioRef.current.currentTime = 0

      // Store the play promise to handle it properly
      playPromiseRef.current = audioRef.current.play()

      playPromiseRef.current
        .then(() => {
          setIsPlaying(true)
          // Clear the promise ref once it's resolved
          playPromiseRef.current = null
        })
        .catch(err => {
          // Suppress expected errors:
          // - AbortError: when stopping
          // - NotAllowedError: browser autoplay policy (requires user interaction)
          if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
            console.error(`Error playing sound ${soundPath}:`, err)
          } else if (err.name === 'NotAllowedError') {
            console.log(`Sound ${soundPath} blocked by browser autoplay policy - requires user interaction`)
          }
          setIsPlaying(false)
          playPromiseRef.current = null
        })
    }
  }
  
  // Stop sound function
  const stop = () => {
    shouldBePlayingRef.current = false
    safeStop()
  }
  
  return { play, stop, isPlaying }
} 