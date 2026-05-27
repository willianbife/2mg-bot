import { GuildMember } from "discord.js";
import { prisma } from "@neon/database";

export async function canUse(member: GuildMember, permission: string) {
  if (member.guild.ownerId === member.id) return true;

  const guild = await prisma.guild.findUnique({ where: { discordId: member.guild.id } });
  if (!guild) return false;

  const roleIds = member.roles.cache.map((role) => role.id);
  const permissions = await prisma.permission.findMany({
    where: {
      guildId: guild.id,
      permission,
      allow: true,
      AND: [
        {
          OR: [
            { subjectId: member.id, scope: "USER" },
            { subjectId: { in: roleIds }, scope: "ROLE" },
            { subjectId: "OWNER", scope: "WHITELIST" },
            { subjectId: "STAFF", scope: "WHITELIST" }
          ]
        },
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
        }
      ],
    }
  });

  return permissions.length > 0;
}

export async function requirePermission(member: GuildMember, permission: string) {
  const allowed = await canUse(member, permission);
  if (!allowed) throw new Error(`Permissao negada: ${permission}`);
}
