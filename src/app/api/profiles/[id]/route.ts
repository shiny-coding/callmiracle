import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// 1x1 transparent PNG as base64
const TRANSPARENT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hRxuOAAAAASUVORK5CYII='

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    
    // Remove .jpg extension if present in the id
    const cleanId = id.replace(/\.jpg$/, '')
    
    // Path to the profile image in the public directory
    const imagePath = path.join(process.cwd(), 'public', 'profiles', `${cleanId}.jpg`)
    
    // Check if the file exists
    if (existsSync(imagePath)) {
      // File exists, serve it
      const imageBuffer = await readFile(imagePath)
      
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        },
      })
    } else {
      // File doesn't exist, serve transparent PNG
      const transparentBuffer = Buffer.from(TRANSPARENT_PNG_BASE64, 'base64')
      
      return new NextResponse(transparentBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        },
      })
    }
  } catch (error) {
    console.error('Error serving profile image:', error)
    
    // On error, also serve transparent PNG
    const transparentBuffer = Buffer.from(TRANSPARENT_PNG_BASE64, 'base64')
    
    return new NextResponse(transparentBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  }
} 