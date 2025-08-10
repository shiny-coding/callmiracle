/**
 * JWT utilities that work in both Edge Runtime and Node.js environments
 */

export interface DecodedJWT {
  sub?: string
  id?: string
  name?: string
  email?: string
  languages?: string[]
  logLevel?: string
  clientLogLevel?: string
  iat?: number
  exp?: number
  [key: string]: any
}

/**
 * Decode JWT payload without signature verification
 * Works in both Edge Runtime and Node.js
 * 
 * @param token - The JWT token string
 * @returns Decoded payload or null if invalid
 */
export function decodeJWTPayload(token: string): DecodedJWT | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decode JWT payload (base64url -> base64 -> utf8)
    const base64Payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(parts[1].length + (4 - parts[1].length % 4) % 4, '=')
    
    // Use atob in browser/edge runtime, Buffer in Node.js
    let payload: string
    if (typeof atob !== 'undefined') {
      // Edge Runtime / Browser
      payload = atob(base64Payload)
    } else {
      // Node.js
      payload = Buffer.from(base64Payload, 'base64').toString('utf-8')
    }
    
    return JSON.parse(payload)
  } catch (error) {
    return null
  }
}

/**
 * Check if a JWT token is expired
 * 
 * @param token - Decoded JWT payload
 * @returns true if expired, false if still valid
 */
export function isJWTExpired(token: DecodedJWT): boolean {
  if (!token.exp) {
    return false // No expiration claim
  }
  return Date.now() >= token.exp * 1000
}

/**
 * Get user ID from JWT payload
 * Checks both 'sub' and 'id' fields
 * 
 * @param token - Decoded JWT payload
 * @returns User ID string or null
 */
export function getUserIdFromJWT(token: DecodedJWT | null): string | null {
  if (!token) return null
  return token.sub || token.id || null
}

/**
 * Extract and decode JWT from cookie header string
 * Works in both environments
 * 
 * @param cookieHeader - Raw cookie header string
 * @returns Decoded JWT payload or null
 */
export function extractJWTFromCookieHeader(cookieHeader: string): DecodedJWT | null {
  try {
    // Parse cookies
    const cookies: Record<string, string> = {}
    cookieHeader.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=')
      if (key && value) {
        cookies[key] = decodeURIComponent(value)
      }
    })

    // Get NextAuth session token
    const sessionToken = cookies['next-auth.session-token'] || cookies['__Secure-next-auth.session-token']
    if (!sessionToken) return null

    return decodeJWTPayload(sessionToken)
  } catch (error) {
    return null
  }
}