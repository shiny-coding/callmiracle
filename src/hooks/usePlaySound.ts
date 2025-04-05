import { useEffect, useRef, useState } from 'react'

interface PlaySoundOptions {
  loop?: boolean
  volume?: number
}

export function usePlaySound(soundPath: string, options: PlaySoundOptions = {}) {
  const { loop = false, volume = 1 } = options
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  
  // Initialize audio on mount
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(soundPath)
      audioRef.current.loop = loop
      audioRef.current.volume = volume
      
      // Add ended event listener to update isPlaying state
      audioRef.current.addEventListener('ended', () => {
        if (!loop) {
          setIsPlaying(false)
        }
      })
    }
    
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
        audioRef.current.removeEventListener('ended', () => {
          setIsPlaying(false)
        })
        audioRef.current = null
        setIsPlaying(false)
      }
    }
  }, [soundPath, loop, volume])
  
  // Play sound function
  const play = () => {
    if (audioRef.current) {
      // Reset to beginning if already playing
      audioRef.current.currentTime = 0
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true)
        })
        .catch(err => {
          console.error(`Error playing sound ${soundPath}:`, err)
          setIsPlaying(false)
        })
    }
  }
  
  // Stop sound function
  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    }
  }
  
  return { play, stop, isPlaying }
} 