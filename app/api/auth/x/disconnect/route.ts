import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { unlinkXFromWallet } from '@/lib/userAccountLinks';

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet session required' }, { status: 401 });
    }
    await unlinkXFromWallet(session.walletAddress);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[auth/x/disconnect]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
