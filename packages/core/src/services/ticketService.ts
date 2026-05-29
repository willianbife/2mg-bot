import {
  ChannelType,
  Guild,
  GuildMember,
  PermissionFlagsBits,
  TextChannel
} from "discord.js";
import { prisma } from "@neon/database";
import { CooldownGuard } from "../guards/cooldown.js";
import { ticketEmbed } from "../embeds/index.js";
import { upsertDiscordUser } from "./userService.js";

const ticketCooldown = new CooldownGuard("tickets");

export type TicketType = "SUPPORT" | "ROLE_RETURN" | "ACCOUNT_TRANSFER" | "MIGRATION" | "JOIN_COMMUNITY" | "REPORT";

export async function createTicket(guild: Guild, member: GuildMember, type: TicketType, metadata = {}) {
  const hit = await ticketCooldown.consume(`${guild.id}:${member.id}:${type}`, 1, 300);
  if (!hit.allowed) throw new Error(`Aguarde ${hit.resetIn}s para abrir outro ticket deste tipo.`);

  const dbGuild = await prisma.guild.upsert({
    where: { discordId: guild.id },
    update: { name: guild.name },
    create: { discordId: guild.id, name: guild.name }
  });
  const dbUser = await upsertDiscordUser(member);

  const channel = await guild.channels.create({
    name: `ticket-${type.toLowerCase()}-${member.user.username}`.slice(0, 90),
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ],
    reason: `Ticket ${type} criado por ${member.user.tag}`
  });

  const ticket = await prisma.ticket.create({
    data: {
      guildId: dbGuild.id,
      userId: dbUser.id,
      channelId: channel.id,
      type,
      metadata
    }
  });

  await (channel as TextChannel).send({
    embeds: [
      ticketEmbed({
        status: "opened",
        title: type,
        ticketId: ticket.id,
        userId: member.id,
        timestamp: new Date(),
        metadata: {
          "Tipo": type,
          "Status": "Aguardando Staff"
        }
      }).setDescription(`Atendimento iniciado profissionalmente. Um membro da equipe analisará sua solicitação em breve.`)
    ]
  });

  return ticket;
}

export async function claimTicket(channelId: string, staffId: string) {
  return prisma.ticket.update({
    where: { channelId },
    data: { status: "CLAIMED", claimedBy: staffId }
  });
}

export async function addTicketMessage(channelId: string, authorId: string, content: string, attachments: any = []) {
  const ticket = await prisma.ticket.findUnique({ where: { channelId } });
  if (!ticket) return null;

  return prisma.ticketMessage.create({
    data: {
      ticketId: ticket.id,
      authorId,
      content,
      attachments
    }
  });
}

export async function closeTicket(channelId: string, reason: string) {
  return prisma.ticket.update({
    where: { channelId },
    data: { status: "CLOSED", closedAt: new Date(), metadata: { closeReason: reason } }
  });
}
