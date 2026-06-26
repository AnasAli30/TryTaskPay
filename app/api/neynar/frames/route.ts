import { NextRequest, NextResponse } from 'next/server';
import { getNeynarApiKey, logNeynarApiError, logNeynarHttpFailure, NEYNAR_API_BASE_URL } from '@/lib/neynar';

/** Shape sent to frontend – matches Neynar: manifest.frame / manifest.miniapp have icon_url, image_url, button_title, description */
function toSlimFrame(raw: any) {
    const manifest = raw?.manifest ?? {};
    const frameManifest = manifest?.frame ?? {};
    const miniappManifest = manifest?.miniapp ?? {};
    const name =
        frameManifest?.name ??
        miniappManifest?.name ??
        raw?.title ??
        'MiniApp';
    const author = raw?.author
        ? {
              display_name: raw.author.display_name ?? null,
              username: raw.author.username ?? null,
              pfp_url: raw.author.pfp_url ?? null,
          }
        : { display_name: null, username: null, pfp_url: null };

    // Neynar puts icon_url and image_url inside manifest.frame / manifest.miniapp (not on raw)
    const iconUrl =
        frameManifest?.icon_url ??
        miniappManifest?.icon_url ??
        raw?.icon_url ??
        raw?.icon ??
        null;
    const imageUrl =
        frameManifest?.image_url ??
        miniappManifest?.image_url ??
        raw?.image ??
        raw?.image_url ??
        null;

    return {
        name,
        icon_url: iconUrl ?? null,
        image_url: imageUrl ?? null,
        image: imageUrl ?? null,
        frames_url: raw?.frames_url ?? null,
        button_title: frameManifest?.button_title ?? miniappManifest?.button_title ?? raw?.button_title ?? 'Open',
        description: frameManifest?.description ?? miniappManifest?.description ?? raw?.description ?? '',
        author,
    };
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const limit = searchParams.get('limit');

    if (!q || q.trim() === '') {
        return NextResponse.json({ frames: [] }, { status: 200 });
    }

    const seen = new Set<string>();
    const frames: ReturnType<typeof toSlimFrame>[] = [];
    let neynarError: string | null = null;
    let neynarStatus: number = 200;

    // Primary: Neynar frame search
    let frameSearchApiKey = '';
    try {
        const apiKey = getNeynarApiKey();
        frameSearchApiKey = apiKey;
        const params = new URLSearchParams({ q: q.trim(), limit: String(limit ? parseInt(limit, 10) : 20) });
        const frameSearchUrl = `${NEYNAR_API_BASE_URL}/frame/search/?${params.toString()}`;
        const res = await fetch(frameSearchUrl, {
            method: 'GET',
            headers: { 'x-api-key': apiKey, accept: 'application/json' },
            cache: 'no-store',
        });

        if (!res.ok) {
            neynarStatus = res.status;
            neynarError = 'Frame search failed';
            await logNeynarHttpFailure(res, apiKey, frameSearchUrl, 'neynar/frames frame/search');
        } else {
            const data = await res.json();
            const rawFrames = data?.frames ?? [];

            for (const raw of rawFrames) {
                const url = raw?.frames_url?.trim();
                if (!url || seen.has(url)) continue;
                seen.add(url);
                frames.push(toSlimFrame(raw));
            }
        }
    } catch (err) {
        neynarStatus = 502;
        neynarError = 'Frame search failed';
        let apiKeyForLog = frameSearchApiKey;
        if (!apiKeyForLog) {
            try {
                apiKeyForLog = getNeynarApiKey();
            } catch {
                apiKeyForLog = '';
            }
        }
        logNeynarApiError({
            source: 'neynar/frames frame/search (exception)',
            apiKey: apiKeyForLog,
            err: err,
        });
    }

    // Fallback: if Neynar returns empty OR errors, try Farcaster search-summary miniApps
    if (frames.length === 0) {
        try {
            const searchUrl = new URL('https://farcaster.xyz/~api/v2/search-summary');
            searchUrl.searchParams.set('q', q.trim());
            searchUrl.searchParams.set('maxChannels', '2');
            searchUrl.searchParams.set('maxUsers', '4');
            searchUrl.searchParams.set('maxMiniApps', String(limit ? parseInt(limit, 10) : 2));
            searchUrl.searchParams.set('maxTokens', '3');
            searchUrl.searchParams.set('addFollowersYouKnowContext', 'false');
            searchUrl.searchParams.set('intent', 'typeahead');

            const fallbackRes = await fetch(searchUrl.toString(), {
                method: 'GET',
                headers: { accept: 'application/json' },
                cache: 'no-store',
            });

            if (fallbackRes.ok) {
                const fallbackJson = await fallbackRes.json();
                const miniApps: any[] = fallbackJson?.result?.miniApps ?? [];

                for (const mini of miniApps) {
                    const homeUrl: string | null =
                        (mini.homeUrl as string | undefined)?.trim() ||
                        (mini.domain ? `https://${mini.domain}` : '');
                    if (!homeUrl || seen.has(homeUrl)) continue;
                    seen.add(homeUrl);

                    // Shape this mini app to look like a Neynar frame result, then reuse toSlimFrame
                    const rawFromMini = {
                        frames_url: homeUrl,
                        manifest: {
                            miniapp: {
                                name: mini.name ?? 'MiniApp',
                                icon_url: mini.iconUrl ?? null,
                                image_url:
                                    mini.imageUrl ??
                                    mini.heroImageUrl ??
                                    mini.splashImageUrl ??
                                    null,
                                button_title: mini.buttonTitle ?? 'Open',
                                description:
                                    mini.description ??
                                    mini.ogDescription ??
                                    '',
                            },
                        },
                        author: mini.author
                            ? {
                                  display_name: mini.author.displayName ?? null,
                                  username: mini.author.username ?? null,
                                  pfp_url: mini.author.pfp?.url ?? null,
                              }
                            : undefined,
                    };

                    frames.push(toSlimFrame(rawFromMini));
                }
            }
        } catch (err) {
            // Silent fallback – if this fails, we just return empty frames
            console.error('Farcaster search-summary miniApps fallback failed', err);
        }
    }

    if (frames.length === 0 && neynarError) {
        return NextResponse.json({ frames: [], error: neynarError }, { status: neynarStatus });
    }

    return NextResponse.json({ frames }, { status: 200 });
}
