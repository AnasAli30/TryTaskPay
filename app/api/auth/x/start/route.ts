import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import {
  appendOAuthQuery,
  getXOAuthCallbackUrl,
  resolveOAuthReturnUrl,
} from '@/lib/xOAuth';
import {
  buildXAuthorizeUrl,
  generateOAuthState,
  generatePkce,
  getXOAuthClientId,
} from '@/lib/xOAuthClient';
import { saveXOAuthState } from '@/lib/xOAuthState';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const returnTo = resolveOAuthReturnUrl(req);

  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.redirect(appendOAuthQuery(returnTo, 'x_error', 'wallet_required'));
    }

    const clientId = getXOAuthClientId();
    if (!clientId) {
      return NextResponse.redirect(appendOAuthQuery(returnTo, 'x_error', 'config'));
    }

    // Validate callback is configured (throws if APP_WEB_URL missing)
    getXOAuthCallbackUrl();

    const { codeVerifier, codeChallenge } = generatePkce();
    const state = generateOAuthState();

    await saveXOAuthState({
      state,
      codeVerifier,
      walletAddress: session.walletAddress,
      returnTo,
    });

    const authorizeUrl = buildXAuthorizeUrl({ state, codeChallenge });
    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error('[auth/x/start]', error);
    return NextResponse.redirect(appendOAuthQuery(returnTo, 'x_error', 'start_failed'));
  }
}
