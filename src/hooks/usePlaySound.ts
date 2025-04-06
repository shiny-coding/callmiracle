import { useEffect, useRef, useState } from 'react'

interface PlaySoundOptions {
  loop?: boolean
  volume?: number
}

export function usePlaySound(soundPath: string, options: PlaySoundOptions = {}) {
  const { loop = false, volume = 1 } = options
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const playPromiseRef = useRef<Promise<void> | null>(null)
  
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
    if (audioRef.current && !isPlaying) {
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
          // Only log errors that aren't AbortError (which is expected when stopping)
          if (err.name !== 'AbortError') {
            console.error(`Error playing sound ${soundPath}:`, err)
          }
          setIsPlaying(false)
          playPromiseRef.current = null
        })
    }
  }
  
  // Stop sound function
  const stop = () => {
    safeStop()
  }
  
  return { play, stop, isPlaying }
} 