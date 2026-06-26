import { NextRequest, NextResponse } from 'next/server';
import { fetchWithNeynarFallback, NEYNAR_API_BASE_URL } from '@/lib/neynar';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const address = searchParams.get('address');
    if (!address) {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }

    const normalized = address.toLowerCase();
    const url = `${NEYNAR_API_BASE_URL}/user/bulk-by-address?addresses=${normalized}`;
    const res = await fetchWithNeynarFallback(url, { method: 'GET', cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ error: 'Neynar lookup failed' }, { status: res.status });
    }

    const data = await res.json();
    const users = data?.[normalized] ?? [];
    const list = Array.isArray(users) ? users : [];
    const user = list[0] ?? null;

    return NextResponse.json({
      address: normalized,
      fid: user?.fid ?? null,
      username: user?.username ?? null,
      displayName: user?.display_name ?? null,
      pfpUrl: user?.pfp_url ?? null,
    });
  } catch (error) {
    console.error('[neynar/users/by-address]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
