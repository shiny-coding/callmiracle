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
  
  // Check if this is an auth route (allow access without authentication)
  const isAuthRoute = pathname.includes('/auth/')
  
  // Check if this is the first-time setup route
  const isFirstTimeRoute = pathname.includes('/first-time')
  
  // Check for authentication token for all non-auth routes
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token && !isAuthRoute) {
    // Not authenticated: redirect to sign-in
    const locale = getCurrentLocale(request) || pathname.split('/')[1] || defaultLocale
    const signInPath = `/${locale}/auth/signin`
    return NextResponse.redirect(new URL(signInPath, request.url))
  }
  console.log( 'token', token)
  // If authenticated, check if user has completed first-time setup
  if (token && !isAuthRoute && !isFirstTimeRoute) {
    const userLanguages = token.languages as string[] | undefined
    if (!userLanguages || userLanguages.length === 0) {
      const locale = getCurrentLocale(request) || pathname.split('/')[1] || defaultLocale
      const firstTimePath = `/${locale}/first-time`
      return NextResponse.redirect(new URL(firstTimePath, request.url))
    }
  }
  
  // Check if the path is root or a locale root (e.g. /, /en, /fr)
  const isRoot = pathname === '/'
  const isLocaleRoot = locales.some(locale => pathname === `/${locale}`)

  if (isRoot || isLocaleRoot) {
    // Figure out the locale to use
    const locale = getCurrentLocale(request) || pathname.split('/')[1] || defaultLocale

    if (token) {
      // Authenticated: redirect to calendar
      const calendarPath = locales.includes(locale as Locale)
        ? `/${locale}/calendar`
        : `/${defaultLocale}/calendar`
      return NextResponse.redirect(new URL(calendarPath, request.url))
    } else {
      // Not authenticated: redirect to sign-in
      const signInPath = `/${locale}/auth/signin`
      return NextResponse.redirect(new URL(signInPath, request.url))
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