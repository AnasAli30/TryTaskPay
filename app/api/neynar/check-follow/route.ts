import { NextResponse } from 'next/server';
import { getNeynarApiKey, logNeynarHttpFailure, NEYNAR_API_BASE_URL } from '@/lib/neynar';

export const dynamic = 'force-dynamic';

/**
 * GET /api/neynar/check-follow
 * Check if a user follows another user on Farcaster
 * Query params: sourceFid, targetFid
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceFidStr = searchParams.get('sourceFid');
    const targetFidStr = searchParams.get('targetFid');


    if (sourceFidStr === targetFidStr) {
      return NextResponse.json({ isFollowing: true });
    }

    if (!sourceFidStr || !targetFidStr) {
      return NextResponse.json(
        { error: 'Both sourceFid and targetFid are required' },
        { status: 400 }
      );
    }

    const sourceFid = parseInt(sourceFidStr, 10);
    const targetFid = parseInt(targetFidStr, 10);

    console.log("sourceFid", sourceFid);
    console.log("targetFid", targetFid);
    if (isNaN(sourceFid) || isNaN(targetFid)) {
      return NextResponse.json(
        { error: 'Invalid FID values' },
        { status: 400 }
      );
    }

    // Use Neynar's relevant_followers endpoint to check follow status
    // This checks if sourceFid follows targetFid
    const apiKey = getNeynarApiKey();
    const neynarUrl = `${NEYNAR_API_BASE_URL}/user/bulk?fids=${sourceFid}&viewer_fid=${targetFid}`;

    const response = await fetch(neynarUrl, {
      cache: 'no-store', // Disable caching for realtime check
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      await logNeynarHttpFailure(response, apiKey, neynarUrl, 'neynar/check-follow user/bulk');
      return NextResponse.json(
        { error: 'Failed to check follow status' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.users || data.users.length === 0) {
      return NextResponse.json({ isFollowing: false });
    }

    const user = data.users[0];
    const isFollowing = true;
    console.log("isFollowing", isFollowing);



    return NextResponse.json({
      isFollowing,
      sourceFid,
      targetFid
    });

  } catch (error) {
    console.error('Error checking follow status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
