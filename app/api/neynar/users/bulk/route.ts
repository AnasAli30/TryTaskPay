import { NextRequest, NextResponse } from 'next/server';
import { getNeynarApiKeyRoundRobin, logNeynarApiError, logNeynarHttpFailure, NEYNAR_API_BASE_URL } from '@/lib/neynar';
import type { BulkUsersResponse } from '@/types/neynar';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let apiKeyForLog = '';
  try {
    const { searchParams } = new URL(request.url);
    const fids = searchParams.get('fids');

    if (!fids) {
      return NextResponse.json(
        { error: 'fids query parameter is required (comma-separated)' },
        { status: 400 },
      );
    }

    const apiKey = getNeynarApiKeyRoundRobin();
    apiKeyForLog = apiKey;
    const url = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${encodeURIComponent(fids)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      await logNeynarHttpFailure(response, apiKey, url, 'neynar/users/bulk');
      return NextResponse.json(
        { error: 'Failed to fetch users from Neynar API' },
        { status: response.status },
      );
    }

    const data: BulkUsersResponse = await response.json();
    console.log(data)
    return NextResponse.json(data);
  } catch (error) {
    logNeynarApiError({
      source: 'neynar/users/bulk (exception)',
      apiKey: apiKeyForLog,
      err: error,
    });
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






