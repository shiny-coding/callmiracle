import { NextRequest, NextResponse } from 'next/server'
import { unlink } from 'fs/promises'
import path from 'path'

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const photoPath = path.join(process.cwd(), 'public', 'profiles', `${userId}.jpg`)
    
    try {
      await unlink(photoPath)
      return NextResponse.json({ success: true })
    } catch (error: any) {
      // If file doesn't exist, that's okay - consider it already deleted
      if (error.code === 'ENOENT') {
        return NextResponse.json({ success: true })
      }
      throw error
    }
  } catch (error) {
    console.error('Error deleting photo:', error)
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 })
  }
} 