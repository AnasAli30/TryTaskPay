/** App custody mnemonic for EIP-712 signed key requests (same env as previous Neynar flow). */
export function getFarcasterDeveloperMnemonic(): string | null {
  const m = process.env.FARCASTER_DEVELOPER_MNEMONIC?.trim();
  return m || null;
}
