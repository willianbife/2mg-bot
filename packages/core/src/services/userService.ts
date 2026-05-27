import { GuildMember, User } from "discord.js";
import { prisma } from "@neon/database";

export async function upsertDiscordUser(user: User | GuildMember) {
  const source = "user" in user ? user.user : user;
  return prisma.user.upsert({
    where: { discordId: source.id },
    update: {
      username: source.username,
      avatarUrl: source.displayAvatarURL({ extension: "png", size: 256 })
    },
    create: {
      discordId: source.id,
      username: source.username,
      avatarUrl: source.displayAvatarURL({ extension: "png", size: 256 })
    }
  });
}
