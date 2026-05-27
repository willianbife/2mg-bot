import { GuildMember, VoiceChannel } from "discord.js";
import { prisma } from "@neon/database";
import { audit } from "./auditService.js";

export async function updateManagedCall(input: {
  channel: VoiceChannel;
  executor: GuildMember;
  name?: string;
  userLimit?: number;
  locked?: boolean;
}) {
  const guild = await prisma.guild.upsert({
    where: { discordId: input.channel.guild.id },
    update: { name: input.channel.guild.name },
    create: { discordId: input.channel.guild.id, name: input.channel.guild.name }
  });

  if (input.name) await input.channel.setName(input.name, "Managed call rename");
  if (typeof input.userLimit === "number") await input.channel.setUserLimit(input.userLimit, "Managed call limit");

  const call = await prisma.call.upsert({
    where: { channelId: input.channel.id },
    update: {
      name: input.name ?? input.channel.name,
      userLimit: input.userLimit,
      locked: input.locked ?? false
    },
    create: {
      guildId: guild.id,
      channelId: input.channel.id,
      ownerId: input.executor.id,
      name: input.name ?? input.channel.name,
      userLimit: input.userLimit,
      locked: input.locked ?? false
    }
  });

  await audit({ guildId: guild.id, actorId: input.executor.id, bot: "INFO", action: "CALL_UPDATE", metadata: call });
  return call;
}
