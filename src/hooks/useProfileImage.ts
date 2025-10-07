import { useState, useEffect } from 'react'

export function useProfileImage(userId: string | undefined, timestamp?: number) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setImageSrc(undefined)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const imageUrl = `/profiles/${userId}.jpg${timestamp ? `?v=${timestamp}` : ''}`

    // Fetch the image to check the custom header
    fetch(imageUrl, { method: 'HEAD' })
      .then(response => {
        // Check if it's a placeholder (1x1 transparent PNG)
        if (response.headers.get('X-Profile-Image') === 'placeholder') {
          setImageSrc(undefined)
          setIsLoading(false)
        } else {
          // Real image exists, set the source
          setImageSrc(imageUrl)
          setIsLoading(false)
        }
      })
      .catch(() => {
        // On error, treat as no image
        setImageSrc(undefined)
        setIsLoading(false)
      })
  }, [userId, timestamp])

  return { imageSrc, isLoading }
}
