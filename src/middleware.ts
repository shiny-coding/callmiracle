import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import createIntlMiddleware from 'next-intl/middleware'
import { Locale, locales, defaultLocale } from './config'
import { getCurrentLocale } from './utils'

// Create internationalization middleware
const intlMiddleware = createIntlMiddleware({
  locales: locales,
  defaultLocale: defaultLocale
})

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Handle signin and signout redirects 
  if (pathname === '/auth/signin' || pathname === '/auth/signout') {
    // Allow the route handler to process the request
    return NextResponse.next()
  }
  
  // Check if the path is a public path (no auth needed)
  const isAuthPage = pathname.includes('/auth/signin')
  
  // For protected routes, check authentication
  if (!isAuthPage) {
    // Check for authentication token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })
    
    // Redirect to sign-in if no token
    if (!token) {
      // Preserve the original URL's locale
      const locale = getCurrentLocale(request) || pathname.split('/')[1] || 'en'
      // Handle cases where the first segment might not be a locale
      const signInPath = locales.includes(locale as Locale) 
        ? `/${locale}/auth/signin`
        : '/auth/signin'
        
      return NextResponse.redirect(new URL(signInPath, request.url))
    }
  }
  
  // Apply internationalization after auth check
  return intlMiddleware(request)
}

// Update the matcher to exclude sound files
export const config = {
  matcher: [
    // Match all paths except:
    // - API routes
    // - Next.js static files
    // - Next.js image optimization files
    // - Favicon
    // - Profile images
    // - PNG files
    // - Sound files (new exclusion)
    '/((?!api|_next/static|_next/image|favicon.ico|profiles|sounds|.*\\.png$).*)' 
  ]
}