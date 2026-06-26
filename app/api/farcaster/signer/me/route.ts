import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getFidFromRequest } from '@/lib/quickAuthServer';
import { ensureFarcasterSignerIndexes } from '@/lib/farcasterSignerIndexes';
import type { FarcasterUserSignerDoc } from '@/lib/types';
import { getSignedKeyRequestByToken } from '@/lib/farcasterSignedKeyRequest';
import { isReadyNativeSigner } from '@/lib/farcasterSignerReady';

export async function GET(req: NextRequest) {
  const fid = await getFidFromRequest(req);
  if (fid == null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDatabase();
  await ensureFarcasterSignerIndexes(db);
  const col = db.collection<FarcasterUserSignerDoc>('farcasterUserSigners');

  const sync = req.nextUrl.searchParams.get('sync') === '1';
  let doc = await col.findOne({ userFid: fid });

  if (sync && doc?.signedKeyRequestToken && !isReadyNativeSigner(doc)) {
    const remote = await getSignedKeyRequestByToken(doc.signedKeyRequestToken);
    if (remote) {
      const state = remote.state;
      let signerStatus: FarcasterUserSignerDoc['signerStatus'] = doc.signerStatus;
      if (state === 'completed') {
        signerStatus = 'approved';
      } else if (state === 'pending' || state === 'approved') {
        signerStatus = 'pending_approval';
      }
      await col.updateOne(
        { userFid: fid },
        {
          $set: {
            signedKeyRequestState: state,
            signerStatus,
            signerApprovalUrl: remote.deeplinkUrl ?? doc.signerApprovalUrl,
            updatedAt: new Date(),
          },
        },
      );
      doc = await col.findOne({ userFid: fid });
    }
  }

  if (!doc) {
    return NextResponse.json({
      userFid: fid,
      ed25519PublicKeyHex: null,
      signerStatus: null,
      autoBoostOptIn: false,
      signerApprovalUrl: null,
      needsReconnect: false,
    });
  }

  const needsReconnect = !!(doc.signerUuid && !doc.encryptedEd25519PrivateKey);

  return NextResponse.json({
    userFid: doc.userFid,
    ed25519PublicKeyHex: doc.ed25519PublicKeyHex ?? null,
    signerStatus: doc.signerStatus,
    autoBoostOptIn: doc.autoBoostOptIn,
    signerApprovalUrl: doc.signerApprovalUrl ?? null,
    needsReconnect,
  });
}
