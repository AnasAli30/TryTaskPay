import { NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE } from '@/lib/session';
import { getUserByWallet } from '@/lib/userAccountLinks';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ authenticated: false });
    }

    const link = await getUserByWallet(session.walletAddress);

    return NextResponse.json({
      authenticated: true,
      walletAddress: session.walletAddress,
      fid: link?.fid ?? null,
      xUsername: link?.xUsername ?? null,
      displayName: link?.displayName ?? null,
      username: link?.username ?? null,
      pfpUrl: link?.pfpUrl ?? null,
      email: link?.email ?? null,
      farcasterLinked: !!link?.fid,
      xLinked: !!link?.xUsername,
    });
  } catch (error) {
    console.error('[auth/me]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, '', { ...{ httpOnly: true, path: '/' }, maxAge: 0 });
  return res;
}
