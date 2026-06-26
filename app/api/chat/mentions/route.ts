import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

/**
 * GET /api/chat/mentions?fid=<number>
 * Returns unread mention count + recent mentions
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const fid = Number(searchParams.get('fid'))

    if (!fid) {
      return NextResponse.json({ error: 'fid is required' }, { status: 400 })
    }

    const db = await getDatabase()
    const col = db.collection('chat_mentions')

    const unreadCount = await col.countDocuments({ targetFid: fid, read: false })

    const recentMentions = await col
      .find({ targetFid: fid })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray()

    return NextResponse.json({
      unreadCount,
      mentions: recentMentions.map(m => ({
        _id: m._id.toString(),
        messageId: m.messageId.toString(),
        fromFid: m.fromFid,
        fromUsername: m.fromUsername,
        preview: m.preview,
        read: m.read,
        createdAt: m.createdAt,
      })),
    })
  } catch (err: any) {
    console.error('[chat/mentions GET]', err)
    return NextResponse.json({ error: 'Failed to fetch mentions' }, { status: 500 })
  }
}

/**
 * POST /api/chat/mentions
 * Body: { fid } — marks all unread mentions as read
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid } = body

    if (!fid) {
      return NextResponse.json({ error: 'fid is required' }, { status: 400 })
    }

    const db = await getDatabase()
    await db.collection('chat_mentions').updateMany(
      { targetFid: Number(fid), read: false },
      { $set: { read: true } }
    )

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[chat/mentions POST]', err)
    return NextResponse.json({ error: 'Failed to mark mentions as read' }, { status: 500 })
  }
}
