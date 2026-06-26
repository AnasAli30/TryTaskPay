import { parse } from 'csv-parse/sync';

const FARCASTER_CSV_URL =
    'https://farcaster.xyz/~api/v1/dev-tools/export/miniapp-user-data?domain=taskpay-eta.vercel.app';

const FARCASTER_CSV_HEADERS: Record<string, string> = {
    accept: '*/*',
    authorization: process.env.FARCASTER_AUTHORIZATION || '',
    'content-type': 'application/json; charset=utf-8',
    cookie: process.env.FARCASTER_COOKIE || '',
};

const NOTIFICATION_API_URL = 'https://api.farcaster.xyz/v1/frame-notifications';
const APP_URL = 'https://taskpay-eta.vercel.app';

const BATCH_SIZE = 100;
const DELAY_BETWEEN_BATCHES_MS = 1000;

// --- Hyped notification templates ---

interface NotifTemplate {
    title: string;
    /** Use {amount} and {token} placeholders */
    bodyWithAmount: string;
    bodyWithoutAmount: string;
}

const TASK_TYPE_LABELS: Record<string, string> = {
    follow: 'Follow',
    boost: 'Boost',
    quote: 'Quote',
    channel: 'Channel',
    multi: 'Multi',
    miniapp: 'Mini App',
};

const TEMPLATES: NotifTemplate[] = [
    {
        title: 'New {type} Quest Just Dropped!',
        bodyWithAmount: '{amount} {token} reward pool is LIVE! Be quick or miss it!',
        bodyWithoutAmount: 'New quest available — claim your share now!',
    },
    {
        title: 'Fresh {type} Quest Alert!',
        bodyWithAmount: '{amount} {token} up for grabs! Don\'t sleep on this one!',
        bodyWithoutAmount: 'A fresh quest just landed — jump in before it fills up!',
    },
    {
        title: '{type} Quest Just Landed!',
        bodyWithAmount: '{amount} {token} reward pool just went live! Claim your spot!',
        bodyWithoutAmount: 'New quest is live — complete it now & earn rewards!',
    },
    {
        title: 'Hot {type} Quest Available!',
        bodyWithAmount: '{amount} {token} pool just opened! First come, first served!',
        bodyWithoutAmount: 'A hot new quest is waiting — don\'t miss your reward!',
    },
    {
        title: 'New {type} Quest is LIVE!',
        bodyWithAmount: '{amount} {token} bounty just dropped! Get in fast!',
        bodyWithoutAmount: 'New bounty quest just dropped — earn rewards now!',
    },
    {
        title: '{type} Quest Incoming!',
        bodyWithAmount: '{amount} {token} pool is open! Hurry before it\'s gone!',
        bodyWithoutAmount: 'A new quest just went live — grab your reward!',
    },
];

function pickRandomTemplate(
    taskType: string,
    totalBudget: number,
    rewardToken?: string | null,
): { title: string; body: string } {
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
    const typeLabel = TASK_TYPE_LABELS[taskType] || 'New';
    const token = rewardToken === 'G$' ? 'G$' : 'USDC';

    const title = template.title.replace('{type}', typeLabel);
    const body =
        totalBudget >= 4
            ? template.bodyWithAmount
                .replace('{amount}', String(totalBudget))
                .replace('{token}', token)
            : template.bodyWithoutAmount;

    return { title, body };
}

// --- Core logic ---

interface UserToNotify {
    fid: number;
    token: string;
}

async function fetchUserCSV(): Promise<UserToNotify[]> {
    const res = await fetch(FARCASTER_CSV_URL, {
        method: 'GET',
        headers: FARCASTER_CSV_HEADERS,
    });

    if (!res.ok) {
        console.error(`[notifyNewQuest] CSV fetch failed: ${res.status}`);
        throw new Error(`CSV fetch failed: ${res.status}`);
    }

    const csvText = await res.text();
    if (!csvText || csvText.length < 10) {
        console.error('[notifyNewQuest] CSV response is empty or too short');
        throw new Error('CSV response is empty or too short');
    }

    try {
        const records = parse(csvText, { columns: true, trim: true }) as Record<string, string>[];
        const users: UserToNotify[] = [];

        for (const row of records) {
            if (
                row.added === 'true' &&
                row.notificationToken &&
                row.notificationToken !== 'null'
            ) {
                users.push({
                    fid: parseInt(row.fid, 10),
                    token: row.notificationToken,
                });
            }
        }

        return users;
    } catch (err) {
        console.error('[notifyNewQuest] CSV parse error:', err);
        throw err;
    }
}

async function sendNotification(
    user: UserToNotify,
    title: string,
    body: string,
): Promise<boolean> {
    try {
        const res = await fetch(NOTIFICATION_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fid: user.fid,
                notificationId: crypto.randomUUID(),
                title,
                body,
                targetUrl: APP_URL,
                tokens: [user.token],
            }),
        });

        if (!res.ok) {
            console.error(`[notifyNewQuest][${user.fid}] HTTP ${res.status}`);
            return false;
        }

        return true;
    } catch (err) {
        console.error(`[notifyNewQuest][${user.fid}] Error:`, err);
        return false;
    }
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fire-and-forget: fetches all mini-app users from Farcaster CSV,
 * generates a random hyped notification, and batch-sends to everyone.
 */
export async function notifyAllUsersNewQuest(task: {
    type?: string;
    totalBudget?: number;
    rewardToken?: string | null;
    chainId?: number | null;
}): Promise<void> {
    const taskType = task.type || 'miniapp';
    const totalBudget = task.totalBudget || 0;
    const rewardToken =
        task.rewardToken ?? (task.chainId === 42220 ? 'G$' : 'USDC');
    const { title, body } = pickRandomTemplate(taskType, totalBudget, rewardToken);

    console.log(`[notifyNewQuest] Sending notifications — title: "${title}" body: "${body}"`);

    let users: UserToNotify[] = [];
    try {
        users = await fetchUserCSV();
    } catch (err) {
        console.log("[notifyNewQuest] error occur in fetching, retrying once...", err);
        try {
            users = await fetchUserCSV();
        } catch (retryErr) {
            console.log("[notifyNewQuest] error occur in retry fetching", retryErr);
            return;
        }
    }
    if (users.length === 0) {
        console.log('[notifyNewQuest] No users to notify');
        return;
    }

    console.log(`[notifyNewQuest] Found ${users.length} users to notify`);

    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
        const batch = users.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;

        const results = await Promise.all(
            batch.map((user) => sendNotification(user, title, body)),
        );

        const success = results.filter(Boolean).length;
        const failed = results.length - success;
        totalSuccess += success;
        totalFailed += failed;

        console.log(`[notifyNewQuest] Batch ${batchNum}: ${success} ok, ${failed} failed`);

        // Delay between batches (except last)
        if (i + BATCH_SIZE < users.length) {
            await delay(DELAY_BETWEEN_BATCHES_MS);
        }
    }

    console.log(
        `[notifyNewQuest] Done! ${totalSuccess} sent, ${totalFailed} failed out of ${users.length}`,
    );
}
