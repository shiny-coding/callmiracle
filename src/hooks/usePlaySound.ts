import { useEffect, useRef } from 'react'

interface PlaySoundOptions {
  loop?: boolean
  volume?: number
}

export function usePlaySound(soundPath: string, options: PlaySoundOptions = {}) {
  const { loop = false, volume = 1 } = options
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Initialize audio on mount
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(soundPath)
      audioRef.current.loop = loop
      audioRef.current.volume = volume
    }
    
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current = null
      }
    }
  }, [soundPath, loop, volume])
  
  // Play sound function
  const play = () => {
    if (audioRef.current) {
      // Reset to beginning if already playing
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(err => 
        console.error(`Error playing sound ${soundPath}:`, err)
      )
    }
  }
  
  // Stop sound function
  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }
  
  return { play, stop }
} 