import { NextRequest, NextResponse } from 'next/server';
import {
  getNeynarApiKey,
  getNeynarApiKeyRoundRobin,
  logNeynarHttpFailure,
  NEYNAR_API_BASE_URL,
} from '@/lib/neynar';
import type { BestFriendsResponse, BulkUsersResponse } from '@/types/neynar';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fid = searchParams.get('fid');
    const limit = searchParams.get('limit') || '7';

    if (!fid) {
      return NextResponse.json(
        { error: 'fid query parameter is required' },
        { status: 400 },
      );
    }

    const apiKey = getNeynarApiKey();
    const url = `${NEYNAR_API_BASE_URL}/user/best_friends/?limit=${limit}&fid=${fid}`;

    // 1. Get best friends FIDs
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      await logNeynarHttpFailure(response, apiKey, url, 'neynar/best-friends best_friends');
      return NextResponse.json(
        { error: 'Failed to fetch best friends from Neynar API' },
        { status: response.status },
      );
    }

    const bestFriendsData: BestFriendsResponse = await response.json();
    
    if (!bestFriendsData.users || bestFriendsData.users.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // 2. Get FIDs from best friends
    const fids = bestFriendsData.users.map(u => u.fid).join(',');

    // 3. Fetch full user data using users/bulk with round-robin API key
    const bulkApiKey = getNeynarApiKeyRoundRobin();
    const bulkUrl = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${encodeURIComponent(fids)}`;

    const bulkResponse = await fetch(bulkUrl, {
      method: 'GET',
      headers: {
        'x-api-key': bulkApiKey,
      },
    });

    if (!bulkResponse.ok) {
      await logNeynarHttpFailure(bulkResponse, bulkApiKey, bulkUrl, 'neynar/best-friends user/bulk');
      // Fallback: return best friends data without enrichment
      return NextResponse.json(bestFriendsData);
    }

    const bulkData: BulkUsersResponse = await bulkResponse.json();

    // 4. Merge data: combine best friends scores with full user data
    const enrichedUsers = bestFriendsData.users.map(friend => {
      const userData = bulkData.users.find(u => u.fid === friend.fid);
      
      return {
        fid: friend.fid,
        username: friend.username,
        display_name: userData?.display_name || friend.username,
        pfp_url: userData?.pfp_url || '',
        follower_count: userData?.follower_count || 0,
        following_count: userData?.following_count || 0,
        mutual_affinity_score: friend.mutual_affinity_score,
        neynar_score: userData?.score || userData?.experimental?.neynar_user_score || 0,
        bio: userData?.profile?.bio?.text || '',
      };
    });

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error('Error in best-friends API route:', error);
    if (error instanceof Error && error.message.includes('NEYNAR_API_KEY')) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}







