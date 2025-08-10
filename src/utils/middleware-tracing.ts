import { NextRequest, NextResponse } from 'next/server'

export function createMiddlewareSpanName(request: NextRequest): string {
  const pathname = request.url
  const method = request.method

  // Create meaningful span names
  if (pathname.startsWith('/api/graphql')) {
    return `GraphQL ${pathname}`
  } else if (pathname.startsWith('/api/')) {
    const apiPath = pathname.replace('/api/', '').split('/')[0]
    return `API ${method} /${apiPath}`
  } else if (pathname === '/' || pathname.match(/^\/[a-z]{2}(\/|$)/)) {
    return `Page ${method} ${pathname}`
  } else if (pathname.startsWith('/_next/')) {
    return `Next.js ${method} /_next/`
  } else if (pathname.includes(".")) {
    return `Static ${method} ${pathname}`
  } else {
    const pagePath = pathname.split('/').filter(Boolean).slice(-1)[0] || 'root'
    return `Page ${method} /${pagePath}`
  }
}

export function shouldSamplePath(pathname: string): boolean {

  // Create meaningful span names
  if (pathname.startsWith('/api/graphql')) {
    return true
  } else if (pathname.startsWith('/api/')) {
    return true
  } else if (pathname === '/' || pathname.match(/^\/[a-z]{2}(\/|$)/)) {
    return true
  } else if (pathname.startsWith('/_next/')) {
    return false
  } else if (pathname.startsWith('/loki/')) {
    return false
  } else if (pathname.includes(".")) {
    return false
  } else {
    return true
  }
}