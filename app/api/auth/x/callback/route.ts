import { NextRequest, NextResponse } from 'next/server';
import { getSession, encodeSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';
import { linkXToWallet } from '@/lib/userAccountLinks';
import { appendOAuthQuery, getAppWebBasePath } from '@/lib/xOAuth';
import { consumeXOAuthState } from '@/lib/xOAuthState';
import { exchangeXOAuthCode, fetchXOAuthUser } from '@/lib/xOAuthClient';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const fallbackReturn = getAppWebBasePath();

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const oauthError = searchParams.get('error');

    if (oauthError || !code || !state) {
      const err = oauthError === 'access_denied' ? 'denied' : 'denied';
      return NextResponse.redirect(appendOAuthQuery(fallbackReturn, 'x_error', err));
    }

    const oauthState = await consumeXOAuthState(state);
    if (!oauthState) {
      return NextResponse.redirect(appendOAuthQuery(fallbackReturn, 'x_error', 'invalid_state'));
    }

    const returnTo = oauthState.returnTo || fallbackReturn;

    const session = await getSession();
    if (
      session?.walletAddress &&
      session.walletAddress.toLowerCase() !== oauthState.walletAddress.toLowerCase()
    ) {
      console.warn('[auth/x/callback] session wallet mismatch with OAuth state');
      return NextResponse.redirect(appendOAuthQuery(returnTo, 'x_error', 'invalid_state'));
    }

    const { accessToken } = await exchangeXOAuthCode(code, oauthState.codeVerifier);
    const xUser = await fetchXOAuthUser(accessToken);

    await linkXToWallet(oauthState.walletAddress, xUser.username, xUser.id);

    const res = NextResponse.redirect(appendOAuthQuery(returnTo, 'x_connected', '1'));

    // Refresh session cookie if present (strip any legacy PKCE fields)
    if (session?.walletAddress) {
      const cleanSession = encodeSession({
        walletAddress: session.walletAddress,
        verifiedAt: session.verifiedAt,
      });
      res.cookies.set(SESSION_COOKIE, cleanSession, sessionCookieOptions());
    }

    return res;
  } catch (err) {
    console.error('[auth/x/callback]', err);
    return NextResponse.redirect(appendOAuthQuery(fallbackReturn, 'x_error', 'token'));
  }
}
