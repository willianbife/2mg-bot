import { createCanvas, loadImage } from "@napi-rs/canvas";
import { type TimeStatsData } from "../builders/timeStatsEmbedBuilder.js";

const CALL_BACKGROUND_PATH = "assets/call-control.jpg";

export async function generateCanvasImage(data: TimeStatsData): Promise<Buffer> {
  const width = 1000;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#08090b";
  ctx.fillRect(0, 0, width, height);

  try {
    const background = await loadImage(CALL_BACKGROUND_PATH);
    drawImageCover(ctx, background, 0, 0, width, height);
  } catch {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#101214");
    gradient.addColorStop(0.55, "#12181a");
    gradient.addColorStop(1, "#050607");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  const overlay = ctx.createLinearGradient(0, 0, width, 0);
  overlay.addColorStop(0, "rgba(0,0,0,0.88)");
  overlay.addColorStop(0.58, "rgba(0,0,0,0.66)");
  overlay.addColorStop(1, "rgba(0,0,0,0.24)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(18, 24, 22, 0.84)";
  roundRect(ctx, 42, 42, 916, 416, 24, true, false);
  ctx.strokeStyle = "rgba(134, 174, 151, 0.34)";
  ctx.lineWidth = 2;
  roundRect(ctx, 42, 42, 916, 416, 24, false, true);

  ctx.fillStyle = "#86ae97";
  ctx.font = "bold 18px Arial";
  ctx.fillText("TEMPO DE CALL", 236, 92);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Arial";
  ctx.fillText(fitText(ctx, data.globalName, 480), 236, 132);

  ctx.fillStyle = "#cbd5cf";
  ctx.font = "20px Arial";
  ctx.fillText(fitText(ctx, data.userTag, 420), 236, 164);

  try {
    const avatar = await loadImage(data.avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(146, 142, 70, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 76, 72, 140, 140);
    ctx.restore();

    ctx.strokeStyle = "#86ae97";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(146, 142, 72, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch {
    ctx.fillStyle = "#86ae97";
    ctx.beginPath();
    ctx.arc(146, 142, 70, 0, Math.PI * 2, true);
    ctx.fill();
  }

  const metrics = [
    { label: "TOTAL", value: data.totalTime },
    { label: "RANK", value: data.rank },
    { label: "SEMANA ATUAL", value: data.currentWeek.callTime },
    { label: "MUTADO", value: data.currentWeek.mutedTime }
  ];

  metrics.forEach((metric, index) => {
    const x = 76 + (index % 2) * 430;
    const y = 260 + Math.floor(index / 2) * 96;
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    roundRect(ctx, x, y, 380, 72, 14, true, false);
    ctx.strokeStyle = "rgba(134,174,151,0.22)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, 380, 72, 14, false, true);

    ctx.fillStyle = "#a8b8af";
    ctx.font = "bold 13px Arial";
    ctx.fillText(metric.label, x + 20, y + 27);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px Arial";
    ctx.fillText(fitText(ctx, metric.value, 330), x + 20, y + 56);
  });

  ctx.fillStyle = "#86ae97";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "right";
  ctx.fillText(fitText(ctx, data.serverName.toUpperCase(), 360), 922, 428);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

function drawImageCover(ctx: any, image: any, x: number, y: number, width: number, height: number) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  const sourceWidth = imageRatio > targetRatio ? image.height * targetRatio : image.width;
  const sourceHeight = imageRatio > targetRatio ? image.height : image.width / targetRatio;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function fitText(ctx: any, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let fitted = text;
  while (fitted.length > 1 && ctx.measureText(`${fitted}...`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }

  return `${fitted}...`;
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number, fill = false, stroke = false) {
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
