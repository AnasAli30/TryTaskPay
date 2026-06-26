/** User-facing X OAuth error codes (query param `x_error`). */
export const X_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: 'X authorization was cancelled.',
  wallet_required: 'Sign in with your wallet first, then connect X.',
  config: 'X OAuth is not configured. Check X_CLIENT_ID and X_CLIENT_SECRET on the server.',
  invalid_state: 'OAuth session expired. Please try connecting X again.',
  token: 'Token exchange failed. Ensure the callback URL in X Developer Portal matches X_OAUTH_CALLBACK_URL.',
  user: 'Could not load your X profile.',
  unknown: 'Something went wrong connecting X.',
  start_failed: 'Could not start X OAuth.',
};

export function getXOAuthErrorMessage(code: string): string {
  return X_OAUTH_ERROR_MESSAGES[code] ?? X_OAUTH_ERROR_MESSAGES.unknown;
}
