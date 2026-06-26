import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getFidFromRequest } from '@/lib/quickAuthServer';
import { ensureFarcasterSignerIndexes } from '@/lib/farcasterSignerIndexes';
import type { FarcasterUserSignerDoc } from '@/lib/types';
import { isReadyNativeSigner } from '@/lib/farcasterSignerReady';

export async function PATCH(req: Request) {
  const fid = await getFidFromRequest(req);
  if (fid == null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { autoBoostOptIn?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (typeof body.autoBoostOptIn !== 'boolean') {
    return NextResponse.json({ error: 'autoBoostOptIn boolean required' }, { status: 400 });
  }

  const db = await getDatabase();
  await ensureFarcasterSignerIndexes(db);
  const col = db.collection<FarcasterUserSignerDoc>('farcasterUserSigners');

  const existing = await col.findOne({ userFid: fid });
  if (!existing) {
    return NextResponse.json(
      { error: 'Create a signer first (POST /api/farcaster/signer/create).' },
      { status: 400 },
    );
  }

  if (!isReadyNativeSigner(existing)) {
    return NextResponse.json(
      {
        error: 'Approve your signer in Warpcast and wait until it is connected before enabling auto-boost.',
      },
      { status: 400 },
    );
  }

  const now = new Date();
  await col.updateOne(
    { userFid: fid },
    { $set: { autoBoostOptIn: body.autoBoostOptIn, updatedAt: now } },
  );
  const doc = await col.findOne({ userFid: fid });

  return NextResponse.json({
    userFid: fid,
    autoBoostOptIn: doc!.autoBoostOptIn,
    signerStatus: doc!.signerStatus,
  });
}
