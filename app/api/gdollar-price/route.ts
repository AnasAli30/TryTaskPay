import { NextResponse } from 'next/server';
import { fetchGDollarPrice } from '@/lib/gdollarPrice';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  const price = await fetchGDollarPrice();
  return NextResponse.json({ price }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
