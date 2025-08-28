import { NextRequest, NextResponse } from 'next/server'
import { getLogger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  const logger = await getLogger()
  
  try {
    const { preferredServerId } = await request.json()
    
    const response = NextResponse.json({ success: true })
    
    if (preferredServerId && preferredServerId !== 'auto') {
      // Set cookie for server selection
      response.cookies.set('preferred_server', preferredServerId, {
        maxAge: 30 * 24 * 60 * 60, // 30 days
        httpOnly: false, // Allow client-side access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      })
      logger.info('Server preference set', { preferredServerId })
    } else {
      // Remove cookie for auto selection
      response.cookies.delete('preferred_server')
      logger.info('Server preference cleared (auto mode)')
    }
    
    return response
  } catch (error) {
    logger.error('Error setting server preference', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json(
      { error: 'Failed to set server preference' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    serverId: process.env.SERVER_ID || 'unknown',
    availableServers: ['auto', '1', '2', '3']
  })
}