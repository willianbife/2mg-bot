import { Message } from "discord.js";
import { createTicket, env, PrefixCommand, TicketType } from "@neon/core";

const aliases: Record<string, TicketType> = {
  suporte: "SUPPORT",
  support: "SUPPORT",
  denuncia: "REPORT",
  report: "REPORT",
  devolucao: "ROLE_RETURN",
  transferencia: "ACCOUNT_TRANSFER",
  migracao: "MIGRATION",
  ingresso: "JOIN_COMMUNITY"
};

export const prefixTicketCommand: PrefixCommand = {
  name: "ticket",
  aliases: ["suporte"],
  description: "Abre ticket por prefixo.",
  usage: `${env.BOT_PREFIX}ticket suporte`,

  async execute(message: Message, args: string[]) {
    if (!message.guild || !message.member) return;
    const type = aliases[args[0]?.toLowerCase() ?? "suporte"] ?? "SUPPORT";
    const ticket = await createTicket(message.guild, message.member as any, type);
    await message.reply(`Ticket criado: <#${ticket.channelId}>`);
  }
};
