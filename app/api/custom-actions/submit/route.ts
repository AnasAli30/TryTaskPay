import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import { parseTx } from '@/lib/alchemyTxParser';
import { CELO_CHAIN_ID } from '@/lib/chainConfig';
import { isValidHttpsUrl } from '@/lib/customActionHelpers';
import type {
  CustomActionCategory,
  CustomActionDistributionChannel,
  CustomActionRequest,
  CustomActionTrackedEvent,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES: CustomActionCategory[] = [
  'defi',
  'nft',
  'gaming',
  'social',
  'bridge',
  'governance',
  'payments',
  'other',
];

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const creatorAddress = session.walletAddress.toLowerCase();
    const creatorFid = typeof body?.creatorFid === 'number' ? body.creatorFid : undefined;

    const appName = typeof body?.appName === 'string' ? body.appName.trim() : '';
    const appImageUrl = typeof body?.appImageUrl === 'string' ? body.appImageUrl.trim() : undefined;
    const rewardBaseUrl = typeof body?.rewardBaseUrl === 'string' ? body.rewardBaseUrl.trim() : '';
    const category = body?.category as CustomActionCategory;
    const distributionChannels = body?.distributionChannels as CustomActionDistributionChannel[];
    const actionName = typeof body?.actionName === 'string' ? body.actionName.trim() : '';
    const rewardDescription =
      typeof body?.rewardDescription === 'string' ? body.rewardDescription.trim() : '';
    const userFacingDescription =
      typeof body?.userFacingDescription === 'string' ? body.userFacingDescription.trim() : undefined;
    const exampleTxHash =
      typeof body?.exampleTxHash === 'string' ? body.exampleTxHash.trim().toLowerCase() : '';
    const trackedEvent = body?.trackedEvent as CustomActionTrackedEvent | undefined;

    if (!appName) return NextResponse.json({ error: 'App name is required' }, { status: 400 });
    if (!rewardBaseUrl || !isValidHttpsUrl(rewardBaseUrl)) {
      return NextResponse.json({ error: 'Valid HTTPS reward base URL is required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (!Array.isArray(distributionChannels) || distributionChannels.length === 0) {
      return NextResponse.json({ error: 'Select at least one distribution channel' }, { status: 400 });
    }
    const validChannels = distributionChannels.filter(
      (c): c is CustomActionDistributionChannel => c === 'farcaster' || c === 'dapp',
    );
    if (validChannels.length === 0) {
      return NextResponse.json({ error: 'Invalid distribution channels' }, { status: 400 });
    }
    if (!actionName) return NextResponse.json({ error: 'Action name is required' }, { status: 400 });
    if (!rewardDescription) {
      return NextResponse.json({ error: 'Reward description is required' }, { status: 400 });
    }
    if (!exampleTxHash) {
      return NextResponse.json({ error: 'Example transaction hash is required' }, { status: 400 });
    }
    if (!trackedEvent?.signature || trackedEvent.logIndex == null) {
      return NextResponse.json({ error: 'Tracked event is required' }, { status: 400 });
    }

    const chainId = body?.chainId != null ? Number(body.chainId) : 42161;
    if (chainId !== 42161 && chainId !== CELO_CHAIN_ID) {
      return NextResponse.json({ error: 'Unsupported chain' }, { status: 400 });
    }

    const parsed = await parseTx(exampleTxHash, chainId);
    const matchedEvent = parsed.events.find((e) => e.logIndex === trackedEvent.logIndex);
    if (!matchedEvent) {
      return NextResponse.json({ error: 'Tracked event does not match parsed transaction' }, { status: 400 });
    }

    const doc: CustomActionRequest = {
      creatorAddress,
      creatorFid,
      creatorProfile: body?.creatorProfile,
      status: 'pending_review',
      appName,
      appImageUrl: appImageUrl || undefined,
      rewardBaseUrl,
      category,
      distributionChannels: validChannels,
      actionName,
      rewardDescription,
      userFacingDescription: userFacingDescription || undefined,
      exampleTxHash,
      chainId: chainId as 42161 | 42220,
      contractAddress: parsed.contractAddress,
      functionSelector: parsed.functionSelector,
      functionName: parsed.functionName,
      trackedEvent: {
        signature: matchedEvent.signature,
        name: matchedEvent.name,
        logIndex: matchedEvent.logIndex,
        address: matchedEvent.address,
      },
      alternateEvents: parsed.events
        .filter((e) => e.logIndex !== matchedEvent.logIndex)
        .map((e) => ({
          signature: e.signature,
          name: e.name,
          logIndex: e.logIndex,
          address: e.address,
        })),
      parsedTxSnapshot: parsed as unknown as Record<string, unknown>,
      submittedAt: new Date(),
    };

    const db = await getDatabase();
    const result = await db.collection<CustomActionRequest>('customActionRequests').insertOne(doc);

    return NextResponse.json({
      success: true,
      requestId: result.insertedId.toString(),
    });
  } catch (error) {
    console.error('[custom-actions/submit]', error);
    const message = error instanceof Error ? error.message : 'Failed to submit action';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
