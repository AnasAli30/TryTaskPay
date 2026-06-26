import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { isValidTxHash, parseTx } from '@/lib/alchemyTxParser';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : '';
    if (!txHash) {
      return NextResponse.json({ error: 'Missing txHash' }, { status: 400 });
    }
    if (!isValidTxHash(txHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    const chainId = body?.chainId != null ? Number(body.chainId) : undefined;
    const parsed = await parseTx(txHash, chainId);
    return NextResponse.json({ success: true, parsed });
  } catch (error) {
    console.error('[custom-actions/parse-tx]', error);
    const message = error instanceof Error ? error.message : 'Failed to parse transaction';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
