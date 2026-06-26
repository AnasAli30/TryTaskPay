import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWithNeynarFallback,
  NEYNAR_API_BASE_URL,
} from '@/lib/neynar';

const TASKPAY_FID = 2808622;

/**
 * GET /api/user/verify-follow?fid=<userFid>
 *
 * Checks whether the given user (fid) follows the TaskPay account (FID 2808622)
 * on Farcaster using Neynar's /v2/farcaster/user/bulk API with viewer_fid context.
 *
 * Returns: { following: boolean }
 */
export async function GET(req: NextRequest) {
  try {
    const fid = req.nextUrl.searchParams.get('fid');

    if (!fid || isNaN(Number(fid))) {
      return NextResponse.json(
        { error: 'Missing or invalid "fid" query parameter.' },
        { status: 400 },
      );
    }

    const userFid = Number(fid);
    console.log("userFid", userFid);
    console.log("TASKPAY_FID", TASKPAY_FID);

    // Use the same pattern as checkFollow in tasks/verify
    const url = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${TASKPAY_FID}&viewer_fid=${userFid}`;
    const res = await fetchWithNeynarFallback(url, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error(
        `[verify-follow] Neynar API returned ${res.status}: ${res.statusText}`,
      );
      return NextResponse.json(
        { following: false, error: 'Could not verify follow status.' },
        { status: 200 },
      );
    }

    const data = await res.json();
    const user = data?.users?.[0];

    if (!user) {
      return NextResponse.json(
        { following: false, error: 'Target user not found.' },
        { status: 200 },
      );
    }

    console.log(user)

    const isFollowing = !!user?.viewer_context?.following;
    console.log("isFollowing", isFollowing);

    return NextResponse.json({ following: isFollowing });
  } catch (error) {
    console.error('[verify-follow] Error:', error);
    return NextResponse.json(
      { following: false, error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
