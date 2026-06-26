import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const OWNER_FID = 249702
const MAX_MESSAGE_LENGTH = 500
const DEFAULT_LIMIT = 50

const ABUSIVE_REGEXES = [
  /f[\W_]*[u*v][\W_]*c[\W_]*k/i,
  /s[\W_]*[h*][\W_]*[i*1!][\W_]*t/i,
  /b[\W_]*[i*1!][\W_]*t[\W_]*c[\W_]*h/i,
  /a[\W_]*[s*$][\W_]*[s*$][\W_]*h[\W_]*[o0*][\W_]*l[\W_]*[e3*]/i,
  /c[\W_]*[u*v][\W_]*n[\W_]*t/i,
  /d[\W_]*[i*1!][\W_]*c[\W_]*k/i,
  /p[\W_]*[u*v][\W_]*[s*$][\W_]*[s*$][\W_]*y/i,
  /n[\W_]*[i*1!][\W_]*g[\W_]*g[\W_]*[e3*a@][\W_]*r/i,
  /n[\W_]*[i*1!][\W_]*g[\W_]*g[\W_]*[a@*]/i,
  /f[\W_]*[a@*][\W_]*g[\W_]*g[\W_]*[o0*][\W_]*t/i,
  /s[\W_]*l[\W_]*[u*v][\W_]*t/i,
  /w[\W_]*h[\W_]*[o0*][\W_]*r[\W_]*[e3*]/i,
  /b[\W_]*[a@*][\W_]*s[\W_]*t[\W_]*[a@*][\W_]*r[\W_]*d/i,
  /m[\W_]*[o0*][\W_]*t[\W_]*h[\W_]*[e3*][\W_]*r[\W_]*f[\W_]*[u*v][\W_]*c[\W_]*k/i,
  /r[\W_]*[e3*][\W_]*t[\W_]*[a@*][\W_]*r[\W_]*d/i,
  /c[\W_]*[o0*][\W_]*c[\W_]*k/i,
  /t[\W_]*w[\W_]*[a@*][\W_]*t/i,
  /w[\W_]*[a@*][\W_]*n[\W_]*k[\W_]*[e3*][\W_]*r/i,
  /p[\W_]*r[\W_]*[i*1!][\W_]*c[\W_]*k/i
]

/**
 * GET /api/chat/messages?after=<ISO timestamp>&limit=50
 * Fetch chat messages, supports polling via `after` param
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const after = searchParams.get('after')
    const limitParam = searchParams.get('limit')
    const limit = Math.min(Number(limitParam) || DEFAULT_LIMIT, 100)
    const beforeId = searchParams.get('before') // for loading older messages

    const db = await getDatabase()
    const col = db.collection('chat_messages')

    const query: any = { isDeleted: { $ne: true } }

    if (after) {
      query.createdAt = { $gt: new Date(after) }
    }

    if (beforeId) {
      try {
        const beforeDoc = await col.findOne({ _id: new ObjectId(beforeId) })
        if (beforeDoc) {
          query.createdAt = { ...(query.createdAt || {}), $lt: beforeDoc.createdAt }
        }
      } catch {
        // invalid ObjectId, ignore
      }
    }

    const messages = await col
      .find(query)
      .sort({ createdAt: after ? 1 : -1 })
      .limit(limit)
      .toArray()

    // If loading older (before), reverse so oldest is first
    if (!after && !beforeId) {
      messages.reverse()
    } else if (beforeId) {
      messages.reverse()
    }

    // Get pinned messages if this is a fresh load (no `after` param)
    let pinned: any[] = []
    if (!after) {
      pinned = await col
        .find({ isPinned: true, isDeleted: { $ne: true } })
        .sort({ pinnedAt: -1 })
        .limit(10)
        .toArray()
    }

    return NextResponse.json({
      messages: messages.map(m => ({
        _id: m._id.toString(),
        fid: m.fid,
        username: m.username,
        displayName: m.displayName,
        pfpUrl: m.pfpUrl,
        content: m.content,
        mentions: m.mentions || [],
        isPinned: m.isPinned || false,
        isOwner: m.fid === OWNER_FID,
        createdAt: m.createdAt,
        ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      })),
      pinned: pinned.map(m => ({
        _id: m._id.toString(),
        fid: m.fid,
        username: m.username,
        displayName: m.displayName,
        content: m.content,
        isPinned: true,
        isOwner: m.fid === OWNER_FID,
        createdAt: m.createdAt,
        pinnedAt: m.pinnedAt,
      })),
    })
  } catch (err: any) {
    console.error('[chat/messages GET]', err)
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

/**
 * POST /api/chat/messages
 * Body: { fid, username, displayName, pfpUrl, content }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { fid, username, displayName, pfpUrl, content, replyTo } = body

    if (!fid || !content?.trim()) {
      return NextResponse.json({ error: 'fid and content are required' }, { status: 400 })
    }

    const trimmed = content.trim()
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE_LENGTH} chars)` }, { status: 400 })
    }

    // Check for abusive words (including leetspeak and wildcards like f*ck)
    const hasAbuse = ABUSIVE_REGEXES.some(regex => regex.test(trimmed))
    if (hasAbuse) {
      return NextResponse.json({ error: 'Message contains inappropriate content' }, { status: 400 })
    }

    const db = await getDatabase()

    // Check if user is banned
    const banRecord = await db.collection('chat_bans').findOne({ fid: Number(fid) })
    if (banRecord) {
      return NextResponse.json({ error: 'You are banned from chat' }, { status: 403 })
    }

    // Parse @mentions from content
    const mentionRegex = /@(\w+)/g
    const mentionedUsernames: string[] = []
    let match
    while ((match = mentionRegex.exec(trimmed)) !== null) {
      mentionedUsernames.push(match[1].toLowerCase())
    }

    // Look up mentioned users' FIDs from recent messages
    let mentionedFids: number[] = []
    if (mentionedUsernames.length > 0) {
      const recentUsers = await db.collection('chat_messages')
        .aggregate([
          { $match: { username: { $in: mentionedUsernames }, isDeleted: { $ne: true } } },
          { $group: { _id: '$username', fid: { $first: '$fid' } } }
        ])
        .toArray()
      mentionedFids = recentUsers.map((u: any) => u.fid).filter((f: number) => f !== Number(fid))
    }

    const now = new Date()
    const message: any = {
      fid: Number(fid),
      username: username || `fid:${fid}`,
      displayName: displayName || username || `User ${fid}`,
      pfpUrl: pfpUrl || '',
      content: trimmed,
      mentions: mentionedFids,
      mentionedUsernames,
      isPinned: false,
      isDeleted: false,
      createdAt: now,
    }

    // Attach reply reference if provided
    if (replyTo && replyTo._id && replyTo.username && replyTo.content) {
      message.replyTo = {
        _id: String(replyTo._id),
        username: String(replyTo.username),
        displayName: String(replyTo.displayName || replyTo.username),
        content: String(replyTo.content).slice(0, 120),
        isOwner: Boolean(replyTo.isOwner),
      }
    }

    const result = await db.collection('chat_messages').insertOne(message)

    // Create mention notifications for mentioned users
    if (mentionedFids.length > 0) {
      const mentionDocs = mentionedFids.map(targetFid => ({
        targetFid,
        messageId: result.insertedId,
        fromFid: Number(fid),
        fromUsername: username || `fid:${fid}`,
        preview: trimmed.slice(0, 80),
        read: false,
        createdAt: now,
      }))
      await db.collection('chat_mentions').insertMany(mentionDocs)
    }

    // Create reply notification for the original message author
    if (message.replyTo?._id) {
      try {
        const originalMsg = await db.collection('chat_messages').findOne(
          { _id: new ObjectId(message.replyTo._id), isDeleted: { $ne: true } }
        )
        if (originalMsg && originalMsg.fid !== Number(fid) && !mentionedFids.includes(originalMsg.fid)) {
          await db.collection('chat_mentions').insertOne({
            targetFid: originalMsg.fid,
            messageId: result.insertedId,
            fromFid: Number(fid),
            fromUsername: username || `fid:${fid}`,
            preview: `↩ replied: ${trimmed.slice(0, 70)}`,
            read: false,
            createdAt: now,
          })
        }
      } catch {
        // ignore invalid ObjectId or lookup failure
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        _id: result.insertedId.toString(),
        ...message,
        isOwner: Number(fid) === OWNER_FID,
      },
    })
  } catch (err: any) {
    console.error('[chat/messages POST]', err)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
