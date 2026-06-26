import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { keccak256, toUtf8Bytes } from 'ethers';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask, CustomActionRequest } from '@/lib/types';
import { CELO_CHAIN_ID, getChainConfig } from '@/lib/chainConfig';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/launch
 * Creates a task in MongoDB from an approved custom action's saved launchDraft.
 * No on-chain calls — client funds via CustomTaskPay.deposit() after this.
 */
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

    const db = await getDatabase();
    const actionsCollection = db.collection<CustomActionRequest>('customActionRequests');
    const tasksCollection = db.collection<BountyTask>('tasks');

    const action = await actionsCollection.findOne({ _id: new ObjectId(customActionId) });
    if (!action) {
      return NextResponse.json({ error: 'Custom action not found' }, { status: 404 });
    }
    if (action.creatorAddress.toLowerCase() !== session.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    if (action.status !== 'approved') {
      return NextResponse.json({ error: 'Only approved actions can be launched' }, { status: 400 });
    }
    if (action.launchedTaskId) {
      const existing = await tasksCollection.findOne({
        _id: new ObjectId(action.launchedTaskId),
      } as any);
      if (existing?.status === 'pending_deposit' && existing.onChainTaskId) {
        return NextResponse.json({
          success: true,
          taskId: action.launchedTaskId,
          onChainTaskId: existing.onChainTaskId,
          totalBudgetUsdc: existing.totalBudget ?? action.launchDraft?.totalBudgetUsdc,
          perUserRewardUsdc: existing.computedRewardPerUser ?? action.launchDraft?.perUserRewardUsdc,
          platformFeeUsdc: action.launchDraft?.platformFeeUsdc,
          resumed: true,
        });
      }
      return NextResponse.json({ error: 'This action has already been launched' }, { status: 400 });
    }
    if (!action.launchDraft) {
      return NextResponse.json(
        { error: 'Save launch configuration before funding on-chain' },
        { status: 400 },
      );
    }

    const draft = action.launchDraft;
    const taskChainId = action.chainId ?? 42161;
    const rewardToken = taskChainId === CELO_CHAIN_ID ? 'G$' : 'USDC';
    const chainConfig = getChainConfig(taskChainId);
    const normalizedCreator = action.creatorAddress.toLowerCase();
    const rawId = `${normalizedCreator}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const onChainTaskId = keccak256(toUtf8Bytes(rawId));

    const newTask: BountyTask = {
      type: 'custom_onchain',
      customActionId,
      customActionMeta: {
        appName: action.appName,
        appImageUrl: action.appImageUrl,
        rewardBaseUrl: action.rewardBaseUrl,
        actionName: action.actionName,
        contractAddress: action.contractAddress,
        functionSelector: action.functionSelector,
        functionName: action.functionName,
        trackedEvent: action.trackedEvent,
        distributionChannels: action.distributionChannels ?? [],
      },
      status: 'pending_deposit',
      creatorAddress: normalizedCreator,
      creatorFid: action.creatorFid,
      creatorProfile: action.creatorProfile,
      description: action.userFacingDescription || action.rewardDescription || action.actionName,
      rewardAmount: draft.perUserRewardUsdc,
      computedRewardPerUser: draft.perUserRewardUsdc,
      rewardToken,
      chainId: taskChainId,
      ubiFeeAmount: taskChainId === CELO_CHAIN_ID ? chainConfig.ubiFeeAmount : undefined,
      totalBudget: draft.totalBudgetUsdc,
      remainingBudget: draft.totalBudgetUsdc,
      maxCompletions: draft.maxCompletions,
      completedBy: [],
      completedByWallets: [],
      expiresAt: new Date(Date.now() + draft.expiresInDays * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      onChainTaskId,
      minFollowers: draft.minFollowers,
      minNeynarScore: draft.minNeynarScore,
      minAccountAgeDays: draft.minAccountAgeDays,
      nonSpamOnly: draft.nonSpamOnly,
    };

    const result = await tasksCollection.insertOne(newTask);
    const taskId = result.insertedId.toString();

    await actionsCollection.updateOne(
      { _id: new ObjectId(customActionId) },
      { $set: { launchedTaskId: taskId } },
    );

    return NextResponse.json(
      {
        success: true,
        taskId,
        onChainTaskId,
        totalBudgetUsdc: draft.totalBudgetUsdc,
        perUserRewardUsdc: draft.perUserRewardUsdc,
        platformFeeUsdc: taskChainId === CELO_CHAIN_ID ? 0 : draft.platformFeeUsdc,
        ubiFeeAmount: taskChainId === CELO_CHAIN_ID ? chainConfig.ubiFeeAmount : undefined,
        chainId: taskChainId,
        rewardToken,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[custom-actions/launch]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
