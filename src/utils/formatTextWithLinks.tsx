const URL_REGEX = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+\.[^\s]+)/g

export const formatTextWithLinks = (text: string) => {
  if (!text) return []

  const parts = text.split(URL_REGEX)
  return parts.filter(Boolean).map((part, i) => {
    if (part.match(URL_REGEX)) {
      const url = part.startsWith('http') ? part : `https://${part}`
      return (
        <a 
          key={i}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part
  })
} 