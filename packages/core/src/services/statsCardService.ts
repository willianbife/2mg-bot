import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import sharp from "sharp";
import { formatDuration } from "../utils/time.js";

export type StatsCardInput = {
  username: string;
  avatarUrl: string;
  totalSeconds: number;
  currentWeekSeconds: number;
  previousWeekSeconds: number;
  mutedSeconds: number;
  badges: string[];
  logoPath?: string;
};

export async function generateStatsCard(input: StatsCardInput) {
  try {
    // Tenta registrar fontes se existirem, caso contrário usa Arial/Sans-serif
    GlobalFonts.registerFromPath("assets/fonts/Inter-Bold.ttf", "Inter");
    GlobalFonts.registerFromPath("assets/fonts/Inter-Medium.ttf", "InterMedium");
  } catch {
    // Fallback silencioso
  }

  const width = 1000;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // --- Background ---
  ctx.fillStyle = "#0C0C0E";
  ctx.fillRect(0, 0, width, height);

  // Subtle vignette/glow
  const bgGlow = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 600);
  bgGlow.addColorStop(0, "#22C55E08");
  bgGlow.addColorStop(1, "#00000000");
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, width, height);

  // --- Main Card Surface ---
  const padding = 40;
  const cardX = padding;
  const cardY = padding;
  const cardWidth = width - padding * 2;
  const cardHeight = height - padding * 2;

  ctx.fillStyle = "#141416";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 24, true, false);
  ctx.shadowBlur = 0; // Reset shadow

  // Card Border
  ctx.strokeStyle = "#262626";
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 24, false, true);

  // --- Header Section (Left Side) ---
  const contentX = cardX + 40;
  const contentY = cardY + 40;

  // Avatar with Ring
  const avatarSize = 120;
  const avatarX = contentX;
  const avatarY = contentY;

  ctx.save();
  drawRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 30);
  ctx.clip();
  try {
    const avatar = await loadImage(input.avatarUrl);
    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
  } catch {
    // Fallback avatar
    ctx.fillStyle = "#22C55E";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 48px Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(input.username.slice(0, 1).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2 + 18);
  }
  ctx.restore();

  // Avatar Border/Ring
  ctx.strokeStyle = "#22C55E33";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, avatarX - 4, avatarY - 4, avatarSize + 8, avatarSize + 8, 34, false, true);

  // User Info
  const textStartX = avatarX + avatarSize + 30;
  const gridX = cardX + 460;
  const gridRight = cardX + cardWidth - 40;
  const textMaxWidth = gridX - textStartX - 18;
  
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 36px Inter, Arial";
  const displayName = fitText(ctx, input.username, textMaxWidth);
  ctx.fillText(displayName, textStartX, avatarY + 45);

  ctx.fillStyle = "#22C55E";
  ctx.font = "bold 12px Inter, Arial";
  ctx.fillText(fitText(ctx, "ESTATISTICAS DE TEMPO EM CALL", textMaxWidth), textStartX, avatarY + 75);

  // --- Badges Section (Bottom Left) ---
  const badgeY = avatarY + 140;
  let currentBadgeX = avatarX;
  let currentBadgeY = badgeY;
  const badgeMaxX = gridX - 32;
  
  input.badges.forEach((badge) => {
    const badgeText = `#${badge.toUpperCase()}`;
    ctx.font = "bold 11px Inter, Arial";
    const textWidth = ctx.measureText(badgeText).width;
    const badgePadding = 12;
    const badgeW = textWidth + badgePadding * 2;
    const badgeH = 24;

    if (currentBadgeX + badgeW > badgeMaxX) {
      currentBadgeX = avatarX;
      currentBadgeY += badgeH + 8;
    }

    ctx.fillStyle = "#22C55E1A";
    drawRoundedRect(ctx, currentBadgeX, currentBadgeY, badgeW, badgeH, 6, true, false);
    
    ctx.fillStyle = "#22C55E";
    ctx.fillText(badgeText, currentBadgeX + badgePadding, currentBadgeY + 16);
    
    currentBadgeX += badgeW + 8;
  });

  // --- Metrics Grid (Right Side) ---
  const gridY = contentY;
  const gap = 20;
  const blockW = Math.floor((gridRight - gridX - gap) / 2);
  const blockH = 100;

  const metrics = [
    { label: "TEMPO TOTAL", value: formatDuration(input.totalSeconds) },
    { label: "SEMANA ATUAL", value: formatDuration(input.currentWeekSeconds) },
    { label: "SEMANA PASSADA", value: formatDuration(input.previousWeekSeconds) },
    { label: "TEMPO MUTADO", value: formatDuration(input.mutedSeconds) }
  ];

  metrics.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = gridX + col * (blockW + gap);
    const y = gridY + row * (blockH + gap);

    // Block Background
    ctx.fillStyle = "#1C1C1E";
    drawRoundedRect(ctx, x, y, blockW, blockH, 16, true, false);
    
    // Block Border
    ctx.strokeStyle = "#262626";
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, x, y, blockW, blockH, 16, false, true);

    // Label
    ctx.fillStyle = "#A1A1AA";
    ctx.font = "bold 12px Inter, Arial";
    ctx.fillText(fitText(ctx, m.label, blockW - 40), x + 20, y + 35);

    // Value
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 24px Inter, Arial";
    ctx.fillText(fitText(ctx, m.value, blockW - 40), x + 20, y + 70);

    // Accent Line
    ctx.fillStyle = "#22C55E";
    ctx.fillRect(x + 20, y + 80, 30, 3);
  });

  // --- Footer Branding ---
  ctx.fillStyle = "#3F3F46";
  ctx.font = "12px Inter, Arial";
  ctx.textAlign = "right";
  ctx.fillText("2MG COMMUNITY SUITE", cardX + cardWidth - 40, cardY + cardHeight - 30);

  const png = canvas.toBuffer("image/png");
  return sharp(png).png({ quality: 95 }).toBuffer();
}

function fitText(ctx: any, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let fitted = text;
  while (fitted.length > 1 && ctx.measureText(`${fitted}...`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }

  return `${fitted}...`;
}

function drawRoundedRect(ctx: any, x: number, y: number, w: number, h: number, r: number, fill = false, stroke = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}
