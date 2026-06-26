/**
 * Captures a TaskPay Quest Share image
 * Clean white theme matching the TaskFeed / CreateTask UI
 * Shows: task type, quest description, reward, creator, cast preview, CTA
 */

// ─── Helpers ───────────────────────────────────────────────────────

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawCircularImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    cx: number, cy: number, radius: number,
    fallbackLetter: string,
    bgColor = '#e5e7eb'
) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    if (img) {
        ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
        ctx.font = `bold ${radius * 0.9}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(fallbackLetter.toUpperCase(), cx, cy);
    }
    ctx.restore();

    // Subtle ring
    ctx.save();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise(async (resolve) => {
        if (!src) { resolve(null); return; }
        try {
            // Proxy external images through server-side route to bypass CORS
            const isExternal = src.startsWith('http://') || src.startsWith('https://');
            const fetchUrl = isExternal
                ? `/api/proxy-image?url=${encodeURIComponent(src)}`
                : src;

            const response = await fetch(fetchUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(null);
            };
            img.src = objectUrl;
        } catch {
            resolve(null);
        }
    });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

// ─── Types ─────────────────────────────────────────────────────────

const TASK_TYPE_META: Record<string, {
    label: string; emoji: string; color: string; bgColor: string;
}> = {
    follow: { label: 'GROW', emoji: '👤', color: '#3B82F6', bgColor: '#EFF6FF' },
    boost: { label: 'AMPLIFY', emoji: '', color: '#10B981', bgColor: '#ECFDF5' },
    quote: { label: 'ENGAGE', emoji: '', color: '#8B5CF6', bgColor: '#F5F3FF' },
    channel: { label: 'COMMUNITY', emoji: '', color: '#F59E0B', bgColor: '#FFFBEB' },
    multi: { label: 'BUNDLE', emoji: '⚡', color: '#6366F1', bgColor: '#EEF2FF' },
    miniapp: { label: 'APP', emoji: '', color: '#EF4444', bgColor: '#FEF2F2' },
};

export interface TaskShareImageData {
    taskType: string;
    taskDescription: string;
    rewardAmount: number | string;
    tokenSymbol?: string;
    creatorUsername: string;
    creatorPfpUrl: string;
    creatorDisplayName: string;
    // Follow / Multi
    targetUsername?: string;
    targetDisplayName?: string;
    targetPfpUrl?: string;
    // Boost / Quote / Multi
    castText?: string;
    castAuthorUsername?: string;
    castAuthorDisplayName?: string;
    castAuthorPfpUrl?: string;
    // Miniapp
    miniappName?: string;
    miniappIcon?: string;
    miniappDeveloper?: string;
    // Progress
    completedCount?: number;
    maxCompletions?: number;
    // Timer
    expiresAt?: string | null;
}

export async function captureTaskShareImage(data: TaskShareImageData): Promise<Blob> {
    const {
        taskType, taskDescription, rewardAmount,
        creatorUsername, creatorPfpUrl, creatorDisplayName,
        targetUsername, targetDisplayName, targetPfpUrl,
        castText, castAuthorUsername, castAuthorDisplayName, castAuthorPfpUrl,
        miniappName, miniappIcon, miniappDeveloper,
        completedCount, maxCompletions, expiresAt,
    } = data;

    const meta = TASK_TYPE_META[taskType] || TASK_TYPE_META.follow;

    // Load all images in parallel
    const [creatorImg, targetImg, castAuthorImg, miniappImg] = await Promise.all([
        loadImage(creatorPfpUrl),
        loadImage(targetPfpUrl || ''),
        loadImage(castAuthorPfpUrl || ''),
        loadImage(miniappIcon || ''),
    ]);

    return new Promise((resolve, reject) => {
        try {
            const W = 1200;
            const H = 800;
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject(new Error('No canvas context')); return; }

            // ─── Background: clean white / light gray ───
            ctx.fillStyle = '#f9fafb';
            ctx.fillRect(0, 0, W, H);

            // ─── Main white card with subtle shadow ───
            const cardX = 50;
            const cardY = 40;
            const cardW = W - 100;
            const cardH = H - 80;

            // Shadow
            ctx.save();
            ctx.shadowBlur = 40;
            ctx.shadowColor = 'rgba(0,0,0,0.08)';
            ctx.shadowOffsetY = 8;
            roundRect(ctx, cardX, cardY, cardW, cardH, 32);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();

            // Card fill
            roundRect(ctx, cardX, cardY, cardW, cardH, 32);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Card border
            roundRect(ctx, cardX, cardY, cardW, cardH, 32);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // ─── Top gradient accent bar (blue → purple → pink) ───
            ctx.save();
            const accentGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
            accentGrad.addColorStop(0, '#3B82F6');
            accentGrad.addColorStop(0.5, '#8B5CF6');
            accentGrad.addColorStop(1, '#EC4899');
            roundRect(ctx, cardX, cardY, cardW, 5, 32);
            ctx.clip();
            ctx.fillStyle = accentGrad;
            ctx.fillRect(cardX, cardY, cardW, 5);
            ctx.restore();

            // ─── Header row: Type badge + "QUEST" label ───
            const headerY = cardY + 45;
            const padX = cardX + 60;

            // Type badge pill
            const badgeText = `${meta.emoji}  ${meta.label}`;
            ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
            const badgeTextW = ctx.measureText(badgeText).width;
            const badgeW = badgeTextW + 32;
            const badgeH = 36;

            roundRect(ctx, padX, headerY, badgeW, badgeH, 10);
            ctx.fillStyle = meta.bgColor;
            ctx.fill();
            roundRect(ctx, padX, headerY, badgeW, badgeH, 10);
            ctx.strokeStyle = meta.color + '40';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = meta.color;
            ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, padX + badgeW / 2, headerY + badgeH / 2);

            // "TaskPay" branding (right)
            ctx.fillStyle = '#d1d5db';
            ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText('TaskPay', cardX + cardW - 60, headerY + badgeH / 2);

            // ─── Creator info (top, right after badge) ───
            const creatorSectionY = headerY + badgeH + 35;
            const avatarR = 35;
            const avatarCx = padX + avatarR;
            const avatarCy = creatorSectionY + avatarR;
            drawCircularImage(ctx, creatorImg, avatarCx, avatarCy, avatarR, creatorDisplayName?.[0] || '?');

            ctx.fillStyle = '#111111';
            ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(creatorDisplayName || creatorUsername, avatarCx + avatarR + 14, avatarCy - 10);

            ctx.fillStyle = '#9ca3af';
            ctx.font = '18px system-ui, -apple-system, sans-serif';
            ctx.fillText(`@${creatorUsername}  · Quest Creator`, avatarCx + avatarR + 14, avatarCy + 14);

            // Progress (right side of creator row)
            if (maxCompletions && maxCompletions > 0 && completedCount !== undefined) {
                const progBarW = 250;
                const progBarH = 10;
                const progBarX = cardX + cardW - 60 - progBarW;
                const progBarY = avatarCy;
                const pct = Math.min((completedCount / maxCompletions) * 100, 100);

                ctx.fillStyle = '#9ca3af';
                ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText(`${completedCount}/${maxCompletions} claimed`, progBarX + progBarW, progBarY - 8);

                roundRect(ctx, progBarX, progBarY, progBarW, progBarH, 5);
                ctx.fillStyle = '#f3f4f6';
                ctx.fill();

                if (pct > 0) {
                    const fillW = Math.max(progBarW * (pct / 100), 10);
                    roundRect(ctx, progBarX, progBarY, fillW, progBarH, 5);
                    const barGrad = ctx.createLinearGradient(progBarX, progBarY, progBarX + progBarW, progBarY);
                    barGrad.addColorStop(0, '#111111');
                    barGrad.addColorStop(1, '#6b7280');
                    ctx.fillStyle = barGrad;
                    ctx.fill();
                }
            }

            // Divider after creator
            const dividerY = creatorSectionY + avatarR * 2 + 18;
            ctx.strokeStyle = '#f3f4f6';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(padX, dividerY);
            ctx.lineTo(cardX + cardW - 60, dividerY);
            ctx.stroke();

            // ─── Quest title / description ───
            const titleY = dividerY + 40;

            // Build a meaningful description
            const fullDesc = buildQuestDescription(taskType, taskDescription, targetUsername, castText, miniappName);

            ctx.fillStyle = '#111111';
            ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            const titleLines = wrapText(ctx, fullDesc, cardW - 160);
            const maxTitleLines = Math.min(titleLines.length, 2);
            for (let i = 0; i < maxTitleLines; i++) {
                let line = titleLines[i];
                if (i === maxTitleLines - 1 && titleLines.length > maxTitleLines) line += '…';
                ctx.fillText(line, padX, titleY + i * 52);
            }

            // ─── Task content preview (matches TaskFeed card) ───
            let nextSectionY = titleY + maxTitleLines * 52 + 28;

            // --- Miniapp preview (purple gradient box with icon + name + hint) ---
            if (taskType === 'miniapp') {
                const boxX = padX;
                const boxW = cardW - 160;
                const boxH = 110;

                // Purple gradient background
                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 16);
                const miniGrad = ctx.createLinearGradient(boxX, nextSectionY, boxX + boxW, nextSectionY + boxH);
                miniGrad.addColorStop(0, '#faf5ff');
                miniGrad.addColorStop(1, '#eff6ff');
                ctx.fillStyle = miniGrad;
                ctx.fill();
                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 16);
                ctx.strokeStyle = 'rgba(168,85,247,0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // App icon
                const iconSize = 48;
                const iconX = boxX + 20;
                const iconY = nextSectionY + 16;
                if (miniappImg) {
                    ctx.save();
                    roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
                    ctx.clip();
                    ctx.drawImage(miniappImg, iconX, iconY, iconSize, iconSize);
                    ctx.restore();
                } else {
                    roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
                    ctx.fillStyle = '#e9d5ff';
                    ctx.fill();
                    ctx.fillStyle = '#7c3aed';
                    ctx.font = 'bold 22px system-ui';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⚡', iconX + iconSize / 2, iconY + iconSize / 2);
                }

                // App name
                ctx.fillStyle = '#581c87';
                ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(miniappName || 'Mini App', iconX + iconSize + 16, iconY);

                // Developer / subtitle
                ctx.fillStyle = 'rgba(88,28,135,0.5)';
                ctx.font = '16px system-ui, -apple-system, sans-serif';
                ctx.fillText(miniappDeveloper || 'Mini App', iconX + iconSize + 16, iconY + 30);

                // Hint text
                ctx.fillStyle = 'rgba(88,28,135,0.7)';
                ctx.font = '18px system-ui, -apple-system, sans-serif';
                ctx.textBaseline = 'top';
                ctx.fillText('⚡ Open & add this mini app to qualify for this quest.', boxX + 20, nextSectionY + boxH - 32);

                nextSectionY += boxH + 20;

                // --- Follow / target profile box (blue tint) ---
            } else if ((taskType === 'follow' || (taskType === 'multi' && !castText)) && targetUsername) {
                const boxX = padX;
                const boxW = cardW - 160;
                const boxH = 70;

                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 14);
                ctx.fillStyle = 'rgba(239,246,255,0.7)';
                ctx.fill();
                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 14);
                ctx.strokeStyle = 'rgba(59,130,246,0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Blue accent bar
                roundRect(ctx, boxX + 14, nextSectionY + 14, 5, boxH - 28, 3);
                ctx.fillStyle = '#3B82F6';
                ctx.fill();

                // Target avatar
                const tAvatarR = 22;
                const tAvatarCx = boxX + 40 + tAvatarR;
                const tAvatarCy = nextSectionY + boxH / 2;
                drawCircularImage(ctx, targetImg, tAvatarCx, tAvatarCy, tAvatarR, (targetDisplayName || targetUsername)?.[0] || '?', '#dbeafe');

                // Target name
                ctx.fillStyle = '#1e3a5f';
                ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(targetDisplayName || targetUsername, tAvatarCx + tAvatarR + 14, tAvatarCy - 12);

                ctx.fillStyle = 'rgba(30,58,95,0.5)';
                ctx.font = '18px system-ui, -apple-system, sans-serif';
                ctx.fillText(`@${targetUsername}`, tAvatarCx + tAvatarR + 14, tAvatarCy + 15);

                nextSectionY += boxH + 20;

                // --- Cast preview (boost / quote / multi with cast) ---
            } else if ((taskType === 'boost_lite' || taskType === 'boost' || taskType === 'quote' || taskType === 'multi') && castText) {
                const boxX = padX;
                const boxW = cardW - 160;
                const boxH = 95;

                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 14);
                ctx.fillStyle = '#f9fafb';
                ctx.fill();
                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 14);
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Cast author row
                const caAvatarR = 12;
                const caX = boxX + 18;
                const caY = nextSectionY + 18;
                if (castAuthorImg) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(caX + caAvatarR, caY + caAvatarR, caAvatarR, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(castAuthorImg, caX, caY, caAvatarR * 2, caAvatarR * 2);
                    ctx.restore();
                }

                ctx.fillStyle = '#6b7280';
                ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(castAuthorDisplayName || castAuthorUsername || '', caX + caAvatarR * 2 + 10, caY + caAvatarR);

                // Left accent bar for cast text
                const castTextY = caY + caAvatarR * 2 + 10;
                roundRect(ctx, boxX + 18, castTextY, 3, boxH - castTextY + nextSectionY - 14, 2);
                ctx.fillStyle = '#e5e7eb';
                ctx.fill();

                // Cast text
                ctx.fillStyle = '#6b7280';
                ctx.font = '20px system-ui, -apple-system, sans-serif';
                ctx.textBaseline = 'top';
                const castLines = wrapText(ctx, castText, boxW - 60);
                const maxCastLines = Math.min(castLines.length, 2);
                for (let i = 0; i < maxCastLines; i++) {
                    let line = castLines[i];
                    if (i === maxCastLines - 1 && castLines.length > maxCastLines) line += '…';
                    ctx.fillText(line, boxX + 30, castTextY + i * 26);
                }

                nextSectionY += boxH + 20;

                // --- Channel ---
            } else if (taskType === 'channel') {
                const boxX = padX;
                const boxW = cardW - 160;
                const boxH = 60;

                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 14);
                ctx.fillStyle = '#fffbeb';
                ctx.fill();
                roundRect(ctx, boxX, nextSectionY, boxW, boxH, 14);
                ctx.strokeStyle = 'rgba(245,158,11,0.2)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = '#92400e';
                ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText('# Join and engage with this community', boxX + 22, nextSectionY + boxH / 2);

                nextSectionY += boxH + 20;
            }

            // ─── Timer pill (if expiry set) ───
            if (expiresAt) {
                const expDate = new Date(expiresAt);
                const now = new Date();
                const diffMs = expDate.getTime() - now.getTime();
                if (diffMs > 0) {
                    const hrs = Math.floor(diffMs / 3600000);
                    const mins = Math.floor((diffMs % 3600000) / 60000);
                    const timerText = hrs > 0 ? `⏰ ${hrs}h ${mins}m remaining` : `⏰ ${mins}m remaining`;

                    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
                    const timerW = ctx.measureText(timerText).width + 28;
                    const timerH = 32;
                    const timerX = padX;

                    roundRect(ctx, timerX, nextSectionY, timerW, timerH, 8);
                    ctx.fillStyle = '#fff7ed';
                    ctx.fill();
                    roundRect(ctx, timerX, nextSectionY, timerW, timerH, 8);
                    ctx.strokeStyle = 'rgba(245,158,11,0.3)';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    ctx.fillStyle = '#c2410c';
                    ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(timerText, timerX + 14, nextSectionY + timerH / 2);

                    nextSectionY += timerH + 16;
                }
            }

            // ─── Reward section ───
            const rewardSectionY = nextSectionY + 55;

            // "Total Reward" label
            ctx.fillStyle = '#9ca3af';
            ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.letterSpacing = '2px';
            ctx.fillText('TOTAL REWARD', padX, rewardSectionY);

            // Big reward amount
            const rewardAmountY = rewardSectionY + 26;
            ctx.fillStyle = '#111111';
            ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(`${rewardAmount}`, padX, rewardAmountY);

            // "USDC" suffix
            const amountWidth = ctx.measureText(`${rewardAmount}`).width;
            ctx.fillStyle = '#9ca3af';
            ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(data.tokenSymbol || 'USDC', padX + amountWidth + 14, rewardAmountY + 32);

            // ─── CTA button (bottom center, inside card) ───
            const ctaH = 48;
            const ctaW = Math.min(420, cardW - 160);
            const ctaX = (W - ctaW) / 2;
            const ctaY = cardY + cardH - 100;

            roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 14);
            ctx.fillStyle = '#111111';
            // CTA Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`Complete quests & earn ${data.tokenSymbol || 'USDC'} →`, ctaX + ctaW / 2, ctaY + ctaH / 2);

            // ─── Convert to blob ───
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Failed to convert canvas to blob'));
                },
                'image/png',
                0.95
            );

        } catch (error) {
            reject(error instanceof Error ? error : new Error('Unknown error capturing task share image'));
        }
    });
}

// ─── Reward Claim Share Image (Profile → Earnings: "I just claimed") ───

export interface RewardClaimShareImageData {
    userDisplayName: string;
    userUsername: string;
    userPfpUrl: string;
    completedCount: number;
    totalEarned: number;
    inProgressCount: number;
    justClaimedAmount: number;
    tokenSymbol?: string;
    questDescription?: string;
    taskType?: string;
    // Follow / Multi
    targetUsername?: string;
    targetDisplayName?: string;
    targetPfpUrl?: string;
    // Boost / Quote / Multi
    castText?: string;
    castAuthorUsername?: string;
    castAuthorDisplayName?: string;
    castAuthorPfpUrl?: string;
    // Miniapp
    miniappName?: string;
    miniappIcon?: string;
    miniappDeveloper?: string;
}

export async function captureRewardClaimShareImage(data: RewardClaimShareImageData): Promise<Blob> {
    const {
        userDisplayName,
        userUsername,
        userPfpUrl,
        completedCount,
        totalEarned,
        inProgressCount,
        justClaimedAmount,
        questDescription,
        taskType = 'multi',
        targetUsername, targetDisplayName, targetPfpUrl,
        castText, castAuthorUsername, castAuthorDisplayName, castAuthorPfpUrl,
        miniappName, miniappIcon, miniappDeveloper,
    } = data;

    const meta = TASK_TYPE_META[taskType] || TASK_TYPE_META.multi;

    // Load images in parallel
    const [userImg, targetImg, castAuthorImg, miniappImg] = await Promise.all([
        loadImage(userPfpUrl),
        loadImage(targetPfpUrl || ''),
        loadImage(castAuthorPfpUrl || ''),
        loadImage(miniappIcon || ''),
    ]);

    return new Promise((resolve, reject) => {
        try {
            const W = 1200;
            const H = 800;
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('No canvas context'));
                return;
            }

            // ─── Background: clean white / light gray ───
            ctx.fillStyle = '#f9fafb';
            ctx.fillRect(0, 0, W, H);

            // Subtle grid / gradient overlay (lighter)
            const bgGrad = ctx.createLinearGradient(0, 0, W, H);
            bgGrad.addColorStop(0, 'rgba(59, 130, 246, 0.03)');
            bgGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.02)');
            bgGrad.addColorStop(1, 'rgba(236, 72, 153, 0.03)');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // ─── Main card ───
            const cardX = 50;
            const cardY = 40;
            const cardW = W - 100;
            const cardH = H - 80;

            // Shadow (soft, premium)
            ctx.save();
            ctx.shadowBlur = 40;
            ctx.shadowColor = 'rgba(0,0,0,0.08)';
            ctx.shadowOffsetY = 12;
            roundRect(ctx, cardX, cardY, cardW, cardH, 32);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.restore();

            // Card fill
            roundRect(ctx, cardX, cardY, cardW, cardH, 32);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // Card border
            roundRect(ctx, cardX, cardY, cardW, cardH, 32);
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // ─── Top gradient accent bar ───
            ctx.save();
            const accentGrad = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
            accentGrad.addColorStop(0, '#3B82F6');
            accentGrad.addColorStop(0.45, '#8B5CF6');
            accentGrad.addColorStop(1, '#EC4899');
            roundRect(ctx, cardX, cardY, cardW, 6, 32);
            ctx.clip();
            ctx.fillStyle = accentGrad;
            ctx.fillRect(cardX, cardY, cardW, 6);
            ctx.restore();

            const padX = cardX + 60;
            const contentTop = cardY + 50;

            // ─── User profile row ───
            const avatarR = 40;
            const avatarCx = padX + avatarR;
            const avatarCy = contentTop + avatarR;

            // Avatar with ring
            drawCircularImage(ctx, userImg, avatarCx, avatarCy, avatarR, userDisplayName?.[0] || userUsername?.[0] || '?', '#f3f4f6');

            // Name & Handle
            ctx.fillStyle = '#111111';
            ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(userDisplayName || userUsername, avatarCx + avatarR + 20, avatarCy - 14);

            ctx.fillStyle = '#6b7280';
            ctx.font = '22px system-ui, -apple-system, sans-serif';
            ctx.fillText(`@${userUsername}`, avatarCx + avatarR + 20, avatarCy + 18);

            // "Earned on TaskPay" badge (top right)
            const badgeText = 'Earned on TaskPay';
            ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
            const badgeW = ctx.measureText(badgeText).width + 30;
            const badgeH = 34;
            const badgeX = cardX + cardW - 60 - badgeW;
            const badgeY = contentTop + 10;

            roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 17);
            ctx.fillStyle = '#f3f4f6';
            ctx.fill();
            ctx.fillStyle = '#4b5563';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);

            // Divider
            const dividerY = contentTop + avatarR * 2 + 30;
            ctx.strokeStyle = '#f3f4f6';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(padX, dividerY);
            ctx.lineTo(cardX + cardW - 60, dividerY);
            ctx.stroke();

            // ─── "Just Claimed" Hero Section ───
            const heroY = dividerY + 20;

            // "JUST CLAIMED" Label
            const labelY = heroY;
            ctx.fillStyle = '#6b7280';
            ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
            ctx.letterSpacing = '1.5px';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('JUST CLAIMED', cardX + cardW / 2, labelY);

            // Amount
            const amountY = labelY + 28;
            ctx.fillStyle = '#111111';
            ctx.font = 'bold 80px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const amountText = `+${justClaimedAmount.toFixed(4)}`;
            ctx.fillText(amountText, cardX + cardW / 2, amountY);

            // USDC Label
            const amountWidth = ctx.measureText(amountText).width;
            ctx.fillStyle = '#22c55e'; // Green for money
            ctx.font = 'bold 30px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(data.tokenSymbol || 'USDC', cardX + cardW / 2 + amountWidth / 2 + 15, amountY + 30);

            // Quest Description (subtext)
            let contentY = amountY + 95;

            if (questDescription) {
                ctx.fillStyle = '#4b5563';
                ctx.font = '22px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                const descLine = questDescription.length > 60 ? questDescription.slice(0, 60) + '…' : questDescription;
                ctx.fillText(`from ${descLine}`, cardX + cardW / 2, contentY);
                contentY += 40;
            }

            // ─── Task Specific Preview (Miniapp / Follow / Cast) ───
            const previewY = contentY + 20;

            if (taskType === 'miniapp' && miniappName) {
                const boxW = Math.min(500, cardW - 120);
                const boxX = cardX + (cardW - boxW) / 2;
                const boxH = 90;

                roundRect(ctx, boxX, previewY, boxW, boxH, 16);
                const miniGrad = ctx.createLinearGradient(boxX, previewY, boxX + boxW, previewY + boxH);
                miniGrad.addColorStop(0, '#faf5ff');
                miniGrad.addColorStop(1, '#eff6ff');
                ctx.fillStyle = miniGrad;
                ctx.fill();
                roundRect(ctx, boxX, previewY, boxW, boxH, 16);
                ctx.strokeStyle = 'rgba(168,85,247,0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();

                const iconSize = 48;
                const iconX = boxX + 20;
                const iconY = previewY + 21;

                if (miniappImg) {
                    ctx.save();
                    roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
                    ctx.clip();
                    ctx.drawImage(miniappImg, iconX, iconY, iconSize, iconSize);
                    ctx.restore();
                } else {
                    roundRect(ctx, iconX, iconY, iconSize, iconSize, 12);
                    ctx.fillStyle = '#e9d5ff';
                    ctx.fill();
                    ctx.fillStyle = '#7c3aed';
                    ctx.font = 'bold 22px system-ui';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('⚡', iconX + iconSize / 2, iconY + iconSize / 2);
                }

                ctx.fillStyle = '#581c87';
                ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(miniappName, iconX + iconSize + 16, iconY + 14);

                ctx.fillStyle = 'rgba(88,28,135,0.6)';
                ctx.font = '16px system-ui, -apple-system, sans-serif';
                ctx.fillText(miniappDeveloper || 'Mini App', iconX + iconSize + 16, iconY + 38);

            } else if ((taskType === 'follow' || (taskType === 'multi' && !castText)) && targetUsername) {
                const boxW = Math.min(460, cardW - 120);
                const boxX = cardX + (cardW - boxW) / 2;
                const boxH = 76;

                roundRect(ctx, boxX, previewY, boxW, boxH, 40);
                ctx.fillStyle = 'rgba(239,246,255,0.8)';
                ctx.fill();
                roundRect(ctx, boxX, previewY, boxW, boxH, 40);
                ctx.strokeStyle = 'rgba(59,130,246,0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();

                const tAvatarR = 24;
                const tAvatarCx = boxX + 38;
                const tAvatarCy = previewY + boxH / 2;
                drawCircularImage(ctx, targetImg, tAvatarCx, tAvatarCy, tAvatarR, (targetDisplayName || targetUsername)?.[0] || '?', '#dbeafe');

                ctx.fillStyle = '#1e3a5f';
                ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(targetDisplayName || targetUsername, tAvatarCx + tAvatarR + 14, tAvatarCy - 10);

                ctx.fillStyle = 'rgba(30,58,95,0.6)';
                ctx.font = '16px system-ui, -apple-system, sans-serif';
                ctx.fillText(`@${targetUsername}`, tAvatarCx + tAvatarR + 14, tAvatarCy + 14);

            } else if ((taskType === 'boost_lite' || taskType === 'boost' || taskType === 'quote' || taskType === 'multi') && castText) {
                const boxW = Math.min(500, cardW - 120);
                const boxX = cardX + (cardW - boxW) / 2;
                const boxH = 88;

                roundRect(ctx, boxX, previewY, boxW, boxH, 16);
                ctx.fillStyle = '#f9fafb';
                ctx.fill();
                roundRect(ctx, boxX, previewY, boxW, boxH, 16);
                ctx.strokeStyle = '#e5e7eb';
                ctx.lineWidth = 1;
                ctx.stroke();

                const caAvatarR = 14;
                const caX = boxX + 20;
                const caY = previewY + 20;
                if (castAuthorImg) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(caX + caAvatarR, caY + caAvatarR, caAvatarR, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(castAuthorImg, caX, caY, caAvatarR * 2, caAvatarR * 2);
                    ctx.restore();
                }

                ctx.fillStyle = '#374151';
                ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(`@${castAuthorUsername}`, caX + caAvatarR * 2 + 10, caY + caAvatarR);

                ctx.fillStyle = '#6b7280';
                ctx.font = '18px system-ui, -apple-system, sans-serif';
                ctx.textBaseline = 'top';
                const castLine = castText.length > 45 ? castText.slice(0, 45) + '…' : castText;
                ctx.fillText(castLine, boxX + 20, caY + caAvatarR * 2 + 8);
            }

            // ─── Stats Row ───
            const statsY = amountY + 300;
            const statBoxW = (cardW - 120 - 40) / 3; // 3 boxes with gaps
            const statBoxH = 110;
            const gap = 20;

            const stats = [
                { label: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, color: '#10B981', bg: '#ECFDF5' }, // Green
                { label: 'Completed', value: String(completedCount), color: '#3B82F6', bg: '#EFF6FF' }, // Blue
                { label: 'In Progress', value: String(inProgressCount), color: '#F59E0B', bg: '#FFFBEB' }, // Amber
            ];

            const startX = cardX + 60;

            stats.forEach((stat, i) => {
                const bx = startX + i * (statBoxW + gap);

                // Box background
                roundRect(ctx, bx, statsY, statBoxW, statBoxH, 16);
                ctx.fillStyle = stat.bg;
                ctx.fill();

                // Border
                roundRect(ctx, bx, statsY, statBoxW, statBoxH, 16);
                ctx.strokeStyle = stat.color + '30'; // 30% opacity
                ctx.lineWidth = 1;
                ctx.stroke();

                // Label
                ctx.fillStyle = '#6b7280';
                ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(stat.label.toUpperCase(), bx + statBoxW / 2, statsY + 30);

                // Value
                ctx.fillStyle = stat.color;
                ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
                ctx.fillText(stat.value, bx + statBoxW / 2, statsY + 70);
            });

            // ─── CTA Footer ───
            const ctaY = cardY + cardH - 80;

            // Gradient CTA Button shape
            const ctaW = 400;
            const ctaH = 56;
            const ctaX = (W - ctaW) / 2;

            roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 28);
            ctx.fillStyle = '#111111';
            ctx.fill();

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Start earning on TaskPay →', W / 2, ctaY + ctaH / 2);

            canvas.toBlob(
                (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
                'image/png',
                1
            );
        } catch (error) {
            reject(error instanceof Error ? error : new Error('Unknown error capturing reward claim image'));
        }
    });
}

// Build a rich quest description that is never empty
function buildQuestDescription(
    taskType: string,
    taskDescription: string,
    targetUsername?: string,
    castText?: string,
    miniappName?: string
): string {
    // If a real description exists and it's not one of the generic stubs, use it
    const genericStubs = [
        'Amplify this cast',
        'Engage with this cast',
        'Join the community',
        'New Quest',
    ];

    if (taskDescription && !genericStubs.includes(taskDescription)) {
        return taskDescription;
    }

    // Build a richer description from the task content
    switch (taskType) {
        case 'follow':
            return targetUsername
                ? `Follow @${targetUsername} and grow the community`
                : 'Follow a creator and grow the community';
        case 'boost':
            return castText
                ? `Boost this cast: "${castText.substring(0, 60)}${castText.length > 60 ? '…' : ''}"`
                : 'Like, recast & comment to amplify this post';
        case 'quote':
            return castText
                ? `Quote this cast: "${castText.substring(0, 60)}${castText.length > 60 ? '…' : ''}"`
                : 'Write a quote reply to engage with this post';
        case 'channel':
            return 'Join a Farcaster channel and grow the community';
        case 'multi':
            return targetUsername
                ? `Follow @${targetUsername} + engage with their cast`
                : 'Full engagement bundle — follow + amplify';
        case 'miniapp':
            return miniappName
                ? `Try ${miniappName} — open and explore this mini app`
                : 'Discover and try a new mini app';
        default:
            return 'Complete this quest and earn rewards';
    }
}
