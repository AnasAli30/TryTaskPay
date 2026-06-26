import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDatabase } from '@/lib/mongodb'

interface EarlyAccessSignup {
  email: string
  xUsername: string
  telegramUsername: string
  walletAddress: string
  source: string
  createdAt: Date
  updatedAt: Date
}

const requestSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
  xUsername: z
    .string()
    .trim()
    .min(1, 'X username is required.')
    .max(15, 'X username can be up to 15 characters.')
    .regex(/^@?[A-Za-z0-9_]+$/, 'Please enter a valid X username.'),
  telegramUsername: z
    .string()
    .trim()
    .min(5, 'Telegram username must be at least 5 characters.')
    .max(32, 'Telegram username can be up to 32 characters.')
    .regex(/^@?[A-Za-z0-9_]+$/, 'Please enter a valid Telegram username.'),
  walletAddress: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Please enter a valid EVM wallet address.'),
})

export async function POST(request: NextRequest) {
  try {
    const requestJson = await request.json()
    const parsed = requestSchema.safeParse(requestJson)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid request body.' },
        { status: 400 },
      )
    }

    const now = new Date()
    const normalizedEmail = parsed.data.email.toLowerCase()
    const normalizedXUsername = parsed.data.xUsername.replace(/^@/, '').toLowerCase()
    const normalizedTelegramUsername = parsed.data.telegramUsername.replace(/^@/, '').toLowerCase()
    const normalizedWalletAddress = parsed.data.walletAddress.toLowerCase()

    const db = await getDatabase()
    const collection = db.collection<EarlyAccessSignup>('earlyAccessSignups')

    await collection.updateOne(
      { email: normalizedEmail },
      {
        $set: {
          email: normalizedEmail,
          xUsername: normalizedXUsername,
          telegramUsername: normalizedTelegramUsername,
          walletAddress: normalizedWalletAddress,
          source: 'website_v2_early_access',
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    )

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('[early-access] Failed to save lead:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
