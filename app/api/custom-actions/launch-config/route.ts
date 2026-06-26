import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import { buildLaunchDraft, validateCustomLaunchInput, type CustomLaunchInput } from '@/lib/customActionLaunch';
import type { CustomActionRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

function parseLaunchInput(body: Record<string, unknown>): CustomLaunchInput | null {
  const perUserRewardUsdc =
    typeof body.perUserRewardUsdc === 'number' ? body.perUserRewardUsdc : parseFloat(String(body.perUserRewardUsdc ?? ''));
  const totalBudgetUsdc =
    typeof body.totalBudgetUsdc === 'number' ? body.totalBudgetUsdc : parseFloat(String(body.totalBudgetUsdc ?? ''));
  const expiresRaw = body.expiresInDays;
  const expiresInDays = expiresRaw === 1 || expiresRaw === 3 ? expiresRaw : null;
  if (!Number.isFinite(perUserRewardUsdc) || !Number.isFinite(totalBudgetUsdc) || expiresInDays == null) {
    return null;
  }

  const targetingEnabled = body.targetingEnabled === true;
  const minFollowers =
    typeof body.minFollowers === 'number' && body.minFollowers > 0 ? body.minFollowers : undefined;
  const minNeynarScore =
    typeof body.minNeynarScore === 'number' && body.minNeynarScore >= 0 ? body.minNeynarScore : undefined;
  const minAccountAgeDays =
    typeof body.minAccountAgeDays === 'number' && body.minAccountAgeDays > 0
      ? body.minAccountAgeDays
      : undefined;
  const nonSpamOnly = body.nonSpamOnly === true;

  return {
    perUserRewardUsdc,
    totalBudgetUsdc,
    expiresInDays,
    targetingEnabled,
    minFollowers,
    minNeynarScore,
    minAccountAgeDays,
    nonSpamOnly,
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const customActionId =
      typeof body?.customActionId === 'string' ? body.customActionId.trim() : '';
    if (!customActionId || !ObjectId.isValid(customActionId)) {
      return NextResponse.json({ error: 'Invalid custom action id' }, { status: 400 });
    }

    const input = parseLaunchInput(body);
    if (!input) {
      return NextResponse.json({ error: 'Invalid launch configuration' }, { status: 400 });
    }

    const db = await getDatabase();
    const collection = db.collection<CustomActionRequest>('customActionRequests');
    const action = await collection.findOne({ _id: new ObjectId(customActionId) });

    if (!action) {
      return NextResponse.json({ error: 'Custom action not found' }, { status: 404 });
    }
    if (action.creatorAddress.toLowerCase() !== session.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (action.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved actions can be configured for launch' }, { status: 400 });
    }
    if (action.launchedTaskId) {
      return NextResponse.json({ error: 'This action has already been launched' }, { status: 400 });
    }

    const hasFarcaster = action.distributionChannels?.includes('farcaster') ?? false;
    const validationError = validateCustomLaunchInput(input, hasFarcaster);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const launchDraft = buildLaunchDraft(input);
    await collection.updateOne(
      { _id: new ObjectId(customActionId) },
      { $set: { launchDraft } },
    );

    return NextResponse.json({
      success: true,
      launchDraft: {
        ...launchDraft,
        savedAt: launchDraft.savedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('[custom-actions/launch-config]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
