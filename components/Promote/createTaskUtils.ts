/**
 * Shared utilities extracted from CreateTask for reuse in dashboard and mini-app.
 */
export function pickEscrowDepositTxHash(
  receipts: Array<{ transactionHash?: `0x${string}`; to?: `0x${string}`; contractAddress?: `0x${string}` }>,
  escrowAddress: string,
): `0x${string}` | undefined {
  if (!receipts?.length) return undefined;
  const escrow = escrowAddress.toLowerCase();
  const match = receipts.find((r) => {
    const t = (r.to ?? r.contractAddress)?.toLowerCase();
    return t === escrow;
  });
  if (match?.transactionHash) return match.transactionHash;
  if (receipts.length >= 2) return receipts[1].transactionHash;
  return receipts[0].transactionHash;
}
