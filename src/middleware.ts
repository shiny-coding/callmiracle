import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import createIntlMiddleware from 'next-intl/middleware'
import { Locale, locales, defaultLocale } from './config'
import { getCurrentLocale } from './utils'
import { routing } from './i18n/routing'

// Create internationalization middleware
const intlMiddleware = createIntlMiddleware(routing)

// Add any other extensions you want to exclude
const PUBLIC_FILE = /\.(.*)$/i

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Handle profile image requests FIRST - rewrite /profiles/{id}.jpg to /api/profiles/{id}.jpg
  if (pathname.startsWith('/profiles/') && pathname.endsWith('.jpg')) {
    const rewriteUrl = new URL(`/api${pathname}`, request.url)
    return NextResponse.rewrite(rewriteUrl)
  }

  // Skip middleware for public files (e.g. .jpg, .png, .css, .js, .ico, etc)
  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next()
  }
  
  // Handle signin and signout redirects 
  if (pathname === '/auth/signin' || pathname === '/auth/signout') {
    // Allow the route handler to process the request
    return NextResponse.next()
  }
  
  // Check if the path is root or a locale root (e.g. /, /en, /fr)
  const isRoot = pathname === '/'
  const isLocaleRoot = locales.some(locale => pathname === `/${locale}`)

  if (isRoot || isLocaleRoot) {
    // Figure out the locale to use
    const locale = getCurrentLocale(request) || pathname.split('/')[1] || defaultLocale

    // Check for authentication token
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      // Not authenticated: redirect to sign-in
      const signInPath = locales.includes(locale as Locale)
        ? `/${locale}/auth/signin`
        : '/auth/signin'
      return NextResponse.redirect(new URL(signInPath, request.url))
    } else {
      // Authenticated: redirect to calendar
      const calendarPath = locales.includes(locale as Locale)
        ? `/${locale}/calendar`
        : `/${defaultLocale}/calendar`
      return NextResponse.redirect(new URL(calendarPath, request.url))
    }
  }

  
  // For all other routes, run intlMiddleware after auth check
  return intlMiddleware(request)
}

// Update the matcher to include profile images but exclude sound files
export const config = {
  matcher: [
    // Match all paths except:
    // - API routes
    // - Next.js static files
    // - Next.js image optimization files
    // - Favicon
    // - PNG files
    // - Sound files (new exclusion)
    '/((?!api|_next/static|_next/image|favicon.ico|sounds).*)' 
  ]
}