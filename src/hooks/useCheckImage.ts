import { useState, useEffect } from 'react'

interface CheckImageResult {
  exists: boolean
  checking: boolean
}

export function useCheckImage(userId: string | undefined): CheckImageResult {
  const [state, setState] = useState<CheckImageResult>({
    exists: false,
    checking: true
  })

  useEffect(() => {
    if (!userId) {
      setState({ exists: false, checking: false })
      return
    }

    const checkImageExists = async () => {
      setState(prev => ({ ...prev, checking: true }))
      
      try {
        const response = await fetch(`/api/check-image?userId=${userId}`)
        const data = await response.json()
        setState({ exists: data.exists, checking: false })
      } catch (error) {
        console.error('Error checking image:', error)
        setState({ exists: false, checking: false })
      }
    }
    
    checkImageExists()
  }, [userId])

  return state
} 