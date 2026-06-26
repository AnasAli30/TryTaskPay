import type { FarcasterUserSignerDoc } from '@/lib/types';

/** Hub + boost_lite can run when the user completed onchain signer registration and we stored keys. */
export function isReadyNativeSigner(d: FarcasterUserSignerDoc): boolean {
  return (
    d.signerStatus === 'approved' &&
    !!d.encryptedEd25519PrivateKey &&
    !!d.ed25519PublicKeyHex
  );
}
