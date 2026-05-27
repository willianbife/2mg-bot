import { TextChannel } from "discord.js";
import { prisma } from "@neon/database";

export async function generateTicketTranscript(channel: TextChannel, ticketId: string) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const ordered = [...messages.values()].reverse();
  const html = [
    "<!doctype html><html><head><meta charset=\"utf-8\"><title>Ticket Transcript</title>",
    "<style>body{background:#07040a;color:#fff;font-family:Inter,Arial;padding:24px}.m{border:1px solid #ffffff18;border-radius:8px;padding:12px;margin:10px 0;background:#ffffff0a}.a{color:#ff2bd6;font-weight:700}.t{color:#999;font-size:12px}</style>",
    "</head><body><h1>Transcript Neon Community</h1>"
  ];

  for (const message of ordered) {
    await prisma.ticketMessage.create({
      data: {
        ticketId,
        authorId: message.author.id,
        content: message.content || "[sem texto]",
        attachments: message.attachments.map((attachment) => attachment.url)
      }
    });
    html.push(`<div class="m"><div class="a">${escapeHtml(message.author.tag)}</div><div>${escapeHtml(message.content || "[sem texto]")}</div><div class="t">${message.createdAt.toISOString()}</div></div>`);
  }

  html.push("</body></html>");
  return html.join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[char]!);
}
