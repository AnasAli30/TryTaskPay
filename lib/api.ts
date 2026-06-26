import axios, { isAxiosError } from 'axios';
import {
  NEYNAR_API_BASE_URL,
  getNeynarApiKeyRoundRobin,
  getNeynarApiKey,
  logNeynarApiError,
  parseViewerFid,
} from './neynar';

function logAxiosNeynarFailure(source: string, apiKey: string, fullUrl: string, error: unknown) {
  if (!isAxiosError(error)) {
    logNeynarApiError({ source, apiKey, url: fullUrl, err: error });
    return;
  }
  const data = error.response?.data;
  const details =
    typeof data === 'string'
      ? data
      : data != null
        ? JSON.stringify(data).slice(0, 2000)
        : undefined;
  const reqUrl = error.config?.url;
  const base = error.config?.baseURL;
  const resolvedUrl =
    reqUrl != null && base != null
      ? `${base.replace(/\/$/, '')}/${String(reqUrl).replace(/^\//, '')}`
      : reqUrl ?? fullUrl;
  logNeynarApiError({
    source,
    apiKey,
    url: resolvedUrl,
    status: error.response?.status,
    statusText: error.response?.statusText,
    errorDetails: details,
    err: error,
  });
}

export const searchUser = async (q: string, viewerFid?: number) => {
  const apiKey = getNeynarApiKey();
  const url = `${NEYNAR_API_BASE_URL}/user/search`;
  const params: Record<string, string | number> = { q };
  const parsedViewerFid = parseViewerFid(viewerFid);
  if (parsedViewerFid != null) params.viewer_fid = parsedViewerFid;
  try {
    const response = await axios.get(url, {
      params,
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    });
    return response.data.result.users;
  } catch (error) {
    logAxiosNeynarFailure('lib/api searchUser', apiKey, url, error);
    return [];
  }
};

export const fetchCastsForUser = async (fid: number, viewerFid?: number, limit = 25) => {
  const apiKey = getNeynarApiKeyRoundRobin();
  const url = `${NEYNAR_API_BASE_URL}/feed/user/casts/`;
  const params: Record<string, string | number> = { fid, limit };
  const parsedViewerFid = parseViewerFid(viewerFid);
  if (parsedViewerFid != null) params.viewer_fid = parsedViewerFid;
  try {
    const response = await axios.get(url, {
      params,
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    });
    return response.data.casts ?? [];
  } catch (error) {
    logAxiosNeynarFailure('lib/api fetchCastsForUser', apiKey, url, error);
    return [];
  }
};

export const searchFrames = async (q: string, limit = 20) => {
  const apiKey = getNeynarApiKeyRoundRobin();
  const url = `${NEYNAR_API_BASE_URL}/frame/search/`;
  try {
    const response = await axios.get(url, {
      params: { q, limit },
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    });
    return response.data.frames ?? [];
  } catch (error) {
    logAxiosNeynarFailure('lib/api searchFrames', apiKey, url, error);
    return [];
  }
};

export const validateCast = async (hash: string) => {
  const apiKey = getNeynarApiKeyRoundRobin();
  const url = `${NEYNAR_API_BASE_URL}/cast/`;
  try {
    const response = await axios.get(url, {
      params: { type: 'hash', identifier: hash },
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    });
    return response.data.cast;
  } catch (error) {
    logAxiosNeynarFailure('lib/api validateCast', apiKey, url, error);
    return null;
  }
};

/**
 * Look up a cast by Farcaster URL or cast hash (Neynar lookup-cast-by-hash-or-url).
 */
export const lookupCastByHashOrUrl = async (
  identifier: string,
  type: 'url' | 'hash',
  viewerFid?: number,
) => {
  const apiKey = getNeynarApiKeyRoundRobin();
  const url = `${NEYNAR_API_BASE_URL}/cast/`;
  const params: Record<string, string | number> = {
    identifier: identifier.trim(),
    type,
    _ts: Date.now(),
  };
  const parsedViewerFid = parseViewerFid(viewerFid);
  if (parsedViewerFid != null) params.viewer_fid = parsedViewerFid;
  try {
    const response = await axios.get(url, {
      params,
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    });
    return response.data.cast ?? null;
  } catch (error) {
    logAxiosNeynarFailure('lib/api lookupCastByHashOrUrl', apiKey, url, error);
    return null;
  }
};

export const validateUser = async (fid: number) => {
  const apiKey = getNeynarApiKeyRoundRobin();
  const url = `${NEYNAR_API_BASE_URL}/user/bulk`;
  try {
    const response = await axios.get(url, {
      params: { fids: fid },
      headers: { accept: 'application/json', 'x-api-key': apiKey },
    });
    return response.data.users[0];
  } catch (error) {
    logAxiosNeynarFailure('lib/api validateUser', apiKey, url, error);
    return null;
  }
};
