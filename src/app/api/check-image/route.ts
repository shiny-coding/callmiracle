import { existsSync } from 'fs'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getLogger } from '@/utils/logger'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    const logger = await getLogger()
    logger.warn('Image check missing userId parameter')
    return NextResponse.json({ exists: false })
  }
  
  try {
    const imagePath = join(process.cwd(), 'public', 'profiles', `${userId}.jpg`)
    const exists = existsSync(imagePath)
    
    
    return NextResponse.json({ exists })
  } catch (error) {
    const logger = await getLogger()
    logger.error('Error checking image', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return NextResponse.json({ exists: false })
  }
} 