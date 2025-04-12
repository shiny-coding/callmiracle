import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  
  // Define public paths that don't require authentication
  const isPublicPath = path === '/auth/signin'
  
  const session = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })
  
  // Redirect unauthenticated users to login page
  if (!session && !isPublicPath) {
    return NextResponse.redirect(new URL('/auth/signin', req.url))
  }
  
  // Redirect authenticated users away from auth pages
  if (session && isPublicPath) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  
  return NextResponse.next()
}

// Specify which paths this middleware should run on
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|profiles).*)']
}