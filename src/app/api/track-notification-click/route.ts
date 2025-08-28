import { NextRequest, NextResponse } from 'next/server'
import { pushNotificationsClickedMetric } from '@/utils/metrics'

export async function POST(request: NextRequest) {
  try {
    // Track notification click
    pushNotificationsClickedMetric.add(1)
    console.log('📊 Push notification clicked')
    
    return new NextResponse(JSON.stringify({ success: true }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error('Error tracking notification click:', error)
    return new NextResponse(JSON.stringify({ error: 'Failed to track click' }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    })
  }
}