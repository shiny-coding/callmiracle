import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import createIntlMiddleware from 'next-intl/middleware'
import { Locale, locales, defaultLocale } from './config'
import { getCurrentLocale } from './utils'
import { routing } from './i18n/routing'
import { generateShortRequestId } from './utils/commonUtils'
import { decodeJWTPayload, isJWTExpired } from './utils/jwt'
import { trackUserActivity } from './utils/sessionTracking'

// Create internationalization middleware
const intlMiddleware = createIntlMiddleware(routing)

// Add any other extensions you want to exclude
const PUBLIC_FILE = /\.(.*)$/i

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware for public files (e.g. .jpg, .png, .css, .js, .ico, etc)
  // Don't add headers to these since we don't need logging for static files
  if (PUBLIC_FILE.test(pathname)) {
    return NextResponse.next()
  }

  // Fix for reverse proxy sending comma-separated X-Forwarded-Host
  // This applies to ALL requests, not just /api/auth
  // NextAuth, GraphQL, and other APIs cannot handle comma-separated hosts
  const xForwardedHost = request.headers.get('x-forwarded-host')

  // If we have comma-separated hosts, clean them and continue with cleaned request
  if (xForwardedHost && xForwardedHost.includes(',')) {
    const firstHost = xForwardedHost.split(',')[0].trim()
    // Remove any protocol prefix if present (e.g., "https://call.callmiracle.com" -> "call.callmiracle.com")
    const cleanHost = firstHost.replace(/^https?:\/\//, '')

    // Create new headers with cleaned host
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-forwarded-host', cleanHost)
    requestHeaders.set('host', cleanHost)

    // Create new request with cleaned headers
    // IMPORTANT: We reassign 'request' and continue execution, not return early
    request = new NextRequest(request.url, {
      headers: requestHeaders,
      method: request.method,
    })
  }

  // Check for authentication token for all non-auth routes
  let token: any = null
  let sessionCookie: any = null

  const cookies = request.cookies
  sessionCookie = cookies.get('next-auth.session-token') || cookies.get('__Secure-next-auth.session-token')
  
  // Decode JWT for middleware using common utility
  if (sessionCookie) {
    token = decodeJWTPayload(sessionCookie.value)
    
    // Check if token is expired
    if (token && isJWTExpired(token)) {
      token = null
    }
  }
  

  // Generate request context - use existing requestId from headers if present
  const requestId = request.headers.get('x-request-id') || generateShortRequestId()
  const requestPath = pathname
  const requestMethod = request.method
  const requestTimestamp = Date.now().toString()
  const userAgent = request.headers.get('user-agent') || undefined
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             request.headers.get('x-client-ip') || 
             undefined


  // Helper function to add request context headers to any response
  function addRequestHeaders(response: NextResponse): NextResponse {
    response.headers.set('x-request-id', requestId)
    response.headers.set('x-request-path', requestPath)
    response.headers.set('x-request-method', requestMethod)
    response.headers.set('x-request-timestamp', requestTimestamp)
    if (userAgent) {
      response.headers.set('x-request-user-agent', userAgent)
    }
    if (ip) {
      response.headers.set('x-request-ip', ip)
    }
    if (token) {
      if (token.id) {
        response.headers.set('x-user-id', token.id)
        // Track user activity for session and active user metrics
        trackUserActivity(token.id)
      }
      if (token.name) {
        response.headers.set('x-user-name', token.name)
      }
    }
    return response
  }
  
  // Handle API routes - pass context through headers
  if (pathname.startsWith('/api/')) {
    return addRequestHeaders(NextResponse.next())
  }
  
  // Handle signin and signout redirects 
  if (pathname === '/auth/signin' || pathname === '/auth/signout') {
    // Allow the route handler to process the request
    return addRequestHeaders(NextResponse.next())
  }
  
  // Check if this is an auth route (allow access without authentication)
  const isAuthRoute = pathname.includes('/auth/')
  
  // Check if this is the first-time setup route
  const isFirstTimeRoute = pathname.includes('/first-time')
 


  if (!token && !isAuthRoute) {
    // Not authenticated: redirect to sign-in
    const locale = getCurrentLocale(request) || pathname.split('/')[1] || defaultLocale
    const signInPath = `/${locale}/auth/signin`
    return addRequestHeaders(NextResponse.redirect(new URL(signInPath, request.url)))
  }
      
  // If authenticated, check if user has completed first-time setup
  if (token && !isAuthRoute && !isFirstTimeRoute) {
    const userLanguages = token.languages as string[] | undefined
    if (!userLanguages || userLanguages.length === 0) {
      const locale = getCurrentLocale(request) || pathname.split('/')[1] || defaultLocale
      const firstTimePath = `/${locale}/first-time`
      return addRequestHeaders(NextResponse.redirect(new URL(firstTimePath, request.url)))
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
      return addRequestHeaders(NextResponse.redirect(new URL(calendarPath, request.url)))
    } else {
      // Not authenticated: redirect to sign-in
      const signInPath = `/${locale}/auth/signin`
      return addRequestHeaders(NextResponse.redirect(new URL(signInPath, request.url)))
    }
  }

  // For all other routes, run intlMiddleware after auth check
  const intlResponse = intlMiddleware(request)
  
  if (intlResponse) {
    return addRequestHeaders(intlResponse)
  }
  
  return addRequestHeaders(NextResponse.next())
}

// Update the matcher to include API routes but exclude static files
export const config = {
  matcher: [
    // Match all paths except:
    // - Next.js static files
    // - Next.js image optimization files
    // - Favicon
    // - PNG files
    // - Sound files
    '/((?!_next/static|_next/image|favicon.ico|sounds).*)' 
  ]
}