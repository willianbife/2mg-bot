import { createCanvas, loadImage } from "@napi-rs/canvas";
import { type TimeStatsData } from "../builders/timeStatsEmbedBuilder.js";

export async function generateCanvasImage(data: TimeStatsData): Promise<Buffer> {
  const width = 800;
  const height = 460;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0f1012";
  ctx.fillRect(0, 0, width, height);

  // Accent Bar (Top Banner)
  ctx.fillStyle = "#1E90FF";
  ctx.fillRect(0, 0, width, 10);

  // Avatar circular
  try {
    const avatar = await loadImage(data.avatarURL);
    ctx.save();
    ctx.beginPath();
    ctx.arc(120, 120, 70, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 50, 50, 140, 140);
    ctx.restore();
    
    // Avatar Stroke
    ctx.strokeStyle = "#1E90FF";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(120, 120, 72, 0, Math.PI * 2, true);
    ctx.stroke();
  } catch (e) {
    // Fallback if avatar fails
    ctx.fillStyle = "#1E90FF";
    ctx.beginPath();
    ctx.arc(120, 120, 70, 0, Math.PI * 2, true);
    ctx.fill();
  }

  // User Info
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px Arial";
  ctx.fillText(data.globalName, 210, 95);
  
  ctx.fillStyle = "#95A5A6";
  ctx.font = "20px Arial";
  ctx.fillText(data.userTag, 210, 125);

  // Stats Highlights
  ctx.fillStyle = "#1E90FF";
  ctx.font = "bold 24px Arial";
  ctx.fillText("TEMPO TOTAL", 210, 170);
  ctx.fillStyle = "#ffffff";
  ctx.font = "28px Arial";
  ctx.fillText(data.totalTime, 210, 205);

  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 24px Arial";
  ctx.fillText("RANKING", 500, 170);
  ctx.fillStyle = "#ffffff";
  ctx.font = "28px Arial";
  ctx.fillText(data.rank, 500, 205);

  // Separation lines
  ctx.strokeStyle = "#ffffff11";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 250);
  ctx.lineTo(750, 250);
  ctx.stroke();

  // Branding
  ctx.fillStyle = "#1E90FF";
  ctx.font = "bold 50px Arial";
  const brandText = "2mg";
  const brandWidth = ctx.measureText(brandText).width;
  ctx.fillText(brandText, (width - brandWidth) / 2, 380);

  ctx.fillStyle = "#95A5A6";
  ctx.font = "bold 16px Arial";
  const suiteText = "COMMUNITY SUITE";
  const suiteWidth = ctx.measureText(suiteText).width;
  ctx.fillText(suiteText, (width - suiteWidth) / 2, 410);

  return canvas.toBuffer("image/png");
}
