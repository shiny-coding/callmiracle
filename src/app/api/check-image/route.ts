import { existsSync } from 'fs'
import { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    return NextResponse.json({ exists: false })
  }
  
  try {
    const imagePath = join(process.cwd(), 'public', 'profiles', `${userId}.jpg`)
    const exists = existsSync(imagePath)
    
    return NextResponse.json({ exists })
  } catch (error) {
    console.error('Error checking image:', error)
    return NextResponse.json({ exists: false })
  }
} 