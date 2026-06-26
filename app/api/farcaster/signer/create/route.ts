import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getFidFromRequest } from '@/lib/quickAuthServer';
import { ensureFarcasterSignerIndexes } from '@/lib/farcasterSignerIndexes';
import type { FarcasterUserSignerDoc } from '@/lib/types';
import {
  getAppFid,
  generateEd25519Keypair,
  postSignedKeyRequest,
  signSignedKeyRequestEip712,
  getSignedKeyRequestByToken,
  getSignedKeyRequestDeadlineSec,
} from '@/lib/farcasterSignedKeyRequest';
import { getFarcasterDeveloperMnemonic } from '@/lib/farcasterAppCredentials';
import { encryptEd25519PrivateKey, getSignerEncryptionSecret } from '@/lib/signerKeyEncryption';
import { isReadyNativeSigner } from '@/lib/farcasterSignerReady';

export async function POST(req: Request) {
  const fid = await getFidFromRequest(req);
  if (fid == null) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!getFarcasterDeveloperMnemonic()) {
    return NextResponse.json(
      {
        error:
          'Server is not configured for signer approval. Set FARCASTER_DEVELOPER_MNEMONIC (Farcaster recovery phrase for your app account) in the server environment.',
        code: 'SIGNER_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  if (!getSignerEncryptionSecret()) {
    return NextResponse.json(
      {
        error:
          'Server is not configured for signer key storage. Set SIGNER_ENCRYPTION_SECRET in the server environment.',
        code: 'SIGNER_ENCRYPTION_NOT_CONFIGURED',
      },
      { status: 503 },
    );
  }

  try {
    getAppFid();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'APP_FID invalid';
    return NextResponse.json({ error: msg, code: 'APP_FID_MISSING' }, { status: 503 });
  }

  const db = await getDatabase();
  await ensureFarcasterSignerIndexes(db);
  const col = db.collection<FarcasterUserSignerDoc>('farcasterUserSigners');

  const existing = await col.findOne({ userFid: fid });
  if (existing && isReadyNativeSigner(existing)) {
    return NextResponse.json({
      ed25519PublicKeyHex: existing.ed25519PublicKeyHex,
      signerStatus: existing.signerStatus,
      signerApprovalUrl: existing.signerApprovalUrl ?? null,
      message: 'Signer already approved.',
    });
  }

  // If ?force=1 is passed (e.g. "Resend request"), skip reusing the old pending signer
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';

  if (
    !force &&
    existing?.signedKeyRequestToken &&
    existing.encryptedEd25519PrivateKey &&
    existing.ed25519PublicKeyHex &&
    !isReadyNativeSigner(existing)
  ) {
    const remote = await getSignedKeyRequestByToken(existing.signedKeyRequestToken);
    const state = remote?.state ?? existing.signedKeyRequestState;
    const now = new Date();
    let signerStatus: FarcasterUserSignerDoc['signerStatus'] = existing.signerStatus;
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
          signerApprovalUrl: remote?.deeplinkUrl ?? existing.signerApprovalUrl,
          updatedAt: now,
        },
      },
    );
    const doc = await col.findOne({ userFid: fid });
    return NextResponse.json({
      ed25519PublicKeyHex: doc?.ed25519PublicKeyHex ?? null,
      signerStatus: doc?.signerStatus,
      signerApprovalUrl: doc?.signerApprovalUrl ?? null,
    });
  }

  const secret = getSignerEncryptionSecret()!;
  const deadlineSec = getSignedKeyRequestDeadlineSec();

  const { privateKey, publicKeyHex } = await generateEd25519Keypair();
  const encryptedPrivate = encryptEd25519PrivateKey(secret, privateKey);

  let signature: `0x${string}`;
  try {
    signature = await signSignedKeyRequestEip712({ publicKeyHex, deadlineSec });
  } catch (e) {
    console.error('[signer/create] signSignedKeyRequestEip712', e);
    const msg = e instanceof Error ? e.message : 'EIP-712 sign failed';
    return NextResponse.json({ error: msg, code: 'EIP712_SIGN_FAILED' }, { status: 502 });
  }

  let sk: Awaited<ReturnType<typeof postSignedKeyRequest>>;
  try {
    sk = await postSignedKeyRequest({
      appFid: getAppFid(),
      publicKeyHex,
      deadlineSec,
      signature,
    });
  } catch (e) {
    console.error('[signer/create] postSignedKeyRequest', e);
    const msg = e instanceof Error ? e.message : 'Farcaster signed-key request failed';
    return NextResponse.json({ error: msg, code: 'FARCASTER_SIGNED_KEY_FAILED' }, { status: 502 });
  }

  const now = new Date();
  const signerStatus: FarcasterUserSignerDoc['signerStatus'] =
    sk.state === 'completed' ? 'approved' : 'pending_approval';

  const doc: Partial<FarcasterUserSignerDoc> = {
    userFid: fid,
    ed25519PublicKeyHex: publicKeyHex,
    encryptedEd25519PrivateKey: encryptedPrivate,
    signedKeyRequestToken: sk.token,
    signedKeyRequestState: sk.state,
    signerStatus,
    autoBoostOptIn: existing?.autoBoostOptIn ?? false,
    signerApprovalUrl: sk.deeplinkUrl,
    updatedAt: now,
    createdAt: existing?.createdAt ?? now,
  };
  await col.updateOne({ userFid: fid }, { $set: doc, $unset: { signerUuid: '' } }, { upsert: true });

  return NextResponse.json({
    ed25519PublicKeyHex: publicKeyHex,
    signerStatus,
    signerApprovalUrl: sk.deeplinkUrl ?? null,
  });
}
