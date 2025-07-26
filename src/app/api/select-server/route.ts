import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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
    } else {
      // Remove cookie for auto selection
      response.cookies.delete('preferred_server')
    }
    
    return response
  } catch (error) {
    console.error('Error setting server preference:', error)
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