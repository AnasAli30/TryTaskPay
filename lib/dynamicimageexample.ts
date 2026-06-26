/**
 * Captures a beautiful GM Share image
 * Shows sender pfp, username, "sent GM to" recipient, and GM stats
 * Style: Modern dark glassmorphism with neon accents
 */

// Helper to draw rounded rectangle
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

// Helper to draw circular image or fallback
function drawCircularImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number, cy: number, radius: number,
  fallbackEmoji: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, '#fbbf24');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.font = `bold ${radius * 0.8}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.fillText(fallbackEmoji, cx, cy);
  }
  ctx.restore();
}

// Helper to draw a neon ring
function drawNeonRing(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  color: string, glowColor: string
) {
  // Glow
  ctx.save();
  ctx.shadowBlur = 15;
  ctx.shadowColor = glowColor;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Load an image with CORS
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface GMShareImageData {
  senderUsername: string;
  senderPfpUrl: string;
  recipientUsername: string;
  recipientPfpUrl: string;
  gmCountToday: number;
  totalGMs: number;
}

export async function captureGMShareImage(data: GMShareImageData): Promise<Blob> {
  const {
    senderUsername,
    senderPfpUrl,
    recipientUsername,
    recipientPfpUrl,
    gmCountToday,
    totalGMs,
  } = data;

  // Load images concurrently
  const [senderImg, recipientImg] = await Promise.all([
    loadImage(senderPfpUrl),
    loadImage(recipientPfpUrl),
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

      // ─── Background: dark gradient ───
      const bgGrad = ctx.createLinearGradient(0, 0, W, H);
      bgGrad.addColorStop(0, '#0a0a0f');
      bgGrad.addColorStop(0.4, '#0d1117');
      bgGrad.addColorStop(0.7, '#0f0f1a');
      bgGrad.addColorStop(1, '#0a0a0f');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ─── Subtle grid pattern ───
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
      ctx.restore();

      // ─── Glow orbs (decorative) ───
      // Top-left cyan orb
      const orb1 = ctx.createRadialGradient(100, 80, 0, 100, 80, 250);
      orb1.addColorStop(0, 'rgba(0, 255, 255, 0.08)');
      orb1.addColorStop(1, 'rgba(0, 255, 255, 0)');
      ctx.fillStyle = orb1;
      ctx.fillRect(0, 0, 400, 400);

      // Bottom-right purple orb
      const orb2 = ctx.createRadialGradient(1100, 700, 0, 1100, 700, 300);
      orb2.addColorStop(0, 'rgba(168, 85, 247, 0.08)');
      orb2.addColorStop(1, 'rgba(168, 85, 247, 0)');
      ctx.fillStyle = orb2;
      ctx.fillRect(800, 400, 400, 400);

      // Center green orb (behind card)
      const orb3 = ctx.createRadialGradient(600, 400, 0, 600, 400, 350);
      orb3.addColorStop(0, 'rgba(57, 255, 20, 0.04)');
      orb3.addColorStop(1, 'rgba(57, 255, 20, 0)');
      ctx.fillStyle = orb3;
      ctx.fillRect(200, 100, 800, 600);

      // ─── Main glass card ───
      const cardX = 40;
      const cardY = 40;
      const cardW = W - 80;
      const cardH = H - 80;

      // Card shadow
      ctx.save();
      ctx.shadowBlur = 60;
      ctx.shadowColor = 'rgba(57, 255, 20, 0.15)';
      roundRect(ctx, cardX, cardY, cardW, cardH, 32);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.fill();
      ctx.restore();

      // Card fill
      roundRect(ctx, cardX, cardY, cardW, cardH, 32);
      const cardGrad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
      cardGrad.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
      cardGrad.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
      ctx.fillStyle = cardGrad;
      ctx.fill();

      // Card border
      roundRect(ctx, cardX, cardY, cardW, cardH, 32);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ─── "GM" badge (top center) ───
      const badgeW = 220;
      const badgeH = 65;
      const badgeX = (W - badgeW) / 2;
      const badgeY = cardY + 40;

      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 25);
      const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeW, badgeY);
      badgeGrad.addColorStop(0, 'rgba(57, 255, 20, 0.2)');
      badgeGrad.addColorStop(1, 'rgba(0, 255, 255, 0.2)');
      ctx.fillStyle = badgeGrad;
      ctx.fill();

      roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 25);
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(57, 255, 20, 0.5)';
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 32px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☀️ GM ☀️', W / 2, badgeY + badgeH / 2);
      ctx.restore();

      // ─── Avatars section ───
      const avatarRadius = 85;
      const avatarY = badgeY + badgeH + 80;
      const senderCx = W / 2 - 280;
      const recipientCx = W / 2 + 280;

      // Sender avatar
      drawCircularImage(ctx, senderImg, senderCx, avatarY, avatarRadius, '☀️');
      drawNeonRing(ctx, senderCx, avatarY, avatarRadius + 4, '#39ff14', 'rgba(57, 255, 20, 0.4)');

      // Arrow between avatars
      const arrowY = avatarY;
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(57, 255, 20, 0.6)';
      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 52px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('→', W / 2, arrowY);
      ctx.restore();

      // Recipient avatar
      drawCircularImage(ctx, recipientImg, recipientCx, avatarY, avatarRadius, '👋');
      drawNeonRing(ctx, recipientCx, avatarY, avatarRadius + 4, '#00e5ff', 'rgba(0, 229, 255, 0.4)');

      // ─── Usernames below avatars ───
      const nameY = avatarY + avatarRadius + 35;

      // Sender name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`@${senderUsername}`, senderCx, nameY);

      // Recipient name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`@${recipientUsername}`, recipientCx, nameY);

      // ─── "Morning vibes connecting" text ───
      const sentTextY = nameY + 60;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'italic 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('spreading morning vibes', W / 2, sentTextY - 60);

      // ─── Big "Good Morning!" text ───
      const gmTextY = sentTextY + 40;

      ctx.save();
      for (let i = 0; i < 5; i++) {
        ctx.shadowBlur = 18 + (i * 3);
        ctx.shadowColor = 'rgba(57, 255, 20, 0.3)';
        ctx.fillStyle = 'rgba(57, 255, 20, 0.15)';
        ctx.font = 'bold 68px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Good Morning! ☀️', W / 2, gmTextY);
      }
      ctx.restore();

      ctx.fillStyle = '#39ff14';
      ctx.font = 'bold 68px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Good Morning! ☀️', W / 2, gmTextY);

      // ─── Stats bar at bottom ───
      const statsY = gmTextY + 110;
      const statsW = 600;
      const statsH = 90;
      const statsX = (W - statsW) / 2;

      // Stats background
      roundRect(ctx, statsX, statsY, statsW, statsH, 20);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.fill();
      roundRect(ctx, statsX, statsY, statsW, statsH, 20);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Stat 1: GMs Today
      const stat1X = statsX + statsW / 4;
      ctx.fillStyle = '#00e5ff';
      ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gmCountToday.toString(), stat1X, statsY + 32);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText('GMs Today', stat1X, statsY + 64);

      // Divider
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(W / 2, statsY + 15);
      ctx.lineTo(W / 2, statsY + statsH - 15);
      ctx.stroke();

      // Stat 2: Total GMs
      const stat2X = statsX + (statsW * 3) / 4;
      ctx.fillStyle = '#a855f7';
      ctx.font = 'bold 38px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(totalGMs.toString(), stat2X, statsY + 32);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText('Total GMs', stat2X, statsY + 64);

      // ─── Bottom branding ───
      const brandY = H - 60;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(' ArbRise · Say GM', W / 2, brandY);


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
      reject(error instanceof Error ? error : new Error('Unknown error capturing GM share'));
    }
  });
}
