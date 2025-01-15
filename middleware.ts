import { NextRequest, NextResponse } from 'next/server'
import { locales, defaultLocale } from '@/config'

function getLocaleFromHeader(req: NextRequest): string {
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
  
  const match = languages.find(lang => locales.includes(lang.code as any))
  return match ? match.code : defaultLocale
}

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