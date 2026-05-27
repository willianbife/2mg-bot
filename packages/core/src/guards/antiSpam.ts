import { Message } from "discord.js";
import { CooldownGuard } from "./cooldown.js";

const spamGuard = new CooldownGuard("messages");

export async function detectMessageAbuse(message: Message) {
  if (!message.guild || message.author.bot) return { abusive: false, reason: null };

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount >= 8) return { abusive: true, reason: "mass_mention" };

  const hit = await spamGuard.consume(`${message.guild.id}:${message.author.id}`, 6, 8);
  if (!hit.allowed) return { abusive: true, reason: "spam" };

  return { abusive: false, reason: null };
}
