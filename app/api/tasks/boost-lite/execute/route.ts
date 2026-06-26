import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { getFidFromRequest } from '@/lib/quickAuthServer';
import { lookupCastByHashOrUrl } from '@/lib/api';
import type { BountyTask, BoostLiteAutoExecutionDoc, FarcasterUserSignerDoc } from '@/lib/types';
import { ensureFarcasterSignerIndexes } from '@/lib/farcasterSignerIndexes';
import { isReadyNativeSigner } from '@/lib/farcasterSignerReady';
import { hubPublishReaction } from '@/lib/farcasterHubReactions';
import { decryptEd25519PrivateKey, getSignerEncryptionSecret } from '@/lib/signerKeyEncryption';

async function viewerLikeRecastState(
  castHash: string,
  viewerFid: number,
): Promise<{ liked: boolean; recast: boolean }> {
  const cast = await lookupCastByHashOrUrl(castHash.trim(), 'hash', viewerFid);
  return {
    liked: !!cast?.viewer_context?.liked,
    recast: !!cast?.viewer_context?.recasted,
  };
}

export async function POST(req: Request) {
  const fid = await getFidFromRequest(req);
  if (fid == null) {
    console.log('[boost-lite/execute] 401 — no FID (Quick Auth)');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { taskId?: string };
  try {
    body = await req.json();
  } catch {
    console.log('[boost-lite/execute] 400 — invalid JSON', { fid });
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const taskId = body.taskId?.trim();
  if (!taskId || !ObjectId.isValid(taskId)) {
    console.log('[boost-lite/execute] 400 — bad taskId', { fid, taskId: body.taskId });
    return NextResponse.json({ error: 'taskId required' }, { status: 400 });
  }

  console.log(
    '[boost-lite/execute] start — triggered from app verify flow (TaskFeed → user tapped Verify). userFid:',
    fid,
    'taskId:',
    taskId,
  );

  const db = await getDatabase();
  await ensureFarcasterSignerIndexes(db);

  const _id = new ObjectId(taskId);
  const tasksCollection = db.collection<BountyTask>('tasks');
  const task = await tasksCollection.findOne({ _id } as any);

  if (!task || task.type !== 'boost_lite' || !task.castHash) {
    console.log('[boost-lite/execute] 400 — not boost_lite or missing cast', { fid, taskId });
    return NextResponse.json({ error: 'Not a boost_lite task' }, { status: 400 });
  }
  if (task.status !== 'active') {
    console.log('[boost-lite/execute] 400 — task not active', { fid, taskId, status: task.status });
    return NextResponse.json({ error: 'Task is not active' }, { status: 400 });
  }
  if (task.expiresAt && new Date(task.expiresAt) < new Date()) {
    console.log('[boost-lite/execute] 400 — expired', { fid, taskId });
    return NextResponse.json({ error: 'Task has expired' }, { status: 400 });
  }

  const signerCol = db.collection<FarcasterUserSignerDoc>('farcasterUserSigners');
  const signerDoc = await signerCol.findOne({ userFid: fid });
  const ready = signerDoc ? isReadyNativeSigner(signerDoc) : false;
  const hasHubSigner = !!signerDoc?.autoBoostOptIn && ready;
  if (!hasHubSigner) {
    const reason = !signerDoc
      ? 'no farcasterUserSigners row — user never finished Connect signer in Profile (or wrong DB)'
      : !signerDoc.autoBoostOptIn
        ? 'autoBoostOptIn is false — enable “Enable auto-boost” after signer is approved'
        : !ready
          ? `signer not ready (need approved + keys): status=${signerDoc.signerStatus} hasKey=${!!signerDoc.encryptedEd25519PrivateKey}`
          : 'unknown';
    console.log('[boost-lite/execute] skipped —', reason, {
      fid,
      taskId,
      hasSignerDoc: !!signerDoc,
      autoBoostOptIn: signerDoc?.autoBoostOptIn,
      signerStatus: signerDoc?.signerStatus,
    });
    return NextResponse.json({
      success: false,
      skipped: true,
      message: 'Enable auto-boost and connect your Farcaster signer in Profile first.',
    });
  }

  const encSecret = getSignerEncryptionSecret();
  if (!encSecret) {
    return NextResponse.json({ error: 'Server signer encryption not configured' }, { status: 503 });
  }

  let privateKey32: Uint8Array;
  try {
    privateKey32 = decryptEd25519PrivateKey(encSecret, signerDoc.encryptedEd25519PrivateKey!);
  } catch (e) {
    console.error('[boost-lite/execute] decrypt signer key', e);
    return NextResponse.json({ error: 'Could not load signer key' }, { status: 500 });
  }

  const castMeta = await lookupCastByHashOrUrl(task.castHash.trim(), 'hash', fid);
  const targetAuthorFid = castMeta?.author?.fid;
  if (typeof targetAuthorFid !== 'number') {
    return NextResponse.json({ error: 'Could not resolve cast author' }, { status: 400 });
  }

  const execCol = db.collection<BoostLiteAutoExecutionDoc>('boostLiteAutoExecutions');
  const now = new Date();

  let exec = await execCol.findOne({ taskId: _id, userFid: fid });
  if (!exec) {
    await execCol.insertOne({
      taskId: _id,
      userFid: fid,
      castHash: task.castHash,
      likeDone: false,
      recastDone: false,
      updatedAt: now,
    });
    exec = (await execCol.findOne({ taskId: _id, userFid: fid }))!;
  }

  const onChain = await viewerLikeRecastState(task.castHash, fid);
  let likeDone = exec.likeDone || onChain.liked;
  let recastDone = exec.recastDone || onChain.recast;

  const messages: string[] = [];

  if (!likeDone) {
    const r = await hubPublishReaction({
      privateKey32,
      userFid: fid,
      targetAuthorFid,
      castHash: task.castHash,
      reactionType: 'like',
    });
    if (r.success) {
      likeDone = true;
    } else {
      const low = (r.message || '').toLowerCase();
      if (low.includes('already') || low.includes('duplicate') || low.includes('exist')) {
        likeDone = true;
      } else {
        messages.push(r.message || 'Like failed');
      }
    }
  }

  if (!recastDone) {
    const r = await hubPublishReaction({
      privateKey32,
      userFid: fid,
      targetAuthorFid,
      castHash: task.castHash,
      reactionType: 'recast',
    });
    if (r.success) {
      recastDone = true;
    } else {
      const low = (r.message || '').toLowerCase();
      if (low.includes('already') || low.includes('duplicate') || low.includes('exist')) {
        recastDone = true;
      } else {
        messages.push(r.message || 'Recast failed');
      }
    }
  }

  await execCol.updateOne(
    { taskId: _id, userFid: fid },
    {
      $set: {
        likeDone,
        recastDone,
        lastError: messages.length ? messages.join('; ') : undefined,
        updatedAt: new Date(),
      },
    },
  );

  const success = likeDone && recastDone;
  console.log('[boost-lite/execute] done', {
    fid,
    taskId,
    success,
    likeDone,
    recastDone,
    errors: messages.length ? messages : undefined,
  });
  return NextResponse.json({
    success,
    likeDone,
    recastDone,
    message: messages.length ? messages.join(' ') : undefined,
  });
}
