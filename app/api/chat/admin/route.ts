import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const OWNER_FID = 249702

/**
 * POST /api/chat/admin
 * Body: { fid, action, messageId?, targetFid? }
 * Actions: 'delete', 'pin', 'unpin', 'ban', 'unban'
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid, action, messageId, targetFid } = body

    if (Number(fid) !== OWNER_FID) {
      return NextResponse.json({ error: 'Unauthorized — owner only' }, { status: 403 })
    }

    const db = await getDatabase()
    const messagesCol = db.collection('chat_messages')

    switch (action) {
      case 'delete': {
        if (!messageId) {
          return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
        }
        const result = await messagesCol.updateOne(
          { _id: new ObjectId(messageId) },
          { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: OWNER_FID } }
        )
        if (result.matchedCount === 0) {
          return NextResponse.json({ error: 'Message not found' }, { status: 404 })
        }
        return NextResponse.json({ success: true, action: 'deleted' })
      }

      case 'pin': {
        if (!messageId) {
          return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
        }
        const msg = await messagesCol.findOne({ _id: new ObjectId(messageId) })
        if (!msg) {
          return NextResponse.json({ error: 'Message not found' }, { status: 404 })
        }
        if (msg.isPinned) {
          return NextResponse.json({ error: 'Already pinned' }, { status: 400 })
        }
        await messagesCol.updateOne(
          { _id: new ObjectId(messageId) },
          { $set: { isPinned: true, pinnedAt: new Date() } }
        )
        return NextResponse.json({
          success: true,
          action: 'pinned',
          message: {
            _id: messageId,
            fid: msg.fid,
            username: msg.username,
            displayName: msg.displayName,
            content: msg.content,
            createdAt: msg.createdAt,
          }
        })
      }

      case 'unpin': {
        if (!messageId) {
          return NextResponse.json({ error: 'messageId is required' }, { status: 400 })
        }
        await messagesCol.updateOne(
          { _id: new ObjectId(messageId) },
          { $set: { isPinned: false }, $unset: { pinnedAt: '' } }
        )
        return NextResponse.json({ success: true, action: 'unpinned' })
      }

      case 'ban': {
        if (!targetFid) {
          return NextResponse.json({ error: 'targetFid is required' }, { status: 400 })
        }
        if (Number(targetFid) === OWNER_FID) {
          return NextResponse.json({ error: 'Cannot ban the owner' }, { status: 400 })
        }
        await db.collection('chat_bans').updateOne(
          { fid: Number(targetFid) },
          { $set: { fid: Number(targetFid), bannedAt: new Date(), bannedBy: OWNER_FID } },
          { upsert: true }
        )
        return NextResponse.json({ success: true, action: 'banned' })
      }

      case 'unban': {
        if (!targetFid) {
          return NextResponse.json({ error: 'targetFid is required' }, { status: 400 })
        }
        await db.collection('chat_bans').deleteOne({ fid: Number(targetFid) })
        return NextResponse.json({ success: true, action: 'unbanned' })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[chat/admin POST]', err)
    return NextResponse.json({ error: 'Admin action failed' }, { status: 500 })
  }
}

/**
 * GET /api/chat/admin — get pinned messages
 */
export async function GET() {
  try {
    const db = await getDatabase()
    const pinned = await db.collection('chat_messages')
      .find({ isPinned: true, isDeleted: { $ne: true } })
      .sort({ pinnedAt: -1 })
      .limit(10)
      .toArray()

    return NextResponse.json({
      pinned: pinned.map(m => ({
        _id: m._id.toString(),
        fid: m.fid,
        username: m.username,
        displayName: m.displayName,
        content: m.content,
        isOwner: m.fid === OWNER_FID,
        createdAt: m.createdAt,
        pinnedAt: m.pinnedAt,
      })),
    })
  } catch (err: any) {
    console.error('[chat/admin GET]', err)
    return NextResponse.json({ error: 'Failed to fetch pinned' }, { status: 500 })
  }
}
