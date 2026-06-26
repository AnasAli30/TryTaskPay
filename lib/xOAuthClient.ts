import { createHash, randomBytes } from 'crypto';
import { getXOAuthCallbackUrl, getXOAuthScopes } from '@/lib/xOAuth';

const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const X_USERS_ME_URL = 'https://api.x.com/2/users/me';

export function generatePkce(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function generateOAuthState(): string {
  return randomBytes(24).toString('base64url');
}

export function getXOAuthClientId(): string | undefined {
  return (
    process.env.X_CLIENT_ID?.trim() ||
    process.env.TWITTER_CLIENT_ID?.trim() ||
    undefined
  );
}

export function getXOAuthClientSecret(): string | undefined {
  return (
    process.env.X_CLIENT_SECRET?.trim() ||
    process.env.TWITTER_CLIENT_SECRET?.trim() ||
    undefined
  );
}

export function buildXAuthorizeUrl(params: {
  state: string;
  codeChallenge: string;
}): string {
  const clientId = getXOAuthClientId();
  if (!clientId) {
    throw new Error('X OAuth client id is not configured');
  }

  const search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getXOAuthCallbackUrl(),
    scope: getXOAuthScopes(),
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${X_AUTHORIZE_URL}?${search.toString()}`;
}

export async function exchangeXOAuthCode(
  code: string,
  codeVerifier: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const clientId = getXOAuthClientId();
  const clientSecret = getXOAuthClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error('X OAuth credentials are not configured');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: getXOAuthCallbackUrl(),
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new Error('Token response missing access_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function fetchXOAuthUser(accessToken: string): Promise<{
  id: string;
  username: string;
  name?: string;
  profileImageUrl?: string;
}> {
  const url = new URL(X_USERS_ME_URL);
  url.searchParams.set('user.fields', 'username,name,profile_image_url');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`users/me failed: ${text}`);
  }

  const json = (await res.json()) as {
    data?: { id?: string; username?: string; name?: string; profile_image_url?: string };
  };

  const id = json.data?.id;
  const username = json.data?.username;
  if (!id || !username) {
    throw new Error('users/me response missing id or username');
  }

  return {
    id,
    username,
    name: json.data?.name,
    profileImageUrl: json.data?.profile_image_url,
  };
}
