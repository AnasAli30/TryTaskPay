/**
 * Type definitions for Neynar API responses
 */

export interface BestFriend {
  fid: number;
  username: string;
  mutual_affinity_score: number;
}

export interface BestFriendsResponse {
  users: BestFriend[];
}

export interface NeynarUser {
  object: string;
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  custody_address: string;
  pro?: {
    status: string;
    subscribed_at: string;
    expires_at: string;
  };
  profile?: {
    bio?: {
      text: string;
      mentioned_profiles?: unknown[];
      mentioned_profiles_ranges?: Array<{ start: number; end: number }>;
      mentioned_channels?: unknown[];
      mentioned_channels_ranges?: Array<{ start: number; end: number }>;
    };
    banner?: {
      url: string;
    };
  };
  follower_count: number;
  following_count: number;
  verifications?: string[];
  verified_addresses?: {
    eth_addresses?: string[];
    sol_addresses?: string[];
    primary?: {
      eth_address?: string;
      sol_address?: string;
    };
  };
  auth_addresses?: Array<{
    address: string;
    app: {
      object: string;
      fid: number;
    };
  }>;
  verified_accounts?: Array<{
    platform: string;
    username: string;
  }>;
  experimental?: {
    neynar_user_score?: number;
    deprecation_notice?: string;
  };
  score?: number;
  /** ISO date string; used for minimum account age (days) */
  registered_at?: string;
}

export interface BulkUsersResponse {
  users: NeynarUser[];
}






