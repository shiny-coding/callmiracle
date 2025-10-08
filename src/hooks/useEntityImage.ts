import { useState, useEffect } from 'react'

type EntityType = 'user' | 'group'

export function useEntityImage(
  entityType: EntityType,
  entityId: string | undefined,
  timestamp?: number
) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!entityId) {
      setImageSrc(undefined)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const basePath = entityType === 'user' ? 'profiles' : 'groups'
    const imageUrl = `/${basePath}/${entityId}.jpg${timestamp ? `?v=${timestamp}` : ''}`
    const headerName = entityType === 'user' ? 'X-Profile-Image' : 'X-Group-Image'

    // Fetch the image to check the custom header
    fetch(imageUrl, { method: 'HEAD' })
      .then(response => {
        // Check if it's a placeholder (1x1 transparent PNG)
        if (response.headers.get(headerName) === 'placeholder') {
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
  }, [entityType, entityId, timestamp])

  return { imageSrc, isLoading }
}
