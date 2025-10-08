import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getLogger } from '@/utils/logger'

// 1x1 transparent PNG as base64
const TRANSPARENT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI/hRxuOAAAAASUVORK5CYII='

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ entityType: string; id: string }> }
) {
  try {
    const { entityType, id } = await params

    // Validate entity type
    if (entityType !== 'profiles' && entityType !== 'groups') {
      const logger = await getLogger()
      logger.warn('Invalid entity type requested', { entityType })
      return new NextResponse('Invalid entity type', { status: 400 })
    }

    // Remove .jpg extension if present in the id
    const cleanId = id.replace(/\.jpg$/, '')

    // Path to the image in the public directory
    const imagePath = path.join(process.cwd(), 'public', entityType, `${cleanId}.jpg`)

    // Determine header name based on entity type
    const headerName = entityType === 'profiles' ? 'X-Profile-Image' : 'X-Group-Image'

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
      // File doesn't exist, serve 1x1 transparent PNG with a custom header
      const transparentBuffer = Buffer.from(TRANSPARENT_PNG_BASE64, 'base64')

      return new NextResponse(transparentBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute only
          [headerName]: 'placeholder', // Custom header to identify placeholder
        },
      })
    }
  } catch (error) {
    const logger = await getLogger()
    const { entityType } = await params

    logger.error('Error serving image', {
      entityType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })

    // On error, also serve transparent PNG with placeholder header
    const transparentBuffer = Buffer.from(TRANSPARENT_PNG_BASE64, 'base64')
    const headerName = entityType === 'profiles' ? 'X-Profile-Image' : 'X-Group-Image'

    return new NextResponse(transparentBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
        [headerName]: 'placeholder',
      },
    })
  }
}
