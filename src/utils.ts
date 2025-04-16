import { NextRequest } from 'next/server'
import { defaultLocale, locales } from '@/config'

// Supported locales
const supportedLocales = ['en', 'ru']

export function getLocaleFromHeader(req: NextRequest): string {
  const acceptLanguage = req.headers.get('accept-language')
  if (!acceptLanguage) return defaultLocale
  
  const languages = acceptLanguage.split(',')
    .map(lang => {
      const [code, q = '1'] = lang.split(';q=')
      return {
        code: code.split('-')[0].toLowerCase(),
        q: parseFloat(q)
      }
    })
    .sort((a, b) => b.q - a.q) // Sort by quality value
  
  const match = languages.find(lang => supportedLocales.includes(lang.code as any))
  return match ? match.code : defaultLocale
}