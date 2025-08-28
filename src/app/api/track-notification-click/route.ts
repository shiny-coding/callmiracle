import { NextRequest, NextResponse } from 'next/server'
import { pushNotificationsClickedMetric } from '@/utils/metrics'
import { getLogger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  const logger = await getLogger()
  
  try {
    // Track notification click
    pushNotificationsClickedMetric.add(1)
    
    return new NextResponse(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    logger.error('Error tracking notification click', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return new NextResponse(JSON.stringify({ error: 'Failed to track click' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    })
  }
}