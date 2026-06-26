import { NextRequest, NextResponse } from 'next/server';
import { verifySiweMessage } from '@/lib/siwe';
import { encodeSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';
import { upsertWalletUser, ensureUserAccountLinkIndexes } from '@/lib/userAccountLinks';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message as string | undefined;
    const signature = body?.signature as string | undefined;

    if (!message || !signature) {
      return NextResponse.json({ error: 'Missing message or signature' }, { status: 400 });
    }

    const result = await verifySiweMessage(message, signature);
    if (!result) {
      return NextResponse.json({ error: 'Invalid signature or expired nonce' }, { status: 401 });
    }

    await ensureUserAccountLinkIndexes();
    await upsertWalletUser(result.address);

    const token = encodeSession({
      walletAddress: result.address,
      verifiedAt: Date.now(),
    });

    const res = NextResponse.json({
      success: true,
      walletAddress: result.address,
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    console.error('[auth/wallet/verify]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
