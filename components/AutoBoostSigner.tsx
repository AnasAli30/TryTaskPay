'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBolt,
  faCircleCheck,
  faSpinner,
  faArrowUpRightFromSquare,
  faHeart,
  faArrowsRotate,
  faCircleInfo,
} from '@fortawesome/free-solid-svg-icons';
import sdk from '@farcaster/miniapp-sdk';
import { APP_URL } from '@/lib/constants';

const POLL_MS = 2000;

type SignerMe = {
  userFid: number;
  ed25519PublicKeyHex: string | null;
  signerStatus: string | null;
  autoBoostOptIn: boolean;
  signerApprovalUrl: string | null;
  /** True when only a legacy Neynar signer row exists; user must connect again. */
  needsReconnect?: boolean;
};

type AutoBoostSignerProps = {
  /** Use `plain` inside a modal so the outer card chrome is not duplicated. */
  variant?: 'card' | 'plain';
};

/** Same copy for `card` and `plain`; only layout / chrome differs. */
function AutoBoostExplainer({ variant }: { variant: 'card' | 'plain' }) {
  const c = variant === 'card';
  return (
    <div className={c ? '' : 'mb-3 space-y-2.5'}>
      <p className="text-sm font-bold text-gray-900">Auto-Quest</p>
      <p
        className={
          c
            ? 'text-[11px] text-gray-600 mt-1.5 leading-relaxed'
            : 'text-xs text-gray-600 mt-1.5 leading-relaxed'
        }
      >
        Connect a signer so we can complete <span className="font-semibold text-gray-800">Boost</span>{' '}
        steps for you: <span className="font-semibold text-gray-800">like</span> and{' '}
        <span className="font-semibold text-gray-800">recast</span> only.
      </p>

      <div
        className={
          c
            ? 'mt-2.5 rounded-lg border border-cyan-100/80 bg-white/70 px-2.5 py-2'
            : 'mt-2.5 rounded-lg border border-gray-200 bg-gray-50/90 px-3 py-2.5'
        }
      >
        <p
          className={
            c
              ? 'text-[10px] font-semibold text-cyan-900 uppercase tracking-wide flex items-center gap-1.5'
              : 'text-[11px] font-semibold text-gray-800 flex items-center gap-1.5'
          }
        >
          <FontAwesomeIcon icon={faCircleInfo} className={c ? 'text-cyan-600' : 'text-gray-500 text-xs'} />
          When this applies
        </p>
        <ul className={c ? 'mt-1.5 text-[11px] text-gray-600 space-y-1' : 'mt-2 space-y-2 text-[11px] text-gray-600 leading-snug'}>
          <li className="flex gap-2">
            <FontAwesomeIcon icon={faHeart} className="text-rose-500 mt-0.5 shrink-0 text-[10px]" />
            <span>
              <span className="font-semibold text-gray-800">Boost</span> quest — the task type is like + recast on one cast. No quote or comment.
            </span>
          </li>
         
        </ul>
      </div>

      <ul className={c ? 'mt-2 text-[11px] text-gray-600 list-none space-y-1 pl-0' : 'mt-2 text-xs text-gray-600 list-none space-y-1.5 pl-0'}>
        <li className="flex items-start gap-2">
          <FontAwesomeIcon icon={faBolt} className="text-amber-500 mt-0.5 text-[10px] shrink-0" />
          No manual taps for eligible Boost quest
        </li>
        <li className="flex items-start gap-2">
          <FontAwesomeIcon icon={faCircleCheck} className="text-emerald-600 mt-0.5 text-[10px] shrink-0" />
          No on-chain tx to finish the quest — claim the reward when ready
        </li>
      </ul>
    </div>
  );
}

export function AutoBoostSigner({ variant = 'card' }: AutoBoostSignerProps) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<SignerMe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const fetchMe = useCallback(async (sync = false) => {
    setError(null);
    try {
      const url = `${APP_URL}/api/farcaster/signer/me${sync ? '?sync=1' : ''}`;
      const res = await sdk.quickAuth.fetch(url);
      if (res.status === 401) {
        setMe(null);
        return;
      }
      if (!res.ok) {
        setError('Could not load auto-boost status');
        setMe(null);
        return;
      }
      const data = await res.json();
      setMe(data);
    } catch {
      setError('Could not load auto-boost status');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await fetchMe(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMe]);

  useEffect(() => {
    const s = me?.signerStatus;
    if (s !== 'pending_approval' && s !== 'generated') return;
    const t = setInterval(() => fetchMe(true), POLL_MS);
    return () => clearInterval(t);
  }, [me?.signerStatus, fetchMe]);

  const createSigner = async (force = false) => {
    setBusy(true);
    setError(null);
    try {
      const endpoint = `${APP_URL}/api/farcaster/signer/create${force ? '?force=1' : ''}`;
      const res = await sdk.quickAuth.fetch(endpoint, {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      console.log(data)
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Create failed');
      await fetchMe(true);
      // Always try to auto-open the deeplink to trigger the approval dialog in Warpcast
      const approvalUrl = (data as { signerApprovalUrl?: string }).signerApprovalUrl;
      console.log(approvalUrl)
      if (approvalUrl) {
        try {
          console.log(approvalUrl)
          await sdk.actions.openUrl(approvalUrl);
        } catch {

          // openUrl may fail silently on some platforms, user can use QR/link fallback
          console.warn('[AutoBoostSigner] sdk.actions.openUrl failed, user must use QR/link');
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const setOptIn = async (autoBoostOptIn: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const res = await sdk.quickAuth.fetch(`${APP_URL}/api/farcaster/signer/opt-in`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoBoostOptIn }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Update failed');
      await fetchMe(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const openApproval = () => {
    if (me?.signerApprovalUrl) {
      sdk.actions.openUrl(me.signerApprovalUrl);
    }
  };

  const copyDeeplink = async () => {
    if (!me?.signerApprovalUrl) return;
    try {
      await navigator.clipboard.writeText(me.signerApprovalUrl);
      setCopyHint('Link copied');
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint('Could not copy');
      setTimeout(() => setCopyHint(null), 2000);
    }
  };

  const cardShell =
    variant === 'card'
      ? 'rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/80 to-white px-4 py-3'
      : 'py-1';

  if (loading) {
    return (
      <div className={`${cardShell} flex items-center gap-2 text-sm text-gray-500`}>
        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
        Auto-boost…
      </div>
    );
  }

  if (!me) {
    return null;
  }

  const needsReconnect = !!me.needsReconnect;
  const hasSigner = !!me.ed25519PublicKeyHex && !needsReconnect;
  const approved = me.signerStatus === 'approved' && hasSigner;
  const pending =
    hasSigner &&
    (me.signerStatus === 'pending_approval' || me.signerStatus === 'generated');

  const bodyShell =
    variant === 'card'
      ? 'rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/90 to-white px-4 py-3 shadow-sm'
      : '';

  return (
    <div className={bodyShell}>
      <div className="flex items-start gap-3">
        {variant === 'card' && (
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
            <FontAwesomeIcon icon={faBolt} className="text-cyan-600 text-lg" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <AutoBoostExplainer variant={variant} />
          {error && <p className="text-xs text-red-600 mt-2 font-semibold">{error}</p>}
          {needsReconnect && (
            <p className="text-xs text-amber-800 mt-2 font-semibold">
              Your previous signer link is outdated. Connect again to use the Farcaster signer flow.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(!hasSigner || needsReconnect) && (
              <button
                type="button"
                disabled={busy}
                onClick={() => createSigner(false)}
                className="px-3 py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {busy ? (
                  <FontAwesomeIcon icon={faSpinner} spin className="mr-1" />
                ) : null}
                Connect signer
              </button>
            )}

            {hasSigner && pending && me.signerApprovalUrl && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={openApproval}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-xs" />
                  Approve in Farcaster
                </button>
                <div className="w-full mt-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col items-center gap-3">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Or scan QR code
                  </p>
                  <div className="p-2 border border-slate-100 rounded-xl bg-white shadow-sm">
                    <QRCode value={me.signerApprovalUrl} size={130} />
                  </div>

                </div>
              </>
            )}

            {approved && (
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  checked={me.autoBoostOptIn}
                  disabled={busy}
                  onChange={(e) => setOptIn(e.target.checked)}
                />
                <span className="text-xs font-semibold text-gray-800">Enable auto-boost</span>
                {me.autoBoostOptIn && (
                  <FontAwesomeIcon icon={faCircleCheck} className="text-emerald-500 text-sm" />
                )}
              </label>
            )}

            {/* {hasSigner && pending && (
              <div className="flex flex-col gap-2 w-full mt-2">
                <span className="text-xs text-amber-700 font-semibold">Waiting for approval…</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => createSigner(true)}
                  className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold inline-flex items-center gap-1.5 self-start transition-colors"
                >
                  {busy ? (
                    <FontAwesomeIcon icon={faSpinner} spin className="mr-1" />
                  ) : null}
                  Resend request
                </button>
              </div>
            )} */}

            {me.signerStatus === 'revoked' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => createSigner(false)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-800"
              >
                Reconnect signer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
