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
    GlobalFonts.registerFromPath("assets/fonts/Inter-Bold.ttf", "Inter");
  } catch {
    // Fontes customizadas sao opcionais no template inicial.
  }

  const width = 1100;
  const height = 520;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#08040b");
  gradient.addColorStop(0.55, "#120617");
  gradient.addColorStop(1, "#ff2bd633");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#ff2bd6";
  ctx.lineWidth = 4;
  roundRect(ctx, 24, 24, width - 48, height - 48, 36);
  ctx.stroke();

  const avatar = await loadImage(input.avatarUrl);
  ctx.save();
  roundRect(ctx, 72, 86, 180, 180, 36);
  ctx.clip();
  ctx.drawImage(avatar, 72, 86, 180, 180);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "42px Inter, Arial";
  ctx.fillText(input.username, 292, 118);
  ctx.fillStyle = "#ff8bea";
  ctx.font = "24px Inter, Arial";
  ctx.fillText("Perfil de atividade em call", 292, 156);

  const metrics = [
    ["Tempo total", formatDuration(input.totalSeconds)],
    ["Semana atual", formatDuration(input.currentWeekSeconds)],
    ["Semana passada", formatDuration(input.previousWeekSeconds)],
    ["Tempo mutado", formatDuration(input.mutedSeconds)]
  ];

  metrics.forEach(([label, value], index) => {
    const x = 292 + (index % 2) * 360;
    const y = 220 + Math.floor(index / 2) * 110;
    ctx.fillStyle = "#1b0d22";
    roundRect(ctx, x, y, 310, 78, 18);
    ctx.fill();
    ctx.strokeStyle = "#ff2bd655";
    ctx.stroke();
    ctx.fillStyle = "#a995b1";
    ctx.font = "18px Arial";
    ctx.fillText(label, x + 22, y + 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "28px Inter, Arial";
    ctx.fillText(value, x + 22, y + 60);
  });

  ctx.fillStyle = "#ff2bd6";
  ctx.font = "22px Inter, Arial";
  ctx.fillText(input.badges.map((badge) => `#${badge}`).join("  "), 72, 342);

  const png = canvas.toBuffer("image/png");
  return sharp(png).png({ quality: 95 }).toBuffer();
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
