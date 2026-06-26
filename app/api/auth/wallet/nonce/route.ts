import { NextRequest, NextResponse } from 'next/server';
import { buildSiweMessage, normalizeSiweAddress, storeNonce } from '@/lib/siwe';
import { generateNonce } from '@/lib/session';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const address = body?.address as string | undefined;
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    let checksummed: string;
    try {
      checksummed = normalizeSiweAddress(address);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const nonce = generateNonce();
    await storeNonce(checksummed, nonce);
    const message = buildSiweMessage({ address: checksummed, nonce, req });
    const prepared = message.prepareMessage();

    return NextResponse.json({ nonce, message: prepared });
  } catch (error) {
    console.error('[auth/wallet/nonce]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
