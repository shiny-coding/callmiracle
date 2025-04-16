import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from '@/config'
import { getLocaleFromHeader } from '@/utils'

export function middleware(req: NextRequest) {
  if (
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.includes('/api/') ||
    /\.(.*)$/.test(req.nextUrl.pathname)
  ) {
    return
  }

  const pathname = req.nextUrl.pathname
  if (pathname === '/') {
    const locale = req.cookies.get('NEXT_LOCALE')?.value || getLocaleFromHeader(req)
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, req.url))
  }
}

export const config = {
  matcher: ['/', '/((?!_next|api|.*\\.).*)']
} 