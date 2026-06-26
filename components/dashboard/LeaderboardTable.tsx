'use client';

import { useEffect, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faTrophy } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import {
  LeaderboardUserModal,
  type LeaderboardRow,
  type LeaderboardUserDetails,
} from '@/components/dashboard/LeaderboardUserModal';

type Tab = 'earners' | 'creators';

function mergeProfileFields(
  rows: LeaderboardRow[],
  tab: Tab,
  profileMap: Record<number, { username?: string; display_name?: string; pfp_url?: string; isPro?: boolean; neynarScore?: number }>,
): LeaderboardRow[] {
  return rows.map((r) => {
    const p = profileMap[r.fid];
    if (!p) return r;
    if (tab === 'earners') {
      return {
        ...r,
        userUsername: r.userUsername || p.username,
        userDisplayName: r.userDisplayName || p.display_name,
        userPfpUrl: r.userPfpUrl || p.pfp_url,
        isPro: p.isPro,
        neynarScore: p.neynarScore,
      };
    }
    return {
      ...r,
      creatorUsername: r.creatorUsername || p.username,
      creatorDisplayName: r.creatorDisplayName || p.display_name,
      creatorPfpUrl: r.creatorPfpUrl || p.pfp_url,
      isPro: p.isPro,
      neynarScore: p.neynarScore,
    };
  });
}

export function LeaderboardTable() {
  const [tab, setTab] = useState<Tab>('earners');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<LeaderboardRow | null>(null);
  const [selectedTab, setSelectedTab] = useState<Tab>('earners');
  const [details, setDetails] = useState<LeaderboardUserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/leaderboard?type=${tab}&skip=0&limit=50`);
      const list: LeaderboardRow[] =
        tab === 'earners' ? res.data?.topEarners || [] : res.data?.topCreators || [];
      const filtered = list.filter((r) => r.fid != null);
      setRows(filtered);

      const fids = filtered.map((r) => r.fid).filter((fid): fid is number => typeof fid === 'number');
      if (fids.length > 0) {
        const bulk = await axios.get(`/api/neynar/users/bulk?fids=${fids.join(',')}`);
        const profileMap: Record<number, { username?: string; display_name?: string; pfp_url?: string; isPro?: boolean; neynarScore?: number }> = {};
        (bulk.data?.users || []).forEach((u: { fid?: number; username?: string; display_name?: string; pfp_url?: string; pro?: { status?: string }; score?: number; experimental?: { neynar_user_score?: number } }) => {
          if (u.fid) {
            const proStatus = u.pro?.status;
            profileMap[u.fid] = {
              username: u.username,
              display_name: u.display_name,
              pfp_url: u.pfp_url,
              isPro: proStatus === 'subscribed' || proStatus === 'active',
              neynarScore: typeof u.score === 'number' ? u.score : u.experimental?.neynar_user_score,
            };
          }
        });
        setRows(mergeProfileFields(filtered, tab, profileMap));
      }
    } catch (e) {
      console.error('Leaderboard load failed', e);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openUserModal = useCallback(async (row: LeaderboardRow) => {
    setSelectedUser(row);
    setSelectedTab(tab);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const res = await axios.get(`/api/leaderboard/user-details?fid=${row.fid}&type=${tab}`);
      setDetails(res.data as LeaderboardUserDetails);
    } catch (e: unknown) {
      setDetailsError(e instanceof Error ? e.message : 'Failed to load user details');
    } finally {
      setDetailsLoading(false);
    }
  }, [tab]);

  const closeModal = useCallback(() => {
    setSelectedUser(null);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
  }, []);

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name =
      tab === 'earners'
        ? r.userDisplayName || r.userUsername || ''
        : r.creatorDisplayName || r.creatorUsername || '';
    return name.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
          <FontAwesomeIcon icon={faTrophy} className="text-amber-500" />
          Leaderboard
        </h1>
        <p className="text-gray-500">Top earners and quest creators on TaskPay.</p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          {(['earners', 'creators'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
                tab === t ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-black/10"
        />
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-20">
            <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] uppercase tracking-widest bg-gray-50/50">
                  <th className="px-6 py-4 font-bold w-16">#</th>
                  <th className="px-6 py-4 font-bold">User</th>
                  <th className="px-6 py-4 font-bold">{tab === 'earners' ? 'Earned' : 'Spent'}</th>
                  <th className="px-6 py-4 font-bold">{tab === 'earners' ? 'Claims' : 'Quests'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-gray-400">
                      No results
                    </td>
                  </tr>
                ) : (
                  filtered.map((row, i) => {
                    const pfp = tab === 'earners' ? row.userPfpUrl : row.creatorPfpUrl;
                    const name =
                      tab === 'earners'
                        ? row.userDisplayName || row.userUsername || `FID ${row.fid}`
                        : row.creatorDisplayName || row.creatorUsername || `FID ${row.fid}`;
                    const handle = tab === 'earners' ? row.userUsername : row.creatorUsername;
                    const amount = tab === 'earners' ? row.totalEarned : row.totalSpent;
                    const count = tab === 'earners' ? row.claims : row.taskCount;

                    return (
                      <tr
                        key={row.fid}
                        role="button"
                        tabIndex={0}
                        onClick={() => openUserModal(row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openUserModal(row);
                          }
                        }}
                        className="border-b border-gray-50 hover:bg-gray-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4 font-black text-gray-400">{i + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {pfp ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={pfp}
                                alt=""
                                className="w-9 h-9 rounded-full object-cover ring-1 ring-gray-100"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400">
                                {name[0]?.toUpperCase() || '?'}
                              </div>
                            )}
                            <div>
                              <p className="font-bold">{name}</p>
                              {handle && <p className="text-xs text-gray-400">@{handle}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-black text-emerald-600">
                          ${(amount || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{count ?? 0}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <LeaderboardUserModal
          row={selectedUser}
          tab={selectedTab}
          details={details}
          loading={detailsLoading}
          error={detailsError}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
