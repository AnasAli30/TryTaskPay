import { NextRequest, NextResponse } from 'next/server';
import { createAppClient, viemConnector } from '@farcaster/auth-client';
import { getSession } from '@/lib/session';
import { linkFidToWallet } from '@/lib/userAccountLinks';
import { fetchWithNeynarFallback, NEYNAR_API_BASE_URL } from '@/lib/neynar';
import { getSiweDomain } from '@/lib/siwe';

const appClient = createAppClient({
  ethereum: viemConnector(),
});

async function getFidForWallet(walletAddress: string): Promise<number | null> {
  const url = `${NEYNAR_API_BASE_URL}/user/bulk-by-address?addresses=${walletAddress}`;
  const res = await fetchWithNeynarFallback(url, { method: 'GET', cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  const users = data?.[walletAddress.toLowerCase()] ?? data?.users ?? [];
  const list = Array.isArray(users) ? users : [users].filter(Boolean);
  const fid = list[0]?.fid ?? list[0]?.user?.fid;
  return typeof fid === 'number' ? fid : null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet session required' }, { status: 401 });
    }

    const body = await req.json();
    const message = body?.message as string | undefined;
    const signature = body?.signature as string | undefined;
    const nonce = body?.nonce as string | undefined;

    if (!message || !signature || !nonce) {
      return NextResponse.json({ error: 'Missing SIWF fields' }, { status: 400 });
    }

    const verify = await appClient.verifySignInMessage({
      message,
      signature: signature as `0x${string}`,
      nonce,
      domain: getSiweDomain(),
    });

    if (!verify.success || !verify.fid) {
      return NextResponse.json({ error: 'Invalid Farcaster sign-in' }, { status: 401 });
    }

    const fid = Number(verify.fid);
    const neynarFid = await getFidForWallet(session.walletAddress);
    if (neynarFid != null && neynarFid !== fid) {
      return NextResponse.json(
        {
          error: 'Wallet is linked to a different Farcaster account. Use the matching account.',
          neynarFid,
          siwfFid: fid,
        },
        { status: 409 },
      );
    }

    try {
      const link = await linkFidToWallet(session.walletAddress, fid);
      return NextResponse.json({
        success: true,
        fid,
        link,
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'FID_ALREADY_LINKED') {
        return NextResponse.json(
          { error: 'This Farcaster account is already linked to another wallet' },
          { status: 409 },
        );
      }
      throw e;
    }
  } catch (error) {
    console.error('[auth/farcaster/verify]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
