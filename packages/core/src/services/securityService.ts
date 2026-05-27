import { Guild, GuildMember } from "discord.js";
import { prisma } from "@neon/database";
import { audit } from "./auditService.js";
import { upsertDiscordUser } from "./userService.js";

export async function createBlacklist(input: {
  guild: Guild;
  executor: GuildMember;
  targetId: string;
  reason: string;
  global?: boolean;
  proofUrls?: string[];
  expiresAt?: Date;
}) {
  const guild = await prisma.guild.upsert({
    where: { discordId: input.guild.id },
    update: { name: input.guild.name },
    create: { discordId: input.guild.id, name: input.guild.name }
  });

  const targetUser = await input.guild.client.users.fetch(input.targetId);
  const dbUser = await upsertDiscordUser(targetUser);

  const record = await prisma.blacklist.create({
    data: {
      guildId: input.global ? null : guild.id,
      userId: dbUser.id,
      executorId: input.executor.id,
      reason: input.reason,
      global: input.global ?? false,
      proofUrls: input.proofUrls ?? [],
      expiresAt: input.expiresAt
    }
  });

  await audit({
    guildId: guild.id,
    actorId: input.executor.id,
    targetId: dbUser.id,
    bot: "SECURITY",
    action: "BLACKLIST_CREATE",
    reason: input.reason,
    metadata: { global: input.global ?? false }
  });

  return record;
}
