import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getUserByWallet, isUsernameTaken, updateUserProfile, upsertWalletUser } from '@/lib/userAccountLinks';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const displayName = body?.displayName as string | undefined;
    const username = body?.username as string | undefined;
    const email = body?.email as string | undefined;

    await upsertWalletUser(session.walletAddress);

    if (displayName !== undefined) {
      if (typeof displayName !== 'string' || displayName.length > 50) {
        return NextResponse.json({ error: 'Display name max 50 characters' }, { status: 400 });
      }
    }

    if (username !== undefined && username !== '') {
      const normalized = username.toLowerCase().replace(/^@/, '');
      if (!USERNAME_RE.test(normalized)) {
        return NextResponse.json(
          { error: 'Username must be 3-20 chars: lowercase letters, numbers, underscore' },
          { status: 400 },
        );
      }
      const taken = await isUsernameTaken(normalized, session.walletAddress);
      if (taken) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }
    }

    if (email !== undefined && email !== '') {
      if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    const updates: Record<string, string> = {};
    if (displayName !== undefined) updates.displayName = displayName.trim();
    if (username !== undefined) {
      updates.username = username === '' ? '' : username.toLowerCase().replace(/^@/, '');
    }
    if (email !== undefined) updates.email = email.trim();

    const link = await updateUserProfile(session.walletAddress, updates);
    return NextResponse.json({ success: true, profile: link });
  } catch (error) {
    console.error('[profile/me PATCH]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session?.walletAddress) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const link = await getUserByWallet(session.walletAddress);
  return NextResponse.json({
    walletAddress: session.walletAddress,
    displayName: link?.displayName ?? '',
    username: link?.username ?? '',
    pfpUrl: link?.pfpUrl ?? '',
    email: link?.email ?? '',
    fid: link?.fid ?? null,
    xUsername: link?.xUsername ?? null,
  });
}
