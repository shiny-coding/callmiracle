import { LANGUAGES } from '@/config/languages'

export function getBrowserLanguage(): string[] {
  if (typeof window === 'undefined') return ['en']
  
  const browserLangs = navigator.languages || [navigator.language]
  const matches = new Set<string>()
  
  for (const lang of browserLangs) {
    const langCode = lang.toLowerCase().split('-')[0]
    const match = LANGUAGES.find(l => l.code === langCode)
    if (match) matches.add(match.code)
  }
  
  return matches.size ? Array.from(matches) : ['en']
} 