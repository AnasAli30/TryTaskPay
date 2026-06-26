import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { getNeynarApiKey, logNeynarHttpFailure, NEYNAR_API_BASE_URL } from '@/lib/neynar'
import type { NeynarUser } from '@/types/neynar'

export const dynamic = 'force-dynamic'

interface CachedUser {
  fid: number
  userData: NeynarUser
  cachedAt: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fid = searchParams.get('fid')

    if (!fid) {
      return NextResponse.json(
        { error: 'fid query parameter is required' },
        { status: 400 }
      )
    }

    const fidNumber = parseInt(fid, 10)
    if (isNaN(fidNumber)) {
      return NextResponse.json(
        { error: 'Invalid fid' },
        { status: 400 }
      )
    }

    // Get database connection
    const db = await getDatabase()
    const collection = db.collection<CachedUser>('cached_users')

    // Check if user exists in cache (cache valid for 24 hours)
    const cached = await collection.findOne({ fid: fidNumber })
    const now = Date.now()
    const cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours

    if (cached && (now - cached.cachedAt) < cacheExpiry) {
      return NextResponse.json({
        success: true,
        data: cached.userData,
        cached: true,
      })
    }

    // Fetch from Neynar API
    const apiKey = getNeynarApiKey()
    const url = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${fidNumber}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    })

    if (!response.ok) {
      await logNeynarHttpFailure(response, apiKey, url, 'user/cache user/bulk')
      return NextResponse.json(
        { error: 'Failed to fetch user from Neynar API' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const user = data.users?.[0]

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Save to cache
    await collection.updateOne(
      { fid: fidNumber },
      {
        $set: {
          fid: fidNumber,
          userData: user,
          cachedAt: now,
        },
      },
      { upsert: true }
    )

    return NextResponse.json({
      success: true,
      data: user,
      cached: false,
    })
  } catch (error) {
    console.error('Error in user cache API route:', error)
    if (error instanceof Error && error.message.includes('NEYNAR_API_KEY')) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


