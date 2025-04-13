import { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'

// Supported locales
const locales = ['en', 'ru']

// Server-side version of getDefaultLocale function
function getDefaultLocaleFromRequest(request: NextRequest): string {
  // Read the Accept-Language header
  const acceptLanguage = request.headers.get('Accept-Language') || ''
  
  // Parse language preferences
  const preferredLanguages = acceptLanguage
    .split(',')
    .map(lang => lang.split(';')[0].trim().toLowerCase().split('-')[0])
    
  // Find the first match
  for (const lang of preferredLanguages) {
    if (locales.includes(lang)) {
      return lang
    }
  }
  
  return 'en' // Fallback to English
}

export function GET(request: NextRequest) {
  // Get the preferred locale
  const locale = getDefaultLocaleFromRequest(request)
  
  // Get any search parameters to preserve them in the redirect
  const searchParams = request.nextUrl.searchParams.toString()
  const queryString = searchParams ? `?${searchParams}` : ''
  
  // Redirect to the localized sign-out page
  return redirect(`/${locale}/auth/signout${queryString}`)
} 